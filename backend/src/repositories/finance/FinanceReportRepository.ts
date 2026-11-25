import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { FinanceBounds } from '../../services/finance/finance-range';

export type RevenueGroupBy = 'day' | 'source' | 'owner';

export interface FinanceTotals {
  cashIn: string;
  cashOut: string;
  grossRevenue: string;
  refunds: string;
  netEstimated: string;
  ownerEarnings: string;
}

export interface RevenueRow {
  key: string;
  label: string;
  gross: string;
  refunds: string;
  net: string;
  ownerEarnings: string;
}

export interface ReconciliationAggregatePair {
  expected: string;
  actual: string;
}

export interface ReconciliationUserBalance {
  user_id: number | string;
  balance: string;
  ledger_total: string;
}

export interface ReconciliationUnmatched {
  top_up_ids: Array<number | string>;
  payout_ids: Array<number | string>;
  refund_payment_ids: Array<number | string>;
  payment_ids: Array<number | string>;
  owner_booking_ids: Array<number | string>;
}

export class FinanceReportRepository {
  async cashFlow(bounds: FinanceBounds): Promise<FinanceTotals> {
    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(amount) FROM wallet_top_ups
          WHERE status = 'SUCCESS'
            AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS cash_in,
        COALESCE((SELECT SUM(amount) FROM wallet_payout_requests
          WHERE status = 'PAID'
            AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS cash_out,
        COALESCE((SELECT SUM(amount) FROM payments
          WHERE status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
            AND paid_at IS NOT NULL
            AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS gross_revenue,
        COALESCE((SELECT SUM(payment.amount) FROM payment_refunds r
          JOIN payments payment ON payment.id = r.payment_id
          WHERE r.status = 'REFUNDED'
            AND r.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND r.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS refunds,
        COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries
          WHERE entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
            AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS owner_earnings
    `);
    const row = result.rows[0] as any;
    const gross = Number(row.gross_revenue ?? 0);
    const refunds = Number(row.refunds ?? 0);
    return {
      cashIn: Number(row.cash_in ?? 0).toFixed(2),
      cashOut: Number(row.cash_out ?? 0).toFixed(2),
      grossRevenue: Number(row.gross_revenue ?? 0).toFixed(2),
      refunds: Number(row.refunds ?? 0).toFixed(2),
      netEstimated: (gross - refunds).toFixed(2),
      ownerEarnings: Number(row.owner_earnings ?? 0).toFixed(2),
    };
  }

  async revenueRows(bounds: FinanceBounds, groupBy: RevenueGroupBy): Promise<RevenueRow[]> {
    if (groupBy === 'day') {
      const result = await db.execute(sql`
        WITH days AS (
          SELECT to_char(d.day::date, 'YYYY-MM-DD') AS day
          FROM generate_series(${bounds.startDate}::date, ${bounds.endDate}::date, interval '1 day') AS d(day)
        ),
        gross AS (
          SELECT to_char((((paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date, 'YYYY-MM-DD') AS day,
                 SUM(amount)::text AS amount
          FROM payments
          WHERE status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
            AND paid_at IS NOT NULL
            AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
          GROUP BY 1
        ),
        refunded AS (
          SELECT to_char((((r.completed_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date, 'YYYY-MM-DD') AS day,
                 SUM(payment.amount)::text AS amount
          FROM payment_refunds r
          JOIN payments payment ON payment.id = r.payment_id
          WHERE r.status = 'REFUNDED'
            AND r.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND r.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
          GROUP BY 1
        ),
        earnings AS (
          SELECT to_char((((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'))::date, 'YYYY-MM-DD') AS day,
                 SUM(amount)::text AS amount
          FROM wallet_ledger_entries
          WHERE entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
            AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
          GROUP BY 1
        )
        SELECT d.day AS key, d.day AS label,
               COALESCE(g.amount, '0') AS gross,
               COALESCE(r.amount, '0') AS refunds,
               (COALESCE(g.amount, '0')::numeric - COALESCE(r.amount, '0')::numeric)::text AS net,
               COALESCE(e.amount, '0') AS owner_earnings
        FROM days d
        LEFT JOIN gross g ON g.day = d.day
        LEFT JOIN refunded r ON r.day = d.day
        LEFT JOIN earnings e ON e.day = d.day
        ORDER BY d.day ASC
      `);
      return result.rows.map((row: any) => ({
        key: row.key,
        label: row.label,
        gross: Number(row.gross).toFixed(2),
        refunds: Number(row.refunds).toFixed(2),
        net: Number(row.net).toFixed(2),
        ownerEarnings: Number(row.owner_earnings).toFixed(2),
      }));
    }

    if (groupBy === 'source') {
      const result = await db.execute(sql`
        WITH gross AS (
          SELECT CASE WHEN p.booking_id IS NOT NULL THEN 'booking' ELSE 'registration' END AS key,
                 SUM(p.amount)::text AS amount
          FROM payments p
          WHERE p.status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
            AND p.paid_at IS NOT NULL
            AND p.paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND p.paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
          GROUP BY 1
        ),
        refunded AS (
          SELECT CASE WHEN payment.booking_id IS NOT NULL THEN 'booking' ELSE 'registration' END AS key, SUM(payment.amount)::text AS amount
          FROM payment_refunds r
          JOIN payments payment ON payment.id = r.payment_id
          WHERE r.status = 'REFUNDED'
            AND r.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND r.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
          GROUP BY 1
        )
        SELECT s.key, s.label,
               COALESCE(g.amount, '0') AS gross,
               COALESCE(r.amount, '0') AS refunds,
               (COALESCE(g.amount, '0')::numeric - COALESCE(r.amount, '0')::numeric)::text AS net,
               CASE WHEN s.key = 'booking' THEN COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries
                 WHERE entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
                   AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
                   AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)
               ELSE COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries
                 WHERE entry_type = 'TOURNAMENT_EARNING'
                   AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
                   AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0) END::text AS owner_earnings
        FROM (VALUES ('booking', 'Booking'), ('registration', 'Giải đấu')) AS s(key, label)
        LEFT JOIN gross g ON g.key = s.key
        LEFT JOIN refunded r ON r.key = s.key
        ORDER BY s.key
      `);
      return result.rows.map((row: any) => ({
        key: row.key,
        label: row.label,
        gross: Number(row.gross).toFixed(2),
        refunds: Number(row.refunds).toFixed(2),
        net: Number(row.net).toFixed(2),
        ownerEarnings: Number(row.owner_earnings ?? 0).toFixed(2),
      }));
    }

    const result = await db.execute(sql`
      WITH gross AS (
        SELECT f.owner_id::text AS key, u.email AS label, SUM(p.amount)::text AS amount
        FROM payments p
        INNER JOIN bookings b ON b.id = p.booking_id
        INNER JOIN courts c ON c.id = b.court_id
        INNER JOIN facilities f ON f.id = c.facility_id
        INNER JOIN users u ON u.id = f.owner_id
        WHERE p.status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
          AND p.paid_at IS NOT NULL
          AND p.paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND p.paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY f.owner_id, u.email
      ),
      refunded AS (
        SELECT f.owner_id::text AS key, SUM(payment.amount)::text AS amount
        FROM payment_refunds r
        INNER JOIN payments payment ON payment.id = r.payment_id
        INNER JOIN bookings b ON b.id = payment.booking_id
        INNER JOIN courts c ON c.id = b.court_id
        INNER JOIN facilities f ON f.id = c.facility_id
        WHERE r.status = 'REFUNDED'
          AND r.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND r.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY f.owner_id
      ),
      earnings AS (
        SELECT l.user_id::text AS key, SUM(l.amount)::text AS amount
        FROM wallet_ledger_entries l
        WHERE l.entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
          AND l.created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND l.created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY l.user_id
      ),
      owners AS (
        SELECT key FROM gross
        UNION SELECT key FROM refunded
        UNION SELECT key FROM earnings
      )
      SELECT o.key, u.email AS label,
             COALESCE(g.amount, '0') AS gross,
             COALESCE(r.amount, '0') AS refunds,
             (COALESCE(g.amount, '0')::numeric - COALESCE(r.amount, '0')::numeric)::text AS net,
             COALESCE(e.amount, '0') AS owner_earnings
      FROM owners o
      INNER JOIN users u ON u.id::text = o.key
      LEFT JOIN gross g ON g.key = o.key
      LEFT JOIN refunded r ON r.key = o.key
      LEFT JOIN earnings e ON e.key = o.key
      ORDER BY o.key
    `);
    return result.rows.map((row: any) => ({
      key: row.key,
      label: row.label,
      gross: Number(row.gross).toFixed(2),
      refunds: Number(row.refunds).toFixed(2),
      net: Number(row.net).toFixed(2),
      ownerEarnings: Number(row.owner_earnings).toFixed(2),
    }));
  }

  async reconciliationPairs(bounds: FinanceBounds): Promise<{
    topUp: ReconciliationAggregatePair;
    payment: ReconciliationAggregatePair;
    refund: ReconciliationAggregatePair;
    payout: ReconciliationAggregatePair;
    ownerEarning: ReconciliationAggregatePair;
    tournamentEarning: ReconciliationAggregatePair;
  }> {
    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(amount) FROM wallet_top_ups WHERE status = 'SUCCESS'
          AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS topup_expected,
        COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries WHERE entry_type = 'TOP_UP'
          AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS topup_actual,
        COALESCE((SELECT SUM(amount) FROM payments
          WHERE status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
            AND paid_at IS NOT NULL
            AND provider IN ('WALLET', 'WALLET_SPLIT') AND (booking_id IS NOT NULL OR registration_id IS NOT NULL)
            AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS payment_expected,
        COALESCE((SELECT -SUM(amount) FROM wallet_ledger_entries WHERE entry_type = 'PAYMENT'
          AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS payment_actual,
        COALESCE((SELECT SUM(payment.amount) FROM payment_refunds r
          JOIN payments payment ON payment.id = r.payment_id
          WHERE r.status = 'REFUNDED' AND payment.provider IN ('WALLET', 'WALLET_SPLIT')
            AND (payment.booking_id IS NOT NULL OR payment.registration_id IS NOT NULL)
            AND r.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND r.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS refund_expected,
        COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries WHERE entry_type = 'REFUND'
          AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS refund_actual,
        COALESCE((SELECT SUM(amount) FROM wallet_payout_requests WHERE status = 'PAID'
          AND paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS payout_expected,
        COALESCE((SELECT -SUM(amount) FROM wallet_ledger_entries WHERE entry_type IN ('WITHDRAWAL', 'PAYOUT')
          AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS payout_actual,
        COALESCE((SELECT SUM(b.total_amount) FROM bookings b
          WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
            AND EXISTS (
              SELECT 1 FROM payments p
              WHERE p.booking_id = b.id AND p.status = 'SUCCESS'
                AND p.paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
                AND p.paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
            )
            AND NOT EXISTS (
              SELECT 1 FROM owner_earning_settlements s
              WHERE s.booking_id = b.id AND s.status IN ('PENDING', 'REJECTED')
            )
            AND NOT EXISTS (
              SELECT 1 FROM wallet_ledger_entries l
              WHERE l.entry_type = 'OWNER_EARNING_REVERSAL'
                AND l.reference_type = 'BOOKING'
                AND l.reference_id = b.id
            )), 0)::text AS owner_expected,
        COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries WHERE entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
          AND created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS owner_actual,
        -- Organizer payouts: unrefunded fees of tournaments completed in the range (TRN-17).
        COALESCE((SELECT SUM(tr.paid_amount) FROM tournament_registrations tr JOIN tournaments t ON t.id = tr.tournament_id
          WHERE t.status = 'COMPLETED' AND tr.status = 'CONFIRMED' AND tr.refunded_at IS NULL
            AND t.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND t.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS tournament_expected,
        COALESCE((SELECT SUM(l.amount) FROM wallet_ledger_entries l JOIN tournaments t ON t.id = l.reference_id
          WHERE l.entry_type = 'TOURNAMENT_EARNING' AND l.reference_type = 'TOURNAMENT'
            AND t.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND t.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')), 0)::text AS tournament_actual
    `);
    const row = result.rows[0] as any;
    return {
      topUp: { expected: String(row.topup_expected), actual: String(row.topup_actual) },
      payment: { expected: String(row.payment_expected), actual: String(row.payment_actual) },
      refund: { expected: String(row.refund_expected), actual: String(row.refund_actual) },
      payout: { expected: String(row.payout_expected), actual: String(row.payout_actual) },
      ownerEarning: { expected: String(row.owner_expected), actual: String(row.owner_actual) },
      tournamentEarning: { expected: String(row.tournament_expected), actual: String(row.tournament_actual) },
    };
  }

  // Derive outstanding recovery from durable payment/refund/ledger records.
  // A note cannot hide debt: it disappears only after a matching reversal posts.
  async outstandingOwnerReversals() {
    const result = await db.execute(sql`
      SELECT l.reference_id AS booking_id, l.user_id AS owner_id,
             l.amount::text AS amount
      FROM wallet_ledger_entries l
      WHERE l.entry_type = 'OWNER_EARNING' AND l.reference_type = 'BOOKING'
        AND EXISTS (SELECT 1 FROM payments p JOIN payment_refunds r ON r.payment_id = p.id
                    WHERE p.booking_id = l.reference_id AND r.status = 'REFUNDED')
        AND NOT EXISTS (SELECT 1 FROM wallet_ledger_entries reversal
                        WHERE reversal.entry_type = 'OWNER_EARNING_REVERSAL'
                          AND reversal.reference_type = 'BOOKING'
                          AND reversal.reference_id = l.reference_id)
      ORDER BY l.reference_id
    `);
    return result.rows as unknown as { booking_id: number; owner_id: number; amount: string }[];
  }

  async reconciliationWallets(): Promise<ReconciliationUserBalance[]> {
    const result = await db.execute(sql`
      SELECT w.user_id,
             w.balance::text AS balance,
             COALESCE(SUM(l.amount), 0)::text AS ledger_total
      FROM wallet_accounts w
      LEFT JOIN wallet_ledger_entries l ON l.user_id = w.user_id
      GROUP BY w.user_id, w.balance
      ORDER BY w.user_id
    `);
    return result.rows as unknown as ReconciliationUserBalance[];
  }

  async reconciliationUnmatched(): Promise<ReconciliationUnmatched> {
    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT json_agg(id ORDER BY id) FROM (
          SELECT t.id FROM wallet_top_ups t
          WHERE t.status = 'SUCCESS'
            AND NOT EXISTS (SELECT 1 FROM wallet_ledger_entries l WHERE l.entry_type = 'TOP_UP' AND l.reference_type = 'TOP_UP' AND l.reference_id = t.id)
          LIMIT 500
        ) q), '[]'::json) AS top_up_ids,
        COALESCE((SELECT json_agg(id ORDER BY id) FROM (
          SELECT p.id FROM wallet_payout_requests p
          WHERE p.status = 'PAID'
            AND NOT EXISTS (SELECT 1 FROM wallet_ledger_entries l WHERE l.entry_type IN ('WITHDRAWAL', 'PAYOUT') AND l.reference_id = p.id)
          LIMIT 500
        ) q), '[]'::json) AS payout_ids,
        COALESCE((SELECT json_agg(payment_id ORDER BY payment_id) FROM (
          SELECT r.payment_id FROM payment_refunds r
          INNER JOIN payments p ON p.id = r.payment_id
          WHERE r.status = 'REFUNDED' AND p.provider IN ('WALLET', 'WALLET_SPLIT') AND p.booking_id IS NOT NULL
            AND ((SELECT COALESCE(SUM(l.amount), 0) FROM wallet_ledger_entries l WHERE l.entry_type = 'REFUND' AND l.reference_type = 'BOOKING' AND l.reference_id = p.booking_id) <> p.amount
              OR (p.provider = 'WALLET_SPLIT' AND EXISTS (
                SELECT 1 FROM booking_cost_shares share WHERE share.payment_id = p.id
                  AND (SELECT COALESCE(SUM(l.amount), 0) FROM wallet_ledger_entries l
                       WHERE l.entry_type = 'REFUND' AND l.reference_type = 'BOOKING'
                         AND l.reference_id = p.booking_id AND l.user_id = share.player_id) <> share.amount
              )))
          UNION
          SELECT r.payment_id FROM payment_refunds r
          INNER JOIN payments p ON p.id = r.payment_id
          WHERE r.status = 'REFUNDED' AND p.registration_id IS NOT NULL
            AND (SELECT COALESCE(SUM(l.amount), 0) FROM wallet_ledger_entries l
                 WHERE l.entry_type = 'REFUND' AND l.reference_type = 'TOURNAMENT_REGISTRATION' AND l.reference_id = p.registration_id) <> p.amount
          LIMIT 500
        ) q), '[]'::json) AS refund_payment_ids,
        COALESCE((SELECT json_agg(id ORDER BY id) FROM (
          SELECT p.id FROM payments p
          WHERE p.status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED') AND p.provider IN ('WALLET', 'WALLET_SPLIT') AND p.booking_id IS NOT NULL
            AND ((SELECT COALESCE(-SUM(l.amount), 0) FROM wallet_ledger_entries l WHERE l.entry_type = 'PAYMENT' AND l.reference_type = 'BOOKING' AND l.reference_id = p.booking_id) <> p.amount
              OR (p.provider = 'WALLET_SPLIT' AND EXISTS (
                SELECT 1 FROM booking_cost_shares share WHERE share.payment_id = p.id
                  AND (SELECT COALESCE(-SUM(l.amount), 0) FROM wallet_ledger_entries l
                       WHERE l.entry_type = 'PAYMENT' AND l.reference_type = 'BOOKING'
                         AND l.reference_id = p.booking_id AND l.user_id = share.player_id) <> share.amount
              )))
          UNION
          SELECT p.id FROM payments p
          WHERE p.registration_id IS NOT NULL AND p.provider = 'WALLET'
            AND p.status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
            AND (SELECT COALESCE(-SUM(l.amount), 0) FROM wallet_ledger_entries l
                 WHERE l.entry_type = 'PAYMENT' AND l.reference_type = 'TOURNAMENT_REGISTRATION' AND l.reference_id = p.registration_id) <> p.amount
          LIMIT 500
        ) q), '[]'::json) AS payment_ids
        ,COALESCE((SELECT json_agg(id ORDER BY id) FROM (
          SELECT b.id FROM bookings b
          WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
            AND EXISTS (SELECT 1 FROM payments p WHERE p.booking_id = b.id AND p.status = 'SUCCESS')
            AND NOT EXISTS (SELECT 1 FROM wallet_ledger_entries l WHERE l.entry_type = 'OWNER_EARNING' AND l.reference_type = 'BOOKING' AND l.reference_id = b.id)
            AND NOT EXISTS (SELECT 1 FROM owner_earning_settlements s WHERE s.booking_id = b.id)
          LIMIT 500
        ) q), '[]'::json) AS owner_booking_ids
    `);
    const row = result.rows[0] as any;
    return {
      top_up_ids: row.top_up_ids ?? [],
      payout_ids: row.payout_ids ?? [],
      refund_payment_ids: row.refund_payment_ids ?? [],
      payment_ids: row.payment_ids ?? [],
      owner_booking_ids: row.owner_booking_ids ?? [],
    };
  }
}

export const financeReportRepository = new FinanceReportRepository();
