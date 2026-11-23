/** TanStack Query keys of the registration survey screens (AUTH-31). */

/** Public survey definition; not account-scoped. */
export const skillSurveyKey = ['auth', 'skill-survey'] as const;

/** Public level catalog (names, descriptions) for the result ladder. */
export const skillLevelsKey = ['skill-levels'] as const;

/** Private, account-scoped key for the own saved result. */
export const ownSkillSurveyKey = (userId: number | undefined) => ['players', userId, 'skill-survey'] as const;
