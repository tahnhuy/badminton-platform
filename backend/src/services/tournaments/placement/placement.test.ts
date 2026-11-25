import { describe, it, expect } from 'vitest';
import { computePlacements, placementOrder, roundPlacement, type PlacementMatch } from './placement';

const m = (roundIndex: number, a: number | null, b: number | null, winner: number | null, resolution = 'WINNER_DECLARED'): PlacementMatch =>
  ({ roundIndex, registration1Id: a, registration2Id: b, winnerRegistrationId: winner, resolution });

describe('placements', () => {
  it('names rounds from the end', () => {
    expect(roundPlacement(0, 1)).toBe('RUNNER_UP');
    expect(roundPlacement(0, 2)).toBe('SEMI_FINAL');
    expect(roundPlacement(0, 3)).toBe('QUARTER_FINAL');
    expect(roundPlacement(0, 4)).toBe('ROUND_OF_16');
    expect(roundPlacement(1, 4)).toBe('QUARTER_FINAL');
    expect(placementOrder('ROUND_OF_16')).toBe(9);
  });

  it('handles a 2-player final', () => {
    const p = computePlacements([m(0, 1, 2, 2)], 1);
    expect(Object.fromEntries(p)).toEqual({ 1: 'RUNNER_UP', 2: 'CHAMPION' });
  });

  it('handles 5 players with BYEs and a walkover', () => {
    // Bracket of 8: seeds 1,2,3 get BYEs; 4 v 5 in round 0 (bye matches have no rows).
    const matches = [
      m(0, 4, 5, 4, 'WALKOVER'),
      m(1, 1, 4, 1), m(1, 2, 3, 3, 'RETIRED'),
      m(2, 1, 3, 1),
    ];
    expect(Object.fromEntries(computePlacements(matches, 3))).toEqual({ 5: 'QUARTER_FINAL', 4: 'SEMI_FINAL', 2: 'SEMI_FINAL', 3: 'RUNNER_UP', 1: 'CHAMPION' });
  });

  it('handles 16 players and a cancelled match', () => {
    const matches: PlacementMatch[] = [];
    for (let i = 0; i < 8; i++) matches.push(m(0, 2 * i + 1, 2 * i + 2, i === 7 ? null : 2 * i + 1, i === 7 ? 'NONE' : 'WINNER_DECLARED'));
    matches.push(m(1, 1, 3, 1), m(1, 5, 7, 5), m(1, 9, 11, 9), m(1, 13, null, 13, 'WALKOVER'));
    matches.push(m(2, 1, 5, 1), m(2, 9, 13, 13));
    matches.push(m(3, 1, 13, 13));
    const p = computePlacements(matches, 4);
    expect(p.get(13)).toBe('CHAMPION');
    expect(p.get(1)).toBe('RUNNER_UP');
    expect([p.get(5), p.get(9)]).toEqual(['SEMI_FINAL', 'SEMI_FINAL']);
    expect([p.get(3), p.get(7), p.get(11)]).toEqual(['QUARTER_FINAL', 'QUARTER_FINAL', 'QUARTER_FINAL']);
    expect([p.get(2), p.get(15), p.get(16)]).toEqual(['ROUND_OF_16', 'ROUND_OF_16', 'ROUND_OF_16']);
    expect(p.size).toBe(16);
  });

  it('gives no champion before the final is resolved', () => {
    const p = computePlacements([m(0, 1, 2, 1), m(0, 3, 4, 3), m(1, 1, 3, null, 'UNRESOLVED')], 2);
    expect(p.has(1)).toBe(false);
    expect(p.get(2)).toBe('SEMI_FINAL');
  });
});
