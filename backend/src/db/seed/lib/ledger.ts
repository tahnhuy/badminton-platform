import { sql } from 'drizzle-orm';
import { db } from '../../index';

/**
 * Steps create back-dated money events through real services, but not in global time order
 * (e.g. the tournament step runs after bookings that happen later). The ledger stores a
 * running `balance_after` in insertion order; recompute it in time order so wallet history
 * reads correctly. Final balances do not change (same entries, same sum).
 */
export async function resequenceLedger(): Promise<number> {
  const result = await db.execute(sql`
    WITH ordered AS (
      SELECT id, SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at, id) AS running
      FROM wallet_ledger_entries
    )
    UPDATE wallet_ledger_entries entry SET balance_after = ordered.running
    FROM ordered WHERE entry.id = ordered.id AND entry.balance_after <> ordered.running`);
  return result.rowCount ?? 0;
}

/** Problems that would make wallet pages or finance reconciliation wrong. */
export async function ledgerProblems(): Promise<string[]> {
  const problems: string[] = [];
  const mismatched = await db.execute(sql`
    SELECT a.user_id, a.balance, COALESCE(SUM(e.amount), 0) AS ledger
    FROM wallet_accounts a LEFT JOIN wallet_ledger_entries e ON e.user_id = a.user_id
    GROUP BY a.user_id, a.balance HAVING a.balance <> COALESCE(SUM(e.amount), 0)`);
  for (const row of mismatched.rows as Array<{ user_id: string; balance: string; ledger: string }>) {
    problems.push(`wallet ${row.user_id}: balance ${row.balance} ≠ ledger sum ${row.ledger}`);
  }
  const negative = await db.execute(sql`
    SELECT user_id, MIN(running) AS lowest FROM (
      SELECT user_id, SUM(amount) OVER (PARTITION BY user_id ORDER BY created_at, id) AS running FROM wallet_ledger_entries
    ) x GROUP BY user_id HAVING MIN(running) < 0`);
  for (const row of negative.rows as Array<{ user_id: string; lowest: string }>) {
    problems.push(`wallet ${row.user_id}: balance dips to ${row.lowest} in time order (top up earlier)`);
  }
  return problems;
}
