
/**
 * Typed reader for Rating-related system configuration (Ratings Tech Design §7.5).
 *
 * Rating feature code (services, repositories) must read these values through
 * this reader and never query SYSTEM_CONFIGS directly. Missing values log WARN
 * and fall back to the matrix defaults; invalid values log ERROR and fall back
 * to the defaults. Bounds are the confirmed ranges from
 * `docs/business-rules-config-matrix.md` §8.8 and the 2026-10-15 review.
 */
import { ratingConfigDefinitions, loadRatingConfigValues, clearRatingConfigCache } from './config-registry';

export const RATINGS_CONFIG_DEFAULTS = Object.fromEntries(
  Object.entries(ratingConfigDefinitions).map(([key, definition]) => [key, definition.defaultValue])
) as { [K in keyof typeof ratingConfigDefinitions]: (typeof ratingConfigDefinitions)[K]['defaultValue'] };

export interface SkillAdjustmentConfig {
  enabled: boolean;
  minRatings: number;
  threshold: number;
  cooldownDays: number;
}

export interface RatingsConfig {
  tournamentRatingEnabled: boolean;
  skillAdjustment: SkillAdjustmentConfig;
}

export const ratingsConfig = {
  clearCache: clearRatingConfigCache,
  async get(): Promise<RatingsConfig> {
    const values = await loadRatingConfigValues();
    return {
      tournamentRatingEnabled: values.TOURNAMENT_RATING_ENABLED,
      skillAdjustment: {
        enabled: values.PLAYER_SKILL_ADJUSTMENT_ENABLED,
        minRatings: values.PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS,
        threshold: values.PLAYER_SKILL_ADJUSTMENT_THRESHOLD,
        cooldownDays: values.PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS,
      },
    };
  },
};
