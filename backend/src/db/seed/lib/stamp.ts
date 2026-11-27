import { sql } from 'drizzle-orm';
import { db } from '../../index';

/**
 * Time travel for demo history. Services always write `now()`; `stampAt(time, fn)` runs real
 * service calls, then moves every row those calls INSERTED into the tracked tables to `time`
 * (each column keeps its offset from creation, e.g. a top-up expiry stays +15 min).
 *
 * Only new rows (id above the snapshot) are touched. Rows a service UPDATES (a review being
 * decided, a facility changing status) must be fixed by the step that knows about them.
 * Tables with immutable-row triggers (player_ratings, player_skill_adjustments) are never
 * listed here: their steps insert them with the final timestamps.
 */
type ColumnRule = { column: string; offsetSeconds?: number };

const TRACKED: Record<string, ColumnRule[]> = {
  notifications: [{ column: 'created_at' }],
  admin_action_audits: [{ column: 'created_at' }],
  finance_audit_events: [{ column: 'created_at' }],
  facilities: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'confirmed_at' }],
  courts: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'confirmed_at' }],
  court_pricings: [{ column: 'created_at' }, { column: 'updated_at' }],
  court_owner_reviews: [{ column: 'created_at' }, { column: 'reviewed_at' }],
  court_profile_changes: [{ column: 'created_at' }],
  facility_status_audits: [{ column: 'created_at' }],
  court_slot_blocks: [{ column: 'created_at' }, { column: 'updated_at' }],
  wallet_top_ups: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'paid_at' }, { column: 'expires_at', offsetSeconds: 15 * 60 }],
  wallet_ledger_entries: [{ column: 'created_at' }],
  wallet_bank_accounts: [{ column: 'created_at' }],
  wallet_holds: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'captured_at' }, { column: 'released_at' }],
  wallet_payout_requests: [{ column: 'requested_at' }, { column: 'created_at' }, { column: 'updated_at' }, { column: 'reviewed_at' }, { column: 'paid_at' }],
  // A new hold keeps its payment window (BOOKING_PAYMENT_TIMEOUT_MINUTES = 10).
  bookings: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'expires_at', offsetSeconds: 10 * 60 }, { column: 'cancelled_at' }],
  booking_pricing_details: [{ column: 'created_at' }],
  booking_cost_shares: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'paid_at' }, { column: 'refunded_at' }],
  payments: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'paid_at' }],
  owner_earning_settlements: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'decided_at' }],
  posts: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'published_at' }],
  // Matchmaking: start/expiry columns are scheduling data and are set by the step itself.
  matchmaking_requests: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'closed_early_at' }],
  matchmaking_invitations: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'responded_at' }],
  matchmaking_matches: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'matched_at' }],
  matches: [{ column: 'created_at' }, { column: 'updated_at' }],
  match_players: [{ column: 'joined_at' }, { column: 'created_at' }, { column: 'updated_at' }],
  // Tournaments: registration/tournament dates are scheduling data, set by the step itself.
  tournaments: [{ column: 'created_at' }, { column: 'updated_at' }],
  tournament_registrations: [{ column: 'registered_at' }, { column: 'updated_at' }, { column: 'cancelled_at' }, { column: 'refunded_at' }],
  tournament_teams: [{ column: 'created_at' }, { column: 'updated_at' }],
  tournament_team_players: [{ column: 'joined_at' }, { column: 'created_at' }, { column: 'updated_at' }],
  team_invitations: [{ column: 'created_at' }, { column: 'updated_at' }, { column: 'responded_at' }, { column: 'expires_at', offsetSeconds: 1440 * 60 }],
  tournament_matches: [{ column: 'created_at' }, { column: 'updated_at' }],
  tournament_ranking_points: [{ column: 'created_at' }, { column: 'completed_at' }],
  skill_rating_events: [{ column: 'created_at' }],
  skill_level_changes: [{ column: 'created_at' }],
  post_comments: [{ column: 'created_at' }],
  messages: [{ column: 'created_at' }],
  conversations: [{ column: 'created_at' }, { column: 'last_message_at' }],
};

const TABLES = Object.keys(TRACKED);

async function snapshot(): Promise<Record<string, number>> {
  const select = sql.join(TABLES.map(table => sql`(SELECT COALESCE(MAX(id), 0) FROM ${sql.identifier(table)}) AS ${sql.identifier(table)}`), sql`, `);
  const result = await db.execute(sql`SELECT ${select}`);
  const row = result.rows[0] as Record<string, string | number>;
  return Object.fromEntries(TABLES.map(table => [table, Number(row[table])]));
}

let withTimeZone: Set<string> | null = null;

/** `table.column` names typed `timestamp with time zone` (Social/Messaging use them; most tables do not). */
export async function timeZoneColumns(): Promise<Set<string>> {
  if (!withTimeZone) {
    const result = await db.execute(sql`SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp with time zone'`);
    withTimeZone = new Set((result.rows as Array<{ table_name: string; column_name: string }>).map(r => `${r.table_name}.${r.column_name}`));
  }
  return withTimeZone;
}

/** The right SQL value for `table.column`, whatever its timestamp type and the session time zone. */
export async function at(table: string, column: string, date: Date) {
  return (await timeZoneColumns()).has(`${table}.${column}`) ? tsz(date) : ts(date);
}

export async function stampAt<T>(time: Date, fn: () => Promise<T>): Promise<T> {
  const before = await snapshot();
  const result = await fn();
  for (const table of TABLES) {
    const parts = [];
    for (const { column, offsetSeconds = 0 } of TRACKED[table]) {
      parts.push(sql`${sql.identifier(column)} = CASE WHEN ${sql.identifier(column)} IS NULL THEN NULL ELSE ${await at(table, column, time)} + make_interval(secs => ${offsetSeconds}) END`);
    }
    const sets = sql.join(parts, sql`, `);
    await db.execute(sql`UPDATE ${sql.identifier(table)} SET ${sets} WHERE id > ${before[table]}`);
  }
  return result;
}

/**
 * A Date as a SQL value for `timestamp without time zone` columns holding UTC. Never put a raw
 * Date into sql``: node-pg sends local time with an offset that the column silently drops.
 */
export function ts(date: Date) {
  return sql`(${date.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/** A Date for `timestamp with time zone` columns (an absolute instant; session time zone irrelevant). */
export function tsz(date: Date) {
  return sql`(${date.toISOString()}::timestamptz)`;
}
