import { test, expect } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const matchDetail = {
  id: 10,
  matchType: 'DOUBLES',
  status: 'COMPLETED',
  scheduledAt: '2030-01-01T03:00:00Z',
  scheduledEndAt: '2030-01-01T05:00:00Z',
  bookingDeadlineAt: null,
  court: null,
  facility: null,
  price: null,
  payer: null,
  booking: null,
  players: [
    { playerId: 2, displayName: 'Bạn', teamNo: 1, status: 'ACTIVE', skill: null },
    { playerId: 3, displayName: 'Nguyễn Văn A', teamNo: 1, status: 'ACTIVE', skill: null },
    { playerId: 4, displayName: 'Trần Thị B', teamNo: 2, status: 'ACTIVE', skill: null },
  ],
  currentPlayers: 3,
  requiredPlayers: 4,
  isOwner: false,
  cancellationReason: null,
};

const pendingBefore = {
  matchId: 10,
  matchType: 'DOUBLES',
  ratedPlayers: [],
  pendingPlayers: [
    { playerId: 3, fullName: 'Nguyễn Văn A' },
    { playerId: 4, fullName: 'Trần Thị B' },
  ],
};

const pendingAfter = {
  matchId: 10,
  matchType: 'DOUBLES',
  ratedPlayers: [
    {
      playerId: 3,
      fullName: 'Nguyễn Văn A',
      rating: { id: 1, skillRating: 4, attitudeRating: 5, comment: null, createdAt: '2030-01-01T00:00:00Z' },
    },
  ],
  pendingPlayers: [{ playerId: 4, fullName: 'Trần Thị B' }],
};

test.beforeEach(async ({ page }) => {
  await mockAuthApi(page, { user: { ...account(), id: 2 } });
});

test('rates a completed match and shows duplicate-safe success', async ({ page }) => {
  let submitted = false;
  let postCount = 0;

  await page.route('**/api/v1/matches/10', (route) =>
    route.fulfill({ json: { data: matchDetail } })
  );
  await page.route('**/api/v1/matches/10/ratings/pending', (route) =>
    route.fulfill({ json: { data: submitted ? pendingAfter : pendingBefore } })
  );
  await page.route('**/api/v1/matches/10/ratings', (route) => {
    expect(route.request().postDataJSON()).toEqual({ ratings: [{ ratedPlayerId: 3, skillRating: 4, attitudeRating: 5 }] });
    postCount += 1;
    submitted = true;
    return route.fulfill({
      status: 201,
      json: {
        data: {
          matchId: 10,
          created: [{ id: 1, ratedPlayerId: 3, skillRating: 4, attitudeRating: 5, comment: null, createdAt: '2030-01-01T00:00:00Z' }],
          alreadyRated: [],
        },
      },
    });
  });

  await page.goto('/matchmaking/matches/10');
  await page.getByRole('button', { name: 'Đánh giá người chơi' }).click();

  await page.getByRole('checkbox').first().check();
  await page.getByRole('radio', { name: 'Kỹ năng 4 trên 5' }).click();
  await page.getByRole('radio', { name: 'Thái độ 5 trên 5' }).click();
  await page.getByRole('button', { name: 'Gửi đánh giá' }).click();

  await expect(page.getByText('Đánh giá đã được ghi nhận.')).toBeVisible();
  await expect(page.getByText('Bạn đã đánh giá')).toBeVisible();
  expect(postCount).toBe(1);

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Đánh giá người chơi' })).toBeVisible();
});

test('does not offer rating for a non-completed match', async ({ page }) => {
  await page.route('**/api/v1/matches/11', (route) =>
    route.fulfill({ json: { data: { ...matchDetail, id: 11, status: 'CONFIRMED' } } })
  );
  await page.goto('/matchmaking/matches/11');
  await expect(page.getByRole('button', { name: 'Đánh giá người chơi' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xem đánh giá đã gửi' })).toHaveCount(0);
});

test('player views their given rating history', async ({ page }) => {
  await page.route('**/api/v1/users/2/ratings?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 1,
            matchId: 10,
            raterId: 2,
            raterFullName: 'Bạn',
            ratedPlayerId: 3,
            ratedPlayerFullName: 'Nguyễn Văn A',
            skillRating: 4,
            attitudeRating: 5,
            comment: 'Chơi tốt',
            createdAt: '2030-01-01T00:00:00Z',
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    })
  );
  await page.goto('/ratings/given');
  await expect(page.getByRole('heading', { name: 'Đánh giá đã gửi' })).toBeVisible();
  await expect(page.getByText('Nguyễn Văn A')).toBeVisible();
  await expect(page.getByText('Chơi tốt')).toBeVisible();
});

test('admin inspects a Player rating and adjustment history', async ({ page }) => {
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({ json: { data: { id: 1, email: 'admin@test.test', role: 'ADMIN', requiresPasswordChange: false } } })
  );
  await page.route('**/api/v1/admin/users?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 2,
            email: 'player@test.test',
            role: 'PLAYER',
            status: 'ACTIVE',
            deletedAt: null,
            createdAt: '2030-01-01T00:00:00Z',
            updatedAt: '2030-01-01T00:00:00Z',
            profile: {
              userId: 2,
              fullName: 'Nguyễn Văn A',
              skillLevelId: 4,
              avatarUrl: null,
              createdAt: '2030-01-01T00:00:00Z',
              updatedAt: '2030-01-01T00:00:00Z',
            },
          },
        ],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        stats: { total: 1, active: 1, suspended: 0, deactivated: 0 },
      },
    })
  );
  await page.route('**/api/v1/users/2/ratings?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 1,
            matchId: 10,
            raterId: 2,
            raterFullName: 'Nguyễn Văn A',
            ratedPlayerId: 3,
            ratedPlayerFullName: 'Trần Thị B',
            skillRating: 4,
            attitudeRating: 5,
            comment: 'Chơi tốt',
            createdAt: '2030-01-01T00:00:00Z',
          },
        ],
        meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
      },
    })
  );
  await page.route('**/api/v1/users/2/skill-adjustments?*', (route) =>
    route.fulfill({
      json: {
        data: [
          {
            id: 1,
            playerId: 2,
            previousSkillLevel: { id: 3, code: 'AVERAGE_MINUS', name: 'Trung bình yếu', rank: 3 },
            newSkillLevel: { id: 4, code: 'AVERAGE', name: 'Trung bình', rank: 4 },
            averageSkillRating: 4.2,
            ratingsConsidered: 5,
            source: 'AUTO_RATING',
            createdAt: '2030-01-01T00:00:00Z',
          },
        ],
        meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
      },
    })
  );

  await page.goto('/admin/users');
  await page.getByText('Nguyễn Văn A').first().click();
  await page.getByText('Xem chi tiết').first().click();

  await expect(page.getByText(/Đánh giá đã cho \(1\)/)).toBeVisible();
  await expect(page.getByText(/Đánh giá đã nhận \(1\)/)).toBeVisible();
  await expect(page.getByText(/Lịch sử điều chỉnh trình độ \(1\)/)).toBeVisible();
  await expect(page.getByText('Trung bình yếu')).toBeVisible();
});

test('preserves pending drafts after failed submission and validates both dimensions', async ({ page }) => {
  await page.route('**/api/v1/matches/10', route => route.fulfill({ json: { data: matchDetail } }));
  await page.route('**/api/v1/matches/10/ratings/pending', route => route.fulfill({ json: { data: pendingBefore } }));
  let posts = 0;
  await page.route('**/api/v1/matches/10/ratings', route => {
    posts++;
    return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Thử lại sau' } } });
  });
  await page.goto('/matchmaking/matches/10');
  await page.getByRole('button', { name: 'Đánh giá người chơi' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').first().check();
  await dialog.getByRole('radio', { name: 'Kỹ năng 4 trên 5' }).click();
  await dialog.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect(dialog.getByText('Mỗi người được chọn cần có đủ điểm kỹ năng và thái độ.')).toBeVisible();
  expect(posts).toBe(0);
  await dialog.getByRole('radio', { name: 'Thái độ 5 trên 5' }).click();
  await dialog.getByRole('textbox').fill('Giữ bản nháp');
  await dialog.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect(dialog.getByText('Thử lại sau')).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveValue('Giữ bản nháp');
  await expect(dialog.getByRole('radio', { name: 'Kỹ năng 4 trên 5' })).toHaveAttribute('aria-checked', 'true');
  expect(posts).toBe(1);
});

test('duplicate acknowledgement refreshes immutable scores and leaves a read-only entry when fully rated', async ({ page }) => {
  const allRated = { ...pendingAfter, pendingPlayers: [], ratedPlayers: [pendingAfter.ratedPlayers[0], { playerId: 4, fullName: 'Trần Thị B', rating: { id: 2, skillRating: 3, attitudeRating: 4, comment: null, createdAt: '2030-01-01T00:00:00Z' } }] };
  let done = false;
  await page.route('**/api/v1/matches/10', route => route.fulfill({ json: { data: matchDetail } }));
  await page.route('**/api/v1/matches/10/ratings/pending', route => route.fulfill({ json: { data: done ? allRated : pendingBefore } }));
  await page.route('**/api/v1/matches/10/ratings', route => {
    done = true;
    return route.fulfill({ status: 200, json: { data: { matchId: 10, created: [], alreadyRated: [{ ratedPlayerId: 3 }] } } });
  });
  await page.goto('/matchmaking/matches/10');
  await page.getByRole('button', { name: 'Đánh giá người chơi' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').first().check();
  await dialog.getByRole('radio', { name: 'Kỹ năng 1 trên 5' }).click();
  await dialog.getByRole('radio', { name: 'Thái độ 1 trên 5' }).click();
  await dialog.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect(dialog.getByText('Đánh giá đã được ghi nhận.')).toBeVisible();
  await expect(dialog.getByLabel('Kỹ năng: 4/5')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Gửi đánh giá' })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Xem đánh giá đã gửi' }).click();
  await expect(page.getByRole('dialog').getByLabel('Kỹ năng: 4/5')).toBeVisible();
});

test('completed Match reports a pending-load failure and permits retry', async ({ page }) => {
  let failed = true;
  await page.route('**/api/v1/matches/10', route => route.fulfill({ json: { data: matchDetail } }));
  await page.route('**/api/v1/matches/10/ratings/pending', route => failed
    ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Không tải được dữ liệu' } } })
    : route.fulfill({ json: { data: pendingBefore } }));
  await page.goto('/matchmaking/matches/10');
  await expect(page.getByText('Không tải được dữ liệu')).toBeVisible();
  failed = false;
  await page.getByRole('button', { name: 'Thử tải lại đánh giá' }).click();
  await expect(page.getByRole('button', { name: 'Đánh giá người chơi' })).toBeVisible();
});

test('history paginates, renders comments as text, and does not route unknown-domain IDs to casual Matches', async ({ page }) => {
  const comment = '<img src=x onerror="alert(1)">';
  await page.route('**/api/v1/users/2/ratings?*', route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({ json: { data: [{ id: pageNumber, matchId: 99, ratedPlayerId: 3, ratedPlayerFullName: `Player page ${pageNumber}`, raterId: 2, raterFullName: 'Bạn', skillRating: 4, attitudeRating: 5, comment, createdAt: '2030-01-01T00:00:00Z' }], meta: { page: pageNumber, limit: 20, total: 21, totalPages: 2 } } });
  });
  await page.goto('/ratings/given');
  await expect(page.getByText('Player page 1', { exact: true })).toBeVisible();
  await expect(page.getByText(comment, { exact: true })).toBeVisible();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Trận #99' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(page.getByText('Player page 2', { exact: true })).toBeVisible();
});

test('late modal response cannot overwrite a newly opened dialog', async ({ page }) => {
  let phase = 'host';
  let delayedRequests = 0;
  let finished = 0;
  let release: (() => void) | undefined;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/v1/matches/10', route => route.fulfill({ json: { data: matchDetail } }));
  await page.route('**/api/v1/matches/10/ratings/pending', async route => {
    const old = phase === 'old';
    if (old) { delayedRequests++; await delayed; }
    await route.fulfill({ json: { data: old ? pendingBefore : { ...pendingBefore, pendingPlayers: [{ playerId: 4, fullName: 'Latest participant' }] } } });
    if (old) finished++;
  });
  await page.goto('/matchmaking/matches/10');
  await expect(page.getByRole('button', { name: 'Đánh giá người chơi' })).toBeVisible();
  phase = 'old';
  await page.getByRole('button', { name: 'Đánh giá người chơi' }).click();
  await expect.poll(() => delayedRequests).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  phase = 'new';
  await page.getByRole('button', { name: 'Đánh giá người chơi' }).click();
  await expect(page.getByRole('dialog').getByText('Latest participant')).toBeVisible();
  release!();
  await expect.poll(() => finished).toBe(delayedRequests);
  await expect(page.getByRole('dialog').getByText('Nguyễn Văn A')).toHaveCount(0);
  await expect(page.getByRole('dialog').getByText('Latest participant')).toBeVisible();
});

test('given history reports load failure, retries, and shows empty only after loading', async ({ page }) => {
  let fail = true;
  await page.route('**/api/v1/users/2/ratings?*', route => fail
    ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Không tải được lịch sử' } } })
    : route.fulfill({ json: { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } } }));
  await page.goto('/ratings/given');
  await expect(page.getByRole('alert')).toContainText('Không tải được lịch sử');
  await expect(page.getByText('Bạn chưa gửi đánh giá nào.')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByText('Bạn chưa gửi đánh giá nào.')).toBeVisible();
});

test('Admin sections paginate independently and display error and empty states', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ json: { data: { id: 1, email: 'admin@test.test', role: 'ADMIN', requiresPasswordChange: false } } }));
  await page.route('**/api/v1/admin/users?*', route => route.fulfill({ json: {
    data: [{ id: 2, email: 'player@test.test', role: 'PLAYER', status: 'SUSPENDED', deletedAt: null, createdAt: '2030-01-01T00:00:00Z', updatedAt: '2030-01-01T00:00:00Z', profile: { userId: 2, fullName: 'Target Admin', skillLevelId: 4, avatarUrl: null } }],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 }, stats: { total: 1, active: 0, suspended: 1, deactivated: 0 },
  } }));
  await page.route('**/api/v1/users/2/ratings?*', route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('direction') === 'received') return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Không tải được đánh giá nhận' } } });
    const pageNumber = Number(url.searchParams.get('page'));
    return route.fulfill({ json: { data: [{ id: pageNumber, matchId: 10, raterId: 2, raterFullName: 'Target Admin', ratedPlayerId: 3, ratedPlayerFullName: `Target page ${pageNumber}`, skillRating: 4, attitudeRating: 5, comment: null, createdAt: '2030-01-01T00:00:00Z' }], meta: { page: pageNumber, limit: 5, total: 6, totalPages: 2 } } });
  });
  await page.route('**/api/v1/users/2/skill-adjustments?*', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 5, total: 0, totalPages: 0 } } }));
  await page.goto('/admin/users');
  await page.getByText('Target Admin', { exact: true }).click();
  await page.getByText('Xem chi tiết', { exact: true }).click();
  const given = page.getByRole('region', { name: 'Đánh giá đã cho (6)', exact: true });
  await expect(given.getByText('Target page 1 (#3)', { exact: true })).toBeVisible();
  await given.getByRole('button', { name: 'Sau', exact: true }).click();
  await expect(given.getByText('Target page 2 (#3)', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Không tải được đánh giá nhận');
  await expect(page.getByRole('region', { name: 'Lịch sử điều chỉnh trình độ (0)', exact: true }).getByText('Chưa có dữ liệu.')).toBeVisible();
});

test('mobile rating shows context, validates fields and supports keyboard scores and focus return', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.route('**/api/v1/matches/10', route => route.fulfill({ json: { data: matchDetail } }));
  await page.route('**/api/v1/matches/10/ratings/pending', route => route.fulfill({ json: { data: pendingBefore } }));
  await page.goto('/matchmaking/matches/10');
  const opener = page.getByRole('button', { name: 'Đánh giá người chơi', exact: true });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Đấu đôi', { exact: true })).toBeVisible();
  await dialog.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Gửi đánh giá' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true }).first()).toBeFocused();
  await expect(dialog.getByText('Đã gửi 0/2 người')).toBeVisible();
  await dialog.getByRole('checkbox').first().check();
  await expect(dialog.getByText('Kỹ năng', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Thái độ', { exact: true })).toBeVisible();
  const submit = dialog.getByRole('button', { name: 'Gửi đánh giá (1 người)', exact: true });
  await submit.scrollIntoViewIfNeeded();
  expect(await submit.evaluate(node => { const box = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); })).toBeTruthy();
  const closeIcon = dialog.getByRole('button', { name: 'Đóng', exact: true }).first().locator('svg');
  expect((await closeIcon.boundingBox())?.width).toBeGreaterThanOrEqual(16);
  await submit.click();
  const firstSkill = dialog.getByRole('radio', { name: 'Kỹ năng 1 trên 5', exact: true });
  await expect(firstSkill).toBeFocused();
  await expect(dialog.getByRole('radiogroup', { name: 'Kỹ năng', exact: true })).toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('End');
  await expect(dialog.getByRole('radio', { name: 'Kỹ năng 5 trên 5' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('radio', { name: 'Kỹ năng 4 trên 5' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('radio', { name: 'Thái độ 1 trên 5' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('radio', { name: 'Thái độ 2 trên 5' })).toHaveAttribute('aria-checked', 'true');
  await expect(dialog.getByRole('radiogroup', { name: 'Thái độ', exact: true })).not.toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('textbox').fill('Nhận xét '.repeat(55));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBeTruthy();
  await dialog.evaluate(node => { node.scrollTop = 0; });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await dialog.evaluate(node => { node.scrollTop = 0; });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test('sending rating keeps the dialog open until the server acknowledges it', async ({ page }) => {
  let release: (() => void) | undefined;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  let posting = false;
  let done = false;
  await page.route('**/api/v1/matches/10', route => route.fulfill({ json: { data: matchDetail } }));
  await page.route('**/api/v1/matches/10/ratings/pending', route => route.fulfill({ json: { data: done ? pendingAfter : pendingBefore } }));
  await page.route('**/api/v1/matches/10/ratings', async route => {
    posting = true;
    await waiting;
    done = true;
    await route.fulfill({ status: 201, json: { data: { matchId: 10, created: [], alreadyRated: [] } } });
  });
  await page.goto('/matchmaking/matches/10');
  await page.getByRole('button', { name: 'Đánh giá người chơi', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').first().check();
  await dialog.getByRole('radio', { name: 'Kỹ năng 4 trên 5' }).click();
  await dialog.getByRole('radio', { name: 'Thái độ 5 trên 5' }).click();
  await dialog.getByRole('button', { name: 'Gửi đánh giá' }).click();
  await expect.poll(() => posting).toBeTruthy();
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true }).first()).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Đóng', exact: true }).last()).toBeDisabled();
  await dialog.focus();
  await page.keyboard.press('Tab');
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog).toBeFocused();
  await page.keyboard.press('Escape');
  await page.mouse.click(1, 1);
  await expect(dialog).toBeVisible();
  release!();
  await expect(dialog.getByText('Đánh giá đã được ghi nhận.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

for (const width of [390, 1280]) test(`rating history stays within the page and preserves long comments at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const comment = 'Nhận xét dài '.repeat(35);
  await page.route('**/api/v1/users/2/ratings?*', route => route.fulfill({ json: { data: [{ id: 3, matchId: 10, raterId: 2, ratedPlayerId: 3, ratedPlayerFullName: 'Người chơi tên dài để kiểm tra bố cục', skillRating: 4, attitudeRating: 5, comment, createdAt: '2030-01-01T00:00:00Z' }], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } } }));
  await page.goto('/ratings/given'); await expect(page.getByText(comment, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  const scrollRegion = page.getByRole('region', { name: 'Bảng dữ liệu' });
  await scrollRegion.focus(); await expect(scrollRegion).toBeFocused();
  await expect(page.getByLabel('Kỹ năng: 4/5')).toBeVisible();
});
