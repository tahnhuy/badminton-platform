import { test, expect, type Page } from '@playwright/test';
import { createE2EUser, resetDatabase, seedCourt } from './e2e-helpers';

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

test('Admin opens the dashboard, switches range, refreshes and navigates to a management area', async ({ page }) => {
  test.setTimeout(90000);
  await resetDatabase();
  await seedCourt();
  const admin = await createE2EUser({ email: 'dashboard_admin_e2e@example.com', role: 'ADMIN' });

  await login(page, admin.email, admin.plainPassword);
  await page.goto('/admin/dashboard');

  await expect(page.getByRole('heading', { name: 'Bảng điều khiển', exact: true })).toBeVisible();
  await expect(page.getByTestId('kpi-card')).toHaveCount(6);
  await expect(page.getByTestId('growth-chart')).toBeVisible();
  await expect(page.getByTestId('recent-activity')).toBeVisible();

  await expect(page.getByTestId('dashboard-extra-charts')).toBeVisible();
  for (const chart of [
    'chart-revenue',
    'chart-booking-status',
    'chart-booking-heatmap',
    'chart-top-facilities',
    'chart-report-breakdown',
    'chart-tournament-status',
  ]) {
    await expect(page.getByTestId(chart)).toBeVisible();
  }
  await expect(page.getByText('Giá trị ước tính', { exact: true })).toBeVisible();
  await expect(page.getByText('ước tính', { exact: false }).first()).toBeVisible();

  // Fabricated Figma-only widgets must not be rendered.
  await expect(page.getByText('Geographic Court & Facility Distribution')).toHaveCount(0);
  await expect(page.getByText('System Audit Trail')).toHaveCount(0);
  await expect(page.getByText('99.98%')).toHaveCount(0);

  // Newest activity includes the seeded facility.
  await expect(page.getByTestId('recent-activity').getByText('Cơ sở mới: E2E Badminton Club')).toBeVisible();

  const chartsResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/admin/dashboard/charts?range=year') && response.request().method() === 'GET',
  );
  await page.getByRole('button', { name: 'Năm này', exact: true }).click();
  await expect((await chartsResponse).ok()).toBeTruthy();
  await expect(page.locator('[data-range="year"]')).toHaveAttribute('aria-pressed', 'true');

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const customResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/admin/dashboard/kpis?range=custom') && response.request().method() === 'GET',
  );
  await page.locator('[data-range="custom"]').click();
  await page.getByLabel('Từ ngày').fill(weekStart.toISOString().slice(0, 10));
  await page.getByLabel('Đến ngày').fill(today);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect((await customResponse).ok()).toBeTruthy();
  await expect(page.locator('[data-range="custom"]')).toHaveAttribute('aria-pressed', 'true');

  await expect(page.getByTestId('dashboard-refresh')).toBeEnabled();
  const refreshResponse = page.waitForResponse(response =>
    response.url().includes('/api/v1/admin/dashboard/recent-activities') && response.request().method() === 'GET',
  );
  await page.getByTestId('dashboard-refresh').click();
  await expect((await refreshResponse).ok()).toBeTruthy();

  await page.getByTestId('quick-link').filter({ hasText: 'Báo cáo' }).click();
  await expect(page).toHaveURL(/\/admin\/reports/);
});
