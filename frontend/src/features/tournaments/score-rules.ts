/**
 * Set-score rules — same table as `backend/src/services/tournaments/result/score.ts`
 * (Tournament Tech Design §7.5): best of 3, 21 points, 2-point lead, cap 30.
 */

export function isFinishedSet(a: number, b: number): boolean {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (a === b) return false;
  return (w === 21 && l <= 19) || (w >= 22 && w <= 30 && l === w - 2) || (w === 30 && l === 29);
}

export function isInProgressSet(a: number, b: number): boolean {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w > 29) return false;
  if (w < 21) return true;
  return w - l < 2 && l >= 20;
}

export interface SetDraft { a: string; b: string }

export interface SetEvaluation {
  winner: 1 | 2 | null;
  wins: [number, number];
  problems: Record<number, string>;
  filledSets: Array<{ team1Score: number; team2Score: number }>;
}

/** Live evaluation of the score form; `retired` allows an unfinished last set. */
export function evaluateSets(sets: SetDraft[], retired = false): SetEvaluation {
  const wins: [number, number] = [0, 0];
  const problems: Record<number, string> = {};
  const filled = sets.map((s, i) => ({ i, s })).filter(({ s }) => s.a !== '' || s.b !== '');
  const filledSets: SetEvaluation['filledSets'] = [];
  filled.forEach(({ i, s }, k) => {
    if (s.a === '' || s.b === '') { problems[i] = 'Nhập điểm cả hai bên'; return; }
    const a = Number(s.a);
    const b = Number(s.b);
    filledSets.push({ team1Score: a, team2Score: b });
    if (wins[0] === 2 || wins[1] === 2) { problems[i] = 'Trận đã phân thắng bại ở set trước'; return; }
    if (i === 2 && !(wins[0] === 1 && wins[1] === 1)) { problems[i] = 'Set 3 chỉ đánh khi hoà 1–1'; return; }
    if (isFinishedSet(a, b)) wins[a > b ? 0 : 1] += 1;
    else if (retired && k === filled.length - 1 && isInProgressSet(a, b)) { /* set dở khi bỏ cuộc */ }
    else problems[i] = isInProgressSet(a, b) ? 'Set chưa kết thúc (21 điểm, cách 2, tối đa 30)' : 'Tỉ số không thể xảy ra';
  });
  const winner = wins[0] === 2 ? 1 : wins[1] === 2 ? 2 : null;
  return { winner, wins, problems, filledSets };
}
