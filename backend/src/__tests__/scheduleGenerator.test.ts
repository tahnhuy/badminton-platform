import { describe, it, expect } from 'vitest';
import { buildBracket } from '../services/tournaments/bracket/bracketGenerator';
import { createSeededRng } from '../services/tournaments/bracket/seededRng';
import {
  courtNoOf, fitDailyWindow, generateSchedule, type ScheduleMatchInput, type ScheduleSettings,
} from '../services/tournaments/schedule/scheduleGenerator';
import { findScheduleConflicts } from '../services/tournaments/schedule/conflicts';

// TRN-05 — automatic scheduling on virtual courts (Tournament Tech Design §7.3).

const MINUTE = 60_000;
const OFFSET = 7 * 60 * MINUTE;
const localMinute = (d: Date) => (((d.getTime() + OFFSET) % (1440 * MINUTE)) + 1440 * MINUTE) % (1440 * MINUTE) / MINUTE;

/** Schedule inputs from a generated bracket: feeders from next-match links, known participants from slots. */
function bracketInputs(n: number, seed: number): ScheduleMatchInput[] {
  const plan = buildBracket(Array.from({ length: n }, (_, i) => ({ registrationId: i + 1, skillRank: null })), createSeededRng(seed));
  const id = (round: number, index: number) => round * 1000 + index;
  return plan.matches.map(m => ({
    id: id(m.roundIndex, m.matchIndex),
    roundIndex: m.roundIndex,
    matchIndex: m.matchIndex,
    feederIds: plan.matches.filter(f => f.nextMatchRoundIndex === m.roundIndex && f.nextMatchIndex === m.matchIndex).map(f => id(f.roundIndex, f.matchIndex)),
    participants: [m.registration1Id, m.registration2Id].filter((x): x is number => x !== null),
  }));
}

function settings(overrides: Partial<ScheduleSettings> = {}): ScheduleSettings {
  return {
    courtCount: 2, durationMinutes: 45, restMinutes: 15, dayStartMinutes: 8 * 60, dayEndMinutes: 21 * 60,
    from: new Date('2030-03-01T01:00:00Z'), // 08:00 in Vietnam
    ...overrides,
  };
}

function assertValid(inputs: ScheduleMatchInput[], s: ScheduleSettings) {
  const schedule = generateSchedule(inputs, s);
  const at = new Map(schedule.map(m => [m.id, m]));
  const d = s.durationMinutes * MINUTE;
  for (const m of inputs) {
    const slot = at.get(m.id)!;
    expect(slot.start.getTime()).toBeGreaterThanOrEqual(s.from.getTime());
    // Inside the daily window.
    expect(localMinute(slot.start)).toBeGreaterThanOrEqual(s.dayStartMinutes);
    expect(localMinute(slot.start) + s.durationMinutes).toBeLessThanOrEqual(s.dayEndMinutes);
    // Never before a feeder's end plus the rest.
    for (const f of m.feederIds) expect(slot.start.getTime()).toBeGreaterThanOrEqual(at.get(f)!.end.getTime() + s.restMinutes * MINUTE);
    expect(slot.courtNo).toBeGreaterThanOrEqual(1);
    expect(slot.courtNo).toBeLessThanOrEqual(s.courtCount);
  }
  // No court or participant conflicts and enough rest, as judged by the independent checker.
  const warnings = findScheduleConflicts(
    inputs.map(m => ({ id: m.id, courtLabel: at.get(m.id)!.courtLabel, start: at.get(m.id)!.start, feederIds: m.feederIds, participants: m.participants })),
    { durationMinutes: s.durationMinutes, restMinutes: s.restMinutes, dayStartMinutes: s.dayStartMinutes, dayEndMinutes: s.dayEndMinutes,
      tournamentStart: s.from, tournamentEnd: new Date(s.from.getTime() + 365 * 1440 * MINUTE) },
  );
  expect(warnings).toEqual([]);
  // Each court hosts at most one match at a time.
  const byCourt = new Map<number, number[]>();
  for (const m of schedule) byCourt.set(m.courtNo!, [...(byCourt.get(m.courtNo!) ?? []), m.start.getTime()]);
  for (const starts of byCourt.values()) {
    starts.sort((a, b) => a - b);
    for (let i = 1; i < starts.length; i += 1) expect(starts[i] - starts[i - 1]).toBeGreaterThanOrEqual(d);
  }
  return schedule;
}

describe('fitDailyWindow', () => {
  const s = settings({ durationMinutes: 60, dayStartMinutes: 8 * 60, dayEndMinutes: 21 * 60 });
  it('moves an early start to the opening time and a late start to the next morning', () => {
    expect(fitDailyWindow(new Date('2030-03-01T00:00:00Z').getTime(), s)).toBe(new Date('2030-03-01T01:00:00Z').getTime()); // 07:00 → 08:00
    expect(fitDailyWindow(new Date('2030-03-01T13:30:00Z').getTime(), s)).toBe(new Date('2030-03-02T01:00:00Z').getTime()); // 20:30 → next 08:00
    expect(fitDailyWindow(new Date('2030-03-01T13:00:00Z').getTime(), s)).toBe(new Date('2030-03-01T13:00:00Z').getTime()); // 20:00 fits
  });
  it('rejects a window shorter than one match', () => {
    expect(() => fitDailyWindow(0, settings({ dayStartMinutes: 600, dayEndMinutes: 630 }))).toThrow(/shorter/);
  });
});

describe('generateSchedule — properties over random brackets and settings', () => {
  const rng = createSeededRng(2026);
  for (let trial = 0; trial < 60; trial += 1) {
    const n = 2 + Math.floor(rng() * 63);
    const s = settings({
      courtCount: 1 + Math.floor(rng() * 6),
      durationMinutes: 15 + Math.floor(rng() * 8) * 5,
      restMinutes: Math.floor(rng() * 5) * 10,
      dayStartMinutes: 7 * 60 + Math.floor(rng() * 4) * 30,
      dayEndMinutes: 17 * 60 + Math.floor(rng() * 5) * 30,
    });
    it(`trial ${trial}: ${n} players, ${s.courtCount} courts, ${s.durationMinutes}+${s.restMinutes} min`, () => {
      assertValid(bracketInputs(n, trial + 1), s);
    });
  }

  it('is deterministic', () => {
    const inputs = bracketInputs(23, 9);
    expect(generateSchedule(inputs, settings({ courtCount: 3 }))).toEqual(generateSchedule(inputs, settings({ courtCount: 3 })));
  });

  it('uses every court in parallel for the first round', () => {
    const schedule = generateSchedule(bracketInputs(16, 1), settings({ courtCount: 4 }));
    const firstRound = schedule.slice(0, 8);
    expect(new Set(firstRound.slice(0, 4).map(m => m.courtNo))).toEqual(new Set([1, 2, 3, 4]));
    expect(new Set(firstRound.slice(0, 4).map(m => m.start.toISOString()))).toEqual(new Set(['2030-03-01T01:00:00.000Z']));
  });

  it('keeps fixed matches unchanged and schedules the rest around them', () => {
    const inputs = bracketInputs(8, 3);
    const s = settings({ courtCount: 2 });
    const first = generateSchedule(inputs, s);
    const fixedStart = new Date(first[0].start.getTime() + 30 * MINUTE);
    const rerunInputs = inputs.map((m, i) => (i === 0 ? { ...m, fixed: { courtLabel: 'Sân 2', start: fixedStart } } : m));
    const rerun = assertValid(rerunInputs, s);
    expect(rerun[0]).toMatchObject({ id: inputs[0].id, courtNo: 2, courtLabel: 'Sân 2', fixed: true });
    expect(rerun[0].start).toEqual(fixedStart);
  });

  it('treats a match still being played as busy until now and frees the court of an unplayed one', () => {
    const inputs = bracketInputs(4, 2); // two semi-finals feeding the final
    const s = settings({ courtCount: 1, from: new Date('2030-03-01T03:00:00Z') }); // 10:00
    const planned = new Date('2030-03-01T01:00:00Z'); // 08:00, would end 08:45
    const playing = generateSchedule(inputs.map((m, i) => (i === 0 ? { ...m, fixed: { courtLabel: 'Sân 1', start: planned, state: 'playing' as const } } : m)), s);
    expect(playing[0].end.toISOString()).toBe('2030-03-01T03:00:00.000Z'); // overran: busy until now
    expect(playing[1].start.toISOString()).toBe('2030-03-01T03:00:00.000Z');
    const unplayed = generateSchedule(inputs.map((m, i) => (i === 0 ? { ...m, fixed: { courtLabel: 'Sân 1', start: new Date('2030-03-01T09:00:00Z'), state: 'unplayed' as const } } : m)), s);
    expect(unplayed[1].start.toISOString()).toBe('2030-03-01T03:00:00.000Z'); // court not blocked by the 16:00 walkover
  });

  it('recognises virtual court labels', () => {
    expect(courtNoOf('Sân 0')).toBeNull();
    expect(courtNoOf('Sa\u0302n 2'.normalize('NFD'))).toBe(2);
    expect(courtNoOf('Sân 3')).toBe(3);
    expect(courtNoOf('  sân   12 ')).toBe(12);
    expect(courtNoOf('Sân VIP')).toBeNull();
  });
});

describe('findScheduleConflicts', () => {
  const base = {
    durationMinutes: 45, restMinutes: 15, dayStartMinutes: 480, dayEndMinutes: 1260,
    tournamentStart: new Date('2030-03-01T00:00:00Z'), tournamentEnd: new Date('2030-03-02T17:00:00Z'),
  };
  const at = (hhmm: string, day = '2030-03-01') => new Date(`${day}T${hhmm}:00+07:00`);

  it('reports each kind of conflict', () => {
    const warnings = findScheduleConflicts([
      { id: 1, courtLabel: 'Sân 1', start: at('09:00'), feederIds: [], participants: [10, 11] },
      { id: 2, courtLabel: ' sân  1', start: at('09:30'), feederIds: [], participants: [12, 13] },
      { id: 3, courtLabel: 'Sân 2', start: at('09:15'), feederIds: [], participants: [10, 14] },
      { id: 4, courtLabel: 'Sân 3', start: at('09:50'), feederIds: [], participants: [11, 15] },
      { id: 5, courtLabel: 'Sân 4', start: at('09:20'), feederIds: [1], participants: [] },
      { id: 6, courtLabel: 'Sân 5', start: at('21:00'), feederIds: [], participants: [] },
      { id: 7, courtLabel: 'Sân 6', start: at('09:00', '2030-03-03'), feederIds: [], participants: [] },
    ], base);
    const codes = warnings.map(w => `${w.matchId}:${w.code}`).sort();
    expect(codes).toEqual([
      '2:COURT_OVERLAP', '3:PARTICIPANT_OVERLAP', '4:REST_TOO_SHORT', '5:BEFORE_FEEDER',
      '6:OUTSIDE_DAILY_WINDOW', '7:OUTSIDE_TOURNAMENT_DATES',
    ].sort());
  });

  it('accepts a clean schedule', () => {
    expect(findScheduleConflicts([
      { id: 1, courtLabel: 'Sân 1', start: at('09:00'), feederIds: [], participants: [1, 2] },
      { id: 2, courtLabel: 'Sân 1', start: at('09:45'), feederIds: [], participants: [3, 4] },
      { id: 3, courtLabel: 'Sân 2', start: at('10:00'), feederIds: [1], participants: [1] },
    ], base)).toEqual([]);
  });
});
