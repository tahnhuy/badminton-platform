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
  await expect(main.getByLabel('Email', { exact: true })).toHaveValue('owner@example.test'); await expect(main.getByText('Chủ sân', { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: 'Đổi mật khẩu', exact: true })).toHaveAttribute('href', '/change-password');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('dashboard links retain the selected facilityId and do not invent analytics', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner?facilityId=22'); const nav = page.getByRole('navigation', { name: 'Thao tác Chủ sân' });
  await expect(nav.getByRole('link', { name: 'Bảng giá sân', exact: true })).toHaveAttribute('href', '/owner/pricing?facilityId=22');
  await expect(nav.getByRole('link', { name: 'Lịch đặt & Giám sát', exact: true })).toHaveAttribute('href', '/owner/schedule?facilityId=22');
  await expect(page.getByRole('main').getByText(/Doanh thu|Tỷ lệ lấp đầy|Dự báo/)).toHaveCount(0);
});

test('facility creation opens in a drawer from the page header and closes without side effects', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner');
  await expect(page.getByLabel('Tên cơ sở', { exact: true })).toHaveCount(0); await page.getByRole('main').getByRole('button', { name: 'Thêm cơ sở', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'Gửi cơ sở mới để duyệt' }); await expect(drawer.getByLabel('Tên cơ sở', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(drawer).toHaveCount(0); await expect(page.getByLabel('Tên cơ sở', { exact: true })).toHaveCount(0);
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
test('account shows the business name and lets the Owner change the phone immediately, without review or OTP', async ({ page }) => {
  const bodies: unknown[] = [];
  await mockOwnerUi(page, { '/api/v1/owner/profile': route => {
    if (route.request().method() === 'PATCH') { bodies.push(route.request().postDataJSON()); return route.fulfill({ json: { data: { businessName: 'CLB Chủ sân mẫu', phone: '0912345678', updatedAt: '2026-11-27T00:00:00Z' } } }); }
    return route.fulfill({ json: { data: { businessName: 'CLB Chủ sân mẫu', phone: bodies.length ? '0912345678' : '0901234567', updatedAt: '2026-11-01T00:00:00Z' } } });
  } });
  await page.goto('/owner/account?facilityId=22'); const main = page.getByRole('main');
  await expect(main.getByLabel('Tên doanh nghiệp', { exact: true })).toHaveValue('CLB Chủ sân mẫu'); await expect(main.getByLabel('Tên doanh nghiệp', { exact: true })).not.toBeEditable();
  const phone = main.getByLabel('Số điện thoại', { exact: true }); await expect(phone).toHaveValue('0901234567');
  await phone.fill('  0912 345 678 '); await main.getByRole('button', { name: 'Lưu số điện thoại', exact: true }).click();
  await expect(main.getByRole('status')).toContainText('Đã lưu thay đổi.'); expect(bodies).toEqual([{ phone: '0912 345 678' }]);
  await expect(main.getByLabel('Số điện thoại', { exact: true })).toHaveValue('0912345678');
  await expect(page.getByText(/OTP|mã xác minh/i)).toHaveCount(0); await expect(main.getByText('Chờ duyệt')).toHaveCount(0);
});
test('an invalid phone keeps the typed value and shows the validation message', async ({ page }) => {
  await mockOwnerUi(page, { '/api/v1/owner/profile': route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 400, json: { error: { code: 'VALIDATION_FAILED', message: 'Invalid request' } } })
    : route.fulfill({ json: { data: { businessName: 'CLB Chủ sân mẫu', phone: '0901234567', updatedAt: '2026-11-01T00:00:00Z' } } }) });
  await page.goto('/owner/account'); const main = page.getByRole('main');
  await main.getByLabel('Số điện thoại', { exact: true }).fill('12ab'); await main.getByRole('button', { name: 'Lưu số điện thoại', exact: true }).click();
  await expect(main.getByRole('alert')).toContainText('Vui lòng kiểm tra các trường nhập.'); await expect(main.getByLabel('Số điện thoại', { exact: true })).toHaveValue('12ab');
});
