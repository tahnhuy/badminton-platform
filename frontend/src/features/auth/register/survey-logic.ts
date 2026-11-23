import type { SkillSurvey, SkillSurveyQuestion, SurveyAnswers, SurveyAnswerValue } from '../auth-api';

/**
 * Pure helpers over the survey definition returned by the API. The frontend holds
 * no survey content or scoring: visibility and completeness are derived from the
 * definition (`hiddenWhen`, `options`, `skillScale`) only.
 */

export type QuestionMap = Record<string, SkillSurveyQuestion>;

export const questionMap = (survey: SkillSurvey): QuestionMap =>
  Object.fromEntries(survey.questions.map(question => [question.id, question]));

/** 1-based number of every question in survey order ("Câu 5"). */
export const questionNumbers = (survey: SkillSurvey): Record<string, number> =>
  Object.fromEntries(survey.steps.flatMap(step => step.questionIds).map((id, index) => [id, index + 1]));

/** A step whose questions are all SKILL items uses the one-at-a-time skill carousel. */
export const isSkillStep = (survey: SkillSurvey, stepIndex: number, questions: QuestionMap) => {
  const ids = survey.steps[stepIndex]?.questionIds ?? [];
  return ids.length > 0 && ids.every(id => questions[id]?.type === 'SKILL');
};

export function isHidden(question: SkillSurveyQuestion | undefined, answers: SurveyAnswers): boolean {
  const rule = question?.hiddenWhen;
  return Boolean(rule && answers[rule.questionId] === rule.optionCode);
}

export const visibleIds = (survey: SkillSurvey, stepIndex: number, questions: QuestionMap, answers: SurveyAnswers) =>
  (survey.steps[stepIndex]?.questionIds ?? []).filter(id => !isHidden(questions[id], answers));

export const missingIds = (survey: SkillSurvey, stepIndex: number, questions: QuestionMap, answers: SurveyAnswers) =>
  visibleIds(survey, stepIndex, questions, answers).filter(id => answers[id] === undefined);

/** Whether `value` is a valid answer for `question` according to the definition. */
export function isValidAnswer(survey: SkillSurvey, question: SkillSurveyQuestion | undefined, value: unknown): value is SurveyAnswerValue {
  if (!question) return false;
  if (question.type === 'SKILL') return survey.skillScale.some(level => level.value === value);
  return (question.options ?? []).some(option => option.code === value);
}

/** Answers that the definition accepts; drops unknown ids and stale codes (e.g. from an older draft). */
export function sanitizeAnswers(survey: SkillSurvey, questions: QuestionMap, raw: unknown): SurveyAnswers {
  if (!raw || typeof raw !== 'object') return {};
  const answers: SurveyAnswers = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isValidAnswer(survey, questions[id], value)) answers[id] = value;
  }
  return clearHiddenAnswers(questions, answers);
}

/** PRD: a hidden item has no answer (item 4 is cleared when item 1 becomes "Dưới 6 tháng"). */
export function clearHiddenAnswers(questions: QuestionMap, answers: SurveyAnswers): SurveyAnswers {
  const next = { ...answers };
  for (const question of Object.values(questions)) {
    if (next[question.id] !== undefined && isHidden(question, next)) delete next[question.id];
  }
  return next;
}

/** Radix radio values are strings; map an answer to and from its option value. */
export const toRadioValue = (value: SurveyAnswerValue | undefined) => (value === undefined ? '' : String(value));

export function fromRadioValue(survey: SkillSurvey, question: SkillSurveyQuestion, value: string): SurveyAnswerValue | undefined {
  if (question.type === 'SKILL') return survey.skillScale.find(level => String(level.value) === value)?.value;
  return question.options?.find(option => String(option.code) === value)?.code;
}

export function answerLabel(survey: SkillSurvey, question: SkillSurveyQuestion | undefined, value: SurveyAnswerValue | undefined) {
  if (!question || value === undefined) return undefined;
  if (question.type === 'SKILL') return survey.skillScale.find(level => level.value === value)?.label;
  return question.options?.find(option => option.code === value)?.label;
}

/** Rough "time left" estimate shown in the stage header (prototype v3). */
export function minutesLeftLabel(survey: SkillSurvey, fromStep: number, questions: QuestionMap, answers: SurveyAnswers) {
  let seconds = 35;
  for (let index = fromStep; index < survey.steps.length; index += 1) {
    for (const id of missingIds(survey, index, questions, answers)) seconds += questions[id]?.type === 'SKILL' ? 5 : 9;
  }
  return seconds < 60 ? 'Dưới 1 phút' : `Còn khoảng ${Math.round(seconds / 60)} phút`;
}
