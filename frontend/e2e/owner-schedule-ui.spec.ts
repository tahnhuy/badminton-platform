import { expect, test, type Page } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { mockOwnerUi, ownedFacility, type OwnerHandler } from './owner-ui-mocks';
import type { OwnerBooking, Schedule } from '../src/features/court-owner/types/owner';
const booking: OwnerBooking = { id: 91, bookingCode: 'BK91', courtId: 21, bookingDate: '2030-01-01', startTime: '08:00:00', endTime: '09:00:00', status: 'CONFIRMED', totalAmount: 0, unitPrice: 0, bookingKind: 'PLAYER', refundStatus: 'PENDING', player: { fullName: 'Người đặt', email: 'player@example.test', phone: '0900000000' }, pricingDetails: [{ startTime: '08:00:00', endTime: '09:00:00', price: '0', amount: '0' }] };
const schedule: Schedule = { facilityId: 11, date: '2030-01-01', courts: [
  { courtId: 21, courtName: 'Sân 01', status: 'ACTIVE', slots: [
    { startTime: '06:00', endTime: '07:00', state: 'UNAVAILABLE', unavailableReasons: ['NO_PRICING', 'PAST'] },
    { startTime: '07:00', endTime: '08:00', state: 'FREE', pricePerHour: 0 },
    { startTime: '08:00', endTime: '09:00', state: 'BOOKED', bookingId: 91, bookingStatus: 'CONFIRMED', bookingKind: 'PLAYER', player: booking.player },
    { startTime: '09:00', endTime: '10:00', state: 'BLOCKED', blockId: 71, reason: 'Bảo trì đèn' },
    { startTime: '10:00', endTime: '11:00', state: 'BOOKED', bookingId: 92, bookingStatus: 'CONFIRMED', bookingKind: 'TOURNAMENT', player: { fullName: 'Tournament private player', email: 'private@example.test', phone: '0999999999' } },
  ] }, { courtId: 22, courtName: 'Sân 02', status: 'SUSPENDED', slots: [] },
] };
async function setup(page: Page, handlers: Record<string, OwnerHandler> = {}) {
  await mockOwnerUi(page, {
    '/api/v1/owner/facilities/11/schedule': route => route.fulfill({ json: { data: schedule } }),
    '/api/v1/owner/facilities/11/bookings': route => route.fulfill({ json: { data: [booking], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } }),
    '/api/v1/owner/bookings/91': route => route.fulfill({ json: { data: booking } }),
    '/api/v1/owner/bookings/92': route => route.fulfill({ json: { data: { ...booking, id: 92, bookingKind: 'TOURNAMENT', tournamentId: 3, player: schedule.courts[0].slots[4].player } } }),
    ...handlers,
  }, [ownedFacility(11)]);
  await page.goto('/owner/schedule?facilityId=11'); await expect(page.getByRole('heading', { name: 'Lịch sân theo ngày', exact: true })).toBeVisible();
}
const panel = (page: Page, title: string) => page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first();
for (const width of [390, 1280]) test(`schedule and booking detail fit at ${width}px and retain zero prices/contact`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await setup(page);
  const table = panel(page, 'Lịch sân theo ngày').getByRole('table');
  await expect(table.getByRole('row')).toHaveCount(6); await expect(table.getByRole('row').nth(1)).toContainText('06:00–07:00'); await expect(table.getByRole('row').nth(5)).toContainText('10:00–11:00');
  await expect(page.getByText('0 VNĐ/giờ', { exact: true })).toBeVisible(); await expect(page.getByText('Tournament private player', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.getByRole('button', { name: 'Xem booking', exact: true }).first().click(); const dialog = page.getByRole('dialog', { name: 'Chi tiết booking' });
  await expect(dialog.getByRole('heading', { name: 'BK91', exact: true })).toBeVisible(); await expect(dialog.getByText('0 VNĐ', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'player@example.test', exact: true })).toHaveAttribute('href', 'mailto:player@example.test'); await expect(dialog.getByRole('link', { name: '0900000000' })).toHaveAttribute('href', 'tel:0900000000');
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBeTruthy(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});

test('readonly booking drawer retains initial focus, Tab and backdrop behavior', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'BK91', exact: true }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog).toBeFocused(); await page.keyboard.press('Tab'); await expect(dialog.getByRole('button', { name: 'Đóng chi tiết', exact: true })).toBeFocused();
  await page.mouse.click(1, 1); await expect(dialog).toBeVisible(); await dialog.getByRole('button', { name: 'Đóng chi tiết', exact: true }).click(); await expect(dialog).toHaveCount(0);
});

test('Tournament detail does not reveal Player contact or add cancellation actions', async ({ page }) => {
  await setup(page); await page.getByRole('button', { name: 'Xem booking', exact: true }).nth(1).click(); const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Lịch sân của giải đấu #3'); await expect(dialog.getByText('Liên hệ người đặt')).toHaveCount(0); await expect(dialog.getByText('private@example.test')).toHaveCount(0);
  await expect(dialog.getByRole('button')).toHaveCount(1);
});

test('maintenance keeps its original payload and preserves the draft on court changes', async ({ page }) => {
  let body: unknown; let target = ''; await setup(page, { '/api/v1/owner/courts/22/block-slots': route => { body = route.request().postDataJSON(); target = new URL(route.request().url()).pathname; return route.fulfill({ json: { data: {} } }); } });
  const maintenance = panel(page, 'Khóa bảo trì'); await maintenance.getByLabel('Ngày bảo trì', { exact: true }).fill('2030-01-02'); await maintenance.getByLabel('Giờ bắt đầu bảo trì', { exact: true }).fill('08:00'); await maintenance.getByLabel('Giờ kết thúc bảo trì', { exact: true }).fill('09:00'); await maintenance.getByLabel('Lý do bảo trì', { exact: true }).fill('  Sửa đèn  ');
  await chooseSelectOption(maintenance.getByLabel('Chọn sân bảo trì', { exact: true }), '22'); await expect(maintenance.getByLabel('Lý do bảo trì', { exact: true })).toHaveValue('  Sửa đèn  ');
  await maintenance.getByRole('button', { name: 'Khóa khoảng giờ', exact: true }).click(); await expect(maintenance.getByRole('status')).toContainText('Đã lưu thay đổi.');
  expect(target).toBe('/api/v1/owner/courts/22/block-slots'); expect(body).toEqual({ bookingDate: '2030-01-02', startTime: '08:00', endTime: '09:00', reason: 'Sửa đèn' });
});

test('changing the schedule date resets maintenance fields but ignores an empty date', async ({ page }) => {
  const dates: string[] = []; await setup(page, { '/api/v1/owner/facilities/11/schedule': route => { dates.push(new URL(route.request().url()).searchParams.get('date')!); return route.fulfill({ json: { data: schedule } }); } });
  const maintenance = panel(page, 'Khóa bảo trì'); await maintenance.getByLabel('Lý do bảo trì', { exact: true }).fill('Nháp cũ'); await page.getByLabel('Ngày xem lịch', { exact: true }).fill('2030-01-02');
  await expect(maintenance.getByLabel('Ngày bảo trì', { exact: true })).toHaveValue('2030-01-02'); await expect(maintenance.getByLabel('Lý do bảo trì', { exact: true })).toHaveValue('');
  await page.getByLabel('Ngày xem lịch', { exact: true }).fill(''); await expect(page.getByLabel('Ngày xem lịch', { exact: true })).toHaveValue('2030-01-02'); expect(dates).toContain('2030-01-02');
});

test('unblock submits the whole block ID and refreshes without regrouping other slots', async ({ page }) => {
  let unlocked = false; let body: unknown; await setup(page, {
    '/api/v1/owner/courts/21/unblock-slots': route => { body = route.request().postDataJSON(); unlocked = true; return route.fulfill({ json: { data: {} } }); },
    '/api/v1/owner/facilities/11/schedule': route => route.fulfill({ json: { data: { ...schedule, courts: schedule.courts.map(court => ({ ...court, slots: court.slots.filter(slot => !unlocked || slot.blockId !== 71) })) } } }),
  });
  await page.getByRole('button', { name: 'Mở khóa khoảng giờ', exact: true }).click(); await expect(page.getByText('Bảo trì đèn', { exact: true })).toHaveCount(0); expect(body).toEqual({ blockId: 71 });
  await expect(panel(page, 'Lịch sân theo ngày').getByRole('row')).toHaveCount(5);
});

test('maintenance overlap keeps input and blocks controls while the command is pending', async ({ page }) => {
  let calls = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); await setup(page, { '/api/v1/owner/courts/21/block-slots': async route => { calls++; await gate; return route.fulfill({ status: 409, json: { error: { code: 'SLOT_BLOCK_OVERLAP_ACTIVE_BOOKING', message: 'conflict' } } }); } });
  const maintenance = panel(page, 'Khóa bảo trì'); await maintenance.getByLabel('Giờ bắt đầu bảo trì', { exact: true }).fill('08:00'); await maintenance.getByLabel('Giờ kết thúc bảo trì', { exact: true }).fill('09:00'); await maintenance.getByLabel('Lý do bảo trì', { exact: true }).fill('Sửa đèn'); await maintenance.getByRole('button', { name: 'Khóa khoảng giờ', exact: true }).click();
  await expect(maintenance.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled(); release(); await expect(maintenance.getByRole('alert')).toContainText('Khoảng này có booking còn hiệu lực.'); await expect(maintenance.getByLabel('Lý do bảo trì', { exact: true })).toHaveValue('Sửa đèn'); expect(calls).toBe(1);
});

test('history keeps ten-row pagination and filtering resets page one', async ({ page }) => {
  const queries: URLSearchParams[] = []; await setup(page, { '/api/v1/owner/facilities/11/bookings': route => { const query = new URL(route.request().url()).searchParams; queries.push(query); const p = Number(query.get('page')); return route.fulfill({ json: { data: [{ ...booking, bookingCode: `BK page ${p}` }], meta: { page: p, limit: 10, total: 11, totalPages: 2 } } }); } });
  const history = panel(page, 'Lịch sử booking'); await history.getByRole('button', { name: 'Sau', exact: true }).click(); await expect(history.getByRole('button', { name: 'BK page 2', exact: true })).toBeVisible(); await chooseSelectOption(history.getByLabel('Lọc trạng thái booking', { exact: true }), 'CANCELLED');
  await expect(history.getByRole('button', { name: 'BK page 1', exact: true })).toBeVisible(); expect(queries.at(-1)?.get('status')).toBe('CANCELLED'); expect(queries.at(-1)?.get('limit')).toBe('10');
});

test('polling failure preserves last schedule and retry restores the read', async ({ page }) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date()); let failed = false; await setup(page, { '/api/v1/owner/facilities/11/schedule': route => failed ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'unavailable' } } }) : route.fulfill({ json: { data: schedule } }) });
  failed = true; await page.clock.runFor(7500); await expect(page.getByRole('alert')).toContainText('Không thể tải dữ liệu.'); await expect(page.getByText('Bảo trì đèn', { exact: true })).toBeVisible();
  failed = false; await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByRole('alert')).toHaveCount(0);
});

test('missing facility keeps the existing setup message and no maintenance command', async ({ page }) => {
  await mockOwnerUi(page, {}, []); await page.goto('/owner/schedule'); await expect(page.getByText('Hãy tạo cơ sở và thêm sân trước.')).toBeVisible(); await expect(page.getByRole('button', { name: 'Khóa khoảng giờ', exact: true })).toHaveCount(0);
});

test('cancelling a booking refreshes history immediately before the polling timer', async ({ page }) => {
  let cancelled = false;
  let historyReads = 0;
  await setup(page, {
    '/api/v1/owner/facilities/11/bookings': route => { historyReads++; return route.fulfill({ json: { data: [{ ...booking, status: cancelled ? 'CANCELLED' : 'CONFIRMED' }], meta: { page: 1, limit: 10, total: 1, totalPages: 1 } } }); },
    '/api/v1/owner/bookings/91': route => route.fulfill({ json: { data: { ...booking, status: cancelled ? 'CANCELLED' : 'CONFIRMED' } } }),
    '/api/v1/owner/bookings/91/cancel': route => { cancelled = true; return route.fulfill({ json: { data: { refundStatus: 'PENDING' } } }); },
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.getByRole('button', { name: 'BK91', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết booking' });
  await dialog.getByLabel('Lý do hủy (bắt buộc)').fill('Sân gặp sự cố');
  const before = historyReads;
  await dialog.getByRole('button', { name: 'Xác nhận hủy booking' }).click();
  await expect.poll(() => historyReads, { timeout: 2000 }).toBeGreaterThan(before);
  await dialog.getByRole('button', { name: 'Đóng chi tiết', exact: true }).click();
  await expect(panel(page, 'Lịch sử booking').getByRole('row').filter({ hasText: 'BK91' })).toContainText('Đã hủy');
});
