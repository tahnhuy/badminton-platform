import { test, expect, type Page } from '@playwright/test';
import { createE2EUser, resetDatabase, seedCourt } from './e2e-helpers';

const BASE = 'http://localhost:5173/api/v1';
const bookingDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 2 * 86400000));

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}

async function api(page: Page, method: 'get' | 'post', path: string, body?: unknown) {
  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'csrf_token')?.value ?? '';
  const response = await page.context().request[method](`${BASE}${path}`, {
    ...(body === undefined ? {} : { data: body }),
    headers: { 'X-CSRF-Token': csrf },
  });
  if (!response.ok()) throw new Error(`${method} ${path}: ${response.status()} ${await response.text()}`);
  return response.json();
}

async function topUp(page: Page, amount = 500000) {
  const topUp = await api(page, 'post', '/wallet/top-ups', { amount: String(amount), provider: 'MOCK' });
  await api(page, 'post', `/wallet/top-ups/${topUp.data.topUpId}/mock-confirm`);
}

async function createBooking(page: Page, courtId: number) {
  const created = await api(page, 'post', '/bookings', { courtId, bookingDate, startTime: '18:00', durationMinutes: 90 });
  return created.data as { id: number };
}

test('wallet payment settles synchronously and shows the confirmed booking', async ({ page }) => {
  await resetDatabase();
  const player = await createE2EUser({ email: 'e2e_pay_success@example.com', role: 'PLAYER' });
  const court = await seedCourt();
  await login(page, player.email, player.plainPassword);
  await topUp(page);
  const booking = await createBooking(page, court.courtId);

  await page.goto(`/bookings/${booking.id}`);
  await page.getByRole('link', { name: 'Đi tới thanh toán' }).click();
  await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/${booking.id}$`));
  await expect(page.getByText('Đã xác nhận', { exact: true })).toBeVisible();
});

test('insufficient wallet balance surfaces the top-up action', async ({ page }) => {
  await resetDatabase();
  const player = await createE2EUser({ email: 'e2e_pay_empty@example.com', role: 'PLAYER' });
  const court = await seedCourt();
  await login(page, player.email, player.plainPassword);
  const booking = await createBooking(page, court.courtId);

  await page.goto(`/bookings/${booking.id}/pending`);
  await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
  await expect(page.getByRole('alert')).toContainText('Số dư ví không đủ');
  await expect(page.getByRole('link', { name: 'Nạp tiền vào ví' })).toHaveAttribute('href', '/wallet');
});
