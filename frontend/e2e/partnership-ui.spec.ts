import { expect, test, type Page, type Route } from '@playwright/test';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';
import { SKILL_LEVELS } from './register-ui-fixtures';
import type { OwnerRequest, OwnerRequestStatus } from '../src/features/partnership/partnership-api';

/** UI contract tests for the Court Owner partnership request (OPR-05, OPR-06; mocked API, no backend). */

const SUBMIT = '/api/v1/owner-requests';
const AVAILABILITY = '/api/v1/owner-requests/availability';

async function openForm(page: Page, options: { enabled?: boolean; submit?: (route: Route) => Promise<void> | void; signedIn?: boolean } = {}) {
  const bodies: unknown[] = [];
  await mockAuthApi(page, { user: options.signedIn ? account('PLAYER') : null, handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: SKILL_LEVELS } }),
    [AVAILABILITY]: route => route.fulfill({ json: { data: { enabled: options.enabled ?? true } } }),
    [SUBMIT]: route => {
      bodies.push(route.request().postDataJSON());
      return options.submit ? options.submit(route) : route.fulfill({ status: 202, json: { data: { received: true } } });
    },
  } });
  return bodies;
}

async function fillForm(page: Page) {
  await page.getByLabel('Họ và tên *').fill('Nguyễn Văn A');
  await page.getByLabel('Email *').fill('Owner@Example.com');
  await page.getByLabel('Số điện thoại *').fill('+84 901 234 567');
  await page.getByLabel('Tên cơ sở *').fill('Sân cầu lông Phú Nhuận');
  await page.getByLabel('Địa chỉ (số nhà, đường) *').fill('12 Phan Xích Long');
  await page.getByLabel('Quận/huyện *').fill('Phú Nhuận');
  await page.getByLabel('Tỉnh/thành phố *').fill('TP. Hồ Chí Minh');
  await page.getByLabel('Số sân dự kiến *').fill('6');
  await page.getByLabel('Ghi chú').fill('Có 6 sân thảm');
  await page.getByLabel(/Tôi đồng ý để SmashPro liên hệ/).check();
}
const send = (page: Page) => page.getByRole('button', { name: 'Gửi yêu cầu', exact: true }).click();

test('a visitor reaches /hop-tac from the landing band and sends a request', async ({ page }) => {
  const bodies = await openForm(page);
  await page.goto('/');
  await page.locator('[data-slot="owner-contact"]').click();
  await expect(page).toHaveURL('/hop-tac');
  await expect(page.getByRole('heading', { level: 1, name: 'Đưa sân của bạn lên SmashPro' })).toBeVisible();
  await fillForm(page);
  await send(page);
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu' })).toBeVisible();
  expect(bodies).toEqual([{
    contactName: 'Nguyễn Văn A', email: 'owner@example.com', phone: '0901234567', facilityName: 'Sân cầu lông Phú Nhuận',
    addressLine: '12 Phan Xích Long', district: 'Phú Nhuận', city: 'TP. Hồ Chí Minh', expectedCourts: 6, note: 'Có 6 sân thảm',
    consent: true, website: '',
  }]);
});

test('the landing footer and the sign-in page link to /hop-tac', async ({ page }) => {
  await openForm(page);
  await page.goto('/');
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'Hợp tác chủ sân' })).toHaveAttribute('href', '/hop-tac');
  await page.goto('/sign-in');
  await page.getByRole('link', { name: 'Gửi yêu cầu hợp tác' }).click();
  await expect(page).toHaveURL('/hop-tac');
});

test('required fields and consent are checked before sending', async ({ page }) => {
  const bodies = await openForm(page);
  await page.goto('/hop-tac');
  await send(page);
  await expect(page.getByText('Vui lòng nhập họ tên.')).toBeVisible();
  await expect(page.getByText('Vui lòng đồng ý để SmashPro liên hệ.')).toBeVisible();
  await page.getByLabel('Số điện thoại *').fill('12345');
  await send(page);
  await expect(page.getByText('Số điện thoại Việt Nam chưa đúng, ví dụ 0901234567.')).toBeVisible();
  expect(bodies).toHaveLength(0);
});

test('an email that already has an account is told so with the alias hint', async ({ page }) => {
  await openForm(page, { submit: route => route.fulfill({ status: 409, json: errorBody('OWNER_REQUEST_EMAIL_HAS_ACCOUNT', [{ field: 'email' }]) }) });
  await page.goto('/hop-tac');
  await fillForm(page);
  await send(page);
  await expect(page.getByText(/Email này đã có tài khoản SmashPro.*ten\+chusan@gmail\.com/)).toBeVisible();
  await expect(page.getByLabel('Email *')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu' })).toHaveCount(0);
});

test('a rate-limited submit shows the retry message', async ({ page }) => {
  await openForm(page, { submit: route => route.fulfill({ status: 429, json: errorBody('AUTH_RATE_LIMITED') }) });
  await page.goto('/hop-tac');
  await fillForm(page);
  await send(page);
  await expect(page.getByRole('alert')).toHaveText('Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau.');
});

test('the switched-off form shows the paused state', async ({ page }) => {
  await openForm(page, { enabled: false });
  await page.goto('/hop-tac');
  await expect(page.getByText('Hiện SmashPro tạm ngừng nhận yêu cầu hợp tác.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu', exact: true })).toHaveCount(0);
});

test('a signed-in user can open /hop-tac and sees the separate-email note', async ({ page }) => {
  await openForm(page, { signedIn: true });
  await page.goto('/hop-tac');
  await expect(page).toHaveURL('/hop-tac');
  await expect(page.getByText('Tài khoản chủ sân dùng email riêng, tách khỏi tài khoản hiện tại của bạn.')).toBeVisible();
});

test('the account-created email link pre-fills Forgot password', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/forgot-password?email=owner%2Bchusan%40example.com');
  await expect(page.getByLabel('Email')).toHaveValue('owner+chusan@example.com');
});

// ---- Admin queue ----

const request = (overrides: Partial<OwnerRequest> = {}): OwnerRequest => ({
  id: 7, contactName: 'Nguyễn Văn A', email: 'owner@example.com', phone: '0901234567', facilityName: 'Sân Phú Nhuận',
  addressLine: '12 Phan Xích Long', district: 'Phú Nhuận', city: 'TP. Hồ Chí Minh', expectedCourts: 6, note: 'Có 6 sân thảm',
  status: 'PENDING', adminNote: null, rejectReason: null, processedAt: null, processedBy: null, createdUser: null,
  submittedIp: '203.0.113.5', createdAt: '2026-11-27T09:00:00+07:00', updatedAt: '2026-11-27T09:00:00+07:00', ...overrides,
});

interface AdminLog { list: URLSearchParams[]; approve: unknown[]; reject: unknown[] }

async function openQueue(page: Page, options: { approve?: (route: Route) => Promise<void> | void } = {}) {
  const log: AdminLog = { list: [], approve: [], reject: [] };
  let current = request();
  const counts = () => {
    const base: Record<OwnerRequestStatus, number> = { PENDING: 0, CONTACTED: 0, APPROVED: 0, REJECTED: 0 };
    base[current.status] = 1;
    return base;
  };
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'admin@example.test' }, handlers: {
    '/api/v1/admin/owner-requests': route => {
      const query = new URL(route.request().url()).searchParams;
      log.list.push(query);
      const status = query.get('status');
      const rows = !status || status === current.status ? [current] : [];
      return route.fulfill({ json: { data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1, counts: counts() } } });
    },
    '/api/v1/admin/owner-requests/pending-count': route => route.fulfill({ json: { data: { count: current.status === 'PENDING' ? 1 : 0 } } }),
    '/api/v1/admin/owner-requests/7': route => route.fulfill({ json: { data: current } }),
    '/api/v1/admin/owner-requests/7/approve': route => {
      log.approve.push(route.request().postDataJSON());
      if (options.approve) return options.approve(route);
      current = request({ status: 'APPROVED', processedAt: '2026-11-27T10:00:00+07:00', processedBy: { id: 1, email: 'admin@example.test' },
        createdUser: { id: 55, email: current.email }, updatedAt: '2026-11-27T10:00:00+07:00' });
      return route.fulfill({ json: { data: current } });
    },
    '/api/v1/admin/owner-requests/7/reject': route => {
      log.reject.push(route.request().postDataJSON());
      current = request({ status: 'REJECTED', rejectReason: (route.request().postDataJSON() as { reason: string }).reason, updatedAt: '2026-11-27T10:05:00+07:00' });
      return route.fulfill({ json: { data: current } });
    },
  } });
  await page.goto('/admin/partnership-requests');
  await expect(page.getByRole('heading', { level: 1, name: 'Yêu cầu hợp tác' })).toBeVisible();
  return log;
}

test('the Admin sees pending requests with the menu badge and opens one', async ({ page }) => {
  const log = await openQueue(page);
  await expect(page.getByRole('link', { name: 'Yêu cầu hợp tác' })).toContainText('1');
  expect(log.list[0].get('status')).toBe('PENDING');
  await page.getByRole('button', { name: 'Xem yêu cầu của Nguyễn Văn A' }).click();
  await expect(page).toHaveURL(/\?id=7$/);
  const detail = page.locator('[data-slot="owner-request-detail"]').locator('..');
  await expect(detail).toContainText('203.0.113.5');
  await expect(detail.getByRole('button', { name: 'Đánh dấu đã liên hệ' })).toBeVisible();
});

test('"Tạo tài khoản chủ sân" pre-fills the form without a password and approves', async ({ page }) => {
  const log = await openQueue(page);
  await page.goto('/admin/partnership-requests?id=7');
  await page.getByRole('button', { name: 'Tạo tài khoản chủ sân' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo tài khoản chủ sân' });
  await expect(dialog.getByLabel('Email đăng nhập')).toHaveValue('owner@example.com');
  await expect(dialog.getByLabel('Email đăng nhập')).toHaveAttribute('readonly', '');
  await expect(dialog.getByLabel('Tên cơ sở kinh doanh *')).toHaveValue('Sân Phú Nhuận');
  await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(dialog).toHaveCount(0);
  expect(log.approve).toEqual([{ businessName: 'Sân Phú Nhuận', phone: '0901234567' }]);
  await expect(page.getByText('Đã tạo tài khoản chủ sân owner@example.com.')).toBeVisible();
  await expect(page.locator('[data-slot="owner-request-detail"]')).toContainText('Đã tạo tài khoản');
  await expect(page.getByRole('button', { name: 'Từ chối', exact: true })).toHaveCount(0);
});

test('approving an email that gained an account keeps the request open', async ({ page }) => {
  await openQueue(page, { approve: route => route.fulfill({ status: 409, json: errorBody('USER_EMAIL_EXISTS') }) });
  await page.goto('/admin/partnership-requests?id=7');
  await page.getByRole('button', { name: 'Tạo tài khoản chủ sân' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tạo tài khoản chủ sân' });
  await dialog.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Email đã có tài khoản');
});

test('a request processed by another Admin reloads with a notice', async ({ page }) => {
  await openQueue(page, { approve: route => route.fulfill({ status: 409, json: errorBody('OWNER_REQUEST_INVALID_STATE') }) });
  await page.goto('/admin/partnership-requests?id=7');
  await page.getByRole('button', { name: 'Tạo tài khoản chủ sân' }).click();
  await page.getByRole('dialog', { name: 'Tạo tài khoản chủ sân' }).getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByText('Yêu cầu vừa được quản trị viên khác xử lý.', { exact: false })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('rejecting needs a reason of at least 10 characters', async ({ page }) => {
  const log = await openQueue(page);
  await page.goto('/admin/partnership-requests?id=7');
  await page.getByRole('button', { name: 'Từ chối', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Từ chối yêu cầu hợp tác' });
  await dialog.getByLabel(/Lý do từ chối/).fill('Ngắn');
  await dialog.getByRole('button', { name: 'Xác nhận từ chối' }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Lý do cần ít nhất 10 ký tự.');
  expect(log.reject).toHaveLength(0);
  await dialog.getByLabel(/Lý do từ chối/).fill('Khu vực chưa hỗ trợ trong giai đoạn này.');
  await dialog.getByRole('button', { name: 'Xác nhận từ chối' }).click();
  expect(log.reject).toEqual([{ reason: 'Khu vực chưa hỗ trợ trong giai đoạn này.' }]);
  await expect(page.locator('[data-slot="owner-request-detail"]')).toContainText('Đã từ chối');
});
