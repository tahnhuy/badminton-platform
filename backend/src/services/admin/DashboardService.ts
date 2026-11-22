import {
  ActivityType,
  DashboardBounds,
  DashboardRepository,
  dashboardRepository,
} from '../../repositories/admin/DashboardRepository';
import { AppError } from '../../errors/AppError';
import { DashboardRange } from '../../validation/dashboard';

const BUSINESS_TIMEZONE = 'Asia/Ho_Chi_Minh';
const DAY_MS = 86_400_000;

export interface DashboardKpis {
  range: DashboardRange;
  users: { totalPlayers: number; newUsers: number; activeUserRate: number };
  facilities: {
    totalFacilities: number;
    totalCourts: number;
    active: number;
    suspended: number;
    pendingApproval: number;
  };
  bookings: { totalBookings: number; slotFillRate: number };
  revenue: { estimatedValue: string; currency: 'VND'; isEstimate: true };
  tournaments: { inProgress: number; participants: number };
  reports: { unresolved: number };
}

export interface DashboardRangeQuery {
  range: DashboardRange;
  startDate?: string;
  endDate?: string;
}

export interface DashboardCharts {
  range: DashboardRange;
  series: {
    newUsers: Array<{ date: string; count: number }>;
    newBookings: Array<{ date: string; count: number }>;
    revenueByDay: Array<{ date: string; amount: string }>;
    bookingStatuses: Array<{ status: string; count: number }>;
    bookingHeatmap: Array<{ weekday: number; hour: number; count: number }>;
    topFacilities: Array<{ facilityId: number; name: string; bookings: number }>;
    reportBreakdown: Array<{ reasonCode: string; open: number; resolved: number }>;
    tournamentStatuses: Array<{ status: string; count: number }>;
  };
}

export interface DashboardActivity {
  type: ActivityType;
  occurredAt: string;
  summary: string;
  targetId: number;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function zonedParts(date: Date): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const values: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
  }

  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

/** Converts an `Asia/Ho_Chi_Minh` wall-clock time to the corresponding UTC instant. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, second);
  const parts = zonedParts(new Date(guess));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return new Date(guess - (asUtc - guess));
}

export function formatDateInBusinessZone(date: Date): string {
  const parts = zonedParts(date);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

function addDaysIsoDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoParts(value: string): { year: number; month: number; day: number } {
  const [year, month, day] = value.split('-').map(Number);
  return { year, month, day };
}

export function resolveDashboardRange(
  query: DashboardRangeQuery,
  now: Date = new Date(),
): DashboardBounds {
  const parts = zonedParts(now);
  const todayStart = zonedTimeToUtc(parts.year, parts.month, parts.day);
  const today = formatDateInBusinessZone(todayStart);

  switch (query.range) {
    case 'day':
      return {
        start: todayStart,
        end: new Date(todayStart.getTime() + DAY_MS),
        startDate: today,
        endDate: today,
        chartStartDate: today,
        chartEndDate: today,
        days: 1,
      };
    case 'month': {
      const monthStart = zonedTimeToUtc(parts.year, parts.month, 1);
      const nextMonth = parts.month === 12
        ? zonedTimeToUtc(parts.year + 1, 1, 1)
        : zonedTimeToUtc(parts.year, parts.month + 1, 1);
      return {
        start: monthStart,
        end: nextMonth,
        startDate: formatDateInBusinessZone(monthStart),
        endDate: today,
        chartStartDate: formatDateInBusinessZone(monthStart),
        chartEndDate: today,
        days: parts.day,
      };
    }
    case 'year': {
      const yearStart = zonedTimeToUtc(parts.year, 1, 1);
      const nextYear = zonedTimeToUtc(parts.year + 1, 1, 1);
      return {
        start: yearStart,
        end: nextYear,
        startDate: formatDateInBusinessZone(yearStart),
        endDate: today,
        chartStartDate: formatDateInBusinessZone(yearStart),
        chartEndDate: today,
        days: Math.round((todayStart.getTime() - yearStart.getTime()) / DAY_MS) + 1,
      };
    }
    case 'custom': {
      if (!query.startDate || !query.endDate || query.endDate <= query.startDate) {
        throw new AppError(
          'ADMIN_DASHBOARD_INVALID_RANGE',
          400,
          'A custom range requires startDate and endDate, and endDate must be after startDate',
        );
      }

      const startParts = isoParts(query.startDate);
      const endParts = isoParts(query.endDate);
      const start = zonedTimeToUtc(startParts.year, startParts.month, startParts.day);
      const end = zonedTimeToUtc(
        isoParts(addDaysIsoDate(query.endDate, 1)).year,
        isoParts(addDaysIsoDate(query.endDate, 1)).month,
        isoParts(addDaysIsoDate(query.endDate, 1)).day,
      );

      return {
        start,
        end,
        startDate: query.startDate,
        endDate: query.endDate,
        chartStartDate: query.startDate,
        chartEndDate: query.endDate,
        days: Math.round((end.getTime() - start.getTime()) / DAY_MS),
      };
    }
  }
}

function toNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function toAmount(value: number | string | null | undefined): string {
  return toNumber(value).toFixed(2);
}

const ACTIVITY_PREFIX: Record<ActivityType, string> = {
  BOOKING: 'Đặt sân mới tại',
  TOURNAMENT: 'Giải đấu mới:',
  REPORT: 'Báo cáo mới:',
  FACILITY: 'Cơ sở mới:',
};

export class DashboardService {
  constructor(private readonly repository: DashboardRepository = dashboardRepository) {}

  async getKpis(query: DashboardRangeQuery, now: Date = new Date()): Promise<DashboardKpis> {
    const bounds = resolveDashboardRange(query, now);
    const row = await this.repository.kpis(bounds);

    const totalPlayers = toNumber(row.total_players);
    const newUsers = toNumber(row.new_users);
    const activeUsers = toNumber(row.active_users);
    const totalUsers = toNumber(row.total_users);
    const bookedHours = toNumber(row.booked_hours);
    const availableHours = toNumber(row.available_hours);

    return {
      range: query.range,
      users: {
        totalPlayers,
        newUsers,
        activeUserRate: totalUsers > 0 ? round4(activeUsers / totalUsers) : 0,
      },
      facilities: {
        totalFacilities: toNumber(row.total_facilities),
        totalCourts: toNumber(row.total_courts),
        active: toNumber(row.active_facilities),
        suspended: toNumber(row.suspended_facilities),
        pendingApproval: toNumber(row.pending_approval_facilities),
      },
      bookings: {
        totalBookings: toNumber(row.total_bookings),
        slotFillRate: availableHours > 0 ? round4(bookedHours / availableHours) : 0,
      },
      revenue: {
        estimatedValue: toAmount(row.estimated_revenue),
        currency: 'VND',
        isEstimate: true,
      },
      tournaments: {
        inProgress: toNumber(row.tournaments_in_progress),
        participants: toNumber(row.participants),
      },
      reports: {
        unresolved: toNumber(row.unresolved_reports),
      },
    };
  }

  async getCharts(query: DashboardRangeQuery, now: Date = new Date()): Promise<DashboardCharts> {
    const bounds = resolveDashboardRange(query, now);
    const [
      rows,
      revenueRows,
      bookingStatusRows,
      heatmapRows,
      topFacilityRows,
      reportRows,
      tournamentStatusRows,
    ] = await Promise.all([
      this.repository.charts(bounds),
      this.repository.revenueByDay(bounds),
      this.repository.bookingStatusDistribution(bounds),
      this.repository.bookingHeatmap(bounds),
      this.repository.topFacilities(bounds),
      this.repository.reportBreakdown(bounds),
      this.repository.tournamentStatusDistribution(),
    ]);

    return {
      range: query.range,
      series: {
        newUsers: rows.map((row) => ({ date: row.day, count: toNumber(row.new_users) })),
        newBookings: rows.map((row) => ({ date: row.day, count: toNumber(row.new_bookings) })),
        revenueByDay: revenueRows.map((row) => ({ date: row.day, amount: toAmount(row.amount) })),
        bookingStatuses: bookingStatusRows.map((row) => ({
          status: row.status,
          count: toNumber(row.count),
        })),
        bookingHeatmap: heatmapRows.map((row) => ({
          weekday: toNumber(row.weekday),
          hour: toNumber(row.hour),
          count: toNumber(row.count),
        })),
        topFacilities: topFacilityRows.map((row) => ({
          facilityId: toNumber(row.facility_id),
          name: row.name,
          bookings: toNumber(row.bookings),
        })),
        reportBreakdown: reportRows.map((row) => ({
          reasonCode: row.reason_code,
          open: toNumber(row.open_count),
          resolved: toNumber(row.resolved_count),
        })),
        tournamentStatuses: tournamentStatusRows.map((row) => ({
          status: row.status,
          count: toNumber(row.count),
        })),
      },
    };
  }

  async getRecentActivities(limit: number): Promise<{ items: DashboardActivity[] }> {
    const rows = await this.repository.recentActivities(limit);

    return {
      items: rows.map((row) => {
        const detail = row.detail?.trim();
        return {
          type: row.type,
          occurredAt: new Date(row.occurred_at).toISOString(),
          summary: detail ? `${ACTIVITY_PREFIX[row.type]} ${detail}` : ACTIVITY_PREFIX[row.type],
          targetId: toNumber(row.id),
        };
      }),
    };
  }
}

export const dashboardService = new DashboardService();
