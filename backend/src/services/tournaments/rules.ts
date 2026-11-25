/**
 * Pure tournament rules (Tournament Tech Design §6, matrix §4.4, §4.11). No I/O.
 */

export const TOURNAMENT_STATUSES = [
  'DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const TERMINAL_STATUSES: readonly TournamentStatus[] = ['COMPLETED', 'CANCELLED'];
/** States the Organizer may cancel from (matrix §4.3). Admin: any non-terminal state. */
export const ORGANIZER_CANCELLABLE: readonly TournamentStatus[] = ['DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY'];

// ---------------------------------------------------------------- eligibility

export type IneligibleReason = 'BELOW_MIN_LEVEL' | 'ABOVE_MAX_LEVEL';

/** Skill eligibility (matrix §4.11): no bound means any level; bounds are inclusive ranks. */
export function checkEligibility(
  bounds: { minRank: number | null; maxRank: number | null },
  playerRank: number,
): IneligibleReason | null {
  if (bounds.minRank !== null && playerRank < bounds.minRank) return 'BELOW_MIN_LEVEL';
  if (bounds.maxRank !== null && playerRank > bounds.maxRank) return 'ABOVE_MAX_LEVEL';
  return null;
}

// ---------------------------------------------------------------- fields and editing

export interface TournamentFields {
  name: string;
  description: string | null;
  matchType: 'SINGLES' | 'DOUBLES';
  participantLimit: number;
  entryFee: number;
  minSkillLevelId: number | null;
  maxSkillLevelId: number | null;
  venueNote: string | null;
  registrationStart: Date;
  registrationEnd: Date;
  tournamentStart: Date;
  tournamentEnd: Date;
  courtCount: number;
  matchDurationMinutes: number;
  minRestMinutes: number;
  dailyStartTime: string; // HH:mm
  dailyEndTime: string; // HH:mm
}
export type TournamentField = keyof TournamentFields;

const ALWAYS_EDITABLE_WHEN_CLOSED: readonly TournamentField[] = [
  'description', 'venueNote', 'courtCount', 'matchDurationMinutes', 'minRestMinutes', 'dailyStartTime', 'dailyEndTime',
];

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

/** Fields of `patch` whose value actually differs from `current`. */
export function changedFields(current: TournamentFields, patch: Partial<TournamentFields>): TournamentField[] {
  return (Object.keys(patch) as TournamentField[]).filter(key => patch[key] !== undefined && !sameValue(patch[key], current[key]));
}

/**
 * Editing rules by status (Tech Design §6.2, matrix §4.4). Returns the changed fields
 * that are locked; an empty list means the patch is allowed.
 */
export function lockedFields(
  status: TournamentStatus,
  current: TournamentFields,
  patch: Partial<TournamentFields>,
  context: { confirmedCount: number; now: Date },
): TournamentField[] {
  const changed = changedFields(current, patch);
  if (status === 'DRAFT') return [];
  if (TERMINAL_STATUSES.includes(status)) return changed;
  if (status !== 'OPEN_FOR_REGISTRATION') {
    return changed.filter(field => !ALWAYS_EDITABLE_WHEN_CLOSED.includes(field));
  }
  return changed.filter(field => {
    switch (field) {
      case 'matchType':
        return true;
      case 'registrationStart':
        return current.registrationStart.getTime() <= context.now.getTime();
      case 'registrationEnd':
        return patch.registrationEnd!.getTime() < current.registrationEnd.getTime();
      case 'participantLimit':
        return patch.participantLimit! < context.confirmedCount;
      case 'entryFee':
      case 'minSkillLevelId':
      case 'maxSkillLevelId':
        return context.confirmedCount > 0;
      default:
        return false;
    }
  });
}

// ---------------------------------------------------------------- consistency

export interface FieldProblem {
  field: TournamentField;
  code: string;
}

function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Cross-field rules (Tech Design §6.1). `levelRanks` maps skill level id → rank for the
 * referenced levels; an id missing from it is unknown.
 */
export function validateTournamentFields(fields: TournamentFields, levelRanks: Map<number, number>): FieldProblem[] {
  const problems: FieldProblem[] = [];
  const { registrationStart: rs, registrationEnd: re, tournamentStart: ts, tournamentEnd: te } = fields;
  if (!(rs < re)) problems.push({ field: 'registrationEnd', code: 'REGISTRATION_END_BEFORE_START' });
  if (!(re <= ts)) problems.push({ field: 'tournamentStart', code: 'TOURNAMENT_START_BEFORE_REGISTRATION_END' });
  if (!(ts < te)) problems.push({ field: 'tournamentEnd', code: 'TOURNAMENT_END_BEFORE_START' });

  const window = minutesOf(fields.dailyEndTime) - minutesOf(fields.dailyStartTime);
  if (window <= 0) problems.push({ field: 'dailyEndTime', code: 'DAILY_WINDOW_EMPTY' });
  else if (window < fields.matchDurationMinutes) problems.push({ field: 'matchDurationMinutes', code: 'MATCH_LONGER_THAN_DAILY_WINDOW' });

  const minRank = fields.minSkillLevelId === null ? null : levelRanks.get(fields.minSkillLevelId);
  const maxRank = fields.maxSkillLevelId === null ? null : levelRanks.get(fields.maxSkillLevelId);
  if (minRank === undefined) problems.push({ field: 'minSkillLevelId', code: 'UNKNOWN_SKILL_LEVEL' });
  if (maxRank === undefined) problems.push({ field: 'maxSkillLevelId', code: 'UNKNOWN_SKILL_LEVEL' });
  if (typeof minRank === 'number' && typeof maxRank === 'number' && minRank > maxRank) {
    problems.push({ field: 'maxSkillLevelId', code: 'MAX_LEVEL_BELOW_MIN_LEVEL' });
  }
  return problems;
}
