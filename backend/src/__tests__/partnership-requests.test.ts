import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { users, courtOwnerProfiles } from '../db/schema/users';
import { emailOutbox } from '../db/schema/email';
import { notifications } from '../db/schema/notifications';
import { systemConfigs } from '../db/schema/config';
import { ownerPartnershipRequests } from '../db/schema/partnership';
import { clearConfigCache } from '../shared/config/config-registry';
import { renderEmail } from '../services/email/templates';
import { normalizeVietnamesePhone } from '../validation/partnership';
import { notificationResourceResolver } from '../services/notifications/NotificationResourceResolver';
import { createTestUser, flushEmailOutbox, latestOtp } from './test-helpers';

// Court Owner partnership requests (docs/features/court-owner/partnership-request/tech-design.md §13).
const PUBLIC = '/api/v1/owner-requests';
const ADMIN = '/api/v1/admin/owner-requests';

function form(overrides: Record<string, unknown> = {}) {
  return {
    contactName: 'Nguyễn Văn A',
    email: 'owner.request@example.com',
    phone: '+84 901 234 567',
    facilityName: 'Sân cầu lông Phú Nhuận',
    addressLine: '12 Phan Xích Long',
    district: 'Phú Nhuận',
    city: 'TP. Hồ Chí Minh',
    expectedCourts: 6,
    note: 'Có 6 sân thảm',
    consent: true,
    website: '',
    ...overrides,
  };
}
const asAdmin = (id: number) => ({ get: (url: string) => request(app).get(url).set('x-user-id', String(id)), post: (url: string) => request(app).post(url).set('x-user-id', String(id)), patch: (url: string) => request(app).patch(url).set('x-user-id', String(id)) });
const outbox = (template: string) => db.select().from(emailOutbox).where(eq(emailOutbox.template, template));

async function submitted(overrides: Record<string, unknown> = {}) {
  const response = await request(app).post(PUBLIC).send(form(overrides));
  expect(response.status).toBe(202);
  const [row] = await db.select().from(ownerPartnershipRequests).where(eq(ownerPartnershipRequests.email, String(overrides.email ?? 'owner.request@example.com')));
  return row!;
}

describe('Partnership request: public form', () => {
  it('stores a PENDING request, notifies every active Admin and queues the receipt email', async () => {
    const admins = [await createTestUser({ role: 'ADMIN' }), await createTestUser({ role: 'ADMIN' })];
    await createTestUser({ role: 'ADMIN', status: 'SUSPENDED' });
    const row = await submitted();
    expect(row.status).toBe('PENDING');
    expect(row.phone).toBe('0901234567');
    expect(row.email).toBe('owner.request@example.com');
    const sent = await db.select().from(notifications).where(eq(notifications.type, 'ADMIN_OWNER_REQUEST_CREATED'));
    expect(sent.map(n => n.userId).sort()).toEqual(admins.map(a => a.id).sort());
    expect(await outbox('OWNER_REQUEST_RECEIVED')).toHaveLength(1);
  });

  it('answers a duplicate open request and the honeypot like a success without storing or emailing', async () => {
    await submitted();
    expect((await request(app).post(PUBLIC).send(form({ email: 'OWNER.request@example.com' }))).status).toBe(202);
    expect((await request(app).post(PUBLIC).send(form({ email: 'bot@example.com', website: 'http://spam' }))).status).toBe(202);
    expect(await db.select().from(ownerPartnershipRequests)).toHaveLength(1);
    expect(await outbox('OWNER_REQUEST_RECEIVED')).toHaveLength(1);
  });

  it('tells an email with an account to use another email', async () => {
    const player = await createTestUser({ role: 'PLAYER' });
    const response = await request(app).post(PUBLIC).send(form({ email: player.email }));
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('OWNER_REQUEST_EMAIL_HAS_ACCOUNT');
    expect(response.body.error.details[0].field).toBe('email');
    expect(await db.select().from(ownerPartnershipRequests)).toHaveLength(0);
  });

  it('validates fields and consent', async () => {
    const response = await request(app).post(PUBLIC).send(form({ phone: '12345', consent: false, expectedCourts: 0 }));
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });

  it('refuses new requests while switched off', async () => {
    await db.insert(systemConfigs).values({ configKey: 'OWNER_PARTNERSHIP_ENABLED', configValue: 'false' })
      .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'false' } });
    clearConfigCache();
    try {
      expect((await request(app).get(`${PUBLIC}/availability`)).body.data.enabled).toBe(false);
      const response = await request(app).post(PUBLIC).send(form());
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe('OWNER_REQUEST_DISABLED');
    } finally {
      clearConfigCache();
    }
  });

  it('rate limits submissions from one network', async () => {
    for (let n = 0; n < 5; n += 1) {
      expect((await request(app).post(PUBLIC).send(form({ email: `rate${n}@example.com` }))).status).toBe(202);
    }
    expect((await request(app).post(PUBLIC).send(form({ email: 'rate5@example.com' }))).status).toBe(429);
  });
});

describe('Partnership request: Admin review', () => {
  it('approves into an ACTIVE Court Owner whose owner sets the password through the reset OTP', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const row = await submitted();
    const api = asAdmin(admin.id);

    const contacted = await api.post(`${ADMIN}/${row.id}/contact`);
    expect(contacted.status).toBe(200);
    expect(contacted.body.data.status).toBe('CONTACTED');
    expect((await api.patch(`${ADMIN}/${row.id}/note`).send({ adminNote: 'Đã gọi, hẹn khảo sát.' })).body.data.adminNote).toBe('Đã gọi, hẹn khảo sát.');

    const approved = await api.post(`${ADMIN}/${row.id}/approve`).send({ businessName: 'CLB Phú Nhuận', phone: '0901234567' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.processedBy.id).toBe(admin.id);
    const [owner] = await db.select().from(users).where(eq(users.email, row.email));
    expect(owner.role).toBe('COURT_OWNER');
    expect(owner.status).toBe('ACTIVE');
    expect(owner.mustChangePassword).toBe(true);
    expect(approved.body.data.createdUser).toEqual({ id: owner.id, email: owner.email });
    const [profile] = await db.select().from(courtOwnerProfiles).where(eq(courtOwnerProfiles.userId, owner.id));
    expect(profile.businessName).toBe('CLB Phú Nhuận');

    const [mail] = await outbox('OWNER_ACCOUNT_CREATED');
    const payload = mail.payload as Record<string, string>;
    expect(payload.actionUrl).toContain('/forgot-password?email=owner.request%40example.com');
    expect(JSON.stringify(payload)).not.toMatch(/password"/i);

    // Final state: no further change.
    for (const call of [api.post(`${ADMIN}/${row.id}/contact`), api.post(`${ADMIN}/${row.id}/reject`).send({ reason: 'Không còn phù hợp nữa.' }), api.patch(`${ADMIN}/${row.id}/note`).send({ adminNote: 'x' })]) {
      const response = await call;
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('OWNER_REQUEST_INVALID_STATE');
    }

    // The owner sets their own password; no forced change follows.
    const forgot = await request(app).post('/api/v1/auth/password/forgot').send({ email: owner.email });
    await flushEmailOutbox();
    const otp = await latestOtp(owner.email, 'PASSWORD_RESET_OTP');
    const verified = await request(app).post('/api/v1/auth/password/reset/verify').send({ challengeId: forgot.body.data.challengeId, otp });
    expect(verified.status).toBe(200);
    expect((await request(app).post('/api/v1/auth/password/reset').send({ resetToken: verified.body.data.resetToken, newPassword: 'OwnerPass123' })).status).toBe(200);
    const login = await request(app).post('/api/v1/auth/login').send({ email: owner.email, password: 'OwnerPass123' });
    expect(login.status).toBe(200);
    const [after] = await db.select().from(users).where(eq(users.id, owner.id));
    expect(after.mustChangePassword).toBe(false);
    expect(after.emailVerifiedAt).not.toBeNull();
  });

  it('keeps the request open when the email got an account meanwhile', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const row = await submitted();
    await createTestUser({ role: 'PLAYER', email: row.email });
    const response = await asAdmin(admin.id).post(`${ADMIN}/${row.id}/approve`).send({ businessName: 'CLB', phone: '0901234567' });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('USER_EMAIL_EXISTS');
    const [still] = await db.select().from(ownerPartnershipRequests).where(eq(ownerPartnershipRequests.id, row.id));
    expect(still.status).toBe('PENDING');
    expect(await outbox('OWNER_ACCOUNT_CREATED')).toHaveLength(0);
  });

  it('creates exactly one account when two Admins approve at once', async () => {
    const [a, b] = [await createTestUser({ role: 'ADMIN' }), await createTestUser({ role: 'ADMIN' })];
    const row = await submitted();
    const body = { businessName: 'CLB', phone: '0901234567' };
    const results = await Promise.all([asAdmin(a.id).post(`${ADMIN}/${row.id}/approve`).send(body), asAdmin(b.id).post(`${ADMIN}/${row.id}/approve`).send(body)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await db.select().from(users).where(eq(users.email, row.email))).toHaveLength(1);
  });

  it('rejects only with a reason and emails it; a new request is then allowed', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const row = await submitted();
    const api = asAdmin(admin.id);
    expect((await api.post(`${ADMIN}/${row.id}/reject`).send({ reason: 'ngắn' })).status).toBe(400);
    const rejected = await api.post(`${ADMIN}/${row.id}/reject`).send({ reason: 'Khu vực chưa hỗ trợ trong giai đoạn này.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe('REJECTED');
    const [mail] = await outbox('OWNER_REQUEST_REJECTED');
    expect((mail.payload as { reason: string }).reason).toBe('Khu vực chưa hỗ trợ trong giai đoạn này.');
    await submitted();
    expect(await db.select().from(ownerPartnershipRequests)).toHaveLength(2);
  });

  it('lists with status counts, search and pending count; non-Admins are refused', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const player = await createTestUser({ role: 'PLAYER' });
    await submitted({ email: 'a@example.com', facilityName: 'Sân Alpha' });
    const second = await submitted({ email: 'b@example.com', facilityName: 'Sân Beta' });
    const api = asAdmin(admin.id);
    await api.post(`${ADMIN}/${second.id}/contact`);
    const list = await api.get(`${ADMIN}?status=PENDING`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.meta.counts).toEqual({ PENDING: 1, CONTACTED: 1, APPROVED: 0, REJECTED: 0 });
    expect((await api.get(`${ADMIN}?q=beta`)).body.data[0].id).toBe(second.id);
    expect((await api.get(`${ADMIN}/pending-count`)).body.data.count).toBe(1);
    expect((await api.get(`${ADMIN}/999999`)).status).toBe(404);
    expect((await request(app).get(ADMIN).set('x-user-id', String(player.id))).status).toBe(403);
  });
});

describe('Partnership request: helpers', () => {
  it('normalizes Vietnamese mobile numbers', () => {
    expect(normalizeVietnamesePhone('+84 912.345.678')).toBe('0912345678');
    expect(normalizeVietnamesePhone('84912345678')).toBe('0912345678');
    expect(normalizeVietnamesePhone('0212345678')).toBeNull();
  });

  it('renders the account email with the action link, escaped values and no password', () => {
    const email = renderEmail('OWNER_ACCOUNT_CREATED', { contactName: '<b>A</b>', facilityName: 'Sân', accountEmail: 'o@example.com', actionUrl: 'http://localhost:5173/forgot-password?email=o%40example.com' });
    expect(email.html).toContain('&lt;b&gt;A&lt;/b&gt;');
    expect(email.html).toContain('href="http://localhost:5173/forgot-password?email=o%40example.com"');
    expect(email.text).not.toMatch(/mật khẩu (tạm|là)/i);
  });

  it('links the Admin notification to the request for Admins only', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const player = await createTestUser({ role: 'PLAYER' });
    expect(await notificationResourceResolver.resolve({ id: admin.id, role: 'ADMIN' }, 'ADMIN_OWNER_REQUEST', 7)).toBe('/admin/partnership-requests?id=7');
    expect(await notificationResourceResolver.resolve({ id: player.id, role: 'PLAYER' }, 'ADMIN_OWNER_REQUEST', 7)).toBeNull();
  });
});
