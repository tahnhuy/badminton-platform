import { test, expect } from '@playwright/test';

const facility = { id: 1, name: 'CLB Owner', description: null, phone: '0900000000', address: '1 Test', ward: null, district: 'Quận 1', city: 'TP.HCM', openingTime: '06:00', closingTime: '22:00', status: 'ACTIVE', updatedAt: new Date().toISOString(), courtCount: 1 };
const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 86400000));
const booking = { id: 20, bookingCode: 'BK20', courtId: 5, bookingDate: tomorrow, startTime: '18:00:00', endTime: '19:00:00', status: 'CONFIRMED', totalAmount: 100000, unitPrice: 100000, bookingKind: 'PLAYER', refundStatus: 'NONE', player: { id: 2, fullName: 'Người chơi', email: 'p@test.test', phone: null }, pricingDetails: [] };

async function mockOwner(page: import('@playwright/test').Page, detail: Record<string, unknown>) {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: 9, email: 'owner@test.test', role: 'COURT_OWNER', requiresPasswordChange: false } } }));
  await page.route('**/api/v1/owner/facilities?*', route => route.fulfill({ json: { data: [facility], meta: { page: 1, limit: 100, total: 1, totalPages: 1 } } }));
  await page.route('**/api/v1/owner/facilities/1/schedule?*', route => route.fulfill({ json: { data: { facilityId: 1, date: tomorrow, courts: [{ courtId: 5, courtName: 'Sân 1', status: 'ACTIVE', slots: [{ startTime: '18:00', endTime: '19:00', state: 'BOOKED', bookingId: 20, bookingStatus: 'CONFIRMED', bookingKind: 'PLAYER', player: { fullName: 'Người chơi', email: 'p@test.test', phone: null } }] }] } } }));
  await page.route('**/api/v1/owner/facilities/1/bookings?*', route => route.fulfill({ json: { data: [booking], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } }));
  await page.route('**/api/v1/owner/bookings/20', route => route.fulfill({ json: { data: detail } }));
}

test('owner cancellation requires a reason and shows the real refund state', async ({ page }) => {
  await mockOwner(page, booking);
  let requested = false;
  await page.route('**/api/v1/owner/bookings/20/cancel', route => {
    expect(route.request().postDataJSON()).toEqual({ reason: 'Sân gặp sự cố điện' });
    requested = true;
    return route.fulfill({ json: { data: { id: 20, status: 'CANCELLED', refundStatus: 'PENDING' } } });
  });
  await page.goto('/owner/schedule?facilityId=1');
  await page.getByRole('button', { name: 'BK20' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Xác nhận hủy booking' })).toBeDisabled();
  await dialog.getByLabel('Lý do hủy (bắt buộc)').fill('Sân gặp sự cố điện');
  await dialog.getByRole('button', { name: 'Xác nhận hủy booking' }).click();
  await expect.poll(() => requested).toBe(true);
  await expect(dialog.getByRole('status')).toContainText('Hoàn tiền đang chờ xử lý');
  await expect(dialog.getByText('Đã hoàn tiền', { exact: false })).toHaveCount(0);
});

test('owner cannot cancel a tournament or a started booking', async ({ page }) => {
  await mockOwner(page, { ...booking, bookingKind: 'TOURNAMENT', tournamentId: 3, player: undefined });
  await page.goto('/owner/schedule?facilityId=1');
  await page.getByRole('button', { name: 'BK20' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Chủ sân không thể hủy trực tiếp', { exact: false })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Xác nhận hủy booking' })).toHaveCount(0);
});
