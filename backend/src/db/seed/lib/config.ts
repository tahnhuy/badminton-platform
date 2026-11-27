import { eq } from 'drizzle-orm';
import { db } from '../../index';
import { systemConfigs } from '../../schema/config';
import { clearConfigCache } from '../../../shared/config/config-registry';

/**
 * Run `fn` with some system configs temporarily changed (e.g. auto-credit off so an owner
 * earning stays PENDING for Admin review), then restore them exactly — including removing a
 * key that did not exist before. Seed-only: no audit row, the change never outlives `fn`.
 */
export async function withConfig<T>(values: Record<string, string>, fn: () => Promise<T>): Promise<T> {
  const previous = new Map<string, string | null>();
  for (const [key, value] of Object.entries(values)) {
    const [row] = await db.select({ value: systemConfigs.configValue }).from(systemConfigs).where(eq(systemConfigs.configKey, key));
    previous.set(key, row?.value ?? null);
    await db.insert(systemConfigs).values({ configKey: key, configValue: value })
      .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: value } });
  }
  clearConfigCache();
  try {
    return await fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === null) await db.delete(systemConfigs).where(eq(systemConfigs.configKey, key));
      else await db.update(systemConfigs).set({ configValue: value }).where(eq(systemConfigs.configKey, key));
    }
    clearConfigCache();
  }
}
