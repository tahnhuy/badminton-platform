import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
import type { BookingDetail, CourtAvailability } from '../src/features/booking/types/booking';
const date = '2026-12-01';
const summaryPath = `/bookings/new?courtId=1&date=${date}&startTime=18:00&durationMinutes=90&matchId=12`;
const availability: CourtAvailability = {
  date, durationMinutes: 90, court: { id: 1, name: 'Sân 01', description: null, status: 'ACTIVE' },
  facility: { id: 1, name: 'CLB Cầu Lông', address: '18 Đường Mẫu', ward: null, district: 'Quận 7', city: 'Hồ Chí Minh', phone: '0900000000' },
  openingTime: '06:00', closingTime: '22:00', intervals: [{ startTime: '17:00', endTime: '22:00', durationMinutes: 300, estimatedPrice: 150000,
    segments: [{ startTime: '17:00', endTime: '19:00', price: 80000 }, { startTime: '19:00', endTime: '22:00', price: 120000 }] }],
};
const booking = (status: BookingDetail['status'] = 'PENDING_PAYMENT'): BookingDetail => ({
  id: 9, bookingCode: 'BK-TEST-9', status, bookingDate: date, startTime: '18:00', endTime: '19:30', durationMinutes: 90,
  unitPrice: 80000, totalAmount: 140000, expiresAt: new Date(Date.now() + 600000).toISOString(), refundStatus: 'NONE',
  court: availability.court, facility: availability.facility, createdAt: new Date().toISOString(),
  pricingDetails: [{ startTime: '18:00', endTime: '19:00', price: 80000, amount: 80000 }, { startTime: '19:00', endTime: '19:30', price: 120000, amount: 60000 }], payment: null,
});
async function setup(page: Page, handlers: Record<string, (route: Route) => Promise<void> | void> = {}) {
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/courts/1/availability': route => route.fulfill({ json: { data: availability } }),
    '/api/v1/bookings/9': route => route.fulfill({ json: { data: booking() } }), ...handlers,
  } });
}
for (const width of [390, 1280]) test(`checkout ${width}: consent, split pricing, original hold payload and match redirect`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); let body: unknown;
  await setup(page, { '/api/v1/bookings': route => { body = route.request().postDataJSON(); return route.fulfill({ json: { data: booking() } }); } });
  await page.goto(summaryPath);
  const proceed = page.getByRole('button', { name: 'Tiến hành thanh toán (140.000đ)', exact: true });
  await expect(proceed).toBeDisabled(); await expect(page.getByRole('heading', { name: 'Chi tiết thanh toán' })).toBeVisible();
  await expect(page.getByText('80.000đ', { exact: true })).toBeVisible(); await expect(page.getByText('60.000đ', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chỉnh sửa khung giờ' })).toHaveAttribute('href', `/courts/1?date=${date}&matchId=12`);
  expect(body).toBeUndefined(); await page.getByRole('checkbox').check(); await proceed.click();
  await expect(page).toHaveURL('/bookings/9/pending?matchId=12');
  expect(body).toEqual({ courtId: 1, bookingDate: date, startTime: '18:00', durationMinutes: 90 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});
test('slot conflict stays on summary with the original actionable error', async ({ page }) => {
  await setup(page, { '/api/v1/bookings': route => route.fulfill({ status: 409, json: { error: { code: 'BOOKING_SLOT_UNAVAILABLE', message: 'Conflict' } } }) });
  await page.goto(summaryPath); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: /^Tiến hành thanh toán/ }).click();
  await expect(page.getByRole('alert')).toContainText('Khung giờ vừa được người khác đặt'); await expect(page).toHaveURL(summaryPath);
});
test('mock payment preserves failure/re-init/success payloads and redirect', async ({ page }) => {
  let attempts = 0; const confirms: unknown[] = []; let current = booking();
  await setup(page, {
    '/api/v1/bookings/9': route => route.fulfill({ json: { data: current } }),
    '/api/v1/bookings/9/payment': route => { attempts++; expect(route.request().postDataJSON()).toEqual({}); return route.fulfill({ json: { data: { paymentId: attempts, amount: '140000', isMock: true } } }); },
    '/api/v1/payments/mock/confirm': route => {
      const data = route.request().postDataJSON(); confirms.push(data);
      if (data.simulateFailure) return route.fulfill({ json: { data: { success: false, paymentStatus: 'FAILED', bookingStatus: 'PENDING_PAYMENT', message: 'Thử lại thanh toán.' } } });
      current = booking('CONFIRMED'); return route.fulfill({ json: { data: { success: true, paymentStatus: 'SUCCESS', bookingStatus: 'CONFIRMED' } } });
    },
  });
  await page.goto('/bookings/9/pending?matchId=12'); await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cổng thanh toán mô phỏng' }); await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Mô phỏng thanh toán thất bại' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Thử lại thanh toán.'); expect(attempts).toBe(2);
  await dialog.getByRole('button', { name: 'Xác nhận thanh toán thành công' }).click(); await expect(page).toHaveURL('/bookings/9');
  expect(confirms).toEqual([{ bookingId: 9, paymentId: 1, simulateFailure: true }, { bookingId: 9, paymentId: 2, simulateFailure: false }]);
});
test('payment dialog blocks closing during submission then supports Escape', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await setup(page, {
    '/api/v1/bookings/9/payment': route => route.fulfill({ json: { data: { paymentId: 1, amount: '140000', isMock: true } } }),
    '/api/v1/payments/mock/confirm': async route => { await gate; return route.fulfill({ status: 500, json: { error: { code: 'UNKNOWN', message: 'Chưa thanh toán.' } } }); },
  });
  await page.goto('/bookings/9/pending'); await page.getByRole('button', { name: 'Thanh toán ngay' }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Xác nhận thanh toán thành công' }).click();
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  release(); await expect(dialog.getByRole('alert')).toContainText('Chưa thanh toán.'); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
test('confirmed detail cancellation retains refund copy and refreshed state', async ({ page }) => {
  let current = booking('CONFIRMED'); let cancels = 0;
  await setup(page, {
    '/api/v1/bookings/9': route => route.fulfill({ json: { data: current } }),
    '/api/v1/bookings/9/cancel': route => { cancels++; current = { ...current, status: 'CANCELLED', refundStatus: 'REFUNDED' }; return route.fulfill({ json: { data: current } }); },
  });
  await page.goto('/bookings/9'); await page.getByRole('button', { name: 'Yêu cầu hủy đặt sân' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xác nhận hủy lịch đặt sân' }); await expect(dialog).toContainText('100%');
  await dialog.getByRole('button', { name: 'Giữ lịch' }).click(); expect(cancels).toBe(0);
  await page.getByRole('button', { name: 'Yêu cầu hủy đặt sân' }).click(); await dialog.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đơn đã được hủy' })).toBeVisible(); expect(cancels).toBe(1);
  await expect(page.getByText('Đã hoàn 140.000đ vào ví của bạn.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Yêu cầu hủy đặt sân' })).toHaveCount(0);
});
test('unavailable interval retains the old navigation action', async ({ page }) => {
  await setup(page, { '/api/v1/courts/1/availability': route => route.fulfill({ json: { data: { ...availability, intervals: [] } } }) });
  await page.goto(summaryPath); await expect(page.getByRole('heading', { name: 'Khung giờ không còn khả dụng' })).toBeVisible();
  await page.getByRole('button', { name: 'Chọn khung giờ khác' }).click(); await expect(page).toHaveURL(`/courts/1?date=${date}&matchId=12`);
});
