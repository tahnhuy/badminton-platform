import { expect, test, type Page, type Route } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { account, mockAuthApi } from './auth-ui-mocks';

const skills = [{ id: 1, code: 'AVERAGE', name: 'Trung bình', rank: 1, description: null }, { id: 2, code: 'GOOD', name: 'Khá', rank: 2, description: null }];
const startAt = '2099-11-03T11:00:00.000Z';
const author = { id: 2, displayName: 'Lê Hoàng An', avatarUrl: null, skillLevel: skills[0] };
const recruitment = { access: 'PUBLIC', postId: 11, requestId: 21, viewerRelation: null, hostId: 2, matchType: 'DOUBLES', status: 'OPEN', startAt, durationMinutes: 90, capacity: 4, minPlayers: 4, companionCount: 0, filledSlots: 1, hasOpenSlots: true, ended: false, acceptedCount: 0, skillRange: { min: skills[0], max: skills[1] }, costNote: 'Chia đều tiền sân', externalCourt: { name: 'Sân Mẫu', address: '1 Đường Mẫu', district: 'Quận 7', city: 'Hồ Chí Minh' }, members: [] };
const post = { id: 11, type: 'MATCH_FINDING', title: 'Kèo đôi tối thứ Ba', body: 'Cần thêm người chơi vui vẻ.', author, isAuthor: false, publishedAt: '2026-11-01T01:00:00.000Z', editedAt: null, isEdited: false, createdAt: '2026-11-01T01:00:00.000Z', images: [], reactions: { counts: {}, total: 0, viewerReaction: null }, commentCount: 0, recruitment };
const envelope = (data: unknown[], page = 1, totalPages = 1) => ({ data, meta: { page, limit: 10, total: data.length, totalPages, asOf: '2026-11-01T01:00:00.000Z' } });
const request = { id: 21, isOwner: false, matchType: 'DOUBLES', status: 'OPEN', preferredDate: '2099-11-03', preferredStartTime: '18:00:00', preferredEndTime: '19:30:00', area: 'Quận 7, Hồ Chí Minh', matchDurationMinutes: 90, expiresAt: startAt, createdAt: '2026-11-01T01:00:00.000Z', requiredPlayers: 4, acceptedCount: 1, remainingCount: 2, matchId: null };

async function openDiscovery(page: Page, handlers: Record<string, (route: Route) => unknown> = {}) {
  const reads: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }),
    '/api/v1/posts': route => { reads.push(new URL(route.request().url()).searchParams); return route.fulfill({ json: envelope([post]) }); },
    ...handlers,
  } });
  await page.goto('/matchmaking'); return reads;
}

for (const width of [390, 1280]) test(`discovery ${width}: cards show recruitment facts without social interactions`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const reads = await openDiscovery(page);
  const card = page.getByRole('article', { name: 'Kèo Kèo đôi tối thứ Ba' });
  await expect(card).toContainText('Sân Mẫu · Quận 7, Hồ Chí Minh');
  await expect(card).toContainText('1/4 chỗ');
  await expect(card).toContainText('Chia đều tiền sân');
  await expect(card.getByRole('link', { name: 'Xem kèo' })).toHaveAttribute('href', '/posts/11');
  await expect(card.getByText(/cảm xúc|bình luận/i)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Hoạt động của tôi' })).toHaveAttribute('href', '/matchmaking/activity');
  const query = reads.at(-1)!;
  expect(query.get('type')).toBe('MATCH_FINDING');
  expect(query.get('hasOpenSlots')).toBe('true');
  expect(query.get('sort')).toBe('upcoming');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('filters, sort and page live in the URL and reach the server', async ({ page }) => {
  const reads = await openDiscovery(page);
  const city = page.getByRole('combobox', { name: 'Tỉnh / thành phố' });
  await city.fill('Hồ Chí Minh');
  await expect.poll(() => reads.at(-1)?.get('city')).toBe('Hồ Chí Minh');
  expect(reads.at(-1)?.get('type')).toBe('MATCH_FINDING');
  await chooseSelectOption(page.getByLabel('Sắp xếp'), 'newest');
  await expect.poll(() => reads.at(-1)?.get('sort')).toBe('newest');
  await expect(page).toHaveURL(/sort=newest/);
});

test('core filters stay compact; extended filters are opt-in', async ({ page }) => {
  await openDiscovery(page);
  await expect(page.getByRole('combobox', { name: 'Tỉnh / thành phố' })).toBeVisible();
  await expect(page.getByLabel('Loại kèo')).toHaveCount(0);
  await page.getByRole('button', { name: /Ngày giờ & bộ lọc khác/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Ngày giờ và bộ lọc kèo' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel('Loại kèo')).toBeVisible();
  await expect(dialog.getByLabel('Từ giờ')).toBeVisible();
  await expect(dialog.getByLabel('Chỉ kèo còn chỗ')).toBeChecked();
});

test('clear filters restores the published defaults', async ({ page }) => {
  const reads = await openDiscovery(page);
  await page.goto('/matchmaking?district=Qu%E1%BA%ADn%207&hasOpenSlots=false');
  await page.getByRole('button', { name: 'Xóa bộ lọc' }).first().click();
  await expect.poll(() => reads.at(-1)?.get('hasOpenSlots')).toBe('true');
  await expect(page).toHaveURL(/hasOpenSlots=true/);
  expect(reads.at(-1)?.has('district')).toBe(false);
});

test('legacy tabs and invitations link redirect into Hoạt động của tôi', async ({ page }) => {
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }),
    '/api/v1/posts': route => route.fulfill({ json: envelope([post]) }),
    '/api/v1/matchmaking-requests': route => route.fulfill({ json: envelope([request]) }),
    '/api/v1/matchmaking-invitations': route => route.fulfill({ json: envelope([]) }),
    '/api/v1/matchmaking-applications': route => route.fulfill({ json: envelope([]) }),
  } });
  await page.goto('/matchmaking?tab=requests'); await expect(page).toHaveURL('/matchmaking/activity?section=created');
  await page.goto('/matchmaking?tab=applications'); await expect(page).toHaveURL('/matchmaking/activity?section=joined#applications');
  await page.goto('/matchmaking/invitations'); await expect(page).toHaveURL('/matchmaking/activity#invitations');
  await page.goto('/matchmaking/invitations?direction=SENT'); await expect(page).toHaveURL('/matchmaking/activity?section=created#invitations');
});

test('activity separates Kèo tham gia from Kèo đã tạo and keeps Các trận của tôi', async ({ page }) => {
  const roles: string[] = [];
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }),
    '/api/v1/matchmaking-requests': route => { roles.push(new URL(route.request().url()).searchParams.get('role') ?? ''); return route.fulfill({ json: envelope([request]) }); },
    '/api/v1/matchmaking-invitations': route => route.fulfill({ json: envelope([]) }),
    '/api/v1/matchmaking-applications': route => route.fulfill({ json: envelope([]) }),
  } });
  await page.goto('/matchmaking/activity');
  await expect(page.getByRole('button', { name: 'Kèo tham gia' })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => roles).toContain('member');
  await expect(page.getByRole('link', { name: 'Các trận của tôi' })).toHaveAttribute('href', '/matchmaking/matches');
  await page.getByRole('button', { name: 'Kèo đã tạo' }).click(); await expect(page).toHaveURL('/matchmaking/activity?section=created');
  await expect.poll(() => roles).toContain('host');
});

test('create action opens the full match-finding composer', async ({ page }) => {
  await openDiscovery(page); await page.getByRole('button', { name: 'Đăng kèo' }).first().click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toHaveAccessibleName('Tạo bài tìm kèo');
  await expect(dialog.getByRole('button', { name: 'Giao lưu', exact: true })).toBeVisible();
});
