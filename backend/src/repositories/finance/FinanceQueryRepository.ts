import { and, count, desc, eq, gte, lte, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { bookings, paymentRefunds, payments, paymentRefunds as refunds } from '../../db/schema/bookings';
import { courts, facilities } from '../../db/schema/facilities';
import { users } from '../../db/schema/users';
import { walletAccounts, walletHolds, walletLedgerEntries, walletPayoutRequests, walletTopUps } from '../../db/schema/wallet';
import { FinanceBounds } from '../../services/finance/finance-range';

type Executor = any;

export type FinanceTransactionSource = 'ledger' | 'top-up' | 'payout' | 'refund';
export type FinanceTransactionStatus =
  | 'POSTED'
  | 'PENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'EXPIRED'
  | 'PROCESSING'
  | 'REFUNDED'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID';

export interface FinanceTransactionRow {
  source: FinanceTransactionSource;
  sourceId: number;
  occurredAt: Date;
  type: string;
  status: string;
  userId: number;
  amount: string;
  balanceAfter: string | null;
  referenceType: string | null;
  referenceId: number | null;
  description: string | null;
  actorId: number | null;
  requestType: string | null;
}

export interface FinanceTransactionFilter {
  source?: FinanceTransactionSource;
  status?: string;
  userId?: number;
  referenceType?: string;
  referenceId?: number;
  from?: Date;
  to?: Date;
  minAmount?: string;
  maxAmount?: string;
  page: number;
  limit: number;
}

export interface FinanceOverviewRow {
  wallet_liability: string;
  held: string;
  cash_in: string;
  cash_out: string;
  gross_revenue: string;
  refunds: string;
  owner_earnings: string;
  pending_payout_count: number | string;
  pending_payout_amount: string;
  pending_owner_earning_count: number | string;
  pending_owner_earning_amount: string;
  failed_refund_count: number | string;
  failed_refund_amount: string;
}

export interface FinanceDailyRow {
  day: string;
  amount: string;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

export class FinanceQueryRepository {
  async overview(bounds: FinanceBounds): Promise<FinanceOverviewRow> {
    const result = await db.execute(sql`
      SELECT
        COALESCE((SELECT SUM(balance) FROM wallet_accounts), 0)::text AS wallet_liability,
        COALESCE((SELECT SUM(amount) FROM wallet_holds WHERE status = 'HELD'), 0)::text AS held,
        COALESCE((SELECT SUM(amount) FROM wallet_top_ups
          WHERE status = 'SUCCESS' AND paid_at >= ${bounds.start} AND paid_at < ${bounds.end}), 0)::text AS cash_in,
        COALESCE((SELECT SUM(amount) FROM wallet_payout_requests
          WHERE status = 'PAID' AND paid_at >= ${bounds.start} AND paid_at < ${bounds.end}), 0)::text AS cash_out,
        COALESCE((SELECT SUM(amount) FROM payments
          WHERE status = 'SUCCESS' AND paid_at >= ${bounds.start} AND paid_at < ${bounds.end}), 0)::text AS gross_revenue,
        COALESCE((SELECT SUM(payment.amount) FROM payment_refunds r
          JOIN payments payment ON payment.id = r.payment_id
          WHERE r.status = 'REFUNDED' AND r.completed_at >= ${bounds.start} AND r.completed_at < ${bounds.end}), 0)::text AS refunds,
        COALESCE((SELECT SUM(amount) FROM wallet_ledger_entries
          WHERE entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')
            AND created_at >= ${bounds.start} AND created_at < ${bounds.end}), 0)::text AS owner_earnings,
        (SELECT COUNT(*) FROM wallet_payout_requests WHERE status = 'PENDING')::int AS pending_payout_count,
        COALESCE((SELECT SUM(amount) FROM wallet_payout_requests WHERE status = 'PENDING'), 0)::text AS pending_payout_amount,
        (SELECT COUNT(*) FROM owner_earning_settlements WHERE status = 'PENDING')::int AS pending_owner_earning_count,
        COALESCE((SELECT SUM(amount) FROM owner_earning_settlements WHERE status = 'PENDING'), 0)::text AS pending_owner_earning_amount,
        (SELECT COUNT(*) FROM payment_refunds WHERE status = 'FAILED')::int AS failed_refund_count,
        COALESCE((SELECT SUM(p.amount) FROM payment_refunds r JOIN payments p ON p.id = r.payment_id WHERE r.status = 'FAILED'), 0)::text AS failed_refund_amount
    `);
    return result.rows[0] as unknown as FinanceOverviewRow;
  }

  async dailyTrend(bounds: FinanceBounds): Promise<{
    cashIn: FinanceDailyRow[];
    cashOut: FinanceDailyRow[];
    revenue: FinanceDailyRow[];
  }> {
    const days = await db.execute(sql`
      SELECT to_char(d.day::date, 'YYYY-MM-DD') AS day
      FROM generate_series(${bounds.startDate}::date, ${bounds.endDate}::date, interval '1 day') AS d(day)
    `);
    const cashIn = await db.execute(sql`
      SELECT to_char((t.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(t.amount), 0)::text AS amount
      FROM wallet_top_ups t
      WHERE t.status = 'SUCCESS' AND t.paid_at >= ${bounds.start} AND t.paid_at < ${bounds.end}
      GROUP BY 1
    `);
    const cashOut = await db.execute(sql`
      SELECT to_char((p.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(p.amount), 0)::text AS amount
      FROM wallet_payout_requests p
      WHERE p.status = 'PAID' AND p.paid_at >= ${bounds.start} AND p.paid_at < ${bounds.end}
      GROUP BY 1
    `);
    const revenue = await db.execute(sql`
      SELECT to_char((payment.paid_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, 'YYYY-MM-DD') AS day,
             COALESCE(SUM(payment.amount), 0)::text AS amount
      FROM payments payment
      WHERE payment.status = 'SUCCESS' AND payment.paid_at >= ${bounds.start} AND payment.paid_at < ${bounds.end}
      GROUP BY 1
    `);
    const fill = (rows: any[], series: any[]) => series.map(row => {
      const match = rows.find(item => item.day === row.day);
      return { day: row.day, amount: String(match?.amount ?? '0') };
    });
    return {
      cashIn: fill(cashIn.rows, days.rows),
      cashOut: fill(cashOut.rows, days.rows),
      revenue: fill(revenue.rows, days.rows),
    };
  }

  async transactions(filter: FinanceTransactionFilter): Promise<{ rows: FinanceTransactionRow[]; total: number }> {
    const conditions: SQL[] = [];
    if (filter.source) conditions.push(sql`t.source = ${filter.source}`);
    if (filter.status) conditions.push(sql`t.status = ${filter.status}`);
    if (filter.userId) conditions.push(sql`t.user_id = ${filter.userId}`);
    if (filter.referenceType) conditions.push(sql`t.reference_type = ${filter.referenceType}`);
    if (filter.referenceId) conditions.push(sql`t.reference_id = ${filter.referenceId}`);
    if (filter.from) conditions.push(sql`t.occurred_at >= ${filter.from}`);
    if (filter.to) conditions.push(sql`t.occurred_at < ${filter.to}`);
    if (filter.minAmount) conditions.push(sql`t.amount >= ${filter.minAmount}`);
    if (filter.maxAmount) conditions.push(sql`t.amount <= ${filter.maxAmount}`);

    const where = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
    const offset = (filter.page - 1) * filter.limit;
    const result = await db.execute(sql`
      WITH ledger_rows AS (
        SELECT 'ledger'::text AS source,
               l.id AS source_id,
               l.created_at AS occurred_at,
               l.entry_type AS type,
               'POSTED'::text AS status,
               l.user_id,
               l.amount,
               l.balance_after,
               l.reference_type,
               l.reference_id,
               l.description,
               l.created_by AS actor_id,
               NULL::text AS request_type
        FROM wallet_ledger_entries l
      ),
      top_up_rows AS (
        SELECT 'top-up'::text AS source,
               t.id AS source_id,
               t.created_at AS occurred_at,
               'TOP_UP'::text AS type,
               t.status,
               t.user_id,
               t.amount,
               NULL::numeric AS balance_after,
               'TOP_UP'::text AS reference_type,
               t.id AS reference_id,
               CONCAT(t.provider, ' ', t.txn_ref) AS description,
               NULL::bigint AS actor_id,
               NULL::text AS request_type
        FROM wallet_top_ups t
        WHERE NOT EXISTS (
          SELECT 1 FROM wallet_ledger_entries l
          WHERE l.entry_type = 'TOP_UP' AND l.reference_type = 'TOP_UP' AND l.reference_id = t.id
        )
      ),
      payout_rows AS (
        SELECT 'payout'::text AS source,
               p.id AS source_id,
               p.created_at AS occurred_at,
               p.request_type AS type,
               p.status,
               p.user_id,
               p.amount,
               NULL::numeric AS balance_after,
               p.request_type AS reference_type,
               p.id AS reference_id,
               p.admin_note AS description,
               p.admin_id AS actor_id,
               p.request_type
        FROM wallet_payout_requests p
        WHERE NOT EXISTS (
          SELECT 1 FROM wallet_ledger_entries l
          WHERE l.entry_type IN ('WITHDRAWAL', 'PAYOUT') AND l.reference_id = p.id
        )
      ),
      refund_rows AS (
        SELECT 'refund'::text AS source,
               r.payment_id AS source_id,
               r.created_at AS occurred_at,
               'REFUND'::text AS type,
               r.status,
               COALESCE(b.player_id, 0) AS user_id,
               payment.amount,
               NULL::numeric AS balance_after,
               'BOOKING'::text AS reference_type,
               payment.booking_id AS reference_id,
               r.reason AS description,
               NULL::bigint AS actor_id,
               NULL::text AS request_type
        FROM payment_refunds r
        JOIN payments payment ON payment.id = r.payment_id
        LEFT JOIN bookings b ON b.id = payment.booking_id
        WHERE NOT EXISTS (
          SELECT 1 FROM wallet_ledger_entries l
          WHERE l.entry_type = 'REFUND' AND l.reference_type = 'BOOKING' AND l.reference_id = payment.booking_id
        )
      ),
      unioned AS (
        SELECT * FROM ledger_rows
        UNION ALL SELECT * FROM top_up_rows
        UNION ALL SELECT * FROM payout_rows
        UNION ALL SELECT * FROM refund_rows
      )
      SELECT t.*, COUNT(*) OVER()::int AS total_count
      FROM unioned t
      ${where}
      ORDER BY t.occurred_at DESC, t.source ASC, t.source_id DESC
      LIMIT ${filter.limit} OFFSET ${offset}
    `);

    const rows = result.rows.map((row: any) => ({
      source: row.source,
      sourceId: toNumber(row.source_id),
      occurredAt: row.occurred_at,
      type: row.type,
      status: row.status,
      userId: toNumber(row.user_id),
      amount: String(row.amount),
      balanceAfter: row.balance_after === null ? null : String(row.balance_after),
      referenceType: row.reference_type,
      referenceId: row.reference_id === null ? null : toNumber(row.reference_id),
      description: row.description,
      actorId: row.actor_id === null ? null : toNumber(row.actor_id),
      requestType: row.request_type,
    }));
    return { rows, total: toNumber(result.rows[0]?.total_count) };
  }

  async ledgerEntryById(id: number) {
    const [row] = await db.select().from(walletLedgerEntries).where(eq(walletLedgerEntries.id, id)).limit(1);
    return row ?? null;
  }

  async ledgerEntryWithUser(id: number) {
    const [row] = await db
      .select({
        entry: walletLedgerEntries,
        userEmail: users.email,
        userName: users.role,
      })
      .from(walletLedgerEntries)
      .innerJoin(users, eq(users.id, walletLedgerEntries.userId))
      .where(eq(walletLedgerEntries.id, id))
      .limit(1);
    return row ?? null;
  }

  async walletSnapshot(userId: number) {
    const [user] = await db.select({ id: users.id, email: users.email, role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return null;
    const [account] = await db.select().from(walletAccounts).where(eq(walletAccounts.userId, userId)).limit(1);
    const [held] = await db
      .select({ total: sql<string>`COALESCE(SUM(${walletHolds.amount}), 0)::text` })
      .from(walletHolds)
      .where(and(eq(walletHolds.userId, userId), eq(walletHolds.status, 'HELD')));
    const balance = account ? String(account.balance) : '0.00';
    const heldAmount = String(held?.total ?? '0');
    const balanceCents = Math.round(Number(balance) * 100);
    const heldCents = Math.round(Number(heldAmount) * 100);
    return {
      user,
      balance,
      held: heldAmount,
      available: (Math.max(0, balanceCents - heldCents) / 100).toFixed(2),
      updatedAt: account?.updatedAt ?? null,
    };
  }

  async walletEntries(userId: number, page: number, limit: number) {
    const rows = await db
      .select()
      .from(walletLedgerEntries)
      .where(eq(walletLedgerEntries.userId, userId))
      .orderBy(desc(walletLedgerEntries.createdAt), desc(walletLedgerEntries.id))
      .limit(limit)
      .offset((page - 1) * limit);
    const [total] = await db.select({ total: count() }).from(walletLedgerEntries).where(eq(walletLedgerEntries.userId, userId));
    return { rows, total: Number(total?.total ?? 0) };
  }

  async walletHolds(userId: number, status?: string, page = 1, limit = 20) {
    const conditions: SQL[] = [eq(walletHolds.userId, userId)];
    if (status) conditions.push(eq(walletHolds.status, status));
    const where = and(...conditions);
    const rows = await db
      .select()
      .from(walletHolds)
      .where(where)
      .orderBy(desc(walletHolds.createdAt), desc(walletHolds.id))
      .limit(limit)
      .offset((page - 1) * limit);
    const [total] = await db.select({ total: count() }).from(walletHolds).where(where);
    return { rows, total: Number(total?.total ?? 0) };
  }

  async topUps(filter: {
    status?: string; provider?: string; userId?: number; from?: Date; to?: Date; page: number; limit: number;
  }) {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(walletTopUps.status, filter.status));
    if (filter.provider) conditions.push(eq(walletTopUps.provider, filter.provider));
    if (filter.userId) conditions.push(eq(walletTopUps.userId, filter.userId));
    if (filter.from) conditions.push(gte(walletTopUps.createdAt, filter.from));
    if (filter.to) conditions.push(lte(walletTopUps.createdAt, filter.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(walletTopUps)
      .where(where)
      .orderBy(desc(walletTopUps.createdAt), desc(walletTopUps.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);
    const [total] = await db.select({ total: count() }).from(walletTopUps).where(where);
    return { rows, total: Number(total?.total ?? 0) };
  }

  async topUpById(id: number) {
    const [row] = await db.select().from(walletTopUps).where(eq(walletTopUps.id, id)).limit(1);
    return row ?? null;
  }

  async payouts(filter: {
    status?: string; requestType?: string; userId?: number; from?: Date; to?: Date; page: number; limit: number;
  }) {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(walletPayoutRequests.status, filter.status));
    if (filter.requestType) conditions.push(eq(walletPayoutRequests.requestType, filter.requestType));
    if (filter.userId) conditions.push(eq(walletPayoutRequests.userId, filter.userId));
    if (filter.from) conditions.push(gte(walletPayoutRequests.createdAt, filter.from));
    if (filter.to) conditions.push(lte(walletPayoutRequests.createdAt, filter.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(walletPayoutRequests)
      .where(where)
      .orderBy(desc(walletPayoutRequests.createdAt), desc(walletPayoutRequests.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);
    const [total] = await db.select({ total: count() }).from(walletPayoutRequests).where(where);
    return { rows, total: Number(total?.total ?? 0) };
  }

  async payoutById(id: number) {
    const [row] = await db
      .select({ payout: walletPayoutRequests, bankCode: sql<string>`NULL`, accountNumber: sql<string>`NULL` })
      .from(walletPayoutRequests)
      .where(eq(walletPayoutRequests.id, id))
      .limit(1);
    if (!row) return null;
    const bank = await db.execute(sql`
      SELECT bank_code, account_number, account_name FROM wallet_bank_accounts WHERE id = ${row.payout.bankAccountId}
    `);
    return { ...row.payout, bankAccount: bank.rows[0] ?? null };
  }

  async refunds(filter: {
    status?: string; paymentId?: number; userId?: number; from?: Date; to?: Date; page: number; limit: number;
  }) {
    const conditions: SQL[] = [];
    if (filter.status) conditions.push(eq(refunds.status, filter.status));
    if (filter.paymentId) conditions.push(eq(refunds.paymentId, filter.paymentId));
    if (filter.userId) conditions.push(eq(bookings.playerId, filter.userId));
    if (filter.from) conditions.push(gte(refunds.createdAt, filter.from));
    if (filter.to) conditions.push(lte(refunds.createdAt, filter.to));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const rows = await db
      .select({
        paymentId: refunds.paymentId,
        status: refunds.status,
        attempts: refunds.attempts,
        lastError: refunds.lastError,
        reason: refunds.reason,
        claimedAt: refunds.claimedAt,
        completedAt: refunds.completedAt,
        createdAt: refunds.createdAt,
        updatedAt: refunds.updatedAt,
        amount: payments.amount,
        provider: payments.provider,
        bookingId: payments.bookingId,
        userId: bookings.playerId,
      })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(where)
      .orderBy(desc(refunds.updatedAt), desc(refunds.paymentId))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);
    const [total] = await db
      .select({ total: count() })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(where);
    return { rows, total: Number(total?.total ?? 0) };
  }

  async refundById(paymentId: number) {
    const result = await db
      .select({
        refund: refunds,
        payment: payments,
        booking: bookings,
      })
      .from(refunds)
      .innerJoin(payments, eq(payments.id, refunds.paymentId))
      .leftJoin(bookings, eq(bookings.id, payments.bookingId))
      .where(eq(refunds.paymentId, paymentId))
      .limit(1);
    return result[0] ?? null;
  }

  async ownerEarnings(filter: {
    ownerId?: number; from?: Date; to?: Date; page: number; limit: number;
  }) {
    const conditions: SQL[] = [
      sql`l.entry_type IN ('OWNER_EARNING', 'OWNER_EARNING_REVERSAL')`,
    ];
    if (filter.ownerId) conditions.push(sql`l.user_id = ${filter.ownerId}`);
    if (filter.from) conditions.push(sql`l.created_at >= ${filter.from}`);
    if (filter.to) conditions.push(sql`l.created_at < ${filter.to}`);
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    const offset = (filter.page - 1) * filter.limit;
    const result = await db.execute(sql`
      SELECT l.*, b.booking_code, b.booking_date, u.email AS owner_email,
             COUNT(*) OVER()::int AS total_count
      FROM wallet_ledger_entries l
      LEFT JOIN bookings b ON l.reference_type = 'BOOKING' AND b.id = l.reference_id
      INNER JOIN users u ON u.id = l.user_id
      ${where}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ${filter.limit} OFFSET ${offset}
    `);
    return {
      rows: result.rows.map((row: any) => ({
        id: toNumber(row.id),
        ownerId: toNumber(row.user_id),
        ownerEmail: row.owner_email,
        bookingId: row.reference_id === null ? null : toNumber(row.reference_id),
        bookingCode: row.booking_code ?? null,
        bookingDate: row.booking_date ?? null,
        entryType: row.entry_type,
        amount: String(row.amount),
        balanceAfter: String(row.balance_after),
        description: row.description ?? null,
        createdAt: row.created_at,
      })),
      total: toNumber(result.rows[0]?.total_count),
    };
  }

  async ownerEarningByBooking(
    bookingId: number,
    entryType: 'OWNER_EARNING' | 'OWNER_EARNING_REVERSAL',
    executor: any = db,
  ) {
    const [row] = await executor
      .select()
      .from(walletLedgerEntries)
      .where(and(
        eq(walletLedgerEntries.referenceType, 'BOOKING'),
        eq(walletLedgerEntries.referenceId, bookingId),
        eq(walletLedgerEntries.entryType, entryType),
      ))
      .limit(1);
    return row ?? null;
  }

  async eligibleOwnerEarnings(filter: { from?: string; to?: string; limit: number }) {
    const conditions: SQL[] = [
      sql`b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')`,
      sql`b.total_amount > 0`,
      sql`EXISTS (
        SELECT 1 FROM payments p
        WHERE p.booking_id = b.id AND p.status = 'SUCCESS'
      )`,
    ];
    if (filter.from) conditions.push(sql`b.booking_date >= ${filter.from}::date`);
    if (filter.to) conditions.push(sql`b.booking_date <= ${filter.to}::date`);
    const where = sql`WHERE ${sql.join(conditions, sql` AND `)}`;
    const result = await db.execute(sql`
      SELECT b.id AS booking_id, b.booking_code, b.total_amount, f.owner_id
      FROM bookings b
      INNER JOIN courts c ON c.id = b.court_id
      INNER JOIN facilities f ON f.id = c.facility_id
      ${where}
        AND NOT EXISTS (
          SELECT 1 FROM wallet_ledger_entries l
          WHERE l.entry_type = 'OWNER_EARNING'
            AND l.reference_type = 'BOOKING'
            AND l.reference_id = b.id
        )
        AND NOT EXISTS (
          SELECT 1 FROM owner_earning_settlements s
          WHERE s.booking_id = b.id
        )
      ORDER BY b.id ASC
      LIMIT ${filter.limit}
    `);
    return result.rows as Array<{
      booking_id: number | string;
      booking_code: string;
      total_amount: string;
      owner_id: number | string;
    }>;
  }

  async ownerEarningEligibility(bookingId: number, executor: any = db) {
    const result = await executor.execute(sql`
      SELECT b.id AS booking_id, b.booking_code, b.status AS booking_status,
             b.total_amount, f.owner_id,
             EXISTS (
               SELECT 1 FROM payments p
               WHERE p.booking_id = b.id AND p.status = 'SUCCESS'
             ) AS has_success_payment,
             EXISTS (
               SELECT 1 FROM wallet_ledger_entries l
               WHERE l.entry_type = 'OWNER_EARNING'
                 AND l.reference_type = 'BOOKING'
                 AND l.reference_id = b.id
             ) AS has_owner_earning,
             EXISTS (
               SELECT 1 FROM owner_earning_settlements s
               WHERE s.booking_id = b.id
             ) AS has_settlement
      FROM bookings b
      INNER JOIN courts c ON c.id = b.court_id
      INNER JOIN facilities f ON f.id = c.facility_id
      WHERE b.id = ${bookingId}
      LIMIT 1
    `);
    return (result.rows[0] as {
      booking_id: number | string;
      booking_code: string;
      booking_status: string;
      total_amount: string;
      owner_id: number | string;
      has_success_payment: boolean;
      has_owner_earning: boolean;
      has_settlement: boolean;
    } | undefined) ?? null;
  }
}

export const financeQueryRepository = new FinanceQueryRepository();
