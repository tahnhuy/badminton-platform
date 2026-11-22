import { expect, test } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

for (const width of [390, 1280]) test(`wallet stylesheet cleanup preserves tabs, history and responsive layout at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/wallet': route => route.fulfill({ json: { data: { balance: '100000', held: '0', available: '100000', updatedAt: '2026-11-22T03:00:00Z' } } }),
    '/api/v1/wallet/bank-accounts': route => route.fulfill({ json: { data: [] } }),
    '/api/v1/wallet/payouts': route => route.fulfill({ json: { data: [] } }),
    '/api/v1/wallet/entries': route => route.fulfill({ json: { data: [{ id: 1, entryType: 'TOP_UP', amount: '100000', balanceAfter: '100000', description: 'Nạp ví thử', referenceType: 'TOP_UP', referenceId: 1, createdAt: '2026-11-22T03:00:00Z' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } }),
  } });
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Nạp tiền vào ví', exact: true })).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Ví', exact: true });
  await tabs.getByRole('button', { name: 'Rút tiền', exact: true }).click();
  await expect(page.getByText('Chưa có yêu cầu rút tiền.', { exact: true })).toBeVisible();
  await tabs.getByRole('button', { name: 'Tài khoản nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: /Lưu tài khoản|Thêm tài khoản/ })).toBeVisible();
  const accountNumber = page.getByLabel('Số tài khoản', { exact: true });
  await expect(accountNumber).toHaveCSS('height', '44px');
  await expect(accountNumber).toHaveCSS('border-top-width', '1px');
  await accountNumber.focus();
  await expect(accountNumber).toBeFocused();
  await tabs.getByRole('button', { name: 'Lịch sử giao dịch', exact: true }).click();
  await expect(page.getByRole('table').getByText('Nạp ví thử', { exact: true })).toBeVisible();
  const type = page.locator('.wallet-entry-type');
  await expect(type).toHaveCSS('color', 'rgb(0, 107, 44)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

for (const width of [390, 1280]) test(`owner wallet fields retain their size and borders at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await mockAuthApi(page, { user: account('COURT_OWNER'), handlers: {
    '/api/v1/wallet': route => route.fulfill({ json: { data: { balance: '100000', held: '0', available: '100000', updatedAt: '2026-11-22T03:00:00Z' } } }),
    '/api/v1/wallet/bank-accounts': route => route.fulfill({ json: { data: [] } }),
    '/api/v1/wallet/payouts': route => route.fulfill({ json: { data: [] } }),
  } });
  await page.goto('/owner/wallet');
  await expect(page.getByRole('heading', { name: 'Ví & thu nhập', exact: true })).toBeVisible();
  for (const field of [page.getByLabel('Số tiền rút', { exact: true }), page.getByRole('combobox', { name: 'Tài khoản nhận tiền', exact: true }), page.getByLabel('Số tài khoản', { exact: true })]) {
    await expect(field).toHaveCSS('height', '44px');
    await expect(field).toHaveCSS('border-top-width', '1px');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
