import { db } from '../../db';
import { AppError, ForbiddenError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchmakingConfig } from '../../shared/config/matchmaking-config';
import { insertLegacyRecruitmentPost } from '../social/recruitment-post';
import {
  addMinutes,
  dateTimeToInstant,
  minInstant,
  timeToMinutes,
  windowLengthMinutes,
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

function effectiveRequestStatus(status: string, expiresAt: Date | null, now: Date): string {
  if (status === 'OPEN' && expiresAt && expiresAt.getTime() <= now.getTime()) return 'EXPIRED';
  return status;
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
    const now = new Date();
    const { items, total } = await matchmakingRepository.findRequestsForPlayer(playerId, filter);
    const mapped = await Promise.all(items.map((row: any) => this.toSummary(row, now)));
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
    const isAcceptedMember = effectiveRequestStatus(request.status, request.expiresAt, new Date()) === 'OPEN'
      && accepted.some((row: any) => row.playerId === actorId);
    const link = await matchmakingRepository.findMatchLinkByRequestId(requestId);
    const isMatchParticipant = link && (await matchmakingRepository.findMatchPlayers(link.matchId)).some((p: any) => p.playerId === actorId);
    if (!isOwner && !isAcceptedMember && !isMatchParticipant) {
      throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
    }

    const now = new Date();
    const members = await matchmakingRepository.findPlayerProfileSummaries([
      request.playerId,
      ...accepted.map((row: any) => row.playerId),
    ]);
    const required = requiredPlayers(request.matchType);

    return {
      id: request.id,
      matchType: request.matchType,
      status: effectiveRequestStatus(request.status, request.expiresAt, now),
      minSkillLevelId: request.minSkillLevelId,
      maxSkillLevelId: request.maxSkillLevelId,
      preferredDate: request.preferredDate,
      preferredStartTime: request.preferredStartTime,
      preferredEndTime: request.preferredEndTime,
      area: request.area,
      matchDurationMinutes: request.matchDurationMinutes,
      expiresAt: request.expiresAt,
      createdAt: request.createdAt,
      requiredPlayers: required,
      acceptedCount: accepted.length,
      currentPlayers: accepted.length + 1,
      remainingCount: Math.max(0, required - accepted.length - 1),
      matchId: link?.matchId ?? null,
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

  async cancelRequest(playerId: number, requestId: number) {
    return db.transaction(async (tx) => {
      const request = await matchmakingRepository.lockRequestById(requestId, tx);
      if (!request) throw new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
      if (request.playerId !== playerId) {
        throw new ForbiddenError('You do not own this request', 'MATCHMAKING_REQUEST_NOT_FOUND');
      }
      if (request.status === 'CANCELLED') {
        return { id: requestId, status: 'CANCELLED' };
      }
      const now = new Date();
      if (effectiveRequestStatus(request.status, request.expiresAt, now) !== 'OPEN') {
        throw new AppError('MATCHMAKING_REQUEST_NOT_CANCELLABLE', 409, 'Yêu cầu này không thể hủy ở trạng thái hiện tại');
      }
      await matchmakingRepository.closePendingInvitationsForRequest(requestId, 'CANCELLED', tx, 'POST_CANCELLED');
      await matchmakingRepository.updateRequestStatus(requestId, 'CANCELLED', tx);
      return { id: requestId, status: 'CANCELLED' };
    });
  }

  private async toSummary(request: any, now: Date) {
    const accepted = await matchmakingRepository.findAcceptedInvitees(request.id);
    const link = await matchmakingRepository.findMatchLinkByRequestId(request.id);
    const required = requiredPlayers(request.matchType);
    return {
      id: request.id,
      matchType: request.matchType,
      status: effectiveRequestStatus(request.status, request.expiresAt, now),
      preferredDate: request.preferredDate,
      preferredStartTime: request.preferredStartTime,
      preferredEndTime: request.preferredEndTime,
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
