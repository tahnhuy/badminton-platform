import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { systemConfigs } from '../../db/schema/config';
import { logger } from '../logging/logger';

export type SystemRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';

export const AUTH_CONFIG_DEFAULTS = {
  AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD: 5,
  AUTH_FAILED_LOGIN_LOCKOUT_MINUTES: 15,
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER: 10080,
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER: 43200,
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER: 10080,
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER: 43200,
  AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN: 60,
  AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN: 480,
} as const;

export type AuthConfigKey = keyof typeof AUTH_CONFIG_DEFAULTS;

interface CacheEntry {
  values: Map<string, number>;
  expiresAt: number;
}

const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL (Decision #10)
let cache: CacheEntry | null = null;

async function loadAuthConfigsFromDb(): Promise<Map<string, number>> {
  const rows = await db.select().from(systemConfigs);
  const map = new Map<string, number>();

  for (const [key, defaultValue] of Object.entries(AUTH_CONFIG_DEFAULTS)) {
    const row = rows.find((r) => r.configKey === key);

    if (!row) {
      logger.warn(`Missing system config key: ${key}, using default value: ${defaultValue}`, {
        configKey: key,
        defaultValue,
      });
      map.set(key, defaultValue);
      continue;
    }

    const rawVal = row.configValue?.trim();
    const num = Number(rawVal);

    if (!rawVal || !Number.isInteger(num) || num <= 0) {
      logger.error(
        `Invalid system config value for key: ${key}. Stored value: "${row.configValue}", using default: ${defaultValue}`,
        {
          configKey: key,
          storedValue: row.configValue,
          defaultValue,
        }
      );
      map.set(key, defaultValue);
      continue;
    }

    map.set(key, num);
  }

  return map;
}

async function getCachedConfigs(): Promise<Map<string, number>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) {
    return cache.values;
  }

  const values = await loadAuthConfigsFromDb();
  cache = {
    values,
    expiresAt: now + CACHE_TTL_MS,
  };

  return values;
}

export const systemConfig = {
  /**
   * Clears internal memory cache (useful for testing or cache invalidation)
   */
  clearCache(): void {
    cache = null;
  },

  async getLockoutThreshold(): Promise<number> {
    const configs = await getCachedConfigs();
    return configs.get('AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD') ?? AUTH_CONFIG_DEFAULTS.AUTH_FAILED_LOGIN_LOCKOUT_THRESHOLD;
  },

  async getLockoutMinutes(): Promise<number> {
    const configs = await getCachedConfigs();
    return configs.get('AUTH_FAILED_LOGIN_LOCKOUT_MINUTES') ?? AUTH_CONFIG_DEFAULTS.AUTH_FAILED_LOGIN_LOCKOUT_MINUTES;
  },

  async getLoginLockoutConfig(): Promise<{ threshold: number; lockoutMinutes: number }> {
    const threshold = await this.getLockoutThreshold();
    const lockoutMinutes = await this.getLockoutMinutes();
    return { threshold, lockoutMinutes };
  },

  async getSessionTimeouts(role: SystemRole): Promise<{

    idleTimeoutMinutes: number;
    absoluteTimeoutMinutes: number;
  }> {
    const configs = await getCachedConfigs();

    switch (role) {
      case 'ADMIN':
        return {
          idleTimeoutMinutes:
            configs.get('AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN') ??
            AUTH_CONFIG_DEFAULTS.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_ADMIN,
          absoluteTimeoutMinutes:
            configs.get('AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN') ??
            AUTH_CONFIG_DEFAULTS.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_ADMIN,
        };

      case 'COURT_OWNER':
        return {
          idleTimeoutMinutes:
            configs.get('AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER') ??
            AUTH_CONFIG_DEFAULTS.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_COURT_OWNER,
          absoluteTimeoutMinutes:
            configs.get('AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER') ??
            AUTH_CONFIG_DEFAULTS.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_COURT_OWNER,
        };

      case 'PLAYER':
      default:
        return {
          idleTimeoutMinutes:
            configs.get('AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER') ??
            AUTH_CONFIG_DEFAULTS.AUTH_SESSION_IDLE_TIMEOUT_MINUTES_PLAYER,
          absoluteTimeoutMinutes:
            configs.get('AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER') ??
            AUTH_CONFIG_DEFAULTS.AUTH_SESSION_ABSOLUTE_TIMEOUT_MINUTES_PLAYER,
        };
    }
  },
};
