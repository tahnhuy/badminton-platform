import type { SkillSurveyDefinition, SurveyQuestion } from './types';

/**
 * Answer validation and the public survey view (Auth Tech Design "Validation
 * and errors", API table). Pure functions over a stored definition.
 */

const MAX_UNKNOWN_KEYS = 5;

export interface AnswerFieldError {
  field: string;
  code: 'VALIDATION_FAILED';
}

export function isQuestionHidden(question: SurveyQuestion, answers: Record<string, unknown>): boolean {
  const rule = question.hiddenWhen;
  return Boolean(rule && answers[rule.questionId] === rule.optionCode);
}

/**
 * Every visible question answered with a valid value; a hidden question is
 * absent (or `false` for a BOOLEAN); no unknown keys. Errors use the question id
 * as `field`, in definition order, unknown keys last.
 */
export function validateSurveyAnswers(
  definition: SkillSurveyDefinition,
  answers: Record<string, unknown>,
): AnswerFieldError[] {
  const errors: AnswerFieldError[] = [];
  const fail = (field: string) => errors.push({ field, code: 'VALIDATION_FAILED' });
  const scale = definition.skillScale.map(s => s.value);

  for (const question of definition.questions) {
    const has = Object.prototype.hasOwnProperty.call(answers, question.id);
    const value = answers[question.id];

    if (isQuestionHidden(question, answers)) {
      if (has && !(question.type === 'BOOLEAN' && value === false)) fail(question.id);
      continue;
    }
    if (!has) {
      fail(question.id);
      continue;
    }
    switch (question.type) {
      case 'CHOICE':
        if (typeof value !== 'string' || !question.options.some(o => o.code === value)) fail(question.id);
        break;
      case 'SKILL':
        if (typeof value !== 'number' || !Number.isInteger(value) || !scale.includes(value)) fail(question.id);
        break;
      case 'BOOLEAN':
        if (typeof value !== 'boolean') fail(question.id);
        break;
    }
  }

  // Unknown keys: report at most MAX_UNKNOWN_KEYS so one request cannot produce
  // thousands of error entries.
  const known = new Set(definition.questions.map(q => q.id));
  const unknown = Object.keys(answers).filter(key => !known.has(key));
  unknown.slice(0, MAX_UNKNOWN_KEYS).forEach(fail);
  return errors;
}

export interface PublicSkillSurvey {
  version: number;
  steps: Array<{ title: string; questionIds: string[] }>;
  skillScale: Array<{ value: number; label: string }>;
  questions: Array<{
    id: string;
    type: SurveyQuestion['type'];
    text: string;
    description?: string;
    options?: Array<{ code: string | boolean; label: string }>;
    hiddenWhen?: { questionId: string; optionCode: string };
  }>;
}

/** GET /auth/skill-survey view: no scores, weights, bands, bottleneckRef, experienceCap or groups. */
export function toPublicSkillSurvey(version: number, definition: SkillSurveyDefinition): PublicSkillSurvey {
  return {
    version,
    steps: definition.steps.map(step => ({ title: step.title, questionIds: [...step.questionIds] })),
    skillScale: definition.skillScale.map(s => ({ value: s.value, label: s.label })),
    questions: definition.questions.map(q => ({
      id: q.id,
      type: q.type,
      text: q.text,
      ...(q.description ? { description: q.description } : {}),
      ...(q.type === 'CHOICE' || q.type === 'BOOLEAN'
        ? { options: q.options.map(o => ({ code: o.code, label: o.label })) }
        : {}),
      ...(q.hiddenWhen ? { hiddenWhen: { questionId: q.hiddenWhen.questionId, optionCode: q.hiddenWhen.optionCode } } : {}),
    })),
  };
}
