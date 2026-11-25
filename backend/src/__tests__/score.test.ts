import { describe, it, expect } from 'vitest';
import { isFinishedSet, isInProgressSet, validateRetirement, validateSets } from '../services/tournaments/result/score';

// TRN-06 — set-score rules (Tournament Tech Design §7.5, matrix §4.10b).

const s = (...pairs: Array<[number, number]>) => pairs.map(([team1Score, team2Score]) => ({ team1Score, team2Score }));

describe('isFinishedSet', () => {
  const cases: Array<[number, number, boolean]> = [
    [21, 19, true], [21, 0, true], [19, 21, true], [21, 20, false], [22, 20, true], [23, 20, false],
    [29, 27, true], [30, 28, true], [30, 29, true], [31, 29, false], [20, 18, false], [21, 21, false], [30, 30, false],
  ];
  for (const [a, b, expected] of cases) it(`${a}–${b} → ${expected}`, () => expect(isFinishedSet(a, b)).toBe(expected));
});

describe('isInProgressSet', () => {
  it('accepts scores reachable during a set and rejects others', () => {
    expect(isInProgressSet(20, 15)).toBe(true);
    expect(isInProgressSet(21, 20)).toBe(true);
    expect(isInProgressSet(29, 29)).toBe(true);
    expect(isInProgressSet(25, 20)).toBe(false);
    expect(isInProgressSet(30, 29)).toBe(false);
  });
});

describe('validateSets', () => {
  it('derives the winner from two or three sets', () => {
    expect(validateSets(s([21, 15], [21, 19]))).toEqual({ ok: true, winnerSlot: 1, setWins: [2, 0] });
    expect(validateSets(s([18, 21], [21, 17], [28, 30]))).toEqual({ ok: true, winnerSlot: 2, setWins: [1, 2] });
  });
  it('rejects invalid scores with the set number', () => {
    expect(validateSets(s([21, 20], [21, 15]))).toEqual({ ok: false, errors: [{ setNo: 1, reason: 'NOT_A_FINISHED_SET' }] });
    expect(validateSets(s([31, 29], [21, 15]))).toEqual({ ok: false, errors: [{ setNo: 1, reason: 'IMPOSSIBLE_SCORE' }] });
    expect(validateSets(s([21, -1], [21, 15]))).toEqual({ ok: false, errors: [{ setNo: 1, reason: 'NOT_A_NON_NEGATIVE_INTEGER' }] });
    expect(validateSets(s([21, 15], [21, 15], [21, 15])).ok).toBe(false);
    expect(validateSets(s([21, 15], [15, 21], [21, 19], [21, 0]))).toEqual({ ok: false, errors: [{ setNo: null, reason: 'TOO_MANY_SETS' }] });
    expect(validateSets(s([21, 15]))).toEqual({ ok: false, errors: [{ setNo: null, reason: 'NOT_ENOUGH_SETS' }] });
    expect(validateSets([])).toEqual({ ok: false, errors: [{ setNo: null, reason: 'NO_SETS' }] });
  });
});

describe('validateRetirement', () => {
  it('keeps the sets played and gives the match to the opponent', () => {
    expect(validateRetirement(s([21, 18], [11, 7]), 1)).toEqual({ ok: true, winnerSlot: 2, setWins: [1, 0] });
    expect(validateRetirement(s([5, 3]), 2)).toEqual({ ok: true, winnerSlot: 1, setWins: [0, 0] });
    expect(validateRetirement([], 2)).toEqual({ ok: true, winnerSlot: 1, setWins: [0, 0] });
  });
  it('rejects an unfinished set that is not the last one and a retirement after winning', () => {
    expect(validateRetirement(s([11, 7], [21, 18]), 1).ok).toBe(false);
    expect(validateRetirement(s([21, 18], [21, 15]), 1)).toEqual({ ok: false, errors: [{ setNo: null, reason: 'RETIRED_SIDE_WON' }] });
    expect(validateRetirement(s([21, 0], [21, 0]), 2)).toEqual({ ok: false, errors: [{ setNo: null, reason: 'MATCH_ALREADY_DECIDED' }] });
  });
});
