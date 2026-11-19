import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
const results = {
  users: [{ id: 2, fullName: 'Người dùng Alpha', email: 'alpha@example.test', phone: null, role: 'PLAYER', status: 'ACTIVE', avatarUrl: null }],
  facilities: [{ id: 3, name: 'Cơ sở Alpha', address: '1 Đường Mẫu', city: 'Hồ Chí Minh', phone: '0900000000', status: 'ACTIVE' }],
  tournaments: [{ id: 4, name: 'Giải Alpha', format: 'SINGLES', status: 'DRAFT' }],
  reports: [{ id: 5, reasonCode: 'ALPHA_REASON', description: null, status: 'PENDING' }],
};
async function setup(page: Page, data = results) {
  const queries: string[] = [];
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'current.admin@example.test' }, handlers: {
    '/api/v1/admin/global-search': route => { queries.push(new URL(route.request().url()).searchParams.get('q')!); return route.fulfill({ json: { data } }); },
  } }); await page.goto('/admin/dashboard'); await expect(page.getByRole('main').getByRole('heading', { name: 'Bảng điều khiển', level: 1, exact: true })).toBeVisible(); return queries;
}
const placeholder = 'Tìm kiếm toàn sàn (User, Sân, Giải...)';

test('desktop shell retains five destinations and the collapsed dimensions', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await setup(page);
  const aside = page.getByRole('complementary', { name: 'Thanh điều hướng quản trị' }); const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị' });
  await expect(nav.getByRole('link')).toHaveCount(5); await expect(aside).toHaveCSS('width', '240px');
  await expect(aside.getByText('current.admin@example.test', { exact: true })).toBeVisible(); await expect(aside.getByText('admin@smashpro.vn', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true }).click(); await expect(aside).toHaveCSS('width', '68px'); await expect(page.getByRole('banner')).toHaveCSS('left', '68px');
  await expect(nav.getByRole('link')).toHaveCount(5); await page.getByRole('button', { name: 'Mở rộng thanh điều hướng', exact: true }).click(); await expect(aside).toHaveCSS('width', '240px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('menu filtering remains local, case-insensitive and retained through collapse', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); const queries = await setup(page);
  await page.getByPlaceholder('Tìm nhanh tab chức năng...').fill('  NGƯỜI  '); const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị' });
  await expect(nav.getByRole('link')).toHaveCount(1); await expect(nav.getByRole('link')).toHaveAttribute('href', '/admin/users');
  await page.getByRole('button', { name: 'Thu gọn thanh điều hướng', exact: true }).click(); await expect(nav.getByRole('link')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mở rộng thanh điều hướng', exact: true }).click(); await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click(); await expect(nav.getByRole('link')).toHaveCount(5); expect(queries).toEqual([]);
});

test('mobile navigation opens/closes via its existing controls and keeps all routes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await setup(page);
  await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' })).toHaveCount(0); await page.getByRole('button', { name: 'Mở thanh điều hướng', exact: true }).click();
  const nav = page.getByRole('navigation', { name: 'Điều hướng quản trị' }); await expect(nav.getByRole('link')).toHaveCount(5);
  await page.locator('div[aria-label="Đóng thanh điều hướng"]').click({ position: { x: 350, y: 300 } }); await expect(nav).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở thanh điều hướng', exact: true }).click(); await page.getByRole('navigation', { name: 'Điều hướng quản trị' }).getByRole('link', { name: 'Quản lý giải đấu', exact: true }).click();
  await expect(page).toHaveURL('/admin/tournaments'); await expect(page.getByRole('navigation', { name: 'Điều hướng quản trị' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('desktop search retains trim/debounce, grouping, clear and outside behavior', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await page.clock.install(); const queries = await setup(page);
  const input = page.getByPlaceholder(placeholder); await input.fill('  Alpha  '); await expect(page.getByRole('status')).toContainText('Đang tìm kiếm trên toàn hệ thống');
  await page.clock.runFor(279); expect(queries).toEqual([]); await page.clock.runFor(1); await expect(page.getByText('Người dùng (1)', { exact: true })).toBeVisible();
  expect(queries).toEqual(['Alpha']); for (const label of ['Cơ sở & Sân (1)', 'Giải đấu (1)', 'Báo cáo & Khiếu nại (1)']) await expect(page.getByText(label, { exact: true })).toBeVisible();
  await page.getByRole('main').getByRole('heading', { name: 'Bảng điều khiển', level: 1, exact: true }).click(); await expect(page.getByText('Người dùng (1)', { exact: true })).toHaveCount(0);
  await input.focus(); await expect(page.getByText('Người dùng (1)', { exact: true })).toBeVisible(); expect(queries).toEqual(['Alpha']);
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click(); await expect(input).toHaveValue(''); await expect(page.getByText('Người dùng (1)', { exact: true })).toHaveCount(0);
});

for (const [label, path] of [['Người dùng Alpha', '/admin/users'], ['Cơ sở Alpha', '/admin/courts'], ['Giải Alpha', '/admin/tournaments'], ['ALPHA_REASON', '/admin/reports']]) test(`global result ${label} keeps destination ${path}`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await setup(page); await page.getByPlaceholder(placeholder).fill('Alpha'); await page.getByRole('button', { name: new RegExp(label) }).click(); await expect(page).toHaveURL(path);
});

test('mobile search auto-focuses and closing resets the same query state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); await setup(page); await page.getByRole('button', { name: 'Mở tìm kiếm', exact: true }).click(); const input = page.getByPlaceholder(placeholder); await expect(input).toBeFocused();
  await input.fill('Alpha'); await expect(page.getByText('Người dùng (1)', { exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.getByRole('button', { name: 'Xóa từ khóa', exact: true }).click(); await expect(input).toHaveValue(''); await input.fill('Alpha'); await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('button', { name: 'Mở tìm kiếm', exact: true }).click(); await expect(page.getByPlaceholder(placeholder)).toHaveValue('');
});

test('empty global results retain query feedback', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 }); await setup(page, { users: [], facilities: [], tournaments: [], reports: [] }); await page.getByPlaceholder(placeholder).fill('Không có'); await expect(page.getByText('Không tìm thấy kết quả nào cho', { exact: false })).toBeVisible();
});
