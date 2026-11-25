import { db } from '../../db';
import { AppError } from '../../errors/AppError';
import { ratingRepository, RatingRepository } from '../../repositories/ratings/RatingRepository';
import { skillAdjustmentRepository, SkillAdjustmentRepository } from '../../repositories/ratings/SkillAdjustmentRepository';
import { skillAdjustmentService, SkillAdjustmentService } from './SkillAdjustmentService';
import { ratingNotifications } from './rating-notifications';
import { ratingsConfig, RatingsConfig } from '../../shared/config/ratings-config';

type Executor = any;

export interface CreateRatingItem {
  ratedPlayerId: number;
  skillRating: number;
  attitudeRating: number;
  comment?: string | null;
}

export interface SummaryViewer {
  id: number;
  role: 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
}

export interface SummaryResult {
  userId: number;
  totalRatings: number;
  notEnoughData: boolean;
  averageSkillRating: number | null;
  averageAttitudeRating: number | null;
  skillDistribution: Record<string, number> | null;
  attitudeDistribution: Record<string, number> | null;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function distribution(counts: number[]): Record<string, number> {
  return { '1': counts[0], '2': counts[1], '3': counts[2], '4': counts[3], '5': counts[4] };
}

export class RatingService {
  constructor(
    private readonly repo: RatingRepository = ratingRepository,
    private readonly adjustmentRepo: SkillAdjustmentRepository = skillAdjustmentRepository,
    private readonly adjustmentService: SkillAdjustmentService = skillAdjustmentService
  ) {}

  /**
   * Tournament matches are never ratable (Tournament PRD Decision #14, 2026-11-25): skill levels
   * change only through tournament results, and Post-match Rating is out of MVP for tournaments.
   * `TOURNAMENT_RATING_ENABLED` is deprecated and no longer consulted.
   */
  private async assertTournamentEligible(matchId: number, _config: RatingsConfig, executor: Executor): Promise<void> {
    const tournamentMatch = await this.repo.findTournamentMatchByMatchId(matchId, executor);
    if (tournamentMatch) throw new AppError('RATING_DISABLED', 409, 'Trận giải đấu không được đánh giá');
  }

  /** Shared eligibility guards for rating submission and the pending view. */
  private async loadRatableMatch(matchId: number, executor: Executor) {
    const match = await this.repo.findMatchById(matchId, executor);
    if (!match) {
      throw new AppError('MATCH_NOT_FOUND', 404, 'Không tìm thấy trận đấu');
    }
    if (match.status !== 'COMPLETED') {
      throw new AppError('MATCH_NOT_COMPLETED', 409, 'Trận đấu chưa kết thúc');
    }
    return match;
  }

  async createRatings(raterId: number, matchId: number, items: CreateRatingItem[]) {
    const config = await ratingsConfig.get();

    return db.transaction(async (tx) => {
      const match = await this.loadRatableMatch(matchId, tx);
      await this.assertTournamentEligible(matchId, config, tx);

      const participants = await this.repo.findParticipants(matchId, tx);
      const participantIds = new Set(participants.map((p) => p.playerId));
      if (!participantIds.has(raterId)) {
        throw new AppError('RATING_NOT_PARTICIPANT', 403, 'Bạn không phải thành viên của trận đấu');
      }
      for (const item of items) {
        if (item.ratedPlayerId === raterId) {
          throw new AppError('RATING_SELF_FORBIDDEN', 409, 'Không thể tự đánh giá bản thân');
        }
        if (!participantIds.has(item.ratedPlayerId)) {
          throw new AppError('RATING_TARGET_NOT_PARTICIPANT', 409, 'Người được đánh giá không thuộc trận đấu');
        }
      }

      // Global lock order: users (rank 10) before player_profiles (rank 20) before the
      // rating insert. Targets are notification recipients, so they follow the same order.
      const targetIds = items.map((item) => item.ratedPlayerId);
      await this.repo.lockUsersAscending([raterId, ...targetIds], tx);
      await this.repo.lockPlayerProfilesAscending(targetIds, tx);

      const created = await this.repo.insertRatings(
        items.map((item) => ({
          raterId,
          ratedPlayerId: item.ratedPlayerId,
          matchId,
          skillRating: item.skillRating,
          attitudeRating: item.attitudeRating,
          comment: item.comment ?? null,
        })),
        tx
      );

      // Only newly created rows notify; duplicate replays insert nothing.
      await ratingNotifications.received(tx, created);

      // Only newly created targets trigger evaluation, once per target per request.
      const createdTargets = [...new Set(created.map((row) => row.ratedPlayerId))].sort((a, b) => a - b);
      for (const targetId of createdTargets) {
        await this.adjustmentService.evaluateTarget(targetId, tx, config.skillAdjustment);
      }

      const createdTargetSet = new Set(created.map((row) => row.ratedPlayerId));
      const alreadyRated = items
        .filter((item) => !createdTargetSet.has(item.ratedPlayerId))
        .map((item) => ({ ratedPlayerId: item.ratedPlayerId }));

      return {
        matchId: match.id,
        created: created.map((row) => ({
          id: row.id,
          ratedPlayerId: row.ratedPlayerId,
          skillRating: row.skillRating,
          attitudeRating: row.attitudeRating,
          comment: row.comment,
          createdAt: row.createdAt,
        })),
        alreadyRated,
      };
    });
  }

  async getPendingPlayers(raterId: number, matchId: number) {
    const config = await ratingsConfig.get();
    const match = await this.loadRatableMatch(matchId, db);
    await this.assertTournamentEligible(matchId, config, db);

    const participants = await this.repo.findParticipants(matchId, db);
    const participantIds = new Set(participants.map((p) => p.playerId));
    if (!participantIds.has(raterId)) {
      throw new AppError('RATING_NOT_PARTICIPANT', 403, 'Bạn không phải thành viên của trận đấu');
    }

    const ratedRows = await this.repo.findRaterRatingsWithNames(raterId, matchId, db);
    const ratedPlayerIds = new Set(ratedRows.map((row: any) => Number(row.ratedPlayerId)));

    const pendingPlayers = participants
      .filter((p) => p.playerId !== raterId && !ratedPlayerIds.has(p.playerId))
      .map((p) => ({ playerId: p.playerId, fullName: p.fullName }));

    const ratedPlayers = ratedRows.map((row: any) => ({
      playerId: Number(row.ratedPlayerId),
      fullName: row.fullName ?? null,
      rating: {
        id: Number(row.id),
        skillRating: Number(row.skillRating),
        attitudeRating: Number(row.attitudeRating),
        comment: row.comment ?? null,
        createdAt: row.createdAt,
      },
    }));

    return {
      matchId: match.id,
      matchType: match.matchType,
      ratedPlayers,
      pendingPlayers,
    };
  }

  async getSummary(viewer: SummaryViewer, userId: number): Promise<SummaryResult> {
    const target = await this.repo.findUserById(userId, db);
    if (!target || target.role !== 'PLAYER') {
      throw new AppError('USER_NOT_FOUND', 404, 'Không tìm thấy người dùng');
    }

    const isSelf = viewer.id === userId;
    const isAdmin = viewer.role === 'ADMIN';
    if (!isSelf && !isAdmin) {
      if (target.role !== 'PLAYER' || target.status !== 'ACTIVE' || target.deletedAt !== null) {
        throw new AppError('USER_NOT_FOUND', 404, 'Không tìm thấy người dùng');
      }
    }

    const aggregates = await this.repo.getAggregates(userId, db);
    const notEnoughData = aggregates.totalRatings < 3;
    const viewerSeesFull = isSelf || isAdmin;
    const suppress = !viewerSeesFull && notEnoughData;
    const hasRatings = aggregates.totalRatings > 0;

    return {
      userId,
      totalRatings: aggregates.totalRatings,
      notEnoughData,
      averageSkillRating:
        suppress || !hasRatings ? null : round2(aggregates.sumSkill / aggregates.totalRatings),
      averageAttitudeRating:
        suppress || !hasRatings ? null : round2(aggregates.sumAttitude / aggregates.totalRatings),
      skillDistribution: suppress ? null : distribution(aggregates.skillCounts),
      attitudeDistribution: suppress ? null : distribution(aggregates.attitudeCounts),
    };
  }

  async listRatings(
    viewer: SummaryViewer,
    userId: number,
    direction: 'given' | 'received',
    page: number,
    limit: number
  ) {
    const target = await this.repo.findUserById(userId, db);
    if (!target || target.role !== 'PLAYER') {
      throw new AppError('USER_NOT_FOUND', 404, 'Không tìm thấy người dùng');
    }

    if (viewer.role !== 'ADMIN') {
      if (viewer.id !== userId || direction !== 'given') {
        throw new AppError('RATING_SUMMARY_FORBIDDEN', 403, 'Bạn không có quyền xem đánh giá này');
      }
    }

    const { items, total } = await this.repo.listRatings({ userId, direction, page, limit }, db);
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }

  async listSkillAdjustments(userId: number, page: number, limit: number) {
    const target = await this.repo.findUserById(userId, db);
    if (!target || target.role !== 'PLAYER') {
      throw new AppError('USER_NOT_FOUND', 404, 'Không tìm thấy người dùng');
    }

    const { items, total } = await this.adjustmentRepo.listAdjustments(userId, page, limit, db);
    return {
      items: items.map((item: any) => ({
        ...item,
        averageSkillRating: round2(item.averageSkillRating),
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
      },
    };
  }
}

export const ratingService = new RatingService();
