import { expect, test } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { mockOwnerUi, ownerFacilities } from './owner-ui-mocks';

for (const width of [390, 1280]) test(`Owner shell keeps six destinations and facility context at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await mockOwnerUi(page);
  await page.goto('/owner/account?facilityId=22');
  await expect(page.getByRole('heading', { name: 'Tài khoản Chủ sân' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Kênh Chủ sân' });
  await expect(nav.getByRole('link')).toHaveCount(6);
  const targets = ['', '/facilities', '/pricing', '/schedule', '/wallet', '/account'];
  for (const [index, path] of targets.entries()) await expect(nav.getByRole('link').nth(index)).toHaveAttribute('href', `/owner${path}?facilityId=22`);
  await expect(nav.getByRole('link', { name: 'Tài khoản', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByLabel('Chọn cơ sở', { exact: true })).toHaveAttribute('data-value', '22');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  if (width === 390) {
    const banner = page.getByRole('banner'); const logout = banner.getByRole('button', { name: 'Đăng xuất' });
    const bounds = await logout.boundingBox(); expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(await page.getByRole('main').evaluate(node => node.getBoundingClientRect().bottom <= document.documentElement.scrollHeight)).toBeTruthy();
  }
});

test('facility selection preserves query replacement and remounts the scoped draft', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner/facilities?facilityId=22&other=old');
  const name = page.getByLabel('Tên cơ sở', { exact: true }).last();
  await expect(name).toHaveValue(ownerFacilities[1].name); await name.fill('Bản nháp chưa lưu');
  await chooseSelectOption(page.getByLabel('Chọn cơ sở', { exact: true }), '11');
  await expect(page).toHaveURL('/owner/facilities?facilityId=11');
  await expect(page.getByLabel('Tên cơ sở', { exact: true }).last()).toHaveValue(ownerFacilities[0].name);
  await page.reload(); await expect(page.getByLabel('Chọn cơ sở', { exact: true })).toHaveAttribute('data-value', '11');
});

test('invalid facility ID uses the first owned row without rewriting the original URL', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner/account?facilityId=999');
  await expect(page.getByLabel('Chọn cơ sở', { exact: true })).toHaveAttribute('data-value', '11');
  await expect(page).toHaveURL('/owner/account?facilityId=999');
  await expect(page.getByRole('navigation', { name: 'Kênh Chủ sân' }).getByRole('link', { name: 'Bảng giá sân' })).toHaveAttribute('href', '/owner/pricing?facilityId=11');
});

test('facility loading and failed read keep retry and then restore the workspace', async ({ page }) => {
  let failed = true; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await mockOwnerUi(page, { '/api/v1/owner/facilities': async route => { await gate; return failed ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'unavailable' } } }) : route.fulfill({ json: { data: ownerFacilities, meta: { page: 1, totalPages: 1, limit: 100, total: 2 } } }); } });
  await page.goto('/owner/account'); await expect(page.getByText('Đang tải…', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tài khoản Chủ sân' })).toHaveCount(0);
  release(); await expect(page.getByRole('alert')).toContainText('Không thể tải danh sách cơ sở.');
  failed = false; await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tài khoản Chủ sân' })).toBeVisible();
});

test('facility list still reads all server pages before selecting a deep-linked facility', async ({ page }) => {
  const pages: number[] = [];
  await mockOwnerUi(page, { '/api/v1/owner/facilities': route => { const query = new URL(route.request().url()).searchParams; const pageNo = Number(query.get('page')); pages.push(pageNo); expect(query.get('limit')).toBe('100'); return route.fulfill({ json: { data: [ownerFacilities[pageNo - 1]], meta: { page: pageNo, totalPages: 2, total: 2, limit: 100 } } }); } });
  await page.goto('/owner/account?facilityId=22'); await expect(page.getByLabel('Chọn cơ sở', { exact: true })).toHaveAttribute('data-value', '22'); expect(pages.filter((page, index) => index === 0 || page !== pages[index - 1])).toEqual([1, 2]); await page.getByLabel('Chọn cơ sở', { exact: true }).click(); await expect(page.getByRole('option')).toHaveCount(2); await page.keyboard.press('Escape');
});

test('empty Owner workspace keeps existing onboarding and sign-out flow', async ({ page }) => {
  const state = await mockOwnerUi(page, {}, []); await page.goto('/owner');
  await expect(page.getByText('Bạn chưa có cơ sở.', { exact: false }).first()).toBeVisible();
  await expect(page.getByLabel('Chọn cơ sở', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Gửi cơ sở để duyệt', exact: true })).toBeVisible();
  await page.getByRole('banner').getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL('/sign-in'); expect(state.logoutCalls).toBe(1);
});

test('Owner footer links keep the selected facility and show the current year', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner/account?facilityId=22');
  const footer = page.locator('footer');
  await expect(footer).toContainText(`© ${new Date().getFullYear()}`);
  const links = footer.getByRole('navigation', { name: 'Liên kết chân trang chủ sân' }).getByRole('link');
  await expect(links).not.toHaveCount(0);
  for (const href of await links.evaluateAll(anchors => anchors.map(anchor => anchor.getAttribute('href')))) expect(href).toMatch(/^\/owner(\/[a-z-]+)?\?facilityId=22$/);
});

test('Owner skip link takes keyboard focus into the main content', async ({ page }) => {
  await mockOwnerUi(page); await page.goto('/owner/account'); await expect(page.getByRole('heading', { name: 'Tài khoản Chủ sân' })).toBeVisible(); await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung chính' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('main')).toBeFocused();
});
