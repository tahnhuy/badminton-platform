import { describe, expect, it } from 'vitest';
import { db } from '../db';
import {
  bookings,
  courts,
  facilities,
  payments,
  reports,
  tournamentRegistrations,
  tournamentTeamPlayers,
  tournamentTeams,
  tournaments,
} from '../db';
import { DashboardService, formatDateInBusinessZone, resolveDashboardRange } from '../services/admin/DashboardService';
import { createTestUser } from './test-helpers';

const service = new DashboardService();

function time(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

async function seedDashboardFixture(now: Date) {
  const player1 = await createTestUser({ role: 'PLAYER' });
  const player2 = await createTestUser({ role: 'PLAYER' });
  await createTestUser({ role: 'PLAYER', deletedAt: new Date() });
  await createTestUser({ role: 'COURT_OWNER' });

  const facilityValues = {
    ownerId: player1.id,
    phone: '0900000000',
    address: '1 Đường Test',
    district: 'Quận 1',
    city: 'Hồ Chí Minh',
    openingTime: time('06:00'),
    closingTime: time('22:00'),
  };

  const [activeFacility] = await db.insert(facilities).values({
    ...facilityValues, name: 'Cơ sở A', status: 'ACTIVE',
  }).returning();
  const [secondActiveFacility] = await db.insert(facilities).values({
    ...facilityValues, name: 'Cơ sở B', status: 'ACTIVE', openingTime: time('08:00'), closingTime: time('20:00'),
  }).returning();
  await db.insert(facilities).values({ ...facilityValues, name: 'Cơ sở tạm ngưng', status: 'SUSPENDED' });
  await db.insert(facilities).values({ ...facilityValues, name: 'Cơ sở chờ duyệt', status: 'PENDING_APPROVAL' });

  const [activeCourt] = await db.insert(courts).values({
    facilityId: activeFacility.id, name: 'Sân A1', status: 'ACTIVE',
  }).returning();
  const [secondActiveCourt] = await db.insert(courts).values({
    facilityId: secondActiveFacility.id, name: 'Sân B1', status: 'ACTIVE',
  }).returning();
  await db.insert(courts).values({ facilityId: activeFacility.id, name: 'Sân A2', status: 'SUSPENDED' });
  await db.insert(courts).values({
    facilityId: activeFacility.id, name: 'Sân A3', status: 'ACTIVE', deletedAt: new Date(),
  });

  const today = formatDateInBusinessZone(now);
  const bookingValues = {
    playerId: player1.id,
    bookingDate: today,
    unitPrice: '100000',
    totalAmount: '200000',
  };

  const [confirmedBooking] = await db.insert(bookings).values({
    ...bookingValues,
    courtId: activeCourt.id,
    startTime: time('18:00'),
    endTime: time('20:00'),
    status: 'CONFIRMED',
    bookingCode: 'DASH-001',
  }).returning();
  const [inProgressBooking] = await db.insert(bookings).values({
    ...bookingValues,
    playerId: player2.id,
    courtId: secondActiveCourt.id,
    startTime: time('08:00'),
    endTime: time('10:00'),
    status: 'IN_PROGRESS',
    bookingCode: 'DASH-002',
  }).returning();
  await db.insert(bookings).values({
    ...bookingValues,
    courtId: activeCourt.id,
    startTime: time('10:00'),
    endTime: time('11:00'),
    status: 'CANCELLED',
    bookingCode: 'DASH-003',
  });

  await db.insert(payments).values([
    {
      bookingId: confirmedBooking.id, amount: '200000', provider: 'MOCK',
      paymentMethod: 'MOCK', status: 'SUCCESS', paidAt: now,
    },
    {
      bookingId: inProgressBooking.id, amount: '100000', provider: 'MOCK',
      paymentMethod: 'MOCK', status: 'SUCCESS', paidAt: now,
    },
    {
      bookingId: confirmedBooking.id, amount: '50000', provider: 'MOCK',
      paymentMethod: 'MOCK', status: 'PENDING', paidAt: null,
    },
  ]);

  const tournamentBase = {
    creatorId: player1.id,
    format: 'SINGLE_ELIMINATION',
    matchType: 'DOUBLES',
    participantLimit: 8,
    registrationStart: now,
    registrationEnd: now,
    tournamentStart: now,
    tournamentEnd: now,
  };
  const [inProgressTournament] = await db.insert(tournaments).values({
    ...tournamentBase, name: 'Giải đang diễn ra', status: 'IN_PROGRESS',
  }).returning();
  await db.insert(tournaments).values({
    ...tournamentBase, name: 'Giải đã xong', status: 'COMPLETED',
  });

  await db.insert(tournamentRegistrations).values({
    tournamentId: inProgressTournament.id,
    playerId: player1.id,
    registrationType: 'SINGLES',
    status: 'CONFIRMED',
    registeredAt: now,
  });

  const [team] = await db.insert(tournamentTeams).values({
    tournamentId: inProgressTournament.id,
    name: 'Đội 1',
    captainId: player1.id,
    status: 'CONFIRMED',
  }).returning();
  await db.insert(tournamentTeamPlayers).values([
    { teamId: team.id, playerId: player1.id, role: 'CAPTAIN', joinedAt: now },
    { teamId: team.id, playerId: player2.id, role: 'MEMBER', joinedAt: now },
  ]);
  await db.insert(tournamentRegistrations).values({
    tournamentId: inProgressTournament.id,
    teamId: team.id,
    registrationType: 'DOUBLES',
    status: 'CONFIRMED',
    registeredAt: now,
  });

  await db.insert(reports).values([
    {
      reporterId: player2.id, reportedPlayerId: player1.id,
      reasonCode: 'SPAM', status: 'OPEN',
    },
    {
      reporterId: player1.id, reportedPlayerId: player2.id,
      reasonCode: 'HARASSMENT', status: 'RESOLVED', resolvedAt: now,
    },
  ]);

  return { player1, player2 };
}

describe('DashboardService range resolution', () => {
  const now = new Date('2026-11-19T05:30:00.000Z');

  it('resolves day to the Asia/Ho_Chi_Minh calendar day', () => {
    const bounds = resolveDashboardRange({ range: 'day' }, now);
    expect(bounds.start.toISOString()).toBe('2026-11-18T17:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-11-19T17:00:00.000Z');
    expect(bounds.days).toBe(1);
    expect(bounds.chartStartDate).toBe('2026-11-19');
    expect(bounds.chartEndDate).toBe('2026-11-19');
  });

  it('resolves month to a calendar month with a month-to-date chart', () => {
    const bounds = resolveDashboardRange({ range: 'month' }, now);
    expect(bounds.start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-11-30T17:00:00.000Z');
    expect(bounds.startDate).toBe('2026-11-01');
    expect(bounds.endDate).toBe('2026-11-19');
    expect(bounds.chartStartDate).toBe('2026-11-01');
    expect(bounds.chartEndDate).toBe('2026-11-19');
    expect(bounds.days).toBe(19);
  });

  it('resolves year to a calendar year with a year-to-date chart', () => {
    const bounds = resolveDashboardRange({ range: 'year' }, now);
    expect(bounds.start.toISOString()).toBe('2025-12-31T17:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-12-31T17:00:00.000Z');
    expect(bounds.startDate).toBe('2026-01-01');
    expect(bounds.endDate).toBe('2026-11-19');
    expect(bounds.chartStartDate).toBe('2026-01-01');
    expect(bounds.chartEndDate).toBe('2026-11-19');
    expect(bounds.days).toBe(323);
  });

  it('resolves a custom inclusive date range', () => {
    const bounds = resolveDashboardRange(
      { range: 'custom', startDate: '2026-11-01', endDate: '2026-11-10' },
      now,
    );
    expect(bounds.start.toISOString()).toBe('2026-10-31T17:00:00.000Z');
    expect(bounds.end.toISOString()).toBe('2026-11-10T17:00:00.000Z');
    expect(bounds.startDate).toBe('2026-11-01');
    expect(bounds.endDate).toBe('2026-11-10');
    expect(bounds.days).toBe(10);
  });

  it('rejects a custom range whose end is not after the start', () => {
    expect(() => resolveDashboardRange(
      { range: 'custom', startDate: '2026-11-10', endDate: '2026-11-10' },
      now,
    )).toThrowError(/endDate must be after startDate/);
  });
});

describe('DashboardService aggregates', () => {
  it('returns zeroed KPIs and zero-filled charts when there is no data', async () => {
    const kpis = await service.getKpis({ range: 'day' });
    expect(kpis.users).toEqual({ totalPlayers: 0, newUsers: 0, activeUserRate: 0 });
    expect(kpis.facilities).toEqual({
      totalFacilities: 0, totalCourts: 0, active: 0, suspended: 0, pendingApproval: 0,
    });
    expect(kpis.bookings).toEqual({ totalBookings: 0, slotFillRate: 0 });
    expect(kpis.revenue).toEqual({ estimatedValue: '0.00', currency: 'VND', isEstimate: true });
    expect(kpis.tournaments).toEqual({ inProgress: 0, participants: 0 });
    expect(kpis.reports).toEqual({ unresolved: 0 });

    const charts = await service.getCharts({ range: 'day' });
    expect(charts.series.newUsers).toHaveLength(1);
    expect(charts.series.newBookings.every((point) => point.count === 0)).toBe(true);
    expect(charts.series.revenueByDay).toHaveLength(1);
    expect(charts.series.revenueByDay.every((point) => point.amount === '0.00')).toBe(true);
    expect(charts.series.bookingStatuses).toEqual([]);
    expect(charts.series.bookingHeatmap).toEqual([]);
    expect(charts.series.topFacilities).toEqual([]);
    expect(charts.series.reportBreakdown).toEqual([]);
    expect(charts.series.tournamentStatuses).toEqual([]);

    const activities = await service.getRecentActivities(10);
    expect(activities.items).toEqual([]);
  });

  it('computes KPI definitions from seeded data', async () => {
    const now = new Date();
    await seedDashboardFixture(now);

    const kpis = await service.getKpis({ range: 'day' }, now);

    expect(kpis.users).toEqual({ totalPlayers: 2, newUsers: 2, activeUserRate: 1 });
    expect(kpis.facilities).toEqual({
      totalFacilities: 4,
      totalCourts: 3,
      active: 2,
      suspended: 1,
      pendingApproval: 1,
    });
    expect(kpis.bookings.totalBookings).toBe(3);
    expect(kpis.bookings.slotFillRate).toBe(0.1429);
    expect(kpis.revenue).toEqual({ estimatedValue: '300000.00', currency: 'VND', isEstimate: true });
    expect(kpis.tournaments).toEqual({ inProgress: 1, participants: 2 });
    expect(kpis.reports).toEqual({ unresolved: 1 });
  });

  it('returns zero-filled daily chart series across the selected range', async () => {
    await seedDashboardFixture(new Date());
    const now = new Date();

    const today = formatDateInBusinessZone(now);
    const weekStart = new Date(`${today}T00:00:00Z`);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const charts = await service.getCharts(
      { range: 'custom', startDate: weekStart.toISOString().slice(0, 10), endDate: today },
      now,
    );
    expect(charts.series.newUsers).toHaveLength(7);
    expect(charts.series.newBookings).toHaveLength(7);
    expect(charts.series.newUsers.at(-1)).toEqual({
      date: formatDateInBusinessZone(now), count: 2,
    });
    expect(charts.series.newBookings.at(-1)).toEqual({
      date: formatDateInBusinessZone(now), count: 3,
    });
    expect(charts.series.revenueByDay.at(-1)).toEqual({
      date: formatDateInBusinessZone(now), amount: '300000.00',
    });

    expect(charts.series.bookingStatuses).toEqual(expect.arrayContaining([
      { status: 'CONFIRMED', count: 1 },
      { status: 'IN_PROGRESS', count: 1 },
      { status: 'CANCELLED', count: 1 },
    ]));

    const isoWeekday = ((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
    const heatmap = new Map(
      charts.series.bookingHeatmap.map((cell) => [`${cell.weekday}-${cell.hour}`, cell.count]),
    );
    expect(heatmap.get(`${isoWeekday}-8`)).toBe(1);
    expect(heatmap.get(`${isoWeekday}-9`)).toBe(1);
    expect(heatmap.get(`${isoWeekday}-18`)).toBe(1);
    expect(heatmap.get(`${isoWeekday}-19`)).toBe(1);
    expect(heatmap.get(`${isoWeekday}-10`)).toBeUndefined();

    expect(charts.series.topFacilities.map((row) => row.name).sort())
      .toEqual(['Cơ sở A', 'Cơ sở B']);

    expect(charts.series.reportBreakdown).toEqual(expect.arrayContaining([
      { reasonCode: 'SPAM', open: 1, resolved: 0 },
      { reasonCode: 'HARASSMENT', open: 0, resolved: 1 },
    ]));

    expect(charts.series.tournamentStatuses).toEqual(expect.arrayContaining([
      { status: 'IN_PROGRESS', count: 1 },
      { status: 'COMPLETED', count: 1 },
    ]));
  });

  it('returns newest-first activity items without PII fields', async () => {
    await seedDashboardFixture(new Date());

    const activities = await service.getRecentActivities(10);
    expect(activities.items.length).toBeGreaterThan(0);
    for (const item of activities.items) {
      expect(Object.keys(item).sort()).toEqual(['occurredAt', 'summary', 'targetId', 'type']);
    }
    const occurredAt = activities.items.map((item) => new Date(item.occurredAt).getTime());
    expect([...occurredAt].sort((a, b) => b - a)).toEqual(occurredAt);
  });
});
