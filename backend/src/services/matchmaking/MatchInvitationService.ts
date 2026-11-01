import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { membershipService } from './MembershipService';
import { isBlockedEitherWay } from './block-port.registry';
import { recruitmentLifecycleService } from './RecruitmentLifecycleService';
import { matchmakingNotifications } from './matchmaking-notifications';
import { matchmakingConfig } from '../../shared/config/matchmaking-config';
import {
  addMinutes,
  minInstant,
} from './matchmaking-time.util';

type Executor = any;

function isPgUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === '23505' || candidate?.cause?.code === '23505';
}

function effectiveRequestStatus(status: string, expiresAt: Date | null, now: Date): string {
  if (status === 'OPEN' && expiresAt && expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return status;
}

function effectiveInvitationStatus(status: string, expiresAt: Date, now: Date): string {
  if (status === 'PENDING' && expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return status;
}

function toSkill(row: {
  skillLevelId?: number | null;
  skillCode?: string | null;
  skillName?: string | null;
  skillRank?: number | null;
}) {
  if (row.skillLevelId == null) return null;
  return {
    id: row.skillLevelId,
    code: row.skillCode ?? null,
    name: row.skillName ?? null,
    rank: row.skillRank ?? null,
  };
}

export interface RespondResult {
  invitationId: number;
  requestId: number;
  status: string;
  matchId: number | null;
}

export class MatchInvitationService {
  async browseCandidates(ownerId: number, requestId: number, query: {
    search?: string;
    includeOutOfRange: boolean;
    page: number;
    limit: number;
  }) {
    const request = await matchmakingRepository.findRequestById(requestId);
    if (!request) throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
    if (request.playerId !== ownerId) {
      throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
    }
    const now = new Date();
    if (effectiveRequestStatus(request.status, request.expiresAt, now) !== 'OPEN') {
      throw new AppError('MATCHMAKING_REQUEST_NOT_OPEN', 409, 'Yêu cầu không còn mở để mời thêm người');
    }

    const accepted = await matchmakingRepository.findAcceptedInvitees(requestId);
    const { minRank, maxRank } = await this.rankRange(request.minSkillLevelId, request.maxSkillLevelId);

    const candidates = await matchmakingRepository.findCandidates({
      ownerId,
      groupPlayerIds: accepted.map((row: any) => row.playerId),
      pendingInviteeIds: (await this.pendingInviteeIds(requestId)),
      search: query.search,
      includeOutOfRange: query.includeOutOfRange,
      minRank,
      maxRank,
      page: query.page,
      limit: query.limit,
    });

    return {
      items: candidates.items.map((row: any) => ({
        playerId: row.playerId,
        displayName: row.displayName,
        skill: toSkill(row),
        skillMismatch: row.skillRank < minRank || row.skillRank > maxRank,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total: candidates.total,
        totalPages: query.limit > 0 ? Math.ceil(candidates.total / query.limit) : 0,
      },
    };
  }

  async sendInvitation(ownerId: number, requestId: number, inviteeId: number) {
    const config = await matchmakingConfig.get();
    if (!config.enabled) {
      throw new AppError('MATCHMAKING_DISABLED', 409, 'Tính năng ghép trận đang tạm khóa');
    }

    try {
      return await db.transaction(async (tx) => {
        // §24.7.3 "Apply / Invite send": users(10, host + joiner) → requests(30) → invitations(40).
        // Holding both USERS rows also serializes against MatchmakingBlockPort.closePendingBetween.
        await matchmakingRepository.lockUsersAscending([ownerId, inviteeId], tx);
        const request = await matchmakingRepository.lockRequestById(requestId, tx);
        if (!request || request.playerId !== ownerId) {
          throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
        }
        const now = new Date();
        if (effectiveRequestStatus(request.status, request.expiresAt, now) !== 'OPEN') {
          throw new AppError('MATCHMAKING_REQUEST_NOT_OPEN', 409, 'Yêu cầu không còn mở để mời thêm người');
        }
        if (inviteeId === ownerId) {
          throw new AppError('MATCHMAKING_INVITATION_SELF', 409, 'Bạn không thể tự mời chính mình');
        }

        const invitee = await matchmakingRepository.findInviteeProfile(inviteeId, tx);
        if (!invitee || invitee.role !== 'PLAYER' || invitee.deletedAt !== null) {
          throw new NotFoundError('Không tìm thấy người chơi được mời', 'MATCHMAKING_INVITEE_NOT_FOUND');
        }

        const accepted = await matchmakingRepository.findAcceptedInvitees(requestId, tx);
        if (accepted.some((row: any) => row.playerId === inviteeId)) {
          throw new AppError('MATCHMAKING_INVITATION_DUPLICATE', 409, 'Người chơi đã ở trong nhóm của bạn');
        }
        await matchmakingRepository.expirePendingForRequest(requestId, tx);
        const pending = await matchmakingRepository.findPendingInvitation(requestId, inviteeId, tx);
        if (pending?.kind === 'APPLY') {
          // §13.5: one active row per Player and request across both kinds.
          throw new AppError('MATCHMAKING_ALREADY_ACTIVE', 409, 'Người chơi đã có yêu cầu tham gia đang chờ cho kèo này');
        }
        if (pending) {
          throw new AppError('MATCHMAKING_INVITATION_DUPLICATE', 409, 'Đã có lời mời đang chờ cho người chơi này');
        }
        // Matrix §3.13: a block in either direction prevents a new Invite (neutral code).
        if (await isBlockedEitherWay(ownerId, inviteeId, tx)) {
          throw new AppError('MATCHMAKING_ACTION_NOT_AVAILABLE', 409, 'Không thể thực hiện thao tác này');
        }

        const expiresAt = minInstant(
          addMinutes(now, config.invitationTimeoutMinutes),
          request.expiresAt ?? request.startAt
        );
        const inserted = await matchmakingRepository.insertInvitation(
          { requestId, createdBy: ownerId, playerId: inviteeId, kind: 'INVITE', expiresAt },
          tx
        );
        // MM-31: MM_INVITATION_RECEIVED (including unpublished posts); invitee USERS row held.
        await matchmakingNotifications.invitationReceived(tx, requestId, inserted.id, inviteeId);

        return {
          id: inserted.id,
          requestId,
          inviteeId,
          status: 'PENDING',
          expiresAt: inserted.expiresAt,
        };
      });
    } catch (error) {
      if (isPgUniqueViolation(error)) {
        throw new AppError('MATCHMAKING_INVITATION_DUPLICATE', 409, 'Đã có lời mời đang chờ cho người chơi này');
      }
      throw error;
    }
  }

  async listInvitations(playerId: number, filter: {
    direction: 'RECEIVED' | 'SENT';
    status?: string;
    page: number;
    limit: number;
  }) {
    const now = new Date();
    const { items, total } = await matchmakingRepository.findInvitationsForPlayer(playerId, filter);
    return {
      items: items.map((row: any) => ({
        id: row.id,
        requestId: row.requestId,
        matchId: row.matchId != null ? Number(row.matchId) : null,
        direction: filter.direction,
        status: effectiveInvitationStatus(row.status, row.expiresAt, now),
        expiresAt: row.expiresAt,
        respondedAt: row.respondedAt,
        createdAt: row.createdAt,
        counterpart: {
          playerId: row.counterpartId,
          displayName: row.counterpartName,
          skill: toSkill(row),
        },
        request: {
          matchType: row.requestMatchType,
          preferredDate: row.requestPreferredDate,
          preferredStartTime: row.requestPreferredStartTime,
          preferredEndTime: row.requestPreferredEndTime,
          area: row.requestArea,
          status: row.requestStatus,
        },
      })),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: filter.limit > 0 ? Math.ceil(total / filter.limit) : 0,
      },
    };
  }

  private async withInvitationGroup<T>(invitationId: number, action: (tx: Executor, request: any, invitation: any) => Promise<T>): Promise<T> {
    for (;;) {
      const snapshot = await matchmakingRepository.findInvitationById(invitationId);
      if (!snapshot || snapshot.kind !== 'INVITE') throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      const requestSnapshot = await matchmakingRepository.findRequestById(snapshot.requestId);
      if (!requestSnapshot) throw new NotFoundError('Không tìm thấy yêu cầu', 'MATCHMAKING_REQUEST_NOT_FOUND');
      const members = await matchmakingRepository.findAcceptedInvitees(snapshot.requestId);
      const lockedIds = [requestSnapshot.playerId, snapshot.playerId, ...members.map((m: any) => m.playerId)];
      const result = await db.transaction(async (tx) => {
        await matchmakingRepository.lockUsersAscending(lockedIds, tx);
        const request = await matchmakingRepository.lockRequestById(snapshot.requestId, tx);
        const currentMembers = await matchmakingRepository.findAcceptedInvitees(snapshot.requestId, tx);
        if (currentMembers.some((m: any) => !lockedIds.includes(m.playerId))) return { retry: true as const };
        const invitation = await matchmakingRepository.lockInvitationById(invitationId, tx);
        return { retry: false as const, value: await action(tx, request, invitation) };
      });
      if (!result.retry) return result.value;
    }
  }

  async respond(inviteeId: number, invitationId: number, decision: 'ACCEPTED' | 'DECLINED'): Promise<RespondResult> {
    if (decision === 'ACCEPTED') {
      const snapshot = await matchmakingRepository.findInvitationById(invitationId);
      if (!snapshot || snapshot.kind !== 'INVITE') {
        throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      }
      // MM-22: shared acceptance transaction (§24.5).
      const accepted = await membershipService.acceptMembership(invitationId, inviteeId);
      return { invitationId, requestId: accepted.requestId, status: 'ACCEPTED', matchId: accepted.matchId };
    }
    const result = await this.withInvitationGroup(invitationId, async (tx, request, invitation): Promise<RespondResult | AppError> => {
      const now = new Date();
      if (!invitation || invitation.kind !== 'INVITE' || invitation.playerId !== inviteeId) {
        throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      }
      if (invitation.status === 'DECLINED') {
        const link = await matchmakingRepository.findMatchLinkByRequestId(invitation.requestId, tx);
        return { invitationId, requestId: invitation.requestId, status: 'DECLINED', matchId: link?.matchId ?? null };
      }
      if (invitation.status !== 'PENDING') {
        if (invitation.status === 'EXPIRED' || invitation.expiresAt.getTime() <= now.getTime()) {
          throw new AppError('MATCHMAKING_INVITATION_EXPIRED', 409, 'Lời mời đã hết hạn');
        }
        throw new AppError('MATCHMAKING_INVITATION_NOT_PENDING', 409, 'Lời mời đã được xử lý hoặc đã đóng');
      }
      if (invitation.expiresAt.getTime() <= now.getTime()) {
        await matchmakingRepository.updateInvitationStatus(invitationId, 'EXPIRED', null, 'PENDING', tx);
        return new AppError('MATCHMAKING_INVITATION_EXPIRED', 409, 'Lời mời đã hết hạn');
      }
      if (!request || effectiveRequestStatus(request.status, request.expiresAt, now) !== 'OPEN') {
        const closed = request?.status === 'CANCELLED' || request?.status === 'MATCHED';
        await matchmakingRepository.updateInvitationStatus(invitationId, closed ? 'CANCELLED' : 'EXPIRED', null, 'PENDING', tx,
          request?.status === 'MATCHED' ? { closeReason: 'RECRUITMENT_CLOSED' } : {});
        return new AppError('MATCHMAKING_INVITATION_EXPIRED', 409, 'Yêu cầu không còn mở');
      }
      await matchmakingRepository.updateInvitationStatus(invitationId, 'DECLINED', now, 'PENDING', tx, { decidedBy: inviteeId });
      return { invitationId, requestId: invitation.requestId, status: 'DECLINED', matchId: null };
    });
    if (result instanceof AppError) throw result;
    return result;
  }

  async cancelInvitation(inviterId: number, invitationId: number) {
    return this.withInvitationGroup(invitationId, async (tx, request, invitation) => {
      if (!invitation || invitation.createdBy !== inviterId) {
        throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      }
      if (invitation.status === 'CANCELLED') {
        return { id: invitationId, status: 'CANCELLED' };
      }
      if (invitation.status !== 'PENDING') {
        throw new AppError('MATCHMAKING_INVITATION_NOT_PENDING', 409, 'Lời mời đã được xử lý hoặc đã đóng');
      }
      await matchmakingRepository.updateInvitationStatus(invitationId, 'CANCELLED', null, 'PENDING', tx);
      return { id: invitationId, status: 'CANCELLED' };
    });
  }

  /**
   * Compatibility alias of POST /matchmaking-requests/:id/withdraw (§24.9), kept until the
   * frontend stops using it. Before full the slot is released; after full a GROUP reopens and
   * a Singles/Doubles Match is cancelled (MM-25).
   */
  async withdrawInvitation(inviteeId: number, invitationId: number) {
    return recruitmentLifecycleService.withdrawByInvitation(inviteeId, invitationId);
  }

  async assertOwnerRequest(ownerId: number, requestId: number, executor: Executor = db) {
    const request = await matchmakingRepository.findRequestById(requestId, executor);
    if (!request) throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
    if (request.playerId !== ownerId) {
      throw new ForbiddenError('Bạn không phải chủ sở hữu yêu cầu này', 'MATCHMAKING_REQUEST_NOT_FOUND');
    }
    return request;
  }

  private async pendingInviteeIds(requestId: number, executor: Executor = db): Promise<number[]> {
    const rows = await matchmakingRepository.findPendingInvitees(requestId, executor);
    return rows.map((row: any) => row.playerId);
  }

  private async rankRange(minSkillLevelId: number, maxSkillLevelId: number) {
    const levels = await matchmakingRepository.findSkillLevelsByIds([minSkillLevelId, maxSkillLevelId]);
    const min = levels.find((level: any) => level.id === minSkillLevelId);
    const max = levels.find((level: any) => level.id === maxSkillLevelId);
    return { minRank: min?.rank ?? 1, maxRank: max?.rank ?? 6 };
  }
}

export const matchInvitationService = new MatchInvitationService();
