/**
 * Skill rating "Hướng B" (research report docs/research/bao-cao-cong-thuc-nang-trinh.md §4,
 * Tournament Tech Design §7.10; TRN-14). Pure and deterministic: the same match history always
 * gives the same ratings and levels. Ratings keep full precision; callers round for storage.
 */

export interface RatingParams {
  k: number;
  kTentative: number;
  tentativeMatches: number;
  scaleD: number;
  hysteresis: number;
  doublesFactor: number;
}

export const DEFAULT_PARAMS: RatingParams = { k: 3, kTentative: 6, tentativeMatches: 6, scaleD: 15, hysteresis: 3, doublesFactor: 0.8 };

/** Level bands in rank order (rank 1 lowest): [min, next.min); the top band ends at 100. */
export interface Band { levelId: number; rank: number; min: number }

export const clampRating = (r: number) => Math.min(100, Math.max(0, r));

export function bandOf(bands: Band[], rank: number): { min: number; max: number } {
  const ordered = [...bands].sort((a, b) => a.rank - b.rank);
  const index = ordered.findIndex(b => b.rank === rank);
  return { min: ordered[index].min, max: index + 1 < ordered.length ? ordered[index + 1].min : 100 };
}

/** §4.1: survey score clamped into the band of the assigned level; no survey → band midpoint. */
export function initialRating(bands: Band[], rank: number, surveyScore: number | null): number {
  const { min, max } = bandOf(bands, rank);
  if (surveyScore === null) return (min + max) / 2;
  return Math.min(Math.max(surveyScore, min), max - 0.01);
}

export const expectedScore = (r: number, opponent: number, scaleD: number) => 1 / (1 + 10 ** ((opponent - r) / scaleD));

/**
 * §4.3: promote one band when R ≥ next.min + h, demote when R < current.min − h; repeat until
 * stable. The lowest band never goes down, the highest never up.
 */
export function reviewLevel(bands: Band[], rank: number, r: number, hysteresis: number): number {
  const ordered = [...bands].sort((a, b) => a.rank - b.rank);
  let index = ordered.findIndex(b => b.rank === rank);
  for (let guard = 0; guard < ordered.length; guard++) {
    if (index + 1 < ordered.length && r >= ordered[index + 1].min + hysteresis) index += 1;
    else if (index > 0 && r < ordered[index].min - hysteresis) index -= 1;
    else break;
  }
  return ordered[index].rank;
}

export interface PlayerState { rating: number; count: number; rank: number; tentative: boolean }

export interface RatedMatch {
  tournamentId: number;
  tournamentMatchId: number;
  /** Player ids of each side (1 for Singles, 2 for Doubles). */
  side1: number[];
  side2: number[];
  winnerSide: 1 | 2;
}

export interface RatedTournament { tournamentId: number; matches: RatedMatch[] }

export interface RatingEvent {
  playerId: number; tournamentId: number; tournamentMatchId: number;
  before: number; after: number; opponent: number; expected: number; k: number; outcome: 0 | 1; sequence: number;
}

export interface LevelChange { playerId: number; fromRank: number; toRank: number; rating: number; tournamentId: number }

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/** §4.2: one match; every player of a side gets the same ΔR from the side averages (Doubles × factor). */
export function applyMatch(states: Map<number, PlayerState>, match: RatedMatch, params: RatingParams, sequence: number): RatingEvent[] {
  const ratings = (side: number[]) => mean(side.map(id => states.get(id)!.rating));
  const r1 = ratings(match.side1);
  const r2 = ratings(match.side2);
  const doubles = match.side1.length > 1 || match.side2.length > 1;
  const events: RatingEvent[] = [];
  const sides: Array<[number[], number, number, 0 | 1]> = [
    [match.side1, r1, r2, match.winnerSide === 1 ? 1 : 0],
    [match.side2, r2, r1, match.winnerSide === 2 ? 1 : 0],
  ];
  // Compute every change from the pre-match ratings, then apply.
  const updates: Array<[number, number, RatingEvent]> = [];
  for (const [side, own, opponent, outcome] of sides) {
    const expected = expectedScore(own, opponent, params.scaleD);
    for (const id of side) {
      const state = states.get(id)!;
      const k = (state.count < params.tentativeMatches ? params.kTentative : params.k) * (doubles ? params.doublesFactor : 1);
      const after = clampRating(state.rating + k * (outcome - expected));
      updates.push([id, after, {
        playerId: id, tournamentId: match.tournamentId, tournamentMatchId: match.tournamentMatchId,
        before: state.rating, after, opponent, expected, k, outcome, sequence,
      }]);
    }
  }
  for (const [id, after, event] of updates) {
    const state = states.get(id)!;
    state.rating = after;
    state.count += 1;
    events.push(event);
  }
  return events;
}

/**
 * Replays tournaments in completion order: ratings change per match; levels are reviewed only
 * at the end of each tournament for its players (§4.3), and the tentative flag turns false at the
 * first review with enough rated matches (§4.4).
 */
export function replay(initial: Map<number, PlayerState>, tournaments: RatedTournament[], bands: Band[], params: RatingParams = DEFAULT_PARAMS) {
  const states = new Map([...initial].map(([id, s]) => [id, { ...s }]));
  const events: RatingEvent[] = [];
  const changes: LevelChange[] = [];
  let sequence = 0;
  for (const t of tournaments) {
    const played = new Set<number>();
    for (const match of t.matches) {
      for (const id of [...match.side1, ...match.side2]) played.add(id);
      events.push(...applyMatch(states, match, params, ++sequence));
    }
    for (const id of [...played].sort((a, b) => a - b)) {
      const state = states.get(id)!;
      const next = reviewLevel(bands, state.rank, state.rating, params.hysteresis);
      if (next !== state.rank) changes.push({ playerId: id, fromRank: state.rank, toRank: next, rating: state.rating, tournamentId: t.tournamentId });
      state.rank = next;
      if (state.tentative && state.count >= params.tentativeMatches) state.tentative = false;
    }
  }
  return { states, events, changes };
}
