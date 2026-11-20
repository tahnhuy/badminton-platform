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
