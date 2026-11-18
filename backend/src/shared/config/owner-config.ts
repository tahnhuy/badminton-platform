import { clearConfigCache, loadConfigValues, ownerConfigDefinitions, parseConfigValue } from './config-registry';
import { logger } from '../logging/logger';

const ownerKeys = [
  'OWNER_CAN_CANCEL_BOOKING',
  'OWNER_CANCELLATION_DEADLINE_MINUTES',
  'MAINTENANCE_ADVANCE_WINDOW_DAYS',
] as const;

export interface OwnerConfig {
  canCancelBooking: boolean;
  cancellationDeadlineMinutes: number;
  maintenanceAdvanceWindowDays: number;
}

export function parseOwnerConfig(stored: Map<string, string>): OwnerConfig {
  const values: Record<string, number | boolean | string> = {};
  for (const [key, definition] of Object.entries(ownerConfigDefinitions)) {
    const parsed = parseConfigValue(definition, stored.get(key));
    if (parsed === undefined) {
      logger.warn('Missing or invalid owner config; using default', { configKey: key });
    }
    values[key] = parsed ?? definition.defaultValue;
  }
  return {
    canCancelBooking: values.OWNER_CAN_CANCEL_BOOKING as boolean,
    cancellationDeadlineMinutes: values.OWNER_CANCELLATION_DEADLINE_MINUTES as number,
    maintenanceAdvanceWindowDays: values.MAINTENANCE_ADVANCE_WINDOW_DAYS as number,
  };
}

export const ownerConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<OwnerConfig> {
    const values = await loadConfigValues(ownerKeys);
    return {
      canCancelBooking: values.OWNER_CAN_CANCEL_BOOKING,
      cancellationDeadlineMinutes: values.OWNER_CANCELLATION_DEADLINE_MINUTES,
      maintenanceAdvanceWindowDays: values.MAINTENANCE_ADVANCE_WINDOW_DAYS,
    };
  },
};
