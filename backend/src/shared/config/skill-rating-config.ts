import { loadConfigValues, clearConfigCache } from './config-registry';

// Typed facade for the skill-rating and ranking keys (Tournament Tech Design §7.10, §7.11).
const keys = [
  'SKILL_RATING_ENABLED', 'SKILL_RATING_K', 'SKILL_RATING_K_TENTATIVE', 'SKILL_RATING_TENTATIVE_MATCHES',
  'SKILL_RATING_SCALE_D', 'SKILL_RATING_HYSTERESIS', 'SKILL_RATING_DOUBLES_FACTOR_PERCENT',
  'TOURNAMENT_RANKING_BEST_N', 'TOURNAMENT_RANKING_WINDOW_MONTHS',
] as const;

export interface SkillRatingConfig {
  enabled: boolean;
  k: number;
  kTentative: number;
  tentativeMatches: number;
  scaleD: number;
  hysteresis: number;
  doublesFactor: number;
  rankingBestN: number;
  rankingWindowMonths: number;
}

export const skillRatingConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<SkillRatingConfig> {
    const v = await loadConfigValues(keys);
    return {
      enabled: v.SKILL_RATING_ENABLED, k: v.SKILL_RATING_K, kTentative: v.SKILL_RATING_K_TENTATIVE,
      tentativeMatches: v.SKILL_RATING_TENTATIVE_MATCHES, scaleD: v.SKILL_RATING_SCALE_D, hysteresis: v.SKILL_RATING_HYSTERESIS,
      doublesFactor: v.SKILL_RATING_DOUBLES_FACTOR_PERCENT / 100,
      rankingBestN: v.TOURNAMENT_RANKING_BEST_N, rankingWindowMonths: v.TOURNAMENT_RANKING_WINDOW_MONTHS,
    };
  },
};
