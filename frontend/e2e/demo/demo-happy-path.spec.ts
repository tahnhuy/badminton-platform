import { test, expect } from '@playwright/test';
import {
  apiRequest,
  applyToRequest,
  closeRequest,
  conversationMessages,
  createE2EUser,
  createMatchPost,
  createRequestChat,
  decideApplication,
  loginViaUi,
  notificationTypes,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  seedCourt,
  sendChatMessage,
  skillLevels,
  topUpWallet,
  vnIso,
  walletBalance,
} from '../e2e-helpers';

/**
 * One end-to-end demo that walks the main story without repeating the detailed assertions
 * covered by the dedicated specs: owner court → wallet → match → close → chat → split bill
 * → notifications → admin dashboard/finance.
 */
test('demo happy path: court, wallet, matchmaking, chat, split bill, admin', async ({ browser }) => {
  test.setTimeout(240_000);
  await resetDatabase();
  await resetSystemConfigs();

  // Owner already has an approved court (seed fixture); both players fund their wallets.
  const court = await seedCourt();
  const hostCtx = await browser.newContext();
  const memberCtx = await browser.newContext();
  const host = await registerAccount(hostCtx, { email: 'demo_happy_host@example.com', fullName: 'Host Hạnh Phúc' });
  const member = await registerAccount(memberCtx, { email: 'demo_happy_member@example.com', fullName: 'Member Hạnh Phúc' });
  await topUpWallet(hostCtx, 200_000);
  await topUpWallet(memberCtx, 200_000);

  const levels = await skillLevels(hostCtx);
  const levelId = (levels.find((level) => level.rank === 4) ?? levels[0]).id;
  const { requestId } = await createMatchPost(hostCtx, {
    matchType: 'GROUP',
    startAt: vnIso(1, '10:00'),
    minSkillLevelId: levelId,
    maxSkillLevelId: levelId,
    capacity: 3,
    minPlayers: 2,
    body: 'Kèo demo tổng hợp',
  });

  const applicationId = await applyToRequest(memberCtx, requestId);
  await decideApplication(hostCtx, applicationId, 'ACCEPTED');
  const matchId = await closeRequest(hostCtx, requestId);

  // Linked group chat + a real message.
  const conversationId = await createRequestChat(hostCtx, requestId);
  await sendChatMessage(hostCtx, conversationId, 'Chốt kèo nhé, mình đặt sân');
  const messages = await conversationMessages(memberCtx, conversationId);
  expect(messages.some((message) => message.body === 'Chốt kèo nhé, mình đặt sân')).toBe(true);

  // Split bill: both wallets are debited the exact share in one booking.
  const booking = await apiRequest<{ data: { status: string } }>(hostCtx, 'POST', `/matches/${matchId}/booking/create`, {
    courtId: court.courtId,
  });
  expect(booking.data.status).toBe('CONFIRMED');
  expect(await walletBalance(hostCtx)).toBe(200_000 - 60_000);
  expect(await walletBalance(memberCtx)).toBe(200_000 - 60_000);
  expect(await notificationTypes(hostCtx)).toEqual(expect.arrayContaining(['MM_SPLIT_COST_SHARED']));
  expect(await notificationTypes(memberCtx)).toEqual(
    expect.arrayContaining(['MM_SPLIT_COST_SHARED', 'MM_COURT_UPDATED'])
  );
  expect(host.id).toBeTruthy();
  expect(member.id).toBeTruthy();

  // Admin sees the operations in the dashboard and the finance console.
  const admin = await createE2EUser({ email: 'demo_happy_admin@example.com', role: 'ADMIN' });
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  await loginViaUi(adminPage, admin.email, admin.plainPassword);
  await adminPage.goto('/admin/dashboard');
  await expect(adminPage.getByRole('heading', { name: 'Bảng điều khiển', exact: true })).toBeVisible();
  await expect(adminPage.getByTestId('kpi-card').first()).toBeVisible();
  await adminPage.goto('/admin/finance/overview');
  await expect(adminPage.getByRole('heading', { name: 'Quản lý tài chính', exact: true })).toBeVisible();
  await adminPage.getByRole('link', { name: 'Đối soát', exact: true }).click();
  await expect(adminPage).toHaveURL(/\/admin\/finance\/reconciliation/);

  await hostCtx.close();
  await memberCtx.close();
  await adminCtx.close();
});
