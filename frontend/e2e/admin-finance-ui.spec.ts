import { expect, test, type Page, type Route } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';
import type {
  FinanceAudit, FinanceOverview, FinanceOwnerEarning, FinanceOwnerEarningSettlement,
  FinancePayout, FinanceReconciliation, FinanceReport, FinanceTransaction, FinanceWallet, FinanceWalletEntry,
} from '../src/features/admin/finance/types';

/** UI contract tests for /admin/finance/* (mocked API, no backend). */

const META = { page: 1, limit: 20, total: 1, totalPages: 1 };
const OVERVIEW: FinanceOverview = {
  range: '30d', startDate: '2026-11-01', endDate: '2026-11-20',
  walletLiability: '1000000', held: '500000', available: '500000', cashIn: '2000000', cashOut: '800000',
  grossRevenue: '1200000', refunds: '100000', netEstimated: '1100000', ownerEarnings: '900000',
  pendingPayouts: { count: 2, amount: '300000' }, pendingOwnerEarnings: { count: 1, amount: '150000' },
  failedRefunds: { count: 1, amount: '50000' }, isEstimate: true,
  trend: {
    cashIn: [{ day: '2026-11-19', amount: '100000' }],
    cashOut: [{ day: '2026-11-19', amount: '40000' }],
    revenue: [{ day: '2026-11-19', amount: '60000' }],
  },
};
const TRANSACTION: FinanceTransaction = {
  source: 'ledger', sourceId: 1, occurredAt: '2026-11-19T09:00:00+07:00', type: 'CREDIT', status: 'SUCCESS',
  userId: 7, amount: '100000', balanceAfter: '500000', referenceType: 'top-up', referenceId: 2,
  description: 'Nạp ví', actorId: 1, requestType: 'wallet',
};
const PAYOUT: FinancePayout = {
  id: 10, userId: 7, requestType: 'WITHDRAW', amount: '500000', status: 'PENDING',
  adminNote: null, transferReference: null, createdAt: '2026-11-19T09:00:00+07:00', paidAt: null,
};
const SETTLEMENT: FinanceOwnerEarningSettlement = {
  id: 5, bookingId: 9, ownerId: 3, amount: '200000', status: 'PENDING', mode: 'MANUAL',
  ledgerEntryId: null, decidedBy: null, decidedAt: null, note: null,
  createdAt: '2026-11-19T09:00:00+07:00', updatedAt: '2026-11-19T09:00:00+07:00',
  bookingCode: 'BK-9', bookingDate: '2026-11-19', ownerEmail: 'owner@example.test',
};
const EARNING: FinanceOwnerEarning = {
  id: 20, ownerId: 3, ownerEmail: 'owner@example.test', bookingId: 9, bookingCode: 'BK-9',
  bookingDate: '2026-11-19', entryType: 'CREDIT', amount: '200000', balanceAfter: '800000',
  description: 'Owner earning', createdAt: '2026-11-19T09:00:00+07:00',
};
const REPORT: FinanceReport = {
  range: '30d', startDate: '2026-11-01', endDate: '2026-11-20', groupBy: 'day', isEstimate: true,
  totals: { cashIn: '2000000', cashOut: '800000', grossRevenue: '1200000', refunds: '100000', netEstimated: '1100000', ownerEarnings: '900000' },
  rows: [{ key: '2026-11-19', label: '19/11', gross: '1200000', refunds: '100000', net: '1100000', ownerEarnings: '900000' }],
};
const AUDIT: FinanceAudit = {
  id: 1, actorId: 1, action: 'EXPORT', entityType: 'finance', entityId: null, metadata: { format: 'xlsx' },
  createdAt: '2026-11-19T09:00:00+07:00',
};
const WALLET: FinanceWallet = {
  user: { id: 1, email: 'player@example.test', role: 'PLAYER' }, balance: '100000', held: '0', available: '100000',
  updatedAt: '2026-11-19T09:00:00+07:00',
};
const ENTRY: FinanceWalletEntry = {
  id: 1, userId: 1, entryType: 'CREDIT', amount: '100000', balanceAfter: '100000', referenceType: null,
  referenceId: null, description: 'Điều chỉnh thử', idempotencyKey: null, createdBy: 1, createdAt: '2026-11-19T09:00:00+07:00',
};
const RECONCILIATION: FinanceReconciliation = {
  range: '30d', startDate: '2026-11-01', endDate: '2026-11-20', generatedAt: '2026-11-20T09:00:00+07:00',
  summary: { checks: 1, failed: 1, truncated: false },
  discrepancies: [{ key: 'wallet:1', type: 'BALANCE', entityType: 'wallet', entityId: '1', expected: '100000', actual: '0', delta: '100000', message: 'Lệch số dư' }],
};

interface Log { queries: Record<string, URLSearchParams>; approved: unknown[] }

function handler(data: unknown) {
  return (route: Route) => route.fulfill({ json: { data } });
}
function paged(data: unknown[]) {
  return (route: Route) => route.fulfill({ json: { data, meta: { ...META, total: data.length, totalPages: 1 } } });
}

async function openFinance(page: Page, path: string, override?: (route: Route) => Promise<void> | void) {
  const log: Log = { queries: {}, approved: [] };
  const tracked = (key: string, route: Route) => { log.queries[key] = new URL(route.request().url()).searchParams; };
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'finance.ui@example.test' }, handlers: {
    '/api/v1/admin/finance/overview': route => { tracked('overview', route); if (override) return override(route); return handler(OVERVIEW)(route); },
    '/api/v1/admin/finance/transactions': route => { tracked('transactions', route); return paged([TRANSACTION])(route); },
    '/api/v1/admin/finance/transactions/ledger/1': handler({ source: 'ledger', amount: '100000', note: 'detail-payload' }),
    '/api/v1/admin/finance/top-ups': route => { tracked('top-ups', route); return paged([{ id: 1, userId: 7, amount: '100000', status: 'SUCCESS', provider: 'SEPAY', txnRef: 'TOP-1', createdAt: TRANSACTION.occurredAt, paidAt: TRANSACTION.occurredAt }])(route); },
    '/api/v1/admin/finance/refunds': route => { tracked('refunds', route); return paged([{ paymentId: 3, bookingId: 9, userId: 7, amount: '100000', status: 'FAILED', attempts: 1, lastError: null, reason: null, provider: 'SEPAY', createdAt: TRANSACTION.occurredAt, updatedAt: TRANSACTION.occurredAt }])(route); },
    '/api/v1/admin/finance/payouts': route => { tracked('payouts', route); return paged([PAYOUT])(route); },
    '/api/v1/admin/finance/payouts/10/approve': route => { log.approved.push(route.request().postDataJSON()); return handler({ ...PAYOUT, status: 'APPROVED' })(route); },
    '/api/v1/admin/finance/owner-earnings': route => { tracked('owner-earnings', route); return paged([EARNING])(route); },
    '/api/v1/admin/finance/owner-earning-settlements': paged([SETTLEMENT]),
    '/api/v1/admin/finance/reports/revenue': handler(REPORT),
    '/api/v1/admin/finance/audit': route => { tracked('audit', route); return paged([AUDIT])(route); },
    '/api/v1/admin/finance/reconciliation': handler(RECONCILIATION),
    '/api/v1/admin/finance/wallets/1': handler(WALLET),
    '/api/v1/admin/finance/wallets/1/entries': paged([ENTRY]),
    '/api/v1/admin/facilities/reviews/pending-count': route => route.fulfill({ json: { data: { total: 0 } } }),
    '/api/v1/admin/reports': route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } } }),
  } });
  await page.goto(`/admin/finance/${path}`);
  await expect(page.getByRole('heading', { name: 'Quản lý tài chính', level: 1 })).toBeVisible();
  return log;
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Mục quản lý tài chính' });

for (const width of [390, 1280]) test(`audit metadata uses compact aligned columns at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openFinance(page, 'audit');
  await page.route('**/api/v1/admin/finance/audit?*', paged([{ ...AUDIT,
    actorEmail: 'admin@smashpro.vn', entityType: 'EXPORT', entityId: 'revenue',
    metadata: { filters: { range: '30d', startDate: '2026-10-29', endDate: '2026-11-27', groupBy: 'day' }, rowCount: 30 },
  }]));
  await page.reload();
  const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
  const row = table.locator('tbody tr').first();
  const metadata = row.locator('td').last();
  await expect(metadata.getByText('30 ngày', { exact: true })).toBeVisible();
  await expect(metadata.getByText('29/10/2026', { exact: true })).toBeVisible();
  await expect(metadata.getByText('27/11/2026', { exact: true })).toBeVisible();
  await expect(metadata.getByText('Theo ngày', { exact: true })).toBeVisible();
  await expect(metadata.getByText('30', { exact: true })).toBeVisible();
  const filterGrid = metadata.locator('dd > dl').first();
  await expect(filterGrid).toHaveCSS('display', 'grid');
  const height = await row.evaluate(element => element.getBoundingClientRect().height);
  expect(height).toBeLessThan(190);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('daily reports show newest days first across pages', async ({ page }) => {
  await openFinance(page, 'reports');
  const rows = Array.from({ length: 12 }, (_, index) => ({ ...REPORT.rows[0], key: `2026-11-${String(index + 1).padStart(2, '0')}`, label: `Ngày ${index + 1}` }));
  await page.route('**/api/v1/admin/finance/reports/revenue?*', handler({ ...REPORT, rows }));
  await page.reload();
  const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
  await expect(table.locator('tbody tr').first()).toContainText('12/11/2026');
  await expect(table.locator('tbody tr').last()).toContainText('03/11/2026');
  await page.getByRole('navigation', { name: 'Phân trang bảng', exact: true }).getByRole('button', { name: 'Trang 2', exact: true }).click();
  await expect(table.locator('tbody tr').first()).toContainText('02/11/2026');
  await expect(table.locator('tbody tr').last()).toContainText('01/11/2026');
});

for (const success of [true, false]) test(`manual reconciliation only announces success after a successful response (${success})`, async ({ page }) => {
  await openFinance(page, 'reconciliation');
  await expect(page.getByRole('button', { name: 'Chạy đối soát', exact: true })).toBeVisible();
  const message = page.getByText('Đã chạy đối soát thành công.', { exact: true });
  await expect(message).toHaveCount(0);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/admin/finance/reconciliation?*', async route => {
    await gate;
    return route.fulfill(success ? { json: { data: RECONCILIATION } } : { status: 500, json: errorBody('INTERNAL_ERROR') });
  });
  await page.getByRole('button', { name: 'Chạy đối soát', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đang tải dữ liệu' })).toBeAttached();
  await expect(message).toHaveCount(0);
  release();
  if (success) await expect(message).toBeVisible();
  else {
    await expect(page.getByRole('alert')).toContainText('Không tải được dữ liệu tài chính');
    await expect(message).toHaveCount(0);
  }
});

for (const width of [390, 1280]) for (const section of ['top-ups', 'payouts', 'refunds', 'owner-earnings', 'audit', 'wallets', 'reports', 'reconciliation']) {
  test(`finance identities show name and email in ${section} at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openFinance(page, section);
    const user = { userName: 'Nguyễn Văn An', userEmail: 'an@example.test' };
    const owner = { ownerName: 'Sân Cầu Lông An', ownerEmail: 'owner@example.test' };
    const actor = { actorName: 'Quản trị viên An', actorEmail: 'admin@example.test' };
    const responses: Record<string, unknown> = {
      'top-ups': [{ id: 1, userId: 7, amount: '100000', status: 'PENDING', provider: 'SEPAY', txnRef: 'T1', createdAt: TRANSACTION.occurredAt, paidAt: null, ...user }],
      payouts: [{ ...PAYOUT, ...user }],
      refunds: [{ paymentId: 3, bookingId: 9, userId: 7, amount: '100000', status: 'FAILED', attempts: 1, updatedAt: TRANSACTION.occurredAt, ...user }],
      'owner-earning-settlements': [{ ...SETTLEMENT, ...owner }],
      'owner-earnings': [{ ...EARNING, ...owner }],
      audit: [{ ...AUDIT, ...actor }],
    };
    for (const [endpoint, rows] of Object.entries(responses)) {
      await page.route(`**/api/v1/admin/finance/${endpoint}?*`, paged(rows as unknown[]));
    }
    await page.route('**/api/v1/admin/finance/wallets/1/entries?*', paged([{ ...ENTRY, createdBy: 1, ...actor }]));
    await page.route('**/api/v1/admin/finance/reports/revenue?*', handler({ ...REPORT, groupBy: 'owner', rows: [{ ...REPORT.rows[0], key: '3', label: 'owner@example.test', ...owner }] }));
    await page.route('**/api/v1/admin/finance/reconciliation?*', handler({ ...RECONCILIATION, discrepancies: RECONCILIATION.discrepancies.map(row => ({ ...row, ...user })) }));
    await page.reload();
    if (section === 'wallets') {
      await page.getByRole('combobox', { name: 'Tìm người dùng', exact: true }).fill('1');
      await page.getByRole('combobox', { name: 'Tìm người dùng', exact: true }).press('Escape');
      await page.getByRole('button', { name: 'Xem ví', exact: true }).click();
    }
    const expected = ['owner-earnings', 'reports'].includes(section) ? owner : ['wallets', 'audit'].includes(section) ? actor : user;
    const [name, email] = Object.values(expected);
    const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
    await expect(table.getByRole('cell', { name: `${name} ${email}`, exact: true })).toBeVisible();
    if (section === 'owner-earnings') {
      await page.getByRole('button', { name: 'Đã cộng', exact: true }).click();
      await expect(table.getByRole('cell', { name: `${name} ${email}`, exact: true })).toBeVisible();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test.describe('admin finance desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('renders every section link and the overview KPIs and trend', async ({ page }) => {
    const log = await openFinance(page, 'overview');
    await expect(nav(page).getByRole('link')).toHaveCount(10);
    await expect(nav(page).getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Tổng số dư ví')).toBeVisible();
    await expect(page.getByText('1.000.000đ')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Xu hướng theo ngày' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'TIỀN VÀO' })).toBeVisible();
    await expect(page.locator('tbody').getByRole('cell', { name: '100.000đ' })).toBeVisible();
    expect(log.queries.overview.get('range')).toBe('30d');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('overview groups secondary metrics and expands tournament details on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFinance(page, 'overview', handler({ ...OVERVIEW, tournament: {
      grossFees: '600000', refunds: '100000', netFees: '500000', organizerEarnings: '200000', feesHeld: '300000',
    } }));
    const metrics = page.getByRole('region', { name: 'Chỉ số tài chính chính' });
    await expect(metrics.getByText('Trong kỳ đã chọn')).toHaveCount(3);
    await expect(metrics.getByText('Khả dụng: 500.000đ')).toBeVisible();
    await expect(metrics.getByText('Đang tạm giữ: 500.000đ')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cần xử lý' })).toBeVisible();
    const pending = page.getByRole('link').filter({ hasText: 'Chi trả chờ duyệt' });
    await expect(pending).toHaveAttribute('href', '/admin/finance/payouts');
    await expect(pending).toContainText('2 mục');
    await expect(page.getByText('Tổng doanh thu', { exact: true })).toBeHidden();
    await page.locator('summary').filter({ hasText: 'Chi tiết doanh thu trong kỳ' }).click();
    await expect(page.getByText('Tổng doanh thu', { exact: true })).toBeVisible();
    await expect(page.getByRole('term').filter({ hasText: /^Thu nhập chủ sân$/ })).toBeVisible();
    await expect(page.getByText('Lệ phí thu (gộp)', { exact: true })).toBeHidden();
    await page.locator('summary').filter({ hasText: 'Lệ phí giải đấu' }).click();
    await expect(page.getByText('Lệ phí thu (gộp)', { exact: true })).toBeVisible();
    await expect(page.getByText('Đang giữ cho giải chưa kết thúc')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('transactions filter by source/status and open the detail payload', async ({ page }) => {
    const log = await openFinance(page, 'transactions');
    await expect(page.getByText('Nạp ví')).toBeVisible();
    await chooseSelectOption(page.getByLabel('Lọc theo nguồn'), 'ledger');
    await chooseSelectOption(page.getByLabel('Lọc theo trạng thái hoặc hành động'), 'SUCCESS');
    await expect.poll(() => log.queries.transactions.get('status')).toBe('SUCCESS');
    expect(log.queries.transactions.get('source')).toBe('ledger');
    await page.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(page.getByRole('heading', { name: 'Chi tiết giao dịch' })).toBeVisible();
    await expect(page.getByText('detail-payload')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByRole('heading', { name: 'Chi tiết giao dịch' })).toHaveCount(0);
  });

  test('transactions show Vietnamese references and names with email fallback', async ({ page }) => {
    await openFinance(page, 'transactions');
    await page.route('**/api/v1/admin/finance/transactions?*', paged([
      { ...TRANSACTION, referenceType: 'TOURNAMENT_REGISTRATION', referenceId: 44, userName: 'Nguyễn Văn An', userEmail: 'an@example.test' },
      { ...TRANSACTION, sourceId: 2, userId: 8, userName: '  ', userEmail: 'owner@example.test' },
      { ...TRANSACTION, sourceId: 3, userId: 9, userName: null, userEmail: null },
    ]));
    await page.reload();
    const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
    await expect(table.getByRole('cell', { name: 'Đăng ký giải đấu #44', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Nguyễn Văn An an@example.test', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'owner@example.test', exact: true })).toBeVisible();
    await expect(table.getByRole('cell', { name: 'Người dùng #9', exact: true })).toBeVisible();
    await expect(table.getByText('TOURNAMENT_REGISTRATION:44', { exact: true })).toHaveCount(0);
  });

  test('payouts keep the query highlight and keep the approve prompt payload', async ({ page }) => {
    const log = await openFinance(page, 'payouts?payoutId=10');
    const row = page.getByRole('row').filter({ hasText: '#10' });
    await expect(row).toContainText('Chờ xử lý');
    expect(await row.evaluate(element => element.className)).toContain('bg-accent/40');
    await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Ghi chú duyệt (không bắt buộc)', { exact: true }).fill('đã kiểm tra');
    await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect.poll(() => log.approved.length).toBe(1);
    expect(log.approved[0]).toEqual({ note: 'đã kiểm tra' });
    await expect(page.getByText('Đã cập nhật yêu cầu chi trả #10.')).toBeVisible();
  });

  test('owner earnings keeps the pending/ledger tabs and sweep actions', async ({ page }) => {
    await openFinance(page, 'owner-earnings');
    await expect(page.getByText(/Khi cấu hình/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Chờ duyệt \(1\)/ })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'BK-9' })).toContainText('#5');
    await page.getByRole('button', { name: 'Đã cộng', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Thu nhập chủ sân' })).toContainText('#20');
  });

  test('wallet lookup renders the snapshot and ledger', async ({ page }) => {
    await openFinance(page, 'wallets');
    await page.getByRole('combobox', { name: 'Tìm người dùng', exact: true }).fill('1');
    await page.getByRole('button', { name: 'Xem ví' }).click();
    await expect(page.getByText('player@example.test')).toBeVisible();
    await expect(page.getByText('Điều chỉnh thử')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cộng ví' })).toBeVisible();
  });

  test('reports and audit keep their totals and action rows', async ({ page }) => {
    await openFinance(page, 'reports');
    await expect(page.getByText('Doanh thu ròng ước tính', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '19/11' })).toBeVisible();
    await page.getByRole('link', { name: 'Nhật ký thao tác' }).click();
    await expect(page).toHaveURL('/admin/finance/audit');
    await expect(page.getByRole('cell', { name: 'Xuất dữ liệu' })).toBeVisible();
    await expect(page.getByRole('cell', { name: /xlsx/ })).toBeVisible();
  });

  test('announces loading and shows a generic error state', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await openFinance(page, 'overview', async route => {
      await gate;
      return route.fulfill({ json: { data: OVERVIEW } });
    });
    await expect(page.getByRole('status').filter({ hasText: 'Đang tải dữ liệu' })).toBeAttached();
    release();
    await expect(page.getByText('Tổng số dư ví')).toBeVisible();
  });

  test('overview errors keep the shell and show a retryless alert', async ({ page }) => {
    await openFinance(page, 'overview', route => route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') }));
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('Không tải được dữ liệu tài chính');
    await expect(nav(page)).toBeVisible();
  });
});

test.describe('admin finance mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stays within the viewport with the section nav and tables', async ({ page }) => {
    await openFinance(page, 'transactions');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(nav(page).getByRole('link')).toHaveCount(10);
    await expect(page.getByRole('region', { name: 'Bảng dữ liệu' })).toBeVisible();
  });
});

for (const width of [390, 1280]) {
  test(`long finance table scrolls internally with a sticky header at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openFinance(page, 'transactions');
    await page.route('**/api/v1/admin/finance/transactions?*', route => route.fulfill({ json: {
      data: Array.from({ length: 20 }, (_, index) => ({ ...TRANSACTION, sourceId: index + 1 })),
      meta: { page: 1, limit: 20, total: 40, totalPages: 2 },
    } }));
    await page.reload();
    const region = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
    await expect(region.getByRole('row')).toHaveCount(21);
    await region.scrollIntoViewIfNeeded();
    const header = region.locator('thead');
    const topBefore = (await header.boundingBox())!.y;
    const dimensions = await region.evaluate(element => ({ height: element.clientHeight, scroll: element.scrollHeight }));
    expect(dimensions.scroll).toBeGreaterThan(dimensions.height);
    expect(dimensions.height).toBeLessThanOrEqual(576);
    expect(await region.getByRole('columnheader', { name: 'SỐ TIỀN', exact: true }).evaluate(element => getComputedStyle(element).whiteSpace)).toBe('nowrap');
    const action = region.getByRole('button', { name: 'Chi tiết', exact: true }).first();
    expect((await action.boundingBox())!.width).toBeGreaterThan(70);
    await region.evaluate(element => { element.scrollTop = 300; });
    await expect.poll(async () => Math.abs((await header.boundingBox())!.y - topBefore)).toBeLessThan(1);
    expect(await region.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Trang sau', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(region.getByRole('cell', { name: 'Thành công', exact: true }).first()).toBeAttached();
    await page.screenshot({ path: `/tmp/finance-table-${width}.png`, fullPage: true });
  });
}

for (const section of ['transactions', 'top-ups', 'payouts', 'refunds', 'owner-earnings', 'audit']) {
  test(`advanced ${section} filters send the supported API parameters and reset`, async ({ page }) => {
    const log = await openFinance(page, section);
    await page.getByText('Bộ lọc chi tiết', { exact: true }).click();
    const form = page.getByRole('form', { name: 'Bộ lọc chi tiết tài chính' });
    await form.getByLabel('Từ ngày', { exact: true }).fill('2026-11-01');
    await form.getByLabel('Đến ngày', { exact: true }).fill('2026-11-20');
    const label = section === 'owner-earnings' ? 'Mã chủ sân' : section === 'audit' ? 'Mã người thực hiện' : 'Mã người dùng';
    await form.getByLabel(label, { exact: true }).fill('7');
    if (section === 'top-ups') await chooseSelectOption(form.getByLabel('Nhà cung cấp'), 'SEPAY');
    if (section === 'payouts') await chooseSelectOption(form.getByLabel('Loại yêu cầu'), 'WITHDRAWAL');
    if (section === 'refunds') await form.getByLabel('Mã thanh toán').fill('3');
    await form.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
    await expect.poll(() => log.queries[section]?.get('from')).toBe('2026-11-01');
    expect(log.queries[section].get('to')).toBe('2026-11-20');
    expect(log.queries[section].get(section === 'owner-earnings' ? 'ownerId' : section === 'audit' ? 'actorId' : 'userId')).toBe('7');
    expect(log.queries[section].get('page')).toBe('1');
    if (section === 'top-ups') expect(log.queries[section].get('provider')).toBe('SEPAY');
    if (section === 'payouts') expect(log.queries[section].get('requestType')).toBe('WITHDRAWAL');
    if (section === 'refunds') expect(log.queries[section].get('paymentId')).toBe('3');
    await form.getByRole('button', { name: 'Xóa bộ lọc chi tiết' }).click();
    await expect.poll(() => log.queries[section].has('from')).toBe(false);
  });
}

test('finance date and amount filters validate before sending; overview supports a custom period', async ({ page }) => {
  const log = await openFinance(page, 'transactions');
  await page.getByText('Bộ lọc chi tiết', { exact: true }).click();
  const form = page.getByRole('form', { name: 'Bộ lọc chi tiết tài chính' });
  await form.getByLabel('Số tiền từ (đ)').fill('200');
  await form.getByLabel('Số tiền đến (đ)').fill('100');
  await form.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(form.getByRole('alert')).toContainText('Số tiền đến');
  expect(log.queries.transactions.has('minAmount')).toBe(false);
  await form.getByLabel('Số tiền đến (đ)').fill('300');
  await form.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect.poll(() => log.queries.transactions.get('minAmount')).toBe('200');
  expect(log.queries.transactions.get('maxAmount')).toBe('300');
  await nav(page).getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await page.getByText('Chọn khoảng ngày cụ thể', { exact: true }).click();
  const period = page.getByRole('form', { name: 'Khoảng ngày tài chính' });
  await period.getByLabel('Từ ngày', { exact: true }).fill('2026-11-01');
  await period.getByLabel('Đến ngày', { exact: true }).fill('2026-11-20');
  await period.getByRole('button', { name: 'Áp dụng khoảng ngày' }).click();
  await expect.poll(() => log.queries.overview.get('range')).toBe('custom');
  expect(log.queries.overview.get('startDate')).toBe('2026-11-01');
  expect(log.queries.overview.get('endDate')).toBe('2026-11-20');
});

for (const section of ['overview', 'top-ups', 'payouts', 'refunds', 'owner-earnings', 'reconciliation', 'reports', 'audit']) {
  test(`Vietnamese ${section} table and expanded filters fit mobile`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openFinance(page, section);
    const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
    await expect(table).toBeVisible();
    const headers = await table.getByRole('columnheader').allTextContents();
    expect(headers.join(' ')).not.toMatch(/\b(USER|ACTOR|PROVIDER|OWNER|MODE|EXPECTED|ACTUAL|DELTA|GROSS|REFUNDS|METADATA|CASH IN|REVENUE)\b/);
    if (['top-ups', 'payouts', 'refunds', 'owner-earnings', 'audit'].includes(section)) await page.getByText('Bộ lọc chi tiết', { exact: true }).click();
    else await page.getByText('Chọn khoảng ngày cụ thể', { exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test('finance export retains the applied transaction filters', async ({ page }) => {
  let exportQuery: URLSearchParams | undefined;
  await openFinance(page, 'transactions');
  await page.route('**/api/v1/admin/finance/exports/transactions?*', route => {
    exportQuery = new URL(route.request().url()).searchParams;
    return route.fulfill({ body: 'export-fixture', headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': 'attachment; filename="giao-dich.xlsx"' } });
  });
  await page.getByText('Bộ lọc chi tiết', { exact: true }).click();
  const form = page.getByRole('form', { name: 'Bộ lọc chi tiết tài chính' });
  await form.getByLabel('Mã người dùng', { exact: true }).fill('7');
  await form.getByLabel('Từ ngày', { exact: true }).fill('2026-11-01');
  await form.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('giao-dich.xlsx');
  expect(exportQuery?.get('userId')).toBe('7');
  expect(exportQuery?.get('from')).toBe('2026-11-01');
});

const WALLET_SEARCH_USER = { id: 1, email: 'player@example.test', role: 'PLAYER', status: 'ACTIVE', deletedAt: null,
  createdAt: '', updatedAt: '', profile: { fullName: 'Nguyễn Minh An', userId: 1, skillLevelId: 2, createdAt: '', updatedAt: '' } };
for (const width of [390, 1280]) test(`wallet typeahead finds and selects by name or email at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openFinance(page, 'wallets');
  const searches: string[] = [];
  await page.route('**/api/v1/admin/users?*', route => {
    searches.push(new URL(route.request().url()).searchParams.get('search') ?? '');
    return route.fulfill({ json: { data: [WALLET_SEARCH_USER], pagination: META } });
  });
  const input = page.getByRole('combobox', { name: 'Tìm người dùng', exact: true });
  await input.fill('Nguyễn');
  const option = page.getByRole('option', { name: /Nguyễn Minh An/ });
  await expect(option).toBeVisible();
  expect(searches).toEqual(['Nguyễn']);
  await expect(option).toContainText('player@example.test');
  await expect(option).toContainText('Người chơi');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.screenshot({ path: `/tmp/wallet-typeahead-${width}.png`, fullPage: true });
  await input.press('ArrowDown'); await input.press('Enter');
  await expect(page.getByText('Điều chỉnh thử')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cộng ví', exact: true })).toBeEnabled();
  await input.fill('player@example');
  await expect(page.getByRole('button', { name: 'Cộng ví', exact: true })).toBeDisabled();
  await expect(page.getByText('Điều chỉnh thử')).toHaveCount(0);
  await expect(option).toBeVisible(); await option.click();
  await expect(page.getByText('Điều chỉnh thử')).toBeVisible();
  expect(searches.at(-1)).toBe('player@example');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('wallet typeahead handles minimum input, empty results, retry and Escape', async ({ page }) => {
  await openFinance(page, 'wallets');
  let mode = 'empty'; let calls = 0;
  await page.route('**/api/v1/admin/users?*', route => {
    calls++;
    return mode === 'error' ? route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') })
      : route.fulfill({ json: { data: mode === 'success' ? [WALLET_SEARCH_USER] : [], pagination: META } });
  });
  const input = page.getByRole('combobox', { name: 'Tìm người dùng', exact: true });
  await input.fill('N');
  await expect(page.getByRole('status')).toContainText('Nhập ít nhất 2 ký tự'); expect(calls).toBe(0);
  await input.fill('Không có');
  await expect(page.getByRole('listbox')).toContainText('Không tìm thấy tài khoản');
  await input.press('Escape'); await expect(page.getByRole('listbox')).toHaveCount(0);
  mode = 'error'; await input.fill('Lỗi');
  await expect(page.getByRole('listbox')).toContainText('Không thể tải gợi ý');
  mode = 'success'; await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('option', { name: /Nguyễn Minh An/ })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa tìm kiếm người dùng', exact: true }).click();
  await expect(input).toHaveValue(''); await expect(page.getByRole('button', { name: 'Xem ví', exact: true })).toBeDisabled();
});

test('wallet typeahead ignores a late response from an older search', async ({ page }) => {
  await openFinance(page, 'wallets');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let oldStarted = false;
  await page.route('**/api/v1/admin/users?*', async route => {
    const search = new URL(route.request().url()).searchParams.get('search');
    if (search === 'Old') { oldStarted = true; await gate; }
    return route.fulfill({ json: { data: [{ ...WALLET_SEARCH_USER, profile: { ...WALLET_SEARCH_USER.profile, fullName: search === 'Old' ? 'Kết quả cũ' : 'Kết quả mới' } }], pagination: META } });
  });
  const input = page.getByRole('combobox', { name: 'Tìm người dùng', exact: true });
  await input.fill('Old'); await expect.poll(() => oldStarted).toBe(true);
  await input.fill('New'); await expect(page.getByRole('option', { name: /Kết quả mới/ })).toBeVisible();
  release(); await expect(page.getByRole('option', { name: /Kết quả cũ/ })).toHaveCount(0);
});

for (const width of [390, 1280]) test(`wallet action buttons align at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openFinance(page, 'wallets');
  const buttons = ['Xem ví', 'Cộng ví', 'Trừ ví'].map(name => page.getByRole('button', { name, exact: true }));
  const boxes = await Promise.all(buttons.map(button => button.boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box!.y).toBe(boxes[0]!.y);
    expect(box!.height).toBe(boxes[0]!.height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

for (const width of [390, 1280]) test(`finance numbered pagination and page size preserve filters at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openFinance(page, 'transactions');
  let query = new URLSearchParams();
  await page.route('**/api/v1/admin/finance/transactions?*', route => {
    query = new URL(route.request().url()).searchParams;
    const currentPage = Number(query.get('page')), limit = Number(query.get('limit'));
    return route.fulfill({ json: { data: [TRANSACTION], meta: { page: currentPage, limit, total: 60, totalPages: Math.ceil(60 / limit) } } });
  });
  await page.reload();
  const pager = page.getByRole('navigation', { name: 'Phân trang bảng', exact: true });
  await expect(pager.getByRole('button', { name: 'Trang 1', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Hiển thị', { exact: true })).toHaveAttribute('data-value', '10');
  await expect(pager.getByRole('button', { name: 'Trang trước', exact: true })).toBeDisabled();
  await pager.getByRole('button', { name: 'Trang 3', exact: true }).click();
  await expect.poll(() => query.get('page')).toBe('3');
  await expect(pager.getByRole('button', { name: 'Trang 3', exact: true })).toHaveAttribute('aria-current', 'page');
  await chooseSelectOption(page.getByLabel('Hiển thị', { exact: true }), '20');
  await expect.poll(() => query.get('limit')).toBe('20');
  expect(query.get('page')).toBe('1');
  await chooseSelectOption(page.getByLabel('Lọc theo nguồn'), 'ledger');
  await pager.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect.poll(() => query.get('page')).toBe('2');
  expect(query.get('source')).toBe('ledger'); expect(query.get('limit')).toBe('20');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

for (const width of [390, 1280]) test(`overview paginates all returned days and pins totals at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  let reads = 0;
  const daily = Array.from({ length: 30 }, (_, index) => ({ day: `2026-11-${String(index + 1).padStart(2, '0')}`, amount: '100000' }));
  await openFinance(page, 'overview', route => { reads++; return route.fulfill({ json: { data: { ...OVERVIEW, startDate: '2026-11-01', endDate: '2026-11-30', trend: { cashIn: daily, cashOut: daily, revenue: daily } } } }); });
  const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
  await expect(table.locator('tbody').getByRole('row')).toHaveCount(10);
  await expect(table.locator('tfoot')).toContainText('Tổng toàn kỳ');
  await expect(table.locator('tfoot').getByRole('cell', { name: '3.000.000đ', exact: true })).toHaveCount(3);
  await expect(table.locator('tbody tr').first()).toContainText('30/11/2026');
  const pager = page.getByRole('navigation', { name: 'Phân trang bảng', exact: true });
  const baseline = reads;
  await pager.getByRole('button', { name: 'Trang 3', exact: true }).click();
  await expect(table.locator('tbody tr').first()).toContainText('10/11/2026');
  await expect(table.locator('tfoot').getByRole('cell', { name: '3.000.000đ', exact: true })).toHaveCount(3);
  expect(reads).toBe(baseline);
  await chooseSelectOption(page.getByLabel('Hiển thị', { exact: true }), '50');
  await expect(table.locator('tbody').getByRole('row')).toHaveCount(30);
  await expect(pager.getByRole('button', { name: 'Trang sau', exact: true })).toBeDisabled();
  const totalsLabel = table.getByRole('rowheader', { name: 'Tổng toàn kỳ', exact: true });
  await expect(totalsLabel).toHaveCSS('position', 'sticky');
  const bottomGap = () => totalsLabel.evaluate(element => {
    const region = element.closest('[role="region"]')!;
    return Math.abs(element.getBoundingClientRect().bottom - region.getBoundingClientRect().bottom);
  });
  expect(await bottomGap()).toBeLessThanOrEqual(2);
  await table.evaluate(element => { element.scrollTop = element.scrollHeight / 2; });
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await table.evaluate(element => { element.scrollTop = element.scrollHeight; });
  await expect.poll(bottomGap).toBeLessThanOrEqual(2);
  await expect(page.getByText('1.000.000đ', { exact: true })).toBeVisible();
});

for (const width of [390, 1280]) test(`daily trend trims future month days and aligns monetary columns at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.clock.install({ time: new Date('2026-11-27T08:00:00+07:00') });
  const series = [25, 26, 27, 28, 29, 30].map(day => ({ day: `2026-11-${day}`, amount: '100000' }));
  await openFinance(page, 'overview', handler({ ...OVERVIEW, range: 'this_month', startDate: '2026-11-01', endDate: '2026-11-30',
    trend: { cashIn: series, cashOut: series.map(row => ({ ...row, amount: '20000' })), revenue: series.map(row => ({ ...row, amount: '80000' })) },
  }));
  const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
  await expect(page.getByText('01/11/2026 – 27/11/2026 · Giờ Việt Nam')).toBeVisible();
  await expect(page.getByText('Theo ngày thanh toán, mới nhất trước. Doanh thu gộp chưa trừ hoàn tiền.')).toBeVisible();
  await expect(table.locator('tbody tr')).toHaveCount(3);
  await expect(table.locator('tbody tr').first()).toContainText('27/11/2026');
  await expect(table.locator('tbody tr').last()).toContainText('25/11/2026');
  const footer = table.locator('tfoot');
  await expect(footer).toContainText('300.000đ');
  await expect(footer).toContainText('60.000đ');
  await expect(footer).toContainText('240.000đ');
  const revenue = table.getByRole('columnheader', { name: 'DOANH THU GỘP', exact: true });
  await expect(revenue).toHaveCSS('text-align', 'right');
  await expect(table.locator('tbody tr').first().locator('td').last()).toHaveCSS('text-align', 'right');
  const rightGap = await revenue.evaluate(element => {
    const cell = element.getBoundingClientRect();
    const bounds = element.closest('table')!.getBoundingClientRect();
    return Math.abs(bounds.right - cell.right);
  });
  expect(rightGap).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

for (const [section, endpoint, sample, ledger] of [
  ['top-ups', 'top-ups', { id: 1, userId: 7, amount: '100000', status: 'SUCCESS', provider: 'SEPAY', txnRef: 'T1', createdAt: TRANSACTION.occurredAt }, false],
  ['payouts', 'payouts', PAYOUT, false],
  ['refunds', 'refunds', { paymentId: 3, amount: '100000', status: 'FAILED', attempts: 1, updatedAt: TRANSACTION.occurredAt }, false],
  ['audit', 'audit', AUDIT, false],
  ['owner-earnings', 'owner-earning-settlements', SETTLEMENT, false],
  ['owner-earnings', 'owner-earnings', EARNING, true],
  ['wallets', 'wallets/1/entries', ENTRY, false],
] as const) test(`finance ${endpoint} sends selected page size and page number`, async ({ page }) => {
  await openFinance(page, section);
  let query = new URLSearchParams();
  await page.route(`**/api/v1/admin/finance/${endpoint}?*`, route => {
    query = new URL(route.request().url()).searchParams;
    return route.fulfill({ json: { data: [sample], meta: { page: Number(query.get('page')), limit: Number(query.get('limit')), total: 60, totalPages: Math.ceil(60 / Number(query.get('limit'))) } } });
  });
  if (section === 'wallets') {
    await page.getByRole('combobox', { name: 'Tìm người dùng', exact: true }).fill('1');
    await page.getByRole('button', { name: 'Xem ví', exact: true }).click();
  } else await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  if (ledger) await page.getByRole('button', { name: 'Đã cộng', exact: true }).click();
  await expect.poll(() => query.get('limit')).toBe('10');
  await chooseSelectOption(page.getByLabel('Hiển thị', { exact: true }), '50');
  await expect.poll(() => query.get('limit')).toBe('50');
  expect(query.get('page')).toBe('1');
  await page.getByRole('navigation', { name: 'Phân trang bảng' }).getByRole('button', { name: 'Trang 2', exact: true }).click();
  await expect.poll(() => query.get('page')).toBe('2');
  expect(query.get('limit')).toBe('50');
});

for (const staleError of [false, true]) test(`finance ignores an older ${staleError ? 'error' : 'response'} after changing filters`, async ({ page }) => {
  await openFinance(page, 'transactions');
  let started = false; let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/admin/finance/transactions?*', async route => {
    const source = new URL(route.request().url()).searchParams.get('source');
    if (source === 'ledger') { started = true; await gate; }
    return source === 'ledger' && staleError ? route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') })
      : route.fulfill({ json: { data: [{ ...TRANSACTION, description: source === 'payout' ? 'Giao dịch mới' : 'Giao dịch cũ' }], meta: META } });
  });
  await chooseSelectOption(page.getByLabel('Lọc theo nguồn'), 'ledger');
  await expect.poll(() => started).toBe(true);
  await chooseSelectOption(page.getByLabel('Lọc theo nguồn'), 'payout');
  await expect(page.getByText('Giao dịch mới', { exact: true })).toBeVisible();
  const finished = page.waitForResponse(response => new URL(response.url()).searchParams.get('source') === 'ledger');
  release(); await (await finished).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByText('Giao dịch mới', { exact: true })).toBeVisible();
  await expect(page.getByText('Giao dịch cũ', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('finance restores applied filter fields when returning to a section', async ({ page }) => {
  const log = await openFinance(page, 'transactions');
  await page.getByText('Bộ lọc chi tiết', { exact: true }).click();
  await page.getByRole('form', { name: 'Bộ lọc chi tiết tài chính' }).getByLabel('Mã người dùng', { exact: true }).fill('7');
  await page.getByRole('button', { name: 'Áp dụng bộ lọc', exact: true }).click();
  await expect.poll(() => log.queries.transactions.get('userId')).toBe('7');
  await nav(page).getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await nav(page).getByRole('link', { name: 'Giao dịch', exact: true }).click();
  await page.getByText('Bộ lọc chi tiết · Đang áp dụng', { exact: true }).click();
  await expect(page.getByRole('form', { name: 'Bộ lọc chi tiết tài chính' }).getByLabel('Mã người dùng', { exact: true })).toHaveValue('7');
  expect(log.queries.transactions.get('userId')).toBe('7');
});

test('transaction detail preserves original notes and IDs and handles unknown enum values', async ({ page }) => {
  await openFinance(page, 'transactions');
  await page.route('**/api/v1/admin/finance/transactions/ledger/1', handler({ source: 'constructor', id: 12345, note: 'PAID', txnRef: 'PENDING', status: 'PAID' }));
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByText('PAID', { exact: true })).toBeVisible();
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible();
  await expect(page.getByText('12345', { exact: true })).toBeVisible();
  await expect(page.getByText('constructor', { exact: true })).toBeVisible();
  await expect(page.locator('dd').filter({ hasText: /^Đã chi trả$/ })).toBeVisible();
});

test('transaction detail shows fetch failures and ignores responses after closing', async ({ page }) => {
  await openFinance(page, 'transactions');
  await page.route('**/api/v1/admin/finance/transactions/ledger/1', route => route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') }));
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/admin/finance/transactions/ledger/1', async route => { await gate; return handler({ note: 'Chi tiết đã đóng' })(route); });
  await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
  await expect(page.getByText('Đang tải chi tiết giao dịch…')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  const finished = page.waitForResponse(response => response.url().endsWith('/transactions/ledger/1'));
  release(); await (await finished).finished();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByRole('heading', { name: 'Chi tiết giao dịch', exact: true })).toHaveCount(0);
  await expect(page.getByText('Chi tiết đã đóng')).toHaveCount(0);
});

test('wallet lookup button selects the highlighted typeahead account', async ({ page }) => {
  await openFinance(page, 'wallets');
  await page.route('**/api/v1/admin/users?*', route => route.fulfill({ json: { data: [WALLET_SEARCH_USER], pagination: META } }));
  const input = page.getByRole('combobox', { name: 'Tìm người dùng', exact: true });
  await input.fill('Nguyễn');
  await expect(page.getByRole('option', { name: /Nguyễn Minh An/ })).toBeVisible();
  await input.press('ArrowDown');
  await page.getByRole('button', { name: 'Xem ví', exact: true }).click();
  await expect(page.getByText('Điều chỉnh thử')).toBeVisible();
});

for (const width of [390, 1280]) test(`financial mutations preserve tables and use validated dialogs at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openFinance(page, 'refunds');
  await page.route('**/api/v1/admin/finance/refunds/3/retry', route => route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') }));
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Không tải được dữ liệu tài chính')).toHaveCount(0);
  await expect(page.getByRole('table', { includeHidden: true })).toBeVisible();
  await nav(page).getByRole('link', { name: 'Chi trả', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('Chi trả');
  await page.route('**/api/v1/admin/finance/payouts/10/approve', route => route.fulfill({ status: 409, json: errorBody('CONFLICT') }));
  await page.getByRole('button', { name: 'Duyệt', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('table', { includeHidden: true })).toBeVisible();
});

for (const seconds of ['', ':15']) test(`manual matching submits the selected intent and rejects ambiguous amount formatting (seconds=${seconds || 'none'})`, async ({ page }) => {
  await openFinance(page, 'top-ups');
  await page.route('**/api/v1/admin/finance/top-ups?*', route => route.fulfill({ json: { data: [{ id: 42, userId: 7, amount: '100000', status: 'PENDING', provider: 'SEPAY', txnRef: 'TOPUP-42', createdAt: TRANSACTION.occurredAt }], meta: META } }));
  await page.reload();
  const row = page.getByRole('row').filter({ hasText: 'TOPUP-42' });
  await row.getByRole('button', { name: 'Ghép giao dịch', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Mã lệnh nạp gốc', { exact: false })).toHaveValue('42');
  await dialog.getByLabel('Mã giao dịch ngân hàng', { exact: true }).fill('BANK-42');
  await dialog.getByLabel('Thời gian chuyển khoản', { exact: false }).fill(`2026-11-22T10:00${seconds}`);
  await dialog.getByLabel('Lý do ghép tay', { exact: true }).fill('Đã kiểm tra sao kê');
  await dialog.getByLabel('Số tiền', { exact: false }).fill('100.000');
  await dialog.getByRole('button', { name: 'Ghép giao dịch', exact: true }).click();
  await expect(dialog.getByText(/không dùng dấu phân cách hàng nghìn/).last()).toBeVisible();
  let submitted: unknown;
  await page.route('**/api/v1/admin/finance/top-ups/42/manual-match', route => { submitted = route.request().postDataJSON(); return route.fulfill({ json: { data: {} } }); });
  await dialog.getByLabel('Số tiền', { exact: false }).fill('100000');
  await expect(dialog.getByText(/Xem trước: 100\.000\s*₫/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Ghép giao dịch', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(submitted).toMatchObject({ topUpId: 42, amount: '100000', providerReference: 'BANK-42', transferTime: `2026-11-22T03:00:${seconds ? '15' : '00'}.000Z` });
});

test('outstanding Owner recovery exposes an explicit retry with a reason', async ({ page }) => {
  await openFinance(page, 'reconciliation');
  await page.route('**/api/v1/admin/finance/reconciliation?*', route => route.fulfill({ json: { data: { ...RECONCILIATION, discrepancies: [{ key: 'OWNER_EARNING_REVERSAL_PENDING:9', type: 'OWNER_EARNING_REVERSAL_PENDING', entityType: 'BOOKING', entityId: '9', expected: '100000', actual: '0', delta: '-100000', message: 'Cần thu hồi thu nhập chủ sân' }] } } }));
  await page.reload();
  await page.getByRole('button', { name: 'Thử lại thu hồi', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Thử lại thu hồi', exact: true }).click();
  await expect(dialog.getByText('Vui lòng nhập lý do thu hồi.')).toBeVisible();
  let reason = '';
  await page.route('**/api/v1/admin/finance/owner-earnings/9/reverse', route => { reason = route.request().postDataJSON().reason; return route.fulfill({ json: { data: { reversed: true } } }); });
  await dialog.getByLabel('Lý do thu hồi', { exact: false }).fill('Owner đã có số dư');
  await dialog.getByRole('button', { name: 'Thử lại thu hồi', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(reason).toBe('Owner đã có số dư');
});

test('refund notes retain the existing 500-character API limit', async ({ page }) => {
  await openFinance(page, 'refunds');
  let body: { note?: string } = {};
  await page.route('**/api/v1/admin/finance/refunds/3/resolve-note', route => { body = route.request().postDataJSON(); return route.fulfill({ json: { data: {} } }); });
  await page.getByRole('button', { name: 'Ghi chú', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const note = 'Ghi nhận xử lý. '.repeat(30).trim();
  await dialog.getByLabel('Ghi chú xử lý', { exact: false }).fill(note);
  await dialog.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(body.note).toBe(note);
});
