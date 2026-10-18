import { db } from '../../db';
import { systemConfigs } from '../../db/schema/config';
import { logger } from '../logging/logger';

export const MATCHMAKING_CONFIG_DEFAULTS = {
  MATCHMAKING_ENABLED: true,
  MATCHMAKING_REQUEST_EXPIRATION_MINUTES: 30,
  MATCHMAKING_INVITATION_TIMEOUT_MINUTES: 15,
  MATCHMAKING_MIN_LEAD_TIME_MINUTES: 60,
  MATCHMAKING_MATCH_DURATION_MINUTES: 90,
} as const;

export interface MatchmakingConfig {
  enabled: boolean;
  requestExpirationMinutes: number;
  invitationTimeoutMinutes: number;
  minLeadTimeMinutes: number;
  matchDurationMinutes: number;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { value: MatchmakingConfig; expiresAt: number } | null = null;

function readNumber(
  values: Map<string, string>,
  key: keyof typeof MATCHMAKING_CONFIG_DEFAULTS,
  min: number
): number {
  const fallback = MATCHMAKING_CONFIG_DEFAULTS[key];
  const raw = values.get(key)?.trim();
  const parsed = Number(raw);
  if (raw === undefined || raw === '' || !Number.isInteger(parsed) || parsed < min) {
    if (raw !== undefined) {
      logger.warn(`Invalid matchmaking config "${key}"="${raw}", using default ${fallback}`, {
        configKey: key,
      });
    }
    return Number(fallback);
  }
  return parsed;
}

function readBoolean(values: Map<string, string>, key: keyof typeof MATCHMAKING_CONFIG_DEFAULTS): boolean {
  const fallback = MATCHMAKING_CONFIG_DEFAULTS[key];
  const raw = values.get(key)?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== undefined) {
    logger.warn(`Invalid boolean matchmaking config "${key}"="${raw}", using default ${fallback}`, {
      configKey: key,
    });
  }
  return fallback as boolean;
}

async function loadMatchmakingConfig(): Promise<MatchmakingConfig> {
  const rows = await db.select().from(systemConfigs);
  const values = new Map(rows.map((row) => [row.configKey, row.configValue]));

  return {
    enabled: readBoolean(values, 'MATCHMAKING_ENABLED'),
    requestExpirationMinutes: readNumber(values, 'MATCHMAKING_REQUEST_EXPIRATION_MINUTES', 1),
    invitationTimeoutMinutes: readNumber(values, 'MATCHMAKING_INVITATION_TIMEOUT_MINUTES', 1),
    minLeadTimeMinutes: readNumber(values, 'MATCHMAKING_MIN_LEAD_TIME_MINUTES', 0),
    matchDurationMinutes: readNumber(values, 'MATCHMAKING_MATCH_DURATION_MINUTES', 1),
  };
}

export const matchmakingConfig = {
  clearCache(): void {
    cache = null;
  },

  async get(): Promise<MatchmakingConfig> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return cache.value;
    }
    const value = await loadMatchmakingConfig();
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  },
};
