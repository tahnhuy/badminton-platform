import { describe, expect, it } from 'vitest';
import {
  SKILL_SURVEY_DEFINITION_V1 as V1,
  scoreSkillSurvey,
  toSkillSurveyResult,
  validateSkillSurveyDefinition,
  type ChoiceQuestion,
  type SkillSurveyDefinition,
  type SurveyAnswers,
} from '../services/auth/skill-survey';
import { LEVEL_FIXTURES, PRD_EXAMPLES, skillAnswers } from '../services/auth/skill-survey/fixtures';

/** AUTH-29 — scoring engine and definition validator (matrix §1.2). Pure, no DB. */

const LEVEL_CODES = V1.bands.map(b => b.levelCode);
const clone = (): SkillSurveyDefinition => JSON.parse(JSON.stringify(V1));
const question = (def: SkillSurveyDefinition, id: string) => def.questions.find(q => q.id === id) as ChoiceQuestion;

/** Answers that put no cap below rank 7: all skills 3, top rally/stamina, 7+ years. */
const uncapped: SurveyAnswers = {
  yearsPlaying: '7Y_PLUS', frequencyPerWeek: 'FOUR_PLUS', coaching: 'TALENT_TEAM', returningAfterBreak: false,
  ...skillAnswers([3, 3, 3, 3, 3, 3, 3, 3, 3]),
  rallyConsistency: '20_PLUS_ATTACKING', stamina: 'MULTIPLE_MATCHES', tournamentAchievement: 'NATIONAL_OR_PRO',
};

/** Definition where S equals the achievement score, so bands can be probed directly. */
function achievementOnly(scores: number[]): SkillSurveyDefinition {
  const def = clone();
  def.weights = { K: 0, R: 0, X: 0, P: 0, A: 1, T: 0 };
  question(def, 'tournamentAchievement').options = scores.map((score, i) => ({ code: `S${i}`, label: String(score), score }));
  return def;
}

describe('scoreSkillSurvey — PRD acceptance examples (version 1)', () => {
  for (const [n, fixture] of Object.entries(PRD_EXAMPLES)) {
    it(`example #${n}: S = ${fixture.expected.finalScore}, ${fixture.expected.level}, guardrails [${fixture.expected.guardrails}]`, () => {
      const score = scoreSkillSurvey(V1, fixture.answers);
      expect(score.finalScore).toBe(fixture.expected.finalScore);
      expect(score.skillLevelCode).toBe(fixture.expected.level);
      expect(score.appliedGuardrails).toEqual(fixture.expected.guardrails);
    });
  }

  it('example #2 names R (rally consistency) as the G1 criterion and the area to improve', () => {
    const score = scoreSkillSurvey(V1, PRD_EXAMPLES[2].answers);
    expect(score.nominalSkillLevelCode).toBe('AVERAGE');
    expect(score.guardrails).toEqual([{ code: 'G1_BOTTLENECK', capLevelCode: 'AVERAGE_MINUS', criterion: 'R' }]);
    expect(score.areaToImprove).toEqual({ criterion: 'R', score: 20 });
    expect(score.strengths).toEqual([{ criterion: 'K', score: 100 }, { criterion: 'X', score: 62 }]);
  });

  it('example #3: G1 cap equals the nominal band, so only G2 is recorded', () => {
    const score = scoreSkillSurvey(V1, PRD_EXAMPLES[3].answers);
    expect(score.nominalSkillLevelCode).toBe('AVERAGE');
    expect(score.guardrails).toEqual([{ code: 'G2_EXPERIENCE_CAP', capLevelCode: 'AVERAGE_MINUS' }]);
  });

  it('example #6 subtracts the returning penalty from the raw score', () => {
    const score = scoreSkillSurvey(V1, PRD_EXAMPLES[6].answers);
    expect(score.rawScore).toBe(81.96);
    expect(score.finalScore).toBe(66.96);
  });

  it('level fixtures cover all seven levels', () => {
    expect(Object.keys(LEVEL_FIXTURES)).toEqual(LEVEL_CODES);
    for (const [level, fixture] of Object.entries(LEVEL_FIXTURES)) {
      const score = scoreSkillSurvey(V1, fixture.answers);
      expect(score.skillLevelCode).toBe(level);
      expect(score.finalScore).toBe(fixture.expected.finalScore);
    }
  });
});

describe('scoreSkillSurvey — bands, penalty, precision', () => {
  it('compares each band boundary on unrounded values (just below → lower band, at → band)', () => {
    const boundaries = [15, 30, 45, 60, 70, 80];
    const scores = [0, ...boundaries.flatMap(b => [b - 0.001, b])];
    const def = achievementOnly(scores);
    const opts = question(def, 'tournamentAchievement').options;
    expect(scoreSkillSurvey(def, { ...uncapped, tournamentAchievement: opts[0].code }).skillLevelCode).toBe('BEGINNER');
    boundaries.forEach((_, i) => {
      const below = scoreSkillSurvey(def, { ...uncapped, tournamentAchievement: opts[1 + 2 * i].code });
      const at = scoreSkillSurvey(def, { ...uncapped, tournamentAchievement: opts[2 + 2 * i].code });
      expect(below.skillLevelCode).toBe(LEVEL_CODES[i]);
      expect(below.finalScore).toBe(boundaries[i]); // rounds to the boundary but stays in the lower band
      expect(at.skillLevelCode).toBe(LEVEL_CODES[i + 1]);
    });
  });

  it('floors the returning penalty at 0', () => {
    const answers: SurveyAnswers = {
      ...LEVEL_FIXTURES.BEGINNER.answers, yearsPlaying: '1Y_TO_2Y', returningAfterBreak: true,
    };
    const score = scoreSkillSurvey(V1, answers);
    expect(score.rawScore).toBe(4.2);
    expect(score.finalScore).toBe(0);
    expect(score.skillLevelCode).toBe('BEGINNER');
  });

  it('ignores the returning answer while the question is hidden (less than 6 months)', () => {
    const hidden = { ...PRD_EXAMPLES[3].answers, returningAfterBreak: true };
    expect(scoreSkillSurvey(V1, hidden).finalScore).toBe(PRD_EXAMPLES[3].expected.finalScore);
  });

  it('precision boundary: S = 15.00 exactly is WEAK (G1 cap 2 not applied)', () => {
    const answers: SurveyAnswers = {
      yearsPlaying: '7Y_PLUS', frequencyPerWeek: 'ONE', coaching: 'NONE', returningAfterBreak: true,
      ...skillAnswers([0, 0, 0, 0, 0, 0, 0, 0, 0]),
      rallyConsistency: '10_TO_14', stamina: 'UNDER_20M', tournamentAchievement: 'NATIONAL_OR_PRO',
    };
    const score = scoreSkillSurvey(V1, answers);
    expect(score.finalScore).toBe(15);
    expect(score.skillLevelCode).toBe('WEAK');
    expect(score.appliedGuardrails).toEqual([]);
  });

  it('pre-rounded option scores would break the boundary (why scores are stored at full precision)', () => {
    expect(question(V1, 'frequencyPerWeek').options[1].score).toBe(100 / 3);
    expect(question(V1, 'frequencyPerWeek').options[2].score).toBe(200 / 3);
  });
});

describe('scoreSkillSurvey — guardrails', () => {
  const nominal7 = achievementOnly([0, 100]);
  const top = question(nominal7, 'tournamentAchievement').options[1].code;

  it('G1 caps at Ref(R) + 1 for every rally consistency option', () => {
    for (const option of question(V1, 'rallyConsistency').options) {
      const score = scoreSkillSurvey(nominal7, { ...uncapped, tournamentAchievement: top, rallyConsistency: option.code });
      const capRank = option.bottleneckRef! + 1;
      expect(score.skillLevelCode).toBe(LEVEL_CODES[Math.min(capRank, 7) - 1]);
      expect(score.appliedGuardrails).toEqual(capRank < 7 ? ['G1_BOTTLENECK'] : []);
      if (capRank < 7) expect(score.guardrails[0].criterion).toBe('R');
    }
  });

  it('G1 caps at Ref(P) + 1 for every stamina option', () => {
    for (const option of question(V1, 'stamina').options) {
      const score = scoreSkillSurvey(nominal7, { ...uncapped, tournamentAchievement: top, stamina: option.code });
      const capRank = option.bottleneckRef! + 1;
      expect(score.skillLevelCode).toBe(LEVEL_CODES[Math.min(capRank, 7) - 1]);
      expect(score.appliedGuardrails).toEqual(capRank < 7 ? ['G1_BOTTLENECK'] : []);
      if (capRank < 7) expect(score.guardrails[0]).toMatchObject({ code: 'G1_BOTTLENECK', criterion: 'P' });
    }
  });

  it('G1 uses Band(K) and breaks ties in the order K, R, P', () => {
    // All skills 1 → K = 33.33 → Band 3; rally 10–14 → Ref 3; stamina 1 hour → Ref 4. Tie K/R → K.
    const answers = { ...uncapped, tournamentAchievement: top, ...skillAnswers([1, 1, 1, 1, 1, 1, 1, 1, 1]), rallyConsistency: '10_TO_14', stamina: 'ONE_HOUR_FADES_GAME_3' };
    const score = scoreSkillSurvey(nominal7, answers);
    expect(score.guardrails).toEqual([{ code: 'G1_BOTTLENECK', capLevelCode: 'AVERAGE', criterion: 'K' }]);
    expect(score.areaToImprove.criterion).toBe('K');
  });

  it('G1 breaks an R/P tie in favour of R', () => {
    // Rally 5–9 → Ref 2; stamina under 20 minutes → Ref 2; K band 7.
    const score = scoreSkillSurvey(nominal7, { ...uncapped, tournamentAchievement: top, rallyConsistency: '5_TO_9', stamina: 'UNDER_20M' });
    expect(score.guardrails).toEqual([{ code: 'G1_BOTTLENECK', capLevelCode: 'AVERAGE_MINUS', criterion: 'R' }]);
  });

  it('does not record G2 when its cap equals the nominal band', () => {
    // 6 months – 1 year caps at AVERAGE (rank 4); S in [45, 60) is already AVERAGE.
    const def = achievementOnly([0, 50]);
    const option = question(def, 'tournamentAchievement').options[1].code;
    const score = scoreSkillSurvey(def, { ...uncapped, tournamentAchievement: option, yearsPlaying: '6M_TO_1Y' });
    expect(score.skillLevelCode).toBe('AVERAGE');
    expect(score.appliedGuardrails).toEqual([]);
  });

  it('G2 caps less than 6 months at AVERAGE_MINUS and 6 months – 1 year at AVERAGE', () => {
    const lt6 = scoreSkillSurvey(nominal7, { ...uncapped, tournamentAchievement: top, yearsPlaying: 'LESS_THAN_6M' });
    expect(lt6.skillLevelCode).toBe('AVERAGE_MINUS');
    expect(lt6.guardrails).toEqual([{ code: 'G2_EXPERIENCE_CAP', capLevelCode: 'AVERAGE_MINUS' }]);
    const lt1y = scoreSkillSurvey(nominal7, { ...uncapped, tournamentAchievement: top, yearsPlaying: '6M_TO_1Y' });
    expect(lt1y.skillLevelCode).toBe('AVERAGE');
    expect(lt1y.appliedGuardrails).toEqual(['G2_EXPERIENCE_CAP']);
  });

  it('records both guardrails when both caps are below the nominal band', () => {
    const score = scoreSkillSurvey(nominal7, { ...uncapped, tournamentAchievement: top, yearsPlaying: 'LESS_THAN_6M', rallyConsistency: 'LESS_THAN_5' });
    expect(score.skillLevelCode).toBe('WEAK');
    expect(score.appliedGuardrails).toEqual(['G1_BOTTLENECK', 'G2_EXPERIENCE_CAP']);
  });
});

describe('scoreSkillSurvey — strengths and area to improve', () => {
  it('returns no strengths when no criterion reaches 60', () => {
    expect(scoreSkillSurvey(V1, LEVEL_FIXTURES.WEAK.answers).strengths).toEqual([]);
  });

  it('keeps at most two strengths, highest first, ties in the order K, R, P, X', () => {
    const score = scoreSkillSurvey(V1, uncapped);
    expect(score.strengths).toEqual([{ criterion: 'K', score: 100 }, { criterion: 'R', score: 100 }]);
  });

  it('without G1, a K/R/P tie for the lowest score picks K first', () => {
    // K = R = P = 100, no guardrail (uncapped answers).
    expect(scoreSkillSurvey(V1, uncapped).areaToImprove).toEqual({ criterion: 'K', score: 100 });
  });

  it('without G1, the area to improve is the lowest of K, R, P', () => {
    expect(scoreSkillSurvey(V1, PRD_EXAMPLES[1].answers).areaToImprove).toEqual({ criterion: 'K', score: 59.26 });
  });
});

describe('toSkillSurveyResult', () => {
  it('maps level codes to catalog entries and keeps the API shape', () => {
    const levels = LEVEL_CODES.map((code, i) => ({ code, name: `Level ${i + 1}`, rank: i + 1 }));
    const result = toSkillSurveyResult(1, scoreSkillSurvey(V1, PRD_EXAMPLES[2].answers), levels, true);
    expect(result).toMatchObject({
      version: 1,
      nominalSkillLevel: { code: 'AVERAGE', rank: 4 },
      skillLevel: { code: 'AVERAGE_MINUS', name: 'Level 3', rank: 3 },
      isSkillTentative: true,
      finalScore: 55.8,
      appliedGuardrails: ['G1_BOTTLENECK'],
      guardrails: [{ code: 'G1_BOTTLENECK', cap: { code: 'AVERAGE_MINUS', rank: 3 }, criterion: 'R' }],
      areaToImprove: { criterion: 'R', score: 20 },
    });
    expect(Object.keys(result.components)).toEqual(['K', 'R', 'X', 'P', 'A', 'T']);
  });

  it('passes the profile tentative flag through', () => {
    const levels = LEVEL_CODES.map((code, i) => ({ code, name: code, rank: i + 1 }));
    expect(toSkillSurveyResult(1, scoreSkillSurvey(V1, PRD_EXAMPLES[1].answers), levels, false).isSkillTentative).toBe(false);
  });
});

describe('validateSkillSurveyDefinition', () => {
  it('accepts version 1', () => {
    expect(validateSkillSurveyDefinition(V1, LEVEL_CODES)).toEqual([]);
  });

  const violations: Array<[string, (def: SkillSurveyDefinition) => void, RegExp, string[]?]> = [
    ['weights missing a criterion', def => { delete (def.weights as Partial<typeof def.weights>).T; }, /weights must cover/],
    ['weights not summing to 1', def => { def.weights.K = 0.5; }, /sum to 1/],
    ['experienceMix not summing to 1', def => { def.experienceMix.years = 0.8; }, /experienceMix/],
    ['negative returning penalty', def => { def.returningPenalty = -1; }, /returningPenalty/],
    ['bands not starting at 0', def => { def.bands[0].minScore = 5; }, /start at 0/],
    ['bands not increasing', def => { def.bands[3].minScore = 30; }, /strictly increase/],
    ['bands missing a level', def => { def.bands.pop(); }, /every skill level code/],
    ['bands out of rank order', def => { [def.bands[5].levelCode, def.bands[6].levelCode] = [def.bands[6].levelCode, def.bands[5].levelCode]; }, /rank order/],
    ['CHOICE with one option', def => { question(def, 'coaching').options.splice(1); }, /at least two options/],
    ['option score above 100', def => { question(def, 'coaching').options[4].score = 120; }, /within 0-100/],
    ['option scores not increasing', def => { question(def, 'coaching').options[2].score = 10; }, /strictly increase/],
    ['bottleneckRef out of range', def => { question(def, 'rallyConsistency').options[5].bottleneckRef = 7; }, /bottleneckRef/],
    ['missing bottleneckRef on P', def => { delete question(def, 'stamina').options[0].bottleneckRef; }, /bottleneckRef/],
    ['invalid experienceCap', def => { question(def, 'yearsPlaying').options[0].experienceCap = 'PRO'; }, /experienceCap/],
    ['missing group', def => { def.questions = def.questions.filter(q => q.id !== 'coaching'); def.steps[0].questionIds = def.steps[0].questionIds.filter(id => id !== 'coaching'); }, /group T/],
    ['no SKILL question', def => { const ids = def.questions.filter(q => q.type === 'SKILL').map(q => q.id); def.questions = def.questions.filter(q => q.type !== 'SKILL'); def.steps[1].questionIds = def.steps[1].questionIds.filter(id => !ids.includes(id)); }, /at least one SKILL/],
    ['duplicate question id', def => { def.questions.push({ ...def.questions[4] }); }, /unique/],
    ['step with unknown question', def => { def.steps[3].questionIds.push('ghost'); }, /unknown question ghost/],
    ['question in no step', def => { def.steps[3].questionIds = []; }, /exactly one step/],
    ['question in two steps', def => { def.steps[3].questionIds.push('stamina'); }, /exactly one step/],
    ['non-integer bottleneckRef', def => { question(def, 'rallyConsistency').options[2].bottleneckRef = 2.5; }, /bottleneckRef/],
    ['hiddenWhen to a missing question', def => { def.questions.find(q => q.id === 'returningAfterBreak')!.hiddenWhen = { questionId: 'ghost', optionCode: 'LESS_THAN_6M' }; }, /hiddenWhen/],
    ['hiddenWhen to a missing option', def => { def.questions.find(q => q.id === 'returningAfterBreak')!.hiddenWhen = { questionId: 'yearsPlaying', optionCode: 'NOPE' }; }, /hiddenWhen/],
  ];

  for (const [name, mutate, message] of violations) {
    it(`rejects ${name}`, () => {
      const def = clone();
      mutate(def);
      expect(validateSkillSurveyDefinition(def, LEVEL_CODES).join('\n')).toMatch(message);
    });
  }
});
