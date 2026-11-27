import { expect, test } from '@playwright/test';
import { mockOwnerUi, ownedFacility } from './owner-ui-mocks';
import type { NotificationItem } from '../src/features/notifications/types';
import type { OwnerBooking, Schedule } from '../src/features/court-owner/types/owner';

const notification: NotificationItem = {
  id: 1,
  type: 'OWNER_BOOKING_CREATED',
  title: 'Có booking mới',
  content: 'Booking OWN-501 tại Sân 1 ngày 2026-12-01 18:00–19:00, 100.000đ đã được xác nhận.',
  resourceType: 'OWNER_BOOKING',
  resourceId: 501,
  isRead: false,
  readAt: null,
  createdAt: '2026-11-23T10:00:00Z',
};

const booking: OwnerBooking = {
  id: 501,
  bookingCode: 'OWN-501',
  facilityId: 11,
  courtId: 21,
  bookingDate: '2026-12-01',
  startTime: '18:00:00',
  endTime: '19:00:00',
  status: 'CONFIRMED',
  totalAmount: 100000,
  unitPrice: 100000,
  bookingKind: 'PLAYER',
  refundStatus: 'NONE',
  player: { fullName: 'Người chơi', email: 'player@example.test', phone: null },
  pricingDetails: [],
};

const schedule: Schedule = {
  facilityId: 11,
  date: '2026-12-01',
  courts: [{
    courtId: 21,
    courtName: 'Sân 1',
    status: 'ACTIVE',
    slots: [{ startTime: '18:00', endTime: '19:00', state: 'BOOKED', bookingId: 501, bookingStatus: 'CONFIRMED', bookingKind: 'PLAYER' }],
  }],
};

function notificationHandlers(state: { reads: number }) {
  const list = () => ({ data: [notification], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } });
  return {
    '/api/v1/notifications': (route: any) => route.fulfill({ json: list() }),
    '/api/v1/notifications/1': (route: any) => route.fulfill({ json: { data: { ...notification, resourcePath: '/owner/wallet' } } }),
    '/api/v1/notifications/1/read': (route: any) => {
      state.reads += 1;
      return route.fulfill({ json: { data: { ...notification, isRead: true, readAt: '2026-11-23T10:01:00Z' } } });
    },
  };
}

for (const width of [390, 1280]) test(`Owner bell shows unread notifications and opens the inbox at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const state = { reads: 0 };
  await mockOwnerUi(page, {
    ...notificationHandlers(state),
    '/api/v1/notifications': (route: any) => {
      const unread = new URL(route.request().url()).searchParams.get('isRead') === 'false';
      return route.fulfill({ json: { data: [notification], meta: { page: 1, limit: unread ? 1 : 5, total: 1, totalPages: 1 } } });
    },
  });
  await page.goto('/owner/account?facilityId=11');
  await expect(page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' })).toBeVisible();
  await page.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }).click();
  await expect(page.getByText('Có booking mới')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute('href', '/owner/notifications');
  await page.getByText('Có booking mới').click();
  await expect(page).toHaveURL('/owner/notifications/1');
  await expect(page.getByRole('heading', { name: 'Có booking mới' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem chi tiết' })).toHaveAttribute('href', '/owner/wallet');
  await expect.poll(() => state.reads).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('Owner booking notification deep link opens the matching booking and clears the query on close', async ({ page }) => {
  await mockOwnerUi(page, {
    '/api/v1/owner/facilities/11/schedule': (route: any) => route.fulfill({ json: { data: { ...schedule, date: new URL(route.request().url()).searchParams.get('date') ?? schedule.date } } }),
    '/api/v1/owner/bookings/501': (route: any) => route.fulfill({ json: { data: booking } }),
    '/api/v1/notifications': (route: any) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 1 } } }),
  });
  await page.goto('/owner/schedule?facilityId=11&bookingId=501&date=2026-12-01');
  await expect(page.getByRole('heading', { name: 'Chi tiết booking' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'OWN-501', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng chi tiết' }).click();
  await expect(page).toHaveURL('/owner/schedule?facilityId=11');
  await expect(page.getByRole('heading', { name: 'Chi tiết booking' })).toHaveCount(0);
});

test('Owner booking deep link with a mismatched date is not opened', async ({ page }) => {
  await mockOwnerUi(page, {
    '/api/v1/owner/facilities/11/schedule': (route: any) => route.fulfill({ json: { data: { ...schedule, date: new URL(route.request().url()).searchParams.get('date') ?? schedule.date } } }),
    '/api/v1/owner/bookings/501': (route: any) => route.fulfill({ json: { data: booking } }),
    '/api/v1/notifications': (route: any) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 1 } } }),
  });
  await page.goto('/owner/schedule?facilityId=11&bookingId=501&date=2026-12-02');
  await expect(page.getByRole('alert')).toContainText('Không thể mở booking từ liên kết này.');
  await expect(page.getByRole('heading', { name: 'Chi tiết booking' })).toHaveCount(0);
});

test('Owner court notification deep link opens the court editor', async ({ page }) => {
  const facility = { ...ownedFacility(11), courts: [{ id: 21, name: 'Sân 1', description: 'Sân tiêu chuẩn', status: 'ACTIVE' }] };
  await mockOwnerUi(page, {
    '/api/v1/owner/facilities/11': (route: any) => route.fulfill({ json: { data: facility } }),
    '/api/v1/owner/courts/21/reviews': (route: any) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } } }),
    '/api/v1/notifications': (route: any) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 1 } } }),
  }, [facility]);
  await page.goto('/owner/facilities?facilityId=11&courtId=21');
  await expect(page.getByRole('heading', { name: 'Sửa sân: Sân 1' })).toBeVisible();
  await expect(page.locator('[role="tab"]', { hasText: /^Sân/ })).toHaveAttribute('data-state', 'active');
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL('/owner/facilities?facilityId=11&tab=courts');
  await expect(page.getByRole('heading', { name: 'Sửa sân: Sân 1' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thêm sân', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thêm sân mới' })).toBeVisible();
});
