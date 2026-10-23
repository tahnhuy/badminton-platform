import { db } from '../../db';
import { systemConfigs } from '../../db/schema/config';
import { logger } from '../logging/logger';

// Minimal shared registry for the five approved Ratings keys. Future shared
// config management must consume these definitions instead of copying defaults.
export const ratingConfigDefinitions = {
  TOURNAMENT_RATING_ENABLED: { type: 'boolean', defaultValue: true },
  PLAYER_SKILL_ADJUSTMENT_ENABLED: { type: 'boolean', defaultValue: true },
  PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS: { type: 'integer', defaultValue: 5, min: 1, max: 100 },
  PLAYER_SKILL_ADJUSTMENT_THRESHOLD: { type: 'integer', defaultValue: 1, min: 1, max: 6 },
  PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS: { type: 'integer', defaultValue: 14, min: 0, max: 365 },
} as const;

type Values = { [K in keyof typeof ratingConfigDefinitions]:
  (typeof ratingConfigDefinitions)[K]['type'] extends 'boolean' ? boolean : number };
let cache: { values: Values; expiresAt: number } | null = null;
let generation = 0;

export function clearRatingConfigCache(): void {
  generation += 1;
  cache = null;
}

export async function loadRatingConfigValues(): Promise<Values> {
  if (cache && cache.expiresAt > Date.now()) return { ...cache.values };
  const startedAt = Date.now();
  const currentGeneration = generation;
  const rows = await db.select().from(systemConfigs);
  const stored = new Map(rows.map(row => [row.configKey, row.configValue]));
  const values = {} as Record<string, boolean | number>;
  for (const [key, definition] of Object.entries(ratingConfigDefinitions)) {
    const raw = stored.get(key)?.trim();
    let parsed: boolean | number | undefined;
    if (raw !== undefined && definition.type === 'boolean') {
      if (/^(true|false)$/i.test(raw)) parsed = raw.toLowerCase() === 'true';
    } else if (raw !== undefined && definition.type === 'integer' && /^\d+$/.test(raw)) {
      const number = Number(raw);
      if (Number.isSafeInteger(number) && number >= definition.min && number <= definition.max) parsed = number;
    }
    if (parsed === undefined) {
      const context = { configKey: key, defaultValue: definition.defaultValue };
      if (!stored.has(key)) logger.warn('Missing system config; using default', context);
      else logger.error('Invalid system config; using default', { ...context, storedValue: stored.get(key) });
    }
    values[key] = parsed ?? definition.defaultValue;
  }
  const result = values as Values;
  // An invalidation during the DB read must not repopulate the cache with stale data.
  if (generation === currentGeneration) cache = { values: result, expiresAt: startedAt + 60_000 };
  return { ...result };
}

export const ownerConfigDefinitions = {
  OWNER_CAN_CANCEL_BOOKING: { type: 'boolean', defaultValue: true },
  OWNER_CANCELLATION_DEADLINE_MINUTES: { type: 'integer', defaultValue: 0, min: 0 },
  MAINTENANCE_ADVANCE_WINDOW_DAYS: { type: 'integer', defaultValue: 90, min: 1 },
} as const;
