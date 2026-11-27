import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi, type Account } from './auth-ui-mocks';
import { SKILL_LEVELS, SURVEY_V1 } from './register-ui-fixtures';

/** UI contract tests for the public landing page at `/` (AUTH-34, mocked API, no backend). */

const PRIMARY_CTA = 'Khám phá trình độ – 3 phút';

async function openLanding(page: Page, options: { user?: Account | null; levelsFail?: boolean } = {}) {
  const state = await mockAuthApi(page, { user: options.user ?? null, handlers: {
    '/api/v1/skill-levels': route => options.levelsFail ? route.abort() : route.fulfill({ json: { data: SKILL_LEVELS } }),
    '/api/v1/auth/skill-survey': route => route.fulfill({ json: { data: SURVEY_V1 } }),
  } });
  await page.goto('/');
  return state;
}
const header = (page: Page) => page.getByRole('banner');
const ladder = (page: Page) => page.getByRole('radiogroup', { name: 'Chọn một bậc để xem mô tả' });
const rung = (page: Page, rank: number) => page.getByRole('radio', { name: new RegExp(`^Bậc ${rank}:`) });
const detail = (page: Page) => page.locator('[data-slot="ladder-detail"]');
const mobileBar = (page: Page) => page.locator('[data-slot="mobile-action-bar"]');
const noHorizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('a visitor sees the landing page at / instead of Sign-in', async ({ page }) => {
  await openLanding(page);
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hẹn nhau trên sân.');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  for (const role of ['banner', 'main', 'contentinfo'] as const) await expect(page.getByRole(role)).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Mục trên trang' })).toBeVisible();
  await expect(page.getByRole('link', { name: PRIMARY_CTA }).first()).toBeVisible();
  await expect(page.getByText('16 câu chọn nhanh, không có câu sai')).toBeVisible();
  // The court-owner band leads to the public partnership form, never to an invented address.
  await expect(page.locator('[data-slot="owner-contact"]')).toHaveAttribute('href', '/hop-tac');
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  // The match card is decorative sample content.
  await expect(page.locator('[data-slot="hero-art"]')).toHaveAttribute('aria-hidden', 'true');
});

test('the primary action opens survey step 1 at /register', async ({ page }) => {
  await openLanding(page);
  await page.getByRole('link', { name: PRIMARY_CTA }).first().click();
  await expect(page).toHaveURL('/register');
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn đã gắn bó với cầu lông thế nào?' })).toBeVisible();
});

test('"Tôi đã có tài khoản" and the header "Đăng nhập" open /sign-in', async ({ page }) => {
  await openLanding(page);
  await page.getByRole('link', { name: 'Tôi đã có tài khoản' }).first().click();
  await expect(page).toHaveURL('/sign-in');
  await page.goBack(); await expect(page).toHaveURL('/');
  await header(page).getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL('/sign-in');
  await expect(page.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeVisible();
});

for (const [role, home] of [['PLAYER', '/feed'], ['COURT_OWNER', '/owner'], ['ADMIN', '/admin/dashboard']] as const) {
  test(`a signed-in ${role} opening / lands on ${home} without the landing page`, async ({ page }) => {
    await openLanding(page, { user: account(role) });
    await expect(page).toHaveURL(home);
    await expect(page.locator('[data-slot="landing-page"]')).toHaveCount(0);
  });
}

test('a Player who must change the password goes to /change-password first', async ({ page }) => {
  await openLanding(page, { user: account('PLAYER', true) });
  await expect(page).toHaveURL('/change-password');
});

test('a visitor deep link to a Player page still goes to Sign-in', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/feed');
  await expect(page).toHaveURL('/sign-in');
});

test('the ladder shows catalog names and descriptions by mouse and keyboard', async ({ page }) => {
  await openLanding(page);
  await expect(ladder(page)).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(SKILL_LEVELS.length);
  await rung(page, 6).click();
  await expect(rung(page, 6)).toHaveAttribute('aria-checked', 'true');
  await expect(detail(page)).toContainText('Bậc 6/7');
  await expect(detail(page)).toContainText('Khá');
  await expect(detail(page)).toContainText(SKILL_LEVELS[5].description);
  // The one-time demo stops once the visitor takes over.
  await page.waitForTimeout(1200);
  await expect(rung(page, 6)).toHaveAttribute('aria-checked', 'true');
  // Roving tabindex: only the checked radio is in the tab order.
  await expect(page.locator('[role="radio"][tabindex="0"]')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(rung(page, 7)).toBeFocused(); await expect(rung(page, 7)).toHaveAttribute('aria-checked', 'true');
  await expect(detail(page)).toContainText(SKILL_LEVELS[6].description);
  await page.keyboard.press('ArrowLeft'); await expect(rung(page, 6)).toBeFocused();
  await page.keyboard.press('ArrowLeft'); await expect(rung(page, 5)).toBeFocused();
  await expect(rung(page, 5)).toHaveAttribute('aria-checked', 'true');
  await expect(detail(page)).toContainText(SKILL_LEVELS[4].description);
  await page.keyboard.press('Home');
  await expect(rung(page, 1)).toBeFocused(); await expect(rung(page, 1)).toHaveAttribute('aria-checked', 'true');
  await expect(detail(page)).toContainText(SKILL_LEVELS[0].description);
  await page.keyboard.press('End');
  await expect(rung(page, 7)).toHaveAttribute('aria-checked', 'true');
  await expect(detail(page)).toContainText(SKILL_LEVELS[6].description);
});

test('the ladder demo walks up to level 4 once when it scrolls into view', async ({ page }) => {
  await openLanding(page);
  await ladder(page).scrollIntoViewIfNeeded();
  await expect(rung(page, 1)).toHaveAttribute('aria-checked', 'true');
  await expect(rung(page, 4)).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(1200);
  await expect(rung(page, 4)).toHaveAttribute('aria-checked', 'true');
});

test('a skill-level failure keeps the rest of the page usable', async ({ page }) => {
  await openLanding(page, { levelsFail: true });
  await expect(page.getByText('Chưa tải được mô tả các bậc.')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
  await page.getByRole('link', { name: 'Làm khảo sát ngay' }).click();
  await expect(page).toHaveURL('/register');
});

test('header is transparent over the hero, solid after it; no nav item is active in the hero', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openLanding(page);
  const nav = page.getByRole('navigation', { name: 'Mục trên trang' });
  await expect(header(page)).toHaveAttribute('data-surface', 'hero');
  await expect(header(page)).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  await page.locator('#levels').scrollIntoViewIfNeeded();
  await expect(header(page)).toHaveAttribute('data-surface', 'solid');
  await expect(header(page)).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(nav.locator('[aria-current="true"]')).toHaveCount(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(header(page)).toHaveAttribute('data-surface', 'hero');
  await expect(nav.locator('[aria-current]')).toHaveCount(0);
  // In-page links move to their section.
  await nav.getByRole('link', { name: 'Trình độ' }).click();
  await expect(nav.getByRole('link', { name: 'Trình độ' })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('#levels')).toBeFocused();
});

test('on a phone the bottom action bar appears after the hero actions and hides at the closing CTA', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openLanding(page);
  await expect(mobileBar(page)).toHaveAttribute('data-state', 'hidden');
  await expect(mobileBar(page)).not.toBeInViewport();
  await expect(mobileBar(page).getByRole('link', { name: 'Đăng nhập' })).toHaveCount(0); // inert + aria-hidden: not exposed
  await page.locator('#features').scrollIntoViewIfNeeded();
  await expect(mobileBar(page)).toHaveAttribute('data-state', 'shown');
  await expect(mobileBar(page)).toBeInViewport();
  await mobileBar(page).getByRole('link', { name: 'Khám phá trình độ' }).click();
  await expect(page).toHaveURL('/register');
  await page.goBack(); await expect(page).toHaveURL('/');
  await page.getByRole('heading', { name: 'Sẵn sàng ra sân?' }).scrollIntoViewIfNeeded();
  await expect(mobileBar(page)).toHaveAttribute('data-state', 'hidden');
});

for (const width of [390, 1280]) {
  test(`${width} px: no horizontal overflow and every action reachable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openLanding(page);
    await expect(ladder(page)).toBeVisible();
    expect(await noHorizontalOverflow(page)).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(400);
    expect(await noHorizontalOverflow(page)).toBe(true);
    // Keyboard: the skip link comes first and moves focus to the main content.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung chính' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('main')).toBeFocused();
    // Touch targets of the header and hero actions are at least 44 px high.
    for (const link of [header(page).getByRole('link', { name: 'Đăng nhập', exact: true }), page.getByRole('link', { name: PRIMARY_CTA }).first(), page.getByRole('link', { name: 'Tôi đã có tài khoản' }).first()]) {
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(43.5); // sub-pixel layout
    }
  });
}

test('reduced motion: no decorative animation, final states at once, static match card', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openLanding(page);
  await expect(ladder(page)).toBeVisible();
  await expect(page.locator('animateMotion')).toHaveCount(0);
  await expect(page.locator('[data-slot="flight-shuttle"]')).toHaveCount(0);
  await page.locator('#levels').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4600); // past the first flip of the sample card and the ladder demo
  await expect(page.locator('[data-slot="match-status"]')).toHaveText('Còn 1 chỗ');
  await expect(page.locator('[data-slot="match-card"]')).toHaveAttribute('data-state', 'open');
  await expect(rung(page, 4)).toHaveAttribute('aria-checked', 'true');
  for (const selector of ['#features article', '#how li', '[data-slot="ladder-card"]']) {
    await expect(page.locator(selector).first()).toHaveCSS('opacity', '1');
  }
  const running = await page.evaluate(() => document.getAnimations().filter(animation => animation.playState === 'running').length);
  expect(running).toBe(0);
});

test('with motion allowed the sample card fills its last slot', async ({ page }) => {
  await openLanding(page);
  await expect(page.locator('animateMotion')).toHaveCount(1);
  await expect(page.locator('[data-slot="match-status"]')).toHaveText('Còn 1 chỗ');
  await expect(page.locator('[data-slot="match-status"]')).toHaveText('Đủ người ✓', { timeout: 8000 });
});

test('the logo on Sign-in and on Register returns to the landing page', async ({ page }) => {
  await mockAuthApi(page, { handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: SKILL_LEVELS } }),
    '/api/v1/auth/skill-survey': route => route.fulfill({ json: { data: SURVEY_V1 } }),
  } });
  await page.goto('/sign-in');
  await page.getByRole('link', { name: 'Về trang giới thiệu SmashPro' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-slot="landing-page"]')).toBeVisible();
  await page.goto('/register');
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn đã gắn bó với cầu lông thế nào?' })).toBeVisible();
  await page.getByRole('link', { name: 'Về trang giới thiệu SmashPro' }).click();
  await expect(page).toHaveURL('/');
  await expect(page.locator('[data-slot="landing-page"]')).toBeVisible();
});
