import { db, systemConfigs } from '../../db';
import { ownerConfigDefinitions } from './config-registry';
import { logger } from '../logging/logger';

export interface OwnerConfig {
  canCancelBooking: boolean;
  cancellationDeadlineMinutes: number;
  maintenanceAdvanceWindowDays: number;
}

export function parseOwnerConfig(stored: Map<string, string>): OwnerConfig {
  const values: Record<string, number | boolean> = {};
  for (const [key, definition] of Object.entries(ownerConfigDefinitions)) {
    const raw = stored.get(key)?.trim();
    let value: number | boolean | undefined;
    if (definition.type === 'boolean' && /^(true|false)$/i.test(raw ?? '')) {
      value = raw!.toLowerCase() === 'true';
    }
    if (definition.type === 'integer' && /^\d+$/.test(raw ?? '')) {
      const parsed = Number(raw);
      if (Number.isSafeInteger(parsed) && parsed >= definition.min) value = parsed;
    }
    if (value === undefined) logger.warn('Missing or invalid owner config; using default', { configKey: key });
    values[key] = value ?? definition.defaultValue;
  }
  return {
    canCancelBooking: values.OWNER_CAN_CANCEL_BOOKING as boolean,
    cancellationDeadlineMinutes: values.OWNER_CANCELLATION_DEADLINE_MINUTES as number,
    maintenanceAdvanceWindowDays: values.MAINTENANCE_ADVANCE_WINDOW_DAYS as number,
  };
}

let generation = 0;
let cache: { value: OwnerConfig; expiresAt: number } | null = null;
export const ownerConfig = {
  clearCache() { generation += 1; cache = null; },
  async get(): Promise<OwnerConfig> {
    if (cache && cache.expiresAt > Date.now()) return { ...cache.value };
    const readGeneration = generation;
    const startedAt = Date.now();
    const rows = await db.select().from(systemConfigs);
    const value = parseOwnerConfig(new Map(rows.map(row => [row.configKey, row.configValue])));
    if (readGeneration === generation) cache = { value, expiresAt: startedAt + 60_000 };
    return { ...value };
  },
};
