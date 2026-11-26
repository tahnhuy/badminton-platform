import { test, expect } from '@playwright/test';
import { resetDatabase, createE2EUser } from './e2e-helpers';

test.describe('AUTH-16: Sign-In Scenario (PRD AC 15.4-1, 15.4-3, 15.6-3)', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('wrong password shows exactly "Email hoặc mật khẩu không đúng"', async ({ page }) => {
    const user = await createE2EUser({
      email: 'player_wrong_pwd@example.com',
      password: 'ValidPassword123!',
      role: 'PLAYER',
    });

    await page.goto('/sign-in');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill('IncorrectPassword999!');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page.getByText('Email hoặc mật khẩu không đúng')).toBeVisible();
  });

  test('unknown email shows exactly "Email hoặc mật khẩu không đúng"', async ({ page }) => {
    await page.goto('/sign-in');
    await page.locator('#email').fill('non_existent_player@example.com');
    await page.locator('#password').fill('ValidPassword123!');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page.getByText('Email hoặc mật khẩu không đúng')).toBeVisible();
  });

  test('valid sign-in -> role home, reload keeps session, sign-out -> /sign-in, guarded route -> /sign-in', async ({ page }) => {
    const user = await createE2EUser({
      email: 'active_player@example.com',
      password: 'ValidPassword123!',
      role: 'PLAYER',
    });

    // 1. Sign in with valid credentials
    await page.goto('/sign-in');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(user.plainPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    // 2. Redirected to the Player home feed.
    await expect(page).toHaveURL('/feed');
    await expect(page.getByRole('heading', { name: 'Bảng tin cộng đồng' })).toBeVisible();

    // 3. Reload page -> still signed in (PRD AC 15.4-1)
    await page.reload();
    await expect(page).toHaveURL('/feed');
    await expect(page.getByRole('heading', { name: 'Bảng tin cộng đồng' })).toBeVisible();

    // 4. Sign out -> redirected to /sign-in (PRD AC 15.4-3)
    await page.getByRole('button', { name: 'Tài khoản của tôi' }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/sign-in/);

    // 5. Opening a guarded route after sign-out -> redirected to /sign-in (PRD AC 15.6-3).
    // `/` itself is the public landing page for visitors since AUTH-34, so use a Player route.
    await page.goto('/feed');
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
