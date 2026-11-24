/**
 * Registration skill survey types (Auth Tech Design "Registration skill survey",
 * matrix §1.2). The definition is stored per version in
 * `skill_survey_versions.definition`; parameters are data, calculation is code.
 */

/** Score criteria. `X_YEARS` and `X_FREQ` are combined into `X` by `experienceMix`. */
export type SurveyCriterion = 'K' | 'R' | 'X' | 'P' | 'A' | 'T';
export type ChoiceGroup = 'R' | 'X_YEARS' | 'X_FREQ' | 'P' | 'A' | 'T';

export interface ChoiceOption {
  code: string;
  label: string;
  /** 0–100, full double precision (never pre-rounded). */
  score: number;
  /** G1 reference rank; only on options of the R and P questions. */
  bottleneckRef?: number;
  /** G2 cap level code; only on options of the X_YEARS question. */
  experienceCap?: string;
}

export interface HiddenWhen {
  questionId: string;
  optionCode: string;
}

interface QuestionBase {
  id: string;
  text: string;
  description?: string;
  hiddenWhen?: HiddenWhen;
}

export interface ChoiceQuestion extends QuestionBase {
  type: 'CHOICE';
  group: ChoiceGroup;
  options: ChoiceOption[];
}

export interface SkillQuestion extends QuestionBase {
  type: 'SKILL';
  group: 'K';
}

export interface BooleanQuestion extends QuestionBase {
  type: 'BOOLEAN';
  /** `true` applies `returningPenalty`. */
  group: 'RETURNING';
  options: Array<{ code: boolean; label: string }>;
}

export type SurveyQuestion = ChoiceQuestion | SkillQuestion | BooleanQuestion;

export interface SkillSurveyDefinition {
  steps: Array<{ title: string; questionIds: string[] }>;
  skillScale: Array<{ value: number; label: string }>;
  questions: SurveyQuestion[];
  weights: Record<SurveyCriterion, number>;
  experienceMix: { years: number; frequency: number };
  returningPenalty: number;
  /** One band per skill level, in rank order (rank = position + 1). */
  bands: Array<{ levelCode: string; minScore: number }>;
}

export type SurveyAnswerValue = string | number | boolean;
export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export type GuardrailCode = 'G1_BOTTLENECK' | 'G2_EXPERIENCE_CAP';
export type BottleneckCriterion = 'K' | 'R' | 'P';
export type StrengthCriterion = 'K' | 'R' | 'P' | 'X';

/** Engine output: level codes only, every score rounded to 2 decimals. */
export interface SkillSurveyScore {
  components: Record<SurveyCriterion, number>;
  rawScore: number;
  finalScore: number;
  nominalSkillLevelCode: string;
  skillLevelCode: string;
  appliedGuardrails: GuardrailCode[];
  guardrails: Array<{ code: GuardrailCode; capLevelCode: string; criterion?: BottleneckCriterion }>;
  strengths: Array<{ criterion: StrengthCriterion; score: number }>;
  areaToImprove: { criterion: BottleneckCriterion; score: number };
}

export interface SkillLevelRef {
  code: string;
  name: string;
  rank: number;
}

/** API shape (`meta.skillSurveyResult`, `GET /players/me/skill-survey`). */
export interface SkillSurveyResult {
  version: number;
  nominalSkillLevel: SkillLevelRef;
  skillLevel: SkillLevelRef;
  isSkillTentative: boolean;
  finalScore: number;
  components: Record<SurveyCriterion, number>;
  appliedGuardrails: GuardrailCode[];
  guardrails: Array<{ code: GuardrailCode; cap: SkillLevelRef; criterion?: BottleneckCriterion }>;
  strengths: Array<{ criterion: StrengthCriterion; score: number }>;
  areaToImprove: { criterion: BottleneckCriterion; score: number };
}
