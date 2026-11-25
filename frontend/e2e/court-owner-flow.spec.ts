import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { resetDatabase, createE2EUser, chooseSelectOption } from './e2e-helpers';
import { answerSurvey, completeRegistrationOtp, EXAMPLE_2_ANSWERS, fillAccount, nextButton } from './register-ui-fixtures';

async function login(page: Page, email: string, password: string) {
  await page.goto('/sign-in');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
}
async function write(context: BrowserContext, path: string, body: unknown) {
  const csrf = (await context.cookies()).find(cookie => cookie.name === 'csrf_token')?.value;
  return context.request.post(`http://localhost:5173/api/v1${path}`, { data: body, headers: { 'X-CSRF-Token': csrf ?? '' } });
}
const tomorrow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 86400000));

test('Owner setup, Admin review/resubmit, pricing snapshots, calendar locks and private Player phone', async ({ browser, page }) => {
  test.setTimeout(150000);
  await resetDatabase();
  const owner = await createE2EUser({ email: 'court_owner_e2e@example.com', role: 'COURT_OWNER' });
  const admin = await createE2EUser({ email: 'court_admin_e2e@example.com', role: 'ADMIN' });
  await login(page, owner.email, owner.plainPassword);
  await page.goto('/owner');
  await expect(page.getByText('Bạn chưa có cơ sở.', { exact: false }).first()).toBeVisible();
  await page.getByLabel('Tên cơ sở', { exact: true }).fill('Owner E2E Club');
  await page.getByLabel('Điện thoại cơ sở').fill('0900000000');
  await page.getByLabel('Giờ mở cửa').fill('06:00');
  await page.getByLabel('Giờ đóng cửa').fill('23:00');
  await page.getByLabel('Địa chỉ', { exact: true }).fill('1 E2E Street');
  await page.getByLabel('Quận/huyện', { exact: true }).fill('D1');
  await page.getByLabel('Tỉnh/thành phố', { exact: true }).fill('HCM');
  const facilityResponse = page.waitForResponse(response => response.url().endsWith('/api/v1/owner/facilities') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi cơ sở để duyệt', exact: true }).click();
  const facilityId = (await (await facilityResponse).json()).data.id;
  await page.goto(`/owner/facilities?facilityId=${facilityId}`);
  await expect(page.getByText('Chờ duyệt', { exact: true }).first()).toBeVisible();

  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await login(adminPage, admin.email, admin.plainPassword);
  await adminPage.goto(`/admin/courts/${facilityId}/reviews`);
  await adminPage.getByLabel('Lý do từ chối (bắt buộc khi từ chối)').fill('Bổ sung mô tả cơ sở');
  await adminPage.getByRole('button', { name: 'Từ chối hồ sơ', exact: true }).click();
  await expect(adminPage.getByText('Lý do từ chối: Bổ sung mô tả cơ sở')).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới cơ sở' }).click();
  await expect(page.getByLabel('Mô tả', { exact: true })).toBeEnabled();
  await page.getByLabel('Mô tả', { exact: true }).fill('Mô tả đã bổ sung');
  await page.getByRole('button', { name: 'Lưu thông tin cơ sở' }).click();
  await expect(page.getByText('Đã lưu thay đổi.').first()).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lại hồ sơ cơ sở' }).click();
  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Làm mới cơ sở' }).click();
  await expect(page.getByText('Đang hoạt động', { exact: true }).first()).toBeVisible();
  await page.getByLabel('Tên sân', { exact: true }).fill('Sân E2E 01');
  const courtResponse = page.waitForResponse(response => response.url().endsWith(`/facilities/${facilityId}/courts`) && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Gửi sân để duyệt', exact: true }).click();
  const courtId = (await (await courtResponse).json()).data.id;
  await adminPage.reload();
  await adminPage.getByRole('button', { name: 'Xem hồ sơ sân Sân E2E 01', exact: true }).click();
  await adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }).click();
  await expect(adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true })).toHaveCount(0);

  await page.goto(`/owner/pricing?facilityId=${facilityId}`);
  await page.getByLabel('Giờ bắt đầu', { exact: true }).fill('06:00');
  await page.getByLabel('Giờ kết thúc', { exact: true }).fill('22:00');
  await page.getByLabel('Giá mỗi giờ (VNĐ)').fill('100000');
  await page.getByLabel('Ngày bắt đầu hiệu lực').fill('2026-01-01');
  await page.getByRole('button', { name: 'Lưu khung giá' }).click();
  await expect(page.getByRole('button', { name: 'Sửa khung giá' })).toBeVisible();

  const playerContext = await browser.newContext();
  const playerPage = await playerContext.newPage();
  // Survey-first registration (AUTH-31) through the real API: PRD example #2 → AVERAGE_MINUS with G1 on R.
  await playerPage.goto('/register');
  await answerSurvey(playerPage, EXAMPLE_2_ANSWERS);
  await fillAccount(playerPage, { email: 'owner_contact_player@example.com', fullName: 'Player Contact E2E', phone: '0901 234 567' });
  await nextButton(playerPage).click();
  await expect(playerPage).toHaveURL('/register/verify');
  await completeRegistrationOtp(playerPage, 'owner_contact_player@example.com');
  await expect(playerPage).toHaveURL('/register/result');
  const badge = playerPage.getByLabel('Huy hiệu trình độ');
  await expect(badge.getByText(/^Trung bình yếu\.?$/)).toBeVisible();
  await expect(playerPage.getByText('Bạn được xếp ở bậc này vì Độ ổn định giữ cầu đang là điểm yếu nhất.')).toBeVisible();
  await playerPage.reload(); // reads GET /players/me/skill-survey
  await expect(badge.getByText(/^Trung bình yếu\.?$/)).toBeVisible();
  await expect(playerPage.getByText('Bạn được xếp ở bậc này vì Độ ổn định giữ cầu đang là điểm yếu nhất.')).toBeVisible();
  await playerPage.goto('/profile/contact');
  await expect(playerPage.getByLabel('Số điện thoại (tùy chọn)')).toHaveValue('0901234567');
  await playerPage.getByLabel('Số điện thoại (tùy chọn)').fill('0907 654 321');
  await playerPage.getByRole('button', { name: 'Lưu số điện thoại', exact: true }).click();
  await expect(playerPage.getByText('Đã lưu số điện thoại.')).toBeVisible();
  const bookingResponse = await write(playerContext, '/bookings', { courtId, bookingDate: tomorrow(), startTime: '10:00', durationMinutes: 60 });
  expect(bookingResponse.ok()).toBeTruthy();
  const booking = (await bookingResponse.json()).data;

  await page.getByRole('button', { name: 'Sửa khung giá', exact: true }).click();
  await page.getByLabel('Giá mỗi giờ (VNĐ)').fill('200000');
  await page.getByRole('button', { name: 'Lưu khung giá', exact: true }).click();
  await expect(page.getByText('200.000', { exact: true })).toBeVisible();
  await page.goto(`/owner/schedule?facilityId=${facilityId}`);
  await page.getByLabel('Ngày xem lịch', { exact: true }).fill(tomorrow());
  await page.getByRole('button', { name: booking.bookingCode, exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('0907654321', { exact: true })).toBeVisible();
  await expect(dialog.getByText('100.000 VNĐ', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đóng chi tiết' }).click();
  await page.getByLabel('Giờ bắt đầu bảo trì', { exact: true }).fill('12:00');
  await page.getByLabel('Giờ kết thúc bảo trì', { exact: true }).fill('13:00');
  await page.getByLabel('Lý do bảo trì', { exact: true }).fill('Sửa lưới E2E');
  await page.getByRole('button', { name: 'Khóa khoảng giờ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở khóa khoảng giờ', exact: true })).toBeVisible();
  const availability = await playerContext.request.get(`http://localhost:5173/api/v1/courts/${courtId}/availability?date=${tomorrow()}`);
  expect(availability.ok()).toBeTruthy();
  const data = (await availability.json()).data;
  expect(data.intervals.some((row: { startTime: string; endTime: string }) => row.startTime <= '12:00' && row.endTime >= '13:00')).toBe(false);
  await page.getByLabel('Lý do bảo trì', { exact: true }).fill('Nội dung đang soạn');
  await page.waitForTimeout(8000); // crosses one real polling tick
  await expect(page.getByLabel('Lý do bảo trì', { exact: true })).toHaveValue('Nội dung đang soạn');
  await page.screenshot({ path: '/tmp/court-owner-calendar.png', fullPage: true });
  await page.getByRole('button', { name: 'Mở khóa khoảng giờ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở khóa khoảng giờ', exact: true })).toHaveCount(0);
  await playerPage.getByLabel('Số điện thoại (tùy chọn)').fill('');
  const cleared = playerPage.waitForResponse(response => response.url().endsWith('/players/me/contact') && response.request().method() === 'PATCH');
  await playerPage.getByRole('button', { name: 'Lưu số điện thoại', exact: true }).click();
  expect((await cleared).ok()).toBeTruthy();
  await expect(playerPage.getByLabel('Số điện thoại (tùy chọn)')).toHaveValue('');
  await page.getByRole('button', { name: booking.bookingCode, exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Chưa cung cấp số điện thoại')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng chi tiết' }).click();
  const secondFacility = await write(page.context(), '/owner/facilities', { name: 'Owner E2E Second Club', phone: '0900000000', address: '2 E2E Street', district: 'D2', city: 'HCM', openingTime: '06:00', closingTime: '23:00' });
  const secondId = (await secondFacility.json()).data.id;
  await page.goto(`/owner/facilities?facilityId=${facilityId}`);
  await page.getByRole('button', { name: 'Làm mới cơ sở' }).click();
  await page.getByRole('combobox', { name: 'Chọn cơ sở', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Owner E2E Second Club', exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await page.goto(`/owner/schedule?facilityId=${facilityId}`);
  await page.getByRole('button', { name: booking.bookingCode, exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await chooseSelectOption(page.getByRole('combobox', { name: 'Chọn cơ sở', exact: true }), String(secondId));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Cơ sở chưa có sân.', { exact: false })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/owner/facilities?facilityId=${secondId}`);
  await expect(page.getByRole('heading', { name: 'Owner E2E Second Club', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await adminContext.close(); await playerContext.close();
});

test('Owner initial loading failure offers retry without a false empty workspace', async ({ page }) => {
  const owner = await createE2EUser({ email: 'court_owner_retry@example.com', role: 'COURT_OWNER' });
  await login(page, owner.email, owner.plainPassword);
  await page.route('**/api/v1/owner/facilities?*', route => route.abort());
  await page.goto('/owner');
  await expect(page.getByRole('alert')).toContainText('Không thể tải danh sách cơ sở');
  await expect(page.getByText('Bạn chưa có cơ sở.', { exact: false })).toHaveCount(0);
  await page.unroute('**/api/v1/owner/facilities?*');
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByLabel('Tên cơ sở', { exact: true })).toBeVisible();
});
