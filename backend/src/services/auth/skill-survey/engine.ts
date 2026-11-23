import type {
  BottleneckCriterion,
  ChoiceGroup,
  ChoiceQuestion,
  GuardrailCode,
  SkillLevelRef,
  SkillSurveyDefinition,
  SkillSurveyResult,
  SkillSurveyScore,
  StrengthCriterion,
  SurveyAnswers,
  SurveyCriterion,
} from './types';

/**
 * Scoring engine for the registration skill survey (matrix §1.2, Auth Tech
 * Design "Registration skill survey"). Pure: (definition, answers) → score.
 * All arithmetic and band comparisons use unrounded values; scores are rounded
 * to 2 decimals only in the returned object. Answers must already be validated
 * against the definition (AUTH-30); malformed answers throw.
 */

const STRENGTH_ORDER: StrengthCriterion[] = ['K', 'R', 'P', 'X'];
const BOTTLENECK_ORDER: BottleneckCriterion[] = ['K', 'R', 'P'];
const STRENGTH_MIN_SCORE = 60;

export function roundScore(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function choiceQuestion(definition: SkillSurveyDefinition, group: ChoiceGroup): ChoiceQuestion {
  const question = definition.questions.find((q): q is ChoiceQuestion => q.type === 'CHOICE' && q.group === group);
  if (!question) throw new Error(`Survey definition has no ${group} question`);
  return question;
}

function chosenOption(question: ChoiceQuestion, answers: SurveyAnswers) {
  const option = question.options.find(o => o.code === answers[question.id]);
  if (!option) throw new Error(`Invalid answer for ${question.id}`);
  return option;
}

/** Rank (1-based) of the highest band whose minScore ≤ value. */
function bandRank(definition: SkillSurveyDefinition, value: number): number {
  let rank = 1;
  definition.bands.forEach((band, index) => {
    if (value >= band.minScore) rank = index + 1;
  });
  return rank;
}

function levelCodeAt(definition: SkillSurveyDefinition, rank: number): string {
  return definition.bands[rank - 1].levelCode;
}

function rankOfLevel(definition: SkillSurveyDefinition, code: string): number {
  const index = definition.bands.findIndex(band => band.levelCode === code);
  if (index < 0) throw new Error(`Unknown level code ${code}`);
  return index + 1;
}

function isHidden(definition: SkillSurveyDefinition, questionId: string, answers: SurveyAnswers): boolean {
  const question = definition.questions.find(q => q.id === questionId);
  const rule = question?.hiddenWhen;
  return Boolean(rule && answers[rule.questionId] === rule.optionCode);
}

export function scoreSkillSurvey(definition: SkillSurveyDefinition, answers: SurveyAnswers): SkillSurveyScore {
  const skillQuestions = definition.questions.filter(q => q.type === 'SKILL');
  const skillSum = skillQuestions.reduce((sum, q) => {
    const value = answers[q.id];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 3) {
      throw new Error(`Invalid answer for ${q.id}`);
    }
    return sum + value;
  }, 0);

  const yearsQuestion = choiceQuestion(definition, 'X_YEARS');
  const rallyQuestion = choiceQuestion(definition, 'R');
  const staminaQuestion = choiceQuestion(definition, 'P');
  const yearsOption = chosenOption(yearsQuestion, answers);
  const rallyOption = chosenOption(rallyQuestion, answers);
  const staminaOption = chosenOption(staminaQuestion, answers);

  const components: Record<SurveyCriterion, number> = {
    K: (skillSum / (3 * skillQuestions.length)) * 100,
    R: rallyOption.score,
    X: definition.experienceMix.years * yearsOption.score
      + definition.experienceMix.frequency * chosenOption(choiceQuestion(definition, 'X_FREQ'), answers).score,
    P: staminaOption.score,
    A: chosenOption(choiceQuestion(definition, 'A'), answers).score,
    T: chosenOption(choiceQuestion(definition, 'T'), answers).score,
  };

  const w = definition.weights;
  const rawScore = w.K * components.K + w.R * components.R + w.X * components.X
    + w.P * components.P + w.A * components.A + w.T * components.T;

  const returningQuestion = definition.questions.find(q => q.type === 'BOOLEAN' && q.group === 'RETURNING');
  const returning = Boolean(returningQuestion)
    && !isHidden(definition, returningQuestion!.id, answers)
    && answers[returningQuestion!.id] === true;
  const finalScore = returning ? Math.max(0, rawScore - definition.returningPenalty) : rawScore;

  const nominalRank = bandRank(definition, finalScore);

  // G1 — bottleneck: min(Band(K), Ref(R), Ref(P)) + 1; ties broken K, R, P.
  const terms: Record<BottleneckCriterion, number> = {
    K: bandRank(definition, components.K),
    R: rallyOption.bottleneckRef!,
    P: staminaOption.bottleneckRef!,
  };
  const minTerm = Math.min(terms.K, terms.R, terms.P);
  const g1Criterion = BOTTLENECK_ORDER.find(c => terms[c] === minTerm)!;
  const capG1 = minTerm + 1;

  // G2 — experience cap from the playing-time option.
  const capG2 = yearsOption.experienceCap ? rankOfLevel(definition, yearsOption.experienceCap) : definition.bands.length;

  const finalRank = Math.min(nominalRank, capG1, capG2);

  const guardrails: SkillSurveyScore['guardrails'] = [];
  if (capG1 < nominalRank) {
    guardrails.push({ code: 'G1_BOTTLENECK', capLevelCode: levelCodeAt(definition, capG1), criterion: g1Criterion });
  }
  if (capG2 < nominalRank) {
    guardrails.push({ code: 'G2_EXPERIENCE_CAP', capLevelCode: levelCodeAt(definition, capG2) });
  }

  const strengths = STRENGTH_ORDER
    .map((criterion, order) => ({ criterion, score: components[criterion], order }))
    .filter(item => item.score >= STRENGTH_MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 2)
    .map(item => ({ criterion: item.criterion, score: roundScore(item.score) }));

  const improveCriterion: BottleneckCriterion = capG1 < nominalRank
    ? g1Criterion
    : BOTTLENECK_ORDER
      .map((criterion, order) => ({ criterion, score: components[criterion], order }))
      .sort((a, b) => a.score - b.score || a.order - b.order)[0].criterion;

  const rounded = Object.fromEntries(
    Object.entries(components).map(([key, value]) => [key, roundScore(value)]),
  ) as Record<SurveyCriterion, number>;

  return {
    components: rounded,
    rawScore: roundScore(rawScore),
    finalScore: roundScore(finalScore),
    nominalSkillLevelCode: levelCodeAt(definition, nominalRank),
    skillLevelCode: levelCodeAt(definition, finalRank),
    appliedGuardrails: guardrails.map(g => g.code as GuardrailCode),
    guardrails,
    strengths,
    areaToImprove: { criterion: improveCriterion, score: rounded[improveCriterion] },
  };
}

/**
 * Maps level codes to `{ code, name, rank }` from `skill_levels` for the API.
 * `isSkillTentative` comes from `player_profiles.is_skill_tentative` (true at
 * registration; a future official promotion may clear it).
 */
export function toSkillSurveyResult(
  version: number,
  score: SkillSurveyScore,
  levels: SkillLevelRef[],
  isSkillTentative: boolean,
): SkillSurveyResult {
  const byCode = new Map(levels.map(level => [level.code, { code: level.code, name: level.name, rank: level.rank }]));
  const level = (code: string): SkillLevelRef => {
    const found = byCode.get(code);
    if (!found) throw new Error(`Unknown skill level ${code}`);
    return found;
  };
  return {
    version,
    nominalSkillLevel: level(score.nominalSkillLevelCode),
    skillLevel: level(score.skillLevelCode),
    isSkillTentative,
    finalScore: score.finalScore,
    components: score.components,
    appliedGuardrails: score.appliedGuardrails,
    guardrails: score.guardrails.map(g => ({
      code: g.code,
      cap: level(g.capLevelCode),
      ...(g.criterion ? { criterion: g.criterion } : {}),
    })),
    strengths: score.strengths,
    areaToImprove: score.areaToImprove,
  };
}
