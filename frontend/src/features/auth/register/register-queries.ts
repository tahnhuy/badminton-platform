/** TanStack Query keys of the registration survey screens (AUTH-31). */
import { queryOptions } from '@tanstack/react-query';
import { authApi } from '../auth-api';

/** Public survey definition; not account-scoped. */
export const skillSurveyKey = ['auth', 'skill-survey'] as const;

/** Public level catalog (names, descriptions) for the result ladder. */
export const skillLevelsKey = ['skill-levels'] as const;

/** Public level catalog sorted by rank; shared by the survey result and the landing page ladder (AUTH-34). */
export const skillLevelsQuery = queryOptions({
  queryKey: skillLevelsKey,
  queryFn: ({ signal }) => authApi.listSkillLevels(signal).then(response => [...response.data].sort((a, b) => a.rank - b.rank)),
  staleTime: 5 * 60_000,
});

/** Private, account-scoped key for the own saved result. */
export const ownSkillSurveyKey = (userId: number | undefined) => ['players', userId, 'skill-survey'] as const;
