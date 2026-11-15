import { sql, type SQL } from 'drizzle-orm';

// Shared recruitment rules (Matchmaking Tech Design §24.4) used by acceptance, MM-25
// lifecycle actions, the MM-27 scheduler and effective-status reads, so a late scheduler
// tick and a read never disagree.

export interface RosterShape {
  matchType: string;
  capacity: number;
  minPlayers: number;
  companionCount: number;
}

export type StartOutcome = 'EXPIRE' | 'START' | 'COURT_NOT_BOOKED' | 'INSUFFICIENT_PLAYERS';

/** Booking statuses that count as a court (CONFIRMED linked booking, §24.4 Match states). */
export const COURT_BOOKING_STATUSES = ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] as const;

export function filledSlots(request: RosterShape, accepted: number): number {
  return 1 + request.companionCount + accepted;
}

export function isFull(request: RosterShape, accepted: number): boolean {
  return filledSlots(request, accepted) >= request.capacity;
}

/**
 * Roster condition to form or start a Match: Singles/Doubles full; GROUP at least the
 * minimum (host + companions + accepted) and at least 1 accepted registered member.
 */
export function rosterSufficient(request: RosterShape, accepted: number): boolean {
  if (request.matchType !== 'GROUP') return isFull(request, accepted);
  return filledSlots(request, accepted) >= request.minPlayers && accepted >= 1;
}

// ------------------------------------------------------------------- SQL forms

const acceptedSql = (alias: string) =>
  `(SELECT count(*) FROM matchmaking_invitations sx_mi WHERE sx_mi.request_id = ${alias}.id AND sx_mi.status = 'ACCEPTED')`;

/** SQL form of rosterSufficient over a matchmaking_requests alias. */
export function rosterSufficientSql(alias: string): string {
  const accepted = acceptedSql(alias);
  return `(CASE WHEN ${alias}.match_type = 'GROUP'
      THEN 1 + ${alias}.companion_count + ${accepted} >= ${alias}.min_players AND ${accepted} >= 1
      ELSE 1 + ${alias}.companion_count + ${accepted} >= ${alias}.capacity END)`;
}

/** Recruitment has a court: declared external court or a CONFIRMED linked booking. */
export function hasCourtSql(alias: string): string {
  return `(${alias}.external_court_name IS NOT NULL OR EXISTS (
      SELECT 1 FROM bookings sx_b WHERE sx_b.id = ${alias}.booking_id
        AND sx_b.status IN (${COURT_BOOKING_STATUSES.map(s => `'${s}'`).join(', ')})))`;
}

/** OPEN recruitments expire without automatic host confirmation. */
export function effectiveRecruitmentStatusSql(alias: string): SQL {
  return sql.raw(`(CASE
    WHEN ${alias}.status = 'OPEN' AND (${alias}.start_at <= now() OR ${alias}.expires_at <= now()) THEN 'EXPIRED'
    ELSE ${alias}.status END)`);
}

export function effectiveRecruitmentStatus(
  request: RosterShape & { status: string; expiresAt: Date | null; startAt?: Date },
  _accepted: number,
  _hasCourt: boolean,
  now: Date = new Date(),
): string {
  if (request.status === 'OPEN' && ((request.expiresAt && request.expiresAt <= now) || (request.startAt && request.startAt <= now))) return 'EXPIRED';
  return request.status;
}
