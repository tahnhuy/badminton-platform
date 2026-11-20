import { expect, test, type Page, type Route } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
import type { CourtAvailability } from '../src/features/booking/types/booking';

/** D04: UI contracts only. No backend, database seed, hold or payment. */
const DATE = '2026-11-20';
const PATH = `/courts/1?date=${DATE}`;
const FIRST = 'Khoảng sân trống 06:00 - 22:00';
const SHORT = 'Khoảng sân trống 22:00 - 22:30';
const payload = (date = DATE, durationMinutes = 60): CourtAvailability => ({
  date, durationMinutes, court: { id: 1, name: 'Sân số 1', description: null, status: 'ACTIVE' },
  facility: { id: 7, name: 'CLB Cầu Lông', address: '12 Đường Mẫu', ward: null, district: 'Quận 7', city: 'Hồ Chí Minh', phone: '0900000000' },
  openingTime: '06:00:00', closingTime: '23:00:00',
  intervals: [
    { startTime: '06:00:00', endTime: '22:00:00', durationMinutes: 960, estimatedPrice: 80000 * durationMinutes / 60,
      segments: [{ startTime: '06:00:00', endTime: '22:00:00', price: 80000 }] },
    { startTime: '22:00:00', endTime: '22:30:00', durationMinutes: 30, estimatedPrice: null,
      segments: [{ startTime: '22:00:00', endTime: '22:30:00', price: 120000 }] },
  ],
});

async function openCourt(page: Page, path = PATH, override?: (route: Route) => Promise<void> | void) {
  const requests: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account(), handlers: {
    '/api/v1/courts/1/availability': async route => {
      const query = new URL(route.request().url()).searchParams;
      requests.push(query);
      if (override) return override(route);
      return route.fulfill({ json: { data: payload(query.get('date')!, Number(query.get('durationMinutes'))) } });
    },
  } });
  await page.goto(path);
  return requests;
}
const slot = (page: Page) => page.getByRole('button', { name: FIRST, exact: true });
const summary = (page: Page) => page.getByRole('complementary', { name: 'Lựa chọn của bạn' });
const proceed = (page: Page) => page.getByRole('button', { name: 'Tiếp tục đặt sân', exact: true });

for (const width of [1280, 390]) test.describe(`court detail ${width}`, () => {
  test.use({ viewport: { width, height: width === 390 ? 844 : 900 } });

  test('keeps defaults, options, server intervals and prices; distinguishes free range from selected duration', async ({ page }) => {
    const requests = await openCourt(page);
    await expect(page.getByRole('heading', { name: 'Sân số 1', level: 1 })).toBeVisible();
    expect((await page.getByRole('link', { name: 'CLB Cầu Lông', exact: true }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByLabel('Ngày chơi', { exact: true })).toHaveValue(DATE);
    await expect(page.getByLabel('Ngày chơi', { exact: true })).not.toHaveAttribute('min');
    await expect(page.getByLabel('Thời lượng', { exact: true })).toHaveValue('60');
    expect(await page.getByLabel('Thời lượng', { exact: true }).locator('option').evaluateAll(xs => xs.map(x => (x as HTMLOptionElement).value)))
      .toEqual(['60', '90', '120', '150', '180']);
    expect([requests[0].get('date'), requests[0].get('durationMinutes')]).toEqual([DATE, '60']);
    await expect(page.getByRole('button', { name: /^Khoảng sân trống / })).toHaveCount(2);
    await expect(page.getByRole('button', { name: SHORT })).toBeDisabled();
    await expect(proceed(page)).toHaveCount(0);
    await slot(page).click();
    await expect(slot(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(slot(page).getByText('Đã chọn', { exact: true })).toBeVisible();
    await expect(summary(page)).toContainText('Bắt đầu06:00');
    await expect(summary(page)).toContainText('Khoảng sân trống 06:00 - 22:00');
    await expect(summary(page)).toContainText('Thời lượng1 giờ');
    await expect(summary(page)).toContainText('80.000đ');
    await expect(proceed(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('changing duration or date clears selection and sends the original API parameters', async ({ page }) => {
    const requests = await openCourt(page);
    await slot(page).click();
    await page.getByLabel('Thời lượng', { exact: true }).selectOption('90');
    await expect(proceed(page)).toHaveCount(0);
    await expect(slot(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(slot(page)).toContainText('120.000đ / 1.5 giờ');
    await slot(page).click();
    await expect(summary(page)).toContainText('Thời lượng1.5 giờ');
    await page.getByLabel('Ngày chơi', { exact: true }).fill('2026-11-21');
    await expect(proceed(page)).toHaveCount(0);
    await expect(slot(page)).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => requests.at(-1)?.get('date')).toBe('2026-11-21');
    expect(requests.at(-1)?.get('durationMinutes')).toBe('90');
  });

  test('preserves match context, date/facility/back links and booking destination', async ({ page }) => {
    await openCourt(page, `${PATH}&matchId=12`);
    await expect(page.getByRole('complementary', { name: 'Ngữ cảnh đặt sân cho trận' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Quay lại danh sách sân' })).toHaveAttribute('href', '/courts?matchId=12');
    await expect(page.getByRole('link', { name: 'CLB Cầu Lông', exact: true })).toHaveAttribute('href', `/facilities/7?date=${DATE}&matchId=12`);
    await expect(page.getByRole('link', { name: 'Chọn ngày khác', exact: true })).toHaveAttribute('href', '/courts/1/date?matchId=12');
    await slot(page).click();
    await proceed(page).click();
    const url = new URL(page.url());
    expect(url.pathname).toBe('/bookings/new');
    expect(Object.fromEntries(url.searchParams)).toEqual({ courtId: '1', date: DATE, startTime: '06:00:00', durationMinutes: '60', matchId: '12' });
  });

  test('keyboard selection and visible focus work with reduced motion and the mobile navigation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openCourt(page);
    const date = page.getByLabel('Ngày chơi', { exact: true });
    await date.focus();
    await expect.poll(() => date.evaluate(e => getComputedStyle(e).boxShadow)).toContain('4px');
    const duration = page.getByLabel('Thời lượng', { exact: true });
    await duration.focus();
    await expect.poll(() => duration.evaluate(e => getComputedStyle(e).boxShadow)).toContain('4px');
    await slot(page).focus(); await page.keyboard.press('Space');
    await expect(slot(page)).toHaveAttribute('aria-pressed', 'true');
    await proceed(page).scrollIntoViewIfNeeded();
    await expect(proceed(page)).toBeVisible();
    expect(await proceed(page).evaluate(e => {
      const box = e.getBoundingClientRect();
      return e.contains(document.elementFromPoint(box.right - 5, box.top + box.height / 2));
    })).toBe(true);
    const selected = summary(page).locator('[role="status"]');
    expect(await selected.evaluate(e => getComputedStyle(e.parentElement!).transform)).toBe('none');
    if (width === 390) {
      const box = await proceed(page).boundingBox();
      const nav = await page.locator('[data-app-bottom-nav]').boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(nav!.y);
    }
  });
});

test('loading, first error and retry retain a page heading and announce the state', async ({ page }) => {
  let release!: () => void;
  let mode: 'loading' | 'error' | 'success' = 'loading';
  const gate = new Promise<void>(resolve => { release = resolve; });
  await openCourt(page, PATH, async route => {
    if (mode === 'loading') await gate;
    if (mode !== 'success') return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Không thể tải lịch lúc này.' } } });
    return route.fulfill({ json: { data: payload() } });
  });
  await expect(page.getByRole('heading', { name: 'Chi tiết sân', level: 1 })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Đang tải lịch trống' })).toBeAttached();
  await expect(page.getByRole('region', { name: 'Khoảng sân trống' })).toHaveAttribute('aria-busy', 'true');
  mode = 'error'; release();
  await expect(page.getByRole('alert')).toContainText('Không tải được lịch trống');
  await expect(page.getByRole('heading', { name: 'Chi tiết sân', level: 1 })).toBeVisible();
  await expect(proceed(page)).toHaveCount(0);
  mode = 'success'; await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(slot(page)).toBeVisible();
});

test('empty data and invalid identifiers preserve existing action availability', async ({ page }) => {
  await openCourt(page, PATH, route => route.fulfill({ json: { data: { ...payload(), intervals: [] } } }));
  await expect(page.getByRole('heading', { name: 'Hết khung giờ trống' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Khoảng sân trống / })).toHaveCount(0);
  await expect(proceed(page)).toHaveCount(0);
  await page.goto('/courts/invalid');
  await expect(page.getByRole('heading', { name: 'Sân không hợp lệ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Chi tiết sân', level: 1 })).toBeVisible();
});

test('without a URL date uses the existing Vietnam-today default', async ({ page }) => {
  const requests = await openCourt(page, '/courts/1');
  const today = await page.evaluate(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  await expect(page.getByLabel('Ngày chơi', { exact: true })).toHaveValue(today);
  await expect(slot(page)).toBeVisible();
  expect(requests[0].get('date')).toBe(today);
});

test('keeps the server null price and multiple price-segment labels without changing selection rules', async ({ page }) => {
  await openCourt(page, PATH, route => {
    const data = payload(); data.intervals[0].estimatedPrice = null;
    data.intervals[0].segments.push({ startTime: '18:00:00', endTime: '22:00:00', price: 120000 });
    return route.fulfill({ json: { data } });
  });
  await expect(slot(page)).toContainText('2 mức giá');
  await expect(slot(page)).toContainText('Chọn khung giờ');
  await slot(page).click();
  await expect(summary(page)).toContainText('—');
  await expect(proceed(page)).toBeEnabled();
});

test('polling stays at 8 seconds, retains selected last-good data on failure and updates server price on recovery', async ({ page }) => {
  const now = new Date('2026-11-19T10:00:00+07:00');
  await page.clock.install({ time: now }); await page.clock.pauseAt(now);
  let calls = 0;
  let phase: 'success' | 'error' | 'recovered' = 'success';
  await openCourt(page, PATH, route => {
    calls++;
    if (phase === 'error') return route.fulfill({ status: 503, json: { error: { code: 'UNAVAILABLE', message: 'Tạm gián đoạn.' } } });
    const data = payload(); if (phase === 'recovered') data.intervals[0].estimatedPrice = 99000;
    return route.fulfill({ json: { data } });
  });
  await slot(page).focus(); await page.keyboard.press('Space');
  await expect(summary(page)).toContainText('80.000đ');
  const initialCalls = calls; phase = 'error';
  await page.clock.runFor(7999); expect(calls).toBe(initialCalls);
  await page.clock.runFor(1); await expect.poll(() => calls).toBe(initialCalls + 1);
  await expect(summary(page)).toContainText('80.000đ');
  await expect(slot(page)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('alert')).toHaveCount(0);
  phase = 'recovered';
  await page.clock.runFor(8000); await expect.poll(() => calls).toBe(initialCalls + 2);
  await expect(summary(page)).toContainText('99.000đ');
  await expect(proceed(page)).toBeEnabled();
});
