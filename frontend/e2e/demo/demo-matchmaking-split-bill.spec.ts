import { test, expect, type BrowserContext } from '@playwright/test';
import {
  apiRequest,
  applyToRequest,
  closeRequest,
  createMatchPost,
  decideApplication,
  notificationTypes,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  seedCourt,
  skillLevels,
  topUpWallet,
  vnIso,
  walletBalance,
  type RegisteredAccount,
} from '../e2e-helpers';

/** Seed court 06:00–17:00 = 80,000/h; the default Singles duration is 90 minutes. */
const WINDOW_TOTAL = 120_000;
const SHARE = 60_000;

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

test.describe('Demo: matchmaking split bill', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('every member is debited the exact share in one booking and the match is confirmed', async ({ browser }) => {
    test.setTimeout(180_000);
    await seedCourt();
    const host = await newPlayer(browser, 'demo_split_host@example.com', 'Chủ Kèo Chia Tiền');
    const member = await newPlayer(browser, 'demo_split_member@example.com', 'Thành Viên Chia Tiền');
    await topUpWallet(host.context, 100_000);
    await topUpWallet(member.context, 100_000);

    const { matchId } = await closedSingles(host.context, member.context, member.account, vnIso(1, '10:00'));

    await host.page.goto(`/matchmaking/matches/${matchId}`);
    await host.page.getByRole('link', { name: 'Tiến hành đặt sân' }).click();
    await expect(host.page.getByRole('heading', { name: `Đặt sân cho trận #${matchId}`, exact: true })).toBeVisible();
    await expect(host.page.getByText('Sân E2E', { exact: false }).first()).toBeVisible();
    await host.page.getByRole('button', { name: 'Chọn sân này' }).first().click();

    const dialog = host.page.getByRole('dialog');
    await expect(dialog.getByText('ĐẶT SÂN & CHIA TIỀN', { exact: true })).toBeVisible();
    await expect(dialog).toContainText('120.000');
    await expect(dialog).toContainText('60.000');
    await expect(dialog).toContainText('Chia đều cho 2 thành viên');
    expect(await dialog.getByText('Đủ số dư').count()).toBeGreaterThanOrEqual(2);
    await expect(dialog.getByText(/^Thiếu /)).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Xác nhận đặt sân', exact: true }).click();

    await expect(host.page).toHaveURL(new RegExp(`/matchmaking/matches/${matchId}$`));
    await expect(host.page.getByText('Đã xác nhận', { exact: true }).first()).toBeVisible();

    const detail = await apiRequest<{ data: { status: string; booking?: { id: number } | null } }>(
      host.context,
      'GET',
      `/matches/${matchId}`
    );
    expect(detail.data.status).toBe('CONFIRMED');
    expect(detail.data.booking?.id).toBeTruthy();

    // Exact debit per member (one wallet ledger entry each).
    expect(await walletBalance(host.context)).toBe(100_000 - SHARE);
    expect(await walletBalance(member.context)).toBe(100_000 - SHARE);
    const hostEntries = await apiRequest<{ data: Array<{ amount: string; referenceId: number | null }> }>(
      host.context,
      'GET',
      '/wallet/entries?limit=50'
    );
    const hostDebits = hostEntries.data.filter((entry) => Number(entry.amount) === -SHARE);
    expect(hostDebits).toHaveLength(1);

    // Notifications: both contributors see the split, the member also sees the court update.
    expect(await notificationTypes(host.context)).toEqual(expect.arrayContaining(['MM_SPLIT_COST_SHARED']));
    expect(await notificationTypes(member.context)).toEqual(
      expect.arrayContaining(['MM_SPLIT_COST_SHARED', 'MM_COURT_UPDATED'])
    );

    expect(WINDOW_TOTAL).toBe(SHARE * 2);
    await host.context.close();
    await member.context.close();
  });

  test('insufficient wallet blocks the booking, lists the shortfall and charges nobody', async ({ browser }) => {
    test.setTimeout(180_000);
    await seedCourt();
    const host = await newPlayer(browser, 'demo_split_short_host@example.com', 'Chủ Kèo Thiếu Ví');
    const member = await newPlayer(browser, 'demo_split_short_member@example.com', 'Thành Viên Thiếu Ví');
    await topUpWallet(host.context, 100_000);

    const { matchId } = await closedSingles(host.context, member.context, member.account, vnIso(1, '10:00'));

    await host.page.goto(`/matchmaking/matches/${matchId}`);
    await host.page.getByRole('link', { name: 'Tiến hành đặt sân' }).click();
    await host.page.getByRole('button', { name: 'Chọn sân này' }).first().click();

    const dialog = host.page.getByRole('dialog');
    await expect(dialog.getByText('Chưa thể đặt sân — 1 thành viên chưa đủ số dư ví')).toBeVisible();
    await expect(dialog.getByText(/cần nạp thêm 60\.000/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Xác nhận đặt sân', exact: true })).toBeDisabled();

    await dialog.getByRole('button', { name: 'Nhắc nạp ví', exact: true }).first().click();
    await expect(host.page.getByText('Đã gửi nhắc nạp ví cho 1 thành viên.', { exact: false })).toBeVisible();
    expect(await notificationTypes(member.context)).toEqual(expect.arrayContaining(['MM_SPLIT_TOPUP_REQUIRED']));

    const detail = await apiRequest<{ data: { status: string; booking?: { id: number } | null } }>(
      host.context,
      'GET',
      `/matches/${matchId}`
    );
    expect(detail.data.status).toBe('PENDING_COURT');
    expect(detail.data.booking?.id ?? null).toBeNull();

    expect(await walletBalance(host.context)).toBe(100_000);
    expect(await walletBalance(member.context)).toBe(0);
    expect(WINDOW_TOTAL).toBe(SHARE * 2);
    await host.context.close();
    await member.context.close();
  });
});

