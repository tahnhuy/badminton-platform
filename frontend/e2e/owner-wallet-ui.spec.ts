import { expect, test } from '@playwright/test';
import { mockOwnerUi } from './owner-ui-mocks';
const bank = { id: 7, userId: 1, bankCode: 'MBBank', accountNumber: '0123456789', accountName: 'TRAN QUOC BAO', isDefault: true, createdAt: '2026-11-22T03:00:00Z' };
const wallet = { userId: 1, balance: '1000000', held: '0', available: '1000000', updatedAt: '2026-11-22T03:00:00Z' };
for (const width of [390, 1280]) test(`owner wallet matches panel layout and submits existing operations at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  let payoutBody: unknown; let bankBody: unknown;
  await mockOwnerUi(page, {
    '/api/v1/wallet/withdrawal-pin': route => route.fulfill({ json: { data: { hasPin: true, lockedUntil: null } } }),
    '/api/v1/wallet': route => route.fulfill({ json: { data: wallet } }),
    '/api/v1/wallet/payouts': route => route.fulfill({ json: { data: [] } }),
    '/api/v1/wallet/bank-accounts': route => {
      if (route.request().method() === 'POST') { bankBody = route.request().postDataJSON(); return route.fulfill({ json: { data: { ...bank, id: 8, accountNumber: '9999888877', bankCode: 'VCB' } } }); }
      return route.fulfill({ json: { data: [bank] } });
    },
    '/api/v1/wallet/owner-payouts': route => {
      payoutBody = route.request().postDataJSON();
      return route.fulfill({ json: { data: { id: 81, userId: 1, amount: '50000', status: 'PENDING', bankAccountId: 7, createdAt: '2026-11-23T03:00:00Z', paidAt: null, adminNote: null } } });
    },
  });
  await page.goto('/owner/wallet?facilityId=11');
  await expect(page.getByRole('heading', { name: 'Tạo yêu cầu rút tiền' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tài khoản ngân hàng' })).toBeVisible();
  await expect(page.getByLabel('Số tài khoản', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gửi yêu cầu rút tiền', exact: true }).click();
  expect(await page.getByLabel('Mã PIN rút tiền', { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(payoutBody).toBeUndefined();
  await page.getByLabel('Mã PIN rút tiền', { exact: true }).fill('482951');
  await page.getByRole('button', { name: 'Gửi yêu cầu rút tiền', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã tạo yêu cầu #81');
  expect(payoutBody).toEqual({ amount: '50000', bankAccountId: 7, withdrawalPin: '482951', clientRequestId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) });
  await expect(page.getByRole('cell', { name: 'Chờ Admin duyệt', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Thêm', exact: true }).click();
  await page.getByLabel('Ngân hàng', { exact: true }).fill('VCB');
  await page.getByLabel('Số tài khoản', { exact: true }).fill('9999888877');
  await page.getByLabel('Tên chủ tài khoản', { exact: true }).fill('TRAN QUOC BAO');
  await page.getByRole('button', { name: 'Thêm tài khoản', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã thêm tài khoản nhận tiền.');
  expect(bankBody).toEqual({ bankCode: 'VCB', accountNumber: '9999888877', accountName: 'TRAN QUOC BAO', isDefault: false });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBeFalsy();
});
