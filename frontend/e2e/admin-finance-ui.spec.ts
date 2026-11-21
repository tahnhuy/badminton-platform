import { expect, test, type Page, type Route } from '@playwright/test';
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
    await expect(page.getByRole('cell', { name: '100.000đ' })).toBeVisible();
    expect(log.queries.overview.get('range')).toBe('30d');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('transactions filter by source/status and open the detail payload', async ({ page }) => {
    const log = await openFinance(page, 'transactions');
    await expect(page.getByText('Nạp ví')).toBeVisible();
    await page.getByLabel('Lọc theo nguồn').selectOption('ledger');
    await page.getByLabel('Lọc theo trạng thái hoặc hành động').selectOption('SUCCESS');
    await expect.poll(() => log.queries.transactions.get('status')).toBe('SUCCESS');
    expect(log.queries.transactions.get('source')).toBe('ledger');
    await page.getByRole('button', { name: 'Chi tiết' }).click();
    await expect(page.getByRole('heading', { name: 'Chi tiết giao dịch' })).toBeVisible();
    await expect(page.getByText('detail-payload')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
    await expect(page.getByRole('heading', { name: 'Chi tiết giao dịch' })).toHaveCount(0);
  });

  test('payouts keep the query highlight and keep the approve prompt payload', async ({ page }) => {
    const log = await openFinance(page, 'payouts?payoutId=10');
    const row = page.getByRole('row').filter({ hasText: '#10' });
    await expect(row).toContainText('Chờ xử lý');
    expect(await row.evaluate(element => element.className)).toContain('bg-accent/40');
    page.once('dialog', dialog => void dialog.accept('đã kiểm tra'));
    await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
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
    if (section === 'top-ups') await form.getByLabel('Nhà cung cấp').selectOption('SEPAY');
    if (section === 'payouts') await form.getByLabel('Loại yêu cầu').selectOption('WITHDRAWAL');
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
  await expect(page.getByLabel('Hiển thị', { exact: true })).toHaveValue('10');
  await expect(pager.getByRole('button', { name: 'Trang trước', exact: true })).toBeDisabled();
  await pager.getByRole('button', { name: 'Trang 3', exact: true }).click();
  await expect.poll(() => query.get('page')).toBe('3');
  await expect(pager.getByRole('button', { name: 'Trang 3', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('20');
  await expect.poll(() => query.get('limit')).toBe('20');
  expect(query.get('page')).toBe('1');
  await page.getByLabel('Lọc theo nguồn').selectOption('ledger');
  await pager.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect.poll(() => query.get('page')).toBe('2');
  expect(query.get('source')).toBe('ledger'); expect(query.get('limit')).toBe('20');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('overview paginates all returned days without refetching or changing KPIs', async ({ page }) => {
  let reads = 0;
  const daily = Array.from({ length: 30 }, (_, index) => ({ day: `2026-11-${String(index + 1).padStart(2, '0')}`, amount: '100000' }));
  await openFinance(page, 'overview', route => { reads++; return route.fulfill({ json: { data: { ...OVERVIEW, trend: { cashIn: daily, cashOut: daily, revenue: daily } } } }); });
  const table = page.getByRole('region', { name: 'Bảng dữ liệu', exact: true });
  await expect(table.getByRole('row')).toHaveCount(11);
  await expect(table.getByRole('cell', { name: '01/11/2026', exact: true })).toBeVisible();
  const pager = page.getByRole('navigation', { name: 'Phân trang bảng', exact: true });
  const baseline = reads;
  await pager.getByRole('button', { name: 'Trang 3', exact: true }).click();
  await expect(table.getByRole('cell', { name: '21/11/2026', exact: true })).toBeVisible();
  expect(reads).toBe(baseline);
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('50');
  await expect(table.getByRole('row')).toHaveCount(31);
  await expect(pager.getByRole('button', { name: 'Trang sau', exact: true })).toBeDisabled();
  await expect(page.getByText('1.000.000đ', { exact: true })).toBeVisible();
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
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('50');
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
  await page.getByLabel('Lọc theo nguồn').selectOption('ledger');
  await expect.poll(() => started).toBe(true);
  await page.getByLabel('Lọc theo nguồn').selectOption('payout');
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
