import { test, expect } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
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
  await mockAuthApi(page, { user: { ...account(), id: 2 } });
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
      await page.setViewportSize({ width: 360, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
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
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  release!();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Một thành viên đã rời trận.')).toBeVisible();
  expect(calls).toBe(1);
});

test('booking flow retains match navigation context through search, slot, hold and detail', async ({ page }) => {
  const court = { id: 5, name: 'Sân 03', description: null, available: true, priceFrom: 140000, facility: { ...facility, openingTime: '06:00', closingTime: '22:00' } };
  const booking = { id: 20, bookingCode: 'BK20', status: 'PENDING_PAYMENT', bookingDate: '2030-01-01', startTime: '10:00', endTime: '11:00', durationMinutes: 60, totalAmount: 140000, refundStatus: 'NONE', expiresAt: '2030-01-01T03:00:00Z', court, facility, pricingDetails: [], payment: null };
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, status: 'PENDING_COURT', booking: null, court: null, facility: null } } }));
  await page.route('**/api/v1/facilities?*', route => route.fulfill({ json: { data: [{ facility: { ...facility, openingTime: '06:00', closingTime: '22:00' }, courts: [court], priceFrom: 140000 }], meta: { page: 1, totalPages: 1, total: 1, limit: 10 } } }));
  await page.route('**/api/v1/courts/5/availability?*', route => route.fulfill({ json: { data: { date: '2030-01-01', durationMinutes: 60, court, facility, openingTime: '06:00', closingTime: '22:00', intervals: [{ startTime: '10:00', endTime: '12:00', durationMinutes: 120, segments: [{ startTime: '10:00', endTime: '12:00', price: 140000 }], estimatedPrice: 140000 }] } } }));
  await page.route('**/api/v1/bookings', route => {
    expect(route.request().postDataJSON()).toEqual({ courtId: 5, bookingDate: '2030-01-01', startTime: '10:00', durationMinutes: 60 });
    return route.fulfill({ status: 201, json: { data: booking } });
  });
  await page.route('**/api/v1/bookings/20', route => route.fulfill({ json: { data: booking } }));
  await page.route('**/api/v1/bookings/20/cancel', route => {
    booking.status = 'CANCELLED';
    return route.fulfill({ json: { data: booking } });
  });
  await page.goto('/matchmaking/matches/7');
  await page.getByRole('link', { name: 'Tìm sân cho nhóm' }).click();
  await expect(page).toHaveURL(/\/courts\?matchId=7$/);
  await expect(page.getByRole('complementary', { name: 'Ngữ cảnh đặt sân cho trận' })).toContainText('Đặt sân cho trận #7');
  await page.getByRole('link', { name: /^Sân 03/ }).click();
  await expect(page).toHaveURL(/matchId=7/);
  // A chosen date survives navigation and the URL survives reload.
  await page.goto('/courts/5?date=2030-01-01&matchId=7');
  await page.reload();
  await page.getByRole('button', { name: /10:00.*12:00/ }).click();
  await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).click();
  await expect(page).toHaveURL(/\/bookings\/new\?.*matchId=7/);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();
  await expect(page).toHaveURL(/\/bookings\/20\/pending\?matchId=7$/);
  await page.getByRole('button', { name: 'Hủy đơn đặt sân' }).click();
  await page.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
  await expect(page).toHaveURL(/\/bookings\/20\?matchId=7$/);
  await page.getByRole('link', { name: '← Quay lại trận #7' }).click();
  await expect(page).toHaveURL(/\/matchmaking\/matches\/7$/);
});

for (const width of [390, 1280]) test(`GROUP roster includes all returned players without teams at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const players = match.players.slice(0, 3).map((player, index) => ({ ...player, teamNo: null, status: index === 2 ? 'LEFT' : 'ACTIVE' }));
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, matchType: 'GROUP', players, currentPlayers: 2 } } }));
  await page.goto('/matchmaking/matches/7');
  await expect(page.getByRole('heading', { name: 'Người chơi trong nhóm' })).toBeVisible();
  const profiles = page.getByRole('button', { name: /^Xem hồ sơ / });
  await expect(profiles).toHaveCount(3);
  expect(await profiles.allTextContents()).toEqual(players.map(player => player.displayName));
  await expect(page.getByText('Đã rời', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Đội [AB]$/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

for (const scenario of [
  { matchType: 'GROUP' as const, isOwner: false, summary: 'Bạn sẽ rời nhóm. Trận giao lưu vẫn được giữ.', detail: 'Booking đã liên kết không bị hủy bởi thao tác này.' },
  { matchType: 'GROUP' as const, isOwner: true, summary: 'Bạn là chủ kèo. Rời trận sẽ hủy kèo cho cả nhóm.', detail: 'Booking đã liên kết vẫn được giữ' },
  { matchType: 'DOUBLES' as const, isOwner: true, summary: 'Bạn là chủ kèo. Rời trận sẽ hủy kèo cho cả nhóm.', detail: 'Booking đã liên kết vẫn được giữ' },
  { matchType: 'SINGLES' as const, isOwner: false, summary: 'Rời trận sẽ hủy kèo cho cả nhóm.', detail: 'Booking đã liên kết sẽ được yêu cầu hủy theo chính sách' },
]) test(`leave copy follows ${scenario.matchType} ${scenario.isOwner ? 'host' : 'member'} without submitting`, async ({ page }) => {
  let mutations = 0;
  await page.route('**/api/v1/matches/7', route => route.fulfill({ json: { data: { ...match, ...scenario } } }));
  await page.route('**/api/v1/matches/7/leave', route => { mutations++; return route.fulfill({ json: { data: {} } }); });
  await page.goto('/matchmaking/matches/7');
  await expect(page.getByText(scenario.summary, { exact: true })).toBeVisible();
  const opener = page.getByRole('button', { name: 'Rời trận', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(scenario.summary); await expect(dialog).toContainText(scenario.detail);
  await page.keyboard.press('Escape'); await expect(opener).toBeFocused(); expect(mutations).toBe(0);
});

test('my matches retains server page order and pagination and opens rating entry', async ({ page }) => {
  const pages: number[] = [];
  await page.route('**/api/v1/matches?*', route => {
    const pageNo = Number(new URL(route.request().url()).searchParams.get('page')); pages.push(pageNo);
    return route.fulfill({ json: { data: [{ ...match, id: pageNo === 1 ? 7 : 8, status: 'COMPLETED' }], meta: { page: pageNo, limit: 10, total: 11, totalPages: 2 } } });
  });
  await page.route('**/api/v1/matches/*/ratings/pending', route => route.fulfill({ json: { data: { matchId: 7, pendingPlayers: [], ratedPlayers: [] } } }));
  await page.goto('/matchmaking/matches');
  await expect(page.getByRole('link', { name: /Đôi · Trận #7/ })).toHaveAttribute('href', '/matchmaking/matches/7');
  const nav = page.getByRole('navigation', { name: 'Trang trận đấu' });
  await expect(nav.getByRole('button', { name: 'Trước' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Sau' }).click();
  await expect(page.getByRole('link', { name: /Đôi · Trận #8/ })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Sau' })).toBeDisabled();
  await nav.getByRole('button', { name: 'Trước' }).click();
  await page.getByRole('button', { name: 'Xem đánh giá đã gửi' }).click();
  await expect(page.getByRole('dialog')).toBeVisible(); expect(pages.filter((page, index) => index === 0 || page !== pages[index - 1])).toEqual([1, 2, 1]);
});

test('my matches renders loading, error and empty from the existing request flow', async ({ page }) => {
  let mode = 'error'; let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/matches?*', async route => {
    await wait;
    return mode === 'error' ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Không thể tải' } } }) : route.fulfill({ json: { data: [], meta: { page: 1, totalPages: 0, total: 0, limit: 10 } } });
  });
  await page.goto('/matchmaking/matches'); await expect(page.getByText('Đang tải...', { exact: true })).toBeVisible(); await expect(page.getByText('Chưa có trận nào.')).toHaveCount(0);
  release(); await expect(page.getByRole('heading', { name: 'Không tải được trận' })).toBeVisible();
  mode = 'empty'; await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByText('Chưa có trận nào.')).toBeVisible();
});
