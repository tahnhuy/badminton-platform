import { eq, sql } from 'drizzle-orm';
import { db } from '../../index';
import { users } from '../../schema/users';
import { passwordHasher } from '../../../services/auth/password-hasher';
import { reconciliationService } from '../../../services/finance/ReconciliationService';
import { ledgerProblems, resequenceLedger } from '../lib/ledger';
import { at } from '../lib/stamp';
import { DEMO_ADMIN, DEMO_OWNERS, DEMO_PASSWORD, DEMO_PLAYERS } from '../data/people';
import type { SeedContext } from '../context';

/** Final fix-ups and checks. Any problem fails the seed: a broken demo dataset is worse than none. */
export async function finalizeAndVerify(ctx: SeedContext): Promise<void> {
  const resequenced = await resequenceLedger();
  // wallet_accounts rows are created lazily by the first money movement: date them like the ledger.
  await db.execute(sql`
    UPDATE wallet_accounts a SET created_at = l.first_at, updated_at = l.last_at
    FROM (SELECT user_id, MIN(created_at) AS first_at, MAX(created_at) AS last_at FROM wallet_ledger_entries GROUP BY user_id) l
    WHERE a.user_id = l.user_id`);

  // People read their old notifications: only the last 3 days stay unread.
  await db.execute(sql`
    UPDATE notifications SET read_at = created_at + interval '2 hours'
    WHERE read_at IS NULL AND created_at < (now() AT TIME ZONE 'UTC') - interval '3 days'`);

  const problems = await ledgerProblems();

  // Every "something happened" timestamp must be in the past. Columns that legitimately point
  // to the future (expiries, schedules, lock windows, tournament dates) are excluded.
  const FUTURE_OK = new Set(['expires_at', 'locked_until', 'next_attempt_at', 'resend_available_at', 'booking_deadline_at', 'scheduled_at',
    'start_at', 'registration_start', 'registration_end', 'tournament_start', 'tournament_end', 'reminder_sent_for', 'last_seen_at']);
  const columns = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type LIKE 'timestamp%' AND table_name <> 'custom_migration_history'`);
  const soon = new Date(Date.now() + 60_000);
  for (const { table_name: table, column_name: column } of columns.rows as Array<{ table_name: string; column_name: string }>) {
    if (FUTURE_OK.has(column)) continue;
    const result = await db.execute(sql`SELECT COUNT(*) AS n FROM ${sql.identifier(table)} WHERE ${sql.identifier(column)} > ${await at(table, column, soon)}`);
    const n = Number((result.rows[0] as { n: string }).n);
    if (n > 0) problems.push(`${table}.${column}: ${n} rows dated in the future`);
  }

  // The Admin Finance reconciliation itself must find nothing (each range it offers + all data).
  for (const query of [{ range: 'today' }, { range: '7d' }, { range: '30d' }, { range: 'this_month' },
    { range: 'custom', startDate: ctx.clock.date(-60), endDate: ctx.clock.date(10) }]) {
    const report = await reconciliationService.run(query) as { discrepancies: Array<{ key: string; expected: string; actual: string }> };
    for (const d of report.discrepancies) problems.push(`reconciliation ${query.range}: ${d.key} expected ${d.expected}, actual ${d.actual}`);
  }

  const outbox = await db.execute(sql`SELECT COUNT(*) AS n FROM email_outbox`);
  if (Number((outbox.rows[0] as { n: string }).n) > 0) problems.push('email_outbox is not empty: the seed must never send e-mail');

  for (const email of [DEMO_ADMIN.email, DEMO_OWNERS[0].email, DEMO_PLAYERS[0].email]) {
    const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.email, email));
    if (!row || !(await passwordHasher.verify(DEMO_PASSWORD, row.hash))) problems.push(`${email}: cannot sign in with the demo password`);
  }

  if (problems.length > 0) throw new Error(`Seed verification failed:\n  - ${problems.join('\n  - ')}`);
  ctx.log(`Kiểm tra: sổ ví khớp số dư (${resequenced} dòng sắp lại theo thời gian), đối soát Tài chính 0 chỗ lệch, không gửi email, đăng nhập được`);
}

export async function printSummary(): Promise<void> {
  const tables = ['users', 'player_profiles', 'facilities', 'courts', 'court_pricings', 'court_owner_reviews', 'court_slot_blocks', 'bookings', 'payments', 'payment_refunds', 'owner_earning_settlements', 'wallet_top_ups', 'wallet_ledger_entries', 'wallet_holds', 'wallet_payout_requests', 'wallet_bank_accounts', 'posts', 'post_comments', 'post_reactions', 'user_blocks', 'conversations', 'messages', 'message_reactions', 'matchmaking_requests', 'matchmaking_invitations', 'matches', 'match_players', 'booking_cost_shares', 'player_ratings', 'tournaments', 'tournament_registrations', 'tournament_teams', 'tournament_matches', 'tournament_ranking_points', 'skill_rating_events', 'skill_level_changes', 'notifications'];
  const select = sql.join(tables.map(t => sql`(SELECT COUNT(*) FROM ${sql.identifier(t)}) AS ${sql.identifier(t)}`), sql`, `);
  const counts = (await db.execute(sql`SELECT ${select}`)).rows[0] as Record<string, string>;
  console.log('\nSố bản ghi:');
  for (const t of tables) console.log(`  ${t.padEnd(24)} ${counts[t]}`);
}
