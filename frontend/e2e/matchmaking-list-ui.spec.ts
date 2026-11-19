import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const base = { matchType: 'DOUBLES', status: 'OPEN', preferredDate: '2099-11-03', preferredStartTime: '18:00:00', preferredEndTime: '20:00:00', expiresAt: '2099-11-03T10:00:00.000Z', createdAt: '2026-11-01T01:00:00.000Z', area: 'Quận 7, Hồ Chí Minh', matchDurationMinutes: 90, requiredPlayers: 4, acceptedCount: 1, remainingCount: 2, matchId: null, isOwner: true };
const row = (id: number, extra: Record<string, unknown> = {}) => ({ ...base, id, ...extra });

async function openList(page: Page, handler?: (route: Route, query: URLSearchParams) => unknown, extra: Record<string, (route: Route) => unknown> = {}) {
  const reads: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/matchmaking-requests': route => {
      const query = new URL(route.request().url()).searchParams; reads.push(query);
      if (handler) return handler(route, query);
      return route.fulfill({ json: { data: [row(Number(query.get('page')) * 10), row(Number(query.get('page')) * 10 + 1, { status: 'MATCHED', matchId: 7, isOwner: false })], meta: { page: Number(query.get('page')), limit: 10, total: 25, totalPages: 3 } } });
    },
    ...extra,
  } });
  await page.goto('/matchmaking'); return reads;
}

for (const width of [390, 1280]) test(`list ${width}: cards keep their actions and fit without overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await openList(page);
  const open = page.getByRole('article', { name: 'Kèo Đôi #10' });
  await expect(open).toContainText('Đang tìm người'); await expect(open).toContainText('Quận 7, Hồ Chí Minh'); await expect(open).toContainText('2/4 người'); await expect(open).toContainText('Còn thiếu 2 người để tạo trận.');
  await expect(open.getByRole('link', { name: 'Xem kèo' })).toHaveAttribute('href', '/matchmaking/requests/10');
  await expect(open.getByRole('button', { name: 'Hủy yêu cầu' })).toBeVisible();
  const matched = page.getByRole('article', { name: 'Kèo Đôi #11' });
  await expect(matched.getByRole('link', { name: 'Xem trận #7' })).toHaveAttribute('href', '/matchmaking/matches/7'); await expect(matched.getByRole('button', { name: 'Tìm người' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Các trận của tôi' })).toHaveAttribute('href', '/matchmaking/matches');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await open.getByRole('button', { name: 'Tìm người' }).click(); await expect(page).toHaveURL('/matchmaking/requests/10');
});

test('pagination keeps page size and bounds', async ({ page }) => {
  const reads = await openList(page); await expect(page.getByText('Trang 1 / 3')).toBeVisible();
  expect(reads.at(-1)?.get('limit')).toBe('10');
  await page.getByRole('button', { name: 'Sau' }).click(); await expect(page.getByText('Trang 2 / 3')).toBeVisible(); await expect.poll(() => reads.at(-1)?.get('page')).toBe('2');
  await page.getByRole('button', { name: 'Sau' }).click(); await expect(page.getByText('Trang 3 / 3')).toBeVisible(); await expect(page.getByRole('button', { name: 'Sau' })).toBeDisabled();
});

test('tabs keep their URL and direction toggles', async ({ page }) => {
  await openList(page); const tabs = page.getByRole('group', { name: 'Mục tìm đối thủ' });
  await expect(tabs.getByRole('button', { name: 'Kèo của tôi' })).toHaveAttribute('aria-pressed', 'true');
  await tabs.getByRole('button', { name: 'Lời mời' }).click(); await expect(page).toHaveURL(/tab=invitations/);
  const direction = page.getByRole('group', { name: 'Hướng lời mời' }); await direction.getByRole('button', { name: 'Đã gửi' }).click(); await expect(direction.getByRole('button', { name: 'Đã gửi' })).toHaveAttribute('aria-pressed', 'true');
  await tabs.getByRole('button', { name: 'Yêu cầu đã gửi' }).click(); await expect(page).toHaveURL(/tab=applications/);
  await tabs.getByRole('button', { name: 'Kèo của tôi' }).click(); await expect(page).toHaveURL(/\/matchmaking$/);
});

test('cancel confirmation returns focus, shows server feedback and refreshes after success', async ({ page }) => {
  let attempts = 0;
  const reads = await openList(page, undefined, { '/api/v1/matchmaking-requests/10/cancel': route => ++attempts === 1 ? route.fulfill({ status: 409, json: { error: { code: 'MATCHMAKING_REQUEST_NOT_CANCELLABLE', message: 'x' } } }) : route.fulfill({ json: { data: { id: 10, status: 'CANCELLED' } } }) });
  const cancel = page.getByRole('article', { name: 'Kèo Đôi #10' }).getByRole('button', { name: 'Hủy yêu cầu' });
  await cancel.click(); const dialog = page.getByRole('dialog', { name: 'Hủy kèo?' }); await expect(dialog).toContainText('Booking được giữ nguyên.');
  await dialog.getByRole('button', { name: 'Quay lại' }).click(); await expect(dialog).toHaveCount(0); await expect(cancel).toBeFocused(); expect(attempts).toBe(0);
  await cancel.click(); await dialog.getByRole('button', { name: 'Xác nhận hủy kèo' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Yêu cầu này không thể hủy ở trạng thái hiện tại.'); await expect(dialog).toBeVisible();
  const before = reads.length; await dialog.getByRole('button', { name: 'Xác nhận hủy kèo' }).click(); await expect(dialog).toHaveCount(0); await expect.poll(() => reads.length).toBeGreaterThan(before);
});

test('empty and error states keep their actions', async ({ page }) => {
  let failing = true;
  await openList(page, route => failing ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } }) : route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } } }));
  await expect(page.getByRole('heading', { name: 'Không tải được danh sách' })).toBeVisible(); failing = false;
  await page.getByRole('button', { name: 'Thử lại' }).click(); await expect(page.getByRole('heading', { name: 'Chưa có yêu cầu ghép trận' })).toBeVisible();
  await page.getByRole('button', { name: 'Tạo yêu cầu', exact: true }).last().click(); await expect(page.getByRole('dialog', { name: 'Tạo bài tìm kèo' })).toBeVisible();
});
