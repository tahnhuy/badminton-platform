import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

const blocked = {
  playerId: 9,
  fullName: 'Người Chơi Bị Chặn Có Tên Dài',
  avatarUrl: null,
  blockedAt: '2026-11-01T06:00:00Z',
};
const players = [
  { id: 3, fullName: 'Người chơi Mới', avatarUrl: null, skillLevel: { name: 'Khá' }, isActive: true },
  { id: 4, fullName: 'Người chơi Khác', avatarUrl: null, skillLevel: null, isActive: true },
];

async function setup(page: Page, options: { empty?: boolean; fail?: boolean; hold?: boolean } = {}) {
  let blocks = options.empty ? [] : [blocked];
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const reads: string[] = [];
  const writes: Array<{ method: 'POST'; body: unknown } | { method: 'DELETE'; id: number }> = [];
  const searches: URLSearchParams[] = [];

  await mockAuthApi(page, {
    user: account(),
    handlers: {
      '/api/v1/blocks': async (r) => {
        if (r.request().method() === 'GET') {
          reads.push(r.request().url());
          return options.fail
            ? r.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Không thể tải' } } })
            : r.fulfill({ json: { data: blocks } });
        }
        writes.push({ method: 'POST', body: r.request().postDataJSON() });
        if (options.hold) await gate;
        blocks = [...blocks, { ...blocked, playerId: 3, fullName: players[0].fullName }];
        return r.fulfill({ status: 204 });
      },
      '/api/v1/blocks/9': (r) => {
        writes.push({ method: 'DELETE', id: 9 });
        return r.fulfill({ status: 204 });
      },
      '/api/v1/players/search': (r) => {
        searches.push(new URL(r.request().url()).searchParams);
        return r.fulfill({ json: { data: players } });
      },
    },
  });
  await page.goto('/settings/blocks');
  await expect(page.getByRole('heading', { name: 'Danh sách người chơi đã chặn', level: 1 })).toBeVisible();
  if (!options.empty && !options.fail) {
    await expect(page.getByText(blocked.fullName, { exact: true })).toBeVisible();
  }
  const initialReads = reads.length;
  return { reads, writes, searches, initialReads, release: () => release!() };
}

for (const width of [390, 1280]) {
  test(`block list and search results fit ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await setup(page);
    await expect(page.getByText(blocked.fullName, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
    await expect(page.getByText(players[0].fullName, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
    await expect(page.getByRole('link', { name: 'Quay lại Tin nhắn', exact: true }))
      .toHaveAttribute('href', '/messages');
  });
}

test('search submits trimmed text and still permits an empty query at limit 20', async ({ page }) => {
  const { searches } = await setup(page);
  const input = page.getByPlaceholder('Nhập tên người chơi cần tìm...');
  await input.fill('  Minh  ');
  expect(searches).toEqual([]);
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect.poll(() => Object.fromEntries(searches.at(-1)!)).toEqual({ q: 'Minh', limit: '20' });
  await input.fill('');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect.poll(() => Object.fromEntries(searches.at(-1)!)).toEqual({ q: '', limit: '20' });
});

test('block uses its player ID, disables that action while busy, then removes result and reloads blocks', async ({ page }) => {
  const { writes, reads, initialReads, release } = await setup(page, { hold: true });
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  const row = page.getByRole('listitem').filter({ hasText: players[0].fullName });
  await row.getByRole('button', { name: 'Chặn', exact: true }).click();
  await expect(row.getByRole('button', { name: 'Chặn', exact: true })).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: players[1].fullName })
    .getByRole('button', { name: 'Chặn', exact: true })).toBeEnabled();
  expect(writes).toEqual([{ method: 'POST', body: { playerId: 3 } }]);
  release();
  await expect(page.getByRole('heading', { name: 'Đang chặn (2)', exact: true })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: players[0].fullName })
    .getByRole('button', { name: 'Chặn', exact: true })).toHaveCount(0);
  expect(reads.length).toBe(initialReads + 1);
});

test('unblock removes the local row without refetching or adding confirmation', async ({ page }) => {
  const { reads, writes, initialReads } = await setup(page);
  await page.getByRole('button', { name: 'Bỏ chặn', exact: true }).click();
  await expect(page.getByText('Bạn chưa chặn người chơi nào.', { exact: true })).toBeVisible();
  expect(writes).toEqual([{ method: 'DELETE', id: 9 }]);
  expect(reads.length).toBe(initialReads);
});

test('empty and failed lists preserve search and error dismissal', async ({ page }) => {
  await setup(page, { empty: true });
  await expect(page.getByText('Bạn chưa chặn người chơi nào.', { exact: true })).toBeVisible();
  await setup(page, { fail: true });
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Tìm kiếm', exact: true })).toBeEnabled();
});
