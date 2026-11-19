import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, reports, facilities, tournaments } from '../db';
import { authRepository } from '../repositories/auth/AuthRepository';
import { adminReportService } from '../services/admin/AdminReportService';
import { createTestUser } from './test-helpers';

// RP-01/RP-02 (Report Management Tech Design §2–§13).
const allowedFields = [
  'id', 'reporterId', 'targetType', 'reasonCode', 'description', 'status', 'resolvedAt', 'createdAt', 'updatedAt',
];

describe('Admin report review API (RP-01/RP-02)', () => {
  let adminId: number;
  let playerId: number;
  let ownerId: number;
  let reportedId: number;
  let playerReport: number;
  let facilityReport: number;
  let tournamentReport: number;
  let resolvedReport: number;

  const asUser = (id: number) => ({
    get: (url: string) => request(app).get(url).set('x-user-id', String(id)),
    patch: (url: string, body: unknown) => request(app).patch(url).set('x-user-id', String(id)).send(body as object),
  });

  beforeEach(async () => {
    adminId = (await createTestUser({ role: 'ADMIN' })).id;
    playerId = (await createTestUser({ role: 'PLAYER' })).id;
    ownerId = (await createTestUser({ role: 'COURT_OWNER' })).id;
    reportedId = (await createTestUser({ role: 'PLAYER' })).id;
    const [facility] = await db.insert(facilities).values({
      ownerId, name: 'Sân A', phone: '0900000000', status: 'ACTIVE', address: '1 Đường A', district: 'Q1', city: 'HCM',
      latitude: '10.7', longitude: '106.6', openingTime: '06:00', closingTime: '22:00',
    }).returning();
    const [tournament] = await db.insert(tournaments).values({
      creatorId: playerId, name: 'Giải A', format: 'KNOCKOUT', matchType: 'SINGLES', participantLimit: 8, status: 'DRAFT',
      registrationStart: new Date('2030-01-01'), registrationEnd: new Date('2030-01-05'),
      tournamentStart: new Date('2030-01-10'), tournamentEnd: new Date('2030-01-11'),
    }).returning();
    const inserted = await db.insert(reports).values([
      { reporterId: playerId, reportedPlayerId: reportedId, reasonCode: 'HARASSMENT', description: '<script>x</script>', status: 'OPEN', createdAt: new Date('2026-01-01T00:00:00Z') },
      { reporterId: playerId, reportedFacilityId: facility.id, reasonCode: 'FACILITY_ISSUE', status: 'OPEN', createdAt: new Date('2026-01-02T00:00:00Z') },
      { reporterId: playerId, reportedTournamentId: tournament.id, reasonCode: 'OTHER', status: 'OPEN', createdAt: new Date('2026-01-03T00:00:00Z') },
      { reporterId: playerId, reportedPlayerId: reportedId, reasonCode: 'SPAM', status: 'RESOLVED', resolvedAt: new Date('2026-01-05T00:00:00Z'), createdAt: new Date('2026-01-04T00:00:00Z') },
    ]).returning();
    [playerReport, facilityReport, tournamentReport, resolvedReport] = inserted.map(row => row.id);
  });

  describe('GET /api/v1/admin/reports', () => {
    it('returns the allowlisted shape with one target per item, newest first, and pagination meta', async () => {
      const res = await asUser(adminId).get('/api/v1/admin/reports');
      expect(res.status).toBe(200);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 4, totalPages: 1 });
      expect(res.body.data.map((item: { id: string }) => item.id)).toEqual(
        [resolvedReport, tournamentReport, facilityReport, playerReport].map(String),
      );
      const [first, , facilityItem] = res.body.data;
      expect(Object.keys(first).sort()).toEqual([...allowedFields, 'reportedPlayerId'].sort());
      expect(first).toMatchObject({ targetType: 'PLAYER', reportedPlayerId: String(reportedId), reporterId: String(playerId), status: 'RESOLVED', resolvedAt: '2026-01-05T00:00:00.000Z' });
      expect(Object.keys(facilityItem)).toContain('reportedFacilityId');
      expect(facilityItem).not.toHaveProperty('reportedPlayerId');
      expect(facilityItem.resolvedAt).toBeNull();
    });

    it('filters by target_type and status and paginates', async () => {
      for (const [targetType, field] of [['PLAYER', 'reportedPlayerId'], ['FACILITY', 'reportedFacilityId'], ['TOURNAMENT', 'reportedTournamentId']]) {
        const res = await asUser(adminId).get(`/api/v1/admin/reports?targetType=${targetType}`);
        expect(res.status).toBe(200);
        expect(res.body.data.length).toBeGreaterThan(0);
        for (const item of res.body.data) {
          expect(item.targetType).toBe(targetType);
          expect(item).toHaveProperty(field);
        }
      }
      const open = await asUser(adminId).get('/api/v1/admin/reports?status=OPEN&targetType=PLAYER');
      expect(open.body.data.map((item: { id: string }) => item.id)).toEqual([String(playerReport)]);
      const page = await asUser(adminId).get('/api/v1/admin/reports?page=2&limit=3');
      expect(page.body).toMatchObject({ meta: { page: 2, limit: 3, total: 4, totalPages: 2 } });
      expect(page.body.data.map((item: { id: string }) => item.id)).toEqual([String(playerReport)]);
      const empty = await asUser(adminId).get('/api/v1/admin/reports?page=9');
      expect(empty.status).toBe(200);
      expect(empty.body).toEqual({ data: [], meta: { page: 9, limit: 20, total: 4, totalPages: 1 } });
    });

    it('filters by report creation date range', async () => {
      const range = await asUser(adminId).get('/api/v1/admin/reports?startDate=2026-01-02&endDate=2026-01-03');
      expect(range.status).toBe(200);
      expect(range.body.data.map((item: { id: string }) => item.id)).toEqual(
        [String(tournamentReport), String(facilityReport)],
      );

      const singleDay = await asUser(adminId).get('/api/v1/admin/reports?startDate=2026-01-01&endDate=2026-01-01');
      expect(singleDay.body.data.map((item: { id: string }) => item.id)).toEqual([String(playerReport)]);

      const inverted = await asUser(adminId).get('/api/v1/admin/reports?startDate=2026-01-05&endDate=2026-01-01');
      expect(inverted.status).toBe(400);
      expect(inverted.body.error.code).toBe('VALIDATION_FAILED');
    });

    it('rejects malformed queries with 400', async () => {
      for (const query of ['targetType=NOPE', 'status=PENDING', 'page=0', 'limit=101', 'limit=abc', 'startDate=abc', 'endDate=2026/01/01', 'startDate=2026-02-31', 'endDate=2026-13-01', "targetType=PLAYER' OR 1=1"]) {
        const res = await asUser(adminId).get(`/api/v1/admin/reports?${query}`);
        expect(res.status, query).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('returns an empty page when no report exists', async () => {
      await db.delete(reports);
      const res = await asUser(adminId).get('/api/v1/admin/reports');
      expect(res.body).toEqual({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
    });
  });

  describe('authorization', () => {
    it('requires authentication and the ADMIN role on every endpoint', async () => {
      const urls = ['/api/v1/admin/reports', `/api/v1/admin/reports/${playerReport}`];
      for (const url of urls) {
        expect((await request(app).get(url)).status).toBe(401);
        for (const id of [playerId, ownerId]) {
          const res = await asUser(id).get(url);
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');
          expect(res.body).not.toHaveProperty('data');
        }
      }
      expect((await request(app).patch(`/api/v1/admin/reports/${playerReport}/status`).send({ status: 'RESOLVED' })).status).toBe(401);
      expect((await asUser(playerId).patch(`/api/v1/admin/reports/${playerReport}/status`, { status: 'RESOLVED' })).status).toBe(403);
      expect((await db.select().from(reports).where(eq(reports.id, playerReport)))[0].status).toBe('OPEN');
    });

    it('also enforces ADMIN at the service boundary', async () => {
      await expect(adminReportService.listReports({ id: playerId, role: 'PLAYER' }, { page: 1, limit: 20 })).rejects.toMatchObject({ statusCode: 403 });
      await expect(adminReportService.updateStatus(undefined, playerReport, 'RESOLVED')).rejects.toMatchObject({ statusCode: 403 });
    });

    it('requires the CSRF token for a session-authenticated status update', async () => {
      const session = await authRepository.createSession(adminId, 'ADMIN');
      const cookie = `sid=${session.rawToken}; csrf_token=csrf-test-token`;
      const missing = await request(app).patch(`/api/v1/admin/reports/${playerReport}/status`).set('Cookie', cookie).send({ status: 'RESOLVED' });
      expect(missing.status).toBe(403);
      expect(missing.body.error.code).toBe('AUTH_CSRF_TOKEN_INVALID');
      const ok = await request(app).patch(`/api/v1/admin/reports/${playerReport}/status`)
        .set('Cookie', cookie).set('X-CSRF-Token', 'csrf-test-token').send({ status: 'RESOLVED' });
      expect(ok.status).toBe(200);
      const list = await request(app).get('/api/v1/admin/reports').set('Cookie', cookie);
      expect(list.status).toBe(200);
    });
  });

  describe('GET /api/v1/admin/reports/:id', () => {
    it('returns the single target and approved fields only', async () => {
      const res = await asUser(adminId).get(`/api/v1/admin/reports/${tournamentReport}`);
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.data).sort()).toEqual([...allowedFields, 'reportedTournamentId', 'evidence'].sort());
      expect(res.body.data).toMatchObject({ targetType: 'TOURNAMENT', reasonCode: 'OTHER', status: 'OPEN', evidence: { text: null, media: [] } });
      const player = await asUser(adminId).get(`/api/v1/admin/reports/${playerReport}`);
      expect(player.body.data.description).toBe('<script>x</script>');
    });

    it('returns 404 for a missing report and 400 for a malformed id', async () => {
      const missing = await asUser(adminId).get('/api/v1/admin/reports/999999999');
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual({ error: { code: 'ADMIN_REPORT_NOT_FOUND', message: 'Report not found', details: [] } });
      for (const id of ['abc', '0', '-1', '1.5', '99999999999999999999']) {
        const res = await asUser(adminId).get(`/api/v1/admin/reports/${id}`);
        expect(res.status, id).toBe(400);
      }
    });
  });

  describe('PATCH /api/v1/admin/reports/:id/status', () => {
    const url = (id: number) => `/api/v1/admin/reports/${id}/status`;

    it('resolves an OPEN report and records resolved_at', async () => {
      const res = await asUser(adminId).patch(url(facilityReport), { status: 'RESOLVED' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: String(facilityReport), status: 'RESOLVED', targetType: 'FACILITY' });
      expect(Date.parse(res.body.data.resolvedAt)).not.toBeNaN();
      const [row] = await db.select().from(reports).where(eq(reports.id, facilityReport));
      expect(row.status).toBe('RESOLVED');
      expect(row.resolvedAt).not.toBeNull();
    });

    it('rejects any update of a RESOLVED report without changing it', async () => {
      const [before] = await db.select().from(reports).where(eq(reports.id, resolvedReport));
      for (const status of ['RESOLVED', 'OPEN']) {
        const res = await asUser(adminId).patch(url(resolvedReport), { status });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe(status === 'RESOLVED' ? 'ADMIN_REPORT_INVALID_TRANSITION' : 'ADMIN_REPORT_INVALID_STATUS');
      }
      const [after] = await db.select().from(reports).where(eq(reports.id, resolvedReport));
      expect(after).toEqual(before);
    });

    it('rejects non-RESOLVED targets, extra fields and malformed bodies', async () => {
      for (const status of ['OPEN', 'CLOSED', 'resolved', '']) {
        const res = await asUser(adminId).patch(url(playerReport), { status });
        expect(res.status, status).toBe(400);
        expect(res.body.error.code).toBe('ADMIN_REPORT_INVALID_STATUS');
      }
      const note = await asUser(adminId).patch(url(playerReport), { status: 'RESOLVED', note: 'done' });
      expect(note.status).toBe(400);
      expect(note.body.error.code).toBe('VALIDATION_FAILED');
      expect((await asUser(adminId).patch(url(playerReport), {})).status).toBe(400);
      expect((await asUser(adminId).patch(url(playerReport), { status: 1 })).status).toBe(400);
      expect((await db.select().from(reports).where(eq(reports.id, playerReport)))[0].status).toBe('OPEN');
    });

    it('returns 404 for a missing report', async () => {
      const res = await asUser(adminId).patch(url(999999999), { status: 'RESOLVED' });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('ADMIN_REPORT_NOT_FOUND');
    });

    it('lets exactly one of two concurrent resolutions succeed and keeps the first resolved_at', async () => {
      const results = await Promise.all([
        asUser(adminId).patch(url(playerReport), { status: 'RESOLVED' }),
        asUser(adminId).patch(url(playerReport), { status: 'RESOLVED' }),
      ]);
      expect(results.map(res => res.status).sort()).toEqual([200, 400]);
      const winner = results.find(res => res.status === 200)!;
      expect(results.find(res => res.status === 400)!.body.error.code).toBe('ADMIN_REPORT_INVALID_TRANSITION');
      const [row] = await db.select().from(reports).where(eq(reports.id, playerReport));
      expect(row.resolvedAt!.toISOString()).toBe(winner.body.data.resolvedAt);
    });
  });
});
