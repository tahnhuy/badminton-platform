import { expect, test, type Page } from '@playwright/test';
import { mockOwnerUi, ownedFacility, type OwnerHandler } from './owner-ui-mocks';
import type { Facility } from '../src/features/court-owner/types/owner';
const reviews = '/api/v1/owner/facilities/11/reviews';
async function setup(page: Page, facility = ownedFacility(11), handlers: Record<string, OwnerHandler> = {}) {
  await mockOwnerUi(page, { [reviews]: route => route.fulfill({ json: { data: [], meta: { page: 1, limit: 10, total: 0, totalPages: 0 } } }), ...handlers }, [facility]);
  await page.goto('/owner/facilities?facilityId=11');
  await expect(page.getByRole('heading', { name: 'Thông tin cơ sở', exact: true })).toBeVisible();
}
const section = (page: Page, title: string) => page.locator('section').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).first();
for (const width of [390, 1280]) test(`facility metadata, address and courts fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await setup(page, { ...ownedFacility(11), courts: [{ id: 21, name: 'Sân 01', status: 'ACTIVE', description: null }] });
  await expect(page.getByRole('heading', { name: 'Quản lý cơ sở', exact: true })).toBeVisible();
  await expect(page.getByLabel('Tên cơ sở', { exact: true })).toHaveValue('Cơ sở 11');
  await expect(page.getByRole('cell', { name: 'Sân 01', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('facility metadata preserves trimming, time strings and original PUT payload', async ({ page }) => {
  let body: unknown; await setup(page, ownedFacility(11), { '/api/v1/owner/facilities/11': route => {
    if (route.request().method() === 'PUT') { body = route.request().postDataJSON(); return route.fulfill({ json: { data: ownedFacility(11) } }); }
    return route.fulfill({ json: { data: ownedFacility(11) } });
  } });
  await page.getByLabel('Tên cơ sở', { exact: true }).fill('  Tên mới  '); await page.getByLabel('Mô tả', { exact: true }).fill(' Mô tả mới ');
  await page.getByRole('button', { name: 'Lưu thông tin cơ sở', exact: true }).click();
  await expect(section(page, 'Thông tin cơ sở').getByRole('status')).toContainText('Đã lưu thay đổi.');
  expect(body).toEqual({ name: 'Tên mới', description: 'Mô tả mới', phone: '0900000000', openingTime: '06:00', closingTime: '23:00' });
});

test('hours conflict keeps entered data and busy state blocks duplicate submission', async ({ page }) => {
  let calls = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await setup(page, ownedFacility(11), { '/api/v1/owner/facilities/11': async route => {
    if (route.request().method() !== 'PUT') return route.fulfill({ json: { data: ownedFacility(11) } });
    calls++; await gate; return route.fulfill({ status: 409, json: { error: { code: 'OPENING_HOURS_CONFLICT', message: 'conflict' } } });
  } });
  const edit = section(page, 'Thông tin cơ sở'); await edit.getByLabel('Giờ mở cửa').fill('09:00'); await edit.getByRole('button', { name: 'Lưu thông tin cơ sở' }).click();
  await expect(edit.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled(); await expect(edit.getByLabel('Tên cơ sở', { exact: true })).toBeDisabled();
  release(); await expect(edit.getByRole('alert')).toContainText('Giờ mới không hợp lệ hoặc ảnh hưởng booking còn hiệu lực.');
  await expect(edit.getByLabel('Giờ mở cửa')).toHaveValue('09:00'); expect(calls).toBe(1);
});

test('pending facility and pending court retain disabled edit forms', async ({ page }) => {
  await setup(page, { ...ownedFacility(11), status: 'PENDING_APPROVAL', courts: [{ id: 21, name: 'Sân chờ duyệt', description: null, status: 'PENDING_APPROVAL' }] });
  await expect(section(page, 'Thông tin cơ sở').getByLabel('Tên cơ sở', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Gửi đề xuất địa chỉ', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Chi tiết / Sửa sân', exact: true }).click(); await expect(page.getByLabel('Tên sân', { exact: true })).toBeDisabled();
});

test('address proposal keeps the effective address and nullable ward payload', async ({ page }) => {
  let body: unknown; await setup(page, ownedFacility(11), { '/api/v1/owner/facilities/11/address-change-requests': route => { body = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { data: {} } }); } });
  const address = section(page, 'Địa chỉ đã lưu');
  await address.getByLabel('Địa chỉ', { exact: true }).fill('  22 Đường Mới  ');
  await address.getByRole('button', { name: 'Gửi đề xuất địa chỉ', exact: true }).click();
  await expect(address.getByText('11 Đường Mẫu, Quận 7, Hồ Chí Minh', { exact: true })).toBeVisible();
  await expect.poll(() => body).toEqual({ address: '22 Đường Mới', ward: null, district: 'Quận 7', city: 'Hồ Chí Minh' });
});

test('pending address proposal locks its form while showing the submitted address', async ({ page }) => {
  await setup(page, { ...ownedFacility(11), pendingAddressReview: { id: 1, kind: 'ADDRESS_CHANGE', status: 'PENDING', submittedAt: '2026-11-01T00:00:00Z', reviewedAt: null, rejectionReason: null, submittedValues: { address: 'Địa chỉ mới đang chờ' } } });
  await expect(page.getByText('Địa chỉ chờ duyệt: Địa chỉ mới đang chờ')).toBeVisible(); await expect(page.getByRole('button', { name: 'Gửi đề xuất địa chỉ', exact: true })).toBeDisabled();
});

test('rejected facility and court expose the same resubmission commands', async ({ page }) => {
  const posts: string[] = []; const facility = { ...ownedFacility(11), status: 'REJECTED', courts: [{ id: 21, name: 'Sân bị từ chối', description: null, status: 'REJECTED' }] };
  const action: OwnerHandler = route => { posts.push(new URL(route.request().url()).pathname); expect(route.request().postDataJSON()).toEqual({}); return route.fulfill({ json: { data: {} } }); };
  await setup(page, facility, { '/api/v1/owner/facilities/11/resubmit': action, '/api/v1/owner/courts/21/resubmit': action });
  await expect(section(page, 'Thông tin cơ sở').getByLabel('Địa chỉ', { exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Gửi lại hồ sơ cơ sở', exact: true }).click(); await expect.poll(() => posts.length).toBe(1);
  await page.getByRole('button', { name: 'Gửi lại sân', exact: true }).click(); await expect.poll(() => posts.length).toBe(2);
});

test('court creation/editing retains endpoints, payloads and reset to new court', async ({ page }) => {
  const facility = { ...ownedFacility(11), courts: [{ id: 21, name: 'Sân 01', description: 'Cũ', status: 'ACTIVE' }] }; const sent: { method: string; path: string; body: unknown }[] = [];
  const write: OwnerHandler = route => { sent.push({ method: route.request().method(), path: new URL(route.request().url()).pathname, body: route.request().postDataJSON() }); return route.fulfill({ status: 200, json: { data: {} } }); };
  await setup(page, facility, { '/api/v1/owner/courts/21': write, '/api/v1/owner/facilities/11/courts': write });
  await page.getByRole('button', { name: 'Chi tiết / Sửa sân', exact: true }).click(); await page.getByLabel('Tên sân', { exact: true }).fill(' Sân sửa '); await page.getByRole('button', { name: 'Lưu thông tin sân', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thêm sân mới' })).toBeVisible(); await page.getByLabel('Tên sân', { exact: true }).fill(' Sân mới '); await page.getByRole('button', { name: 'Gửi sân để duyệt', exact: true }).click();
  await expect.poll(() => sent.length).toBe(2); expect(sent).toEqual([{ method: 'PUT', path: '/api/v1/owner/courts/21', body: { name: 'Sân sửa', description: 'Cũ' } }, { method: 'POST', path: '/api/v1/owner/facilities/11/courts', body: { name: 'Sân mới', description: '' } }]);
});

test('empty workspace creates a facility with the original defaults and selects it', async ({ page }) => {
  let created: Facility | null = null; let body: unknown;
  await mockOwnerUi(page, { '/api/v1/owner/facilities': route => {
    if (route.request().method() === 'POST') { body = route.request().postDataJSON(); created = { ...ownedFacility(33), status: 'PENDING_APPROVAL' }; return route.fulfill({ status: 201, json: { data: created } }); }
    return route.fulfill({ json: { data: created ? [created] : [], meta: { page: 1, totalPages: 1, total: created ? 1 : 0, limit: 100 } } });
  }, '/api/v1/owner/facilities/33': route => route.fulfill({ json: { data: created } }) }, []);
  await page.goto('/owner/facilities'); const submit = page.getByRole('button', { name: 'Gửi cơ sở để duyệt', exact: true }); await submit.click(); expect(body).toBeUndefined();
  for (const [label, value] of [['Tên cơ sở', ' Cơ sở mới '], ['Điện thoại cơ sở', '0900000000'], ['Giờ mở cửa', '06:00'], ['Giờ đóng cửa', '23:00'], ['Địa chỉ', '1 Đường Mẫu'], ['Quận/huyện', 'Quận 7'], ['Tỉnh/thành phố', 'Hồ Chí Minh']]) await page.getByLabel(label, { exact: true }).fill(value);
  await submit.click(); await expect(page.getByLabel('Chọn cơ sở', { exact: true })).toHaveAttribute('data-value', '33'); await expect(page).toHaveURL('/owner/facilities?facilityId=33');
  expect(body).toEqual({ name: 'Cơ sở mới', description: '', phone: '0900000000', openingTime: '06:00', closingTime: '23:00', address: '1 Đường Mẫu', ward: null, district: 'Quận 7', city: 'Hồ Chí Minh' });
});

test('review history keeps server pagination and displays rejection details', async ({ page }) => {
  const pages: number[] = []; await setup(page, ownedFacility(11), { [reviews]: route => { const params = new URL(route.request().url()).searchParams; const current = Number(params.get('page')); pages.push(current); expect(params.get('limit')).toBe('10'); return route.fulfill({ json: { data: [{ id: current, kind: 'ADDRESS_CHANGE', status: 'REJECTED', submittedAt: '2026-11-01T00:00:00Z', reviewedAt: null, rejectionReason: `Lý do ${current}`, submittedValues: { address: 'Địa chỉ gửi' } }], meta: { page: current, limit: 10, total: 11, totalPages: 2 } } }); } });
  const history = section(page, 'Lịch sử duyệt cơ sở'); await expect(history.getByText('Lý do từ chối: Lý do 1')).toBeVisible(); await history.getByRole('button', { name: 'Sau', exact: true }).click(); await expect(history.getByText('Lý do từ chối: Lý do 2')).toBeVisible(); expect(pages).toContain(2);
});

test('facility polling keeps an unsaved uncontrolled draft when the server version is unchanged', async ({ page }) => {
  await page.clock.install(); let reads = 0;
  await setup(page, ownedFacility(11), { '/api/v1/owner/facilities/11': route => { reads++; return route.fulfill({ json: { data: ownedFacility(11) } }); } });
  const field = page.getByLabel('Tên cơ sở', { exact: true }); await field.fill('Nháp chưa gửi'); const before = reads;
  await page.clock.runFor(7500); await expect.poll(() => reads).toBeGreaterThan(before);
  await expect(field).toHaveValue('Nháp chưa gửi');
});

test('court list keeps both scroll directions inside its panel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await setup(page, { ...ownedFacility(11), courts: Array.from({ length: 24 }, (_, i) => ({ id: i + 1, name: `Sân ${i + 1}`, status: 'ACTIVE', description: 'Sân trong nhà' })) });
  const region = section(page, 'Danh sách sân').getByRole('region', { name: 'Bảng dữ liệu' });
  expect(await region.evaluate(node => node.scrollWidth > node.clientWidth && node.scrollHeight > node.clientHeight)).toBeTruthy();
  await region.evaluate(node => { node.scrollLeft = 200; node.scrollTop = 300; });
  expect(await region.evaluate(node => node.scrollLeft > 0 && node.scrollTop > 0)).toBeTruthy();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
