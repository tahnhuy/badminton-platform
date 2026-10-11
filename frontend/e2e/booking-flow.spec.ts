import { test, expect } from '@playwright/test';
import { resetDatabase, createE2EUser, seedCourt } from './e2e-helpers';

test.describe('Booking: unpaid hold flow (BK-14 partial — search → hold → history → cancel)', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('books a slot, sees the pending hold, then cancels it', async ({ page }) => {
    const user = await createE2EUser({
      email: 'booking_player@example.com',
      password: 'ValidPassword123!',
      role: 'PLAYER',
    });
    const { courtId } = await seedCourt();

    await page.goto('/sign-in');
    await page.locator('#email').fill(user.email);
    await page.locator('#password').fill(user.plainPassword);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/courts');
    await expect(page.getByText('E2E Badminton Club')).toBeVisible();

    const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await page.goto(`/courts/${courtId}?date=${date}`);
    await page.getByRole('button', { name: /06:00/ }).first().click();
    await page.getByRole('button', { name: 'Tiếp tục đặt sân' }).click();

    await expect(page.getByText('Xác nhận thông tin & Thanh toán')).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();

    await expect(page).toHaveURL(/\/bookings\/\d+\/pending/);
    await expect(page.getByText('CHỜ THANH TOÁN (PENDING PAYMENT)')).toBeVisible();

    await page.getByRole('button', { name: 'Hủy đơn đặt sân' }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy' }).click();

    await expect(page).toHaveURL(/\/bookings\/\d+$/);
    await expect(page.getByText('Đơn đã được hủy')).toBeVisible();
  });
});
