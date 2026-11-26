import { loadConfigValues, clearConfigCache } from './config-registry';

// Typed facade for the Tournament keys (matrix §8.4, §8.5).
const tournamentKeys = ['TOURNAMENT_ENABLED', 'TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT', 'TEAM_INVITATION_TIMEOUT_MINUTES'] as const;

export interface TournamentConfig {
  enabled: boolean;
  defaultParticipantLimit: number;
  teamInvitationTimeoutMinutes: number;
}

export const tournamentConfig = {
  clearCache: clearConfigCache,
  async get(): Promise<TournamentConfig> {
    const values = await loadConfigValues(tournamentKeys);
    return {
      enabled: values.TOURNAMENT_ENABLED,
      defaultParticipantLimit: values.TOURNAMENT_DEFAULT_PARTICIPANT_LIMIT,
      teamInvitationTimeoutMinutes: values.TEAM_INVITATION_TIMEOUT_MINUTES,
    };
  },
};
