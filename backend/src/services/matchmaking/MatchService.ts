import { db } from '../../db';
import { AppError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { dateTimeToInstant } from './matchmaking-time.util';
import { matchModule } from '../match/match.module';

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
    const required = requiredPlayers(row.matchType);

    return {
      id: row.id,
      matchType: row.matchType,
      status: row.status,
      scheduledAt: row.scheduledAt,
      scheduledEndAt: row.bookingDate && row.bookingEndTime ? dateTimeToInstant(row.bookingDate, row.bookingEndTime) : null,
      cancellationReason: row.status === 'CANCELLED' ? row.cancellationReason ?? (row.bookingStatus === 'CANCELLED' || row.bookingStatus === 'EXPIRED' ? 'BOOKING_CANCELLED' : 'COURT_NOT_BOOKED') : null,
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

  async leaveMatch(playerId: number, matchId: number) {
    return db.transaction(async (tx) => {
      const match = await matchModule.lockMatch(matchId, tx);
      if (!match) throw new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');

      const link = await matchmakingRepository.findMatchLinkByMatchId(matchId, tx);
      if (!link) throw new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');

      const participant = await matchModule.findActiveMatchPlayer(matchId, playerId, tx);
      if (!participant) throw new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');

      if (match.status === 'CANCELLED') {
        return { id: matchId, status: 'CANCELLED', cancellationReason: match.cancellationReason };
      }

      const now = new Date();
      if (match.status === 'PENDING_COURT') {
        if (match.bookingDeadlineAt && match.bookingDeadlineAt.getTime() <= now.getTime()) {
          await matchModule.transitionStatus({ matchId, from: 'PENDING_COURT', to: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' }, tx);
          return { id: matchId, status: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' };
        }
      } else if (match.status === 'CONFIRMED') {
        if (match.scheduledAt.getTime() <= now.getTime()) {
          throw new AppError('MATCH_ALREADY_STARTED', 409, 'Trận đấu đã bắt đầu, không thể rời');
        }
      } else {
        throw new AppError('MATCH_ALREADY_STARTED', 409, 'Trận đấu đã bắt đầu, không thể rời');
      }

      await matchModule.markPlayerLeft({ matchId, playerId }, tx);
      await matchModule.transitionStatus(
        { matchId, from: match.status as any, to: 'CANCELLED', cancellationReason: 'INSUFFICIENT_PLAYERS' },
        tx
      );

      if (match.bookingId) {
        await matchmakingRepository.insertCancellationJob(matchId, match.bookingId, tx);
      }

      return { id: matchId, status: 'CANCELLED', cancellationReason: 'INSUFFICIENT_PLAYERS' };
    });
  }
}

export const matchService = new MatchService();
