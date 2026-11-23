import { clearConfigCache, configDefinitions, loadConfigValues } from './config-registry';

const bookingKeys = [
  'BOOKING_ENABLED',
  'BOOKING_MIN_DURATION_MINUTES',
  'BOOKING_MAX_DURATION_MINUTES',
  'BOOKING_ADVANCE_WINDOW_DAYS',
  'BOOKING_ACTIVE_LIMIT_MODE',
  'BOOKING_MAX_ACTIVE_PER_PLAYER',
  'PLAYER_CAN_CANCEL_BOOKING',
  'PLAYER_CANCELLATION_DEADLINE_MINUTES',
  'BOOKING_PAYMENT_TIMEOUT_MINUTES',
] as const;

export const BOOKING_CONFIG_DEFAULTS = {
  BOOKING_ENABLED: configDefinitions.BOOKING_ENABLED.defaultValue,
  BOOKING_MIN_DURATION_MINUTES: configDefinitions.BOOKING_MIN_DURATION_MINUTES.defaultValue,
  BOOKING_MAX_DURATION_MINUTES: configDefinitions.BOOKING_MAX_DURATION_MINUTES.defaultValue,
  BOOKING_ADVANCE_WINDOW_DAYS: configDefinitions.BOOKING_ADVANCE_WINDOW_DAYS.defaultValue,
  BOOKING_ACTIVE_LIMIT_MODE: configDefinitions.BOOKING_ACTIVE_LIMIT_MODE.defaultValue,
  BOOKING_MAX_ACTIVE_PER_PLAYER: configDefinitions.BOOKING_MAX_ACTIVE_PER_PLAYER.defaultValue,
  PLAYER_CAN_CANCEL_BOOKING: configDefinitions.PLAYER_CAN_CANCEL_BOOKING.defaultValue,
  PLAYER_CANCELLATION_DEADLINE_MINUTES: configDefinitions.PLAYER_CANCELLATION_DEADLINE_MINUTES.defaultValue,
  BOOKING_PAYMENT_TIMEOUT_MINUTES: configDefinitions.BOOKING_PAYMENT_TIMEOUT_MINUTES.defaultValue,
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

export const bookingConfig = {
  clearCache: clearConfigCache,

  async get(): Promise<BookingConfig> {
    const values = await loadConfigValues(bookingKeys);
    return {
      bookingEnabled: values.BOOKING_ENABLED,
      minDurationMinutes: values.BOOKING_MIN_DURATION_MINUTES,
      maxDurationMinutes: values.BOOKING_MAX_DURATION_MINUTES,
      advanceWindowDays: values.BOOKING_ADVANCE_WINDOW_DAYS,
      activeLimitMode: values.BOOKING_ACTIVE_LIMIT_MODE,
      maxActivePerPlayer: values.BOOKING_MAX_ACTIVE_PER_PLAYER,
      playerCanCancelBooking: values.PLAYER_CAN_CANCEL_BOOKING,
      playerCancellationDeadlineMinutes: values.PLAYER_CANCELLATION_DEADLINE_MINUTES,
      paymentTimeoutMinutes: values.BOOKING_PAYMENT_TIMEOUT_MINUTES,
    };
  },
};
