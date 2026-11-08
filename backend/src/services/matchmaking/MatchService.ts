import { NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { addMinutes, dateTimeToInstant } from './matchmaking-time.util';
import { recruitmentLifecycleService } from './RecruitmentLifecycleService';

const REQUIRED_PLAYERS: Record<string, number> = { SINGLES: 2, DOUBLES: 4 };

export interface MatchListFilter {
  status?: string;
  timeScope: 'UPCOMING' | 'PAST' | 'ALL';
  page: number;
  limit: number;
}

function requiredPlayers(matchType: string): number {
  return REQUIRED_PLAYERS[matchType] ?? 2;
}

/** Reason of a Match that reads CANCELLED before the scheduler persisted it (lazy evaluation). */
function lazyCancellationReason(row: { bookingStatus?: string | null }, recruitment: any, _accepted: number): string {
  if (row.bookingStatus === 'CANCELLED' || row.bookingStatus === 'EXPIRED') return 'BOOKING_CANCELLED';
  // Reopened rosters require a fresh host confirmation before start.
  if (recruitment?.matchType === 'GROUP' && ['OPEN', 'EXPIRED'].includes(recruitment.status)) return 'INSUFFICIENT_PLAYERS';
  return 'COURT_NOT_BOOKED';
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

export class MatchService {
  async listMatches(playerId: number, filter: MatchListFilter) {
    const { items, total } = await matchmakingRepository.findMatchesForPlayer(playerId, filter);
    return {
      items: items.map((row: any) => ({
        id: row.id,
        matchType: row.matchType,
        status: row.status,
        scheduledAt: row.scheduledAt,
        bookingDeadlineAt: row.bookingDeadlineAt,
        court: row.courtId
          ? { id: row.courtId, name: row.courtName }
          : null,
        facility: row.facilityId
          ? {
              id: row.facilityId,
              name: row.facilityName,
              address: row.facilityAddress,
              ward: row.facilityWard,
              district: row.facilityDistrict,
              city: row.facilityCity,
            }
          : null,
      })),
      meta: {
        page: filter.page,
        limit: filter.limit,
        total,
        totalPages: filter.limit > 0 ? Math.ceil(total / filter.limit) : 0,
      },
    };
  }

  async getMatchDetail(playerId: number, matchId: number) {
    const row = await matchmakingRepository.findMatchDetailById(matchId);
    if (!row) throw new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');

    const link = await matchmakingRepository.findMatchLinkByMatchId(matchId);
    const ownerId = link ? await matchmakingRepository.findRequestOwnerId(link.requestId) : null;
    const players = await matchmakingRepository.findMatchPlayers(matchId);
    const isParticipant = players.some((player: any) => player.playerId === playerId);
    if (!isParticipant) {
      throw new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');
    }

    const isOwner = ownerId === playerId;
    const activeCount = players.filter((player: any) => player.status === 'ACTIVE').length;
    // §24.3: for posts the court and fixed time come from the recruitment (MM-28).
    const recruitment = link ? await matchmakingRepository.findRequestById(link.requestId) : null;
    const required = row.matchType === 'GROUP' && recruitment ? recruitment.minPlayers : requiredPlayers(row.matchType);
    const recruitmentEnd = recruitment && !row.bookingId ? addMinutes(recruitment.startAt, recruitment.durationMinutes) : null;

    return {
      id: row.id,
      matchType: row.matchType,
      status: row.status,
      scheduledAt: row.scheduledAt,
      scheduledEndAt: row.bookingDate && row.bookingEndTime ? dateTimeToInstant(row.bookingDate, row.bookingEndTime) : recruitmentEnd,
      externalCourt: recruitment?.externalCourtName
        ? {
            name: recruitment.externalCourtName,
            city: recruitment.externalCourtCity,
            district: recruitment.externalCourtDistrict,
            address: recruitment.externalCourtAddress,
            verified: false,
          }
        : null,
      cancellationReason: row.status === 'CANCELLED' ? row.cancellationReason ?? lazyCancellationReason(row, recruitment, Math.max(0, activeCount - 1)) : null,
      price: row.bookingTotalAmount != null ? Number(row.bookingTotalAmount) : null,
      bookingDeadlineAt: row.bookingDeadlineAt,
      court: row.courtId ? { id: row.courtId, name: row.courtName } : null,
      facility: row.facilityId
        ? {
            id: row.facilityId,
            name: row.facilityName,
            address: row.facilityAddress,
            ward: row.facilityWard,
            district: row.facilityDistrict,
            city: row.facilityCity,
          }
        : null,
      booking:
        row.bookingId && isOwner
          ? {
              id: row.bookingId,
              bookingDate: row.bookingDate,
              startTime: row.bookingStartTime,
              endTime: row.bookingEndTime,
              totalAmount: row.bookingTotalAmount != null ? Number(row.bookingTotalAmount) : null,
              status: row.bookingStatus,
            }
          : null,
      payer: row.bookingId && row.bookingPlayerId != null ? { playerId: row.bookingPlayerId } : null,
      players: players.map((player: any) => ({
        playerId: player.playerId,
        displayName: player.displayName,
        skill: toSkill(player),
        teamNo: player.teamNo,
        status: player.status,
      })),
      requiredPlayers: required,
      currentPlayers: activeCount,
      isOwner,
    };
  }

  /**
   * POST /matches/:id/leave — compatibility alias of recruitment withdrawal (§24.9, MM-25),
   * locking users(10) → requests(30) first. Host leaving = host cancellation (HOST_LEFT).
   */
  async leaveMatch(playerId: number, matchId: number) {
    return recruitmentLifecycleService.leaveMatch(playerId, matchId);
  }
}

export const matchService = new MatchService();
