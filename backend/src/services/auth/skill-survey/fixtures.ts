import type { SurveyAnswers } from './types';

/**
 * Version 1 answer sets shared by tests (AUTH-29/30) and seed scripts (AUTH-32).
 * `PRD_EXAMPLES` are the six acceptance examples of the Auth PRD; together with
 * `BEGINNER` and `WEAK` they cover all seven levels. Expected values are what the
 * engine must produce, not inputs.
 */

const SKILL_IDS = [
  'skill.service', 'skill.clear', 'skill.smash', 'skill.netPlay', 'skill.defense',
  'skill.drive', 'skill.backhand', 'skill.footwork', 'skill.doublesPlay',
] as const;

export function skillAnswers(values: number[]): SurveyAnswers {
  if (values.length !== SKILL_IDS.length) throw new Error('Expected nine skill values');
  return Object.fromEntries(SKILL_IDS.map((id, i) => [id, values[i]]));
}

const all = (value: number) => skillAnswers(Array(SKILL_IDS.length).fill(value));

export interface SurveyFixture {
  answers: SurveyAnswers;
  expected: { finalScore: number; level: string; guardrails: string[] };
}

const example4Answers: SurveyAnswers = {
  yearsPlaying: '4Y_TO_7Y',
  frequencyPerWeek: 'TWO_TO_THREE',
  coaching: 'NONE',
  returningAfterBreak: false,
  ...skillAnswers([3, 3, 3, 3, 3, 3, 2, 2, 2]),
  rallyConsistency: '20_PLUS_ATTACKING',
  stamina: 'MULTIPLE_MATCHES',
  tournamentAchievement: 'NONE',
};

export const PRD_EXAMPLES: Record<1 | 2 | 3 | 4 | 5 | 6, SurveyFixture> = {
  1: {
    answers: {
      yearsPlaying: '2Y_TO_4Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'SELF_TAUGHT', returningAfterBreak: false,
      ...skillAnswers([2, 2, 2, 2, 2, 2, 1, 1, 2]),
      rallyConsistency: '15_TO_19', stamina: 'THREE_GAMES', tournamentAchievement: 'INTERNAL',
    },
    expected: { finalScore: 56.25, level: 'AVERAGE', guardrails: [] },
  },
  2: {
    answers: {
      yearsPlaying: '2Y_TO_4Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'NONE', returningAfterBreak: false,
      ...all(3),
      rallyConsistency: '5_TO_9', stamina: '20_TO_40M', tournamentAchievement: 'NONE',
    },
    expected: { finalScore: 55.8, level: 'AVERAGE_MINUS', guardrails: ['G1_BOTTLENECK'] },
  },
  3: {
    answers: {
      yearsPlaying: 'LESS_THAN_6M', frequencyPerWeek: 'FOUR_PLUS', coaching: 'COACH_LESS_THAN_6M',
      ...all(2),
      rallyConsistency: '10_TO_14', stamina: 'ONE_HOUR_FADES_GAME_3', tournamentAchievement: 'NONE',
    },
    expected: { finalScore: 46.67, level: 'AVERAGE_MINUS', guardrails: ['G2_EXPERIENCE_CAP'] },
  },
  4: { answers: example4Answers, expected: { finalScore: 76.96, level: 'GOOD', guardrails: [] } },
  5: {
    answers: { ...example4Answers, tournamentAchievement: 'DISTRICT_OR_STUDENT' },
    expected: { finalScore: 81.96, level: 'EXCELLENT', guardrails: [] },
  },
  6: {
    answers: { ...example4Answers, tournamentAchievement: 'DISTRICT_OR_STUDENT', returningAfterBreak: true },
    expected: { finalScore: 66.96, level: 'AVERAGE_PLUS', guardrails: [] },
  },
};

/** One answer set per level, rank order (BEGINNER → EXCELLENT). */
export const LEVEL_FIXTURES: Record<string, SurveyFixture> = {
  BEGINNER: {
    answers: {
      yearsPlaying: 'LESS_THAN_6M', frequencyPerWeek: 'LESS_THAN_1', coaching: 'NONE',
      ...all(0),
      rallyConsistency: 'LESS_THAN_5', stamina: 'UNDER_20M', tournamentAchievement: 'NONE',
    },
    expected: { finalScore: 0, level: 'BEGINNER', guardrails: [] },
  },
  WEAK: {
    answers: {
      yearsPlaying: '1Y_TO_2Y', frequencyPerWeek: 'ONE', coaching: 'SELF_TAUGHT', returningAfterBreak: false,
      ...all(1),
      rallyConsistency: '5_TO_9', stamina: '20_TO_40M', tournamentAchievement: 'NONE',
    },
    expected: { finalScore: 26.78, level: 'WEAK', guardrails: [] },
  },
  AVERAGE_MINUS: PRD_EXAMPLES[2],
  AVERAGE: PRD_EXAMPLES[1],
  AVERAGE_PLUS: PRD_EXAMPLES[6],
  GOOD: PRD_EXAMPLES[4],
  EXCELLENT: PRD_EXAMPLES[5],
};
