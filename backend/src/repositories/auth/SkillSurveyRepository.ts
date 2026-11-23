import { asc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { playerProfiles, skillLevels } from '../../db/schema/users';
import { playerSkillSurveys, skillSurveyVersions } from '../../db/schema/skill-survey';
import type { SkillSurveyDefinition, SurveyAnswers } from '../../services/auth/skill-survey';

/** Reads for the registration skill survey (Auth Tech Design "Registration skill survey"). */
export const skillSurveyRepository = {
  async findActiveVersion(): Promise<{ version: number; definition: SkillSurveyDefinition } | null> {
    const [row] = await db
      .select({ version: skillSurveyVersions.version, definition: skillSurveyVersions.definition })
      .from(skillSurveyVersions)
      .where(eq(skillSurveyVersions.status, 'ACTIVE'))
      .limit(1);
    return row ? { version: row.version, definition: row.definition as SkillSurveyDefinition } : null;
  },

  async findVersion(version: number): Promise<SkillSurveyDefinition | null> {
    const [row] = await db
      .select({ definition: skillSurveyVersions.definition })
      .from(skillSurveyVersions)
      .where(eq(skillSurveyVersions.version, version))
      .limit(1);
    return row ? (row.definition as SkillSurveyDefinition) : null;
  },

  async listSkillLevels(): Promise<Array<{ id: number; code: string; name: string; rank: number }>> {
    return db
      .select({ id: skillLevels.id, code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank })
      .from(skillLevels)
      .orderBy(asc(skillLevels.rank));
  },

  /** The Player's stored survey with the profile's tentative flag, or null. */
  async findPlayerSurvey(userId: number): Promise<{ surveyVersion: number; answers: SurveyAnswers; isSkillTentative: boolean } | null> {
    const [row] = await db
      .select({
        surveyVersion: playerSkillSurveys.surveyVersion,
        answers: playerSkillSurveys.answers,
        isSkillTentative: playerProfiles.isSkillTentative,
      })
      .from(playerSkillSurveys)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, playerSkillSurveys.userId))
      .where(eq(playerSkillSurveys.userId, userId))
      .limit(1);
    return row ? { surveyVersion: row.surveyVersion, answers: row.answers as SurveyAnswers, isSkillTentative: row.isSkillTentative } : null;
  },
};
