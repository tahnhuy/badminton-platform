import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

/** SH01 contract UI tests for the Player shell (mocked API, 3 unread messages). */
async function openShell(page: Page, path = '/courts') {
  const state = await mockAuthApi(page, {
    user: account(),
    handlers: {
      '/api/v1/conversations/unread-summary': route => route.fulfill({ json: { data: { totalUnread: 3 } } }),
      '/api/v1/facilities': route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } }),
    },
  });
  await page.goto(path);
  await expect(page.locator('[data-app-header]')).toBeVisible();
  return state;
}
const NAV = ['Sân cầu lông', 'Tìm đối thủ', 'Cộng đồng', 'Tin nhắn', 'Giải đấu'];
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('header has five working areas, the active one and the unread count', async ({ page }) => {
    await openShell(page);
    const nav = page.locator('header').getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav.getByRole('link')).toHaveCount(5);
    for (const label of NAV) await expect(nav.getByRole('link', { name: new RegExp(`^${label}`) })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Sân cầu lông' })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: /^Tin nhắn/ })).toContainText('3');
    await expect(page.getByRole('button', { name: 'Thông báo', exact: true })).toBeVisible();
    await expect(page.getByText('Trang chủ', { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-app-bottom-nav]')).toBeHidden();
  });

  test('account menu works with the keyboard and signs out', async ({ page }) => {
    const state = await openShell(page);
    const trigger = page.getByRole('button', { name: 'Tài khoản của tôi' });
    await trigger.focus(); await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu.getByRole('menuitem')).toHaveText(['Hồ sơ cá nhân', 'Ví của tôi', 'Lịch đặt sân của tôi', 'Đánh giá đã gửi', 'Danh sách chặn', 'Đổi mật khẩu', 'Đăng xuất']);
    await expect(menu).toContainText('D01 Player'); await expect(menu).toContainText('Người chơi · Trung bình');
    await page.keyboard.press('Escape'); await expect(menu).toHaveCount(0); await expect(trigger).toBeFocused();
    await trigger.click(); await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
  });

  test('skip link moves focus to the main content', async ({ page }) => {
    await openShell(page);
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Bỏ qua tới nội dung chính' });
    await expect(skip).toBeFocused(); await expect(skip).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
  });

  test('the root and the logo lead to the community feed', async ({ page }) => {
    await openShell(page, '/');
    await expect(page).toHaveURL('/feed');
    await expect(page.getByRole('link', { name: 'SmashPro — về trang đầu' })).toHaveAttribute('href', '/feed');
    await expect(page.locator('header').getByRole('link', { name: 'Cộng đồng' })).toHaveAttribute('aria-current', 'page');
  });

  test('footer links lead to working player areas and show the current year', async ({ page }) => {
    await openShell(page);
    const footer = page.locator('footer');
    await expect(footer).toContainText(`© ${new Date().getFullYear()}`);
    const links = footer.getByRole('navigation', { name: 'Liên kết chân trang người chơi' }).getByRole('link');
    await expect(links).not.toHaveCount(0);
    for (const href of await links.evaluateAll(anchors => anchors.map(anchor => anchor.getAttribute('href')))) expect(href).not.toBe('#');
    await expect(footer.getByRole('link', { name: 'Cộng đồng', exact: true })).toHaveAttribute('href', '/feed');
  });
});

test('1024 px keeps the navigation on one line without covering the logo', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await openShell(page);
  const logo = (await page.getByRole('link', { name: 'SmashPro — về trang đầu' }).boundingBox())!;
  const first = (await page.locator('header').getByRole('link', { name: 'Sân cầu lông' }).boundingBox())!;
  expect(logo.x + logo.width).toBeLessThanOrEqual(first.x);
  for (const label of NAV) {
    const box = (await page.locator('header').getByRole('link', { name: new RegExp(`^${label}`) }).boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(44);
  }
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('bottom navigation replaces the header links and keeps the chat bubble above it', async ({ page }) => {
    await openShell(page);
    await expect(page.locator('header').getByRole('navigation')).toBeHidden();
    const bottom = page.locator('[data-app-bottom-nav]');
    await expect(bottom.getByRole('link')).toHaveCount(5);
    await expect(bottom.getByRole('link', { name: /^Tin nhắn/ })).toContainText('3');
    await bottom.getByRole('link', { name: 'Cộng đồng' }).click();
    await expect(page).toHaveURL('/feed');
    await expect(bottom.getByRole('link', { name: 'Cộng đồng' })).toHaveAttribute('aria-current', 'page');
    const navTop = (await bottom.boundingBox())!.y;
    const bubble = page.getByRole('button', { name: 'Mở khung tin nhắn nhanh', exact: true });
    await expect(bubble).toBeVisible();
    await expect.poll(async () => {
      const bubbleBox = (await bubble.boundingBox())!;
      return bubbleBox.y + bubbleBox.height;
    }).toBeLessThanOrEqual(navTop);
  });

  test('burger menu lists the primary tabs vertically', async ({ page }) => {
    await openShell(page);
    const burger = page.getByRole('button', { name: 'Mở menu điều hướng' });
    await expect(burger).toBeVisible();
    await burger.focus(); await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    for (const label of NAV) await expect(menu.getByRole('menuitem', { name: new RegExp(`^${label}`) })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Sân cầu lông' })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0); await expect(burger).toBeFocused();
  });

  test('logo shows only the mark and the header has no overlap', async ({ page }) => {
    await openShell(page);
    const logo = (await page.getByRole('link', { name: 'SmashPro — về trang đầu' }).boundingBox())!;
    const account = (await page.getByRole('button', { name: 'Tài khoản của tôi' }).boundingBox())!;
    expect(logo.x + logo.width).toBeLessThan(account.x);
  });
});

for (const width of [390, 768, 1024, 1280, 1440]) {
  test(`responsive ${width}px has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openShell(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.screenshot({ path: `/tmp/smashpro-sh01/shell-${width}.png` });
  });
}
