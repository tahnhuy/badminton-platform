import type { SkillSurveyResult } from '../auth-api';

/** Router state handed from a successful registration to `/register/result`. */
export interface RegisterResultState { result: SkillSurveyResult; fullName: string }

export function readRegisterResultState(state: unknown): RegisterResultState | null {
  const value = state as Partial<RegisterResultState> | null;
  return value?.result && typeof value.result === 'object' && value.result.skillLevel ? { result: value.result, fullName: value.fullName ?? '' } : null;
}
