import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../match/match.module';
import { matchmakingConfig } from '../../shared/config/matchmaking-config';
import {
  addMinutes,
  dateTimeToInstant,
  minInstant,
} from './matchmaking-time.util';

type Executor = any;

const REQUIRED_PLAYERS: Record<string, number> = { SINGLES: 2, DOUBLES: 4 };

function isPgUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === '23505' || candidate?.cause?.code === '23505';
}

function effectiveRequestStatus(status: string, expiresAt: Date, now: Date): string {
  if (status === 'OPEN' && expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return status;
}

function effectiveInvitationStatus(status: string, expiresAt: Date, now: Date): string {
  if (status === 'PENDING' && expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return status;
}

function assignTeams(matchType: string, playerIds: number[]): { playerId: number; teamNo: number }[] {
  if (matchType === 'SINGLES') {
    return playerIds.map((playerId, index) => ({ playerId, teamNo: index + 1 }));
  }
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((playerId, index) => ({ playerId, teamNo: index < 2 ? 1 : 2 }));
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
      groupPlayerIds: accepted.map((row: any) => row.inviteeId),
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
        if (accepted.some((row: any) => row.inviteeId === inviteeId)) {
          throw new AppError('MATCHMAKING_INVITATION_DUPLICATE', 409, 'Người chơi đã ở trong nhóm của bạn');
        }
        await matchmakingRepository.expirePendingForRequest(requestId, tx);
        const pending = await matchmakingRepository.findPendingInvitation(requestId, inviteeId, tx);
        if (pending) {
          throw new AppError('MATCHMAKING_INVITATION_DUPLICATE', 409, 'Đã có lời mời đang chờ cho người chơi này');
        }

        const expiresAt = minInstant(
          addMinutes(now, config.invitationTimeoutMinutes),
          request.expiresAt
        );
        const inserted = await matchmakingRepository.insertInvitation(
          { requestId, inviterId: ownerId, inviteeId, expiresAt },
          tx
        );

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
      if (!snapshot) throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      const requestSnapshot = await matchmakingRepository.findRequestById(snapshot.requestId);
      if (!requestSnapshot) throw new NotFoundError('Không tìm thấy yêu cầu', 'MATCHMAKING_REQUEST_NOT_FOUND');
      const members = await matchmakingRepository.findAcceptedInvitees(snapshot.requestId);
      const lockedIds = [requestSnapshot.playerId, snapshot.inviteeId, ...members.map((m: any) => m.inviteeId)];
      const result = await db.transaction(async (tx) => {
        await matchmakingRepository.lockUsersAscending(lockedIds, tx);
        const request = await matchmakingRepository.lockRequestById(snapshot.requestId, tx);
        const currentMembers = await matchmakingRepository.findAcceptedInvitees(snapshot.requestId, tx);
        if (currentMembers.some((m: any) => !lockedIds.includes(m.inviteeId))) return { retry: true as const };
        const invitation = await matchmakingRepository.lockInvitationById(invitationId, tx);
        return { retry: false as const, value: await action(tx, request, invitation) };
      });
      if (!result.retry) return result.value;
    }
  }

  async respond(inviteeId: number, invitationId: number, decision: 'ACCEPTED' | 'DECLINED'): Promise<RespondResult> {
    const result = await this.withInvitationGroup(invitationId, async (tx, request, invitation): Promise<RespondResult | AppError> => {
      const now = new Date();
      if (!invitation || invitation.inviteeId !== inviteeId) {
        throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      }

      if (invitation.status === decision) {
        const link = await matchmakingRepository.findMatchLinkByRequestId(invitation.requestId, tx);
        return { invitationId, requestId: invitation.requestId, status: decision, matchId: link?.matchId ?? null };
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
        await matchmakingRepository.updateInvitationStatus(invitationId, request?.status === 'CANCELLED' || request?.status === 'MATCHED' ? 'CANCELLED' : 'EXPIRED', null, 'PENDING', tx);
        return new AppError('MATCHMAKING_INVITATION_EXPIRED', 409, 'Yêu cầu không còn mở');
      }

      if (decision === 'DECLINED') {
        await matchmakingRepository.updateInvitationStatus(invitationId, 'DECLINED', now, 'PENDING', tx);
        return { invitationId, requestId: request.id, status: 'DECLINED', matchId: null };
      }

      const windowStart = dateTimeToInstant(request.preferredDate, request.preferredStartTime);
      const windowEnd = dateTimeToInstant(request.preferredDate, request.preferredEndTime);
      const conflict = await matchmakingRepository.hasOverlappingCommitment(
        inviteeId,
        windowStart,
        windowEnd,
        request.id,
        tx
      );
      if (conflict) {
        throw new AppError('MATCHMAKING_SCHEDULE_CONFLICT', 409, 'Người chơi đã có lịch chơi trùng với khung giờ này');
      }

      const acceptedUpdate = await matchmakingRepository.updateInvitationStatus(
        invitationId,
        'ACCEPTED',
        now,
        'PENDING',
        tx
      );
      if (!acceptedUpdate) {
        throw new AppError('MATCHMAKING_INVITATION_NOT_PENDING', 409, 'Lời mời đã được xử lý hoặc đã đóng');
      }

      const required = REQUIRED_PLAYERS[request.matchType] ?? 2;
      const accepted = await matchmakingRepository.findAcceptedInvitees(request.id, tx);
      const groupIds = [request.playerId, ...accepted.map((row: any) => row.inviteeId)];
      if (groupIds.length < required) {
        return { invitationId, requestId: request.id, status: 'ACCEPTED', matchId: null };
      }

      // Full group: form exactly one Match atomically.
      const freshAccepted = await matchmakingRepository.findAcceptedInvitees(request.id, tx);
      const freshGroupIds = [request.playerId, ...freshAccepted.map((row: any) => row.inviteeId)];
      if (freshGroupIds.length < required) {
        return { invitationId, requestId: request.id, status: 'ACCEPTED', matchId: null };
      }

      for (const memberId of freshGroupIds) {
        if (await matchmakingRepository.hasOverlappingCommitment(memberId, windowStart, windowEnd, request.id, tx)) {
          throw new AppError('MATCHMAKING_SCHEDULE_CONFLICT', 409, 'Thành viên đã có lịch chơi trùng');
        }
      }

      const { matchId } = await matchModule.createMatchWithPlayers(
        {
          matchType: request.matchType as 'SINGLES' | 'DOUBLES',
          scheduledAt: windowStart,
          bookingDeadlineAt: windowStart,
          status: 'PENDING_COURT',
          players: assignTeams(request.matchType, freshGroupIds),
        },
        tx
      );
      await matchmakingRepository.insertMatchLink(request.id, matchId, tx);
      await matchmakingRepository.updateRequestStatus(request.id, 'MATCHED', tx);
      await matchmakingRepository.closePendingInvitationsForRequest(request.id, 'CANCELLED', tx);

      return { invitationId, requestId: request.id, status: 'ACCEPTED', matchId };
    });
    if (result instanceof AppError) throw result;
    return result;
  }

  async cancelInvitation(inviterId: number, invitationId: number) {
    return this.withInvitationGroup(invitationId, async (tx, request, invitation) => {
      if (!invitation || invitation.inviterId !== inviterId) {
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

  async withdrawInvitation(inviteeId: number, invitationId: number) {
    return this.withInvitationGroup(invitationId, async (tx, request, invitation) => {
      const now = new Date();
      if (!invitation || invitation.inviteeId !== inviteeId) {
        throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
      }
      if (invitation.status === 'WITHDRAWN') return { id: invitationId, status: 'WITHDRAWN' };
      if (invitation.status !== 'ACCEPTED') {
        throw new AppError('MATCHMAKING_INVITATION_NOT_WITHDRAWABLE', 409, 'Không thể rút khỏi nhóm ở thời điểm này');
      }
      if (!request || effectiveRequestStatus(request.status, request.expiresAt, now) !== 'OPEN') {
        throw new AppError('MATCHMAKING_INVITATION_NOT_WITHDRAWABLE', 409, 'Nhóm đã hình thành, không thể rút');
      }
      await matchmakingRepository.updateInvitationStatus(invitationId, 'WITHDRAWN', now, 'ACCEPTED', tx);
      return { id: invitationId, status: 'WITHDRAWN' };
    });
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
    return rows.map((row: any) => row.inviteeId);
  }

  private async rankRange(minSkillLevelId: number, maxSkillLevelId: number) {
    const levels = await matchmakingRepository.findSkillLevelsByIds([minSkillLevelId, maxSkillLevelId]);
    const min = levels.find((level: any) => level.id === minSkillLevelId);
    const max = levels.find((level: any) => level.id === maxSkillLevelId);
    return { minRank: min?.rank ?? 1, maxRank: max?.rank ?? 6 };
  }
}

export const matchInvitationService = new MatchInvitationService();
