// Reviewed pure suites: no database, HTTP server, or persistence fixtures.
// Shared by standalone unit config and the full-suite cleanup guard.
export const PURE_UNIT_TEST_PATHS = [
  'src/__tests__/bracketGenerator.test.ts',
  'src/__tests__/scheduleGenerator.test.ts',
  'src/__tests__/score.test.ts',
  'src/__tests__/vnpay-signature.test.ts',
  'src/__tests__/skill-survey-engine.test.ts',
  'src/__tests__/validation-boundaries.test.ts',
  'src/__tests__/password-hasher.test.ts',
  'src/__tests__/facility-stats-helpers.test.ts',
  'src/__tests__/rating-adjustment.test.ts',
  'src/__tests__/request-schedule.test.ts',
  'src/services/tournaments/placement/placement.test.ts',
  'src/services/tournaments/rating/skillRating.test.ts',
] as const;
