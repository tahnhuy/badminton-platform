/* PRD acceptance examples #1–#6, used by the prototype "Điền ví dụ" menu and the engine check. */
(function (root) {
  const skills = values => Object.fromEntries(['service', 'clear', 'smash', 'netPlay', 'defense', 'drive', 'backhand', 'footwork', 'doublesPlay']
    .map((id, index) => [`skill.${id}`, values[index]]));
  const strong = { yearsPlaying: '4Y_TO_7Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'NONE', returningAfterBreak: false, ...skills([3, 3, 3, 3, 3, 3, 2, 2, 2]), rallyConsistency: '20_PLUS_ATTACKING', stamina: 'MULTIPLE_MATCHES', tournamentAchievement: 'NONE' };
  const EXAMPLES = [
    { id: 1, label: 'Ví dụ 1 · Trung bình', expect: { score: 56.25, code: 'AVERAGE', guardrails: [] }, answers: { yearsPlaying: '2Y_TO_4Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'SELF_TAUGHT', returningAfterBreak: false, ...skills([2, 2, 2, 2, 2, 2, 1, 1, 2]), rallyConsistency: '15_TO_19', stamina: 'THREE_GAMES', tournamentAchievement: 'INTERNAL' } },
    { id: 2, label: 'Ví dụ 2 · chặn G1', expect: { score: 55.8, code: 'AVERAGE_MINUS', guardrails: ['G1_BOTTLENECK'] }, answers: { yearsPlaying: '2Y_TO_4Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'NONE', returningAfterBreak: false, ...skills([3, 3, 3, 3, 3, 3, 3, 3, 3]), rallyConsistency: '5_TO_9', stamina: '20_TO_40M', tournamentAchievement: 'NONE' } },
    { id: 3, label: 'Ví dụ 3 · chặn G2', expect: { score: 46.67, code: 'AVERAGE_MINUS', guardrails: ['G2_EXPERIENCE_CAP'] }, answers: { yearsPlaying: 'LESS_THAN_6M', frequencyPerWeek: 'FOUR_PLUS', coaching: 'COACH_LESS_THAN_6M', ...skills([2, 2, 2, 2, 2, 2, 2, 2, 2]), rallyConsistency: '10_TO_14', stamina: 'ONE_HOUR_FADES_GAME_3', tournamentAchievement: 'NONE' } },
    { id: 4, label: 'Ví dụ 4 · Khá', expect: { score: 76.96, code: 'GOOD', guardrails: [] }, answers: { ...strong } },
    { id: 5, label: 'Ví dụ 5 · Giỏi', expect: { score: 81.96, code: 'EXCELLENT', guardrails: [] }, answers: { ...strong, tournamentAchievement: 'DISTRICT_OR_STUDENT' } },
    { id: 6, label: 'Ví dụ 6 · quay lại sau nghỉ', expect: { score: 66.96, code: 'AVERAGE_PLUS', guardrails: [] }, answers: { ...strong, tournamentAchievement: 'DISTRICT_OR_STUDENT', returningAfterBreak: true } },
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = { EXAMPLES };
  else root.SmashProExamples = { EXAMPLES };
})(typeof window !== 'undefined' ? window : globalThis);
