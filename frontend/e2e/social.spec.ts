import { expect, test, type Page } from '@playwright/test';

const asOf = '2026-11-01T01:00:00.000Z';
const skills = [{ id: 1, code: 'AVERAGE', name: 'Trung bình', rank: 1, description: null }, { id: 2, code: 'GOOD', name: 'Khá', rank: 2, description: null }];
const profile = { userId: 1, fullName: 'Nguyễn Văn Nam', avatarUrl: null, skillLevel: skills[0], ratings: null, stats: null };
const base = { id: 10, type: 'FREE', title: null, body: 'Một buổi tập thật vui cùng cộng đồng.', author: { id: 2, displayName: 'Lê Hoàng An', avatarUrl: null, skillLevel: skills[0] }, isAuthor: false, publishedAt: asOf, editedAt: null, isEdited: false, createdAt: asOf, images: [], reactions: { counts: { LIKE: 2 }, total: 2, viewerReaction: null as string | null }, commentCount: 0, recruitment: null as Record<string, unknown> | null };
const startAt = '2099-11-03T11:00:00.000Z';
const recruitment = { access: 'FULL', postId: 10, requestId: 20, viewerRelation: 'HOST', hostId: 1, matchType: 'GROUP', status: 'OPEN', startAt, durationMinutes: 90, capacity: 8, minPlayers: 4, companionCount: 2, filledSlots: 3, hasOpenSlots: true, ended: false, acceptedCount: 0, skillRange: { min: skills[0], max: skills[1] }, costNote: 'Thống nhất trực tiếp', externalCourt: null, members: [] };
const detail = { id: 20, postId: 10, access: 'HOST', matchType: 'GROUP', status: 'OPEN', startAt, durationMinutes: 90, capacity: 8, minPlayers: 4, companionCount: 2, minSkillLevelId: 1, maxSkillLevelId: 2, costNote: null, externalCourt: null, acceptedCount: 0, members: [{ playerId: 1, displayName: 'Nguyễn Văn Nam', isOwner: true }], invitationId: null, matchId: null };
function envelope(data: unknown[], page = 1, totalPages = 1) { return { data, meta: { page, limit: 10, total: data.length, totalPages, asOf } }; }
async function setup(page: Page) {
  await page.route('**/api/v1/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') return route.fulfill({ json: { data: { id: 1, email: 'player@example.test', role: 'PLAYER', requiresPasswordChange: false } } });
    if (path === '/api/v1/players/me') return route.fulfill({ json: { data: profile } });
    if (path === '/api/v1/skill-levels') return route.fulfill({ json: { data: skills } });
    if (path === '/api/v1/posts') return route.fulfill({ json: envelope([base]) });
    if (path === '/api/v1/posts/10') return route.fulfill({ json: { data: base } });
    if (path === '/api/v1/posts/10/comments') return route.fulfill({ json: envelope([]) });
    if (path === '/api/v1/matchmaking-requests/20') return route.fulfill({ json: { data: detail } });
    if (path === '/api/v1/matchmaking-applications' || path.endsWith('/applications')) return route.fulfill({ json: envelope([]) });
    if (path.includes('/candidates') || path === '/api/v1/matchmaking-invitations' || path === '/api/v1/matchmaking-requests') return route.fulfill({ json: envelope([]) });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Unavailable' } } });
  });
}
test.beforeEach(async ({ page }) => { await setup(page); });

test('feed keeps asOf, de-duplicates pages and retries a failed next page', async ({ page }) => {
  let failed = false;
  await page.route('**/api/v1/posts?**', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('page') === '2') {
      expect(url.searchParams.get('asOf')).toBe(asOf);
      if (!failed) { failed = true; return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE' } } }); }
      return route.fulfill({ json: envelope([base, { ...base, id: 11, body: 'Bài viết ở trang tiếp theo.' }], 2, 2) });
    }
    return route.fulfill({ json: envelope([base], 1, 2) });
  });
  await page.goto('/feed'); await expect(page.getByText(base.body)).toBeVisible();
  await page.getByRole('button', { name: 'Xem thêm bài viết' }).click();
  await expect(page.getByRole('alert')).toBeVisible(); await page.getByRole('button', { name: 'Thử tải lại bảng tin' }).click();
  await expect(page.getByText('Bài viết ở trang tiếp theo.')).toBeVisible(); await expect(page.getByText(base.body)).toHaveCount(1);
});

test('filters use real query fields and reset the snapshot', async ({ page }) => {
  await page.goto('/feed');
  await page.getByLabel('Quận / huyện', { exact: true }).fill('Quận 7'); await page.getByLabel('Ngày chơi', { exact: true }).fill('2099-11-03');
  const read = page.waitForRequest(request => request.url().includes('/api/v1/posts?') && request.url().includes('district='));
  await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  const url = new URL((await read).url()); expect(url.searchParams.get('type')).toBe('MATCH_FINDING'); expect(url.searchParams.get('date')).toBe('2099-11-03'); expect(url.searchParams.has('asOf')).toBe(false);
});

test('multipart draft survives an ambiguous failure and reuses its request ID', async ({ page }) => {
  const keys: string[] = []; let attempts = 0;
  await page.context().addCookies([{ name: 'csrf_token', value: 'csrf-social', url: 'http://localhost:5180' }]);
  await page.route('**/api/v1/posts', async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: envelope([base]) });
    expect(route.request().headers()['x-csrf-token']).toBe('csrf-social');
    expect(route.request().headers()['content-type']).toContain('multipart/form-data; boundary=');
    const raw = route.request().postData() ?? ''; keys.push(JSON.parse(raw.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)![1]).clientRequestId);
    if (++attempts === 1) return route.abort();
    return route.fulfill({ status: 201, json: { data: { ...base, body: 'Bài mới', isAuthor: true } } });
  });
  await page.goto('/feed'); await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click();
  const dialog = page.getByRole('dialog'); await dialog.getByLabel('Nội dung chia sẻ').fill('Bài mới');
  await dialog.getByRole('button', { name: 'Đăng lên bảng tin' }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
  await expect(dialog.getByLabel('Nội dung chia sẻ')).toHaveValue('Bài mới'); await dialog.getByRole('button', { name: 'Đăng lên bảng tin' }).click();
  await expect(dialog).toHaveCount(0); expect(keys).toHaveLength(2); expect(keys[0]).toBe(keys[1]);
});

test('changed draft receives a different idempotency key', async ({ page }) => {
  const keys: string[] = [];
  await page.route('**/api/v1/posts', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope([base]) });
    const raw = route.request().postData() ?? ''; keys.push(JSON.parse(raw.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)![1]).clientRequestId); return route.abort();
  });
  await page.goto('/feed'); await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nội dung chia sẻ').fill('Nội dung ban đầu'); await dialog.getByRole('button', { name: 'Đăng lên bảng tin' }).click(); await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel('Nội dung chia sẻ').fill('Nội dung đã thay đổi'); await dialog.getByRole('button', { name: 'Đăng lên bảng tin' }).click(); await expect.poll(() => keys.length).toBe(2); expect(keys[0]).not.toBe(keys[1]);
});

test('reaction switches and removes without optimistic false success', async ({ page }) => {
  let post = structuredClone(base); const methods: string[] = [];
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: post } }));
  await page.route('**/api/v1/posts/10/reaction', route => {
    methods.push(route.request().method()); post = { ...post, reactions: { ...post.reactions, viewerReaction: route.request().method() === 'DELETE' ? null : route.request().postDataJSON().type } }; return route.fulfill({ json: { data: { postId: 10, type: post.reactions.viewerReaction } } });
  });
  await page.goto('/posts/10'); await page.getByRole('button', { name: 'Yêu thích', exact: true }).click(); await expect(page.getByRole('button', { name: 'Yêu thích', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Yêu thích', exact: true }).click(); await expect(page.getByRole('button', { name: 'Yêu thích', exact: true })).toHaveAttribute('aria-pressed', 'false'); expect(methods).toEqual(['PUT', 'DELETE']);
});

test('rate limit preserves a comment, exposes Retry-After, and retries the same key', async ({ page }) => {
  const keys: string[] = []; let sent = false;
  await page.route('**/api/v1/posts/10/comments**', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope(sent ? [{ id: 1, postId: 10, body: 'Hẹn mọi người trên sân!', author: { id: 1, displayName: profile.fullName, avatarUrl: null }, createdAt: asOf, canDelete: true }] : []) });
    keys.push(route.request().postDataJSON().clientRequestId);
    if (keys.length === 1) return route.fulfill({ status: 429, headers: { 'Retry-After': '17' }, json: { error: { code: 'SOCIAL_RATE_LIMITED', message: 'Giới hạn' } } });
    sent = true; return route.fulfill({ status: 201, json: { data: {} } });
  });
  await page.goto('/posts/10'); await page.getByLabel('Viết bình luận').fill('Hẹn mọi người trên sân!'); await page.getByRole('button', { name: 'Gửi bình luận' }).click();
  await expect(page.getByRole('alert')).toContainText('17 giây'); await expect(page.getByLabel('Viết bình luận')).toHaveValue('Hẹn mọi người trên sân!');
  await page.getByRole('button', { name: 'Gửi bình luận' }).click(); await expect(page.getByLabel('Viết bình luận')).toHaveValue(''); await expect(page.getByText('Hẹn mọi người trên sân!', { exact: true })).toBeVisible(); expect(keys[0]).toBe(keys[1]);
});

test('GROUP companions alone cannot close and no chat lifecycle is rendered', async ({ page }) => {
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', title: 'Giao lưu cuối tuần', isAuthor: true, recruitment: { ...recruitment, filledSlots: 5, companionCount: 4 } } } }));
  await page.route('**/api/v1/matchmaking-requests/20', route => route.fulfill({ json: { data: { ...detail, companionCount: 4 } } }));
  await page.goto('/posts/10'); await expect(page.getByRole('button', { name: 'Chốt kèo sớm' })).toBeDisabled(); await expect(page.getByRole('button', { name: 'Xin tham gia' })).toHaveCount(0);
  await expect(page.getByText(/Nhóm chat được tạo|Mở nhóm chat|24 giờ/)).toHaveCount(0);
});

test('host deletion uses KEEP and requires explicit confirmation', async ({ page }) => {
  let deleted = false;
  await page.route('**/api/v1/posts/10**', route => {
    if (route.request().method() === 'DELETE') { expect(new URL(route.request().url()).searchParams.get('bookingAction')).toBe('KEEP'); deleted = true; return route.fulfill({ json: { data: { id: 10, deleted: true } } }); }
    if (new URL(route.request().url()).pathname.endsWith('/comments')) return route.fulfill({ json: envelope([]) });
    return route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', isAuthor: true, recruitment } } });
  });
  await page.goto('/posts/10'); await page.getByLabel('Thao tác bài viết').click(); await page.getByRole('menuitem', { name: 'Xóa bài viết', exact: true }).click();
  expect(deleted).toBe(false); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('Booking được giữ nguyên'); await dialog.getByRole('button', { name: 'Xác nhận xóa', exact: true }).click(); await expect(page).toHaveURL(/\/feed$/); expect(deleted).toBe(true);
});

test('hidden post is neutral but authorized host management remains available', async ({ page }) => {
  await page.route('**/api/v1/posts/10', route => route.fulfill({ status: 404, json: { error: { code: 'SOCIAL_POST_NOT_FOUND', message: 'Không khả dụng' } } }));
  await page.goto('/posts/10'); await expect(page.getByRole('heading', { name: 'Nội dung không khả dụng' })).toBeVisible(); await expect(page.getByLabel('Viết bình luận')).toHaveCount(0);
  await page.goto('/matchmaking/requests/20'); await expect(page.getByRole('button', { name: 'Hủy kèo', exact: true })).toBeVisible(); await expect(page.getByText('Nội dung bài viết không khả dụng.', { exact: false })).toBeVisible();
});

test('mobile filters/composer fit at 390px and restore focus on Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/feed');
  const filter = page.getByRole('button', { name: 'Lọc bài viết', exact: true }); await filter.click(); await expect(page.getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape'); await expect(filter).toBeFocused();
  await page.getByRole('button', { name: 'Tìm người chơi', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: 'Giao lưu', exact: true }).click(); await expect(dialog.getByLabel('Người đi cùng không tài khoản')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('creates an unpublished GROUP with the canonical payload and no booking/chat fields', async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/v1/posts', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: envelope([base]) });
    payload = JSON.parse(route.request().postData()!.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)![1]);
    return route.fulfill({ status: 201, json: { data: { ...base, publishedAt: null, type: 'MATCH_FINDING', recruitment } } });
  });
  await page.goto('/feed'); await page.getByRole('button', { name: 'Tìm người chơi', exact: true }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Giao lưu', exact: true }).click(); await dialog.getByLabel('Ngày chơi', { exact: true }).fill('2099-11-03'); await dialog.getByLabel('Giờ bắt đầu').fill('18:00');
  await dialog.getByRole('button', { name: 'Tạo kèo chưa công khai' }).click(); await expect(page).toHaveURL(/\/posts\/10$/);
  expect(payload).toMatchObject({ type: 'MATCH_FINDING', publish: false, recruitment: { matchType: 'GROUP', startAt, durationMinutes: 90, capacity: 8, minPlayers: 4, companionCount: 0, minSkillLevelId: 1, maxSkillLevelId: 2 } });
  expect(JSON.stringify(payload)).not.toMatch(/booking|conversation|message/i);
});

test('desktop feed and shared shell render without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 }); await page.goto('/feed'); await expect(page.getByText(base.body)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('image validation rejects documents and preserves a selected image after failure', async ({ page }) => {
  await page.route('**/api/v1/posts', route => route.request().method() === 'GET' ? route.fulfill({ json: envelope([base]) }) : route.abort());
  await page.goto('/feed'); await page.getByRole('button', { name: 'Chia sẻ', exact: true }).click(); const dialog = page.getByRole('dialog');
  const input = dialog.locator('input[type=file]');
  await input.setInputFiles({ name: 'document.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not an image') });
  await expect(dialog.getByRole('alert')).toContainText('JPEG, PNG hoặc WebP');
  await input.setInputFiles('e2e/profile-live/fixtures/avatar.png');
  await expect(dialog.getByAltText('avatar.png')).toBeVisible(); await dialog.getByRole('button', { name: 'Đăng lên bảng tin' }).click(); await expect(dialog.getByRole('alert')).toBeVisible(); await expect(dialog.getByAltText('avatar.png')).toBeVisible();
});

test('author edits preserve image IDs and send only Social content fields', async ({ page }) => {
  let post = { ...base, isAuthor: true, images: [{ id: 5, url: '/api/v1/media/5', position: 0 }] }; let payload: unknown;
  await page.route('**/api/v1/media/5', route => route.fulfill({ path: 'e2e/profile-live/fixtures/avatar.png', contentType: 'image/png' }));
  await page.route('**/api/v1/posts/10', route => {
    if (route.request().method() === 'PATCH') { payload = JSON.parse(route.request().postData()!.match(/\r\n\r\n(\{[^\r\n]+\})\r\n/)![1]); post = { ...post, body: 'Đã cập nhật nội dung.' }; }
    return route.fulfill({ json: { data: post } });
  });
  await page.goto('/posts/10'); await page.getByLabel('Thao tác bài viết').click(); await page.getByRole('menuitem', { name: 'Chỉnh sửa bài viết' }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nội dung chia sẻ').fill('Đã cập nhật nội dung.'); await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByText('Đã cập nhật nội dung.', { exact: true })).toBeVisible();
  expect(payload).toEqual({ body: 'Đã cập nhật nội dung.', keepImageIds: [5] });
});

test('Social gate blocks writes without removing read or author deletion', async ({ page }) => {
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, isAuthor: true } } }));
  await page.route('**/api/v1/posts/10/reaction', route => route.fulfill({ status: 409, json: { error: { code: 'SOCIAL_DISABLED', message: 'Tính năng cộng đồng đang tạm khóa' } } }));
  await page.goto('/posts/10'); await page.getByRole('button', { name: 'Yêu thích', exact: true }).click(); await expect(page.getByRole('alert')).toContainText('tạm khóa'); await expect(page.getByText(base.body)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Yêu thích', exact: true })).toBeDisabled(); await page.getByLabel('Thao tác bài viết').click(); await expect(page.getByRole('menuitem', { name: 'Xóa bài viết', exact: true })).toBeEnabled();
});

test('pending invitee can accept a published post without a self-Apply action', async ({ page }) => {
  let accepted = false;
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', recruitment: { ...recruitment, access: 'PUBLIC', viewerRelation: 'PENDING' } } } }));
  await page.route('**/api/v1/matchmaking-requests/20', route => route.fulfill({ json: { data: { ...detail, access: accepted ? 'MEMBER' : 'PUBLIC', invitationId: 30 } } }));
  await page.route('**/api/v1/matchmaking-invitations/30', route => { expect(route.request().postDataJSON()).toEqual({ decision: 'ACCEPTED' }); accepted = true; return route.fulfill({ json: { data: { invitationId: 30, requestId: 20, status: 'ACCEPTED', matchId: null } } }); });
  await page.goto('/posts/10'); await expect(page.getByRole('button', { name: 'Xin tham gia', exact: true })).toHaveCount(0); await page.getByRole('button', { name: 'Chấp nhận lời mời' }).click(); await expect(page.getByRole('button', { name: 'Rút khỏi kèo' })).toBeVisible(); expect(accepted).toBe(true);
});

test('Matchmaking creation uses the same Social composer', async ({ page }) => {
  await page.goto('/matchmaking'); await page.getByRole('button', { name: '+ Tạo yêu cầu' }).click(); const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Tạo bài tìm kèo'); await expect(dialog.getByRole('button', { name: 'Giao lưu', exact: true })).toBeVisible(); await expect(dialog.getByText('Booking của bạn')).toHaveCount(0);
});

test('historical acceptance locks restricted fields and a retry sends only editable fields', async ({ page }) => {
  const patches: Record<string, unknown>[] = [];
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', recruitment } } }));
  await page.route('**/api/v1/matchmaking-requests/20', route => {
    if (route.request().method() === 'PATCH') {
      patches.push(route.request().postDataJSON());
      if (patches.length === 1) return route.fulfill({ status: 409, json: { error: { code: 'MATCHMAKING_FIELD_LOCKED', message: 'Không thể đổi giờ bắt đầu, loại kèo hoặc số chỗ sau khi đã có thành viên' } } });
    }
    return route.fulfill({ json: { data: detail } });
  });
  await page.goto('/posts/10'); await page.getByRole('button', { name: 'Sửa thông tin kèo' }).click(); const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Ngày giờ bắt đầu (Việt Nam)').fill('2099-11-04T18:00'); await dialog.getByRole('button', { name: 'Lưu thông tin kèo' }).click(); await expect(dialog.getByRole('alert')).toContainText('Không thể đổi');
  await expect(dialog.getByLabel('Ngày giờ bắt đầu (Việt Nam)')).toBeDisabled(); await expect(dialog.getByLabel('Loại kèo', { exact: true })).toBeDisabled(); await expect(dialog.getByLabel('Tổng số chỗ')).toBeDisabled();
  await dialog.getByLabel('Thời lượng (phút)').fill('120'); await dialog.getByLabel('Tối thiểu để chốt').fill('3'); await dialog.getByRole('button', { name: 'Lưu thông tin kèo' }).click(); await expect(dialog).toHaveCount(0);
  expect(patches[0]).toHaveProperty('startAt'); expect(patches[1]).not.toHaveProperty('startAt'); expect(patches[1]).not.toHaveProperty('capacity'); expect(patches[1]).toMatchObject({ durationMinutes: 120, minPlayers: 3 });
});

test('NULL legacy schedule fields do not crash feed, request lists or invitation lists', async ({ page }) => {
  const request = { id: 20, matchType: 'GROUP', status: 'OPEN', preferredDate: null, preferredStartTime: null, preferredEndTime: null, expiresAt: null, createdAt: asOf, area: null, matchDurationMinutes: null, requiredPlayers: 2, acceptedCount: 0, remainingCount: 1, matchId: null, isOwner: true };
  await page.route('**/api/v1/matchmaking-requests?**', route => route.fulfill({ json: envelope([request]) }));
  await page.route('**/api/v1/matchmaking-invitations?**', route => route.fulfill({ json: envelope([{ id: 30, requestId: 20, matchId: null, direction: 'RECEIVED', status: 'PENDING', expiresAt: startAt, respondedAt: null, createdAt: asOf, counterpart: { playerId: 2, displayName: 'Lê Hoàng An', skill: null }, request }]) }));
  await page.goto('/feed'); await expect(page.getByRole('link', { name: 'Quản lý kèo #20' })).toBeVisible(); await expect(page.getByText('Xem ngày trong chi tiết · Xem giờ trong chi tiết')).toBeVisible();
  await page.goto('/matchmaking'); await expect(page.getByText('Xem số chỗ và người đi cùng trong chi tiết kèo.')).toBeVisible(); await expect(page.getByText('NaN', { exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lời mời', exact: true }).click(); await expect(page.getByRole('button', { name: 'Chấp nhận', exact: true })).toBeVisible(); await expect(page.getByText('Unexpected Application Error!', { exact: false })).toHaveCount(0);
});

const applicationFixture = { id: 40, requestId: 20, playerId: 1, status: 'PENDING', expiresAt: startAt, respondedAt: null, closeReason: null, createdAt: asOf,
  applicant: { playerId: 1, displayName: 'Nguyễn Văn Nam', skill: { id: 1, name: 'Trung bình', rank: 1 }, skillMismatch: false },
  request: { id: 20, postId: 10, hostId: 2, matchType: 'GROUP', startAt, durationMinutes: 90, status: 'OPEN' } };

test('player sends Apply, sees pending and cancels through a confirmation', async ({ page }) => {
  let pending = false; let cancelled = false;
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', recruitment: { ...recruitment, viewerRelation: null, access: 'PUBLIC' } } } }));
  await page.route('**/api/v1/matchmaking-requests/20', route => route.fulfill({ json: { data: { ...detail, access: 'PUBLIC', members: [] } } }));
  await page.route('**/api/v1/matchmaking-applications?**', route => {
    expect(new URL(route.request().url()).searchParams.get('requestId')).toBe('20');
    return route.fulfill({ json: envelope(pending ? [applicationFixture] : []) });
  });
  await page.route('**/api/v1/matchmaking-requests/20/applications', route => { expect(route.request().method()).toBe('POST'); expect(route.request().postDataJSON()).toEqual({}); pending = true; return route.fulfill({ status: 201, json: { data: applicationFixture } }); });
  await page.route('**/api/v1/matchmaking-applications/40/cancel', route => { pending = false; cancelled = true; return route.fulfill({ json: { data: { id: 40, requestId: 20, status: 'CANCELLED' } } }); });
  await page.goto('/posts/10'); await page.getByRole('button', { name: 'Xin tham gia', exact: true }).click(); await expect(page.getByText('Chờ duyệt', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Xin tham gia', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Hủy yêu cầu tham gia', exact: true }).click(); expect(cancelled).toBe(false); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click(); await expect(page.getByRole('button', { name: 'Xin tham gia', exact: true })).toBeVisible(); expect(cancelled).toBe(true);
  await expect(page.getByRole('button', { name: 'Chấp nhận lời mời', exact: true })).toHaveCount(0);
});

test('host sees skill warning and approves an applicant with the documented decision payload', async ({ page }) => {
  let accepted = false;
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', isAuthor: true, recruitment } } }));
  await page.route('**/api/v1/matchmaking-requests/20/applications?**', route => route.fulfill({ json: envelope(accepted ? [] : [{ ...applicationFixture, applicant: { ...applicationFixture.applicant, playerId: 3, displayName: 'Nguyễn Thu Hà', skillMismatch: true } }]) }));
  await page.route('**/api/v1/matchmaking-applications/40', route => { expect(route.request().method()).toBe('PUT'); expect(route.request().postDataJSON()).toEqual({ decision: 'ACCEPTED' }); accepted = true; return route.fulfill({ json: { data: { id: 40, requestId: 20, status: 'ACCEPTED', matchId: null } } }); });
  await page.goto('/posts/10'); await expect(page.getByText('Ngoài khoảng trình độ của kèo.', { exact: false })).toBeVisible(); await page.getByRole('button', { name: 'Vẫn duyệt', exact: true }).click(); expect(accepted).toBe(false); await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận', exact: true }).click(); await expect(page.getByText('Đã duyệt người chơi.', { exact: true })).toBeVisible(); expect(accepted).toBe(true);
});

test('failed Apply stays actionable and never renders a false pending state', async ({ page }) => {
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', recruitment: { ...recruitment, access: 'PUBLIC', viewerRelation: null } } } }));
  await page.route('**/api/v1/matchmaking-requests/20', route => route.fulfill({ json: { data: { ...detail, access: 'PUBLIC' } } }));
  await page.route('**/api/v1/matchmaking-requests/20/applications', route => route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Unavailable' } } }));
  await page.goto('/posts/10'); await page.getByRole('button', { name: 'Xin tham gia', exact: true }).click(); await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByRole('button', { name: 'Xin tham gia', exact: true })).toBeEnabled(); await expect(page.getByText('Chờ duyệt', { exact: true })).toHaveCount(0);
});

test('my applications tab keeps an authorized management entry for accepted applications', async ({ page }) => {
  await page.route('**/api/v1/matchmaking-applications?**', route => route.fulfill({ json: envelope([{ ...applicationFixture, status: 'ACCEPTED' }]) }));
  await page.goto('/matchmaking?tab=applications'); await expect(page.getByRole('link', { name: 'Xem kèo đã tham gia' })).toHaveAttribute('href', '/matchmaking/requests/20');
  await expect(page.getByRole('button', { name: 'Hủy yêu cầu tham gia' })).toHaveCount(0);
});

test('unavailable provider shows safe actionable text without a false pending application', async ({ page }) => {
  await page.route('**/api/v1/posts/10', route => route.fulfill({ json: { data: { ...base, type: 'MATCH_FINDING', recruitment: { ...recruitment, access: 'PUBLIC', viewerRelation: null } } } }));
  await page.route('**/api/v1/matchmaking-requests/20', route => route.fulfill({ json: { data: { ...detail, access: 'PUBLIC' } } }));
  await page.route('**/api/v1/matchmaking-requests/20/applications', route => route.fulfill({ status: 409, json: { error: { code: 'MATCHMAKING_ACTION_NOT_AVAILABLE', message: 'Tính năng tham gia kèo tạm thời chưa sẵn sàng. Vui lòng thử lại sau.', details: [] } } }));
  await page.goto('/posts/10'); await page.getByRole('button', { name: 'Xin tham gia', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Tính năng tham gia kèo tạm thời chưa sẵn sàng');
  await expect(page.getByText('Chờ duyệt', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xin tham gia', exact: true })).toBeEnabled();
});
