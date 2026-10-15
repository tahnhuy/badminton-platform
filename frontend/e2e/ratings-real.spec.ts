import { test, expect } from '@playwright/test';
import { resetDatabase } from './e2e-helpers';

test('real sessions persist ratings, history and automatic adjustment through Player and Admin UI', async ({ page, browser }) => {
  await resetDatabase();
  const response = await fetch('http://localhost:3000/api/v1/test/seed-ratings', { method: 'POST' });
  expect(response.ok).toBeTruthy();
  const fixture = await response.json();
  await page.goto('/sign-in');
  await page.locator('#email').fill(fixture.rater.email);
  await page.locator('#password').fill(fixture.rater.plainPassword);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL('/');
  await page.goto(`/matchmaking/matches/${fixture.matchId}`);
  await page.getByRole('button', { name: 'Đánh giá đối thủ' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Rating Target' }).check();
  await dialog.getByRole('radio', { name: 'Kỹ năng 5 trên 5' }).click();
  await dialog.getByRole('radio', { name: 'Thái độ 4 trên 5' }).click();
  await dialog.getByRole('textbox').fill('Đánh giá qua phiên đăng nhập thật');
  await dialog.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect(dialog.getByText('Đánh giá đã được ghi nhận.')).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Bạn đã đánh giá' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto('/ratings/given');
  await expect(page.getByText('Đánh giá qua phiên đăng nhập thật')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Đánh giá qua phiên đăng nhập thật')).toBeVisible();

  // A separate context authenticates as Admin against the actual API; no routes are mocked.
  const context = await browser.newContext();
  try {
    const login = await context.request.post('http://localhost:5173/api/v1/auth/login', { data: { email: fixture.admin.email, password: fixture.admin.plainPassword } });
    expect(login.status()).toBe(200);
    const csrf = (await context.cookies('http://localhost:5173')).find(cookie => cookie.name === 'csrf_token')!.value;
    const suspended = await context.request.patch(`http://localhost:5173/api/v1/admin/users/${fixture.target.id}/status`, { data: { status: 'SUSPENDED' }, headers: { 'X-CSRF-Token': csrf } });
    expect(suspended.status()).toBe(200);
    const adminPage = await context.newPage();
    await adminPage.goto('/admin/users');
    await adminPage.getByText('Rating Target', { exact: true }).first().click();
    await adminPage.getByRole('row').filter({ hasText: 'Rating Target' }).getByRole('button', { name: 'Xem chi tiết', exact: true }).click();
    await expect(adminPage.getByText('Đánh giá qua phiên đăng nhập thật')).toBeVisible();
    await expect(adminPage.getByText('Lịch sử điều chỉnh trình độ (1)', { exact: true })).toBeVisible();
    const history = await context.request.get(`http://localhost:5173/api/v1/users/${fixture.target.id}/skill-adjustments`);
    expect(history.status()).toBe(200);
    const result = await history.json();
    expect(result.data[0]).toMatchObject({ ratingsConsidered: 5, previousSkillLevel: { rank: 1 }, newSkillLevel: { rank: 2 } });
  } finally { await context.close(); }
});
