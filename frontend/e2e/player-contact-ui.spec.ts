import { expect, test } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

for (const width of [390, 1280]) test(`contact ${width}: existing values, optional clearing and private contact copy`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const writes: unknown[] = [];
  await mockAuthApi(page, { user: account(), handlers: { '/api/v1/players/me/contact': route => {
    if (route.request().method() === 'PATCH') {
      const data = route.request().postDataJSON(); writes.push(data); return route.fulfill({ json: { data } });
    }
    return route.fulfill({ json: { data: { phone: '0900123456' } } });
  } } });
  await page.goto('/profile/contact');
  const phone = page.getByLabel('Số điện thoại (tùy chọn)', { exact: true });
  await expect(phone).toHaveValue('0900123456'); await expect(phone).toHaveAttribute('maxlength', '40');
  await expect(page.getByText(/số này không hiển thị trên hồ sơ công khai/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Trang chủ', exact: true })).toHaveAttribute('href', '/');
  await phone.fill('  +84901234567  '); await page.getByRole('button', { name: 'Lưu số điện thoại', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã lưu số điện thoại.' })).toBeVisible();
  expect(writes[0]).toEqual({ phone: '+84901234567' });
  await phone.fill(''); await page.getByRole('button', { name: 'Lưu số điện thoại', exact: true }).click();
  await expect.poll(() => writes.length).toBe(2); expect(writes[1]).toEqual({ phone: null });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('contact keeps server validation, input and explicit reload on failure', async ({ page }) => {
  let reads = 0;
  await mockAuthApi(page, { user: account(), handlers: { '/api/v1/players/me/contact': route => {
    if (route.request().method() === 'PATCH') return route.fulfill({ status: 400, json: { error: { code: 'VALIDATION_FAILED' } } });
    reads++; return route.fulfill({ json: { data: { phone: null } } });
  } } });
  await page.goto('/profile/contact'); const phone = page.getByLabel('Số điện thoại (tùy chọn)');
  await phone.fill('invalid'); await page.getByRole('button', { name: 'Lưu số điện thoại' }).click();
  await expect(page.getByRole('alert')).toContainText('Nhập 7–15 chữ số'); await expect(phone).toHaveValue('invalid');
  const previousReads = reads; await page.getByRole('button', { name: 'Tải lại', exact: true }).click();
  await expect(phone).toHaveValue(''); expect(reads).toBeGreaterThan(previousReads);
});

test('contact retains duplicate-submit guard while a save is pending', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let writes = 0;
  await mockAuthApi(page, { user: account(), handlers: { '/api/v1/players/me/contact': async route => {
    if (route.request().method() === 'PATCH') { writes++; await gate; return route.fulfill({ json: { data: { phone: '0900123456' } } }); }
    return route.fulfill({ json: { data: { phone: null } } });
  } } });
  await page.goto('/profile/contact'); await page.getByLabel('Số điện thoại (tùy chọn)').fill('0900123456');
  await page.getByRole('button', { name: 'Lưu số điện thoại' }).click(); await expect(page.getByRole('button', { name: 'Đang lưu…', exact: true })).toBeDisabled();
  expect(writes).toBe(1); release(); await expect(page.getByRole('status').filter({ hasText: 'Đã lưu số điện thoại.' })).toBeVisible();
});
