import { configDefinitions, loadConfigValues, clearConfigCache } from './config-registry';

// Thin typed facade over the shared registry (SC-12). Defaults and bounds live in
// config-registry.ts only.
const matchmakingKeys = [
  'MATCHMAKING_ENABLED',
  'MATCHMAKING_REQUEST_EXPIRATION_MINUTES',
  'MATCHMAKING_INVITATION_TIMEOUT_MINUTES',
  'MATCHMAKING_MIN_LEAD_TIME_MINUTES',
  'MATCHMAKING_MATCH_DURATION_MINUTES',
  'MATCHMAKING_APPLICATION_TIMEOUT_MINUTES',
  'MATCHMAKING_GROUP_MIN_SLOTS',
  'MATCHMAKING_GROUP_MAX_SLOTS',
  'MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER',
] as const;

export const MATCHMAKING_CONFIG_DEFAULTS = Object.fromEntries(
  matchmakingKeys.map(key => [key, configDefinitions[key].defaultValue]),
) as { [K in (typeof matchmakingKeys)[number]]: (typeof configDefinitions)[K]['defaultValue'] };

export interface MatchmakingConfig {
  enabled: boolean;
  /** Deprecated key; read until the Social Matchmaking cutover. */
  requestExpirationMinutes: number;
  invitationTimeoutMinutes: number;
  minLeadTimeMinutes: number;
  matchDurationMinutes: number;
  applicationTimeoutMinutes: number;
  groupMinSlots: number;
  groupMaxSlots: number;
  maxOpenPostsPerPlayer: number;
}

export const matchmakingConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<MatchmakingConfig> {
    const values = await loadConfigValues(matchmakingKeys);
    return {
      enabled: values.MATCHMAKING_ENABLED,
      requestExpirationMinutes: values.MATCHMAKING_REQUEST_EXPIRATION_MINUTES,
      invitationTimeoutMinutes: values.MATCHMAKING_INVITATION_TIMEOUT_MINUTES,
      minLeadTimeMinutes: values.MATCHMAKING_MIN_LEAD_TIME_MINUTES,
      matchDurationMinutes: values.MATCHMAKING_MATCH_DURATION_MINUTES,
      applicationTimeoutMinutes: values.MATCHMAKING_APPLICATION_TIMEOUT_MINUTES,
      groupMinSlots: values.MATCHMAKING_GROUP_MIN_SLOTS,
      groupMaxSlots: values.MATCHMAKING_GROUP_MAX_SLOTS,
      maxOpenPostsPerPlayer: values.MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER,
    };
  },
};
