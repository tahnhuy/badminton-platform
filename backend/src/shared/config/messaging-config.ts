import { db, systemConfigs } from '../../db';
import { messagingConfigDefinitions } from './config-registry';
import { logger } from '../logging/logger';

export interface MessagingConfig {
  enabled: boolean;
  groupMaxMembers: number;
  newDirectConversationsPerDay: number;
  messagesPerMinute: number;
}

export function parseMessagingConfig(stored: Map<string, string>): MessagingConfig {
  const values: Record<string, number | boolean> = {};
  for (const [key, definition] of Object.entries(messagingConfigDefinitions)) {
    const raw = stored.get(key)?.trim();
    let value: number | boolean | undefined;
    if (definition.type === 'boolean' && /^(true|false)$/i.test(raw ?? '')) {
      value = raw!.toLowerCase() === 'true';
    }
    if (definition.type === 'integer' && /^\d+$/.test(raw ?? '')) {
      const parsed = Number(raw);
      if (
        Number.isSafeInteger(parsed) &&
        parsed >= definition.min &&
        parsed <= definition.max
      ) {
        value = parsed;
      }
    }
    if (value === undefined) {
      logger.warn('Missing or invalid messaging config; using default', { configKey: key });
    }
    values[key] = value ?? definition.defaultValue;
  }
  return {
    enabled: values.MESSAGING_ENABLED as boolean,
    groupMaxMembers: values.MESSAGING_GROUP_MAX_MEMBERS as number,
    newDirectConversationsPerDay: values.MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY as number,
    messagesPerMinute: values.MESSAGING_MESSAGES_PER_MINUTE as number,
  };
}

let generation = 0;
let cache: { value: MessagingConfig; expiresAt: number } | null = null;

export const messagingConfig = {
  clearCache() {
    generation += 1;
    cache = null;
  },
  async get(): Promise<MessagingConfig> {
    if (cache && cache.expiresAt > Date.now()) {
      return { ...cache.value };
    }
    const readGeneration = generation;
    const startedAt = Date.now();
    const rows = await db.select().from(systemConfigs);
    const value = parseMessagingConfig(new Map(rows.map((row) => [row.configKey, row.configValue])));
    if (readGeneration === generation) {
      cache = { value, expiresAt: startedAt + 60_000 };
    }
    return { ...value };
  },
};
