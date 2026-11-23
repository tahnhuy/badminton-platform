import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { and, eq, inArray } from 'drizzle-orm';
import { app } from '../app';
import { db, systemConfigs, systemConfigAudit } from '../db';
import { createTestUser } from './test-helpers';
import { clearConfigCache } from '../shared/config/config-registry';

const MANAGED_KEYS = [
  'BOOKING_ENABLED',
  'BOOKING_ACTIVE_LIMIT_MODE',
  'BOOKING_MAX_ACTIVE_PER_PLAYER',
  'BOOKING_MIN_DURATION_MINUTES',
  'BOOKING_MAX_DURATION_MINUTES',
  'MATCHMAKING_GROUP_MIN_SLOTS',
  'MATCHMAKING_GROUP_MAX_SLOTS',
  'MATCHMAKING_REQUEST_EXPIRATION_MINUTES',
  'PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS',
  'PLAYER_SKILL_ADJUSTMENT_ENABLED',
];

async function resetManagedConfigs(): Promise<void> {
  await db.delete(systemConfigs).where(inArray(systemConfigs.configKey, MANAGED_KEYS));
  clearConfigCache();
}

describe('Admin configuration API', () => {
  let adminId: number;
  let playerId: number;

  beforeEach(async () => {
    await db.delete(systemConfigAudit);
    await resetManagedConfigs();
    adminId = (await createTestUser({ role: 'ADMIN' })).id;
    playerId = (await createTestUser({ role: 'PLAYER' })).id;
  });

  afterEach(async () => {
    await resetManagedConfigs();
  });

  it('requires an Admin session', async () => {
    expect((await request(app).get('/api/v1/admin/configs')).status).toBe(401);
    expect((await request(app).get('/api/v1/admin/configs').set('x-user-id', String(playerId))).status).toBe(403);
  });

  it('lists registry keys with default fallback and pagination meta', async () => {
    const res = await request(app)
      .get('/api/v1/admin/configs?domain=booking&limit=5')
      .set('x-user-id', String(adminId));

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 5, total: 12, totalPages: 3 });
    expect(res.body.data).toHaveLength(5);
    const bookingEnabled = res.body.data.find((item: { configKey: string }) => item.configKey === 'BOOKING_ENABLED');
    expect(bookingEnabled).toMatchObject({
      configKey: 'BOOKING_ENABLED',
      configValue: 'true',
      valueType: 'boolean',
      domain: 'booking',
      documentedDefault: 'true',
      usingDefault: true,
      updatedAt: null,
      updatedBy: null,
      editable: true,
    });
  });

  it('gets one key and returns 404 for an unknown key', async () => {
    const found = await request(app)
      .get('/api/v1/admin/configs/BOOKING_ACTIVE_LIMIT_MODE')
      .set('x-user-id', String(adminId));
    expect(found.status).toBe(200);
    expect(found.body.data).toMatchObject({
      configValue: 'LIMITED', valueType: 'enum', allowedValues: ['LIMITED', 'UNLIMITED'], usingDefault: true,
    });

    const missing = await request(app)
      .get('/api/v1/admin/configs/DOES_NOT_EXIST')
      .set('x-user-id', String(adminId));
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('CONFIG_KEY_NOT_FOUND');
  });

  it('updates a value and writes exactly one audit row on first write', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_ENABLED')
      .set('x-user-id', String(adminId))
      .send({ value: false });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      configKey: 'BOOKING_ENABLED',
      configValue: 'false',
      usingDefault: false,
      updatedBy: adminId,
    });

    const audits = await db.select().from(systemConfigAudit)
      .where(eq(systemConfigAudit.configKey, 'BOOKING_ENABLED'));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ oldValue: null, newValue: 'false', changedBy: adminId });
  });

  it('treats a repeated value as a no-op without an audit row', async () => {
    await request(app)
      .patch('/api/v1/admin/configs/BOOKING_MAX_ACTIVE_PER_PLAYER')
      .set('x-user-id', String(adminId))
      .send({ value: 8 });

    const before = await db.select().from(systemConfigAudit)
      .where(eq(systemConfigAudit.configKey, 'BOOKING_MAX_ACTIVE_PER_PLAYER'));
    expect(before).toHaveLength(1);

    const res = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_MAX_ACTIVE_PER_PLAYER')
      .set('x-user-id', String(adminId))
      .send({ value: '8' });

    expect(res.status).toBe(200);
    expect(res.body.data.configValue).toBe('8');
    const after = await db.select().from(systemConfigAudit)
      .where(eq(systemConfigAudit.configKey, 'BOOKING_MAX_ACTIVE_PER_PLAYER'));
    expect(after).toHaveLength(1);
  });

  it('validates enum, range and cross-key rules without writing', async () => {
    const invalidEnum = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_ACTIVE_LIMIT_MODE')
      .set('x-user-id', String(adminId))
      .send({ value: 'SOMETIMES' });
    expect(invalidEnum.status).toBe(400);
    expect(invalidEnum.body.error.code).toBe('CONFIG_VALUE_INVALID');

    const outOfRange = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_MAX_ACTIVE_PER_PLAYER')
      .set('x-user-id', String(adminId))
      .send({ value: 0 });
    expect(outOfRange.status).toBe(400);
    expect(outOfRange.body.error.code).toBe('CONFIG_VALUE_INVALID');

    const crossKey = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_MIN_DURATION_MINUTES')
      .set('x-user-id', String(adminId))
      .send({ value: 200 });
    expect(crossKey.status).toBe(400);
    expect(crossKey.body.error.code).toBe('CONFIG_VALUE_INVALID');
    expect(crossKey.body.error.details[0].code).toBe('CROSS_KEY_RULE');

    const rows = await db.select().from(systemConfigs)
      .where(inArray(systemConfigs.configKey, ['BOOKING_ACTIVE_LIMIT_MODE', 'BOOKING_MAX_ACTIVE_PER_PLAYER', 'BOOKING_MIN_DURATION_MINUTES']));
    expect(rows).toHaveLength(0);
  });

  it('rejects writes to read-only keys and records no audit row', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/configs/MATCHMAKING_REQUEST_EXPIRATION_MINUTES')
      .set('x-user-id', String(adminId))
      .send({ value: 60 });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFIG_KEY_READ_ONLY');
    const audits = await db.select().from(systemConfigAudit)
      .where(and(eq(systemConfigAudit.configKey, 'MATCHMAKING_REQUEST_EXPIRATION_MINUTES')));
    expect(audits).toHaveLength(0);
  });

  it('AUTH-33: refuses to enable rating-based skill adjustment; the value stays false', async () => {
    const list = await request(app).get('/api/v1/admin/configs?domain=player-skill-adjustment&limit=20').set('x-user-id', String(adminId));
    const item = list.body.data.find((c: { configKey: string }) => c.configKey === 'PLAYER_SKILL_ADJUSTMENT_ENABLED');
    expect(item).toMatchObject({ editable: false, configValue: 'false' });

    const res = await request(app)
      .patch('/api/v1/admin/configs/PLAYER_SKILL_ADJUSTMENT_ENABLED')
      .set('x-user-id', String(adminId))
      .send({ value: true });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFIG_KEY_READ_ONLY');
    const rows = await db.select().from(systemConfigs).where(eq(systemConfigs.configKey, 'PLAYER_SKILL_ADJUSTMENT_ENABLED'));
    expect(rows.every(row => row.configValue === 'false')).toBe(true);
    const audits = await db.select().from(systemConfigAudit).where(eq(systemConfigAudit.configKey, 'PLAYER_SKILL_ADJUSTMENT_ENABLED'));
    expect(audits).toHaveLength(0);
  });

  it('keeps last-commit-wins semantics and audits both concurrent changes', async () => {
    const [first, second] = await Promise.all([
      request(app)
        .patch('/api/v1/admin/configs/BOOKING_MAX_ACTIVE_PER_PLAYER')
        .set('x-user-id', String(adminId))
        .send({ value: 6 }),
      request(app)
        .patch('/api/v1/admin/configs/BOOKING_MAX_ACTIVE_PER_PLAYER')
        .set('x-user-id', String(adminId))
        .send({ value: 7 }),
    ]);

    expect([first.status, second.status]).toEqual([200, 200]);
    const [row] = await db.select().from(systemConfigs)
      .where(eq(systemConfigs.configKey, 'BOOKING_MAX_ACTIVE_PER_PLAYER'));
    expect(['6', '7']).toContain(row.configValue);

    const audits = await db.select().from(systemConfigAudit)
      .where(eq(systemConfigAudit.configKey, 'BOOKING_MAX_ACTIVE_PER_PLAYER'));
    expect(audits).toHaveLength(2);
  });

  it('rejects a missing request body', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/configs/BOOKING_ENABLED')
      .set('x-user-id', String(adminId))
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
  });
});
