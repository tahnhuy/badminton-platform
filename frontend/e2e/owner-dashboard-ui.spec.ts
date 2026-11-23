import { expect, test } from '@playwright/test';
import { mockOwnerUi, ownerFacilities } from './owner-ui-mocks';

for (const width of [390, 1280]) test(`Owner dashboard and account fit at ${width}px with actual identity fields`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mockOwnerUi(page);
  await page.goto('/owner?facilityId=22'); const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Bảng điều khiển Chủ sân', exact: true })).toBeVisible();
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(ownerFacilities.map(facility => facility.name));
  await expect(main.getByRole('link', { name: 'Quản lý cơ sở này', exact: true }).nth(0)).toHaveAttribute('href', '/owner/facilities?facilityId=11');
  await expect(main.getByRole('link', { name: 'Quản lý cơ sở này', exact: true }).nth(1)).toHaveAttribute('href', '/owner/facilities?facilityId=22');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.goto('/owner/account?facilityId=22'); await expect(main.getByRole('heading', { name: 'Tài khoản Chủ sân', exact: true })).toBeVisible();
  await expect(main.getByText('owner@example.test', { exact: true })).toBeVisible(); await expect(main.getByText('Chủ sân', { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Đổi mật khẩu', exact: true })).toHaveAttribute('href', '/change-password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('dashboard links retain the selected facilityId and do not invent analytics', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner?facilityId=22'); const nav = page.getByRole('navigation', { name: 'Thao tác Chủ sân' });
  await expect(nav.getByRole('link', { name: 'Bảng giá sân', exact: true })).toHaveAttribute('href', '/owner/pricing?facilityId=22');
  await expect(nav.getByRole('link', { name: 'Lịch đặt & Giám sát', exact: true })).toHaveAttribute('href', '/owner/schedule?facilityId=22');
  await expect(page.getByRole('main').getByText(/Doanh thu|Tỷ lệ lấp đầy|Dự báo/)).toHaveCount(0);
});

test('facility creation toggle retains its initial closed/open behavior', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner');
  await expect(page.getByLabel('Tên cơ sở', { exact: true })).toHaveCount(0); await page.getByRole('button', { name: 'Thêm cơ sở', exact: true }).click();
  await expect(page.getByLabel('Tên cơ sở', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Đóng biểu mẫu', exact: true }).click(); await expect(page.getByLabel('Tên cơ sở', { exact: true })).toHaveCount(0);
});

test('empty Owner dashboard keeps onboarding and omits facility-bound links', async ({ page }) => {
  await mockOwnerUi(page, {}, []); await page.goto('/owner');
  await expect(page.getByText('Bạn chưa có cơ sở.', { exact: false })).toBeVisible(); await expect(page.getByRole('button', { name: 'Gửi cơ sở để duyệt', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Thao tác Chủ sân' })).toHaveCount(0); await expect(page.getByRole('link', { name: 'Quản lý cơ sở này', exact: true })).toHaveCount(0);
});

test('account sign-out keeps the existing session operation and redirect', async ({ page }) => {
  const state = await mockOwnerUi(page); await page.goto('/owner/account'); await page.getByRole('main').getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
});
