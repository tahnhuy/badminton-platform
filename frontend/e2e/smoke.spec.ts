import { test, expect } from '@playwright/test';

test.describe('AUTH-25: Smoke Test', () => {
  test('opening /sign-in shows the sign-in form', async ({ page }) => {
    await page.goto('/sign-in');

    // Verify page heading
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

    // Verify form fields
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    // Verify submit button
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

    // Verify link to register
    await expect(page.getByRole('link', { name: 'Tạo tài khoản' })).toBeVisible();
  });
});
