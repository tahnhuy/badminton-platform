import type { ChoiceGroup, SkillSurveyDefinition, SurveyCriterion } from './types';

/**
 * Definition validation (Auth Tech Design "Definition validation"). Run by a
 * test on version 1 and before any future version becomes ACTIVE. Returns the
 * list of violations; an empty list means the definition is valid.
 */

const CRITERIA: SurveyCriterion[] = ['K', 'R', 'X', 'P', 'A', 'T'];
const CHOICE_GROUPS: ChoiceGroup[] = ['R', 'X_YEARS', 'X_FREQ', 'P', 'A', 'T'];
const EPSILON = 1e-9;

export function validateSkillSurveyDefinition(
  definition: SkillSurveyDefinition,
  levelCodesInRankOrder: string[],
): string[] {
  const errors: string[] = [];
  const levelCount = levelCodesInRankOrder.length;

  // Weights, experience mix, penalty.
  const weightKeys = Object.keys(definition.weights ?? {});
  if (weightKeys.length !== CRITERIA.length || !CRITERIA.every(c => weightKeys.includes(c))) {
    errors.push('weights must cover exactly K, R, X, P, A, T');
  } else {
    const sum = CRITERIA.reduce((total, c) => total + definition.weights[c], 0);
    if (Math.abs(sum - 1) > EPSILON) errors.push('weights must sum to 1');
    if (CRITERIA.some(c => !(definition.weights[c] >= 0))) errors.push('weights must be non-negative');
  }
  const mix = definition.experienceMix;
  if (!mix || Math.abs(mix.years + mix.frequency - 1) > EPSILON) errors.push('experienceMix must sum to 1');
  if (!(definition.returningPenalty >= 0)) errors.push('returningPenalty must be >= 0');

  // Bands.
  const bands = definition.bands ?? [];
  if (bands.length === 0 || bands[0].minScore !== 0) errors.push('bands must start at 0');
  for (let i = 1; i < bands.length; i += 1) {
    if (!(bands[i].minScore > bands[i - 1].minScore)) errors.push('bands must strictly increase');
  }
  const bandCodes = bands.map(b => b.levelCode);
  if (bandCodes.length !== levelCount || bandCodes.some((code, i) => code !== levelCodesInRankOrder[i])) {
    errors.push('bands must list every skill level code exactly once in rank order');
  }

  // Questions.
  const questions = definition.questions ?? [];
  const ids = questions.map(q => q.id);
  if (new Set(ids).size !== ids.length) errors.push('question ids must be unique');

  for (const q of questions) {
    if (q.type === 'CHOICE') {
      if (q.options.length < 2) errors.push(`${q.id}: CHOICE question needs at least two options`);
      q.options.forEach((option, i) => {
        if (!(option.score >= 0 && option.score <= 100)) errors.push(`${q.id}.${option.code}: score must be within 0-100`);
        if (i > 0 && !(option.score > q.options[i - 1].score)) errors.push(`${q.id}: option scores must strictly increase`);
        if (q.group === 'R' || q.group === 'P') {
          const ref = option.bottleneckRef;
          if (!Number.isInteger(ref) || ref! < 1 || ref! > levelCount - 1) {
            errors.push(`${q.id}.${option.code}: bottleneckRef must be an integer from 1 to ${levelCount - 1}`);
          }
        }
        if (option.experienceCap !== undefined && !levelCodesInRankOrder.includes(option.experienceCap)) {
          errors.push(`${q.id}.${option.code}: experienceCap must be a valid level code`);
        }
      });
      if (new Set(q.options.map(o => o.code)).size !== q.options.length) errors.push(`${q.id}: option codes must be unique`);
    }
    if (q.hiddenWhen) {
      const target = questions.find(other => other.id === q.hiddenWhen!.questionId);
      const hasOption = target?.type === 'CHOICE' && target.options.some(o => o.code === q.hiddenWhen!.optionCode);
      if (!hasOption) errors.push(`${q.id}: hiddenWhen must reference an existing question and option`);
    }
  }

  // Groups: the engine reads exactly one CHOICE question per non-K group.
  for (const group of CHOICE_GROUPS) {
    const count = questions.filter(q => q.type === 'CHOICE' && q.group === group).length;
    if (count !== 1) errors.push(`group ${group} must have exactly one CHOICE question`);
  }
  if (!questions.some(q => q.type === 'SKILL')) errors.push('group K must have at least one SKILL question');
  if (questions.filter(q => q.type === 'BOOLEAN').length > 1) errors.push('at most one BOOLEAN (returning) question');
  const scale = (definition.skillScale ?? []).map(s => s.value);
  if (scale.join(',') !== '0,1,2,3') errors.push('skillScale must list values 0-3 in order');

  // Steps.
  const stepIds = (definition.steps ?? []).flatMap(step => step.questionIds);
  for (const id of stepIds) {
    if (!ids.includes(id)) errors.push(`step references unknown question ${id}`);
  }
  for (const id of ids) {
    const count = stepIds.filter(stepId => stepId === id).length;
    if (count !== 1) errors.push(`question ${id} must appear in exactly one step`);
  }

  return errors;
}
