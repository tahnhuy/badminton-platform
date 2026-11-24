import { expect, test, type Page, type Route } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { account, errorBody, mockAuthApi } from './auth-ui-mocks';
import type { ConfigItem } from '../src/features/admin/configs/types/config';

/** UI contract tests for /admin/configs (mocked API, no backend). */

const config = (overrides: Partial<ConfigItem>): ConfigItem => ({
  configKey: '', configValue: '', valueType: 'integer', domain: 'booking', description: '',
  documentedDefault: '', usingDefault: false, updatedAt: null, updatedBy: null, editable: true,
  allowedValues: null, min: null, max: null, ...overrides,
});

const BASE: ConfigItem[] = [
  config({ configKey: 'BOOKING_ENABLED', configValue: 'true', valueType: 'boolean', description: 'Bật hoặc tắt đặt sân.' }),
  config({ configKey: 'BOOKING_MIN_DURATION_MINUTES', configValue: '60', min: 30, max: 240, description: 'Tối thiểu.' }),
  config({ configKey: 'BOOKING_MAX_DURATION_MINUTES', configValue: '180', min: 30, max: 480, description: 'Tối đa.' }),
  config({ configKey: 'TOURNAMENT_ENABLED', configValue: 'false', valueType: 'boolean', domain: 'tournament', description: 'Bật giải.' }),
  config({ configKey: 'LEGACY_READONLY', configValue: 'a', valueType: 'enum', domain: 'report', editable: false, allowedValues: ['a', 'b'], description: 'Cấu hình cũ.' }),
];

interface Log { list: URLSearchParams[]; updates: Array<{ key: string; body: unknown }> }

function updateHandler(key: string, state: Map<string, ConfigItem>, log: Log) {
  return (route: Route) => {
    const body = route.request().postDataJSON() as { value: string | number | boolean };
    const current = state.get(key)!;
    const updated = { ...current, configValue: String(body.value), updatedAt: '2026-11-20T12:00:00+07:00', updatedBy: 7 };
    state.set(key, updated);
    log.updates.push({ key, body });
    return route.fulfill({ json: { data: updated } });
  };
}

async function openConfigs(page: Page, path = '/admin/configs', override?: (route: Route) => Promise<void> | void) {
  const log: Log = { list: [], updates: [] };
  const state = new Map(BASE.map(item => [item.configKey, item]));
  const handlers = Object.fromEntries(['BOOKING_ENABLED', 'BOOKING_MIN_DURATION_MINUTES', 'BOOKING_MAX_DURATION_MINUTES']
    .map(key => [`/api/v1/admin/configs/${key}`, updateHandler(key, state, log)]));
  await mockAuthApi(page, { user: { ...account('ADMIN'), email: 'configs.admin@example.test' }, handlers: {
    '/api/v1/admin/configs': route => {
      log.list.push(new URL(route.request().url()).searchParams);
      if (override) return override(route);
      return route.fulfill({ json: { data: [...state.values()], meta: { page: 1, limit: 500, total: state.size, totalPages: 1 } } });
    },
    ...handlers,
    '/api/v1/admin/facilities/reviews/pending-count': route => route.fulfill({ json: { data: { total: 0 } } }),
    '/api/v1/admin/reports': route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 1, total: 0, totalPages: 0 } } }),
  } });
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Cấu hình hệ thống', level: 1 })).toBeVisible();
  return log;
}

const search = (page: Page) => page.getByLabel('Tìm theo chức năng hoặc mô tả...');
const article = (page: Page, text: string) => page.getByRole('article').filter({ hasText: text });

test.describe('admin configs desktop', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test('AUTH-33: shows no toggle for the read-only skill adjustment switch', async ({ page }) => {
    const skill = (configKey: string, valueType: ConfigItem['valueType'], configValue: string, editable = true) => config({
      configKey, valueType, configValue, editable, domain: 'player-skill-adjustment', min: valueType === 'integer' ? 0 : null, max: valueType === 'integer' ? 365 : null,
    });
    const items = [
      skill('PLAYER_SKILL_ADJUSTMENT_ENABLED', 'boolean', 'false', false),
      skill('PLAYER_SKILL_ADJUSTMENT_MIN_RATINGS', 'integer', '5', false),
      skill('PLAYER_SKILL_ADJUSTMENT_MIN_MATCHES', 'integer', '5'),
      skill('PLAYER_SKILL_ADJUSTMENT_THRESHOLD', 'integer', '1'),
      skill('PLAYER_SKILL_ADJUSTMENT_COOLDOWN_DAYS', 'integer', '14'),
    ];
    await openConfigs(page, '/admin/configs', route => route.fulfill({ json: { data: items, meta: { page: 1, limit: 500, total: items.length, totalPages: 1 } } }));
    const card = article(page, 'Tự động điều chỉnh trình độ');
    await expect(card).toBeVisible();
    await expect(card.getByLabel('Số trận tối thiểu để xét điều chỉnh')).toBeVisible();
    await expect(page.getByText('Bật tự động điều chỉnh', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Tắt tự động điều chỉnh', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('radio')).toHaveCount(0);
  });

  test('renders domain sections, grouped cards and standalone cards', async ({ page }) => {
    const log = await openConfigs(page);
    await expect(page.getByText('5 cấu hình', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Đặt sân', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Giải đấu', exact: true })).toBeVisible();
    await expect(article(page, 'Thời lượng đặt sân')).toBeVisible();
    await expect(article(page, 'Cho phép đặt sân')).toBeVisible();
    await expect(article(page, 'Bật giải đấu')).toBeVisible();
    await expect(article(page, 'legacy readonly')).toContainText('Chỉ đọc');
    const searchBox = (await search(page).boundingBox())!;
    const countBox = (await page.getByText('5 cấu hình', { exact: true }).boundingBox())!;
    expect(Math.abs((countBox.y + countBox.height / 2) - (searchBox.y + searchBox.height / 2))).toBeLessThanOrEqual(1);
    expect(log.list[0].get('limit')).toBe('500');
  });

  test('filters by domain, search and clears back to the full list', async ({ page }) => {
    await openConfigs(page);
    await chooseSelectOption(page.getByLabel('Lọc theo nhóm cấu hình'), 'tournament');
    await expect(page.getByText('1 cấu hình', { exact: true })).toBeVisible();
    await expect(article(page, 'Bật giải đấu')).toBeVisible();
    await expect(article(page, 'Cho phép đặt sân')).toHaveCount(0);
    await expect(page.getByText('Nhóm: Giải đấu')).toBeVisible();

    await chooseSelectOption(page.getByLabel('Lọc theo nhóm cấu hình'), '');
    await search(page).fill('thời lượng');
    await expect(article(page, 'Thời lượng đặt sân')).toBeVisible();
    await expect(article(page, 'Cho phép đặt sân')).toHaveCount(0);

    await page.getByRole('button', { name: 'Xóa tất cả' }).click();
    await expect(search(page)).toHaveValue('');
    await expect(page.getByText('5 cấu hình', { exact: true })).toBeVisible();
  });

  test('prefills the search from ?key=', async ({ page }) => {
    await openConfigs(page, '/admin/configs?key=BOOKING_ENABLED');
    await expect(search(page)).toHaveValue('BOOKING_ENABLED');
    await expect(article(page, 'Cho phép đặt sân')).toBeVisible();
    await expect(article(page, 'Thời lượng đặt sân')).toHaveCount(0);
  });

  test('saves a standalone boolean with the existing payload', async ({ page }) => {
    const log = await openConfigs(page);
    const card = article(page, 'Cho phép đặt sân');
    await card.getByLabel('Tạm tắt đặt sân').check();
    await card.getByRole('button', { name: 'Lưu' }).click();
    await expect.poll(() => log.updates.length).toBe(1);
    expect(log.updates[0]).toEqual({ key: 'BOOKING_ENABLED', body: { value: false } });
    await expect(page.getByText('Đã lưu "Cho phép đặt sân". Giá trị mới áp dụng trong tối đa 60 giây.')).toBeVisible();
    await expect(card).toContainText('Admin #7');
  });

  test('validates a pair and persists the upper bound first when the new lower exceeds it', async ({ page }) => {
    const log = await openConfigs(page);
    const group = article(page, 'Thời lượng đặt sân');
    const min = group.getByLabel('Thời lượng đặt sân tối thiểu');
    const max = group.getByLabel('Thời lượng đặt sân tối đa');

    await min.fill('200'); await max.fill('190');
    await expect(group.getByText('Thời lượng đặt sân tối thiểu không được lớn hơn thời lượng đặt sân tối đa.')).toBeVisible();
    await expect(group.getByRole('button', { name: 'Lưu' })).toBeDisabled();

    await max.fill('220');
    await group.getByRole('button', { name: 'Lưu' }).click();
    await expect.poll(() => log.updates.length).toBe(2);
    expect(log.updates.map(update => update.key)).toEqual(['BOOKING_MAX_DURATION_MINUTES', 'BOOKING_MIN_DURATION_MINUTES']);
    expect(log.updates.map(update => update.body)).toEqual([{ value: 220 }, { value: 200 }]);
    await expect(page.getByText('Đã lưu "Thời lượng đặt sân". Giá trị mới áp dụng trong tối đa 60 giây.')).toBeVisible();
  });

  test('warns on out-of-range integers and disables saving', async ({ page }) => {
    await openConfigs(page);
    const group = article(page, 'Thời lượng đặt sân');
    await group.getByLabel('Thời lượng đặt sân tối thiểu').fill('10');
    await expect(group.getByText('Thời lượng đặt sân tối thiểu phải từ 30 đến 240 phút.')).toBeVisible();
    await expect(group.getByRole('button', { name: 'Lưu' })).toBeDisabled();
  });

  test('announces loading before rendering cards', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await openConfigs(page, '/admin/configs', async route => {
      await gate;
      return route.fulfill({ json: { data: BASE, meta: { page: 1, limit: 500, total: BASE.length, totalPages: 1 } } });
    });
    await expect(page.getByRole('status').filter({ hasText: 'Đang tải cấu hình' })).toBeAttached();
    release();
    await expect(article(page, 'Cho phép đặt sân')).toBeVisible();
  });

  test('recovers from list errors with retry', async ({ page }) => {
    let fail = true;
    await openConfigs(page, '/admin/configs', route => fail
      ? route.fulfill({ status: 500, json: errorBody('INTERNAL_ERROR') })
      : route.fulfill({ json: { data: BASE, meta: { page: 1, limit: 500, total: BASE.length, totalPages: 1 } } }));
    await expect(page.getByRole('alert')).toContainText('Không tải được danh sách cấu hình');
    fail = false;
    await page.getByRole('button', { name: 'Thử lại' }).click();
    await expect(article(page, 'Cho phép đặt sân')).toBeVisible();
  });

  test('shows the empty state when there is no configuration', async ({ page }) => {
    await openConfigs(page, '/admin/configs', route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 500, total: 0, totalPages: 0 } } }));
    await expect(page.getByText('Không có cấu hình phù hợp')).toBeVisible();
  });

  test('has no horizontal overflow', async ({ page }) => {
    await openConfigs(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
});

test.describe('admin configs mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('stacks cards and stays within the viewport', async ({ page }) => {
    await openConfigs(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(article(page, 'Thời lượng đặt sân')).toBeVisible();
    await expect(page.getByText('5 cấu hình', { exact: true })).toBeVisible();
  });
});
