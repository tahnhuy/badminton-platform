import { test, expect } from '@playwright/test';
import type { MatchDetail } from '../src/features/matchmaking/types/matchmaking';

const facility = { id: 1, name: 'CLB Phúc Thịnh', address: '18 Huỳnh Tấn Phát', ward: 'Tân Thuận', district: 'Quận 7', city: 'TP.HCM', phone: '0900000000' };
const match: MatchDetail = {
  id: 7, matchType: 'DOUBLES', status: 'CONFIRMED', scheduledAt: '2030-01-01T03:00:00Z', scheduledEndAt: '2030-01-01T05:00:00Z', bookingDeadlineAt: null,
  court: { id: 5, name: 'Sân 03' }, facility, price: 280000, payer: { playerId: 2 }, booking: { id: 20, status: 'CONFIRMED' },
  players: [
    { playerId: 2, displayName: 'Nguyễn Văn Nam', teamNo: 1, skill: { id: 3, name: 'Trung bình', code: 'AVERAGE', rank: 3 }, status: 'ACTIVE' },
    { playerId: 3, displayName: 'Lê Hoàng Quân', teamNo: 1, skill: null, status: 'ACTIVE' },
    { playerId: 4, displayName: 'Trần Minh Đức', teamNo: 2, skill: null, status: 'ACTIVE' },
    { playerId: 5, displayName: 'Vũ Hoàng Long', teamNo: 2, skill: null, status: 'ACTIVE' },
  ], currentPlayers: 4, requiredPlayers: 4, isOwner: true, cancellationReason: null,
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: 2, email: 'player@test.test', role: 'PLAYER', requiresPasswordChange: false } } }));
});

for (const status of ['PENDING_COURT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const) {
  test(`detail presents ${status} with appropriate actions`, async ({ page }) => {
    const pending = status === 'PENDING_COURT';
    await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, status,
      ...(pending ? { facility: null, court: null, price: null, payer: null, booking: null, scheduledEndAt: null, bookingDeadlineAt: match.scheduledAt } : {}),
      cancellationReason: status === 'CANCELLED' ? 'INSUFFICIENT_PLAYERS' : null,
    } } }));
    await page.route('**/api/v1/matches/7/ratings/pending', route => route.fulfill({ json: { data: { matchId: 7, matchType: 'DOUBLES', pendingPlayers: [{ playerId: 3, fullName: 'Lê Hoàng Quân' }], ratedPlayers: [] } } }));
    await page.goto('/matchmaking/matches/7');
    await expect(page.getByRole('heading', { name: 'Chi tiết trận đấu đôi' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Đội A', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Đội B', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rời trận', exact: true })).toHaveCount(['PENDING_COURT', 'CONFIRMED'].includes(status) ? 1 : 0);
    await expect(page.getByText('Chọn booking đã thanh toán')).toHaveCount(pending ? 1 : 0);
    await expect(page.getByRole('button', { name: 'Đánh giá người chơi', exact: true })).toHaveCount(status === 'COMPLETED' ? 1 : 0);
    if (pending) await expect(page.getByText('Hạn đặt sân', { exact: true })).toBeVisible();
    if (status === 'CANCELLED') await expect(page.getByText('Một thành viên đã rời trận.')).toBeVisible();
    if (status === 'CONFIRMED') {
      await expect(page.getByText('280.000 ₫', { exact: true })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Xem booking sân' })).toHaveAttribute('href', '/bookings/20');
      await page.screenshot({ path: '/tmp/match-detail-desktop.png', fullPage: true });
      await page.setViewportSize({ width: 360, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
      await page.screenshot({ path: '/tmp/match-detail-mobile.png', fullPage: true });
    }
    await expect(page.getByText(/ELO|SmashPay|Khả năng thắng/)).toHaveCount(0);
  });
}

test('member cannot see owner booking actions and zero price remains visible', async ({ page }) => {
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, isOwner: false, booking: null, price: 0, payer: { playerId: 999 }, matchType: 'SINGLES', players: [match.players[0], match.players[2]], requiredPlayers: 2, currentPlayers: 2 } } }));
  await page.goto('/matchmaking/matches/7');
  await expect(page.getByRole('heading', { name: 'Chi tiết trận đấu đơn' })).toBeVisible();
  await expect(page.getByText('0 ₫', { exact: true })).toBeVisible();
  await expect(page.getByText('Người thanh toán: Chưa có tên người thanh toán')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem booking sân' })).toHaveCount(0);
  await expect(page.getByText('Chọn booking đã thanh toán')).toHaveCount(0);
});

test('leave modal preserves error after match starts concurrently and refreshes state', async ({ page }) => {
  let started = false;
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, status: started ? 'IN_PROGRESS' : 'CONFIRMED' } } }));
  await page.route('**/api/v1/matches/7/leave', route => {
    started = true;
    return route.fulfill({ status: 409, json: { error: { code: 'MATCH_ALREADY_STARTED', message: 'conflict' } } });
  });
  await page.goto('/matchmaking/matches/7');
  const opener = page.getByRole('button', { name: 'Rời trận', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await page.keyboard.press('Escape');
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('button', { name: 'Xác nhận rời trận' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Trận đấu đã bắt đầu');
  await expect(dialog.getByRole('button', { name: 'Xác nhận rời trận' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Ở lại' }).click();
  await expect(page.getByText('Đang diễn ra', { exact: true })).toBeVisible();
  await expect(opener).toHaveCount(0);
});

test('polling failure keeps last information but blocks stale leave action', async ({ page }) => {
  let failed = false;
  await page.route('**/api/v1/matches/7', route => failed
    ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } } })
    : route.fulfill({ json: { data: match } }));
  await page.goto('/matchmaking/matches/7');
  await expect(page.getByRole('heading', { name: 'Chi tiết trận đấu đôi' })).toBeVisible();
  failed = true;
  await expect(page.getByRole('alert')).toContainText('Chưa cập nhật được trạng thái mới nhất', { timeout: 10000 });
  await expect(page.getByText('280.000 ₫', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rời trận', exact: true })).toBeDisabled();
  failed = false;
  await page.getByRole('button', { name: 'Tải lại trạng thái' }).click();
  await expect(page.getByRole('button', { name: 'Rời trận', exact: true })).toBeEnabled();
});

test('missing or unauthorized match has retry and invalid ID never requests a match', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/matches/*', route => { calls++; return route.fulfill({ status: 404, json: { error: { code: 'MATCH_NOT_FOUND', message: 'Không tìm thấy trận đấu' } } }); });
  await page.goto('/matchmaking/matches/7');
  await expect(page.getByRole('heading', { name: 'Không thể xem trận' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  calls = 0;
  await page.goto('/matchmaking/matches/invalid');
  await expect(page.getByText('Mã trận không hợp lệ.')).toBeVisible();
  expect(calls).toBe(0);
});

test('leave command cannot be submitted twice or dismissed while pending', async ({ page }) => {
  let calls = 0;
  let done = false;
  let release: (() => void) | undefined;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, status: done ? 'CANCELLED' : 'CONFIRMED', cancellationReason: done ? 'INSUFFICIENT_PLAYERS' : null } } }));
  await page.route('**/api/v1/matches/7/leave', async route => {
    calls++; await waiting; done = true;
    await route.fulfill({ json: { data: { status: 'CANCELLED' } } });
  });
  await page.goto('/matchmaking/matches/7');
  await page.getByRole('button', { name: 'Rời trận', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Xác nhận rời trận' }).click();
  await expect.poll(() => calls).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Đang xử lý...' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await page.locator('.match-dialog-backdrop').click({ position: { x: 1, y: 1 } });
  await expect(dialog).toBeVisible();
  release!();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Một thành viên đã rời trận.')).toBeVisible();
  expect(calls).toBe(1);
});
