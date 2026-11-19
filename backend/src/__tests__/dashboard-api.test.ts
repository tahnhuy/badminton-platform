import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import { createTestUser } from './test-helpers';

const CACHE = 'private, max-age=30, must-revalidate';

describe('Admin dashboard API', () => {
  let adminId: number;
  let playerId: number;

  beforeEach(async () => {
    adminId = (await createTestUser({ role: 'ADMIN' })).id;
    playerId = (await createTestUser({ role: 'PLAYER' })).id;
  });

  describe('authorization', () => {
    it('requires an authenticated session', async () => {
      const res = await request(app).get('/api/v1/admin/dashboard/kpis');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('AUTH_SESSION_INVALID');
    });

    it('denies non-Admin roles', async () => {
      for (const path of ['kpis', 'charts', 'recent-activities']) {
        const res = await request(app)
          .get(`/api/v1/admin/dashboard/${path}`)
          .set('x-user-id', String(playerId));
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
      }
    });
  });

  describe('validation', () => {
    it('rejects an invalid range with the feature error code', async () => {
      for (const path of ['kpis', 'charts']) {
        const res = await request(app)
          .get(`/api/v1/admin/dashboard/${path}?range=all_time`)
          .set('x-user-id', String(adminId));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('ADMIN_DASHBOARD_INVALID_RANGE');
      }
    });

    it('accepts a valid custom range and rejects invalid custom boundaries', async () => {
      const valid = await request(app)
        .get('/api/v1/admin/dashboard/kpis?range=custom&startDate=2026-11-01&endDate=2026-11-10')
        .set('x-user-id', String(adminId));
      expect(valid.status).toBe(200);
      expect(valid.body.data.range).toBe('custom');

      for (const query of [
        'range=custom&startDate=2026-11-10&endDate=2026-11-10',
        'range=custom&startDate=2026-11-10&endDate=2026-11-01',
        'range=custom&startDate=not-a-date&endDate=2026-11-10',
        'range=custom&startDate=2026-11-01',
      ]) {
        const res = await request(app)
          .get(`/api/v1/admin/dashboard/kpis?${query}`)
          .set('x-user-id', String(adminId));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('ADMIN_DASHBOARD_INVALID_RANGE');
      }
    });

    it('rejects a limit outside 10-20 with VALIDATION_FAILED', async () => {
      for (const limit of [9, 21, 100]) {
        const res = await request(app)
          .get(`/api/v1/admin/dashboard/recent-activities?limit=${limit}`)
          .set('x-user-id', String(adminId));
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('responses', () => {
    it('returns KPIs with cache headers and the documented shape', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/kpis?range=month')
        .set('x-user-id', String(adminId));

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe(CACHE);
      expect(res.body.data.range).toBe('month');
      expect(res.body.data.users).toEqual({
        totalPlayers: expect.any(Number),
        newUsers: expect.any(Number),
        activeUserRate: expect.any(Number),
      });
      expect(res.body.data.facilities).toEqual({
        totalFacilities: expect.any(Number),
        totalCourts: expect.any(Number),
        active: expect.any(Number),
        suspended: expect.any(Number),
        pendingApproval: expect.any(Number),
      });
      expect(res.body.data.bookings).toEqual({
        totalBookings: expect.any(Number),
        slotFillRate: expect.any(Number),
      });
      expect(res.body.data.revenue).toEqual({
        estimatedValue: expect.any(String),
        currency: 'VND',
        isEstimate: true,
      });
      expect(res.body.data.tournaments).toEqual({
        inProgress: expect.any(Number),
        participants: expect.any(Number),
      });
      expect(res.body.data.reports).toEqual({ unresolved: expect.any(Number) });
    });

    it('defaults the range to month', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/kpis')
        .set('x-user-id', String(adminId));
      expect(res.status).toBe(200);
      expect(res.body.data.range).toBe('month');
    });

    it('returns zero-filled chart series with cache headers', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/charts?range=day')
        .set('x-user-id', String(adminId));

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe(CACHE);
      expect(res.body.data.range).toBe('day');
      expect(res.body.data.series.newUsers).toHaveLength(1);
      expect(res.body.data.series.newBookings).toHaveLength(1);
      expect(res.body.data.series.newUsers[0]).toEqual({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        count: expect.any(Number),
      });
      expect(res.body.data.series.revenueByDay).toHaveLength(1);
      expect(res.body.data.series.revenueByDay[0]).toEqual({
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        amount: expect.stringMatching(/^\d+\.\d{2}$/),
      });
      for (const key of [
        'bookingStatuses', 'bookingHeatmap', 'topFacilities', 'reportBreakdown', 'tournamentStatuses',
      ]) {
        expect(Array.isArray(res.body.data.series[key])).toBe(true);
      }
    });

    it('returns the bounded activity feed without PII', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard/recent-activities?limit=10')
        .set('x-user-id', String(adminId));

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe(CACHE);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeLessThanOrEqual(10);
      expect(JSON.stringify(res.body)).not.toContain('@example.com');
    });

    it('accepts the limit bounds and uses the default', async () => {
      for (const limit of [10, 15, 20]) {
        const res = await request(app)
          .get(`/api/v1/admin/dashboard/recent-activities?limit=${limit}`)
          .set('x-user-id', String(adminId));
        expect(res.status).toBe(200);
      }

      const defaulted = await request(app)
        .get('/api/v1/admin/dashboard/recent-activities')
        .set('x-user-id', String(adminId));
      expect(defaulted.status).toBe(200);
      expect(defaulted.body.data.items.length).toBeLessThanOrEqual(10);
    });
  });
});
