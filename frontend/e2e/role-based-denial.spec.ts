import { test, expect } from '@playwright/test';
import { resetDatabase, createE2EUser } from './e2e-helpers';

test.describe('AUTH-15: Role-Based Denial Scenario (PRD AC 15.6-5)', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('PLAYER opening /admin shows Access Denied page, not sign-in', async ({ page }) => {
    const player = await createE2EUser({
      email: 'player_denied@example.com',
      password: 'ValidPassword123!',
      role: 'PLAYER',
    });

    // 1. Sign in as PLAYER
    await page.goto('/sign-in');
    await page.locator('#email').fill(player.email);
    await page.locator('#password').fill(player.plainPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL('/');

    // 2. Open /admin
    await page.goto('/admin');

    // 3. Access denied page is shown, NOT redirected to /sign-in
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText('You do not have permission to access this resource')).toBeVisible();
    await expect(page.getByText('PLAYER')).toBeVisible();
  });

  test('COURT_OWNER opening /admin shows Access Denied page', async ({ page }) => {
    const owner = await createE2EUser({
      email: 'owner_denied@example.com',
      password: 'ValidPassword123!',
      role: 'COURT_OWNER',
    });

    // 1. Sign in as COURT_OWNER
    await page.goto('/sign-in');
    await page.locator('#email').fill(owner.email);
    await page.locator('#password').fill(owner.plainPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(page).toHaveURL('/owner');

    // 2. Open /admin
    await page.goto('/admin');

    // 3. Access denied page is shown
    await expect(page).not.toHaveURL(/\/sign-in/);
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
    await expect(page.getByText('COURT_OWNER')).toBeVisible();
  });
});
