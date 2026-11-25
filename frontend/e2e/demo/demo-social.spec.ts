import { test, expect } from '@playwright/test';
import {
  apiRaw,
  apiRequest,
  createMatchPost,
  registerAccount,
  resetDatabase,
  resetSystemConfigs,
  skillLevels,
  vnIso,
} from '../e2e-helpers';

const BODY = 'Bài chia sẻ E2E có ảnh';
const EDITED_BODY = 'Bài chia sẻ E2E đã chỉnh sửa';

test.describe('Demo: social feed', () => {
  test.beforeEach(async () => {
    await resetDatabase();
    await resetSystemConfigs();
  });

  test('post with image, reaction change/remove, comment, edit and delete own post', async ({ browser }) => {
    test.setTimeout(180_000);
    const anCtx = await browser.newContext();
    const binhCtx = await browser.newContext();
    await registerAccount(anCtx, { email: 'demo_social_an@example.com', fullName: 'An Social' });
    await registerAccount(binhCtx, { email: 'demo_social_binh@example.com', fullName: 'Bình Social' });
    const anPage = await anCtx.newPage();
    const binhPage = await binhCtx.newPage();

    // Create a post with an image through the real composer.
    await anPage.goto('/feed');
    await expect(anPage.getByRole('heading', { name: 'Bảng tin cộng đồng', exact: true })).toBeVisible();
    await anPage.getByRole('button', { name: /muốn chia sẻ điều gì hôm nay\?/ }).click();
    const composer = anPage.getByRole('dialog');
    await expect(composer.getByRole('heading', { name: 'Tạo bài viết', exact: true })).toBeVisible();
    await composer.getByLabel('Nội dung chia sẻ').fill(BODY);
    await composer.locator('input[type="file"]').setInputFiles('e2e/profile-live/fixtures/avatar.png');
    await composer.getByRole('button', { name: 'Đăng', exact: true }).click();

    const anPost = anPage.getByRole('article', { name: 'Bài viết của An Social' });
    await expect(anPost).toBeVisible();
    await expect(anPost.getByText(BODY, { exact: true })).toBeVisible();
    await expect(anPost.locator('img[alt="Ảnh bài viết 1"]')).toBeVisible();

    const posts = await apiRequest<{ data: Array<{ id: number; body: string | null }> }>(anCtx, 'GET', '/posts?type=FREE&limit=50');
    const postId = posts.data.find((row) => row.body === BODY)!.id;

    // Another player reacts, changes the reaction, then removes it.
    await binhPage.goto('/feed');
    const binhView = binhPage.getByRole('article', { name: 'Bài viết của An Social' });
    await expect(binhView).toBeVisible();
    await binhView.getByRole('button', { name: /👍 Thích/ }).click();
    await binhView.getByRole('button', { name: 'Yêu thích', exact: true }).click();
    await expect(binhView.getByRole('button', { name: /❤️ Yêu thích/ })).toBeVisible();
    await binhView.getByRole('button', { name: 'Yêu thích', exact: true }).click();
    await expect(binhView.getByRole('button', { name: /👍 Thích/ })).toBeVisible();

    // Comment through the post detail page.
    await binhView.getByRole('link', { name: 'Bình luận', exact: true }).click();
    const commentRegion = binhPage.getByRole('region', { name: 'Bình luận' });
    await commentRegion.getByLabel('Viết bình luận').fill('Bình luận E2E');
    await commentRegion.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
    await expect(commentRegion.getByText('Bình luận E2E', { exact: true })).toBeVisible();

    // View another player's profile.
    await binhPage.goto('/feed');
    await binhPage.getByRole('button', { name: 'Xem hồ sơ An Social', exact: true }).click();
    const profile = binhPage.getByRole('dialog', { name: 'Hồ sơ người chơi' });
    await expect(profile).toBeVisible();
    await expect(profile.getByRole('region', { name: 'Thông tin người chơi' })).toBeVisible();
    await profile.getByRole('button', { name: 'Đóng', exact: true }).click();

    // A non-author cannot edit: no menu action and the API rejects it.
    const otherMenu = binhPage.getByRole('article', { name: 'Bài viết của An Social' }).getByRole('button', { name: 'Thao tác bài viết' });
    await otherMenu.click();
    await expect(binhPage.getByRole('menuitem', { name: 'Chỉnh sửa bài viết' })).toHaveCount(0);
    await binhPage.keyboard.press('Escape');
    const forbidden = await apiRaw(binhCtx, 'PATCH', `/posts/${postId}`, { body: 'Cố sửa bài người khác' });
    expect(forbidden.status()).toBe(403);

    // The author edits their own post.
    await anPage.goto('/feed');
    const editable = anPage.getByRole('article', { name: 'Bài viết của An Social' });
    await editable.getByRole('button', { name: 'Thao tác bài viết' }).click();
    await anPage.getByRole('menuitem', { name: 'Chỉnh sửa bài viết' }).click();
    const editDialog = anPage.getByRole('dialog');
    await editDialog.getByLabel('Nội dung chia sẻ').fill(EDITED_BODY);
    await editDialog.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click();
    await expect(anPage.getByRole('article', { name: 'Bài viết của An Social' })).toContainText(EDITED_BODY);
    await expect(anPage.getByText('Đã chỉnh sửa', { exact: true })).toBeVisible();

    // The author deletes their own post.
    const own = anPage.getByRole('article', { name: 'Bài viết của An Social' });
    await own.getByRole('button', { name: 'Thao tác bài viết' }).click();
    await anPage.getByRole('menuitem', { name: 'Xóa bài viết' }).click();
    await anPage.getByRole('dialog').getByRole('button', { name: 'Xác nhận xóa', exact: true }).click();
    await expect(anPage.getByRole('article', { name: 'Bài viết của An Social' })).toHaveCount(0);
    const deleted = await apiRaw(binhCtx, 'GET', `/posts/${postId}`);
    expect(deleted.status()).toBe(404);

    await anCtx.close();
    await binhCtx.close();
  });

  test('match-finding posts never appear in the Social feed', async ({ browser }) => {
    const anCtx = await browser.newContext();
    await registerAccount(anCtx, { email: 'demo_social_match@example.com', fullName: 'An Kèo' });
    const levels = await skillLevels(anCtx);
    const levelId = (levels.find((level) => level.rank === 4) ?? levels[0]).id;
    const matchBody = 'Kèo riêng không lên Social';
    const { postId } = await createMatchPost(anCtx, {
      matchType: 'SINGLES',
      startAt: vnIso(2, '10:00'),
      minSkillLevelId: levelId,
      maxSkillLevelId: levelId,
      body: matchBody,
    });

    const feed = await apiRequest<{ data: Array<{ id: number; body: string | null }> }>(
      anCtx,
      'GET',
      '/posts?type=FREE&limit=50'
    );
    expect(feed.data.find((row) => row.id === postId)).toBeUndefined();

    const anPage = await anCtx.newPage();
    await anPage.goto('/feed');
    await expect(anPage.getByRole('heading', { name: 'Bảng tin cộng đồng', exact: true })).toBeVisible();
    await expect(anPage.getByText(matchBody, { exact: true })).toHaveCount(0);

    // It is still reachable through its own matchmaking post route.
    const detail = await apiRequest<{ data: { id: number; type: string } }>(anCtx, 'GET', `/posts/${postId}`);
    expect(detail.data.type).toBe('MATCH_FINDING');

    await anCtx.close();
  });
});
