import { db } from '../../db';
import { systemConfigs } from '../../db/schema/config';
import { logger } from '../logging/logger';

// Shared configuration registry (System Config Tech Design §7.2, Social Matchmaking
// extension; SC-12). This is the single source of key definitions, defaults and
// bounds for the registered domains. Readers are thin facades over
// `loadConfigValues`; management writes (SC-06) must reuse these definitions and
// `validateConfigCrossKeyRules`, and call `clearConfigCache` after a write.

export type ConfigDomain = 'tournament' | 'player-skill-adjustment' | 'matchmaking' | 'social' | 'messaging';

interface ConfigDefinitionBase {
  domain: ConfigDomain;
  description: string;
  /** Still readable; scheduled for removal by a later task. */
  deprecated?: true;
}
export interface BooleanConfigDefinition extends ConfigDefinitionBase {
  type: 'boolean';
  defaultValue: boolean;
}
export interface IntegerConfigDefinition extends ConfigDefinitionBase {
  type: 'integer';
  defaultValue: number;
  min: number;
  /** Omitted only where no upper bound is confirmed; the existing reader had none. */
  max?: number;
}
export type ConfigDefinition = BooleanConfigDefinition | IntegerConfigDefinition;

export const configDefinitions = {
  // Ratings (approved 2026-10-15; matrix §8.4, §8.8)
  TOURNAMENT_RATING_ENABLED: {
    domain: 'tournament', type: 'boolean', defaultValue: true,
    description: 'Enable tournament-related rating',
  },
  PLAYER_SKILL_ADJUSTMENT_ENABLED: {
    domain: 'player-skill-adjustment', type: 'boolean', defaultValue: true,
    description: 'Enable automatic skill adjustment from ratings',
  },
  PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS: {
    domain: 'player-skill-adjustment', type: 'integer', defaultValue: 5, min: 1, max: 100,
    description: 'Minimum recent skill ratings before an adjustment',
  },
  PLAYER_SKILL_ADJUSTMENT_THRESHOLD: {
    domain: 'player-skill-adjustment', type: 'integer', defaultValue: 1, min: 1, max: 6,
    description: 'Minimum gap in skill levels that triggers an adjustment',
  },
  PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS: {
    domain: 'player-skill-adjustment', type: 'integer', defaultValue: 14, min: 0, max: 365,
    description: 'Minimum days between automatic adjustments',
  },
  // Ratings Tech Design §25.5. Registered by SC-12; the Ratings reader switches in RT-10.
  PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES: {
    domain: 'player-skill-adjustment', type: 'integer', defaultValue: 5, min: 1, max: 100,
    description: 'Recent Match entries considered before an automatic skill adjustment',
  },

  // Matchmaking baseline keys (matrix §8.3). Bounds mirror the pre-SC-12 reader because
  // the catalog bounds in Tech Design §7.3 are still pending confirmation.
  MATCHMAKING_ENABLED: {
    domain: 'matchmaking', type: 'boolean', defaultValue: true,
    description: 'Enable/disable matchmaking',
  },
  MATCHMAKING_REQUEST_EXPIRATION_MINUTES: {
    domain: 'matchmaking', type: 'integer', defaultValue: 30, min: 1, deprecated: true,
    description: 'Deprecated: no longer read after the Social Matchmaking cutover; removed by a later task',
  },
  MATCHMAKING_MIN_LEAD_TIME_MINUTES: {
    domain: 'matchmaking', type: 'integer', defaultValue: 60, min: 0,
    description: 'Minimum lead time before a match-finding start',
  },
  MATCHMAKING_MATCH_DURATION_MINUTES: {
    domain: 'matchmaking', type: 'integer', defaultValue: 90, min: 1,
    description: 'Default Match duration snapshot',
  },
  // Matrix §8.9 (approved 2026-10-31)
  MATCHMAKING_APPLICATION_TIMEOUT_MINUTES: {
    domain: 'matchmaking', type: 'integer', defaultValue: 1440, min: 15, max: 10080,
    description: 'Pending Apply timeout (capped per §3.12)',
  },
  MATCHMAKING_INVITATION_TIMEOUT_MINUTES: {
    domain: 'matchmaking', type: 'integer', defaultValue: 1440, min: 15, max: 10080,
    description: 'Pending Invite timeout',
  },
  MATCHMAKING_GROUP_MIN_SLOTS: {
    domain: 'matchmaking', type: 'integer', defaultValue: 3, min: 3, max: 20,
    description: 'Minimum capacity of a casual group post',
  },
  MATCHMAKING_GROUP_MAX_SLOTS: {
    domain: 'matchmaking', type: 'integer', defaultValue: 12, min: 3, max: 20,
    description: 'Maximum capacity of a casual group post; MIN <= MAX',
  },
  MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER: {
    domain: 'matchmaking', type: 'integer', defaultValue: 3, min: 1, max: 20,
    description: 'Open match-finding posts per Player',
  },
  SOCIAL_FEED_ENABLED: {
    domain: 'social', type: 'boolean', defaultValue: true,
    description: 'Enable/disable feed posts, reactions, comments',
  },
  SOCIAL_FREE_POSTS_PER_DAY: {
    domain: 'social', type: 'integer', defaultValue: 10, min: 1, max: 100,
    description: 'Free posts per Player per day',
  },
  SOCIAL_COMMENTS_PER_MINUTE: {
    domain: 'social', type: 'integer', defaultValue: 10, min: 1, max: 60,
    description: 'Comments per Player per minute',
  },
  MESSAGING_ENABLED: {
    domain: 'messaging', type: 'boolean', defaultValue: true,
    description: 'Enable/disable messaging',
  },
  MESSAGING_GROUP_MAX_MEMBERS: {
    domain: 'messaging', type: 'integer', defaultValue: 50, min: 3, max: 100,
    description: 'Maximum members in a group conversation',
  },
  MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY: {
    domain: 'messaging', type: 'integer', defaultValue: 20, min: 1, max: 500,
    description: 'New one-to-one conversations per sender per day',
  },
  MESSAGING_MESSAGES_PER_MINUTE: {
    domain: 'messaging', type: 'integer', defaultValue: 30, min: 1, max: 300,
    description: 'Messages per sender per minute',
  },
} as const satisfies Record<string, ConfigDefinition>;

export type ConfigKey = keyof typeof configDefinitions;
export type ConfigValue<K extends ConfigKey> =
  (typeof configDefinitions)[K]['type'] extends 'boolean' ? boolean : number;
export type ConfigValues<K extends ConfigKey> = { [P in K]: ConfigValue<P> };

export function configKeysForDomain(domain: ConfigDomain): ConfigKey[] {
  return (Object.keys(configDefinitions) as ConfigKey[]).filter(key => configDefinitions[key].domain === domain);
}

/** Strict parsing (Tech Design §7.3): trimmed `true`/`false`, or a bounded decimal integer. */
export function parseConfigValue(definition: ConfigDefinition, raw: string | undefined): boolean | number | undefined {
  const value = raw?.trim();
  if (value === undefined) return undefined;
  if (definition.type === 'boolean') {
    return /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : undefined;
  }
  if (!/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < definition.min) return undefined;
  if (definition.max !== undefined && number > definition.max) return undefined;
  return number;
}

export interface CrossKeyViolation {
  rule: string;
  keys: ConfigKey[];
}

/** Cross-key rules for management writes (SC-06) and the SC-12 preflight. */
export function validateConfigCrossKeyRules(
  values: Partial<{ [K in ConfigKey]: ConfigValue<K> }>,
): CrossKeyViolation[] {
  const violations: CrossKeyViolation[] = [];
  const groupMin = values.MATCHMAKING_GROUP_MIN_SLOTS ?? configDefinitions.MATCHMAKING_GROUP_MIN_SLOTS.defaultValue;
  const groupMax = values.MATCHMAKING_GROUP_MAX_SLOTS ?? configDefinitions.MATCHMAKING_GROUP_MAX_SLOTS.defaultValue;
  if (groupMin > groupMax) {
    violations.push({
      rule: 'MATCHMAKING_GROUP_MIN_SLOTS <= MATCHMAKING_GROUP_MAX_SLOTS',
      keys: ['MATCHMAKING_GROUP_MIN_SLOTS', 'MATCHMAKING_GROUP_MAX_SLOTS'],
    });
  }
  return violations;
}

const CACHE_TTL_MS = 60_000;
let cache: { stored: Map<string, string>; expiresAt: number } | null = null;
let generation = 0;

/** Clears the shared cache used by every registry-backed reader. */
export function clearConfigCache(): void {
  generation += 1;
  cache = null;
}

async function loadStoredValues(): Promise<Map<string, string>> {
  if (cache && cache.expiresAt > Date.now()) return cache.stored;
  const startedAt = Date.now();
  const currentGeneration = generation;
  const rows = await db.select().from(systemConfigs);
  const stored = new Map(rows.map(row => [row.configKey, row.configValue]));
  // An invalidation during the DB read must not repopulate the cache with stale data.
  if (generation === currentGeneration) cache = { stored, expiresAt: startedAt + CACHE_TTL_MS };
  return stored;
}

/**
 * Typed, validated read of registered keys with the shared 60-second cache.
 * Missing → default + WARN; invalid → default + ERROR (Tech Design §7.3).
 */
export async function loadConfigValues<K extends ConfigKey>(keys: readonly K[]): Promise<ConfigValues<K>> {
  const stored = await loadStoredValues();
  const values = {} as Record<string, boolean | number>;
  for (const key of keys) {
    const definition: ConfigDefinition = configDefinitions[key];
    const parsed = parseConfigValue(definition, stored.get(key));
    if (parsed === undefined) {
      const context = { configKey: key, defaultValue: definition.defaultValue };
      if (!stored.has(key)) logger.warn('Missing system config; using default', context);
      else logger.error('Invalid system config; using default', { ...context, storedValue: stored.get(key) });
    }
    values[key] = parsed ?? definition.defaultValue;
  }
  return values as ConfigValues<K>;
}

// Ratings facade API (unchanged contract; RT-01/RT-06).
const ratingConfigKeys = [
  'TOURNAMENT_RATING_ENABLED',
  'PLAYER_SKILL_ADJUSTMENT_ENABLED',
  'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS',
  'PLAYER_SKILL_ADJUSTMENT_THRESHOLD',
  'PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS',
] as const;
type RatingConfigKey = (typeof ratingConfigKeys)[number];
export const ratingConfigDefinitions = Object.fromEntries(
  ratingConfigKeys.map(key => [key, configDefinitions[key]]),
) as { [K in RatingConfigKey]: (typeof configDefinitions)[K] };

export const clearRatingConfigCache = clearConfigCache;
export function loadRatingConfigValues(): Promise<ConfigValues<RatingConfigKey>> {
  return loadConfigValues(ratingConfigKeys);
}

export const ownerConfigDefinitions = {
  OWNER_CAN_CANCEL_BOOKING: { type: 'boolean', defaultValue: true },
  OWNER_CANCELLATION_DEADLINE_MINUTES: { type: 'integer', defaultValue: 0, min: 0 },
  MAINTENANCE_ADVANCE_WINDOW_DAYS: { type: 'integer', defaultValue: 90, min: 1 },
} as const;

export const messagingConfigDefinitions = {
  MESSAGING_ENABLED: { type: 'boolean', defaultValue: true },
  MESSAGING_GROUP_MAX_MEMBERS: { type: 'integer', defaultValue: 50, min: 3, max: 100 },
  MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY: { type: 'integer', defaultValue: 20, min: 1, max: 500 },
  MESSAGING_MESSAGES_PER_MINUTE: { type: 'integer', defaultValue: 30, min: 1, max: 300 },
} as const;
