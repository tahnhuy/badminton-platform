import { test, expect, type Page } from '@playwright/test';
import { createE2EUser, resetDatabase } from './e2e-helpers';

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

test('Admin can open the finance console and navigate its base sections', async ({ page }) => {
  await resetDatabase();
  const admin = await createE2EUser({ email: 'finance_admin_e2e@example.com', role: 'ADMIN' });
  await login(page, admin.email, admin.plainPassword);

  await page.goto('/admin/finance/overview');
  await expect(page.getByRole('heading', { name: 'Quản lý tài chính', exact: true })).toBeVisible();
  await expect(page.getByText('UI-REDO', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Tổng số dư ví', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Giao dịch', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/finance\/transactions/);
  await expect(page.getByText('Không có giao dịch.', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Payout', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/finance\/payouts/);
  await expect(page.getByText('Không có payout.', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Đối soát', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/finance\/reconciliation/);
  await expect(page.getByRole('button', { name: 'Chạy đối soát', exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Báo cáo', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/finance\/reports/);
  await expect(page.getByText('Net ước tính', { exact: true })).toBeVisible();
});

test('Legacy wallet routes redirect to the finance console and keep query params', async ({ page }) => {
  await resetDatabase();
  const admin = await createE2EUser({ email: 'finance_admin_redirect_e2e@example.com', role: 'ADMIN' });
  await login(page, admin.email, admin.plainPassword);

  await page.goto('/admin/wallet/payouts?payoutId=123');
  await expect(page).toHaveURL(/\/admin\/finance\/payouts\?payoutId=123/);
  await expect(page.getByRole('heading', { name: 'Quản lý tài chính', exact: true })).toBeVisible();
});
