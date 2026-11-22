import { AppError, NotFoundError } from '../../errors/AppError';
import { skillSurveyRepository } from '../../repositories/auth/SkillSurveyRepository';
import {
  scoreSkillSurvey,
  toPublicSkillSurvey,
  toSkillSurveyResult,
  type PublicSkillSurvey,
  type SkillSurveyDefinition,
  type SkillSurveyResult,
} from './skill-survey';

/** Registration skill survey reads (Auth Tech Design "Registration skill survey"). */
export const skillSurveyService = {
  /** ACTIVE version, or `503 AUTH_SKILL_SURVEY_UNAVAILABLE` (registration is impossible without it). */
  async requireActiveVersion(): Promise<{ version: number; definition: SkillSurveyDefinition }> {
    const active = await skillSurveyRepository.findActiveVersion();
    if (!active) {
      throw new AppError('AUTH_SKILL_SURVEY_UNAVAILABLE', 503, 'Registration skill survey is temporarily unavailable');
    }
    return active;
  },

  /** GET /api/v1/auth/skill-survey — questions and options only, no scoring data. */
  async getActiveSurvey(): Promise<PublicSkillSurvey> {
    const active = await this.requireActiveVersion();
    return toPublicSkillSurvey(active.version, active.definition);
  },

  /**
   * GET /api/v1/players/me/skill-survey — recomputed from the stored answers and
   * the stored version's definition (immutable once published), so it equals the
   * result returned at registration.
   */
  async getOwnResult(userId: number): Promise<SkillSurveyResult> {
    const stored = await skillSurveyRepository.findPlayerSurvey(userId);
    if (!stored) throw new NotFoundError('Chưa có kết quả khảo sát trình độ.', 'PLAYER_SKILL_SURVEY_NOT_FOUND');
    const definition = await skillSurveyRepository.findVersion(stored.surveyVersion);
    if (!definition) throw new Error(`Skill survey version ${stored.surveyVersion} is missing`);
    const levels = await skillSurveyRepository.listSkillLevels();
    return toSkillSurveyResult(stored.surveyVersion, scoreSkillSurvey(definition, stored.answers), levels, stored.isSkillTentative);
  },
};
