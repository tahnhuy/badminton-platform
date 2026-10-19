import path from 'path';
import { readFileSync } from 'fs';
import { test, expect } from '@playwright/test';

test('real registration/session → profile → save name → header/public view → reload', async ({ page }) => {
  const reset = await page.request.post('/api/v1/test/reset'); expect(reset.ok()).toBe(true);
  const registered = await page.request.post('/api/v1/auth/register', { data: {
    email: 'profile-live@example.test', password: 'ValidPassword123!', fullName: 'Tên từ đăng ký', skillLevelCode: 'AVERAGE',
  } });
  expect(registered.status()).toBe(201);
  const { data: account } = await registered.json();
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Đây là trang chủ', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Hồ sơ của tôi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tên từ đăng ký', exact: true })).toBeVisible();
  await expect(page.locator('.player-profile-pill')).toContainText('Tên từ đăng ký');
  await expect(page.getByText('Đánh giá chưa khả dụng', { exact: true })).toBeVisible();
  await expect(page.getByText('Thống kê chưa khả dụng', { exact: true })).toBeVisible();
  await expect(page.getByText('DỮ LIỆU MẪU', { exact: true })).toHaveCount(0);
  await expect(page.locator('#profile-avatar-file')).toHaveCount(1);
  await page.getByLabel('Tên hiển thị').fill('Tên đã lưu vào DB');
  await page.getByRole('button', { name: 'Lưu tên', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu tên');
  await expect(page.locator('.player-profile-pill')).toContainText('Tên đã lưu vào DB');
  await page.getByLabel('Đổi ảnh đại diện').setInputFiles(path.join(import.meta.dirname, 'fixtures/avatar.png'));
  await expect(page.getByRole('status').filter({ hasText: 'Đã cập nhật ảnh' })).toBeVisible();
  const avatarUrl = await page.getByRole('img', { name: 'Ảnh đại diện Tên đã lưu vào DB' }).getAttribute('src');
  expect(avatarUrl).toMatch(/^\/uploads\/avatars\//);
  await expect(page.locator('.player-profile-pill img')).toHaveAttribute('src', avatarUrl!);
  await page.getByLabel('Tên hiển thị').fill('Tên chưa lưu');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Ảnh đại diện Tên đã lưu vào DB' })).toHaveAttribute('src', avatarUrl!);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Tên đã lưu vào DB', exact: true })).toBeVisible();
  const response = await page.request.get(`/api/v1/players/${account.id}`);
  expect(response.status()).toBe(200);
  const { data: profile } = await response.json();
  expect(profile.fullName).toBe('Tên đã lưu vào DB');
  expect(profile.skillLevel.code).toBe('AVERAGE');
  expect(profile.avatarUrl).toBe(avatarUrl);
  expect((await page.request.get(avatarUrl!)).status()).toBe(200);
  expect(profile.ratings).toBeNull(); expect(profile.stats).toBeNull();
  expect(profile.email).toBeUndefined(); expect(profile.passwordHash).toBeUndefined();
  await page.screenshot({ path: '/tmp/player-profile-live-e2e.png', fullPage: true });
});

test('Matchmaking candidate opens a real public profile with uploaded avatar, then restores focus', async ({ page, request }) => {
  expect((await page.request.post('/api/v1/test/reset')).ok()).toBe(true);
  const opponent = await request.post('/api/v1/auth/register', { data: {
    email: 'opponent-profile@example.test', password: 'ValidPassword123!', fullName: 'Đối thủ có ảnh', skillLevelCode: 'AVERAGE',
  } });
  expect(opponent.status()).toBe(201);
  const opponentCsrf = (await request.storageState()).cookies.find(cookie => cookie.name === 'csrf_token')!.value;
  const image = await request.post('/api/v1/players/me/avatar', { headers: { 'X-CSRF-Token': opponentCsrf },
    multipart: { avatar: { name: 'avatar.png', mimeType: 'image/png', buffer: readFileSync(path.join(import.meta.dirname, 'fixtures/avatar.png')) } } });
  expect(image.status()).toBe(201); const { data: savedImage } = await image.json();
  expect((await page.request.post('/api/v1/auth/register', { data: {
    email: 'owner-profile@example.test', password: 'ValidPassword123!', fullName: 'Chủ nhóm', skillLevelCode: 'AVERAGE',
  } })).status()).toBe(201);
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'csrf_token')!.value;
  const levels = (await (await page.request.get('/api/v1/skill-levels')).json()).data;
  const level = levels.find((item: { code: string }) => item.code === 'AVERAGE').id;
  const preferredDate = new Date(Date.now() + 2 * 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const created = await page.request.post('/api/v1/matchmaking-requests', { headers: { 'X-CSRF-Token': csrf }, data: {
    matchType: 'SINGLES', preferredDate, preferredStartTime: '10:00', preferredEndTime: '14:00',
    minSkillLevelId: level, maxSkillLevelId: level, area: 'Quận 1, TP.HCM',
  } });
  expect(created.status()).toBe(201); const group = (await created.json()).data;
  await page.goto(`/matchmaking/requests/${group.id}`);
  const trigger = page.getByRole('button', { name: 'Xem hồ sơ Đối thủ có ảnh' });
  await trigger.click(); const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Đối thủ có ảnh', exact: true })).toBeVisible();
  await expect(modal.getByRole('img', { name: 'Ảnh đại diện Đối thủ có ảnh' })).toHaveAttribute('src', savedImage.avatarUrl);
  await expect(modal.getByText('opponent-profile@example.test')).toHaveCount(0);
  await expect(modal.getByRole('textbox')).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0); await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: 'Gửi lời mời', exact: true })).toBeEnabled();
});
