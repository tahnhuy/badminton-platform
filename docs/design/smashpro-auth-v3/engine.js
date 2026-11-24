/*
 * Scoring engine for the prototype — mirrors the server algorithm planned for
 * AUTH-29/30 (matrix §1.2, Auth Tech Design "Server-computed presentation data").
 * Pure function: (survey, scoring, levels, answers) → result. No rounding until
 * the returned values; band comparisons use unrounded scores.
 */
(function (root) {
  const ORDER_STRENGTH = ['K', 'R', 'P', 'X'];
  const ORDER_BOTTLENECK = ['K', 'R', 'P'];

  function optionScore(question, code) {
    const index = question.options.findIndex(option => option.code === code);
    if (index < 0) throw new Error(`Unknown option ${code}`);
    return (index / (question.options.length - 1)) * 100;
  }

  function optionIndex(question, code) {
    return question.options.findIndex(option => option.code === code);
  }

  function band(score, bands) {
    let rank = 1;
    bands.forEach((min, index) => { if (score >= min) rank = index + 1; });
    return rank;
  }

  const round2 = value => Math.round(value * 100) / 100;

  function score(survey, scoring, levels, answers) {
    const q = survey.questions;
    const skillIds = Object.keys(q).filter(id => q[id].type === 'SKILL');
    const K = (skillIds.reduce((sum, id) => sum + answers[id], 0) / (3 * skillIds.length)) * 100;
    const R = optionScore(q.rallyConsistency, answers.rallyConsistency);
    const P = optionScore(q.stamina, answers.stamina);
    const A = optionScore(q.tournamentAchievement, answers.tournamentAchievement);
    const T = optionScore(q.coaching, answers.coaching);
    const X = scoring.experienceMix.years * optionScore(q.yearsPlaying, answers.yearsPlaying)
      + scoring.experienceMix.frequency * optionScore(q.frequencyPerWeek, answers.frequencyPerWeek);
    const components = { K, R, X, P, A, T };
    const w = scoring.weights;
    const raw = w.K * K + w.R * R + w.X * X + w.P * P + w.A * A + w.T * T;
    const returning = answers.yearsPlaying !== 'LESS_THAN_6M' && answers.returningAfterBreak === true;
    const final = returning ? Math.max(0, raw - scoring.returningPenalty) : raw;
    const nominal = band(final, scoring.bands);

    const terms = {
      K: band(K, scoring.bands),
      R: scoring.rallyRef[optionIndex(q.rallyConsistency, answers.rallyConsistency)],
      P: scoring.staminaRef[optionIndex(q.stamina, answers.stamina)],
    };
    const minTerm = Math.min(terms.K, terms.R, terms.P);
    const g1Criterion = ORDER_BOTTLENECK.find(key => terms[key] === minTerm);
    const capG1 = minTerm + 1;
    const capG2 = scoring.experienceCap[answers.yearsPlaying] ?? levels.length;
    const finalRank = Math.min(nominal, capG1, capG2);

    const guardrails = [];
    if (capG1 < nominal) guardrails.push({ code: 'G1_BOTTLENECK', cap: levels[capG1 - 1], criterion: g1Criterion });
    if (capG2 < nominal) guardrails.push({ code: 'G2_EXPERIENCE_CAP', cap: levels[capG2 - 1] });

    const strengths = ORDER_STRENGTH
      .map((criterion, order) => ({ criterion, score: components[criterion], order }))
      .filter(item => item.score >= 60)
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .slice(0, 2)
      .map(item => ({ criterion: item.criterion, score: round2(item.score) }));

    const g1 = guardrails.find(item => item.code === 'G1_BOTTLENECK');
    const improveKey = g1 ? g1.criterion : ORDER_BOTTLENECK
      .map((criterion, order) => ({ criterion, score: components[criterion], order }))
      .sort((a, b) => a.score - b.score || a.order - b.order)[0].criterion;

    const rounded = Object.fromEntries(Object.entries(components).map(([key, value]) => [key, round2(value)]));
    return {
      version: survey.version,
      nominalSkillLevel: levels[nominal - 1],
      skillLevel: levels[finalRank - 1],
      isSkillTentative: true,
      rawScore: round2(raw),
      finalScore: round2(final),
      components: rounded,
      appliedGuardrails: guardrails.map(item => item.code),
      guardrails,
      strengths,
      areaToImprove: { criterion: improveKey, score: rounded[improveKey] },
    };
  }

  const api = { score };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SmashProEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
