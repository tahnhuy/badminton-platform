import { test, expect, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createE2EUser, resetDatabase, seedCourt } from './e2e-helpers';

const BASE = 'http://localhost:5173/api/v1';
const bookingDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 2 * 86400000));
const startAt = new Date(`${bookingDate}T18:00:00+07:00`);

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function api(page: Page, method: 'get' | 'post' | 'put', path: string, body?: unknown) {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((cookie) => cookie.name === 'csrf_token')?.value ?? '';
  const response = await page.context().request[method](`${BASE}${path}`, {
    ...(body === undefined ? {} : { data: body }),
    headers: { 'X-CSRF-Token': csrf },
  });
  if (!response.ok()) throw new Error(`${method.toUpperCase()} ${path} failed: ${response.status()} ${await response.text()}`);
  return response.json();
}

async function topUp(page: Page, amount = 500000) {
  const topUp = await api(page, 'post', '/wallet/top-ups', { amount: String(amount), provider: 'MOCK' });
  await api(page, 'post', `/wallet/top-ups/${topUp.data.topUpId}/mock-confirm`);
}

async function createPaidBooking(page: Page, courtId: number, startTime = '18:00', durationMinutes = 90) {
  const created = await api(page, 'post', '/bookings', { courtId, bookingDate, startTime, durationMinutes });
  await api(page, 'post', `/bookings/${created.data.id}/payment`, { provider: 'WALLET' });
  return created.data as { id: number; bookingCode: string };
}

async function createClosedMatch(page: Page, memberId: number) {
  const levels = await api(page, 'get', '/skill-levels');
  const skill = levels.data[levels.data.length - 1];
  const post = await api(page, 'post', '/posts', {
    type: 'MATCH_FINDING',
    body: 'Kèo E2E thật',
    clientRequestId: randomUUID(),
    recruitment: {
      matchType: 'SINGLES',
      startAt: startAt.toISOString(),
      capacity: 2,
      minPlayers: 2,
      minSkillLevelId: skill.id,
      maxSkillLevelId: skill.id,
    },
  });
  const requestId = post.data.recruitment.requestId as number;
  await api(page, 'post', `/matchmaking-requests/${requestId}/publish`);
  if (memberId) {
    const invitation = await api(page, 'post', `/matchmaking-requests/${requestId}/invitations`, { inviteeId: memberId });
    return { requestId, invitationId: invitation.data.id as number };
  }
  return { requestId, invitationId: null };
}

async function acceptInvitation(page: Page, invitationId: number) {
  return api(page, 'put', `/matchmaking-invitations/${invitationId}`, { decision: 'ACCEPTED' });
}

async function runJobs(page: Page) {
  return api(page, 'post', '/test/run-jobs');
}

test.describe('BK-14 + MM-17 real E2E (backend + DB, no money API interception)', () => {
  test('booking → wallet payment → match link → CONFIRMED, with replay and permission checks', async ({ browser, page }) => {
    test.setTimeout(180000);
    await resetDatabase();
    const host = await createE2EUser({ email: 'e2e_host@example.com', role: 'PLAYER' });
    const member = await createE2EUser({ email: 'e2e_member@example.com', role: 'PLAYER' });
    const court = await seedCourt();
    await login(page, host.email, host.plainPassword);
    await topUp(page);
    const booking = await createPaidBooking(page, court.courtId);

    const replay = await api(page, 'post', `/bookings/${booking.id}/payment`, { provider: 'WALLET' });
    expect(replay.data.paymentId).toBeTruthy();

    const { requestId, invitationId } = await createClosedMatch(page, member.id);
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await login(memberPage, member.email, member.plainPassword);
    await acceptInvitation(memberPage, invitationId!);
    const closed = await api(page, 'post', `/matchmaking-requests/${requestId}/close`);
    const matchId = closed.data.matchId as number;
    expect(matchId).toBeTruthy();

    // Member cannot link the host's booking.
    const forbidden = await memberPage.context().request.post(`${BASE}/matches/${matchId}/booking`, {
      data: { bookingId: booking.id },
      headers: { 'X-CSRF-Token': (await memberPage.context().cookies()).find((cookie) => cookie.name === 'csrf_token')?.value ?? '' },
    });
    expect(forbidden.status()).toBe(404);

    await page.goto(`/matchmaking/matches/${matchId}`);
    await expect(page.getByText('Chọn booking đã thanh toán')).toBeVisible();
    await page.getByRole('button', { name: 'Liên kết' }).first().click();
    await expect(page.getByText('Đã có sân', { exact: false })).toBeVisible();

    const detail = await api(page, 'get', `/matches/${matchId}`);
    expect(detail.data.status).toBe('CONFIRMED');
    expect(detail.data.booking.id).toBe(booking.id);
    await memberContext.close();
  });

  test('player cancel → refund → notification; owner cancel; match cancel → job reconcile', async ({ browser, page }) => {
    test.setTimeout(180000);
    await resetDatabase();
    const host = await createE2EUser({ email: 'e2e_host2@example.com', role: 'PLAYER' });
    const member = await createE2EUser({ email: 'e2e_member2@example.com', role: 'PLAYER' });
    const court = await seedCourt();
    await login(page, host.email, host.plainPassword);
    await topUp(page);

    // Player cancellation → durable refund → notification.
    const first = await createPaidBooking(page, court.courtId);
    await page.goto(`/bookings/${first.id}`);
    await page.getByRole('button', { name: 'Yêu cầu hủy đặt sân' }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy' }).click();
    await expect(page.getByText('Đơn đã được hủy')).toBeVisible();
    await runJobs(page);
    const afterRefund = await api(page, 'get', `/bookings/${first.id}`);
    expect(afterRefund.data.refundStatus).toBe('REFUNDED');
    const notifications = await api(page, 'get', '/notifications?limit=50');
    const types = notifications.data.map((row: { type: string }) => row.type);
    expect(types).toContain('BOOKING_CANCELLED');
    expect(types).toContain('BOOKING_REFUNDED');

    // Owner cancellation of a separate paid booking → refund + notification.
    const second = await createPaidBooking(page, court.courtId, '19:00', 60);
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();
    await login(ownerPage, court.ownerEmail, court.ownerPassword);
    await ownerPage.goto(`/owner/schedule?facilityId=${court.facilityId}`);
    await ownerPage.getByLabel('Ngày xem lịch').fill(bookingDate);
    await ownerPage.getByRole('button', { name: second.bookingCode, exact: true }).click();
    const ownerDialog = ownerPage.getByRole('dialog');
    await ownerDialog.getByLabel('Lý do hủy (bắt buộc)').fill('Sự cố điện tại sân');
    await ownerDialog.getByRole('button', { name: 'Xác nhận hủy booking' }).click();
    await expect(ownerDialog.getByRole('status')).toContainText('Hoàn tiền đang chờ xử lý');
    await runJobs(page);
    const ownerCancelled = await api(page, 'get', `/bookings/${second.id}`);
    expect(ownerCancelled.data.status).toBe('CANCELLED');
    expect(ownerCancelled.data.refundStatus).toBe('REFUNDED');

    // Match cancellation → cancellation job → booking cancellation + refund.
    const third = await createPaidBooking(page, court.courtId, '18:00', 90);
    const { requestId, invitationId } = await createClosedMatch(page, member.id);
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await login(memberPage, member.email, member.plainPassword);
    await acceptInvitation(memberPage, invitationId!);
    const closed = await api(page, 'post', `/matchmaking-requests/${requestId}/close`);
    const matchId = closed.data.matchId as number;
    await api(page, 'post', `/matches/${matchId}/booking`, { bookingId: third.id });
    await api(page, 'post', `/matchmaking-requests/${requestId}/cancel`, { bookingAction: 'CANCEL' });
    const replay = await api(page, 'post', `/matchmaking-requests/${requestId}/cancel`, { bookingAction: 'CANCEL' });
    expect(replay.data.status).toBe('CANCELLED');
    await runJobs(page);
    const matchCancelled = await api(page, 'get', `/bookings/${third.id}`);
    expect(matchCancelled.data.status).toBe('CANCELLED');
    expect(matchCancelled.data.refundStatus).toBe('REFUNDED');
    await memberContext.close();
    await ownerContext.close();
  });
});
