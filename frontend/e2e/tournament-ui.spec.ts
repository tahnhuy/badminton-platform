import { expect, test } from '@playwright/test';
import { mockTournamentApi, tournament } from './tournament-fixtures';

/** TRN-07 contract UI tests for the Player tournament pages (mocked API). */
test.use({ viewport: { width: 1280, height: 900 } });

test('my tournaments pages past 24 items and resets the page on a role change', async ({ page }) => {
  const calls: string[] = [];
  await mockTournamentApi(page, { extra: {
    '/api/v1/tournaments/mine': route => {
      const params = new URL(route.request().url()).searchParams;
      const currentPage = Number(params.get('page'));
      calls.push(`${params.get('role')}:${currentPage}`);
      const data = currentPage === 2
        ? [tournament({ id: 125, name: 'Giải thứ 25' })]
        : Array.from({ length: 24 }, (_, i) => tournament({ id: 100 + i, name: `Giải số ${i + 1}` }));
      return route.fulfill({ json: { data, meta: { page: currentPage, limit: 24, total: 25, totalPages: 2 } } });
    },
  } });
  await page.goto('/tournaments/mine?role=organized');
  const pagination = page.getByRole('navigation', { name: 'Phân trang' });
  await expect(page.getByRole('link', { name: /Giải số 24/ })).toBeVisible();
  await pagination.getByRole('button', { name: 'Sau' }).click();
  await expect(page).toHaveURL(/role=organized&page=2/);
  await expect(page.getByRole('link', { name: /Giải thứ 25/ })).toHaveAttribute('href', '/tournaments/125/manage');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await expect(pagination.getByRole('button', { name: 'Sau' })).toBeDisabled();
  await pagination.getByRole('button', { name: 'Trước' }).click();
  await expect(page.getByRole('link', { name: /Giải số 24/ })).toBeVisible();
  await pagination.getByRole('button', { name: 'Sau' }).click();
  await expect(page.getByRole('link', { name: /Giải thứ 25/ })).toBeVisible();
  await page.getByRole('tab', { name: 'Đã đăng ký' }).click();
  await expect(page).toHaveURL(/role=registered$/);
  await expect(page.getByRole('link', { name: /Giải số 24/ })).toBeVisible();
  expect(calls).toContain('organized:2');
  expect(calls).toContain('registered:1');
});

test('list shows tournaments, the nav tab and searches by name', async ({ page }) => {
  const state = await mockTournamentApi(page);
  await page.goto('/tournaments');
  const nav = page.locator('header').getByRole('navigation', { name: 'Điều hướng chính' });
  await expect(nav.getByRole('link', { name: 'Giải đấu' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('link', { name: /Giải đơn mùa đông 2026/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Giải giao hữu cuối tuần/ })).toBeVisible();
  await page.getByRole('searchbox').or(page.getByPlaceholder(/Tìm/)).first().fill('mùa đông');
  await expect.poll(() => state.calls.some(c => c.path === '/api/v1/tournaments' && c.method === 'GET')).toBe(true);
  await page.waitForRequest(req => req.url().includes('/api/v1/tournaments?') && new URL(req.url()).searchParams.get('q') === 'mùa đông');
  await page.getByRole('link', { name: /Giải đơn mùa đông 2026/ }).click();
  await expect(page).toHaveURL('/tournaments/7');
});

test('registers with the wallet and shows the balance after', async ({ page }) => {
  const state = await mockTournamentApi(page);
  await page.goto('/tournaments/7');
  await expect(page.getByRole('heading', { name: 'Giải đơn mùa đông 2026' })).toBeVisible();
  await page.getByRole('button', { name: /^Đăng ký ·/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký giải' });
  await expect(dialog).toContainText('Số dư ví khả dụng');
  await expect(dialog).toContainText(/500\.000/);
  await expect(dialog).toContainText(/400\.000/);
  await dialog.getByRole('button', { name: /Xác nhận/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Bạn đã đăng ký')).toBeVisible();
  expect(state.calls.filter(c => c.method === 'POST' && c.path === '/api/v1/tournaments/7/registrations')).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'Rút đăng ký' })).toBeVisible();
});

test('short wallet balance leads to top-up instead of registering', async ({ page }) => {
  const state = await mockTournamentApi(page, { available: '50000.00' });
  await page.goto('/tournaments/7');
  await page.getByRole('button', { name: /^Đăng ký ·/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký giải' });
  await expect(dialog).toContainText('Ví chưa đủ tiền');
  await expect(dialog.getByRole('link', { name: 'Nạp ví' })).toHaveAttribute('href', '/wallet?returnTo=%2Ftournaments%2F7');
  await expect(dialog.getByRole('button', { name: /Xác nhận/ })).toHaveCount(0);
  expect(state.calls.filter(c => c.method === 'POST')).toHaveLength(0);
});

test('a player outside the level range cannot register', async ({ page }) => {
  await mockTournamentApi(page, { detail: tournament({ viewer: { isOrganizer: false, registrationId: null, eligible: false, ineligibleReason: 'BELOW_MIN_LEVEL' } }) });
  await page.goto('/tournaments/7');
  await expect(page.getByRole('button', { name: 'Đăng ký', exact: true })).toBeDisabled();
  await expect(page.getByText(/Giải dành cho trình/)).toBeVisible();
});

test('bracket draws connectors and fades the loser', async ({ page }) => {
  await mockTournamentApi(page, { detail: tournament({ status: 'IN_PROGRESS', viewer: { isOrganizer: false, registrationId: 1, eligible: true, ineligibleReason: null } }) });
  await page.goto('/tournaments/7');
  await page.getByRole('tab', { name: 'Nhánh đấu' }).click();
  const semi = page.locator('[data-match="101"]');
  await expect(semi).toBeVisible();
  await expect(semi.locator('[data-result="lose"]')).toHaveClass(/grayscale/);
  await expect(semi.locator('[data-result="win"]')).toContainText('An Nguyễn');
  await expect.poll(() => page.locator('svg path').count()).toBeGreaterThan(2);
  await page.getByRole('tab', { name: 'Lịch thi đấu' }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Sân 2');
});

test('mobile list and detail have no horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockTournamentApi(page, { detail: tournament({ status: 'IN_PROGRESS' }) });
  await page.goto('/tournaments');
  await expect(page.getByRole('link', { name: /Giải đơn mùa đông 2026/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.goto('/tournaments/7');
  await page.getByRole('tab', { name: 'Nhánh đấu' }).click();
  await expect(page.locator('[data-match="103"]')).toBeAttached();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
});

test('a realtime update refreshes the bracket without waiting for polling', async ({ page }) => {
  const state = await mockTournamentApi(page, { detail: tournament({ status: 'IN_PROGRESS' }) });
  const watched: unknown[] = [];
  let push: (() => void) | null = null;
  await page.routeWebSocket('**/api/v1/ws/messaging', ws => {
    ws.onMessage(message => {
      const data = JSON.parse(String(message));
      watched.push(data);
      push = () => ws.send(JSON.stringify({ type: 'tournament.updated', data: { tournamentId: 7, scope: 'MATCH', tournamentMatchId: 102, version: 4 }, timestamp: new Date().toISOString() }));
    });
  });
  await page.goto('/tournaments/7');
  await expect(page.getByText(/Trực tiếp/)).toBeVisible();
  expect(watched).toContainEqual({ type: 'tournament.watch', tournamentId: 7 });
  await page.getByRole('tab', { name: 'Nhánh đấu' }).click();
  await expect(page.locator('[data-match="102"] [data-result="win"]')).toHaveCount(0);
  state.bracket = (await import('./tournament-fixtures')).bracket(true);
  push!();
  await expect(page.locator('[data-match="102"] [data-result="win"]')).toContainText('Bình Trần', { timeout: 3000 });
});
