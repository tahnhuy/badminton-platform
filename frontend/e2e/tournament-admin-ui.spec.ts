import { expect, test, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
import { tournament } from './tournament-fixtures';

/** TRN-12 contract UI tests for the Admin tournaments page (mocked API). */
test.use({ viewport: { width: 1280, height: 900 } });

test('lists tournaments, filters by status and cancels with a reason', async ({ page }) => {
  const asked: string[] = [];
  let cancelled: unknown = null;
  const rows = [tournament({ status: 'IN_PROGRESS' }), tournament({ id: 8, name: 'Giải đã xong', status: 'COMPLETED' })];
  await mockAuthApi(page, { user: account('ADMIN'), handlers: {
    '/api/v1/admin/tournaments': (route: Route) => {
      asked.push(new URL(route.request().url()).searchParams.get('status') ?? '');
      return route.fulfill({ json: { data: rows, meta: { page: 1, limit: 20, total: 2, totalPages: 1 } } });
    },
    '/api/v1/admin/tournaments/7/cancel': (route: Route) => { cancelled = route.request().postDataJSON(); return route.fulfill({ json: { data: { ...rows[0], status: 'CANCELLED' } } }); },
  } });
  await page.goto('/admin/tournaments');
  await expect(page.getByRole('heading', { name: 'Quản lý giải đấu' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Giải đơn mùa đông 2026/ }).first()).toBeVisible();
  // Completed tournaments cannot be cancelled.
  await expect(page.getByRole('button', { name: 'Huỷ giải' })).toHaveCount(1);
  await page.getByRole('button', { name: 'Huỷ giải' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Huỷ giải và hoàn tiền' }).click();
  expect(cancelled).toBeNull();
  await dialog.getByLabel('Lý do (bắt buộc)').fill('Vi phạm quy định');
  await dialog.getByRole('button', { name: 'Huỷ giải và hoàn tiền' }).click();
  await expect(dialog).toHaveCount(0);
  expect(cancelled).toEqual({ reason: 'Vi phạm quy định' });
  expect(asked[0]).toBe('');
});
