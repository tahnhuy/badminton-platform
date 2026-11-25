import { expect, test, type Page } from '@playwright/test';
import type { Bracket, TournamentDetail } from '../src/features/tournaments/types';

const FEE = 100_000;
const PASSWORD = 'ValidPassword123!';
const DAY = 86_400_000;
// Auth PRD example 2: initial level AVERAGE_MINUS (rank 3), score 55.8 clamped to
// 44.99 for rating. Two wins promote the champion while ranking keeps the draw's rank 3.
const SURVEY_ANSWERS = {
  yearsPlaying: '2Y_TO_4Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'NONE', returningAfterBreak: false,
  ...Object.fromEntries(['service', 'clear', 'smash', 'netPlay', 'defense', 'drive', 'backhand', 'footwork', 'doublesPlay'].map(name => [`skill.${name}`, 3])),
  rallyConsistency: '5_TO_9', stamina: '20_TO_40M', tournamentAchievement: 'NONE',
};

async function csrf(page: Page) {
  return { 'X-CSRF-Token': (await page.context().cookies()).find(c => c.name === 'csrf_token')?.value ?? '' };
}

async function api<T>(page: Page, method: 'get' | 'post', path: string, data?: object): Promise<T> {
  const response = await page.request[method](`/api/v1${path}`, { headers: await csrf(page), ...(data ? { data } : {}) });
  expect(response.ok(), `${method} ${path}: ${response.status()} ${await response.text()}`).toBe(true);
  return (await response.json()).data as T;
}

async function registerAndSignIn(page: Page, index: number): Promise<number> {
  const email = `tournament-live-${index}@example.test`;
  const account = await api<{ id: number }>(page, 'post', '/auth/register', {
    email, password: PASSWORD, fullName: index === 0 ? 'Organizer E2E' : `Vận động viên ${index}`,
    skillSurvey: { version: 1, answers: SURVEY_ANSWERS },
  });
  await page.goto('/sign-in');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).not.toHaveURL(/sign-in/);
  return account.id;
}

const localInput = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 16);

async function createTournament(page: Page): Promise<number> {
  const now = Date.now();
  await page.goto('/tournaments/new');
  await page.getByLabel('Tên giải', { exact: true }).fill('Giải đơn E2E thật');
  await page.getByLabel('Số lượng tối đa').fill('4');
  await page.getByLabel('Lệ phí (đồng)').fill(String(FEE));
  await page.getByLabel('Mở đăng ký', { exact: true }).fill(localInput(now - 3_600_000));
  await page.getByLabel('Hạn đăng ký', { exact: true }).fill(localInput(now + DAY));
  await page.getByLabel('Bắt đầu thi đấu', { exact: true }).fill(localInput(now + 2 * DAY));
  await page.getByLabel('Kết thúc', { exact: true }).fill(localInput(now + 3 * DAY));
  await page.getByLabel('Địa điểm', { exact: true }).fill('Nhà thi đấu E2E');
  const created = page.waitForResponse(r => new URL(r.url()).pathname === '/api/v1/tournaments' && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Tạo bản nháp', exact: true }).click();
  const response = await created;
  expect(response.status(), await response.text()).toBe(201);
  const id = (await response.json()).data.id as number;
  await expect(page).toHaveURL(new RegExp(`/tournaments/${id}/manage`));
  await page.getByRole('button', { name: 'Mở đăng ký', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Mở đăng ký', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await api<TournamentDetail>(page, 'get', `/tournaments/${id}`)).status).toBe('OPEN_FOR_REGISTRATION');
  return id;
}

async function enterTournament(page: Page, id: number): Promise<number> {
  const topUp = await api<{ topUpId: number }>(page, 'post', '/wallet/top-ups', { amount: '500000', provider: 'MOCK' });
  await api(page, 'post', `/wallet/top-ups/${topUp.topUpId}/mock-confirm`);
  await page.goto(`/tournaments/${id}`);
  await page.getByRole('button', { name: /^Đăng ký ·/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký giải', exact: true });
  await dialog.getByRole('button', { name: /^Xác nhận ·/ }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('Bạn đã đăng ký', { exact: false })).toBeVisible();
  const wallet = await api<{ balance: string }>(page, 'get', '/wallet');
  expect(Number(wallet.balance)).toBe(500_000 - FEE);
  return (await api<TournamentDetail>(page, 'get', `/tournaments/${id}`)).viewer.registrationId!;
}

async function drawTournament(page: Page, id: number) {
  await page.goto(`/tournaments/${id}/manage?section=setup`);
  expect((await api<TournamentDetail>(page, 'get', `/tournaments/${id}`)).confirmedCount).toBe(4);
  await page.getByRole('button', { name: 'Đóng đăng ký', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Đóng đăng ký', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /^Hạt giống & bốc thăm/ }).click();
  await page.getByRole('button', { name: 'Bốc thăm & xếp lịch', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bốc thăm', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await api<Bracket>(page, 'get', `/tournaments/${id}/bracket`)).rounds.flatMap(r => r.matches)).toHaveLength(3);
  await page.getByRole('button', { name: /^Trận đấu/ }).first().click();
}

async function playNextMatch(page: Page) {
  await page.getByRole('button', { name: 'Bắt đầu', exact: true }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhập tỉ số', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Set 1 – bên 1').fill('21');
  await dialog.getByLabel('Set 1 – bên 2').fill('10');
  await dialog.getByLabel('Set 2 – bên 1').fill('21');
  await dialog.getByLabel('Set 2 – bên 2').fill('12');
  await dialog.getByRole('button', { name: 'Lưu kết quả', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function verifyCompletion(page: Page, id: number, players: Array<{ page: Page; id: number; registrationId: number }>) {
  const detail = await api<TournamentDetail>(page, 'get', `/tournaments/${id}`);
  expect(detail.status).toBe('COMPLETED');
  expect(Number((await api<{ balance: string }>(page, 'get', '/wallet')).balance)).toBe(4 * FEE);
  const entries = await api<Array<{ entryType: string; amount: string; referenceId: number }>>(page, 'get', '/wallet/entries?limit=50');
  expect(entries.filter(e => e.entryType === 'TOURNAMENT_EARNING' && e.referenceId === id)).toEqual([expect.objectContaining({ amount: '400000.00' })]);
  const replay = await page.request.post(`/api/v1/tournaments/${id}/complete`, { headers: await csrf(page), data: { version: detail.version } });
  expect(replay.status()).toBe(409);
  await page.reload();
  expect(Number((await api<{ balance: string }>(page, 'get', '/wallet')).balance)).toBe(4 * FEE);
  const bracket = await api<Bracket>(page, 'get', `/tournaments/${id}/bracket`);
  const winner = players.find(p => p.registrationId === bracket.rounds.at(-1)!.matches[0].winnerRegistrationId)!;
  const rating = await api<{ ratedMatchCount: number; level: { rank: number } }>(winner.page, 'get', '/players/me/skill-rating');
  expect(rating).toMatchObject({ ratedMatchCount: 2, level: { rank: 4 } });
  const history = await api<Array<{ placement: string; rankingPoints: number }>>(winner.page, 'get', `/players/${winner.id}/tournaments`);
  expect(history[0]).toMatchObject({ placement: 'CHAMPION', rankingPoints: 37.5 });
  await expect(page.getByText(/Giải đã kết thúc lúc/)).toBeVisible();
}

test('real sessions: create → four paid registrations → draw → three matches → completion credits Organizer once', async ({ browser, page }) => {
  expect((await page.request.post('/api/v1/test/reset')).ok()).toBe(true);
  await registerAndSignIn(page, 0);
  const contexts = [];
  try {
    const id = await createTournament(page);
    const players: Array<{ page: Page; id: number; registrationId: number }> = [];
    for (let i = 1; i <= 4; i++) {
      const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
      contexts.push(context);
      const playerPage = await context.newPage();
      const playerId = await registerAndSignIn(playerPage, i);
      players.push({ page: playerPage, id: playerId, registrationId: await enterTournament(playerPage, id) });
    }
    expect(Number((await api<{ balance: string }>(page, 'get', '/wallet')).balance)).toBe(0);
    await drawTournament(page, id);
    for (let i = 0; i < 3; i++) await playNextMatch(page);
    await page.getByRole('button', { name: 'Kết thúc giải', exact: true }).click();
    await page.getByRole('button', { name: 'Kết thúc giải', exact: true }).and(page.locator('[data-slot="button"]')).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Kết thúc giải', exact: true }).click();
    await expect(page.getByText(/Giải đã kết thúc lúc/)).toBeVisible();
    await verifyCompletion(page, id, players);
  } finally { for (const context of contexts) await context.close(); }
});
