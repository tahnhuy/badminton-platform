import { test, expect } from '@playwright/test';
import { resetDatabase, createE2EUser } from './e2e-helpers';

test.describe('AUTH-17: Forced Password Change Scenario (PRD §7.5, AC 15.2-1)', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('user with must_change_password=true is forced to /change-password until changed', async ({ page }) => {
    const user = await createE2EUser({
      email: 'forced_player@example.com',
      password: 'InitialPassword123!',
      role: 'PLAYER',
      mustChangePassword: true,
    });

    // 1. Sign in
    await page.goto('/sign-in');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(user.plainPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // 2. Lands on /change-password
    await expect(page).toHaveURL('/change-password');
    await expect(page.getByRole('heading', { name: 'Bắt buộc đổi mật khẩu' })).toBeVisible();
    await expect(page.getByText('Bạn cần đổi mật khẩu trước khi có thể truy cập các tính năng khác của hệ thống.')).toBeVisible();

    // 3. Opening / or /owner returns to /change-password
    await page.goto('/');
    await expect(page).toHaveURL('/change-password');

    await page.goto('/owner');
    await expect(page).toHaveURL('/change-password');

    // 4. Submit invalid current password -> error
    await page.locator('#currentPassword').fill('WrongCurrentPass123!');
    await page.locator('#newPassword').fill('ValidBrandNewPass123!');
    await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();
    await expect(page.getByText('Mật khẩu hiện tại không đúng').first()).toBeVisible();

    // 5. Submit valid new password -> success lands on role starting route
    await page.locator('#currentPassword').fill(user.plainPassword);
    await page.locator('#newPassword').fill('ValidBrandNewPass123!');
    await page.getByRole('button', { name: 'Cập nhật mật khẩu' }).click();

    // After success, redirected to role home (PLAYER -> /)
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Player Dashboard' })).toBeVisible();
  });
});
