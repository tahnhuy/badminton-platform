import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const asOf = '2026-11-01T01:00:00.000Z';
const skills = [{ id: 1, code: 'AVERAGE', name: 'Trung bình', rank: 1, description: null }, { id: 2, code: 'GOOD', name: 'Khá', rank: 2, description: null }];
const author = { id: 2, displayName: 'Lê Hoàng An', avatarUrl: null, skillLevel: skills[0] };
const post = { id: 10, type: 'FREE', title: null, body: 'Một buổi tập thật vui cùng cộng đồng.', author, isAuthor: false, publishedAt: asOf, editedAt: null, isEdited: false, createdAt: asOf, images: [{ id: 5, url: '/api/v1/media/5', position: 0 }], reactions: { counts: {}, total: 0, viewerReaction: null }, commentCount: 1, recruitment: null as Record<string, unknown> | null };
const comment = { id: 1, postId: 10, body: 'Hẹn mọi người trên sân!', author: { id: 1, displayName: 'D01 Player', avatarUrl: null }, createdAt: asOf, canDelete: true };
const recruitment = { access: 'FULL', postId: 10, requestId: 20, viewerRelation: 'HOST', hostId: 1, matchType: 'GROUP', status: 'OPEN', startAt: '2099-11-03T11:00:00.000Z', durationMinutes: 90, capacity: 8, minPlayers: 4, companionCount: 2, filledSlots: 3, hasOpenSlots: true, ended: false, acceptedCount: 0, skillRange: { min: skills[0], max: skills[1] }, costNote: null, externalCourt: null, members: [] };
const detail = { id: 20, postId: 10, access: 'HOST', matchType: 'GROUP', status: 'OPEN', startAt: '2099-11-03T11:00:00.000Z', durationMinutes: 90, capacity: 8, minPlayers: 4, companionCount: 2, minSkillLevelId: 1, maxSkillLevelId: 2, costNote: null, externalCourt: null, acceptedCount: 0, members: [{ playerId: 1, displayName: 'D01 Player', isOwner: true }], invitationId: null, matchId: null };
const envelope = (data: unknown[]) => ({ data, meta: { page: 1, limit: 20, total: data.length, totalPages: 1, asOf } });

async function openPost(page: Page, data: Record<string, unknown> = post, handlers: Record<string, (route: Route) => unknown> = {}) {
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }),
    '/api/v1/posts/10': route => route.fulfill({ json: { data } }),
    '/api/v1/posts/10/comments': route => route.fulfill({ json: envelope([comment]) }),
    '/api/v1/media/5': route => route.fulfill({ path: 'e2e/profile-live/fixtures/avatar.png', contentType: 'image/png' }),
    '/api/v1/matchmaking-requests/20': route => route.fulfill({ json: { data: detail } }),
    ...handlers,
  } });
  await page.goto('/posts/10');
}

for (const width of [390, 1280]) test(`detail ${width}: match card and host actions fit without social interactions`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openPost(page, { ...post, type: 'MATCH_FINDING', isAuthor: true, publishedAt: null, recruitment });
  await expect(page.getByRole('heading', { name: 'Chi tiết kèo', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Bài tìm kèo chưa công khai' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Bình luận' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chốt kèo sớm' })).toBeVisible();
  const crumbs = page.getByRole('navigation', { name: 'Đường dẫn' });
  await expect(crumbs.getByRole('link', { name: 'Tìm đối thủ', exact: true })).toHaveAttribute('href', '/matchmaking');
  await expect(crumbs.getByRole('link', { name: 'Cộng đồng', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('invalid and unavailable posts keep their original recovery actions', async ({ page }) => {
  let reads = 0;
  await openPost(page, post, { '/api/v1/posts/10': route => { reads++; return route.fulfill({ status: 404, json: { error: { code: 'SOCIAL_POST_NOT_FOUND', message: 'x' } } }); } });
  await expect(page.getByRole('heading', { name: 'Nội dung không khả dụng' })).toBeVisible();
  const before = reads; await page.getByRole('button', { name: 'Thử tải lại' }).click(); await expect.poll(() => reads).toBeGreaterThan(before);
  await page.goto('/posts/abc'); await expect(page.getByRole('heading', { name: 'Nội dung không khả dụng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thử tải lại' })).toHaveCount(0); await expect(page.getByRole('link', { name: 'Về bảng tin' })).toHaveAttribute('href', '/feed');
});

test('lightbox and comment deletion return focus to their openers', async ({ page }) => {
  let deleted = false;
  await openPost(page, post, { '/api/v1/comments/1': route => { deleted = true; return route.fulfill({ json: { data: { id: 1, deleted: true } } }); } });
  const image = page.getByRole('button', { name: 'Xem Ảnh bài viết 1' }); await image.click();
  await expect(page.getByRole('dialog', { name: 'Ảnh bài viết' })).toBeVisible(); await page.keyboard.press('Escape'); await expect(image).toBeFocused();
  const remove = page.getByRole('button', { name: 'Xóa bình luận', exact: true }); await remove.click();
  const dialog = page.getByRole('dialog', { name: 'Xóa bình luận?' }); await dialog.getByRole('button', { name: 'Giữ bình luận' }).click();
  await expect(dialog).toHaveCount(0); await expect(remove).toBeFocused(); expect(deleted).toBe(false);
  await remove.click(); await dialog.getByRole('button', { name: 'Xác nhận xóa bình luận' }).click(); await expect(dialog).toHaveCount(0); expect(deleted).toBe(true);
});

test('composer keeps its draft open while saving and returns focus on Escape', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }),
    '/api/v1/posts': async route => { if (route.request().method() === 'GET') return route.fulfill({ json: envelope([]) }); await gate; return route.fulfill({ status: 201, json: { data: { ...post, isAuthor: true } } }); },
  } });
  await page.goto('/feed'); const share = page.getByRole('button', { name: /muốn chia sẻ điều gì hôm nay/ });
  await share.click(); const dialog = page.getByRole('dialog', { name: 'Tạo bài viết' }); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(share).toBeFocused();
  await share.click(); await dialog.getByLabel('Nội dung chia sẻ').fill('Bài mới'); await dialog.getByRole('button', { name: 'Đăng', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled(); await expect(dialog.getByLabel('Nội dung chia sẻ')).toBeDisabled();
  await page.keyboard.press('Escape'); await expect(dialog).toBeVisible(); release(); await expect(dialog).toHaveCount(0);
});

test('match composer shows type toggles, live preview and fits 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAuthApi(page, { user: account(), handlers: { '/api/v1/skill-levels': route => route.fulfill({ json: { data: skills } }), '/api/v1/posts': route => route.fulfill({ json: envelope([]) }) } });
  await page.goto('/matchmaking'); await page.getByRole('button', { name: 'Đăng kèo', exact: true }).first().click(); const dialog = page.getByRole('dialog', { name: 'Tạo bài tìm kèo' });
  await expect(dialog.getByRole('button', { name: 'Đôi · Tổng 4' })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Giao lưu', exact: true }).click(); await dialog.getByLabel('Người đi cùng không tài khoản').fill('2'); await dialog.getByLabel('Tiêu đề (không bắt buộc)').fill('Giao lưu tối thứ Sáu');
  await expect(dialog.getByRole('heading', { name: 'Giao lưu tối thứ Sáu' })).toBeVisible(); await expect(dialog).toContainText('1 + 2 người đi cùng / 8 chỗ');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
