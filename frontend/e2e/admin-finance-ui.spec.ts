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
    '/api/v1/admin/finance/payouts': route => { tracked('payouts', route); return paged([PAYOUT])(route); },
    '/api/v1/admin/finance/payouts/10/approve': route => { log.approved.push(route.request().postDataJSON()); return handler({ ...PAYOUT, status: 'APPROVED' })(route); },
    '/api/v1/admin/finance/owner-earnings': paged([EARNING]),
    '/api/v1/admin/finance/owner-earning-settlements': paged([SETTLEMENT]),
    '/api/v1/admin/finance/reports/revenue': handler(REPORT),
    '/api/v1/admin/finance/audit': paged([AUDIT]),
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
    await expect(page.getByRole('columnheader', { name: 'CASH IN' })).toBeVisible();
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
    await expect(row).toContainText('PENDING');
    expect(await row.evaluate(element => element.className)).toContain('bg-accent/40');
    page.once('dialog', dialog => void dialog.accept('đã kiểm tra'));
    await row.getByRole('button', { name: 'Duyệt', exact: true }).click();
    await expect.poll(() => log.approved.length).toBe(1);
    expect(log.approved[0]).toEqual({ note: 'đã kiểm tra' });
    await expect(page.getByText('Đã cập nhật payout #10.')).toBeVisible();
  });

  test('owner earnings keeps the pending/ledger tabs and sweep actions', async ({ page }) => {
    await openFinance(page, 'owner-earnings');
    await expect(page.getByText(/Khi cấu hình/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Chờ duyệt \(1\)/ })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'BK-9' })).toContainText('#5');
    await page.getByRole('button', { name: 'Đã cộng', exact: true }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Owner earning' })).toContainText('#20');
  });

  test('wallet lookup renders the snapshot and ledger', async ({ page }) => {
    await openFinance(page, 'wallets');
    await page.getByLabel('User ID').fill('1');
    await page.getByRole('button', { name: 'Xem ví' }).click();
    await expect(page.getByText('player@example.test')).toBeVisible();
    await expect(page.getByText('Điều chỉnh thử')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cộng ví' })).toBeVisible();
  });

  test('reports and audit keep their totals and action rows', async ({ page }) => {
    await openFinance(page, 'reports');
    await expect(page.getByText('Net ước tính', { exact: true })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '19/11' })).toBeVisible();
    await page.getByRole('link', { name: 'Audit' }).click();
    await expect(page).toHaveURL('/admin/finance/audit');
    await expect(page.getByRole('cell', { name: 'EXPORT' })).toBeVisible();
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
