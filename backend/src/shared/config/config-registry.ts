import { db } from '../../db';
import { systemConfigs } from '../../db/schema/config';
import { logger } from '../logging/logger';

// Shared configuration registry (System Config Tech Design §7.2). This is the
// single source of key definitions, defaults, bounds and enum values for every
// managed domain. Readers are thin facades over `loadConfigValues`; management
// writes (SC-06) must reuse these definitions and `validateConfigCrossKeyRules`,
// and call `clearConfigCache` after a write.

export const CONFIG_DOMAINS = [
  'booking',
  'tournament',
  'team',
  'auth',
  'refund',
  'finance',
  'report',
  'matchmaking',
  'social',
  'messaging',
  'player-skill-adjustment',
] as const;

export type ConfigDomain = (typeof CONFIG_DOMAINS)[number];

interface ConfigDefinitionBase {
  domain: ConfigDomain;
  description: string;
  /** Defaults to true. Deprecated/legacy keys are read-only. */
  editable?: boolean;
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
export interface EnumConfigDefinition extends ConfigDefinitionBase {
  type: 'enum';
  defaultValue: string;
  allowedValues: readonly string[];
}
export type ConfigDefinition = BooleanConfigDefinition | IntegerConfigDefinition | EnumConfigDefinition;

export const configDefinitions = {
  // Booking and refunds (§8.2)
  BOOKING_ENABLED: {
    domain: 'booking', type: 'boolean', defaultValue: true,
    description: 'Enable/disable court booking',
  },
  BOOKING_MIN_DURATION_MINUTES: {
    domain: 'booking', type: 'integer', defaultValue: 60, min: 1, max: 1440,
    description: 'Minimum booking duration in minutes',
  },
  BOOKING_MAX_DURATION_MINUTES: {
    domain: 'booking', type: 'integer', defaultValue: 180, min: 1, max: 1440,
    description: 'Maximum booking duration in minutes',
  },
  BOOKING_ADVANCE_WINDOW_DAYS: {
    domain: 'booking', type: 'integer', defaultValue: 7, min: 1, max: 365,
    description: 'Maximum advance booking window in days',
  },
  MAINTENANCE_ADVANCE_WINDOW_DAYS: {
    domain: 'booking', type: 'integer', defaultValue: 90, min: 1,
    description: 'Independent advance maintenance window in days',
  },
  BOOKING_ACTIVE_LIMIT_MODE: {
    domain: 'booking', type: 'enum', defaultValue: 'LIMITED', allowedValues: ['LIMITED', 'UNLIMITED'],
    description: 'Active-booking limit strategy',
  },
  BOOKING_MAX_ACTIVE_PER_PLAYER: {
    domain: 'booking', type: 'integer', defaultValue: 5, min: 1, max: 50,
    description: 'Maximum active bookings per Player',
  },
  PLAYER_CAN_CANCEL_BOOKING: {
    domain: 'booking', type: 'boolean', defaultValue: true,
    description: 'Whether Player cancellation is enabled',
  },
  PLAYER_CANCELLATION_DEADLINE_MINUTES: {
    domain: 'booking', type: 'integer', defaultValue: 0, min: 0, max: 10080,
    description: 'Player cancellation deadline relative to start',
  },
  OWNER_CAN_CANCEL_BOOKING: {
    domain: 'booking', type: 'boolean', defaultValue: true,
    description: 'Whether Owner cancellation is enabled',
  },
  OWNER_CANCELLATION_DEADLINE_MINUTES: {
    domain: 'booking', type: 'integer', defaultValue: 0, min: 0, max: 10080,
    description: 'Owner cancellation deadline relative to start',
  },
  BOOKING_PAYMENT_TIMEOUT_MINUTES: {
    domain: 'booking', type: 'integer', defaultValue: 10, min: 1, max: 10080,
    description: 'Payment hold timeout in minutes',
  },
  REFUND_ENABLED: {
    domain: 'refund', type: 'boolean', defaultValue: true,
    description: 'Enable refund flow',
  },
  REFUND_PROCESSING_TIMEOUT_MINUTES: {
    domain: 'refund', type: 'integer', defaultValue: 1440, min: 1, max: 10080,
    description: 'Refund processing timeout in minutes',
  },

  // Finance (§8.10)
  OWNER_EARNING_AUTO_CREDIT_ENABLED: {
    domain: 'finance', type: 'boolean', defaultValue: true,
    description: 'Automatically credit the court Owner wallet when a booking payment succeeds',
  },
  WALLET_AUTO_APPROVE_PAYOUTS: {
    domain: 'finance', type: 'boolean', defaultValue: true,
    description: 'Automatically approve wallet payout requests (sandbox/demo); Admin still marks paid',
  },

  // Tournament (§8.4)
  TOURNAMENT_ENABLED: {
    domain: 'tournament', type: 'boolean', defaultValue: true,
    description: 'Enable/disable tournaments',
  },
  TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT: {
    domain: 'tournament', type: 'integer', defaultValue: 16, min: 2, max: 128,
    description: 'Default competitive registration limit',
  },
  // Deprecated 2026-11-25 (Tournament Tech Design §4.5): wallet payment has no pending
  // state, tournament matches are not ratable, and the Organizer decides no-shows.
  TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES: {
    domain: 'tournament', type: 'integer', defaultValue: 10, min: 1, max: 1440,
    deprecated: true, editable: false,
    description: 'Legacy: registration payment hold timeout (registration fees are paid from the wallet at once)',
  },
  TOURNAMENT_RATING_ENABLED: {
    domain: 'tournament', type: 'boolean', defaultValue: true,
    deprecated: true, editable: false,
    description: 'Legacy: tournament-related rating (tournament matches are no longer ratable)',
  },
  TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES: {
    domain: 'tournament', type: 'integer', defaultValue: 15, min: 1, max: 1440,
    deprecated: true, editable: false,
    description: 'Legacy: no-show grace period (the Organizer records a walkover)',
  },

  // Team (§8.5)
  TEAM_INVITATION_TIMEOUT_MINUTES: {
    domain: 'team', type: 'integer', defaultValue: 1440, min: 1, max: 10080,
    description: 'Team invitation timeout in minutes',
  },

  // Report (§8.6)
  REPORT_ENABLED: {
    domain: 'report', type: 'boolean', defaultValue: true,
    description: 'Enable/disable reporting',
  },
  REPORT_HIGH_RISK_THRESHOLD: {
    domain: 'report', type: 'integer', defaultValue: 5, min: 2, max: 100,
    description: 'Distinct reporters on one target before an Admin high-risk alert',
  },
  REPORT_HIGH_RISK_WINDOW_HOURS: {
    domain: 'report', type: 'integer', defaultValue: 24, min: 1, max: 720,
    description: 'Rolling window for the high-risk report threshold',
  },

  // Authentication (§8.7)
  AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD: {
    domain: 'auth', type: 'integer', defaultValue: 5, min: 1, max: 100,
    description: 'Consecutive failed sign-in attempts before an account is temporarily locked',
  },
  AUTH_FAILED_LOGIN_LOCKOUT_MINUTES: {
    domain: 'auth', type: 'integer', defaultValue: 15, min: 1, max: 1440,
    description: 'Lockout duration; account auto-unlocks after this period',
  },
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER: {
    domain: 'auth', type: 'integer', defaultValue: 10080, min: 1, max: 525600,
    description: 'Player session idle timeout (7 days)',
  },
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER: {
    domain: 'auth', type: 'integer', defaultValue: 43200, min: 1, max: 525600,
    description: 'Player session absolute maximum duration (30 days)',
  },
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER: {
    domain: 'auth', type: 'integer', defaultValue: 10080, min: 1, max: 525600,
    description: 'Court Owner session idle timeout (7 days)',
  },
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER: {
    domain: 'auth', type: 'integer', defaultValue: 43200, min: 1, max: 525600,
    description: 'Court Owner session absolute maximum duration (30 days)',
  },
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN: {
    domain: 'auth', type: 'integer', defaultValue: 60, min: 1, max: 525600,
    description: 'Admin session idle timeout (1 hour)',
  },
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN: {
    domain: 'auth', type: 'integer', defaultValue: 480, min: 1, max: 525600,
    description: 'Admin session absolute maximum duration (8 hours)',
  },

  // Player skill adjustment (§8.8). The switch is read-only since 2026-11-22 (AUTH-33):
  // levels come from the registration skill survey, and the rating mapping
  // (targetRankFromAverage) stops at rank 6, so enabling it would demote EXCELLENT
  // Players. Stays false (migration 0023); rating records remain for display.
  PLAYER_SKILL_ADJUSTMENT_ENABLED: {
    domain: 'player-skill-adjustment', type: 'boolean', defaultValue: false,
    editable: false,
    description: 'Read-only: automatic skill adjustment from ratings stays disabled (levels come from the registration skill survey)',
  },
  PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS: {
    domain: 'player-skill-adjustment', type: 'integer', defaultValue: 5, min: 1, max: 100,
    deprecated: true, editable: false,
    description: 'Legacy: minimum recent skill ratings before an adjustment',
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
    domain: 'matchmaking', type: 'integer', defaultValue: 30, min: 1,
    deprecated: true, editable: false,
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
  (typeof configDefinitions)[K]['type'] extends 'boolean' ? boolean
    : (typeof configDefinitions)[K]['type'] extends 'integer' ? number
      : string;
export type ConfigValues<K extends ConfigKey> = { [P in K]: ConfigValue<P> };

export function getConfigDefinition(key: string): ConfigDefinition | undefined {
  return (configDefinitions as Record<string, ConfigDefinition>)[key];
}

export function configKeysForDomain(domain: ConfigDomain): ConfigKey[] {
  return (Object.keys(configDefinitions) as ConfigKey[]).filter(key => configDefinitions[key].domain === domain);
}

export function isConfigEditable(definition: ConfigDefinition): boolean {
  return definition.editable !== false;
}

/** Strict parsing (Tech Design §7.3): trimmed booleans, bounded integers, or an allowed enum value. */
export function parseConfigValue(definition: ConfigDefinition, raw: string | undefined): boolean | number | string | undefined {
  const value = raw?.trim();
  if (value === undefined) return undefined;
  if (definition.type === 'boolean') {
    return /^(true|false)$/i.test(value) ? value.toLowerCase() === 'true' : undefined;
  }
  if (definition.type === 'enum') {
    return definition.allowedValues.includes(value) ? value : undefined;
  }
  if (!/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < definition.min) return undefined;
  if (definition.max !== undefined && number > definition.max) return undefined;
  return number;
}

export interface ConfigValidationSuccess {
  ok: true;
  value: string;
}
export interface ConfigValidationFailure {
  ok: false;
  code: 'INVALID_TYPE' | 'OUT_OF_RANGE' | 'VALUE_NOT_ALLOWED';
  message: string;
}
export type ConfigValidationResult = ConfigValidationSuccess | ConfigValidationFailure;

/**
 * Normalizes and validates an API input against the registry. The returned value
 * is the canonical text stored in `SYSTEM_CONFIGS.config_value`.
 */
export function validateConfigValue(key: ConfigKey, input: unknown): ConfigValidationResult {
  const definition: ConfigDefinition = configDefinitions[key];

  if (definition.type === 'boolean') {
    const normalized = typeof input === 'boolean'
      ? String(input)
      : typeof input === 'string' && /^(true|false)$/i.test(input.trim())
        ? input.trim().toLowerCase()
        : undefined;
    if (normalized === undefined) {
      return { ok: false, code: 'INVALID_TYPE', message: `${key} must be true or false` };
    }
    return { ok: true, value: normalized };
  }

  if (definition.type === 'enum') {
    const normalized = typeof input === 'string' ? input.trim() : '';
    if (!definition.allowedValues.includes(normalized)) {
      return { ok: false, code: 'VALUE_NOT_ALLOWED', message: `${key} must be one of: ${definition.allowedValues.join(', ')}` };
    }
    return { ok: true, value: normalized };
  }

  const normalized = typeof input === 'number'
    ? (Number.isSafeInteger(input) ? String(input) : undefined)
    : typeof input === 'string' && /^\d+$/.test(input.trim())
      ? input.trim()
      : undefined;
  if (normalized === undefined) {
    return { ok: false, code: 'INVALID_TYPE', message: `${key} must be an integer` };
  }
  const parsed = parseConfigValue(definition, normalized);
  if (parsed === undefined) {
    const max = definition.max !== undefined ? ` and <= ${definition.max}` : '';
    return { ok: false, code: 'OUT_OF_RANGE', message: `${key} must be >= ${definition.min}${max}` };
  }
  return { ok: true, value: String(parsed) };
}

export function defaultConfigValueString(key: ConfigKey): string {
  return String(configDefinitions[key].defaultValue);
}

export interface CrossKeyViolation {
  rule: string;
  keys: ConfigKey[];
}

function integerValue(values: Partial<Record<ConfigKey, boolean | number | string>>, key: ConfigKey): number {
  const candidate = values[key];
  return typeof candidate === 'number' ? candidate : configDefinitions[key].defaultValue as number;
}

/** Cross-key rules for management writes (SC-06) and the SC-12 preflight. */
export function validateConfigCrossKeyRules(
  values: Partial<Record<ConfigKey, boolean | number | string>>,
): CrossKeyViolation[] {
  const violations: CrossKeyViolation[] = [];

  const groupMin = integerValue(values, 'MATCHMAKING_GROUP_MIN_SLOTS');
  const groupMax = integerValue(values, 'MATCHMAKING_GROUP_MAX_SLOTS');
  if (groupMin > groupMax) {
    violations.push({
      rule: 'MATCHMAKING_GROUP_MIN_SLOTS <= MATCHMAKING_GROUP_MAX_SLOTS',
      keys: ['MATCHMAKING_GROUP_MIN_SLOTS', 'MATCHMAKING_GROUP_MAX_SLOTS'],
    });
  }

  const minDuration = integerValue(values, 'BOOKING_MIN_DURATION_MINUTES');
  const maxDuration = integerValue(values, 'BOOKING_MAX_DURATION_MINUTES');
  if (minDuration > maxDuration) {
    violations.push({
      rule: 'BOOKING_MIN_DURATION_MINUTES <= BOOKING_MAX_DURATION_MINUTES',
      keys: ['BOOKING_MIN_DURATION_MINUTES', 'BOOKING_MAX_DURATION_MINUTES'],
    });
  }

  const authPairs = [
    ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER'],
    ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER'],
    ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN'],
  ] as const;
  for (const [idleKey, absoluteKey] of authPairs) {
    if (integerValue(values, idleKey) > integerValue(values, absoluteKey)) {
      violations.push({ rule: `${idleKey} <= ${absoluteKey}`, keys: [idleKey, absoluteKey] });
    }
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

/** Raw stored values for readers that need an env fallback (refund configuration). */
export async function loadStoredConfigValues(): Promise<Map<string, string>> {
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
  const stored = await loadStoredConfigValues();
  const values = {} as Record<string, boolean | number | string>;
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

// Backwards-compatible typed view for the Owner reader. Definitions live here only.
export const ownerConfigDefinitions = {
  OWNER_CAN_CANCEL_BOOKING: configDefinitions.OWNER_CAN_CANCEL_BOOKING,
  OWNER_CANCELLATION_DEADLINE_MINUTES: configDefinitions.OWNER_CANCELLATION_DEADLINE_MINUTES,
  MAINTENANCE_ADVANCE_WINDOW_DAYS: configDefinitions.MAINTENANCE_ADVANCE_WINDOW_DAYS,
} as const;

// Backwards-compatible typed view for the Messaging reader. Definitions live here only.
export const messagingConfigDefinitions = {
  MESSAGING_ENABLED: configDefinitions.MESSAGING_ENABLED,
  MESSAGING_GROUP_MAX_MEMBERS: configDefinitions.MESSAGING_GROUP_MAX_MEMBERS,
  MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY: configDefinitions.MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY,
  MESSAGING_MESSAGES_PER_MINUTE: configDefinitions.MESSAGING_MESSAGES_PER_MINUTE,
} as const;
