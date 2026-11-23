import { expect, test, type Page, type Route } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';
import type { AdminReport, AdminReportDetail, ReportPageMeta } from '../src/features/admin/reports/types/report';

/** UI contract tests for /admin/reports (mocked API, no backend). */

const report = (overrides: Partial<AdminReport>): AdminReport => ({
  id: '101', reporterId: '1', targetType: 'POST', reportedPostId: '201', reasonCode: 'SPAM',
  description: 'Bài viết spam', status: 'OPEN', resolvedAt: null,
  createdAt: '2026-11-19T09:00:00+07:00', updatedAt: '2026-11-19T09:00:00+07:00', ...overrides,
});
const REPORTS: AdminReport[] = [
  report({}),
  report({ id: '102', targetType: 'COMMENT', reportedPostId: undefined, reportedCommentId: '300', reasonCode: 'HARASSMENT', status: 'RESOLVED', resolvedAt: '2026-11-20T10:00:00+07:00' }),
  report({ id: '103', targetType: 'MESSAGE', reportedPostId: undefined, reportedMessageId: '400', reasonCode: 'OTHER' }),
];
const META: ReportPageMeta = { page: 1, limit: 10, total: REPORTS.length, totalPages: 1 };

const detail = (base: AdminReport): AdminReportDetail => ({
  ...base,
  evidence: {
    text: 'Bằng chứng văn bản',
    media: [{ mediaId: 'm1', kind: 'IMAGE', mimeType: 'image/png', byteSize: 1200, originalName: 'anh.png', url: '/uploads/test.png' }],
  },
  target: {
    type: 'POST', available: true,
    reportHistory: {
      total: 3, open: 1, last30Days: 2, distinctReporters: 2,
      byReason: [{ reasonCode: 'SPAM', count: 2 }],
      recent: [{ id: '90', reporterId: '2', reasonCode: 'SPAM', status: 'OPEN', createdAt: '2026-11-18T08:00:00+07:00' }],
    },
    post: {
      id: '201', type: 'STATUS', title: 'Tiêu đề bài viết', body: 'Nội dung bài viết bị báo cáo',
      author: { id: '9', displayName: 'Người đăng', email: 'author@example.test', avatarUrl: null, status: 'ACTIVE' },
      publishedAt: '2026-11-18T07:00:00+07:00', editedAt: null, createdAt: '2026-11-18T07:00:00+07:00',
      deletedAt: null, hiddenAt: null, hiddenBy: null,
    },
  },
});

interface Log { list: URLSearchParams[]; status: unknown[]; hides: string[] }

async function openReports(page: Page, override?: (route: Route) => Promise<void> | void) {
  const log: Log = { list: [], status: [], hides: [] };
  const listHandler = async (route: Route) => {
    log.list.push(new URL(route.request().url()).searchParams);
    if (override) return override(route);
    const query = new URL(route.request().url()).searchParams;
    const status = query.get('status') ?? '';
    const targetType = query.get('targetType') ?? '';
    const rows = REPORTS.filter(item => (!status || item.status === status) && (!targetType || item.targetType === targetType));
    return route.fulfill({ json: { data: rows, meta: { ...META, total: rows.length, totalPages: 1 } } });
  };
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'reports.admin@example.test' }, handlers: {
    '/api/v1/admin/reports': listHandler,
    '/api/v1/admin/reports/101': route => route.fulfill({ json: { data: detail(REPORTS[0]) } }),
    '/api/v1/admin/reports/101/status': route => { log.status.push(route.request().postDataJSON()); return route.fulfill({ json: { data: { ...REPORTS[0], status: 'RESOLVED' } } }); },
    '/api/v1/admin/posts/201/hide': route => { log.hides.push(route.request().url()); return route.fulfill({ json: { data: {} } }); },
    '/api/v1/admin/facilities/reviews/pending-count': route => route.fulfill({ json: { data: { total: 0 } } }),
  } });
  await page.goto('/admin/reports');
  await expect(page.getByRole('heading', { name: 'Quản lý báo cáo & kiểm duyệt', level: 1 })).toBeVisible();
  return log;
}

const row = (page: Page, text: string) => page.getByRole('row').filter({ hasText: text });
const dialog = (page: Page) => page.getByRole('dialog');

test.describe('admin reports desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('renders the report list with badges and requests', async ({ page }) => {
    const log = await openReports(page);
    await expect(page.getByTestId('time-range-filter')).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(4);
    await expect(row(page, '#101')).toContainText('Bài viết');
    await expect(row(page, '#101')).toContainText('Spam/quảng cáo');
    await expect(row(page, '#101')).toContainText('Chờ xử lý');
    await expect(row(page, '#102')).toContainText('Đã xử lý');
    const pageRequest = log.list.find(query => query.get('limit') === '10')!;
    expect(pageRequest.get('page')).toBe('1');
    expect(pageRequest.get('startDate')).toBeTruthy();
  });

  test('filters by target type and status', async ({ page }) => {
    const log = await openReports(page);
    await chooseSelectOption(page.getByLabel('Lọc theo loại đối tượng'), 'COMMENT');
    await expect(row(page, '#102')).toBeVisible();
    await expect(row(page, '#101')).toHaveCount(0);
    await expect.poll(() => log.list.at(-1)!.get('targetType')).toBe('COMMENT');

    await chooseSelectOption(page.getByLabel('Lọc theo trạng thái'), 'OPEN');
    await expect.poll(() => log.list.at(-1)!.get('status')).toBe('OPEN');
    await expect(page.getByText('Chưa có báo cáo phù hợp')).toBeVisible();
    await page.getByRole('button', { name: 'Xóa tất cả' }).click();
    await expect(page.getByRole('row')).toHaveCount(4);
  });

  test('opens detail from the row, resolves and hides the reported post', async ({ page }) => {
    const log = await openReports(page);
    await row(page, '#101').getByRole('button', { name: 'Xem & xử lý' }).click();
    const panel = dialog(page);
    await expect(panel.getByRole('heading', { name: 'Báo cáo #101' })).toBeVisible();
    await expect(panel.getByText('Đối tượng bị báo cáo')).toBeVisible();
    await expect(panel.getByText('Tiêu đề bài viết')).toBeVisible();
    await expect(panel.getByText('Nội dung bài viết bị báo cáo')).toBeVisible();
    await expect(panel.getByText('Bằng chứng văn bản')).toBeVisible();
    await expect(panel.getByRole('link', { name: '#1' })).toHaveAttribute('href', '/admin/users?userId=1');

    await panel.getByRole('button', { name: 'Đánh dấu đã xử lý' }).click();
    await expect.poll(() => log.status.length).toBe(1);
    expect(log.status[0]).toEqual({ status: 'RESOLVED' });
    await expect(page.getByText('Đã đánh dấu báo cáo #101 là đã xử lý.')).toBeVisible();

    await panel.getByRole('button', { name: 'Ẩn bài viết' }).click();
    await expect.poll(() => log.hides.length).toBe(1);
    expect(log.hides[0]).toContain('/api/v1/admin/posts/201/hide');
    await expect(page.getByText('Đã ẩn bài viết #201.')).toBeVisible();
  });

  test('opens detail directly from ?reportId=', async ({ page }) => {
    await openReports(page);
    await page.goto('/admin/reports?reportId=101');
    await expect(dialog(page).getByRole('heading', { name: 'Báo cáo #101' })).toBeVisible();
  });

  test('shows the empty state and handles list errors with retry', async ({ page }) => {
    await openReports(page, route => route.fulfill({ json: { data: [], meta: { ...META, total: 0, totalPages: 0 } } }));
    await expect(page.getByText('Chưa có báo cáo phù hợp')).toBeVisible();
  });

  test('list errors are generic and retryable', async ({ page }) => {
    let fail = true;
    await openReports(page, route => {
      if (fail) return route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') });
      return route.fulfill({ json: { data: REPORTS, meta: META } });
    });
    await expect(page.getByRole('alert')).toContainText('Không tải được danh sách báo cáo');
    fail = false;
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(page.getByRole('row')).toHaveCount(4);
  });

  test('custom time range opens horizontally without moving the other filters', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openReports(page);
    const target = page.getByLabel('Lọc theo loại đối tượng');
    const status = page.getByLabel('Lọc theo trạng thái');
    const before = await Promise.all([target.boundingBox(), status.boundingBox()]);
    const range = page.getByTestId('time-range-filter');
    await range.getByRole('button', { name: 'Khoảng thời gian' }).click();
    const fromDate = page.getByLabel('Từ ngày');
    await expect(fromDate).toBeVisible();

    const after = await Promise.all([target.boundingBox(), status.boundingBox()]);
    for (const [index, box] of after.entries()) {
      expect(Math.abs(box!.y - before[index]!.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.width - before[index]!.width)).toBeLessThanOrEqual(1);
    }

    const root = (await range.boundingBox())!;
    const fromBox = (await fromDate.boundingBox())!;
    const presetLabel = (await range.locator('span').first().boundingBox())!;
    const presetGroup = (await range.getByRole('group').boundingBox())!;
    expect(root.height).toBeLessThanOrEqual(70);
    expect(fromBox.y).toBeGreaterThanOrEqual(root.y);
    expect(fromBox.y + fromBox.height).toBeLessThanOrEqual(root.y + root.height + 1);
    expect(Math.abs(fromBox.y - presetGroup.y)).toBeLessThanOrEqual(1);
    const fromLabel = (await range.locator('label > span').first().boundingBox())!;
    expect(Math.abs(presetLabel.y - fromLabel.y)).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('has no horizontal overflow', async ({ page }) => {
    await openReports(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
});

test.describe('admin reports mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('keeps the list and detail dialog within the viewport', async ({ page }) => {
    await openReports(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await row(page, '#101').getByRole('button', { name: 'Xem & xử lý' }).click();
    await expect(dialog(page).getByRole('heading', { name: 'Báo cáo #101' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
});

for (const width of [390, 1280]) test(`sorting reports keeps filters and fits ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const log = await openReports(page);
  const sort = page.getByLabel('Sắp xếp báo cáo', { exact: true });
  await expect(sort).toHaveAttribute('data-value', 'newest');
  await chooseSelectOption(sort, 'oldest');
  await expect.poll(() => log.list.at(-1)?.get('sort')).toBe('oldest');
  expect(log.list.at(-1)?.get('page')).toBe('1');
  await expect(sort).toHaveAttribute('data-value', 'oldest');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await chooseSelectOption(sort, 'newest');
  await expect.poll(() => log.list.at(-1)?.get('sort')).toBe('newest');
});
