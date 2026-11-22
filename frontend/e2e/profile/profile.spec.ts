import { expect, test } from '@playwright/test';
import { account, mockAuthApi } from '../auth-ui-mocks';

const profile = {
  userId: 1, fullName: 'Nguyễn Nam', avatarUrl: null,
  skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: 'Trình độ từ danh mục chung' },
  ratings: { skill: { average: 4.25, count: 4, notEnoughData: false }, attitude: { average: null, count: 2, notEnoughData: true } },
  stats: { matchesPlayed: 13, wins: 2, losses: 1, resultsAvailable: true },
};
test.beforeEach(async ({ page }) => {
  await mockAuthApi(page);
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: profile } }));
});
test('loads real contract fields, saves a trimmed name, and excludes unsupported fields', async ({ page }) => {
  await page.route('**/api/v1/players/me', async route => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().postDataJSON()).toEqual({ fullName: 'Tên mới' });
      return route.fulfill({ json: { data: { ...profile, fullName: 'Tên mới' } } });
    }
    await route.fulfill({ json: { data: profile } });
  });
  await page.goto('/e2e/profile/profile.html');
  await expect(page.getByRole('heading', { name: profile.fullName })).toBeVisible();
  await expect(page.getByText('4.25', { exact: true })).toBeVisible();
  await expect(page.getByText('Chưa đủ đánh giá')).toBeVisible();
  await expect(page.getByText('Trận hoàn tất', { exact: true })).toBeVisible();
  await expect(page.getByText('Trình độ từ danh mục chung')).toBeVisible();
  await expect(page.getByText('ELO', { exact: false })).toHaveCount(0);
  await page.getByLabel('Tên hiển thị').fill('Unsaved name');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByLabel('Tên hiển thị')).toHaveValue(profile.fullName);
  await page.getByLabel('Tên hiển thị').fill('x'); await page.getByRole('button', { name: 'Lưu tên' }).click();
  await expect(page.getByRole('alert')).toContainText('2 đến 50');
  await page.getByLabel('Tên hiển thị').fill('  Tên mới  '); await page.getByRole('button', { name: 'Lưu tên' }).click();
  await expect(page.getByRole('status')).toContainText('Đã lưu tên');
  await expect(page.getByRole('heading', { name: 'Tên mới' })).toBeVisible();
  await expect(page.getByTestId('shared-profile-name')).toHaveText('Tên mới');
});
test('retains name input on an ambiguous save failure and allows explicit reconciliation', async ({ page }) => {
  await page.route('**/api/v1/players/me', route => route.request().method() === 'PATCH'
    ? route.abort() : route.fulfill({ json: { data: profile } }));
  await page.goto('/e2e/profile/profile.html');
  await page.getByLabel('Tên hiển thị').fill('Tên muốn lưu'); await page.getByRole('button', { name: 'Lưu tên' }).click();
  await expect(page.getByRole('alert')).toContainText('Chưa xác nhận');
  await expect(page.getByLabel('Tên hiển thị')).toHaveValue('Tên muốn lưu');
  await page.getByRole('button', { name: 'Tải lại hồ sơ để kiểm tra' }).click();
  await expect(page.getByLabel('Tên hiển thị')).toHaveValue(profile.fullName);
});
test('renders an empty profile without invented zero ratings', async ({ page }) => {
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: { ...profile,
    skillLevel: { ...profile.skillLevel, description: null },
    ratings: { skill: { average: 5, count: 2, notEnoughData: false }, attitude: { average: null, count: 0, notEnoughData: true } },
    stats: { matchesPlayed: 0, wins: 0, losses: 0, resultsAvailable: false },
  } } }));
  await page.goto('/e2e/profile/profile.html');
  await expect(page.getByText('Chưa đủ đánh giá')).toHaveCount(2);
  await expect(page.getByText('Chưa có kết quả giải đấu.')).toBeVisible();
  await expect(page.getByText('5.00 / 5')).toHaveCount(0);
});
test('shows load failure with retry and public-profile unavailable without leaking contact data', async ({ page }) => {
  await page.route('**/api/v1/players/me', route => route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR' } } }));
  await page.route('**/api/v1/players/2', route => route.fulfill({ status: 404, json: { error: { code: 'PLAYER_NOT_FOUND' } } }));
  await page.goto('/e2e/profile/profile.html'); await expect(page.getByRole('alert')).toContainText('Vui lòng thử lại');
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: profile } }));
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: profile.fullName })).toBeVisible();
  await page.getByRole('button', { name: 'View player 2' }).click();
  const modal = page.getByRole('dialog'); await expect(modal).toContainText('Hồ sơ không khả dụng');
  await expect(modal.getByRole('textbox')).toHaveCount(0);
  await modal.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.getByRole('button', { name: 'Thử lại' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(modal.getByRole('button', { name: 'Đóng', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(modal).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'View player 2' })).toBeFocused();
});
test('preserves browser multipart boundary, cookies and CSRF', async ({ page, context }) => {
  await context.addCookies([{ name: 'csrf_token', value: 'profile-csrf', url: 'http://localhost:5190' }]);
  await page.route('**/api/v1/test-profile-transport', async route => {
    const req = route.request();
    expect(req.headers()['content-type']).toContain('multipart/form-data; boundary=');
    expect(req.headers()['x-csrf-token']).toBe('profile-csrf');
    expect(req.headers()['cookie']).toContain('csrf_token=profile-csrf');
    expect(req.postData()).toContain('name="avatar"');
    await route.fulfill({ json: { data: {} } });
  });
  await page.goto('/e2e/profile/profile.html'); await page.getByRole('button', { name: 'Test multipart transport' }).click();
  await expect(page.getByText('Uploaded', { exact: true })).toBeVisible();
});

test('switching public players discards a late response from the previous player', async ({ page }) => {
  await page.route('**/api/v1/players/2', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.fulfill({ json: { data: { ...profile, userId: 2, fullName: 'Late player' } } }).catch(() => {});
  });
  await page.route('**/api/v1/players/3', route => route.fulfill({ json: { data: { ...profile, userId: 3, fullName: 'Current player' } } }));
  await page.goto('/e2e/profile/profile.html');
  await page.getByRole('button', { name: 'View player 2' }).click();
  // Drive a parent prop update while the modal stays mounted (like selecting another participant).
  await page.getByRole('button', { name: 'View player 3', includeHidden: true }).evaluate((button: HTMLButtonElement) => button.click());
  const modal = page.getByRole('dialog');
  await expect(modal.getByRole('heading', { name: 'Current player' })).toBeVisible();
  await page.waitForTimeout(400);
  await expect(modal.getByRole('heading', { name: 'Current player' })).toBeVisible();
  await expect(modal.getByText('Late player', { exact: true })).toHaveCount(0);
});

test('validates avatar files and keeps an immediately saved avatar when cancelling name edits', async ({ page }) => {
  let uploads = 0;
  await page.route('**/api/v1/players/me/avatar', async route => {
    uploads++; expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    await route.fulfill({ status: 201, json: { data: { avatarUrl: '/saved-avatar.png' } } });
  });
  await page.route('**/saved-avatar.png', route => route.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5ioAAAAASUVORK5CYII=', 'base64') }));
  await page.goto('/e2e/profile/profile.html');
  const input = page.getByLabel('Đổi ảnh đại diện');
  await input.setInputFiles({ name: 'invalid.gif', mimeType: 'image/gif', buffer: Buffer.from('gif') });
  await expect(page.getByRole('alert')).toContainText('tối đa 2 MB'); expect(uploads).toBe(0);
  await input.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(2 * 1024 * 1024 + 1) });
  expect(uploads).toBe(0);
  await input.setInputFiles({ name: 'avatar.webp', mimeType: 'image/webp', buffer: Buffer.from('browser-fixture') });
  await expect(page.getByRole('status')).toContainText('Đã cập nhật ảnh'); expect(uploads).toBe(1);
  await page.getByLabel('Tên hiển thị').fill('Not saved');
  await page.getByRole('button', { name: 'Hủy', exact: true }).click();
  await expect(page.getByRole('img', { name: 'Ảnh đại diện Nguyễn Nam' })).toHaveAttribute('src', '/saved-avatar.png');
  await expect(page.getByLabel('Tên hiển thị')).toHaveValue(profile.fullName);
});

async function signInPreview(page: import('@playwright/test').Page) {
  await mockAuthApi(page, { user: account() });
}
test('header opens the real identity page, saves a name and distinguishes unavailable sections', async ({ page }) => {
  await signInPreview(page);
  let current = { ...profile, fullName: 'Tên từ tài khoản', ratings: null, stats: null };
  await page.route('**/api/v1/players/me', async route => {
    if (route.request().method() === 'PATCH') current = { ...current, fullName: route.request().postDataJSON().fullName };
    await route.fulfill({ json: { data: current } });
  });
  await page.setViewportSize({ width: 1280, height: 1000 }); await page.goto('/');
  await expect(page).toHaveURL('/feed');
  await expect(page.getByRole('button', { name: 'Tài khoản của tôi', exact: true })).toContainText('Tên từ tài khoản');
  await page.getByRole('button', { name: 'Tài khoản của tôi', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Hồ sơ cá nhân', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Hồ sơ cá nhân', exact: true })).toBeVisible();
  await expect(page.getByText('DỮ LIỆU MẪU', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tên từ tài khoản', exact: true })).toBeVisible();
  await expect(page.getByText('Đánh giá chưa khả dụng', { exact: true })).toBeVisible();
  await expect(page.getByText('Thống kê chưa khả dụng', { exact: true })).toBeVisible();
  await expect(page.locator('#profile-avatar-file')).toHaveCount(1);
  await expect(page.getByText('Chưa đủ đánh giá', { exact: true })).toHaveCount(0);
  await page.getByLabel('Tên hiển thị').fill('Tên lưu thật');
  await page.getByRole('button', { name: 'Lưu tên', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tên lưu thật', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tài khoản của tôi', exact: true })).toContainText('Tên lưu thật');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Tên lưu thật', exact: true })).toBeVisible();
});
test('AUTH-32: seven-level ladder, tentative label and the survey result link only when a result exists', async ({ page }) => {
  await signInPreview(page);
  const excellent = { ...profile, isSkillTentative: true, skillLevel: { code: 'EXCELLENT', name: 'Giỏi', rank: 7, description: 'Mô tả bậc 7' } };
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: excellent } }));
  let surveyStatus = 200;
  await page.route('**/api/v1/players/me/skill-survey', route => surveyStatus === 200
    ? route.fulfill({ json: { data: { version: 1 } } })
    : route.fulfill({ status: 404, json: { error: { code: 'PLAYER_SKILL_SURVEY_NOT_FOUND', message: 'x', details: [] } } }));
  await page.setViewportSize({ width: 1280, height: 1000 }); await page.goto('/profile');
  const skill = page.getByRole('region', { name: 'Trình độ thi đấu' }).or(page.locator('section, article').filter({ hasText: 'TRÌNH ĐỘ HIỆN TẠI' })).first();
  await expect(skill).toContainText('7/ 7');
  await expect(page.getByLabel('Trình độ 7 trên 7 mức, tạm thời')).toBeVisible();
  await expect(page.getByLabel('Trình độ 7 trên 7 mức, tạm thời').locator('span')).toHaveCount(7);
  await expect(skill.getByText('Tạm thời', { exact: true })).toBeVisible();
  const link = page.getByRole('link', { name: 'Xem kết quả khảo sát', exact: true });
  await expect(link).toHaveAttribute('href', '/register/result');
  surveyStatus = 404; await page.reload();
  await expect(page.getByRole('heading', { name: profile.fullName, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem kết quả khảo sát', exact: true })).toHaveCount(0);
});
test('live profile fits a mobile viewport and keeps the profile shortcut available', async ({ page }) => {
  await signInPreview(page); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Tài khoản của tôi', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: 'Hồ sơ cá nhân', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Hồ sơ cá nhân', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('live profile remains behind Player authentication', async ({ page }) => {
  await page.route('**/api/v1/auth/me', route => route.fulfill({ status: 401, json: { error: { code: 'AUTH_SESSION_INVALID' } } }));
  await page.goto('/profile'); await expect(page).toHaveURL(/\/sign-in$/);
});

test('an avatar completed during a delayed name save is not overwritten by its older response', async ({ page }) => {
  let releaseSave!: () => void;
  const waiting = new Promise<void>(resolve => { releaseSave = resolve; });
  let started = false;
  await page.route('**/api/v1/players/me', async route => {
    if (route.request().method() === 'PATCH') {
      started = true; await waiting;
      return route.fulfill({ json: { data: { ...profile, fullName: 'Tên mới', avatarUrl: null } } });
    }
    return route.fulfill({ json: { data: profile } });
  });
  await page.route('**/api/v1/players/me/avatar', route => route.fulfill({ status: 201, json: { data: { avatarUrl: '/new-avatar.png' } } }));
  await page.goto('/e2e/profile/profile.html');
  await page.getByLabel('Tên hiển thị').fill('Tên mới'); await page.getByRole('button', { name: 'Lưu tên' }).click();
  await expect.poll(() => started).toBe(true);
  await page.getByLabel('Đổi ảnh đại diện').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await expect(page.getByRole('status').filter({ hasText: 'Đã cập nhật ảnh' })).toBeVisible(); releaseSave();
  await expect(page.getByRole('heading', { name: 'Tên mới', exact: true })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ảnh đại diện Tên mới' })).toHaveAttribute('src', '/new-avatar.png');
});
test('a rejected server upload keeps the existing avatar and gives reconciliation feedback', async ({ page }) => {
  await page.route('**/api/v1/players/me', route => route.fulfill({ json: { data: { ...profile, avatarUrl: '/existing.png' } } }));
  await page.route('**/api/v1/players/me/avatar', route => route.fulfill({ status: 400, json: { error: { code: 'VALIDATION_FAILED' } } }));
  await page.goto('/e2e/profile/profile.html');
  await page.getByLabel('Đổi ảnh đại diện').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('invalid bytes') });
  await expect(page.getByRole('alert')).toContainText('Ảnh không hợp lệ');
  await expect(page.getByRole('img', { name: 'Ảnh đại diện Nguyễn Nam' })).toHaveAttribute('src', '/existing.png');
  await expect(page.getByRole('button', { name: 'Tải lại hồ sơ', exact: true })).toBeVisible();
});

for (const mutation of ['name', 'avatar'] as const) {
  test(`a late ${mutation} mutation cannot cancel a newer profile reload`, async ({ page }) => {
    let releaseMutation!: () => void;
    let releaseRead!: () => void;
    const mutationGate = new Promise<void>(resolve => { releaseMutation = resolve; });
    const readGate = new Promise<void>(resolve => { releaseRead = resolve; });
    let reads = 0;
    let mutationStarted = false;
    const updated = { ...profile, fullName: 'Tên đã tải lại', avatarUrl: '/reloaded-avatar.png' };
    await page.route('**/api/v1/players/me', async route => {
      if (route.request().method() === 'PATCH') {
        mutationStarted = true;
        await mutationGate;
        return route.fulfill({ json: { data: { ...profile, fullName: 'Tên cũ từ PATCH' } } });
      }
      if (++reads > 1) await readGate;
      return route.fulfill({ json: { data: reads === 1 ? profile : updated } });
    });
    await page.route('**/api/v1/players/me/avatar', async route => {
      mutationStarted = true;
      await mutationGate;
      await route.fulfill({ status: 201, json: { data: { avatarUrl: '/older-avatar.png' } } });
    });
    await page.goto('/e2e/profile/profile.html');
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue(profile.fullName);
    if (mutation === 'name') {
      await page.getByLabel('Tên hiển thị').fill('Tên cũ từ PATCH');
      await page.getByRole('button', { name: 'Lưu tên' }).click();
    } else {
      await page.getByLabel('Đổi ảnh đại diện').setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
    }
    await expect.poll(() => mutationStarted).toBe(true);
    await page.getByRole('button', { name: 'Refresh shared profile' }).click();
    await expect.poll(() => reads).toBe(2);
    const completed = page.waitForResponse(response => response.request().method() === (mutation === 'name' ? 'PATCH' : 'POST'));
    releaseMutation();
    await completed;
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
    releaseRead();
    await expect(page.getByLabel('Tên hiển thị')).toHaveValue(updated.fullName);
    await expect(page.getByRole('img', { name: `Ảnh đại diện ${updated.fullName}` })).toHaveAttribute('src', updated.avatarUrl);
  });
}
