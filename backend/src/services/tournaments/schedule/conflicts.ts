import { VN_UTC_OFFSET_MINUTES } from './scheduleGenerator';

/**
 * Schedule warnings after manual edits (Tournament Tech Design §7.4). Pure. Warnings never
 * block a save; they tell the Organizer what to look at.
 */

export type ScheduleWarningCode =
  | 'COURT_OVERLAP'
  | 'PARTICIPANT_OVERLAP'
  | 'REST_TOO_SHORT'
  | 'BEFORE_FEEDER'
  | 'OUTSIDE_DAILY_WINDOW'
  | 'OUTSIDE_TOURNAMENT_DATES';

export interface ScheduleWarning {
  matchId: number;
  code: ScheduleWarningCode;
  /** The other match involved (overlaps, rest, feeder). */
  otherMatchId?: number;
  participantId?: number;
}

export interface ConflictMatch {
  id: number;
  courtLabel: string | null;
  start: Date;
  feederIds: number[];
  participants: number[];
}

export interface ConflictSettings {
  durationMinutes: number;
  restMinutes: number;
  dayStartMinutes: number;
  dayEndMinutes: number;
  tournamentStart: Date;
  tournamentEnd: Date;
  utcOffsetMinutes?: number;
}

const MINUTE = 60_000;
export const normaliseCourtLabel = (label: string | null) => (label ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');

export function findScheduleConflicts(matches: readonly ConflictMatch[], settings: ConflictSettings): ScheduleWarning[] {
  const d = settings.durationMinutes * MINUTE;
  const rest = settings.restMinutes * MINUTE;
  const offset = (settings.utcOffsetMinutes ?? VN_UTC_OFFSET_MINUTES) * MINUTE;
  const byId = new Map(matches.map(m => [m.id, m]));
  const warnings: ScheduleWarning[] = [];
  const startOf = (m: ConflictMatch) => m.start.getTime();

  for (const m of matches) {
    const start = startOf(m);
    const local = start + offset;
    const minuteOfDay = ((local % (1440 * MINUTE)) + 1440 * MINUTE) % (1440 * MINUTE) / MINUTE;
    if (minuteOfDay < settings.dayStartMinutes || minuteOfDay + settings.durationMinutes > settings.dayEndMinutes) {
      warnings.push({ matchId: m.id, code: 'OUTSIDE_DAILY_WINDOW' });
    }
    if (start < settings.tournamentStart.getTime() || start + d > settings.tournamentEnd.getTime()) {
      warnings.push({ matchId: m.id, code: 'OUTSIDE_TOURNAMENT_DATES' });
    }
    for (const feederId of m.feederIds) {
      const feeder = byId.get(feederId);
      if (feeder && start < startOf(feeder) + d) warnings.push({ matchId: m.id, code: 'BEFORE_FEEDER', otherMatchId: feederId });
    }
  }

  for (let i = 0; i < matches.length; i += 1) {
    for (let j = i + 1; j < matches.length; j += 1) {
      const a = matches[i];
      const b = matches[j];
      const [first, second] = startOf(a) <= startOf(b) ? [a, b] : [b, a];
      const gap = startOf(second) - (startOf(first) + d);
      const overlap = gap < 0;
      const label = normaliseCourtLabel(a.courtLabel);
      if (overlap && label !== '' && label === normaliseCourtLabel(b.courtLabel)) {
        warnings.push({ matchId: second.id, code: 'COURT_OVERLAP', otherMatchId: first.id });
      }
      for (const p of a.participants) {
        if (!b.participants.includes(p)) continue;
        if (overlap) warnings.push({ matchId: second.id, code: 'PARTICIPANT_OVERLAP', otherMatchId: first.id, participantId: p });
        else if (gap < rest) warnings.push({ matchId: second.id, code: 'REST_TOO_SHORT', otherMatchId: first.id, participantId: p });
      }
    }
  }
  return warnings;
}
