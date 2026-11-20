import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const asOf = '2026-11-01T01:00:00.000Z';
const skill = { id: 1, code: 'AVERAGE', name: 'Trung bình', rank: 1, description: null };
const author = { id: 2, displayName: 'Lê Hoàng An', avatarUrl: null, skillLevel: skill };
const free = { id: 10, type: 'FREE', title: null, body: 'Một buổi tập thật vui cùng cộng đồng.', author, isAuthor: true, publishedAt: asOf, editedAt: null, isEdited: false, createdAt: asOf, images: [], reactions: { counts: { LIKE: 2 }, total: 2, viewerReaction: null }, commentCount: 3, recruitment: null };
const match = { ...free, id: 11, type: 'MATCH_FINDING', title: 'Kèo đôi tối thứ Ba', body: null, isAuthor: false, recruitment: { access: 'FULL', postId: 11, requestId: 21, viewerRelation: 'HOST', hostId: 1, matchType: 'DOUBLES', status: 'OPEN', startAt: '2099-11-03T11:00:00.000Z', durationMinutes: 90, capacity: 4, minPlayers: 4, companionCount: 0, filledSlots: 1, hasOpenSlots: true, ended: false, acceptedCount: 0, skillRange: { min: skill, max: skill }, costNote: 'Chia đều tiền sân', externalCourt: { name: 'Sân Mẫu', address: '1 Đường Mẫu', district: 'Quận 7', city: 'Hồ Chí Minh' }, members: [] } };
const envelope = (data: unknown[]) => ({ data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1, asOf } });

async function openFeed(page: Page, posts: unknown[] = [free, match], handlers: Record<string, (route: Route) => unknown> = {}) {
  const reads: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: [skill] } }),
    '/api/v1/posts': route => { reads.push(new URL(route.request().url()).searchParams); return route.fulfill({ json: envelope(posts) }); },
    ...handlers,
  } });
  await page.goto('/feed'); return reads;
}

for (const width of [390, 1280]) test(`feed ${width}: cards, rails and filter entry fit without overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await openFeed(page);
  const card = page.getByRole('article').filter({ hasText: 'Kèo đôi tối thứ Ba' });
  await expect(card).toContainText('Sân Mẫu · Quận 7, Hồ Chí Minh'); await expect(card).toContainText('1/4 chỗ · Còn 3 chỗ'); await expect(card).toContainText('Chia đều tiền sân');
  await expect(card.getByRole('link', { name: 'Quản lý kèo' })).toHaveAttribute('href', '/matchmaking/requests/21');
  await expect(card.getByRole('link', { name: 'Xem chi tiết' })).toHaveAttribute('href', '/posts/11');
  await expect(page.getByRole('heading', { name: 'Kèo của bạn' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lọc bài viết', exact: true })).toBeVisible({ visible: width < 768 });
  await expect(page.getByLabel('Quận / huyện', { exact: true })).toBeVisible({ visible: width >= 768 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('active filter chips have names, remove one key and clear all', async ({ page }) => {
  const reads = await openFeed(page);
  await page.goto('/feed?type=MATCH_FINDING&district=Qu%E1%BA%ADn%207&hasOpenSlots=true');
  await page.getByRole('button', { name: 'Bỏ lọc Quận: Quận 7', exact: true }).click();
  await expect(page).toHaveURL(/type=MATCH_FINDING&hasOpenSlots=true$/); await expect.poll(() => reads.at(-1)?.has('district')).toBe(false);
  await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click(); await expect(page).toHaveURL(/\/feed$/);
  await expect(page.getByText('Đang lọc:')).toHaveCount(0);
});

test('mobile filter sheet applies the canonical type and closes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); const reads = await openFeed(page);
  await page.getByRole('button', { name: 'Lọc bài viết', exact: true }).click(); const sheet = page.getByRole('dialog', { name: 'Bộ lọc bảng tin' });
  await sheet.getByLabel('Loại kèo').selectOption('DOUBLES'); await sheet.getByLabel('Tỉnh / thành phố').fill('  Hồ Chí Minh  '); await sheet.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(sheet).toHaveCount(0); await expect.poll(() => reads.at(-1)?.get('city')).toBe('Hồ Chí Minh');
  expect(reads.at(-1)?.get('type')).toBe('MATCH_FINDING'); expect(reads.at(-1)?.get('matchType')).toBe('DOUBLES');
});

test('empty states keep their original actions', async ({ page }) => {
  await openFeed(page, []);
  await expect(page.getByRole('heading', { name: 'Cộng đồng đang chờ câu chuyện của bạn' })).toBeVisible();
  await page.getByRole('button', { name: 'Viết bài đầu tiên' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await page.goto('/feed?type=FREE');
  await expect(page.getByRole('heading', { name: 'Không có bài viết phù hợp' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).last().click(); await expect(page).toHaveURL(/\/feed$/);
});

test('post menu is keyboard operable and delete dialog returns focus and blocks closing while busy', async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let deletes = 0;
  await openFeed(page, [free], { '/api/v1/posts/10': async route => { if (route.request().method() === 'DELETE') { deletes++; await gate; return route.fulfill({ json: { data: { id: 10, deleted: true } } }); } return route.fulfill({ json: { data: free } }); } });
  const trigger = page.getByRole('button', { name: 'Thao tác bài viết' });
  await trigger.focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('menuitem', { name: 'Chỉnh sửa bài viết' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole('menuitem', { name: 'Xóa bài viết' }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa bài chia sẻ?' }); await expect(dialog).toContainText('Bài viết sẽ không còn hiển thị trong cộng đồng.');
  await dialog.getByRole('button', { name: 'Giữ bài viết' }).click(); await expect(dialog).toHaveCount(0); await expect(trigger).toBeFocused(); expect(deletes).toBe(0);
  await trigger.click(); await page.getByRole('menuitem', { name: 'Xóa bài viết' }).click(); await dialog.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(dialog.getByRole('button', { name: 'Đang xóa…' })).toBeDisabled(); await page.keyboard.press('Escape'); await expect(dialog).toBeVisible();
  release(); await expect(page.getByRole('article')).toHaveCount(0); expect(deletes).toBe(1);
});

test('non-author menu keeps report disabled with its notice', async ({ page }) => {
  await openFeed(page, [match]); await page.getByRole('button', { name: 'Thao tác bài viết' }).click();
  await expect(page.getByRole('menuitem', { name: 'Báo cáo bài viết' })).toBeDisabled(); await expect(page.getByText('Báo cáo đang được hoàn thiện.')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Xóa bài viết' })).toHaveCount(0);
});

test('reaction toggle and skill catalogue failure keep their behavior', async ({ page }) => {
  let failing = true;
  await openFeed(page, [free], { '/api/v1/skill-levels': route => failing ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } }) : route.fulfill({ json: { data: [skill] } }) });
  await expect(page.getByRole('alert')).toContainText('Không thể tải danh mục trình độ.'); failing = false; await page.getByRole('button', { name: 'Tải lại trình độ' }).click(); await expect(page.getByRole('alert')).toHaveCount(0);
  const like = page.getByRole('button', { name: '👍 Thích', exact: true }); await expect(like).toHaveAttribute('aria-expanded', 'false');
  await like.click(); await expect(page.getByRole('group', { name: 'Cảm xúc bài viết' })).toBeVisible(); await expect(like).toHaveAttribute('aria-expanded', 'true');
});
