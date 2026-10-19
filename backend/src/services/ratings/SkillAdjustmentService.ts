import { skillAdjustmentRepository, SkillAdjustmentRepository } from '../../repositories/ratings/SkillAdjustmentRepository';
import type { SkillAdjustmentConfig } from '../../shared/config/ratings-config';

type Executor = any;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Maps a recent received-skill average to a target skill rank using the
 * continuous bands in `docs/business-rules-config-matrix.md` §6. The average
 * must be unrounded; only presentation is rounded.
 */
export function targetRankFromAverage(average: number): number {
  if (average >= 5) return 6;
  if (average >= 4.5) return 5;
  if (average >= 3.5) return 4;
  if (average >= 2.5) return 3;
  if (average >= 1.5) return 2;
  return 1;
}

export class SkillAdjustmentService {
  constructor(private readonly repo: SkillAdjustmentRepository = skillAdjustmentRepository) {}

  /**
   * Evaluates and, when eligible, applies exactly one rank step toward the
   * target for a target whose rating was newly created in this request.
   *
   * Must be called inside the caller-owned rating transaction after the target
   * Player profile lock is held (Ratings Tech Design §7.7). It never evaluates
   * on a duplicate replay because the caller only invokes it for newly inserted
   * targets.
   */
  async evaluateTarget(
    ratedPlayerId: number,
    executor: Executor,
    config: SkillAdjustmentConfig,
    now: Date = new Date()
  ): Promise<{ adjusted: boolean }> {
    if (!config.enabled) return { adjusted: false };

    const profile = await this.repo.findPlayerProfileForUpdate(ratedPlayerId, executor);
    if (!profile) return { adjusted: false };

    const recent = await this.repo.findRecentSkillRatings(ratedPlayerId, config.minRatings, executor);
    if (recent.length < config.minRatings) return { adjusted: false };

    const average = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    const targetRank = targetRankFromAverage(average);

    const currentLevel = await this.repo.findSkillLevelById(profile.skillLevelId, executor);
    if (!currentLevel) return { adjusted: false };

    const gap = targetRank - currentLevel.rank;
    if (Math.abs(gap) < config.threshold) return { adjusted: false };

    const lastAdjustment = await this.repo.findLastAdjustment(ratedPlayerId, executor);
    if (lastAdjustment) {
      const elapsed = now.getTime() - new Date(lastAdjustment.createdAt).getTime();
      if (elapsed < config.cooldownDays * DAY_MS) return { adjusted: false };
    }

    const newRank = currentLevel.rank + Math.sign(gap);
    const newLevel = await this.repo.findSkillLevelByRank(newRank, executor);
    if (!newLevel) return { adjusted: false };

    await this.repo.updatePlayerSkillLevel(ratedPlayerId, newLevel.id, executor);
    await this.repo.insertAdjustment(
      {
        playerId: ratedPlayerId,
        previousSkillLevelId: currentLevel.id,
        newSkillLevelId: newLevel.id,
        averageSkillRating: String(average),
        ratingsConsidered: recent.length,
        createdAt: now,
      },
      executor
    );

    return { adjusted: true };
  }
}

export const skillAdjustmentService = new SkillAdjustmentService();
