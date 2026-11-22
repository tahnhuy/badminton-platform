import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

/** BUG-02 regression: the dashboard must degrade to a no-data state, not crash. */
const kpis = {
  range: 'month',
  users: { totalPlayers: 0, newUsers: 0, activeUserRate: 0 },
  facilities: { totalFacilities: 0, totalCourts: 0, active: 0, suspended: 0, pendingApproval: 0 },
  bookings: { totalBookings: 0, slotFillRate: 0 },
  revenue: { estimatedValue: '0', currency: 'VND', isEstimate: false },
  tournaments: { inProgress: 0, participants: 0 },
  reports: { unresolved: 0 },
};
const emptySeries = {
  newUsers: [], newBookings: [], revenueByDay: [], bookingStatuses: [],
  bookingHeatmap: [], topFacilities: [], reportBreakdown: [], tournamentStatuses: [],
};
const EMPTY_MESSAGE = 'Chưa có dữ liệu tăng trưởng trong khoảng thời gian này.';

async function openDashboard(page: Page, chartsBody: unknown) {
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'dashboard.ui@example.test' }, handlers: {
    '/api/v1/admin/dashboard/kpis': route => route.fulfill({ json: { data: kpis } }),
    '/api/v1/admin/dashboard/charts': route => route.fulfill({ json: chartsBody }),
    '/api/v1/admin/dashboard/recent-activities': route => route.fulfill({ json: { data: { items: [] } } }),
  } });
  await page.goto('/admin/dashboard');
  await expect(page.getByRole('heading', { name: 'Bảng điều khiển', level: 1 })).toBeVisible();
}

test('renders all chart widgets with a complete payload', async ({ page }) => {
  await openDashboard(page, { data: { range: 'month', series: emptySeries } });
  await expect(page.getByTestId('growth-chart')).toBeVisible();
  await expect(page.getByTestId('dashboard-extra-charts')).toBeVisible();
  await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
  await expect(page.getByText('Unexpected Application Error!')).toHaveCount(0);
});

for (const [label, body] of [
  ['an empty data array', { data: [] }],
  ['a payload without series', { data: { range: 'month' } }],
  ['a payload with an empty series object', { data: { range: 'month', series: {} } }],
] as const) {
  test(`degrades to the no-data state for ${label}`, async ({ page }) => {
    await openDashboard(page, body);
    await expect(page.getByTestId('growth-chart')).toBeVisible();
    await expect(page.getByText(EMPTY_MESSAGE)).toBeVisible();
    await expect(page.getByText('Unexpected Application Error!')).toHaveCount(0);
  });
}

for (const width of [390, 1280]) {
  test(`custom date filter preserves the dashboard header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDashboard(page, { data: { range: 'month', series: emptySeries } });
    const heading = page.getByRole('heading', { name: 'Bảng điều khiển', level: 1 });
    const refresh = page.getByTestId('dashboard-refresh');
    const filter = page.getByRole('region', { name: 'Bộ lọc thời gian dashboard' });
    await expect(refresh).toBeEnabled();
    const headerBefore = await heading.boundingBox();
    const refreshBefore = await refresh.boundingBox();
    await filter.getByRole('button', { name: 'Khoảng thời gian', exact: true }).click();
    await expect(filter.getByLabel('Từ ngày')).toBeVisible();
    await expect(filter.getByLabel('Đến ngày')).toBeVisible();
    expect(await heading.boundingBox()).toEqual(headerBefore);
    expect(await refresh.boundingBox()).toEqual(refreshBefore);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await filter.getByLabel('Từ ngày').fill('2026-11-01');
    await filter.getByLabel('Đến ngày').fill('2026-11-20');
    await filter.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(refresh).toBeEnabled();
    await expect(filter.getByLabel('Từ ngày')).toHaveValue('2026-11-01');
  });
}

for (const width of [390, 1280]) test(`Recharts renders populated revenue and growth charts at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openDashboard(page, { data: { range: 'month', series: { ...emptySeries,
    newUsers: [{ date: '2026-11-20', count: 2 }, { date: '2026-11-21', count: 4 }],
    newBookings: [{ date: '2026-11-20', count: 3 }, { date: '2026-11-21', count: 1 }],
    revenueByDay: [{ date: '2026-11-20', amount: '100000' }, { date: '2026-11-21', amount: '200000' }],
  } } });
  await expect(page.getByRole('img', { name: 'Biểu đồ doanh thu ước tính theo ngày', exact: true })).toBeVisible();
  const growth = page.getByTestId('growth-chart');
  await expect(growth.locator('.recharts-line-curve')).toHaveCount(2);
  await expect(page.getByTestId('chart-revenue').locator('.recharts-bar-rectangle')).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.screenshot({ path: `/tmp/finance-dashboard-${width}.png`, fullPage: true });
});

for (const width of [390, 1280]) test(`shared notification popover restores focus and fits at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openDashboard(page, { data: { range: 'month', series: emptySeries } });
  await page.route('**/api/v1/notifications?*', route => route.fulfill({ json: { data: [{ id: 71, type: 'BOOKING_CONFIRMED', title: 'Đặt sân thành công', content: 'Booking #71 đã được xác nhận', isRead: false, createdAt: '2026-11-22T03:00:00Z' }], meta: { page: 1, limit: 5, total: 1, totalPages: 1 } } }));
  const bell = page.getByRole('button', { name: /^Thông báo/ });
  await bell.click();
  const popover = page.getByRole('dialog', { name: 'Thông báo', exact: true });
  await expect(popover.getByText('Đặt sân thành công', { exact: true })).toBeVisible();
  const box = (await popover.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');
  await expect(popover).toHaveCount(0);
  await expect(bell).toBeFocused();
});
