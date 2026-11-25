/**
 * Set-score validation (Tournament Tech Design §7.5, PRD Decision #16, matrix §4.10b).
 * Best of 3 sets; a set is won at 21 with a 2-point lead, extended up to a cap of 30.
 * Pure: shared rule table for the API and the frontend form.
 */

export interface SetScore {
  team1Score: number;
  team2Score: number;
}

export type SetProblem =
  | 'NOT_A_NON_NEGATIVE_INTEGER'
  | 'NOT_A_FINISHED_SET'
  | 'IMPOSSIBLE_SCORE'
  | 'MATCH_ALREADY_DECIDED'
  | 'THIRD_SET_WITHOUT_ONE_ALL'
  | 'NOT_ENOUGH_SETS'
  | 'TOO_MANY_SETS'
  | 'NO_SETS'
  | 'RETIRED_SIDE_WON';

export interface ScoreError {
  setNo: number | null;
  reason: SetProblem;
}

export type ScoreResult =
  | { ok: true; winnerSlot: 1 | 2; setWins: [number, number] }
  | { ok: false; errors: ScoreError[] };

const isScore = (n: number) => Number.isInteger(n) && n >= 0;

/** Finished set w–l (winner–loser): 21–≤19, or 22..30 won by exactly 2, or 30–29. */
export function isFinishedSet(a: number, b: number): boolean {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (a === b) return false;
  return (w === 21 && l <= 19) || (w >= 22 && w <= 30 && l === w - 2) || (w === 30 && l === 29);
}

/** A score that can occur during a set that is not over yet. */
export function isInProgressSet(a: number, b: number): boolean {
  const w = Math.max(a, b);
  const l = Math.min(a, b);
  if (w > 29) return false;
  if (w < 21) return true;
  // From 20–20 on, play continues while the lead is under 2 points.
  return w - l < 2 && l >= 20;
}

/** Normal result: 2 or 3 finished sets, one side wins exactly 2. */
export function validateSets(sets: readonly SetScore[]): ScoreResult {
  return check(sets, null);
}

/**
 * Retirement (PRD Decision #25): sets played so far, the last one may be unfinished; the
 * opponent of `retiredSlot` wins. The retired side must not already have won the match.
 */
export function validateRetirement(sets: readonly SetScore[], retiredSlot: 1 | 2): ScoreResult {
  return check(sets, retiredSlot);
}

function check(sets: readonly SetScore[], retiredSlot: 1 | 2 | null): ScoreResult {
  const errors: ScoreError[] = [];
  if (sets.length === 0 && retiredSlot === null) return { ok: false, errors: [{ setNo: null, reason: 'NO_SETS' }] };
  if (sets.length > 3) return { ok: false, errors: [{ setNo: null, reason: 'TOO_MANY_SETS' }] };
  const wins: [number, number] = [0, 0];
  sets.forEach((set, index) => {
    const setNo = index + 1;
    const { team1Score: a, team2Score: b } = set;
    if (!isScore(a) || !isScore(b)) {
      errors.push({ setNo, reason: 'NOT_A_NON_NEGATIVE_INTEGER' });
      return;
    }
    if (wins[0] === 2 || wins[1] === 2) {
      errors.push({ setNo, reason: 'MATCH_ALREADY_DECIDED' });
      return;
    }
    if (setNo === 3 && !(wins[0] === 1 && wins[1] === 1)) errors.push({ setNo, reason: 'THIRD_SET_WITHOUT_ONE_ALL' });
    const last = index === sets.length - 1;
    if (isFinishedSet(a, b)) {
      wins[a > b ? 0 : 1] += 1;
    } else if (retiredSlot !== null && last && isInProgressSet(a, b)) {
      // The set during which the player retired.
    } else {
      errors.push({ setNo, reason: isInProgressSet(a, b) ? 'NOT_A_FINISHED_SET' : 'IMPOSSIBLE_SCORE' });
    }
  });
  if (errors.length > 0) return { ok: false, errors };

  if (retiredSlot !== null) {
    if (wins[retiredSlot - 1] === 2) return { ok: false, errors: [{ setNo: null, reason: 'RETIRED_SIDE_WON' }] };
    // A decided match is a normal result, not a retirement (review, TRN-06).
    if (wins[0] === 2 || wins[1] === 2) return { ok: false, errors: [{ setNo: null, reason: 'MATCH_ALREADY_DECIDED' }] };
    const winnerSlot = retiredSlot === 1 ? 2 : 1;
    return { ok: true, winnerSlot, setWins: wins };
  }
  if (wins[0] < 2 && wins[1] < 2) return { ok: false, errors: [{ setNo: null, reason: 'NOT_ENOUGH_SETS' }] };
  return { ok: true, winnerSlot: wins[0] === 2 ? 1 : 2, setWins: wins };
}
