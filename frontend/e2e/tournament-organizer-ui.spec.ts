import { expect, test } from '@playwright/test';
import { mockTournamentApi, tournament } from './tournament-fixtures';

/** TRN-08 contract UI tests for the Organizer console (mocked API). */
test.use({ viewport: { width: 1280, height: 900 } });
const organizer = { isOrganizer: true, registrationId: null, eligible: false, ineligibleReason: 'ORGANIZER' };

test('creates a draft and opens its console', async ({ page }) => {
  const state = await mockTournamentApi(page, { extra: { '/api/v1/tournaments/9': route => route.fulfill({ json: { data: tournament({ id: 9, status: 'DRAFT', viewer: organizer }) } }) } });
  await page.goto('/tournaments/new');
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await expect(page.getByText('Tên giải từ 3 ký tự')).toBeVisible();
  expect(state.calls.filter(c => c.method === 'POST')).toHaveLength(0);
  await page.getByLabel('Tên giải').fill('Giải đơn mùa đông 2026');
  await page.getByLabel('Lệ phí (đồng)').fill('100000');
  await expect(page.getByText(/Xem trước: 100\.000\s*₫/)).toBeVisible();
  await page.getByRole('button', { name: 'Tạo bản nháp' }).click();
  await expect(page).toHaveURL(/\/tournaments\/9\/manage/);
  const body = state.calls.find(c => c.method === 'POST' && c.path === '/api/v1/tournaments')!.body as Record<string, unknown>;
  expect(body).toMatchObject({ name: 'Giải đơn mùa đông 2026', entryFee: 100000, matchType: 'SINGLES', courtCount: 2 });
  expect(String(body.tournamentStart)).toMatch(/Z$/);
  await expect(page.getByRole('button', { name: 'Mở đăng ký' })).toBeVisible();
});

test('a non-organizer sees the guard', async ({ page }) => {
  await mockTournamentApi(page);
  await page.goto('/tournaments/7/manage');
  await expect(page.getByText('Bạn không phải người tổ chức giải này')).toBeVisible();
});

test('records a set score with live validation and the winner preview', async ({ page }) => {
  const state = await mockTournamentApi(page, { detail: tournament({ status: 'IN_PROGRESS', viewer: organizer }) });
  await page.goto('/tournaments/7/manage');
  await expect(page.getByRole('button', { name: 'Trận đấu' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('button', { name: 'Nhập tỉ số' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Set 1 – bên 1').fill('21');
  await dialog.getByLabel('Set 1 – bên 2').fill('20');
  await expect(dialog.getByText('Set chưa kết thúc (21 điểm, cách 2, tối đa 30)')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Lưu kết quả' })).toBeDisabled();
  await dialog.getByLabel('Set 1 – bên 2').fill('19');
  await dialog.getByLabel('Set 2 – bên 1').fill('21');
  await dialog.getByLabel('Set 2 – bên 2').fill('17');
  await expect(dialog.getByText(/Người thắng:/)).toContainText('Bình Trần');
  await dialog.getByRole('button', { name: 'Lưu kết quả' }).click();
  await expect(dialog).toHaveCount(0);
  const put = state.calls.find(c => c.method === 'PUT')!;
  expect(put.path).toBe('/api/v1/tournaments/7/matches/102/result');
  expect(put.body).toEqual({ type: 'SETS', sets: [{ team1Score: 21, team2Score: 19 }, { team1Score: 21, team2Score: 17 }] });
});

test('edits a match schedule from the board', async ({ page }) => {
  const state = await mockTournamentApi(page, { detail: tournament({ status: 'IN_PROGRESS', viewer: organizer }) });
  await page.goto('/tournaments/7/manage?section=schedule');
  await page.getByRole('button', { name: /^Sửa lịch: .*Chung kết/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Sân').fill('Sân VIP');
  await dialog.getByRole('button', { name: 'Lưu' }).click();
  await expect(dialog.getByText('Đã lưu. Không có xung đột.')).toBeVisible();
  const patch = state.calls.find(c => c.method === 'PATCH')!;
  expect(patch.path).toBe('/api/v1/tournaments/7/matches/103/schedule');
  expect(patch.body).toMatchObject({ courtLabel: 'Sân VIP', scheduledAt: '2026-12-05T02:00:00.000Z' });
});

test('completes the tournament once the final has a winner', async ({ page }) => {
  const state = await mockTournamentApi(page, { finalDone: true, detail: tournament({ status: 'IN_PROGRESS', viewer: organizer }) });
  await page.goto('/tournaments/7/manage?section=finish');
  await expect(page.getByText('Vô địch')).toBeVisible();
  await expect(page.getByText('An Nguyễn').first()).toBeVisible();
  await page.getByRole('button', { name: 'Kết thúc giải' }).and(page.locator('[data-slot="button"]')).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Kết thúc giải' }).click();
  await expect(page.getByText(/Giải đã kết thúc lúc/)).toBeVisible();
  expect(state.calls.find(c => c.path.endsWith('/complete'))!.body).toEqual({ version: 3 });
});
