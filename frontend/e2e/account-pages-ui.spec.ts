import { expect, test, type Page, type Route } from '@playwright/test';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';

/** D02 contract UI tests: Change-password, Access-denied, session loading and the Admin account menu (mocked API). */
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const current = (page: Page) => field(page, 'Mật khẩu hiện tại');
const next = (page: Page) => field(page, 'Mật khẩu mới');
const confirm = (page: Page) => field(page, 'Nhập lại mật khẩu mới');
const submit = (page: Page) => page.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true });
async function fillValid(page: Page) {
  await current(page).fill('OldPassword1'); await next(page).fill('BrandNewPass1'); await confirm(page).fill('BrandNewPass1');
}
const noOverflow = async (page: Page, width: number) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

test.describe('Change password', () => {
  test('self-service page uses the focused layout with back and sign-out', async ({ page }) => {
    await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    await expect(page.getByRole('heading', { name: 'Đổi mật khẩu', exact: true })).toBeVisible();
    await expect(page.getByText('player@example.com')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quay lại' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
    await expect(page.getByText(/1,200\+/)).toHaveCount(0);
  });

  test('validates on the client and sends nothing when invalid', async ({ page }) => {
    const state = await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    await submit(page).click();
    await expect(page.getByText('Vui lòng nhập mật khẩu hiện tại.')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập mật khẩu mới.')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập lại mật khẩu mới.')).toBeVisible();
    await expect(current(page)).toBeFocused();
    await current(page).fill('OldPassword1'); await next(page).fill('short12'); await submit(page).click();
    await expect(page.getByText('Mật khẩu mới phải có từ 8 đến 64 ký tự.')).toBeVisible();
    await next(page).fill('PLAYER@example.com');
    await expect(page.getByText('Mật khẩu mới không được trùng với email.')).toBeVisible();
    await next(page).fill('BrandNewPass1'); await confirm(page).fill('BrandNewPass2'); await submit(page).click();
    await expect(page.getByText('Mật khẩu nhập lại không khớp.')).toBeVisible();
    await expect(confirm(page)).toHaveAttribute('aria-invalid', 'true');
    expect(state.changeCalls).toBe(0);
  });

  test('live checklist reports each rule in text', async ({ page }) => {
    await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    const rules = page.locator('#new-password-rules');
    await expect(next(page)).toHaveAttribute('aria-describedby', /new-password-rules/);
    await expect(rules).toContainText('Chưa đạt: Từ 8 đến 64 ký tự');
    await next(page).fill('BrandNewPass1');
    await expect(rules).toContainText('Đã đạt: Từ 8 đến 64 ký tự');
    await expect(rules).toContainText('Đã đạt: Không trùng với email tài khoản');
    await next(page).fill('player@example.com');
    await expect(rules).toContainText('Chưa đạt: Không trùng với email tài khoản');
  });

  test('password toggles are reachable by keyboard', async ({ page }) => {
    await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    await current(page).focus(); await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Hiện mật khẩu hiện tại' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(current(page)).toHaveAttribute('type', 'text');
    await expect(page.getByRole('button', { name: 'Ẩn mật khẩu hiện tại' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('wrong current password is attached to and focuses its field', async ({ page }) => {
    await mockAuthApi(page, { user: account(), changePassword: route => route.fulfill({ status: 400, json: errorBody('AUTH_CURRENT_PASSWORD_INCORRECT') }) });
    await page.goto('/change-password'); await fillValid(page); await submit(page).click();
    await expect(page.locator('#currentPassword-error')).toHaveText('Mật khẩu hiện tại không đúng.');
    await expect(current(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(current(page)).toBeFocused();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('server policy violation is attached to the new password', async ({ page }) => {
    await mockAuthApi(page, { user: account(), changePassword: route => route.fulfill({ status: 400, json: errorBody('AUTH_PASSWORD_POLICY_VIOLATION') }) });
    await page.goto('/change-password'); await fillValid(page); await submit(page).click();
    await expect(page.locator('#newPassword-error')).toContainText('Mật khẩu mới chưa đạt quy định');
    await expect(next(page)).toBeFocused();
  });

  for (const [name, handler, text] of [
    ['rate limit', (route: Route) => route.fulfill({ status: 429, json: errorBody('AUTH_RATE_LIMITED') }), 'Bạn đã thử đổi mật khẩu quá nhiều lần.'],
    ['unexpected server error', (route: Route) => route.fulfill({ status: 500, json: errorBody('UNEXPECTED_INTERNAL_ERROR') }), 'Không thể đổi mật khẩu lúc này.'],
    ['network failure', (route: Route) => route.abort(), 'Không thể kết nối đến máy chủ.'],
  ] as const) {
    test(`${name} shows a focused banner without leaking server text`, async ({ page }) => {
      await mockAuthApi(page, { user: account(), changePassword: handler });
      await page.goto('/change-password'); await fillValid(page); await submit(page).click();
      await expect(page.getByRole('alert')).toContainText(text); await expect(page.getByRole('alert')).toBeFocused();
      await expect(page.getByText('Internal message must not be displayed')).toHaveCount(0);
      await expect(next(page)).toHaveValue('BrandNewPass1');
    });
  }

  test('pending state disables the form and blocks duplicates', async ({ page }) => {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const state = await mockAuthApi(page, { user: account(), changePassword: async route => { await gate; await route.fulfill({ status: 400, json: errorBody('AUTH_CURRENT_PASSWORD_INCORRECT') }); } });
    await page.goto('/change-password'); await fillValid(page); await submit(page).click();
    await expect(page.getByRole('button', { name: 'Đang cập nhật...' })).toBeDisabled();
    await expect(current(page)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeDisabled();
    await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    expect(state.changeCalls).toBe(1); release();
    await expect(submit(page)).toBeEnabled();
  });

  test('success ends this session and asks to sign in again with the new password', async ({ page }) => {
    const state = await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    await fillValid(page); await submit(page).click();
    await expect(page).toHaveURL('/sign-in');
    expect(state.changeBodies).toEqual([{ currentPassword: 'OldPassword1', newPassword: 'BrandNewPass1' }]);
    expect(state.logoutCalls).toBe(1);
    await expect(page.getByRole('status').filter({ hasText: 'Đổi mật khẩu thành công.' })).toContainText('đăng nhập lại bằng mật khẩu mới');
    await page.getByLabel('Email', { exact: true }).fill('player@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('BrandNewPass1');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL('/feed');
  });

  test('forced change blocks other routes, has no back button and also requires a new sign-in', async ({ page }) => {
    const state = await mockAuthApi(page, { user: account('PLAYER', true) });
    await page.goto('/feed'); await expect(page).toHaveURL('/change-password');
    await expect(page.getByRole('heading', { name: 'Bắt buộc đổi mật khẩu', exact: true })).toBeVisible();
    await expect(page.getByText('Bạn cần đổi mật khẩu trước khi có thể truy cập các tính năng khác của hệ thống.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quay lại' })).toHaveCount(0);
    await fillValid(page); await submit(page).click();
    await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
    await expect(page.getByText('Đổi mật khẩu thành công.')).toBeVisible();
  });

  test('sign-out leaves to Sign-in without a saved destination', async ({ page }) => {
    const state = await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
    await page.getByLabel('Email', { exact: true }).fill('player@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Whatever1');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await expect(page).toHaveURL('/feed');
  });

  test('back without history returns to the role home', async ({ page }) => {
    await mockAuthApi(page, { user: account('COURT_OWNER') }); await page.goto('/change-password');
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await expect(page).toHaveURL('/owner');
  });
});

test.describe('Access denied', () => {
  for (const [role, path, label] of [['PLAYER', '/admin/users', 'Người chơi'], ['COURT_OWNER', '/admin/users', 'Chủ sân'], ['ADMIN', '/feed', 'Quản trị viên']] as const) {
    test(`${role} sees Vietnamese denial at the blocked URL`, async ({ page }) => {
      await mockAuthApi(page, { user: account(role) }); await page.goto(path);
      await expect(page).toHaveURL(path);
      await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeVisible();
      await expect(page.getByText(`Bạn đang đăng nhập với vai trò ${label}.`)).toBeVisible();
      await expect(page.getByText(role, { exact: true })).toHaveCount(0);
      const home = role === 'ADMIN' ? '/admin' : role === 'COURT_OWNER' ? '/owner' : '/feed';
      await expect(page.getByRole('link', { name: 'Về trang của bạn' })).toHaveAttribute('href', home);
    });
  }

  test('sign-out from the denial page', async ({ page }) => {
    const state = await mockAuthApi(page, { user: account() }); await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
  });
});

test('session loading is branded, Vietnamese and announced', async ({ page }) => {
  await mockAuthApi(page, { user: account(), meDelayMs: 1500 }); await page.goto('/change-password');
  await expect(page.getByRole('status')).toContainText('Đang tải phiên đăng nhập…');
  await expect(page.getByRole('heading', { name: 'Đổi mật khẩu', exact: true })).toBeVisible();
});

test.describe('Admin account menu', () => {
  test('opens by keyboard, links to change password and returns with back', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mockAuthApi(page, { user: account('ADMIN') }); await page.goto('/admin/users');
    const trigger = page.getByRole('button', { name: 'Tài khoản quản trị' });
    await trigger.focus(); await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toContainText('player@example.com');
    await expect(page.getByRole('menu')).toContainText('Quản trị viên');
    await page.waitForTimeout(300); await page.screenshot({ path: '/tmp/smashpro-d02/admin-account-menu-1280.png' });
    await page.keyboard.press('Escape'); await expect(page.getByRole('menu')).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await page.getByRole('menuitem', { name: 'Đổi mật khẩu' }).click();
    await expect(page).toHaveURL('/change-password');
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await expect(page).toHaveURL('/admin/users');
  });

  test('signs the admin out', async ({ page }) => {
    const state = await mockAuthApi(page, { user: account('ADMIN') }); await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Tài khoản quản trị' }).click();
    await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
  });
});

for (const width of [390, 768, 1280]) {
  test(`responsive ${width}px: change password, forced change and denial fit the viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuthApi(page, { user: account() }); await page.goto('/change-password');
    await expect(submit(page)).toBeVisible(); await noOverflow(page, width);
    await page.screenshot({ path: `/tmp/smashpro-d02/change-password-${width}.png`, fullPage: true });
    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeVisible(); await noOverflow(page, width);
    await page.screenshot({ path: `/tmp/smashpro-d02/access-denied-${width}.png`, fullPage: true });
  });
  test(`responsive ${width}px: forced change`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockAuthApi(page, { user: account('PLAYER', true) }); await page.goto('/change-password');
    await next(page).fill('BrandNewPass1');
    // The field icon stays visible above the focused input's background.
    const icon = page.locator('#newPassword').locator('xpath=preceding-sibling::*[1]');
    expect(Number(await icon.evaluate(el => getComputedStyle(el).zIndex))).toBeGreaterThan(0);
    await expect(submit(page)).toBeVisible(); await noOverflow(page, width);
    await page.screenshot({ path: `/tmp/smashpro-d02/forced-${width}.png`, fullPage: true });
  });
}
