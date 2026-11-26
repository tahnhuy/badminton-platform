/**
 * Automatic scheduling on virtual courts (Tournament Tech Design §7.3 — thesis algorithm 1,
 * scheduling part). Pure and deterministic: same input → same schedule.
 *
 * Greedy list scheduling in bracket order (round, then match index). Each match starts at
 * the earliest time t such that
 *   - its court is free (no two matches overlap on a court),
 *   - every feeder match has ended plus the minimum rest (winners are unknown in advance,
 *     so the feeder rule protects future participants),
 *   - every already-known participant has ended their previous match plus the rest,
 *   - [t, t + D) lies inside the daily window (otherwise the next day's start).
 * Among courts the earliest feasible start wins; ties go to the lowest court number.
 * Complexity O(M · k) for M matches and k courts.
 */

export const VN_UTC_OFFSET_MINUTES = 7 * 60; // Asia/Ho_Chi_Minh, no daylight saving
const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

export interface ScheduleSettings {
  courtCount: number;
  durationMinutes: number;
  restMinutes: number;
  /** Minutes after local midnight. */
  dayStartMinutes: number;
  dayEndMinutes: number;
  /** Earliest start (UTC instant). */
  from: Date;
  utcOffsetMinutes?: number;
}

export interface ScheduleMatchInput {
  id: number;
  roundIndex: number;
  matchIndex: number;
  /** Matches whose winners play in this match. */
  feederIds: number[];
  /** Participants already known for this match (e.g. registration ids). */
  participants: number[];
  /**
   * Started/finished (or otherwise fixed) matches keep their court and time.
   * `playing`: still on court — assumed busy until at least `from`;
   * `played`: finished at its estimated end;
   * `unplayed`: walkover/cancelled without play — occupies no court and constrains nobody after `from`.
   */
  fixed?: { courtLabel: string | null; start: Date; state?: 'playing' | 'played' | 'unplayed' } | null;
}

export interface ScheduledMatch {
  id: number;
  courtNo: number | null;
  courtLabel: string | null;
  start: Date;
  end: Date;
  fixed: boolean;
}

export const courtLabelOf = (courtNo: number) => `Sân ${courtNo}`;

/** "Sân 3" (any case/spacing) → 3; anything else → null. */
export function courtNoOf(label: string | null | undefined): number | null {
  const match = /^\s*sân\s*(\d+)\s*$/iu.exec((label ?? '').normalize('NFC'));
  const courtNo = match ? Number(match[1]) : null;
  return courtNo !== null && courtNo >= 1 ? courtNo : null;
}

/** Earliest start ≥ t whose whole slot [start, start + D) fits in one local daily window. */
export function fitDailyWindow(t: number, settings: ScheduleSettings): number {
  const offset = (settings.utcOffsetMinutes ?? VN_UTC_OFFSET_MINUTES) * MINUTE;
  const { dayStartMinutes: open, dayEndMinutes: close, durationMinutes: d } = settings;
  if (close - open < d) throw new Error('the daily window is shorter than one match');
  const local = t + offset;
  const dayStartMs = Math.floor(local / (DAY_MINUTES * MINUTE)) * DAY_MINUTES * MINUTE;
  const minuteOfDay = (local - dayStartMs) / MINUTE;
  let startLocal: number;
  if (minuteOfDay < open) startLocal = dayStartMs + open * MINUTE;
  else if (minuteOfDay + d > close) startLocal = dayStartMs + (DAY_MINUTES + open) * MINUTE;
  else startLocal = local;
  return startLocal - offset;
}

export function generateSchedule(inputs: readonly ScheduleMatchInput[], settings: ScheduleSettings): ScheduledMatch[] {
  if (!Number.isInteger(settings.courtCount) || settings.courtCount < 1) throw new Error('courtCount must be ≥ 1');
  const d = settings.durationMinutes * MINUTE;
  const rest = settings.restMinutes * MINUTE;
  const from = settings.from.getTime();

  const courtFree = Array.from({ length: settings.courtCount }, () => from);
  const ends = new Map<number, number>();
  const participantFree = new Map<number, number>();
  const result = new Map<number, ScheduledMatch>();

  const markParticipants = (match: ScheduleMatchInput, end: number) => {
    for (const p of match.participants) participantFree.set(p, Math.max(participantFree.get(p) ?? 0, end + rest));
  };

  // Fixed matches first: they occupy their court and constrain their participants and dependants.
  reserveFixedMatches(inputs, d, from, settings, courtFree, ends, markParticipants, result);

  const pending = inputs.filter(match => !match.fixed)
    .sort((a, b) => a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex);
  for (const match of pending) {
    let ready = from;
    for (const feeder of match.feederIds) {
      const end = ends.get(feeder);
      if (end === undefined) throw new Error(`feeder ${feeder} of match ${match.id} is not scheduled before it`);
      ready = Math.max(ready, end + rest);
    }
    for (const p of match.participants) ready = Math.max(ready, participantFree.get(p) ?? from);

    let best: { court: number; start: number } | null = null;
    for (let court = 0; court < settings.courtCount; court += 1) {
      const start = fitDailyWindow(Math.max(courtFree[court], ready), settings);
      if (best === null || start < best.start) best = { court, start };
    }
    const { court, start } = best!;
    courtFree[court] = start + d;
    ends.set(match.id, start + d);
    markParticipants(match, start + d);
    result.set(match.id, {
      id: match.id, courtNo: court + 1, courtLabel: courtLabelOf(court + 1), start: new Date(start), end: new Date(start + d), fixed: false,
    });
  }
  return inputs.map(match => result.get(match.id)!);
}

function reserveFixedMatches(
  inputs: readonly ScheduleMatchInput[],
  d: number,
  from: number,
  settings: ScheduleSettings,
  courtFree: number[],
  ends: Map<number, number>,
  markParticipants: (match: ScheduleMatchInput, end: number) => void,
  result: Map<number, ScheduledMatch>,
) {
  for (const match of inputs) {
    if (!match.fixed) continue;
    const start = match.fixed.start.getTime();
    const state = match.fixed.state ?? 'played';
    // A match still being played may overrun its estimate; an unplayed one frees its slot (review, TRN-05).
    const end = state === 'playing' ? Math.max(start + d, from) : state === 'unplayed' ? Math.min(start + d, from) : start + d;
    const courtNo = courtNoOf(match.fixed.courtLabel);
    if (state !== 'unplayed' && courtNo !== null && courtNo <= settings.courtCount) courtFree[courtNo - 1] = Math.max(courtFree[courtNo - 1], end);
    ends.set(match.id, end);
    if (state !== 'unplayed') markParticipants(match, end);
    result.set(match.id, { id: match.id, courtNo, courtLabel: match.fixed.courtLabel, start: new Date(start), end: new Date(end), fixed: true });
  }
}
