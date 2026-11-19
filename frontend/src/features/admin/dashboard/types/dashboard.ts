import type { TimeRangePreset } from '../../../../shared/time-range';

export type DashboardRange = TimeRangePreset;

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
  revenue: { estimatedValue: string; currency: string; isEstimate: boolean };
  tournaments: { inProgress: number; participants: number };
  reports: { unresolved: number };
}

export interface DashboardChartPoint {
  date: string;
  count: number;
}

export interface RevenueChartPoint {
  date: string;
  amount: string;
}

export interface BookingStatusPoint {
  status: string;
  count: number;
}

export interface BookingHeatmapCell {
  weekday: number;
  hour: number;
  count: number;
}

export interface TopFacilityPoint {
  facilityId: number;
  name: string;
  bookings: number;
}

export interface ReportBreakdownPoint {
  reasonCode: string;
  open: number;
  resolved: number;
}

export interface TournamentStatusPoint {
  status: string;
  count: number;
}

export interface DashboardCharts {
  range: DashboardRange;
  series: {
    newUsers: DashboardChartPoint[];
    newBookings: DashboardChartPoint[];
    revenueByDay: RevenueChartPoint[];
    bookingStatuses: BookingStatusPoint[];
    bookingHeatmap: BookingHeatmapCell[];
    topFacilities: TopFacilityPoint[];
    reportBreakdown: ReportBreakdownPoint[];
    tournamentStatuses: TournamentStatusPoint[];
  };
}

export type DashboardActivityType = 'BOOKING' | 'TOURNAMENT' | 'REPORT' | 'FACILITY';

export interface DashboardActivity {
  type: DashboardActivityType;
  occurredAt: string;
  summary: string;
  targetId: number;
}
