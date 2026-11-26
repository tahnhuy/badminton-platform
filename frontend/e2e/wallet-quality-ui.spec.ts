import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const snapshot = { userId: 1, balance: '150000', held: '20000', available: '130000', updatedAt: '2026-11-26T00:00:00Z' };

async function mockWallet(page: Page) {
  const requests = { pages: [] as number[], topUps: [] as unknown[], confirmations: 0, failHistory: false };
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/wallet': route => route.fulfill({ json: { data: snapshot } }),
    '/api/v1/wallet/bank-accounts': route => route.fulfill({ json: { data: [] } }),
    '/api/v1/wallet/payouts': route => route.fulfill({ json: { data: [] } }),
    '/api/v1/wallet/withdrawal-pin': route => route.fulfill({ json: { data: { hasPin: false, lockedUntil: null } } }),
    '/api/v1/wallet/entries': route => {
      const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
      requests.pages.push(pageNumber);
      if (requests.failHistory) return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Không tải được lịch sử thử nghiệm.' } } });
      return route.fulfill({ json: { data: [{ id: pageNumber, userId: 1, entryType: 'TOP_UP', amount: '50000', balanceAfter: '150000', referenceType: null, referenceId: null, description: `Giao dịch trang ${pageNumber}`, createdAt: snapshot.updatedAt }], meta: { page: pageNumber, limit: 20, total: 21, totalPages: 2 } } });
    },
    '/api/v1/wallet/top-ups': route => {
      requests.topUps.push(route.request().postDataJSON());
      return route.fulfill({ json: { data: { topUpId: 7, amount: '75000', status: 'PENDING', provider: 'MOCK', redirectUrl: '', txnRef: 'TESTONLY-7', isMock: true } } });
    },
    '/api/v1/wallet/top-ups/7/mock-confirm': route => {
      requests.confirmations += 1;
      return route.fulfill({ json: { data: { status: 'SUCCESS', wallet: { ...snapshot, balance: '225000', available: '205000' } } } });
    },
  } });
  return requests;
}

for (const width of [390, 1280]) test(`wallet preserves tabs, history pagination and top-up payload at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const requests = await mockWallet(page);
  await page.goto('/wallet');
  await expect(page.getByRole('heading', { name: 'Ví của tôi' })).toBeVisible();
  await page.getByRole('button', { name: 'Lịch sử giao dịch', exact: true }).click();
  await expect(page.getByText('Trang 1/2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(page.getByText('Trang 2/2', { exact: true })).toBeVisible();
  expect(requests.pages).toEqual([1, 2]);
  await page.getByRole('button', { name: 'Rút tiền', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Yêu cầu rút tiền' })).toBeVisible();
  await page.getByRole('button', { name: 'Tài khoản nhận', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thêm tài khoản nhận tiền' })).toBeVisible();
  await page.getByRole('button', { name: 'Nạp tiền', exact: true }).click();
  await page.getByLabel('Số tiền', { exact: true }).fill('75000');
  await page.getByRole('button', { name: 'Tạo mã nạp tiền', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận thanh toán thử', exact: true }).click();
  await expect.poll(() => requests.confirmations).toBe(1);
  expect(requests.topUps).toEqual([{ amount: '75000' }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('wallet history keeps its selected page when refreshing after an API failure', async ({ page }) => {
  const requests = await mockWallet(page);
  await page.goto('/wallet');
  await page.getByRole('button', { name: 'Lịch sử giao dịch', exact: true }).click();
  await expect(page.getByText('Trang 1/2', { exact: true })).toBeVisible();
  requests.failHistory = true;
  await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không tải được lịch sử thử nghiệm.');
  requests.failHistory = false;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(page.getByText('Trang 2/2', { exact: true })).toBeVisible();
  expect(requests.pages).toEqual([1, 2, 2]);
});
