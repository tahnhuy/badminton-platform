import { test, expect, type BrowserContext } from '@playwright/test';
import {
  apiRaw,
  apiRequest,
  applyToRequest,
  closeRequest,
  conversationMessages,
  createMatchPost,
  createRequestChat,
  decideApplication,
  notificationTypes,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  runJobs,
  seedCourt,
  sendChatMessage,
  skillLevels,
  topUpWallet,
  vnIso,
  type RegisteredAccount,
} from '../e2e-helpers';

async function newPlayer(browser: import('@playwright/test').Browser, email: string, fullName: string) {
  const context = await browser.newContext();
  const account = await registerAccount(context, { email, fullName });
  const page = await context.newPage();
  return { context, page, account };
}

async function closedSingles(
  hostContext: BrowserContext,
  memberContext: BrowserContext,
  member: RegisteredAccount,
  startAt: string
): Promise<{ requestId: number; matchId: number }> {
  const levels = await skillLevels(hostContext);
  const levelId = (levels.find((level) => level.rank === 4) ?? levels[0]).id;
  const { requestId } = await createMatchPost(hostContext, {
    matchType: 'SINGLES',
    startAt,
    minSkillLevelId: levelId,
    maxSkillLevelId: levelId,
  });
  const applicationId = await applyToRequest(memberContext, requestId);
  await decideApplication(hostContext, applicationId, 'ACCEPTED');
  const matchId = await closeRequest(hostContext, requestId);
  return { requestId, matchId };
}

test.describe('Demo: matchmaking withdraw / payment lock / expiry', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('withdrawing before payment kicks the player from the linked chat and keeps old messages', async ({ browser }) => {
    const host = await newPlayer(browser, 'demo_withdraw_host@example.com', 'Chủ Kèo Rút');
    const member = await newPlayer(browser, 'demo_withdraw_member@example.com', 'Người Rút Kèo');
    const { requestId, matchId } = await closedSingles(host.context, member.context, member.account, vnIso(2, '10:00'));

    const conversationId = await createRequestChat(host.context, requestId);
    await sendChatMessage(host.context, conversationId, 'Tin cũ trước khi rút');
    const beforeWithdraw = await conversationMessages(member.context, conversationId);
    expect(beforeWithdraw.some((message) => message.body === 'Tin cũ trước khi rút')).toBe(true);

    // Member withdraws through the request-management UI (payment has not happened yet).
    await member.page.goto(`/matchmaking/requests/${requestId}`);
    await member.page.getByRole('button', { name: 'Rút khỏi kèo', exact: true }).click();
    await member.page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click();

    await expect
      .poll(async () => {
        const detail = await apiRequest<{ data: { status: string } }>(
          host.context,
          'GET',
          `/matchmaking-requests/${requestId}`
        );
        return detail.data.status;
      })
      .toBe('CANCELLED');

    // Revoked membership: the departed player loses access, the host keeps the history.
    const revoked = await apiRaw(member.context, 'GET', `/conversations/${conversationId}`);
    expect(revoked.status()).toBe(404);
    const afterWithdraw = await conversationMessages(host.context, conversationId);
    expect(afterWithdraw.some((message) => message.body === 'Tin cũ trước khi rút')).toBe(true);

    const match = await apiRequest<{ data: { status: string; cancellationReason: string | null } }>(
      host.context,
      'GET',
      `/matches/${matchId}`
    );
    expect(match.data.status).toBe('CANCELLED');
    expect(match.data.cancellationReason).toBe('INSUFFICIENT_PLAYERS');

    await host.context.close();
    await member.context.close();
  });

  test('after the court is paid, withdraw / remove / leave are locked', async ({ browser }) => {
    test.setTimeout(180_000);
    const court = await seedCourt();
    const host = await newPlayer(browser, 'demo_lock_host@example.com', 'Chủ Kèo Khóa');
    const member = await newPlayer(browser, 'demo_lock_member@example.com', 'Người Bị Khóa');
    await topUpWallet(host.context, 100_000);
    await topUpWallet(member.context, 100_000);

    const { requestId, matchId } = await closedSingles(host.context, member.context, member.account, vnIso(1, '10:00'));
    const booking = await apiRequest<{ data: { status: string } }>(host.context, 'POST', `/matches/${matchId}/booking/create`, {
      courtId: court.courtId,
    });
    expect(booking.data.status).toBe('CONFIRMED');

    const withdraw = await apiRaw(member.context, 'POST', `/matchmaking-requests/${requestId}/withdraw`);
    expect(withdraw.status()).toBe(409);
    expect((await withdraw.json()).error.code).toBe('MATCHMAKING_INVITATION_NOT_WITHDRAWABLE');

    const leave = await apiRaw(member.context, 'POST', `/matches/${matchId}/leave`);
    expect(leave.status()).toBe(409);

    const remove = await apiRaw(host.context, 'DELETE', `/matchmaking-requests/${requestId}/members/${member.account.id}`);
    expect(remove.status()).toBe(409);

    // The UI no longer offers the withdraw action after the roster is matched and paid.
    await member.page.goto(`/matchmaking/requests/${requestId}`);
    await expect(member.page.getByRole('button', { name: 'Rút khỏi kèo', exact: true })).toHaveCount(0);

    const match = await apiRequest<{ data: { status: string; booking?: { id: number } | null } }>(
      host.context,
      'GET',
      `/matches/${matchId}`
    );
    expect(match.data.status).toBe('CONFIRMED');
    expect(match.data.booking?.id).toBeTruthy();

    await host.context.close();
    await member.context.close();
  });

  test('a closed match with no court is cancelled by the start-time worker', async ({ browser }) => {
    const host = await newPlayer(browser, 'demo_expire_host@example.com', 'Chủ Kèo Hết Hạn');
    const member = await newPlayer(browser, 'demo_expire_member@example.com', 'Người Hết Hạn');
    const { requestId, matchId } = await closedSingles(host.context, member.context, member.account, vnIso(2, '10:00'));

    // Test-only fixture moves the recruitment (and Match) into the past, then the real worker runs.
    await apiRequest(host.context, 'POST', '/test/expire-recruitment', { requestId });
    await runJobs(host.context);

    const request = await apiRequest<{ data: { status: string } }>(
      host.context,
      'GET',
      `/matchmaking-requests/${requestId}`
    );
    expect(request.data.status).toBe('CANCELLED');

    const match = await apiRequest<{ data: { status: string; cancellationReason: string | null } }>(
      host.context,
      'GET',
      `/matches/${matchId}`
    );
    expect(match.data.status).toBe('CANCELLED');
    expect(match.data.cancellationReason).toBe('COURT_NOT_BOOKED');
    expect(await notificationTypes(member.context)).toEqual(expect.arrayContaining(['MM_POST_CANCELLED']));

    await host.context.close();
    await member.context.close();
  });
});
