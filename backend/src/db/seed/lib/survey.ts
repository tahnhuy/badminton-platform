import { eq } from 'drizzle-orm';
import { playerProfiles, skillLevels } from '../../schema/users';
import { playerSkillSurveys, skillSurveyVersions } from '../../schema/skill-survey';
import { scoreSkillSurvey, type SkillSurveyDefinition } from '../../../services/auth/skill-survey';
import { LEVEL_FIXTURES } from '../../../services/auth/skill-survey/fixtures';

/**
 * Seed helper (AUTH-32): every sample Player gets a profile and a registration
 * survey row whose engine result equals the profile level, like a real
 * registration. Answers come from the shared LEVEL_FIXTURES and are scored by the
 * engine against the ACTIVE version, never hand-written scores.
 */

export type SeedLevelCode = keyof typeof LEVEL_FIXTURES;

// Seeds use either the db client or a transaction; both expose select/insert.
type Executor = any;

export async function ensureSeedPlayerProfile(executor: Executor, input: {
  userId: number;
  fullName: string;
  levelCode: SeedLevelCode;
  avatarUrl?: string | null;
  phone?: string | null;
}): Promise<number> {
  const [active] = await executor.select().from(skillSurveyVersions).where(eq(skillSurveyVersions.status, 'ACTIVE')).limit(1);
  if (!active) throw new Error('Run npm run db:migrate first: an ACTIVE skill survey version is required');
  const levels: Array<{ id: number; code: string }> = await executor.select({ id: skillLevels.id, code: skillLevels.code }).from(skillLevels);
  const idOf = (code: string) => {
    const level = levels.find(l => l.code === code);
    if (!level) throw new Error(`Run npm run db:migrate first: skill level ${code} is required`);
    return level.id;
  };

  const fixture = LEVEL_FIXTURES[input.levelCode];
  const score = scoreSkillSurvey(active.definition as SkillSurveyDefinition, fixture.answers);
  if (score.skillLevelCode !== input.levelCode) {
    throw new Error(`Seed survey for ${input.levelCode} scored ${score.skillLevelCode}; update LEVEL_FIXTURES`);
  }
  const levelId = idOf(input.levelCode);

  await executor.insert(playerProfiles).values({
    userId: input.userId,
    fullName: input.fullName,
    skillLevelId: levelId,
    isSkillTentative: true,
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
  }).onConflictDoNothing({ target: playerProfiles.userId });

  // A profile left from an earlier seed run may hold another level; do not attach
  // a survey that would disagree with it (reset the database instead).
  const [profile] = await executor.select({ skillLevelId: playerProfiles.skillLevelId }).from(playerProfiles)
    .where(eq(playerProfiles.userId, input.userId));
  if (profile.skillLevelId !== levelId) {
    console.warn(`  ! Player ${input.userId} already has another level; survey row skipped (reset the database to re-seed).`);
    return profile.skillLevelId;
  }

  const fixed = (value: number) => value.toFixed(2);
  await executor.insert(playerSkillSurveys).values({
    userId: input.userId,
    surveyVersion: active.version,
    answers: fixture.answers,
    scoreK: fixed(score.components.K),
    scoreR: fixed(score.components.R),
    scoreX: fixed(score.components.X),
    scoreP: fixed(score.components.P),
    scoreA: fixed(score.components.A),
    scoreT: fixed(score.components.T),
    rawScore: fixed(score.rawScore),
    finalScore: fixed(score.finalScore),
    nominalSkillLevelId: idOf(score.nominalSkillLevelCode),
    resultingSkillLevelId: levelId,
    appliedGuardrails: score.appliedGuardrails,
  }).onConflictDoNothing({ target: playerSkillSurveys.userId });

  return levelId;
}
