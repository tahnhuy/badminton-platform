import { sql } from 'drizzle-orm';
import { db } from '../../db';

export interface DashboardBounds {
  start: Date;
  end: Date;
  startDate: string;
  endDate: string;
  chartStartDate: string;
  chartEndDate: string;
  days: number;
}

export interface DashboardKpiRow {
  total_players: number | string;
  new_users: number | string;
  active_users: number | string;
  total_users: number | string;
  total_facilities: number | string;
  active_facilities: number | string;
  suspended_facilities: number | string;
  pending_approval_facilities: number | string;
  total_courts: number | string;
  total_bookings: number | string;
  booked_hours: number | string;
  available_hours: number | string;
  estimated_revenue: number | string;
  tournaments_in_progress: number | string;
  participants: number | string;
  unresolved_reports: number | string;
}

export interface DashboardChartRow {
  day: string;
  new_users: number | string;
  new_bookings: number | string;
}

export type ActivityType = 'BOOKING' | 'TOURNAMENT' | 'REPORT' | 'FACILITY';

export interface DashboardActivityRow {
  type: ActivityType;
  id: number | string;
  occurred_at: Date | string;
  detail: string | null;
}

export interface RevenueChartRow {
  day: string;
  amount: number | string;
}

export interface BookingStatusRow {
  status: string;
  count: number | string;
}

export interface BookingHeatmapRow {
  weekday: number | string;
  hour: number | string;
  count: number | string;
}

export interface TopFacilityRow {
  facility_id: number | string;
  name: string;
  bookings: number | string;
}

export interface ReportBreakdownRow {
  reason_code: string;
  open_count: number | string;
  resolved_count: number | string;
}

export interface TournamentStatusRow {
  status: string;
  count: number | string;
}

/**
 * Read-only aggregate access for the Admin dashboard. The KPI method is a single CTE
 * statement so period-scoped and snapshot values describe the same instant.
 */
export class DashboardRepository {
  async kpis(bounds: DashboardBounds): Promise<DashboardKpiRow> {
    const result = await db.execute(sql`
      WITH bounds AS (
        SELECT
          (${bounds.start}::timestamptz AT TIME ZONE 'UTC') AS start_ts,
          (${bounds.end}::timestamptz AT TIME ZONE 'UTC') AS end_ts
      ),
      user_kpis AS (
        SELECT
          COUNT(*) FILTER (WHERE u.role = 'PLAYER')::int AS total_players,
          COUNT(*) FILTER (WHERE u.role = 'PLAYER'
            AND u.created_at >= b.start_ts AND u.created_at < b.end_ts)::int AS new_users,
          COUNT(*) FILTER (WHERE u.status = 'ACTIVE')::int AS active_users,
          COUNT(*)::int AS total_users
        FROM users u CROSS JOIN bounds b
        WHERE u.deleted_at IS NULL
      ),
      facility_kpis AS (
        SELECT
          COUNT(*)::int AS total_facilities,
          COUNT(*) FILTER (WHERE f.status = 'ACTIVE')::int AS active_facilities,
          COUNT(*) FILTER (WHERE f.status = 'SUSPENDED')::int AS suspended_facilities,
          COUNT(*) FILTER (WHERE f.status = 'PENDING_APPROVAL')::int AS pending_approval_facilities
        FROM facilities f
        WHERE f.deleted_at IS NULL
      ),
      court_kpis AS (
        SELECT COUNT(*)::int AS total_courts
        FROM courts c
        WHERE c.deleted_at IS NULL
      ),
      booking_kpis AS (
        SELECT COUNT(*) FILTER (
          WHERE b.created_at >= bounds.start_ts AND b.created_at < bounds.end_ts
        )::int AS total_bookings
        FROM bookings b CROSS JOIN bounds
      ),
      booked_hours AS (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (bk.end_time - bk.start_time)) / 3600), 0) AS booked_hours
        FROM bookings bk
        WHERE bk.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
          AND bk.booking_date >= ${bounds.startDate}::date
          AND bk.booking_date <= ${bounds.endDate}::date
      ),
      available_hours AS (
        SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (f.closing_time - f.opening_time)) / 3600), 0) * ${bounds.days}::numeric AS available_hours
        FROM courts c
        JOIN facilities f ON f.id = c.facility_id
        WHERE c.status = 'ACTIVE' AND c.deleted_at IS NULL
          AND f.status = 'ACTIVE' AND f.deleted_at IS NULL
      ),
      -- Net revenue, same definition as Admin Finance (Tournament Tech Design §5.1, TRN-17):
      -- paid booking + tournament fee payments minus refunds completed in the range.
      revenue_kpis AS (
        SELECT
          COALESCE((SELECT SUM(p.amount) FROM payments p CROSS JOIN bounds
            WHERE p.status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
              AND p.paid_at IS NOT NULL
              AND p.paid_at >= bounds.start_ts AND p.paid_at < bounds.end_ts), 0)
          - COALESCE((SELECT SUM(p.amount) FROM payment_refunds r JOIN payments p ON p.id = r.payment_id CROSS JOIN bounds
            WHERE r.status = 'REFUNDED'
              AND r.completed_at >= bounds.start_ts AND r.completed_at < bounds.end_ts), 0) AS estimated_revenue
      ),
      tournament_kpis AS (
        SELECT COUNT(*) FILTER (WHERE t.status = 'IN_PROGRESS')::int AS tournaments_in_progress
        FROM tournaments t
        WHERE t.deleted_at IS NULL
      ),
      participant_kpis AS (
        SELECT COUNT(DISTINCT p.player_id)::int AS participants
        FROM (
          SELECT tr.player_id
          FROM tournament_registrations tr
          WHERE tr.status = 'CONFIRMED'
            AND tr.registered_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND tr.registered_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
            AND tr.player_id IS NOT NULL
          UNION
          SELECT ttp.player_id
          FROM tournament_registrations tr
          JOIN tournament_team_players ttp ON ttp.team_id = tr.team_id
          WHERE tr.status = 'CONFIRMED'
            AND tr.registered_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND tr.registered_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        ) p
      ),
      report_kpis AS (
        SELECT COUNT(*) FILTER (WHERE r.status = 'OPEN')::int AS unresolved_reports
        FROM reports r
      )
      SELECT
        user_kpis.*,
        facility_kpis.*,
        court_kpis.*,
        booking_kpis.*,
        booked_hours.*,
        available_hours.*,
        revenue_kpis.*,
        tournament_kpis.*,
        participant_kpis.*,
        report_kpis.*
      FROM user_kpis, facility_kpis, court_kpis, booking_kpis, booked_hours,
           available_hours, revenue_kpis, tournament_kpis, participant_kpis, report_kpis
    `);

    return result.rows[0] as unknown as DashboardKpiRow;
  }

  async charts(bounds: DashboardBounds): Promise<DashboardChartRow[]> {
    const result = await db.execute(sql`
      SELECT
        to_char(gs.day, 'YYYY-MM-DD') AS day,
        COALESCE(u.cnt, 0)::int AS new_users,
        COALESCE(b.cnt, 0)::int AS new_bookings
      FROM generate_series(${bounds.chartStartDate}::date, ${bounds.chartEndDate}::date, interval '1 day') AS gs(day)
      LEFT JOIN (
        SELECT
          ((u2.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
          COUNT(*)::int AS cnt
        FROM users u2
        WHERE u2.role = 'PLAYER'
          AND u2.deleted_at IS NULL
          AND u2.created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND u2.created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
      ) u ON u.day = gs.day
      LEFT JOIN (
        SELECT
          ((b2.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day,
          COUNT(*)::int AS cnt
        FROM bookings b2
        WHERE b2.created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
          AND b2.created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        GROUP BY 1
      ) b ON b.day = gs.day
      ORDER BY gs.day
    `);

    return result.rows as unknown as DashboardChartRow[];
  }

  async revenueByDay(bounds: DashboardBounds): Promise<RevenueChartRow[]> {
    const result = await db.execute(sql`
      SELECT
        to_char(gs.day, 'YYYY-MM-DD') AS day,
        COALESCE(r.amount, 0) AS amount
      FROM generate_series(${bounds.chartStartDate}::date, ${bounds.chartEndDate}::date, interval '1 day') AS gs(day)
      LEFT JOIN (
        SELECT day, SUM(amount) AS amount FROM (
          SELECT ((p.paid_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, p.amount
          FROM payments p
          WHERE p.status IN ('SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'REFUND_FAILED')
            AND p.paid_at IS NOT NULL
            AND p.paid_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND p.paid_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
          UNION ALL
          SELECT ((r.completed_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS day, -p.amount
          FROM payment_refunds r JOIN payments p ON p.id = r.payment_id
          WHERE r.status = 'REFUNDED'
            AND r.completed_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
            AND r.completed_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
        ) movements
        GROUP BY day
      ) r ON r.day = gs.day
      ORDER BY gs.day
    `);

    return result.rows as unknown as RevenueChartRow[];
  }

  async bookingStatusDistribution(bounds: DashboardBounds): Promise<BookingStatusRow[]> {
    const result = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count
      FROM bookings
      WHERE created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
        AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY status
      ORDER BY COUNT(*) DESC, status
    `);

    return result.rows as unknown as BookingStatusRow[];
  }

  async bookingHeatmap(bounds: DashboardBounds): Promise<BookingHeatmapRow[]> {
    const result = await db.execute(sql`
      SELECT
        EXTRACT(ISODOW FROM bk.booking_date)::int AS weekday,
        EXTRACT(HOUR FROM slot)::int AS hour,
        COUNT(*)::int AS count
      FROM bookings bk
      CROSS JOIN LATERAL generate_series(
        bk.booking_date::timestamp + bk.start_time,
        bk.booking_date::timestamp + bk.end_time - interval '1 hour',
        interval '1 hour'
      ) AS slot
      WHERE bk.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
        AND bk.booking_date >= ${bounds.startDate}::date
        AND bk.booking_date <= ${bounds.endDate}::date
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    return result.rows as unknown as BookingHeatmapRow[];
  }

  async topFacilities(bounds: DashboardBounds): Promise<TopFacilityRow[]> {
    const result = await db.execute(sql`
      SELECT f.id AS facility_id, f.name, COUNT(b.id)::int AS bookings
      FROM facilities f
      JOIN courts c ON c.facility_id = f.id
      JOIN bookings b ON b.court_id = c.id
        AND b.created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
        AND b.created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
      WHERE f.deleted_at IS NULL
      GROUP BY f.id, f.name
      ORDER BY COUNT(b.id) DESC, f.id
      LIMIT 5
    `);

    return result.rows as unknown as TopFacilityRow[];
  }

  async reportBreakdown(bounds: DashboardBounds): Promise<ReportBreakdownRow[]> {
    const result = await db.execute(sql`
      SELECT
        reason_code,
        COUNT(*) FILTER (WHERE status = 'OPEN')::int AS open_count,
        COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS resolved_count
      FROM reports
      WHERE created_at >= (${bounds.start}::timestamptz AT TIME ZONE 'UTC')
        AND created_at < (${bounds.end}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY reason_code
      ORDER BY COUNT(*) DESC, reason_code
      LIMIT 8
    `);

    return result.rows as unknown as ReportBreakdownRow[];
  }

  async tournamentStatusDistribution(): Promise<TournamentStatusRow[]> {
    const result = await db.execute(sql`
      SELECT status, COUNT(*)::int AS count
      FROM tournaments
      WHERE deleted_at IS NULL
      GROUP BY status
      ORDER BY COUNT(*) DESC, status
    `);

    return result.rows as unknown as TournamentStatusRow[];
  }

  async recentActivities(limit: number): Promise<DashboardActivityRow[]> {
    const result = await db.execute(sql`
      SELECT type, id, occurred_at, detail
      FROM (
        SELECT 'BOOKING'::text AS type, bk.id, bk.created_at AS occurred_at, c.name AS detail
        FROM bookings bk
        LEFT JOIN courts c ON c.id = bk.court_id
        UNION ALL
        SELECT 'TOURNAMENT'::text, t.id, t.created_at, t.name
        FROM tournaments t
        WHERE t.deleted_at IS NULL
        UNION ALL
        SELECT 'REPORT'::text, r.id, r.created_at, r.reason_code
        FROM reports r
        UNION ALL
        SELECT 'FACILITY'::text, f.id, f.created_at, f.name
        FROM facilities f
        WHERE f.deleted_at IS NULL
      ) events
      ORDER BY occurred_at DESC, type ASC, id DESC
      LIMIT ${limit}
    `);

    return result.rows as unknown as DashboardActivityRow[];
  }
}

export const dashboardRepository = new DashboardRepository();
