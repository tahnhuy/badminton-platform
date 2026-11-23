import { clearConfigCache, loadConfigValues, messagingConfigDefinitions, parseConfigValue } from './config-registry';
import { logger } from '../logging/logger';

const messagingKeys = [
  'MESSAGING_ENABLED',
  'MESSAGING_GROUP_MAX_MEMBERS',
  'MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY',
  'MESSAGING_MESSAGES_PER_MINUTE',
] as const;

export interface MessagingConfig {
  enabled: boolean;
  groupMaxMembers: number;
  newDirectConversationsPerDay: number;
  messagesPerMinute: number;
}

export function parseMessagingConfig(stored: Map<string, string>): MessagingConfig {
  const values: Record<string, number | boolean | string> = {};
  for (const [key, definition] of Object.entries(messagingConfigDefinitions)) {
    const parsed = parseConfigValue(definition, stored.get(key));
    if (parsed === undefined) {
      logger.warn('Missing or invalid messaging config; using default', { configKey: key });
    }
    values[key] = parsed ?? definition.defaultValue;
  }
  return {
    enabled: values.MESSAGING_ENABLED as boolean,
    groupMaxMembers: values.MESSAGING_GROUP_MAX_MEMBERS as number,
    newDirectConversationsPerDay: values.MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY as number,
    messagesPerMinute: values.MESSAGING_MESSAGES_PER_MINUTE as number,
  };
}

export const messagingConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<MessagingConfig> {
    const values = await loadConfigValues(messagingKeys);
    return {
      enabled: values.MESSAGING_ENABLED,
      groupMaxMembers: values.MESSAGING_GROUP_MAX_MEMBERS,
      newDirectConversationsPerDay: values.MESSAGING_NEW_DIRECT_CONVERSATIONS_PER_DAY,
      messagesPerMinute: values.MESSAGING_MESSAGES_PER_MINUTE,
    };
  },
};
