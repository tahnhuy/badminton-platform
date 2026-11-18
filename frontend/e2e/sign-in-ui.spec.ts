import { expect, test, type Page, type Route } from '@playwright/test';

type Role = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';
const account = (role: Role = 'PLAYER', requiresPasswordChange = false) => ({ id: 1, email: 'player@example.com', role, requiresPasswordChange });
interface State { user: ReturnType<typeof account> | null; calls: number; meCalls: number; refreshCalls: number }
const errorBody = (code: string, details: unknown[] = []) => ({ error: { code, message: 'Internal message must not be displayed', details } });
const meta = { page: 1, limit: 20, total: 0, totalPages: 1 };
const profile = { userId: 1, fullName: 'D01 Player', avatarUrl: null, skillLevel: { code: 'AVERAGE', name: 'Trung bình', rank: 4, description: null }, ratings: null, stats: null };

async function mockAuth(page: Page, login?: (route: Route, state: State) => Promise<void>, user: State['user'] = null) {
  const state: State = { user, calls: 0, meCalls: 0, refreshCalls: 0 };
  await page.route('https://fonts.googleapis.com/**', route => route.abort());
  await page.route('https://fonts.gstatic.com/**', route => route.abort());
  await page.routeWebSocket('**/api/v1/ws/messaging', ws => ws.close());
  await page.route('**/api/v1/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v1/auth/me') {
      state.meCalls++;
      if (state.calls > 0) state.refreshCalls++;
      return state.user ? route.fulfill({ json: { data: state.user } }) : route.fulfill({ status: 401, json: errorBody('AUTH_SESSION_INVALID') });
    }
    if (path === '/api/v1/auth/login') {
      state.calls++;
      if (login) return login(route, state);
      state.user = account(); return route.fulfill({ json: { data: state.user } });
    }
    if (path === '/api/v1/players/me') return route.fulfill({ json: { data: profile } });
    if (path === '/api/v1/conversations/unread-summary') return route.fulfill({ json: { data: { totalUnread: 0 } } });
    if (path === '/api/v1/admin/users') return route.fulfill({ json: { data: [], pagination: meta, stats: { total: 0, active: 0, suspended: 0, deactivated: 0 } } });
    if (path === '/api/v1/skill-levels') return route.fulfill({ json: { data: [profile.skillLevel] } });
    return route.fulfill({ json: { data: [], meta } });
  });
  return state;
}
async function fill(page: Page) {
  await page.getByLabel('Email', { exact: true }).fill('player@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('ExistingPassword!');
}
const submit = (page: Page) => page.getByRole('button', { name: 'Đăng nhập', exact: true });

test('validates fields, focuses the first error, and sends no invalid request', async ({ page }) => {
  const state = await mockAuth(page); await page.goto('/sign-in'); await submit(page).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByText('Vui lòng nhập email.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('aria-describedby', 'password-error');
  await page.getByLabel('Email', { exact: true }).fill('invalid'); await submit(page).click();
  await expect(page.getByText('Email không đúng định dạng.', { exact: true })).toBeVisible(); expect(state.calls).toBe(0);
});

test('password toggle is reachable by keyboard with visible focus', async ({ page }) => {
  await mockAuth(page); await page.goto('/sign-in');
  const restingShadow = await page.getByLabel('Mật khẩu', { exact: true }).evaluate(el => getComputedStyle(el).boxShadow);
  await page.getByLabel('Email', { exact: true }).focus();
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeFocused();
  expect(await page.getByLabel('Mật khẩu', { exact: true }).evaluate(el => el.matches(':focus-visible'))).toBe(true);
  expect(await page.getByLabel('Mật khẩu', { exact: true }).evaluate(el => getComputedStyle(el).boxShadow)).not.toBe(restingShadow);
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Hiện mật khẩu' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  await expect(page.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute('aria-pressed', 'true');
});

for (const [code, status, text] of [
  ['AUTH_INVALID_CREDENTIALS', 401, 'Email hoặc mật khẩu không đúng'],
  ['AUTH_ACCOUNT_RESTRICTED', 403, 'Tài khoản của bạn đã bị hạn chế.'],
  ['AUTH_ACCOUNT_LOCKED', 429, 'Tài khoản tạm thời bị khóa'],
  ['AUTH_RATE_LIMITED', 429, 'Quá nhiều yêu cầu đăng nhập'],
  ['UNEXPECTED_INTERNAL_ERROR', 500, 'Đã xảy ra lỗi trong quá trình đăng nhập.'],
] as const) {
  test(`maps ${code} without leaking server messages or retrying`, async ({ page }) => {
    const state = await mockAuth(page, route => route.fulfill({ status, json: errorBody(code, [{ lockedUntil: '2026-11-17T10:30:00Z' }]) }));
    await page.goto('/sign-in'); await fill(page); await submit(page).click();
    await expect(page.getByRole('alert')).toContainText(text); await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.getByText('Internal message must not be displayed', { exact: true })).toHaveCount(0);
    if (code === 'AUTH_ACCOUNT_LOCKED') await expect(page.getByRole('alert')).toContainText('Mở khóa lúc:');
    expect(state.calls).toBe(1);
  });
}

test('server validation is associated with its field', async ({ page }) => {
  await mockAuth(page, route => route.fulfill({ status: 400, json: errorBody('VALIDATION_FAILED', [{ field: 'email' }]) }));
  await page.goto('/sign-in'); await fill(page); await submit(page).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#email-error')).toHaveText('Dữ liệu nhập không hợp lệ');
});

test('network failure retains input and permits explicit retry', async ({ page }) => {
  const state = await mockAuth(page, route => route.abort()); await page.goto('/sign-in'); await fill(page); await submit(page).click();
  await expect(page.getByRole('alert')).toContainText('Không thể kết nối đến máy chủ');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('ExistingPassword!');
  await submit(page).click(); await expect.poll(() => state.calls).toBe(2);
});

test('session expiry returns to Sign-in with a visible explanation', async ({ page }) => {
  const state = await mockAuth(page, undefined, account());
  await page.route('**/api/v1/players/me', async route => {
    state.user = null;
    await route.fulfill({ status: 401, json: errorBody('AUTH_SESSION_EXPIRED') });
  });
  await page.goto('/'); await expect(page).toHaveURL('/sign-in');
  await expect(page.getByRole('status')).toContainText('Phiên đăng nhập đã kết thúc.');
  await expect(submit(page)).toBeEnabled();
});

test('pending disables controls, respects reduced motion and blocks duplicates', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  const state = await mockAuth(page, async route => { await gate; await route.fulfill({ status: 401, json: errorBody('AUTH_INVALID_CREDENTIALS') }); });
  await page.goto('/sign-in'); await fill(page); await submit(page).click();
  await expect(page.getByRole('button', { name: 'Đang đăng nhập...' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Đang đăng nhập...' }).locator('svg')).toHaveCSS('animation-name', 'none');
  await expect(page.getByLabel('Email', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Hiện mật khẩu' })).toBeDisabled();
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(state.calls).toBe(1); release(); await expect(page.getByRole('alert')).toBeVisible(); await expect(submit(page)).toBeEnabled();
});

for (const [role, target] of [['PLAYER', '/'], ['COURT_OWNER', '/owner'], ['ADMIN', '/admin/users']] as const) {
  test(`redirects ${role}, trims email, and preserves an existing password`, async ({ page }) => {
    await mockAuth(page, async (route, state) => {
      expect(route.request().postDataJSON()).toEqual({ email: 'player@example.com', password: ' x ' });
      state.user = account(role); await route.fulfill({ json: { data: state.user } });
    });
    await page.goto('/sign-in'); await page.getByLabel('Email', { exact: true }).fill(' player@example.com ');
    await page.getByLabel('Mật khẩu', { exact: true }).fill(' x '); await submit(page).click(); await expect(page).toHaveURL(target);
    expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain(' x ');
  });
}

test('forced password change overrides the saved destination', async ({ page }) => {
  await mockAuth(page, async (route, state) => { state.user = account('PLAYER', true); await route.fulfill({ json: { data: state.user } }); });
  await page.goto('/tournaments'); await expect(page).toHaveURL('/sign-in'); await fill(page); await submit(page).click();
  await expect(page).toHaveURL('/change-password'); await expect(page.getByRole('heading', { name: 'Bắt buộc đổi mật khẩu', exact: true })).toBeVisible();
});

test('returns to a saved permitted route', async ({ page }) => {
  await mockAuth(page); await page.goto('/tournaments'); await expect(page).toHaveURL('/sign-in');
  await fill(page); await submit(page).click(); await expect(page).toHaveURL('/tournaments');
});

test('discards a saved route outside the signed-in role area', async ({ page }) => {
  await mockAuth(page, async (route, state) => { state.user = account('ADMIN'); await route.fulfill({ json: { data: state.user } }); });
  await page.goto('/tournaments'); await expect(page).toHaveURL('/sign-in'); await fill(page); await submit(page).click(); await expect(page).toHaveURL('/admin/users');
});

test('retains the existing one-time CSRF refresh/retry', async ({ page, context }) => {
  await context.addCookies([{ name: 'csrf_token', value: 'initial', url: 'http://localhost:5197' }]);
  const state = await mockAuth(page, async (route, state) => {
    expect(route.request().headers()['x-csrf-token']).toBe('initial');
    if (state.calls === 1) return route.fulfill({ status: 403, json: errorBody('AUTH_CSRF_TOKEN_INVALID') });
    state.user = account(); return route.fulfill({ json: { data: state.user } });
  });
  await page.goto('/sign-in'); await fill(page); await submit(page).click(); await expect(page).toHaveURL('/');
  expect(state.calls).toBe(2); expect(state.refreshCalls).toBe(1);
});

for (const width of [320, 390, 768, 1024, 1280, 1440, 1920]) {
  test(`responsive ${width}px, primary color and unchanged registration link`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await mockAuth(page); await page.goto('/sign-in');
    await expect(page.getByRole('heading', { name: 'Đăng nhập', exact: true })).toBeVisible();
    await expect(submit(page)).toHaveCSS('background-color', 'rgb(0, 107, 44)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.locator('[data-slot="hero-art"]')).toBeVisible();
    await expect(page.locator('.auth-shell')).toHaveCount(0);
    if (width >= 1024) {
      const title = (await page.getByRole('heading', { name: 'Hẹn nhau trên sân.' }).boundingBox())!;
      const art = (await page.locator('[data-slot="hero-art"]').boundingBox())!;
      expect(art.y).toBeGreaterThan(title.y + title.height);
    }
    await page.screenshot({ path: `/tmp/smashpro-d01-v2/sign-in-${width}.png`, fullPage: true });
    await page.getByRole('link', { name: 'Tạo tài khoản', exact: true }).click(); await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: 'Đăng ký người chơi', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

for (const width of [390, 1280]) {
  test(`legacy access denial retains its controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuth(page, undefined, account()); await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Access Denied', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}

test('vector responds to the mouse, resets on leave and follows live reduced-motion changes', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await mockAuth(page); await page.goto('/sign-in');
  const hero = page.locator('[data-slot="sign-in-hero"]');
  const art = page.locator('[data-slot="hero-art"]');
  const box = (await hero.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.7);
  await expect(art).not.toHaveCSS('transform', 'none');
  await page.getByLabel('Email', { exact: true }).hover();
  await expect(art).toHaveCSS('transform', 'none');
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.7);
  await expect(art).not.toHaveCSS('transform', 'none');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(art).toHaveCSS('transform', 'none');
  await page.mouse.move(box.x + 30, box.y + 30);
  await expect(art).toHaveCSS('transform', 'none');
  expect(await art.getAttribute('src')).toMatch(/badminton-court.*\.svg/);
});

test('touch devices keep the illustration still and preserve usable form controls', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await mockAuth(page); await page.goto('http://localhost:5197/sign-in');
    await page.getByLabel('Email', { exact: true }).tap();
    await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
    await expect(page.locator('[data-slot="hero-art"]')).toHaveCSS('transform', 'none');
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).tap();
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  } finally { await context.close(); }
});

for (const width of [390, 1280]) {
  test(`legacy Change-password retains its form after CSS cleanup at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuth(page, undefined, account()); await page.goto('/change-password');
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu', exact: true })).toBeVisible();
    await expect(page.locator('.auth-shell')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/smashpro-d01-v2/legacy-change-password-${width}.png`, fullPage: true });
  });
}
