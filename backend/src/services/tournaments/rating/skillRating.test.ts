import { describe, it, expect } from 'vitest';
import { applyMatch, DEFAULT_PARAMS, expectedScore, initialRating, replay, reviewLevel, type Band, type PlayerState, type RatedTournament } from './skillRating';

// Research report §5 worked examples and §4 rules (TRN-14).
// Bands: Mới chơi [0,15) · Yếu [15,30) · TB yếu [30,45) · TB [45,60) · TB khá [60,70) · Khá [70,80) · Giỏi [80,100].
const BANDS: Band[] = [0, 15, 30, 45, 60, 70, 80].map((min, i) => ({ levelId: 100 + i, rank: i + 1, min }));
const TB_YEU = 3, TB = 4, TB_KHA = 5, KHA = 6;

/** One player against fixed-rating opponents (an opponent never reused, so its rating is the given value). */
function series(start: PlayerState, games: Array<[number, 0 | 1]>, perTournament = games.length) {
  const states = new Map<number, PlayerState>([[1, { ...start }]]);
  const tournaments: RatedTournament[] = [];
  games.forEach(([opponent, win], i) => {
    const oid = 1000 + i;
    states.set(oid, { rating: opponent, count: 50, rank: TB, tentative: false });
    const t = Math.floor(i / perTournament);
    tournaments[t] ??= { tournamentId: t + 1, matches: [] };
    tournaments[t].matches.push({ tournamentId: t + 1, tournamentMatchId: i + 1, side1: [1], side2: [oid], winnerSide: win ? 1 : 2 });
  });
  return replay(states, tournaments, BANDS);
}

describe('skill rating — research report §5', () => {
  it('example 1: under-declared player climbs, K drops to 3 after 6 matches', () => {
    const { events, states } = series({ rating: 40, count: 0, rank: TB_YEU, tentative: true },
      [[38, 1], [47, 1], [52, 1], [55, 1], [50, 1], [58, 0], [45, 1]]);
    const mine = events.filter(e => e.playerId === 1);
    expect(mine.map(e => +e.after.toFixed(2))).toEqual([42.54, 46.53, 50.72, 54.67, 56.64, 53.95, 54.56]);
    expect(mine.map(e => e.k)).toEqual([6, 6, 6, 6, 6, 6, 3]);
    expect(+mine[0].expected.toFixed(2)).toBe(0.58);
    expect(states.get(1)).toMatchObject({ rank: TB, tentative: false });
  });

  it('example 2: over-declared player drops two bands within the tournament review', () => {
    const { states, changes } = series({ rating: 72, count: 0, rank: KHA, tentative: true },
      [[55, 0], [62, 0], [50, 1], [66, 0], [58, 0], [52, 0]]);
    expect(+states.get(1)!.rating.toFixed(2)).toBe(53.06);
    expect(states.get(1)!.rank).toBe(TB);
    expect(changes.filter(c => c.playerId === 1)).toEqual([{ playerId: 1, fromRank: KHA, toRank: TB, rating: states.get(1)!.rating, tournamentId: 1 }]);
  });

  it('example 2 by tournament: the first loss already moves Khá → TB khá', () => {
    const { changes } = series({ rating: 72, count: 0, rank: KHA, tentative: true }, [[55, 0], [62, 0], [50, 1]], 1);
    expect(changes.find(c => c.playerId === 1)).toMatchObject({ fromRank: KHA, toRank: TB_KHA, tournamentId: 1 });
  });

  it('example 3: mixed results against equals keep the level', () => {
    const { states, changes } = series({ rating: 50, count: 10, rank: TB, tentative: false }, [[48, 1], [53, 0], [50, 1], [47, 1], [55, 0]]);
    expect(+states.get(1)!.rating.toFixed(2)).toBe(51.26);
    expect(changes.filter(c => c.playerId === 1)).toHaveLength(0);
  });

  it('example 4: a confirmed player losing repeatedly is demoted', () => {
    const { states } = series({ rating: 63, count: 10, rank: TB_KHA, tentative: false }, [[55, 0], [52, 0], [60, 0]]);
    expect(+states.get(1)!.rating.toFixed(2)).toBe(57.00);
    expect(states.get(1)!.rank).toBe(TB);
  });
});

describe('skill rating — rules', () => {
  it('expected score table (§4.2)', () => {
    expect(+expectedScore(50, 50, 15).toFixed(2)).toBe(0.5);
    expect(+expectedScore(50, 65, 15).toFixed(2)).toBe(0.09);
    expect(+expectedScore(50, 35, 15).toFixed(2)).toBe(0.91);
  });

  it('initial rating clamps the survey score into the assigned band', () => {
    expect(initialRating(BANDS, TB, 76)).toBe(59.99);
    expect(initialRating(BANDS, TB, 30)).toBe(45);
    expect(initialRating(BANDS, TB, 50)).toBe(50);
    expect(initialRating(BANDS, TB, null)).toBe(52.5);
    expect(initialRating(BANDS, 7, null)).toBe(90);
  });

  it('hysteresis: one loss near a boundary does not change the level', () => {
    expect(reviewLevel(BANDS, TB, 46, 3)).toBe(TB);
    expect(reviewLevel(BANDS, TB, 42.5, 3)).toBe(TB);
    expect(reviewLevel(BANDS, TB, 41.99, 3)).toBe(TB_YEU);
    expect(reviewLevel(BANDS, TB, 62.99, 3)).toBe(TB);
    expect(reviewLevel(BANDS, TB, 63, 3)).toBe(TB_KHA);
    expect(reviewLevel(BANDS, 1, 0, 3)).toBe(1);
    expect(reviewLevel(BANDS, 7, 100, 3)).toBe(7);
  });

  it('clamps to [0, 100] and conserves points in Singles', () => {
    const states = new Map<number, PlayerState>([[1, { rating: 99, count: 0, rank: 7, tentative: true }], [2, { rating: 99, count: 0, rank: 7, tentative: true }]]);
    applyMatch(states, { tournamentId: 1, tournamentMatchId: 1, side1: [1], side2: [2], winnerSide: 1 }, DEFAULT_PARAMS, 1);
    expect(states.get(1)!.rating).toBe(100);
    const even = new Map<number, PlayerState>([[1, { rating: 50, count: 9, rank: 4, tentative: false }], [2, { rating: 55, count: 9, rank: 4, tentative: false }]]);
    applyMatch(even, { tournamentId: 1, tournamentMatchId: 1, side1: [1], side2: [2], winnerSide: 2 }, DEFAULT_PARAMS, 1);
    expect(even.get(1)!.rating + even.get(2)!.rating).toBeCloseTo(105, 10);
  });

  it('Doubles: both members get the same change from team averages × 0.8', () => {
    const states = new Map<number, PlayerState>([1, 2, 3, 4].map(id => [id, { rating: id <= 2 ? 50 : 60, count: 10, rank: 4, tentative: false }]));
    const events = applyMatch(states, { tournamentId: 1, tournamentMatchId: 1, side1: [1, 2], side2: [3, 4], winnerSide: 1 }, DEFAULT_PARAMS, 1);
    const gain = events[0].after - events[0].before;
    expect(events[1].after - events[1].before).toBeCloseTo(gain, 10);
    expect(gain).toBeCloseTo(3 * 0.8 * (1 - expectedScore(50, 60, 15)), 10);
  });

  it('replay is deterministic and idempotent', () => {
    const run = () => series({ rating: 40, count: 0, rank: TB_YEU, tentative: true }, [[38, 1], [47, 1], [52, 0]]);
    expect(run()).toEqual(run());
  });
});
