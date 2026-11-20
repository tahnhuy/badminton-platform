import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const skills = [{ id: 1, code: 'AVERAGE', name: 'Trung bình', rank: 1, description: null }, { id: 2, code: 'GOOD', name: 'Khá', rank: 2, description: null }];
const startAt = '2099-11-03T11:00:00.000Z';
const detail = { id: 20, postId: 10, access: 'HOST', matchType: 'GROUP', status: 'OPEN', startAt, durationMinutes: 90, capacity: 8, minPlayers: 4, companionCount: 1, minSkillLevelId: 1, maxSkillLevelId: 2, costNote: null, externalCourt: null, acceptedCount: 1, invitationId: null, matchId: null, conversationId: null, cancellationReason: null,
  members: [{ playerId: 1, displayName: 'Nguyễn Văn Chủ Kèo Rất Dài', isOwner: true }, { playerId: 5, displayName: 'Trần Thị Thành Viên', isOwner: false, skill: { id: 2, name: 'Khá', rank: 2 } }] };
const post = { id: 10, type: 'MATCH_FINDING', title: 'Giao lưu', body: null, author: { id: 1, displayName: 'Chủ', avatarUrl: null, skillLevel: skills[0] }, isAuthor: true, publishedAt: '2026-11-01T01:00:00.000Z', editedAt: null, isEdited: false, createdAt: '2026-11-01T01:00:00.000Z', images: [], reactions: { counts: {}, total: 0, viewerReaction: null }, commentCount: 0, recruitment: null };
const request = { id: 20, matchType: 'GROUP', status: 'OPEN', preferredDate: '2099-11-03', preferredStartTime: '18:00:00', preferredEndTime: '19:30:00', expiresAt: startAt, createdAt: '2026-11-01T01:00:00.000Z', area: 'Quận 7', matchDurationMinutes: 90, requiredPlayers: 8, acceptedCount: 1, remainingCount: 5, matchId: null, isOwner: false };
const invitation = (id: number, extra: Record<string, unknown> = {}) => ({ id, requestId: 20, matchId: null, direction: 'RECEIVED', status: 'PENDING', expiresAt: startAt, respondedAt: null, createdAt: '2026-11-01T01:00:00.000Z', counterpart: { playerId: 3, displayName: 'Lan', skill: null }, request, ...extra });
const envelope = (data: unknown[], totalPages = 1) => ({ data, meta: { page: 1, limit: 10, total: data.length, totalPages } });
type Handler = (route: Route) => unknown;

async function mock(page: Page, handlers: Record<string, Handler> = {}) {
  const writes: string[] = [];
  page.on('request', req => { if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method()) && req.url().includes('/api/v1/') && !req.url().includes('/auth/') && !req.url().includes('/presence/')) writes.push(`${req.method()} ${new URL(req.url()).pathname}`); });
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }),
    '/api/v1/matchmaking-requests/20': route => route.fulfill({ json: { data: detail } }),
    '/api/v1/posts/10': route => route.fulfill({ json: { data: post } }),
    '/api/v1/matchmaking-invitations': route => route.fulfill({ json: envelope([]) }),
    '/api/v1/matchmaking-requests/20/applications': route => route.fulfill({ json: envelope([]) }),
    '/api/v1/matchmaking-requests/20/candidates': route => route.fulfill({ json: envelope([]) }),
    ...handlers,
  } });
  return writes;
}

for (const width of [390, 1280]) test(`request detail ${width}: members stay on one line and the page fits`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mock(page); await page.goto('/matchmaking/requests/20');
  await expect(page.getByRole('heading', { name: 'Quản lý người tham gia' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem bài viết' })).toHaveAttribute('href', '/posts/10');
  const owner = page.getByRole('button', { name: 'Xem hồ sơ Nguyễn Văn Chủ Kèo Rất Dài', exact: true });
  const lineHeight = await owner.locator('span').last().evaluate(element => parseFloat(getComputedStyle(element).lineHeight) || 20);
  expect(await owner.locator('span').last().evaluate(element => element.getBoundingClientRect().height)).toBeLessThan(lineHeight * 2.5);
  await expect(page.getByRole('button', { name: 'Loại khỏi kèo' })).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('owner searches candidates, sends an invitation and cancels a pending one', async ({ page }) => {
  const searches: URLSearchParams[] = []; let pending = [invitation(31, { direction: 'SENT', counterpart: { playerId: 7, displayName: 'Minh', skill: null } })];
  const writes = await mock(page, {
    '/api/v1/matchmaking-requests/20/candidates': route => { searches.push(new URL(route.request().url()).searchParams); return route.fulfill({ json: envelope([{ playerId: 3, displayName: 'Lan', skill: { id: 3, name: 'Giỏi', rank: 3 }, skillMismatch: true }]) }); },
    '/api/v1/matchmaking-requests/20/invitations': route => { expect(route.request().postDataJSON()).toEqual({ inviteeId: 3 }); return route.fulfill({ status: 201, json: { data: { id: 32, status: 'PENDING' } } }); },
    '/api/v1/matchmaking-invitations': route => route.fulfill({ json: envelope(pending) }),
    '/api/v1/matchmaking-invitations/31/cancel': route => { pending = []; return route.fulfill({ json: { data: { id: 31, status: 'CANCELLED' } } }); },
  });
  await page.goto('/matchmaking/requests/20');
  await page.getByPlaceholder('Tìm theo tên người chơi').fill('Lan'); await expect.poll(() => searches.at(-1)?.get('search')).toBe('Lan');
  await page.getByLabel('Hiện cả người ngoài khoảng trình độ').check(); await expect.poll(() => searches.at(-1)?.get('includeOutOfRange')).toBe('true');
  await expect(page.getByText('Ngoài khoảng trình độ mong muốn')).toBeVisible();
  await page.getByRole('button', { name: 'Gửi lời mời' }).click(); await expect(page.getByRole('button', { name: 'Đã gửi lời mời' })).toBeDisabled();
  await page.getByRole('button', { name: 'Hủy lời mời' }).click(); await expect(page.getByText('Chưa có lời mời đang chờ trong trang này.')).toBeVisible();
  expect(writes).toEqual(['POST /api/v1/matchmaking-requests/20/invitations', 'POST /api/v1/matchmaking-invitations/31/cancel']);
});

for (const decision of ['ACCEPTED', 'DECLINED'] as const) test(`invitation inbox submits ${decision} and refreshes`, async ({ page }) => {
  let status = 'PENDING'; let reads = 0;
  await mock(page, {
    '/api/v1/matchmaking-invitations': route => { reads++; return route.fulfill({ json: envelope([invitation(9, { status })]) }); },
    '/api/v1/matchmaking-invitations/9': route => { expect(route.request().method()).toBe('PUT'); expect(route.request().postDataJSON()).toEqual({ decision }); status = decision; return route.fulfill({ json: { data: { invitationId: 9, requestId: 20, status: decision, matchId: null } } }); },
  });
  await page.goto('/matchmaking/invitations'); const card = page.getByRole('article', { name: 'Lời mời #9' });
  await expect(card).toContainText('Chờ phản hồi'); const before = reads;
  await card.getByRole('button', { name: decision === 'ACCEPTED' ? 'Chấp nhận' : 'Từ chối', exact: true }).click();
  await expect.poll(() => reads).toBeGreaterThan(before); await expect(card).toContainText(decision === 'ACCEPTED' ? 'Đã chấp nhận' : 'Đã từ chối');
  await expect(card.getByRole('button', { name: 'Chấp nhận', exact: true })).toHaveCount(0);
  if (decision === 'ACCEPTED') await expect(card.getByRole('link', { name: 'Xem nhóm' })).toHaveAttribute('href', '/matchmaking/requests/20');
});

test('accepted invitee can withdraw from an open group in the inbox', async ({ page }) => {
  const writes = await mock(page, {
    '/api/v1/matchmaking-invitations': route => route.fulfill({ json: envelope(new URL(route.request().url()).searchParams.get('direction') === 'SENT' ? [] : [invitation(9, { status: 'ACCEPTED' })]) }),
    '/api/v1/matchmaking-invitations/9/withdraw': route => route.fulfill({ json: { data: { id: 9, status: 'WITHDRAWN' } } }),
  });
  await page.goto('/matchmaking/invitations'); await page.getByRole('button', { name: 'Rút khỏi nhóm' }).click();
  await expect.poll(() => writes).toEqual(['POST /api/v1/matchmaking-invitations/9/withdraw']);
  await page.getByRole('group', { name: 'Hướng lời mời' }).getByRole('button', { name: 'Đã gửi' }).click();
  await expect(page.getByRole('heading', { name: 'Bạn chưa gửi lời mời nào' })).toBeVisible();
});

test('members and invitation counterparts open public profiles without mutations', async ({ page }) => {
  const writes = await mock(page, {
    '/api/v1/players/5': route => route.fulfill({ json: { data: { userId: 5, fullName: 'Trần Thị Thành Viên', avatarUrl: null, skillLevel: { code: 'GOOD', name: 'Khá', rank: 2, description: null }, ratings: null, stats: null } } }),
    '/api/v1/players/3': route => route.fulfill({ status: 404, json: { error: { code: 'PLAYER_NOT_FOUND' } } }),
    '/api/v1/matchmaking-invitations': route => route.fulfill({ json: envelope([invitation(9)]) }),
  });
  await page.goto('/matchmaking/requests/20'); await page.getByRole('button', { name: 'Xem hồ sơ Trần Thị Thành Viên', exact: true }).click();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Trần Thị Thành Viên', exact: true })).toBeVisible(); await page.keyboard.press('Escape');
  await page.goto('/matchmaking/invitations'); await page.getByRole('button', { name: 'Xem hồ sơ Lan', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Hồ sơ không khả dụng'); await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Chấp nhận', exact: true })).toBeEnabled(); expect(writes).toEqual([]);
});

test('member removal and court declaration keep their payloads and focus', async ({ page }) => {
  const writes = await mock(page, {
    '/api/v1/matchmaking-requests/20/members/5': route => route.fulfill({ json: { data: {} } }),
    '/api/v1/matchmaking-requests/20/court': route => { expect(route.request().postDataJSON()).toEqual({ name: 'Sân A', city: 'Hồ Chí Minh', district: 'Quận 7', address: '1 Đường A', kind: 'EXTERNAL' }); return route.fulfill({ json: { data: {} } }); },
  });
  await page.goto('/matchmaking/requests/20'); const remove = page.getByRole('button', { name: 'Loại khỏi kèo' });
  await remove.click(); const dialog = page.getByRole('dialog', { name: 'Loại người chơi khỏi kèo?' }); await expect(dialog).toContainText('Trần Thị Thành Viên');
  await dialog.getByRole('button', { name: 'Quay lại' }).click(); await expect(remove).toBeFocused();
  await remove.click(); await dialog.getByRole('button', { name: 'Loại khỏi kèo' }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('Đã cập nhật kèo.')).toBeVisible();
  await page.getByRole('button', { name: 'Thêm sân chơi' }).click(); const court = page.getByRole('dialog', { name: 'Khai báo sân chơi' });
  await court.getByLabel('Tên sân').fill('Sân A'); await court.getByLabel('Tỉnh / thành phố').fill('Hồ Chí Minh'); await court.getByLabel('Quận / huyện').fill('Quận 7'); await court.getByLabel('Địa chỉ').fill('1 Đường A');
  await court.getByRole('button', { name: 'Lưu sân chơi' }).click(); await expect(court).toHaveCount(0);
  expect(writes).toEqual(['DELETE /api/v1/matchmaking-requests/20/members/5', 'PUT /api/v1/matchmaking-requests/20/court']);
});

test('a failed refresh hides the management panel and post link as before', async ({ page }) => {
  let fail = false;
  await mock(page, { '/api/v1/matchmaking-requests/20': route => fail
    ? route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } })
    : route.fulfill({ json: { data: detail } }),
  });
  await page.goto('/matchmaking/requests/20');
  await expect(page.getByRole('link', { name: 'Xem bài viết' })).toBeVisible();
  fail = true;
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('alert')).toContainText('Không thể xem kèo này.');
  await expect(page.getByRole('link', { name: 'Xem bài viết' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Tham gia và quản lý kèo' })).toHaveCount(0);
});

test('confirmation stays disabled and open while its request is pending', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await mock(page, { '/api/v1/matchmaking-requests/20/cancel': async route => {
    await gate; return route.fulfill({ json: { data: {} } });
  } });
  await page.goto('/matchmaking/requests/20');
  await page.getByRole('button', { name: 'Hủy kèo', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Hủy kèo?', exact: true });
  await dialog.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Quay lại', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  release(); await expect(dialog).toHaveCount(0);
});
