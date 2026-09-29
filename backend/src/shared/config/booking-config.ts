import { db } from '../../db/client';
import { systemConfigs } from '../../db/schema/config';
import { logger } from '../logging/logger';

export const BOOKING_CONFIG_DEFAULTS = {
  BOOKING_ENABLED: true,
  BOOKING_MIN_DURATION_MINUTES: 60,
  BOOKING_MAX_DURATION_MINUTES: 180,
  BOOKING_ADVANCE_WINDOW_DAYS: 7,
  BOOKING_ACTIVE_LIMIT_MODE: 'LIMITED',
  BOOKING_MAX_ACTIVE_PER_PLAYER: 5,
  PLAYER_CAN_CANCEL_BOOKING: true,
  PLAYER_CANCELLATION_DEADLINE_MINUTES: 0,
  BOOKING_PAYMENT_TIMEOUT_MINUTES: 10,
} as const;

export interface BookingConfig {
  bookingEnabled: boolean;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  advanceWindowDays: number;
  activeLimitMode: string;
  maxActivePerPlayer: number;
  playerCanCancelBooking: boolean;
  playerCancellationDeadlineMinutes: number;
  paymentTimeoutMinutes: number;
}

const CACHE_TTL_MS = 60 * 1000;
let cache: { value: BookingConfig; expiresAt: number } | null = null;

function readNumber(values: Map<string, string>, key: keyof typeof BOOKING_CONFIG_DEFAULTS, min: number): number {
  const fallback = BOOKING_CONFIG_DEFAULTS[key];
  const raw = values.get(key)?.trim();
  const parsed = Number(raw);
  if (raw === undefined || raw === '' || !Number.isInteger(parsed) || parsed < min) {
    if (raw !== undefined) {
      logger.warn(`Invalid booking config "${key}"="${raw}", using default ${fallback}`, { configKey: key });
    }
    return Number(fallback);
  }
  return parsed;
}

function readBoolean(values: Map<string, string>, key: keyof typeof BOOKING_CONFIG_DEFAULTS): boolean {
  const fallback = BOOKING_CONFIG_DEFAULTS[key];
  const raw = values.get(key)?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== undefined) {
    logger.warn(`Invalid boolean booking config "${key}"="${raw}", using default ${fallback}`, { configKey: key });
  }
  return fallback as boolean;
}

async function loadBookingConfig(): Promise<BookingConfig> {
  const rows = await db.select().from(systemConfigs);
  const values = new Map(rows.map((row) => [row.configKey, row.configValue]));

  return {
    bookingEnabled: readBoolean(values, 'BOOKING_ENABLED'),
    minDurationMinutes: readNumber(values, 'BOOKING_MIN_DURATION_MINUTES', 1),
    maxDurationMinutes: readNumber(values, 'BOOKING_MAX_DURATION_MINUTES', 1),
    advanceWindowDays: readNumber(values, 'BOOKING_ADVANCE_WINDOW_DAYS', 0),
    activeLimitMode: values.get('BOOKING_ACTIVE_LIMIT_MODE')?.trim() || BOOKING_CONFIG_DEFAULTS.BOOKING_ACTIVE_LIMIT_MODE,
    maxActivePerPlayer: readNumber(values, 'BOOKING_MAX_ACTIVE_PER_PLAYER', 1),
    playerCanCancelBooking: readBoolean(values, 'PLAYER_CAN_CANCEL_BOOKING'),
    playerCancellationDeadlineMinutes: readNumber(values, 'PLAYER_CANCELLATION_DEADLINE_MINUTES', 0),
    paymentTimeoutMinutes: readNumber(values, 'BOOKING_PAYMENT_TIMEOUT_MINUTES', 1),
  };
}

export const bookingConfig = {
  clearCache(): void {
    cache = null;
  },

  async get(): Promise<BookingConfig> {
    const now = Date.now();
    if (cache && cache.expiresAt > now) {
      return cache.value;
    }
    const value = await loadBookingConfig();
    cache = { value, expiresAt: now + CACHE_TTL_MS };
    return value;
  },
};
