import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const asOf = '2026-11-01T01:00:00.000Z';
const skill = { id: 1, code: 'AVERAGE', name: 'Trung bình', rank: 1, description: null };
const author = { id: 2, displayName: 'Lê Hoàng An', avatarUrl: null, skillLevel: skill };
const free = { id: 10, type: 'FREE', title: null, body: 'Một buổi tập thật vui cùng cộng đồng.', author, isAuthor: true, publishedAt: asOf, editedAt: null, isEdited: false, createdAt: asOf, images: [], reactions: { counts: { LIKE: 2 }, total: 2, viewerReaction: null }, commentCount: 3, recruitment: null };
const envelope = (data: unknown[]) => ({ data, meta: { page: 1, limit: 10, total: data.length, totalPages: 1, asOf } });

async function openFeed(page: Page, posts: unknown[] = [free], handlers: Record<string, (route: Route) => unknown> = {}) {
  const reads: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: [skill] } }),
    '/api/v1/posts': route => { reads.push(new URL(route.request().url()).searchParams); return route.fulfill({ json: envelope(posts) }); },
    ...handlers,
  } });
  await page.goto('/feed'); return reads;
}

for (const width of [390, 1280]) test(`feed ${width}: share-only layout fits without overflow`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const reads = await openFeed(page);
  await expect(page.getByText(free.body)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bảng tin cộng đồng' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lọc bài viết', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tìm người chơi', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Kèo của bạn' })).toHaveCount(0);
  expect(reads.at(-1)?.get('type')).toBe('FREE');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('legacy query parameters never bring match-finding posts into Community', async ({ page }) => {
  const reads = await openFeed(page);
  await page.goto('/feed?type=MATCH_FINDING&district=Qu%E1%BA%ADn%207&hasOpenSlots=true');
  await expect(page).toHaveURL(/\/feed$/);
  await expect.poll(() => reads.at(-1)?.get('type')).toBe('FREE');
  expect(reads.at(-1)?.has('district')).toBe(false);
});

test('empty state keeps its single share action', async ({ page }) => {
  await openFeed(page, []);
  await expect(page.getByRole('heading', { name: 'Cộng đồng đang chờ câu chuyện của bạn' })).toBeVisible();
  await page.getByRole('button', { name: 'Viết bài đầu tiên' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
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

test('non-author menu offers report and never author actions', async ({ page }) => {
  const stranger = { ...free, isAuthor: false };
  await openFeed(page, [stranger]); await page.getByRole('button', { name: 'Thao tác bài viết' }).click();
  const report = page.getByRole('menuitem', { name: 'Báo cáo bài viết' });
  await expect(report).toBeEnabled(); await report.click();
  await expect(page.getByRole('dialog', { name: 'Báo cáo bài viết' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Xóa bài viết' })).toHaveCount(0);
});

test('reaction toggle and skill catalogue failure keep their behavior', async ({ page }) => {
  let failing = true;
  await openFeed(page, [free], { '/api/v1/skill-levels': route => failing ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } }) : route.fulfill({ json: { data: [skill] } }) });
  await expect(page.getByRole('alert')).toContainText('Không thể tải danh mục trình độ.'); failing = false; await page.getByRole('button', { name: 'Tải lại trình độ' }).click(); await expect(page.getByRole('alert')).toHaveCount(0);
  const like = page.getByRole('button', { name: '👍 Thích', exact: true }); await expect(like).toHaveAttribute('aria-expanded', 'false');
  await like.click(); await expect(page.getByRole('group', { name: 'Cảm xúc bài viết' })).toBeVisible(); await expect(like).toHaveAttribute('aria-expanded', 'true');
});
