import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  apiRequest,
  chooseSelectOption,
  loginApi,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  runJobs,
  seedCourt,
  topUpWallet,
  vnDate,
  walletBalance,
  type SeededCourt,
} from '../e2e-helpers';

/** Prices from the E2E seed court (`e2e-server.ts`): 06:00–17:00 = 80,000/h, 17:00–22:00 = 120,000/h. */
const MORNING_PRICE = 80_000;
const EVENING_PRICE = 120_000;

async function newPlayer(browser: Browser, email: string, fullName = 'Người Chơi Demo') {
  const context = await browser.newContext();
  const account = await registerAccount(context, { email, fullName });
  const page = await context.newPage();
  return { context, page, account };
}

async function createBooking(
  context: BrowserContext,
  court: SeededCourt,
  time: string,
  durationMinutes = 60,
  date = vnDate(1)
) {
  const response = await apiRequest<{ data: { id: number; bookingCode: string; totalAmount: number } }>(
    context,
    'POST',
    '/bookings',
    { courtId: court.courtId, bookingDate: date, startTime: time, durationMinutes }
  );
  return response.data;
}

function bookingIdFromUrl(page: Page): number {
  const match = /\/bookings\/(\d+)$/.exec(new URL(page.url()).pathname);
  if (!match) throw new Error(`Unexpected booking URL: ${page.url()}`);
  return Number(match[1]);
}

async function notificationTypes(context: BrowserContext): Promise<string[]> {
  const response = await apiRequest<{ data: Array<{ type: string }> }>(context, 'GET', '/notifications?limit=50');
  return response.data.map((row) => row.type);
}

test.describe('Demo: wallet + booking + notifications', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('top-up, search → hold → wallet payment confirms and credits the owner', async ({ browser }) => {
    test.setTimeout(180_000);
    const court = await seedCourt();
    const { context, page } = await newPlayer(browser, 'demo_wallet_booking@example.com');

    // Flow 3: top up through the E2E-supported deterministic Mock provider, then read the
    // balance/history from the real wallet UI.
    await topUpWallet(context, 500_000);
    await page.goto('/wallet');
    await expect(page.getByRole('region', { name: 'Số dư ví' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Số dư ví' })).toContainText(/500\.000/);

    await page.getByRole('button', { name: 'Lịch sử giao dịch', exact: true }).click();
    await expect(page.getByText('Nạp ví', { exact: true }).first()).toBeVisible();

    // Flow 4: real court search → slot hold → checkout → wallet payment.
    await page.goto('/courts');
    await expect(page.getByRole('article', { name: 'E2E Badminton Club' })).toBeVisible();

    await page.goto(`/courts/${court.courtId}?date=${vnDate(1)}`);
    await page.getByLabel('Giờ bắt đầu').fill('06:00');
    await chooseSelectOption(page.getByRole('combobox', { name: 'Thời lượng' }), '60');
    await page.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true }).click();
    await expect(page.getByText('Xác nhận thông tin & Thanh toán', { exact: true })).toBeVisible();
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: /Tiến hành thanh toán/ }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+\/pending/);
    await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
    await expect(page).toHaveURL(/\/bookings\/\d+$/);
    await expect(page.getByText('Đã xác nhận', { exact: true })).toBeVisible();
    const bookingId = bookingIdFromUrl(page);

    // Exact wallet math from the seed pricing table.
    expect(await walletBalance(context)).toBe(500_000 - MORNING_PRICE);
    const detail = await apiRequest<{ data: { totalAmount: number; status: string } }>(context, 'GET', `/bookings/${bookingId}`);
    expect(detail.data.totalAmount).toBe(MORNING_PRICE);
    expect(detail.data.status).toBe('CONFIRMED');

    // Revenue is credited to the owner wallet.
    const ownerContext = await browser.newContext();
    await loginApi(ownerContext, court.ownerEmail, court.ownerPassword);
    expect(await walletBalance(ownerContext)).toBe(MORNING_PRICE);

    // Notifications at the booking steps (flow 9).
    expect(await notificationTypes(context)).toEqual(expect.arrayContaining(['BOOKING_CONFIRMED']));
    const ownerTypes = await notificationTypes(ownerContext);
    expect(ownerTypes).toEqual(expect.arrayContaining(['OWNER_BOOKING_CREATED', 'OWNER_EARNING_CREDITED']));

    await page.goto('/wallet');
    await page.getByRole('button', { name: 'Lịch sử giao dịch', exact: true }).click();
    await expect(page.getByText('Thanh toán', { exact: true }).first()).toBeVisible();
    await ownerContext.close();
    await context.close();
  });

  test('insufficient wallet shows the top-up action and never charges', async ({ browser }) => {
    const court = await seedCourt();
    const { context, page } = await newPlayer(browser, 'demo_pay_empty@example.com');
    const booking = await createBooking(context, court, '06:00');

    await page.goto(`/bookings/${booking.id}/pending`);
    await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('Số dư ví không đủ');
    await expect(page.getByRole('link', { name: 'Nạp tiền vào ví' })).toHaveAttribute('href', '/wallet');

    expect(await walletBalance(context)).toBe(0);
    const detail = await apiRequest<{ data: { status: string } }>(context, 'GET', `/bookings/${booking.id}`);
    expect(detail.data.status).toBe('PENDING_PAYMENT');
    await context.close();
  });

  test('player cancellation refunds the wallet after the refund worker runs', async ({ browser }) => {
    const court = await seedCourt();
    const { context, page } = await newPlayer(browser, 'demo_cancel_refund@example.com');
    await topUpWallet(context, 500_000);
    const booking = await createBooking(context, court, '06:00');
    await apiRequest(context, 'POST', `/bookings/${booking.id}/payment`, { provider: 'WALLET' });
    expect(await walletBalance(context)).toBe(420_000);

    await page.goto(`/bookings/${booking.id}`);
    await page.getByRole('button', { name: 'Yêu cầu hủy đặt sân', exact: true }).click();
    await page.getByRole('button', { name: 'Xác nhận hủy', exact: true }).click();
    await expect(page.getByText('Đơn đã được hủy', { exact: true })).toBeVisible();

    await runJobs(context);
    const detail = await apiRequest<{ data: { status: string; refundStatus: string } }>(context, 'GET', `/bookings/${booking.id}`);
    expect(detail.data.status).toBe('CANCELLED');
    expect(detail.data.refundStatus).toBe('REFUNDED');
    expect(await walletBalance(context)).toBe(500_000);
    expect(await notificationTypes(context)).toEqual(
      expect.arrayContaining(['BOOKING_CANCELLED', 'BOOKING_REFUNDED'])
    );

    await page.reload();
    await expect(page.getByText('Đã hoàn tiền', { exact: false }).first()).toBeVisible();
    await context.close();
  });

  test('owner locks a slot and incident cancellation refunds the player and reverses revenue', async ({ browser }) => {
    test.setTimeout(180_000);
    const court = await seedCourt();
    const { context } = await newPlayer(browser, 'demo_owner_cancel@example.com');
    await topUpWallet(context, 500_000);
    const booking = await createBooking(context, court, '19:00');
    await apiRequest(context, 'POST', `/bookings/${booking.id}/payment`, { provider: 'WALLET' });
    expect(await walletBalance(context)).toBe(500_000 - EVENING_PRICE);

    const ownerContext = await browser.newContext();
    await loginApi(ownerContext, court.ownerEmail, court.ownerPassword);
    expect(await walletBalance(ownerContext)).toBe(EVENING_PRICE);

    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto(`/owner/schedule?facilityId=${court.facilityId}&tab=history`);
    await ownerPage.getByLabel('Ngày xem lịch').fill(vnDate(1));

    // Lock 12:00–13:00 for maintenance, then confirm the public availability excludes it.
    await ownerPage.getByRole('button', { name: 'Khóa bảo trì', exact: true }).click();
    const maintenance = ownerPage.getByRole('dialog', { name: 'Khóa bảo trì' });
    await maintenance.getByLabel('Ngày bảo trì').fill(vnDate(1));
    await maintenance.getByLabel('Giờ bắt đầu bảo trì').fill('12:00');
    await maintenance.getByLabel('Giờ kết thúc bảo trì').fill('13:00');
    await maintenance.getByLabel('Lý do bảo trì').fill('Sửa lưới E2E');
    await maintenance.getByRole('button', { name: 'Khóa khoảng giờ', exact: true }).click();
    await expect(maintenance.getByRole('status')).toContainText('Đã lưu thay đổi.');
    await ownerPage.keyboard.press('Escape');
    await ownerPage.getByRole('tab', { name: 'Danh sách khoảng giờ', exact: true }).click();
    await expect(ownerPage.getByRole('button', { name: 'Mở khóa khoảng giờ', exact: true }).first()).toBeVisible();

    const availability = await apiRequest<{
      data: { intervals: Array<{ startTime: string; endTime: string }> };
    }>(context, 'GET', `/courts/${court.courtId}/availability?date=${vnDate(1)}`);
    expect(
      availability.data.intervals.some((row) => row.startTime <= '12:00' && row.endTime >= '13:00')
    ).toBe(false);

    // Owner incident cancellation → refund on the next worker run.
    await ownerPage.getByRole('tab', { name: 'Lịch sử booking', exact: true }).click();
    await ownerPage.getByRole('button', { name: booking.bookingCode, exact: true }).click();
    const dialog = ownerPage.getByRole('dialog');
    await dialog.getByLabel('Lý do hủy (bắt buộc)').fill('Sự cố điện tại sân');
    await dialog.getByRole('button', { name: 'Xác nhận hủy booking' }).click();
    await expect(dialog.getByRole('status')).toContainText('Hoàn tiền đang chờ xử lý');

    await runJobs(context);
    const detail = await apiRequest<{ data: { status: string; refundStatus: string } }>(context, 'GET', `/bookings/${booking.id}`);
    expect(detail.data.status).toBe('CANCELLED');
    expect(detail.data.refundStatus).toBe('REFUNDED');
    expect(await walletBalance(context)).toBe(500_000);
    expect(await walletBalance(ownerContext)).toBe(0);
    expect(await notificationTypes(context)).toEqual(
      expect.arrayContaining(['BOOKING_CANCELLED', 'BOOKING_REFUNDED'])
    );
    expect(await notificationTypes(ownerContext)).toEqual(
      expect.arrayContaining(['OWNER_EARNING_REVERSED'])
    );

    await context.close();
    await ownerContext.close();
  });
});
