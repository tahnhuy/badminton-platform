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

/**
 * Start-time row of §24.4 for a recruitment still OPEN at `start_at`:
 * Singles/Doubles not full → EXPIRE; GROUP below minimum or with no accepted member →
 * INSUFFICIENT_PLAYERS (checked first: without a roster there is nothing to play);
 * GROUP with the roster but no court → COURT_NOT_BOOKED; otherwise START.
 */
export function openStartOutcome(request: RosterShape, accepted: number, hasCourt: boolean): StartOutcome {
  if (request.matchType !== 'GROUP') return 'EXPIRE';
  if (!rosterSufficient(request, accepted)) return 'INSUFFICIENT_PLAYERS';
  return hasCourt ? 'START' : 'COURT_NOT_BOOKED';
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

/**
 * Effective recruitment status (lazy evaluation, §24.4): an OPEN recruitment past its
 * close (`expires_at`, = `start_at` for new rows) reads as the scheduler outcome —
 * Singles/Doubles EXPIRED; GROUP MATCHED when it would start, otherwise CANCELLED.
 * `alias` is a table alias or the bare table name.
 */
export function effectiveRecruitmentStatusSql(alias: string): SQL {
  return sql.raw(`(CASE
    WHEN ${alias}.status = 'OPEN' AND ${alias}.expires_at IS NOT NULL AND ${alias}.expires_at <= now() THEN
      CASE WHEN ${alias}.match_type <> 'GROUP' THEN 'EXPIRED'
           WHEN ${rosterSufficientSql(alias)} AND ${hasCourtSql(alias)} THEN 'MATCHED'
           ELSE 'CANCELLED' END
    ELSE ${alias}.status END)`);
}

/** TypeScript form of effectiveRecruitmentStatusSql for an already-loaded row. */
export function effectiveRecruitmentStatus(
  request: RosterShape & { status: string; expiresAt: Date | null },
  accepted: number,
  hasCourt: boolean,
  now: Date = new Date(),
): string {
  if (request.status !== 'OPEN' || !request.expiresAt || request.expiresAt.getTime() > now.getTime()) return request.status;
  const outcome = openStartOutcome(request, accepted, hasCourt);
  if (outcome === 'EXPIRE') return 'EXPIRED';
  return outcome === 'START' ? 'MATCHED' : 'CANCELLED';
}
