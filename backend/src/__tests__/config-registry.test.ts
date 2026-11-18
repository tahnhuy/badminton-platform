import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, systemConfigs } from '../db';
import {
  configDefinitions, configKeysForDomain, parseConfigValue, validateConfigCrossKeyRules,
  validateConfigValue, isConfigEditable, loadConfigValues, clearConfigCache, ConfigKey,
} from '../shared/config/config-registry';
import { matchmakingConfig } from '../shared/config/matchmaking-config';
import { socialConfig } from '../shared/config/social-config';
import { ratingsConfig } from '../shared/config/ratings-config';
import { logger } from '../shared/logging/logger';

// SC-12: registry definitions are the single source; matrix §8.8–§8.9 is the spec below.
const approved: Record<string, { type: 'boolean' | 'integer'; defaultValue: boolean | number; min?: number; max?: number; domain: string }> = {
  SOCIAL_FEED_ENABLED: { type: 'boolean', defaultValue: true, domain: 'social' },
  MESSAGING_ENABLED: { type: 'boolean', defaultValue: true, domain: 'messaging' },
  MATCHMAKING_APPLICATION_TIMEOUT_MINUTES: { type: 'integer', defaultValue: 1440, min: 15, max: 10080, domain: 'matchmaking' },
  MATCHMAKING_INVITATION_TIMEOUT_MINUTES: { type: 'integer', defaultValue: 1440, min: 15, max: 10080, domain: 'matchmaking' },
  MATCHMAKING_GROUP_MIN_SLOTS: { type: 'integer', defaultValue: 3, min: 3, max: 20, domain: 'matchmaking' },
  MATCHMAKING_GROUP_MAX_SLOTS: { type: 'integer', defaultValue: 12, min: 3, max: 20, domain: 'matchmaking' },
  MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER: { type: 'integer', defaultValue: 3, min: 1, max: 20, domain: 'matchmaking' },
  MESSAGING_GROUP_MAX_MEMBERS: { type: 'integer', defaultValue: 50, min: 3, max: 100, domain: 'messaging' },
  MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY: { type: 'integer', defaultValue: 20, min: 1, max: 500, domain: 'messaging' },
  MESSAGING_MESSAGES_PER_MINUTE: { type: 'integer', defaultValue: 30, min: 1, max: 300, domain: 'messaging' },
  SOCIAL_FREE_POSTS_PER_DAY: { type: 'integer', defaultValue: 10, min: 1, max: 100, domain: 'social' },
  SOCIAL_COMMENTS_PER_MINUTE: { type: 'integer', defaultValue: 10, min: 1, max: 60, domain: 'social' },
  PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES: { type: 'integer', defaultValue: 5, min: 1, max: 100, domain: 'player-skill-adjustment' },
  REPORT_ENABLED: { type: 'boolean', defaultValue: true, domain: 'report' },
};

async function setConfig(key: string, value: string): Promise<void> {
  await db.insert(systemConfigs).values({ configKey: key, configValue: value })
    .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: value } });
}

describe('SC-12 registry definitions', () => {
  it('registers every matrix §8.9 key and MIN_MATCHES with the approved type, default and range', () => {
    for (const [key, spec] of Object.entries(approved)) {
      expect(configDefinitions[key as ConfigKey], key).toMatchObject(spec);
    }
  });

  it('marks MATCHMAKING_REQUEST_EXPIRATION_MINUTES deprecated without changing its read behavior', () => {
    expect(configDefinitions.MATCHMAKING_REQUEST_EXPIRATION_MINUTES).toMatchObject({ deprecated: true, defaultValue: 30, min: 1 });
  });

  it('lists the Messaging keys consumed by the Messaging module', () => {
    expect(configKeysForDomain('messaging').sort()).toEqual([
      'MESSAGING_ENABLED', 'MESSAGING_GROUP_MAX_MEMBERS', 'MESSAGING_MESSAGES_PER_MINUTE', 'MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY',
    ]);
  });

  it('parses strictly within bounds', () => {
    const timeout = configDefinitions.MATCHMAKING_INVITATION_TIMEOUT_MINUTES;
    expect(parseConfigValue(timeout, ' 15 ')).toBe(15);
    expect(parseConfigValue(timeout, '10080')).toBe(10080);
    for (const raw of ['14', '10081', '1e3', '15.0', '-20', '', 'abc', undefined]) expect(parseConfigValue(timeout, raw)).toBeUndefined();
    expect(parseConfigValue(configDefinitions.SOCIAL_FEED_ENABLED, 'FALSE')).toBe(false);
    expect(parseConfigValue(configDefinitions.SOCIAL_FEED_ENABLED, 'yes')).toBeUndefined();
  });

  it('reports the group slot cross-key rule', () => {
    expect(validateConfigCrossKeyRules({ MATCHMAKING_GROUP_MIN_SLOTS: 12, MATCHMAKING_GROUP_MAX_SLOTS: 12 })).toEqual([]);
    expect(validateConfigCrossKeyRules({ MATCHMAKING_GROUP_MIN_SLOTS: 13 })).toEqual([
      { rule: 'MATCHMAKING_GROUP_MIN_SLOTS <= MATCHMAKING_GROUP_MAX_SLOTS', keys: ['MATCHMAKING_GROUP_MIN_SLOTS', 'MATCHMAKING_GROUP_MAX_SLOTS'] },
    ]);
  });
});

describe('SC-06 full registry and management validation', () => {
  it('registers the booking, tournament, team, auth and refund catalog', () => {
    expect(configKeysForDomain('booking').sort()).toEqual([
      'BOOKING_ACTIVE_LIMIT_MODE', 'BOOKING_ADVANCE_WINDOW_DAYS', 'BOOKING_ENABLED',
      'BOOKING_MAX_ACTIVE_PER_PLAYER', 'BOOKING_MAX_DURATION_MINUTES', 'BOOKING_MIN_DURATION_MINUTES',
      'BOOKING_PAYMENT_TIMEOUT_MINUTES', 'MAINTENANCE_ADVANCE_WINDOW_DAYS',
      'OWNER_CANCELLATION_DEADLINE_MINUTES', 'OWNER_CAN_CANCEL_BOOKING',
      'PLAYER_CANCELLATION_DEADLINE_MINUTES', 'PLAYER_CAN_CANCEL_BOOKING',
    ]);
    expect(configKeysForDomain('tournament').sort()).toEqual([
      'TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT', 'TOURNAMENT_ENABLED', 'TOURNAMENT_NO_SHOW_GRACE_PERIOD_MINUTES',
      'TOURNAMENT_RATING_ENABLED', 'TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES',
    ]);
    expect(configKeysForDomain('team')).toEqual(['TEAM_INVITATION_TIMEOUT_MINUTES']);
    expect(configKeysForDomain('auth')).toHaveLength(8);
    expect(configKeysForDomain('refund').sort()).toEqual(['REFUND_ENABLED', 'REFUND_PROCESSING_TIMEOUT_MINUTES']);
  });

  it('defaults PLAYER_SKILL_ADJUSTMENT_ENABLED to false', () => {
    expect(configDefinitions.PLAYER_SKILL_ADJUSTMENT_ENABLED.defaultValue).toBe(false);
  });

  it('gives every registered key a valid domain, description and parseable default', () => {
    for (const [key, definition] of Object.entries(configDefinitions)) {
      expect(configKeysForDomain(definition.domain), key).toContain(key);
      expect(definition.description.length, key).toBeGreaterThan(0);
      expect(parseConfigValue(definition, String(definition.defaultValue)), key).toBe(definition.defaultValue);
      expect(validateConfigValue(key as ConfigKey, definition.defaultValue), key).toEqual({
        ok: true,
        value: String(definition.defaultValue),
      });
    }
  });

  it('validates boolean, integer, enum and read-only inputs', () => {
    expect(validateConfigValue('BOOKING_ENABLED', false)).toEqual({ ok: true, value: 'false' });
    expect(validateConfigValue('BOOKING_ENABLED', 'TRUE')).toEqual({ ok: true, value: 'true' });
    expect(validateConfigValue('BOOKING_MAX_ACTIVE_PER_PLAYER', 5)).toEqual({ ok: true, value: '5' });
    expect(validateConfigValue('BOOKING_MAX_ACTIVE_PER_PLAYER', '05')).toEqual({ ok: true, value: '5' });
    expect(validateConfigValue('BOOKING_MAX_ACTIVE_PER_PLAYER', 51)).toMatchObject({ ok: false, code: 'OUT_OF_RANGE' });
    expect(validateConfigValue('BOOKING_ACTIVE_LIMIT_MODE', 'UNLIMITED')).toEqual({ ok: true, value: 'UNLIMITED' });
    expect(validateConfigValue('BOOKING_ACTIVE_LIMIT_MODE', 'limited')).toMatchObject({ ok: false, code: 'VALUE_NOT_ALLOWED' });

    expect(isConfigEditable(configDefinitions.MATCHMAKING_REQUEST_EXPIRATION_MINUTES)).toBe(false);
    expect(isConfigEditable(configDefinitions.PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS)).toBe(false);
    expect(isConfigEditable(configDefinitions.PLAYER_SKILL_ADJUSTMENT_ENABLED)).toBe(true);
  });

  it('reports booking and auth cross-key rules', () => {
    expect(validateConfigCrossKeyRules({ BOOKING_MIN_DURATION_MINUTES: 120, BOOKING_MAX_DURATION_MINUTES: 60 })).toEqual([
      { rule: 'BOOKING_MIN_DURATION_MINUTES <= BOOKING_MAX_DURATION_MINUTES', keys: ['BOOKING_MIN_DURATION_MINUTES', 'BOOKING_MAX_DURATION_MINUTES'] },
    ]);
    expect(validateConfigCrossKeyRules({ AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN: 600 })).toEqual([
      { rule: 'AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN <= AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN', keys: ['AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN', 'AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN'] },
    ]);
  });
});

describe('SC-12 typed readers', () => {
  beforeEach(async () => {
    await db.delete(systemConfigs);
    clearConfigCache();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearConfigCache();
  });

  it('falls back to registry defaults with WARN when keys are absent', async () => {
    const warn = vi.spyOn(logger, 'warn');
    expect(await socialConfig.get()).toEqual({ feedEnabled: true, freePostsPerDay: 10, commentsPerMinute: 10 });
    expect(await matchmakingConfig.get()).toMatchObject({
      invitationTimeoutMinutes: 1440, applicationTimeoutMinutes: 1440, groupMinSlots: 3, groupMaxSlots: 12, maxOpenPostsPerPlayer: 3,
      enabled: true, requestExpirationMinutes: 30, minLeadTimeMinutes: 60, matchDurationMinutes: 90,
    });
    expect(warn).toHaveBeenCalledWith('Missing system config; using default', expect.objectContaining({ configKey: 'SOCIAL_FEED_ENABLED' }));
  });

  it('reads stored values, keeps a stored 15-minute invitation timeout and logs ERROR for invalid ones', async () => {
    const error = vi.spyOn(logger, 'error');
    await setConfig('MATCHMAKING_INVITATION_TIMEOUT_MINUTES', '15');
    await setConfig('SOCIAL_FEED_ENABLED', 'false');
    await setConfig('SOCIAL_FREE_POSTS_PER_DAY', '101');
    await setConfig('MATCHMAKING_MIN_LEAD_TIME_MINUTES', '0');
    expect((await matchmakingConfig.get())).toMatchObject({ invitationTimeoutMinutes: 15, minLeadTimeMinutes: 0 });
    expect(await socialConfig.get()).toMatchObject({ feedEnabled: false, freePostsPerDay: 10 });
    expect(error).toHaveBeenCalledWith('Invalid system config; using default', expect.objectContaining({ configKey: 'SOCIAL_FREE_POSTS_PER_DAY', storedValue: '101' }));
  });

  it('exposes typed Messaging values through the shared loader without a separate reader', async () => {
    await setConfig('MESSAGING_MESSAGES_PER_MINUTE', '45');
    const values = await loadConfigValues(['MESSAGING_ENABLED', 'MESSAGING_MESSAGES_PER_MINUTE'] as const);
    expect(values).toEqual({ MESSAGING_ENABLED: true, MESSAGING_MESSAGES_PER_MINUTE: 45 });
  });

  it('shares one 60-second cache that every facade invalidates', async () => {
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    await setConfig('SOCIAL_COMMENTS_PER_MINUTE', '20');
    expect((await socialConfig.get()).commentsPerMinute).toBe(20);
    await db.update(systemConfigs).set({ configValue: '30' }).where(eq(systemConfigs.configKey, 'SOCIAL_COMMENTS_PER_MINUTE'));
    expect((await socialConfig.get()).commentsPerMinute).toBe(20);
    clock.mockReturnValue(now + 60_001);
    expect((await socialConfig.get()).commentsPerMinute).toBe(30);
    await db.update(systemConfigs).set({ configValue: '40' }).where(eq(systemConfigs.configKey, 'SOCIAL_COMMENTS_PER_MINUTE'));
    ratingsConfig.clearCache();
    expect((await socialConfig.get()).commentsPerMinute).toBe(40);
  });
});
