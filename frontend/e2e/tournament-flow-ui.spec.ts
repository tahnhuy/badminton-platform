import { expect, test, type Route } from '@playwright/test';
import { account } from './auth-ui-mocks';
import { mockTournamentApi, tournament } from './tournament-fixtures';

/** Flow-audit fixes (2026-11-25): public pages, schedule by court, wallet return, Admin tools (mocked API). */
test.use({ viewport: { width: 1280, height: 900 } });

test('a visitor browses tournaments and is asked to sign in to register', async ({ page }) => {
  const asked: string[] = [];
  await mockTournamentApi(page, { user: null, extra: {
    '/api/v1/tournaments': (route: Route) => {
      asked.push(new URL(route.request().url()).search);
      return route.fulfill({ json: { data: [tournament()], meta: { page: 1, limit: 12, total: 1, totalPages: 1 } } });
    },
  } });
  await page.goto('/tournaments');
  await expect(page).toHaveURL(/\/tournaments$/);
  await expect(page.getByRole('link', { name: /Giải đơn mùa đông 2026/ })).toBeVisible();
  // Player-only actions are hidden for visitors.
  await expect(page.getByRole('link', { name: 'Tạo giải' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Hợp trình độ tôi/ })).toHaveCount(0);
  // "Sắp đấu" chip and the date filter reach the API.
  await page.getByRole('radio', { name: 'Sắp đấu' }).click();
  await page.getByLabel('Từ ngày').fill('2026-12-01');
  await expect.poll(() => asked.at(-1)).toContain('from=2026-12-01T00%3A00%3A00%2B07%3A00');
  expect(asked.at(-1)).toContain('status=READY');

  await page.goto('/tournaments/7');
  const cta = page.getByRole('link', { name: 'Đăng nhập để đăng ký' });
  await expect(cta).toHaveAttribute('href', '/sign-in');
  await cta.click();
  await expect(page).toHaveURL(/\/sign-in$/);
});

test('the schedule can be read by court', async ({ page }) => {
  await mockTournamentApi(page, { detail: tournament({ status: 'READY' }) });
  await page.goto('/tournaments/7');
  await page.getByRole('tab', { name: /Lịch thi đấu/ }).click();
  await page.getByRole('radio', { name: 'Theo sân' }).click();
  await expect(page.getByRole('heading', { level: 2, name: /· Sân/ }).first()).toBeVisible();
});

test('the wallet offers a way back to the tournament after a top-up', async ({ page }) => {
  await mockTournamentApi(page, { extra: {
    '/api/v1/wallet/transactions': (route: Route) => route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } }),
  } });
  await page.goto('/wallet?returnTo=%2Ftournaments%2F7');
  await expect(page.getByRole('link', { name: /Quay lại giải đấu/ })).toHaveAttribute('href', '/tournaments/7');
  await page.goto('/wallet?returnTo=https%3A%2F%2Fevil.example');
  await expect(page.getByRole('heading', { name: 'Ví của tôi' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Quay lại giải đấu/ })).toHaveCount(0);
});

test('admin deep link shows only that tournament and recalculation asks first', async ({ page }) => {
  const asked: string[] = [];
  let recalculated = 0;
  await mockTournamentApi(page, { user: account('ADMIN'), extra: {
    '/api/v1/admin/tournaments': (route: Route) => {
      asked.push(new URL(route.request().url()).search);
      return route.fulfill({ json: { data: [tournament()], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } });
    },
    '/api/v1/admin/tournaments/skill-ratings/recalculate': (route: Route) => { recalculated++; return route.fulfill({ json: { data: { changed: 2 } } }); },
  } });
  await page.goto('/admin/tournaments?tournamentId=7');
  await expect(page.getByText('Đang xem giải #7 từ liên kết.')).toBeVisible();
  expect(asked[0]).toBe('?id=7');
  await page.getByRole('button', { name: 'Xem tất cả giải' }).click();
  await expect.poll(() => asked.at(-1)).toContain('page=1');

  await page.getByRole('button', { name: 'Tính lại phong độ' }).click();
  expect(recalculated).toBe(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Tính lại', exact: true }).click();
  await expect(page.getByText(/2 người chơi đổi trình độ/)).toBeVisible();
  expect(recalculated).toBe(1);
});
