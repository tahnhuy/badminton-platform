import { expect, test, type Page, type Route } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';
import type { FacilityReviewQueueItem } from '../src/features/admin/services/facility-review-service';

/** UI contract tests for /admin/approvals (mocked queue, no backend). */

const review = (overrides: Partial<FacilityReviewQueueItem>): FacilityReviewQueueItem => ({
  id: 11, kind: 'FACILITY', status: 'PENDING', rejectionReason: null,
  submittedAt: '2026-11-19T09:00:00+07:00', reviewedAt: null,
  submittedValues: { name: 'CLB Alpha', address: '1 Lê Lợi', phone: '0900000000', description: 'Sân mới' },
  facilityId: 1, courtId: null, facilityName: 'CLB Alpha', courtName: null, ...overrides,
});

const ITEMS: FacilityReviewQueueItem[] = [
  review({}),
  review({ id: 12, kind: 'COURT', courtId: 5, courtName: 'Sân 01', facilityName: 'CLB Beta', submittedValues: { name: 'Sân 01', description: 'Sân thứ hai' }, facilityId: 2 }),
  review({ id: 13, kind: 'ADDRESS_CHANGE', status: 'APPROVED', facilityName: 'CLB Gamma', facilityId: 3, reviewedAt: '2026-11-20T10:00:00+07:00' }),
  review({ id: 14, kind: 'FACILITY', status: 'REJECTED', facilityName: 'CLB Delta', facilityId: 4, reviewedAt: '2026-11-20T11:00:00+07:00', rejectionReason: 'Thiếu giấy tờ' }),
];

interface Log { queue: URLSearchParams[]; approved: unknown[] }

function queueApi(log: Log, override?: (route: Route) => Promise<void> | void) {
  return async (route: Route) => {
    const query = new URL(route.request().url()).searchParams;
    log.queue.push(query);
    if (override) return override(route);
    const status = query.get('status') ?? '';
    const target = query.get('target') ?? '';
    const search = (query.get('search') ?? '').toLowerCase();
    const page = Number(query.get('page') ?? 1);
    const limit = Number(query.get('limit') ?? 10);
    let rows = ITEMS.filter(item =>
      (!status || item.status === status)
      && (!target || (target === 'COURT' ? item.courtId !== null : item.courtId === null))
      && (!search || `${item.facilityName} ${item.courtName ?? ''}`.toLowerCase().includes(search)));
    const total = rows.length;
    rows = rows.slice((page - 1) * limit, page * limit);
    return route.fulfill({ json: { data: rows, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } } });
  };
}

async function openApprovals(page: Page, override?: (route: Route) => Promise<void> | void) {
  const log: Log = { queue: [], approved: [] };
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'approvals.admin@example.test' }, handlers: {
    '/api/v1/admin/facilities/reviews': queueApi(log, override),
    '/api/v1/admin/facilities/reviews/pending-count': route => route.fulfill({ json: { data: { total: 2 } } }),
    '/api/v1/admin/reports': route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } } }),
    '/api/v1/admin/facilities/1/approve': route => { log.approved.push(route.request().postDataJSON()); return route.fulfill({ json: { data: {} } }); },
  } });
  await page.goto('/admin/approvals');
  await expect(page.getByRole('heading', { name: 'Duyệt cơ sở & sân', level: 1 })).toBeVisible();
  return log;
}

const row = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text });
const search = (page: Page) => page.getByLabel('Tìm theo tên cơ sở hoặc sân');
const empty = 'Không có hồ sơ phù hợp';

test.describe('admin approvals desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('renders the queue summary, rows, badges and profile links', async ({ page }) => {
    const log = await openApprovals(page);
    await expect(page.getByText('Tổng hồ sơ · Tất cả trạng thái')).toBeVisible();
    await expect(page.getByTestId('time-range-filter')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(5);
    await expect(row(page, 'CLB Alpha')).toContainText('Hồ sơ #11');
    await expect(row(page, 'CLB Alpha')).toContainText('Chờ duyệt');
    await expect(row(page, 'CLB Gamma')).toContainText('Đã duyệt');
    await expect(row(page, 'CLB Delta')).toContainText('Bị từ chối');
    await expect(row(page, 'CLB Delta')).toContainText('Lý do: Thiếu giấy tờ');
    await expect(row(page, 'CLB Alpha').getByRole('link', { name: 'Hồ sơ' })).toHaveAttribute('href', '/admin/courts/1/reviews');
    expect(log.queue[0].get('limit')).toBe('10');
    expect(log.queue[0].get('page')).toBe('1');
  });

  test('filters by status, target and debounced search', async ({ page }) => {
    const log = await openApprovals(page);
    await chooseSelectOption(page.getByLabel('Lọc theo trạng thái yêu cầu'), 'APPROVED');
    await expect(row(page, 'CLB Gamma')).toBeVisible();
    await expect(row(page, 'CLB Alpha')).toHaveCount(0);
    await expect.poll(() => log.queue.at(-1)!.get('status')).toBe('APPROVED');

    await chooseSelectOption(page.getByLabel('Lọc theo loại hồ sơ'), 'COURT');
    await expect.poll(() => log.queue.at(-1)!.get('target')).toBe('COURT');
    await chooseSelectOption(page.getByLabel('Lọc theo trạng thái yêu cầu'), '');
    await expect(page.getByRole('row')).toHaveCount(2);

    await chooseSelectOption(page.getByLabel('Lọc theo loại hồ sơ'), '');
    await search(page).fill('Beta');
    await expect.poll(() => log.queue.at(-1)!.get('search')).toBe('Beta');
    await expect(row(page, 'CLB Beta')).toBeVisible();
    await expect(row(page, 'CLB Alpha')).toHaveCount(0);

    await page.getByRole('button', { name: 'Xóa tất cả' }).click();
    await expect(search(page)).toHaveValue('');
    await expect(page.getByRole('row')).toHaveCount(5);
  });

  test('expands details, validates the rejection reason and approves', async ({ page }) => {
    const log = await openApprovals(page);
    const target = row(page, 'CLB Alpha');
    await target.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(target.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('1 Lê Lợi')).toBeVisible();
    await expect(page.getByText('Sân mới')).toBeVisible();

    const reject = page.getByRole('button', { name: 'Từ chối', exact: true });
    await expect(reject).toBeDisabled();

    await page.getByRole('button', { name: 'Duyệt hồ sơ' }).click();
    await expect.poll(() => log.approved.length).toBe(1);
    expect(log.approved[0]).toEqual({ reviewId: 11 });
    await expect(page.getByText('Đã duyệt CLB Alpha.')).toBeVisible();

    await page.getByLabel('Lý do từ chối (bắt buộc khi từ chối)').fill('Thiếu giấy tờ');
    await expect(reject).toBeEnabled();
  });

  test('loads skeleton, announces fetching and recovers from errors', async ({ page }) => {
    let mode: 'error' | 'success' = 'error';
    const log = await openApprovals(page, async route => {
      if (mode === 'error') return route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') });
      await queueApi({ queue: [], approved: [] })(route);
    });
    await expect(page.getByRole('alert')).toContainText('Không tải được hồ sơ');
    mode = 'success';
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByRole('row')).toHaveCount(5);
    expect(log.queue.length).toBeGreaterThan(1);
  });

  test('empty queue shows the no-results state', async ({ page }) => {
    await openApprovals(page, route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 1 } } }));
    await expect(page.getByText(empty)).toBeVisible();
    await expect(page.getByText('Tổng hồ sơ · Tất cả trạng thái')).toBeVisible();
  });

  test('custom time range expands without moving the other filters', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApprovals(page);
    const controls = [
      search(page),
      page.getByLabel('Lọc theo trạng thái yêu cầu'),
      page.getByLabel('Lọc theo loại hồ sơ'),
    ];
    const before = await Promise.all(controls.map(control => control.boundingBox()));
    await page.getByTestId('time-range-filter').getByRole('button', { name: 'Khoảng thời gian' }).click();
    await expect(page.getByLabel('Từ ngày')).toBeVisible();
    const after = await Promise.all(controls.map(control => control.boundingBox()));
    for (const [index, box] of after.entries()) {
      expect(Math.abs(box!.y - before[index]!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.width - before[index]!.width)).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('has no horizontal overflow and keeps the table scrollable', async ({ page }) => {
    await openApprovals(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(page.getByRole('region', { name: 'Bảng dữ liệu' })).toBeVisible();
  });
});

test.describe('admin approvals mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stacks filters and keeps the page within the viewport', async ({ page }) => {
    await openApprovals(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(page.getByText('Tổng hồ sơ · Tất cả trạng thái')).toBeVisible();
    await row(page, 'CLB Alpha').getByRole('button', { name: 'Chi tiết' }).click();
    await expect(page.getByText('1 Lê Lợi')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
});

for (const width of [390, 1280]) test(`sorting approvals keeps filters and fits ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const log = await openApprovals(page);
  const sort = page.getByLabel('Sắp xếp hồ sơ', { exact: true });
  await expect(sort).toHaveAttribute('data-value', 'newest');
  await chooseSelectOption(sort, 'oldest');
  await expect.poll(() => log.queue.at(-1)?.get('sort')).toBe('oldest');
  expect(log.queue.at(-1)?.get('page')).toBe('1');
  await expect(sort).toHaveAttribute('data-value', 'oldest');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await chooseSelectOption(sort, 'newest');
  await expect.poll(() => log.queue.at(-1)?.get('sort')).toBe('newest');
});
