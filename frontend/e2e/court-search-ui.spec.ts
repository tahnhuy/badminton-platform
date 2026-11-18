import { expect, test, type Page, type Route } from '@playwright/test';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';

/** D03 contract UI tests for /courts with an in-memory court search API (no backend). */
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const tomorrow = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(Date.now() + 86_400_000));

const facility = (id: number, name: string, district: string, city: string) => ({
  id, name, address: `${id} Đường Mẫu, ${district}`, ward: null, district, city, phone: '0900000000', openingTime: '05:30:00', closingTime: '23:00:00',
});
const FACILITIES = [
  { f: facility(1, 'CLB Alpha Quận 7', 'Quận 7', 'Hồ Chí Minh'), courts: 20, price: 80000 },
  { f: facility(2, 'Sân Beta Gò Vấp', 'Quận Gò Vấp', 'Hồ Chí Minh'), courts: 8, price: 90000 },
  { f: facility(3, 'Gamma Arena', 'Cầu Giấy', 'Hà Nội'), courts: 2, price: 100000 },
];
const COURTS = FACILITIES.flatMap(({ f, courts, price }) => Array.from({ length: courts }, (_, i) => ({
  id: f.id * 100 + i + 1, name: `Sân ${String(i + 1).padStart(2, '0')}`, description: null, priceFrom: price, available: true, facility: f,
})));

interface SearchLog { requests: URLSearchParams[] }
function courtsApi(log: SearchLog, override?: (route: Route) => Promise<void> | void) {
  return async (route: Route) => {
    const query = new URL(route.request().url()).searchParams;
    log.requests.push(query);
    if (override) return override(route);
    const city = query.get('city') ?? ''; const district = query.get('district') ?? '';
    const page = Number(query.get('page') ?? 1); const limit = Number(query.get('limit') ?? 10);
    let rows = COURTS.filter(c => c.facility.city.includes(city) && c.facility.district.includes(district));
    if (query.get('startTime')) rows = rows.filter(c => c.facility.id !== 3); // Gamma is busy in any window
    const data = rows.slice((page - 1) * limit, page * limit);
    return route.fulfill({ json: { data, meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } } });
  };
}
async function openCourts(page: Page, path = '/courts', override?: (route: Route) => Promise<void> | void) {
  const log: SearchLog = { requests: [] };
  await mockAuthApi(page, {
    user: account(),
    handlers: {
      '/api/v1/courts': courtsApi(log, override),
      ...Object.fromEntries(COURTS.map(c => [`/api/v1/courts/${c.id}/availability`, (route: Route) => route.fulfill({ status: 404, json: errorBody('COURT_NOT_FOUND') })])),
    },
  });
  await page.goto(path);
  return log;
}
const summary = (page: Page) => page.locator('#court-results-heading');
const facilityCard = (page: Page, name: string) => page.getByRole('article', { name });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const search = (page: Page) => page.getByRole('button', { name: 'Tìm sân', exact: true });

test.describe('desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('groups courts by facility and explains the order', async ({ page }) => {
    await openCourts(page);
    await expect(summary(page)).toContainText('Tìm thấy 30 sân phù hợp · giá thấp đến cao');
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['CLB Alpha Quận 7', 'Sân Beta Gò Vấp']);
    await expect(facilityCard(page, 'CLB Alpha Quận 7').getByRole('link', { name: /^Sân \d+/ })).toHaveCount(20);
    await expect(facilityCard(page, 'Sân Beta Gò Vấp')).toContainText('Còn sân của cơ sở này ở trang sau.');
    await expect(page.getByText(/^Trống /)).toHaveCount(0);
    await expect(page.getByText('Còn trống', { exact: true })).toHaveCount(0);
  });

  test('searching by area alone works with the default date', async ({ page }) => {
    const log = await openCourts(page);
    await expect(summary(page)).toContainText('30 sân');
    await field(page, 'Tỉnh / Thành phố').fill('Hà Nội'); await search(page).click();
    await expect(summary(page)).toContainText('Tìm thấy 2 sân phù hợp');
    const last = log.requests.at(-1)!;
    expect(last.get('city')).toBe('Hà Nội'); expect(last.get('date')).toBe(today); expect(last.has('startTime')).toBe(false);
    await expect(page).toHaveURL(/city=H%C3%A0\+N%E1%BB%99i|city=H%C3%A0%20N%E1%BB%99i/);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('time window needs both ends in order and sends nothing until valid', async ({ page }) => {
    const log = await openCourts(page); await expect(summary(page)).toContainText('30 sân');
    const sent = log.requests.length;
    await field(page, 'Từ giờ').fill('18:00'); await search(page).click();
    await expect(page.getByText('Chọn cả giờ kết thúc.')).toBeVisible();
    await field(page, 'Đến giờ').fill('17:00'); await search(page).click();
    await expect(page.getByText('Giờ kết thúc phải sau giờ bắt đầu.')).toBeVisible();
    await expect(field(page, 'Đến giờ')).toHaveAttribute('aria-invalid', 'true');
    expect(log.requests.length).toBe(sent);
  });

  test('window search shows the free badge and keeps state in the URL', async ({ page }) => {
    const log = await openCourts(page); await expect(summary(page)).toContainText('30 sân');
    await field(page, 'Ngày chơi').fill(tomorrow); await field(page, 'Từ giờ').fill('18:00'); await field(page, 'Đến giờ').fill('20:00');
    await search(page).click();
    await expect(summary(page)).toContainText('Tìm thấy 28 sân phù hợp · giá thấp đến cao · trống 18:00–20:00');
    await expect(facilityCard(page, 'CLB Alpha Quận 7').getByText('Trống 18:00–20:00')).toBeVisible();
    const last = log.requests.at(-1)!;
    expect([last.get('date'), last.get('startTime'), last.get('endTime')]).toEqual([tomorrow, '18:00', '20:00']);
    await expect(page).toHaveURL(new RegExp(`date=${tomorrow}.*from=18%3A00.*to=20%3A00`));
  });

  test('back and reload restore filters and page', async ({ page }) => {
    const log = await openCourts(page, `/courts?district=G%C3%B2+V%E1%BA%A5p&date=${tomorrow}`);
    await expect(field(page, 'Quận / Huyện')).toHaveValue('Gò Vấp');
    await expect(summary(page)).toContainText('Tìm thấy 8 sân phù hợp');
    await facilityCard(page, 'Sân Beta Gò Vấp').getByRole('link', { name: /^Sân 03/ }).click();
    await expect(page).toHaveURL(`/courts/203?date=${tomorrow}`);
    await page.goBack();
    await expect(field(page, 'Quận / Huyện')).toHaveValue('Gò Vấp'); await expect(field(page, 'Ngày chơi')).toHaveValue(tomorrow);
    await expect(summary(page)).toContainText('Tìm thấy 8 sân phù hợp');
    await page.reload();
    await expect(field(page, 'Quận / Huyện')).toHaveValue('Gò Vấp'); await expect(summary(page)).toContainText('Tìm thấy 8 sân phù hợp');
    expect(log.requests.every(r => r.get('limit') === '24')).toBe(true);
  });

  test('paging moves focus to the results and marks continued facilities', async ({ page }) => {
    await openCourts(page); await expect(summary(page)).toContainText('30 sân');
    await page.getByRole('button', { name: 'Sau' }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(summary(page)).toBeFocused();
    await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Sân Beta Gò Vấp', 'Gamma Arena']);
    await expect(facilityCard(page, 'Sân Beta Gò Vấp')).toContainText('Tiếp theo từ trang trước');
    await expect(page.getByRole('button', { name: 'Sau' })).toBeDisabled();
  });

  test('empty results offer to clear filters', async ({ page }) => {
    await openCourts(page, '/courts?district=Kh%C3%B4ng+c%C3%B3');
    await expect(page.getByRole('heading', { name: 'Không tìm thấy sân phù hợp' })).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await expect(page).toHaveURL('/courts'); await expect(summary(page)).toContainText('30 sân');
  });

  test('errors are generic and retryable', async ({ page }) => {
    let fail = true;
    const log = await openCourts(page, '/courts', async route => {
      if (fail) return route.fulfill({ status: 400, json: errorBody('VALIDATION_FAILED') });
      await courtsApi({ requests: [] })(route);
    });
    await expect(page.getByRole('alert')).toContainText('Không tải được danh sách sân');
    await expect(page.getByText('Internal message must not be displayed')).toHaveCount(0);
    fail = false; await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(summary(page)).toContainText('30 sân'); expect(log.requests.length).toBeGreaterThan(1);
  });

  test('loading is announced', async ({ page }) => {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await openCourts(page, '/courts', async route => { await gate; await courtsApi({ requests: [] })(route); });
    await expect(page.getByRole('status').filter({ hasText: 'Đang tải danh sách sân' })).toBeAttached();
    await expect(page.locator('section[aria-busy="true"]')).toBeAttached();
    release(); await expect(summary(page)).toContainText('30 sân');
  });

  test('match booking context survives searching and court links', async ({ page }) => {
    await openCourts(page, '/courts?matchId=12');
    await expect(page.getByRole('complementary', { name: 'Ngữ cảnh đặt sân cho trận' })).toBeVisible();
    await field(page, 'Tỉnh / Thành phố').fill('Hồ Chí Minh'); await search(page).click();
    await expect(page).toHaveURL(/matchId=12/);
    await expect(facilityCard(page, 'CLB Alpha Quận 7').getByRole('link', { name: /^Sân 01/ })).toHaveAttribute('href', new RegExp(`/courts/101\\?date=${today}&matchId=12`));
  });

  test('invalid URL values fall back to safe defaults', async ({ page }) => {
    const log = await openCourts(page, '/courts?date=2000-01-01&from=20:00&to=18:00&page=-3');
    await expect(summary(page)).toContainText('30 sân');
    const first = log.requests[0];
    expect([first.get('date'), first.get('startTime'), first.get('page')]).toEqual([today, null, '1']);
  });

  test('filter fields show keyboard focus', async ({ page }) => {
    await openCourts(page); await expect(summary(page)).toContainText('30 sân');
    await field(page, 'Quận / Huyện').focus(); await page.keyboard.press('Shift+Tab');
    await expect(field(page, 'Tỉnh / Thành phố')).toBeFocused(); await page.waitForTimeout(300);
    expect(await field(page, 'Tỉnh / Thành phố').evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('date and time live in a sheet with removable chips', async ({ page }) => {
    const log = await openCourts(page); await expect(summary(page)).toContainText('30 sân');
    await expect(field(page, 'Từ giờ')).toHaveCount(0);
    const trigger = page.getByRole('button', { name: 'Ngày & giờ' });
    await trigger.click();
    const sheet = page.getByRole('dialog', { name: 'Ngày và giờ chơi' });
    await field(page, 'Từ giờ').fill('18:00'); await field(page, 'Đến giờ').fill('20:00');
    await sheet.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/from=18%3A00/); expect(log.requests.at(-1)!.get('startTime')).toBe('18:00');
    await expect(page.getByRole('list', { name: 'Ngày và giờ đang áp dụng' })).toContainText('18:00–20:00');
    await page.getByRole('button', { name: 'Bỏ khung giờ 18:00–20:00' }).click();
    await expect(page).not.toHaveURL(/from=/);
    await trigger.click(); await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0); await expect(trigger).toBeFocused();
  });
});

for (const width of [390, 768, 1280]) {
  test(`responsive ${width}px fits the viewport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openCourts(page, `/courts?date=${tomorrow}&from=18:00&to=20:00`);
    await expect(summary(page)).toContainText('28 sân');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/smashpro-d03/courts-${width}.png`, fullPage: true });
  });
}
