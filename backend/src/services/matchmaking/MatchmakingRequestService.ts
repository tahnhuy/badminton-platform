import { db, matchmakingRequestConversations } from '../../db';
import { eq } from 'drizzle-orm';
import { AppError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchmakingConfig } from '../../shared/config/matchmaking-config';
import { insertLegacyRecruitmentPost, isPostPublished, postContentPort } from '../social/recruitment-post';
import { recruitmentAccess } from './RecruitmentService';
import { recruitmentLifecycleService } from './RecruitmentLifecycleService';
import type { BookingAction } from '../../contracts/RecruitmentPort';
import {
  addMinutes,
  dateTimeToInstant,
  minInstant,
  timeToMinutes,
  windowLengthMinutes,
  requestScheduleFields,
} from './matchmaking-time.util';

const REQUIRED_PLAYERS: Record<string, number> = { SINGLES: 2, DOUBLES: 4 };

export interface CreateRequestInput {
  matchType: 'SINGLES' | 'DOUBLES';
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  area: string;
}

function isPgUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate?.code === '23505' || candidate?.cause?.code === '23505';
}

function requiredPlayers(matchType: string): number {
  return REQUIRED_PLAYERS[matchType] ?? 2;
}

function normalizeTime(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function toSkill(row: {
  skillLevelId?: number | null;
  skillCode?: string | null;
  skillName?: string | null;
  skillRank?: number | null;
}) {
  if (row.skillLevelId == null) return null;
  return { id: row.skillLevelId, code: row.skillCode ?? null, name: row.skillName ?? null, rank: row.skillRank ?? null };
}

export class MatchmakingRequestService {
  async createRequest(playerId: number, input: CreateRequestInput) {
    const config = await matchmakingConfig.get();
    if (!config.enabled) {
      throw new AppError('MATCHMAKING_DISABLED', 409, 'Tính năng ghép trận đang tạm khóa');
    }

    const levels = await matchmakingRepository.findSkillLevelsByIds([
      input.minSkillLevelId,
      input.maxSkillLevelId,
    ]);
    const min = levels.find((level: any) => level.id === input.minSkillLevelId);
    const max = levels.find((level: any) => level.id === input.maxSkillLevelId);
    if (!min || !max || min.rank > max.rank) {
      throw new AppError('MATCHMAKING_INVALID_SKILL_RANGE', 400, 'Khoảng trình độ không hợp lệ: trình độ tối thiểu phải thấp hơn hoặc bằng tối đa');
    }

    const windowMinutes = windowLengthMinutes(input.preferredStartTime, input.preferredEndTime);
    if (windowMinutes < config.matchDurationMinutes || timeToMinutes(input.preferredEndTime) <= timeToMinutes(input.preferredStartTime)) {
      throw new AppError('MATCHMAKING_INVALID_TIME_WINDOW', 400, 'Khung giờ không hợp lệ, phải dài ít nhất bằng thời lượng trận đấu');
    }

    const now = new Date();
    const windowStart = dateTimeToInstant(input.preferredDate, input.preferredStartTime);
    // MM-21/MM-26: the recruitment interval is [start_at, start_at + duration); legacy
    // requests start at the window start with the duration snapshot (§24.11 step 3).
    const intervalEnd = addMinutes(windowStart, config.matchDurationMinutes);
    if (windowStart.getTime() < addMinutes(now, config.minLeadTimeMinutes).getTime()) {
      throw new AppError('MATCHMAKING_START_TOO_SOON', 400, `Giờ bắt đầu phải sau ít nhất ${config.minLeadTimeMinutes} phút kể từ bây giờ`);
    }


    try {
      return await db.transaction(async (tx) => {
        await matchmakingRepository.lockUsersAscending([playerId], tx);
        const lockedNow = new Date();
        if (windowStart.getTime() < addMinutes(lockedNow, config.minLeadTimeMinutes).getTime()) {
          throw new AppError('MATCHMAKING_START_TOO_SOON', 400, `Giờ bắt đầu phải sau ít nhất ${config.minLeadTimeMinutes} phút kể từ bây giờ`);
        }
        const expiresAt = minInstant(addMinutes(lockedNow, config.requestExpirationMinutes), windowStart);
        const expiredIds = await matchmakingRepository.expireOverdueOpenRequestsForPlayer(
          playerId,
          input.matchType,
          tx
        );
        for (const expiredId of expiredIds) {
          await matchmakingRepository.closePendingInvitationsForRequest(expiredId, 'EXPIRED', tx);
        }

        const existing = await matchmakingRepository.findOpenRequestByPlayerAndType(
          playerId,
          input.matchType,
          tx
        );
        if (existing) {
          throw new AppError('MATCHMAKING_ACTIVE_REQUEST_LIMIT', 409, 'Bạn đã có một yêu cầu đang mở cho loại trận này');
        }

        const overlapping = await matchmakingRepository.hasOverlappingCommitment(
          playerId,
          windowStart,
          intervalEnd,
          null,
          tx
        );
        if (overlapping) {
          throw new AppError('MATCHMAKING_SCHEDULE_CONFLICT', 409, 'Bạn đã có lịch chơi trùng với khung giờ này');
        }

        // §24.7.3 "Create match-finding post": users(10) → posts(100, new row) → requests(30, new row).
        const postId = await insertLegacyRecruitmentPost(playerId, tx);
        const required = requiredPlayers(input.matchType);
        const inserted = await matchmakingRepository.insertRequest(
          {
            playerId,
            postId,
            startAt: windowStart,
            durationMinutes: config.matchDurationMinutes,
            capacity: required,
            minPlayers: required,
            matchType: input.matchType,
            minSkillLevelId: input.minSkillLevelId,
            maxSkillLevelId: input.maxSkillLevelId,
            preferredDate: input.preferredDate,
            preferredStartTime: normalizeTime(input.preferredStartTime),
            preferredEndTime: normalizeTime(input.preferredEndTime),
            area: input.area,
            matchDurationMinutes: config.matchDurationMinutes,
            expiresAt,
          },
          tx
        );
        return inserted;
      }).then((inserted) => this.getRequestDetail(playerId, inserted.id));
    } catch (error) {
      if (isPgUniqueViolation(error)) {
        throw new AppError('MATCHMAKING_ACTIVE_REQUEST_LIMIT', 409, 'Bạn đã có một yêu cầu đang mở cho loại trận này');
      }
      throw error;
    }
  }

  async listRequests(playerId: number, filter: { status?: string; page: number; limit: number }) {
    const { items, total } = await matchmakingRepository.findRequestsForPlayer(playerId, filter);
    const mapped = await Promise.all(items.map((row: any) => this.toSummary(row, playerId)));
    return {
      items: mapped,
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: filter.limit > 0 ? Math.ceil(total / filter.limit) : 0,
      },
    };
  }

  async getRequestDetail(actorId: number, requestId: number) {
    const request = await matchmakingRepository.findRequestById(requestId);
    if (!request) throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');

    const accepted = await matchmakingRepository.findAcceptedInvitees(requestId);
    const isOwner = request.playerId === actorId;
    // Existing rule (matchmaking.test.ts "revokes partial-group access"): an ACCEPTED row
    // gives member access while the request is OPEN; afterwards only Match participants keep
    // it. The Social projection applies the same rule (recruitmentAccess, memberActive).
    // Effective status shared with the scheduler and lists (MM-27, recruitment-state.ts).
    const effective = (await matchmakingRepository.findEffectiveStatus(requestId)) ?? request.status;
    const isAcceptedMember = (effective === 'OPEN' || (effective === 'MATCHED' && request.status === 'OPEN'))
      && accepted.some((row: any) => row.playerId === actorId);
    const link = await matchmakingRepository.findMatchLinkByRequestId(requestId);
    const isMatchParticipant = link && (await matchmakingRepository.findMatchPlayers(link.matchId)).some((p: any) => p.playerId === actorId);
    const now = new Date();
    if (!isOwner && !isAcceptedMember && !isMatchParticipant) {
      // MM-23 detail tiers (Tech Design §24.9): pending invitee → response context;
      // other Players → public card fields when published and the post is visible.
      // Same tier decision as the Social projection (RecruitmentService.recruitmentAccess).
      const pendingRow = await matchmakingRepository.findPendingInvitation(requestId, actorId);
      const pending = pendingRow?.kind === 'INVITE' ? pendingRow : null;
      const published = await isPostPublished(request.postId, db as any);
      const tier = recruitmentAccess(pending && pending.expiresAt.getTime() > now.getTime() ? 'PENDING' : null, published);
      const visible = tier === 'PUBLIC' || tier === 'INVITEE'
        ? await postContentPort.isVisible(request.postId, actorId)
        : false;
      if (!visible) {
        throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
      }
      const isPendingInvitee = tier === 'INVITEE';
      const [host] = await matchmakingRepository.findPlayerProfileSummaries([request.playerId]);
      const limited = {
        id: request.id,
        access: isPendingInvitee ? 'INVITEE' as const : 'PUBLIC' as const,
        postId: request.postId,
        matchType: request.matchType,
        status: effective,
        startAt: request.startAt,
        durationMinutes: request.durationMinutes,
        capacity: request.capacity,
        minPlayers: request.minPlayers,
        companionCount: request.companionCount,
        filledSlots: 1 + request.companionCount + accepted.length,
        minSkillLevelId: request.minSkillLevelId,
        maxSkillLevelId: request.maxSkillLevelId,
        costNote: request.costNote ?? null,
        host: { playerId: request.playerId, displayName: host?.displayName ?? null },
      };
      // Response context only: no roster for a pending invitee of an unpublished post.
      if (isPendingInvitee) return { ...limited, invitationId: pending!.id };
      const publicMembers = await matchmakingRepository.findPlayerProfileSummaries(accepted.map((row: any) => row.playerId));
      return {
        ...limited,
        ...(pending ? { invitationId: pending.id } : {}),
        members: publicMembers.map((m: any) => ({ playerId: m.playerId, displayName: m.displayName })),
        // Same PUBLIC field set as the Social projection: the declared court, never verified.
        externalCourt: request.externalCourtName
          ? { name: request.externalCourtName, city: request.externalCourtCity, district: request.externalCourtDistrict, address: request.externalCourtAddress, verified: false }
          : null,
      };
    }

    const [chat] = isOwner ? await db.select({ conversationId: matchmakingRequestConversations.conversationId })
      .from(matchmakingRequestConversations).where(eq(matchmakingRequestConversations.requestId, requestId)) : [];
    const members = await matchmakingRepository.findPlayerProfileSummaries([
      request.playerId,
      ...accepted.map((row: any) => row.playerId),
    ]);
    const required = requiredPlayers(request.matchType);

    return {
      id: request.id,
      access: isOwner ? 'HOST' as const : 'MEMBER' as const,
      postId: request.postId,
      startAt: request.startAt,
      durationMinutes: request.durationMinutes,
      capacity: request.capacity,
      minPlayers: request.minPlayers,
      companionCount: request.companionCount,
      costNote: request.costNote ?? null,
      matchType: request.matchType,
      status: effective,
      cancellationReason: request.cancellationReason ?? null,
      closedEarlyAt: request.closedEarlyAt ?? null,
      externalCourt: request.externalCourtName
        ? { name: request.externalCourtName, city: request.externalCourtCity, district: request.externalCourtDistrict, address: request.externalCourtAddress, verified: false }
        : null,
      minSkillLevelId: request.minSkillLevelId,
      maxSkillLevelId: request.maxSkillLevelId,
      ...requestScheduleFields(request),
      area: request.area,
      matchDurationMinutes: request.matchDurationMinutes,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      requiredPlayers: required,
      acceptedCount: accepted.length,
      currentPlayers: accepted.length + 1,
      remainingCount: Math.max(0, required - accepted.length - 1),
      matchId: link?.matchId ?? null,
      conversationId: chat?.conversationId ?? null,
      isOwner,
      invitationId: isAcceptedMember ? accepted.find((row: any) => row.playerId === actorId)?.id ?? null : null,
      members: members.map((member: any) => ({
        playerId: member.playerId,
        displayName: member.displayName,
        skill: toSkill(member),
        isOwner: member.playerId === request.playerId,
      })),
    };
  }

  /**
   * POST /matchmaking-requests/:id/cancel (MM-25): host cancellation of an OPEN or MATCHED
   * post before start; `CANCEL` also queues cancellation of the linked booking through
   * MM-20. Omitted `bookingAction` means KEEP (the current frontend sends no body).
   */
  async cancelRequest(playerId: number, requestId: number, bookingAction: BookingAction = 'KEEP') {
    const result = await recruitmentLifecycleService.cancel(playerId, requestId, bookingAction);
    return { id: result.id, status: result.status };
  }

  private async toSummary(request: any, playerId: number) {
    const accepted = await matchmakingRepository.findAcceptedInvitees(request.id);
    const link = await matchmakingRepository.findMatchLinkByRequestId(request.id);
    const required = requiredPlayers(request.matchType);
    return {
      id: request.id,
      isOwner: request.playerId === playerId,
      matchType: request.matchType,
      status: (await matchmakingRepository.findEffectiveStatus(request.id)) ?? request.status,
      ...requestScheduleFields(request),
      area: request.area,
      matchDurationMinutes: request.matchDurationMinutes,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      requiredPlayers: required,
      acceptedCount: accepted.length,
      remainingCount: Math.max(0, required - accepted.length - 1),
      matchId: link?.matchId ?? null,
    };
  }
}

export const matchmakingRequestService = new MatchmakingRequestService();
