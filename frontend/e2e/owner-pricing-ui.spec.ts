import { expect, test, type Page } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';
import { mockOwnerUi, ownedFacility, type OwnerHandler } from './owner-ui-mocks';
const facility = { ...ownedFacility(11), courts: [{ id: 21, name: 'Sân 01', status: 'ACTIVE', description: null }, { id: 22, name: 'Sân chờ duyệt', status: 'PENDING_APPROVAL', description: null }] };
const pricing = { id: 7, startTime: '06:00:00', endTime: '22:00:00', pricePerHour: 100000, validFrom: '2030-01-01', validTo: null };
async function setup(page: Page, handlers: Record<string, OwnerHandler> = {}) {
  await mockOwnerUi(page, { '/api/v1/owner/courts/21/pricings': route => route.fulfill({ json: { data: [pricing] } }), '/api/v1/owner/courts/22/pricings': route => route.fulfill({ json: { data: [] } }), ...handlers }, [facility]);
  await page.goto('/owner/pricing?facilityId=11'); await expect(page.getByLabel('Chọn sân để cấu hình giá', { exact: true })).toHaveAttribute('data-value', '21');
}
for (const width of [390, 1280]) test(`pricing table, selector and form fit at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await setup(page);
  await expect(page.getByRole('cell', { name: '100.000', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tạo khung giá', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test('editing keeps time slicing, numeric/null conversion, pricingId and POST endpoint', async ({ page }) => {
  let body: unknown; await setup(page, { '/api/v1/owner/courts/21/pricings': route => {
    if (route.request().method() === 'POST') { body = route.request().postDataJSON(); return route.fulfill({ json: { data: {} } }); }
    return route.fulfill({ json: { data: [pricing] } });
  } });
  await page.getByRole('button', { name: 'Sửa khung giá', exact: true }).click(); await expect(page.getByLabel('Giờ bắt đầu', { exact: true })).toHaveValue('06:00');
  await page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true }).fill('120000'); await page.getByRole('button', { name: 'Lưu khung giá', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tạo khung giá', exact: true })).toBeVisible();
  expect(body).toEqual({ startTime: '06:00', endTime: '22:00', pricePerHour: 120000, validFrom: '2030-01-01', validTo: null, pricingId: 7 });
  await expect(page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true })).toHaveValue('');
});

test('creating a price keeps required validation and does not invent a form reset', async ({ page }) => {
  let body: unknown; await setup(page, { '/api/v1/owner/courts/21/pricings': route => {
    if (route.request().method() === 'POST') { body = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { data: {} } }); }
    return route.fulfill({ json: { data: [] } });
  } });
  const save = page.getByRole('button', { name: 'Lưu khung giá', exact: true }); await save.click(); expect(body).toBeUndefined();
  for (const [label, value] of [['Giờ bắt đầu', '07:00'], ['Giờ kết thúc', '09:00'], ['Giá mỗi giờ (VNĐ)', '80000'], ['Ngày bắt đầu hiệu lực', '2030-02-01'], ['Ngày kết thúc hiệu lực (tùy chọn)', '2030-02-28']]) await page.getByLabel(label, { exact: true }).fill(value);
  await save.click(); await expect(page.getByRole('status').filter({ hasText: 'Đã lưu thay đổi.' })).toBeVisible();
  expect(body).toEqual({ startTime: '07:00', endTime: '09:00', pricePerHour: 80000, validFrom: '2030-02-01', validTo: '2030-02-28' });
  await expect(page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true })).toHaveValue('80000');
});

test('overlap error retains edited values and busy prevents a duplicate request', async ({ page }) => {
  let calls = 0; let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await setup(page, { '/api/v1/owner/courts/21/pricings': async route => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: { data: [pricing] } });
    calls++; await gate; return route.fulfill({ status: 409, json: { error: { code: 'PRICING_INTERVAL_OVERLAP', message: 'conflict' } } });
  } });
  await page.getByRole('button', { name: 'Sửa khung giá', exact: true }).click(); await page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true }).fill('90000'); await page.getByRole('button', { name: 'Lưu khung giá', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang lưu…' })).toBeDisabled(); await expect(page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true })).toBeDisabled(); release();
  await expect(page.getByRole('alert')).toContainText('Khung giá chồng lấn'); await expect(page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true })).toHaveValue('90000'); expect(calls).toBe(1);
});

test('all server courts remain selectable and switching remounts the edit draft', async ({ page }) => {
  await setup(page); await page.getByLabel('Chọn sân để cấu hình giá', { exact: true }).click(); await expect(page.getByRole('option')).toHaveCount(2); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Sửa khung giá', exact: true }).click(); await page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true }).fill('222222');
  await chooseSelectOption(page.getByLabel('Chọn sân để cấu hình giá', { exact: true }), '22'); await expect(page.getByRole('heading', { name: 'Tạo khung giá', exact: true })).toBeVisible();
  await expect(page.getByLabel('Giá mỗi giờ (VNĐ)', { exact: true })).toHaveValue(''); await expect(page.getByText('Chưa có giá.', { exact: false })).toBeVisible();
});

test('zero prices remain visible and cancel edit returns to the creation form', async ({ page }) => {
  await setup(page, { '/api/v1/owner/courts/21/pricings': route => route.fulfill({ json: { data: [{ ...pricing, pricePerHour: 0 }] } }) });
  await expect(page.getByRole('cell', { name: '0', exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Sửa khung giá', exact: true }).click(); await page.getByRole('button', { name: 'Tạo khung khác', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tạo khung giá', exact: true })).toBeVisible();
});

test('pricing read failure retains retry and an empty facility has no court picker', async ({ page }) => {
  let failed = true; await setup(page, { '/api/v1/owner/courts/21/pricings': route => failed ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'unavailable' } } }) : route.fulfill({ json: { data: [] } }) });
  await expect(page.getByRole('alert')).toContainText('Không thể tải dữ liệu.'); failed = false; await page.getByRole('button', { name: 'Thử lại', exact: true }).click(); await expect(page.getByText('Chưa có giá.', { exact: false })).toBeVisible();
  await mockOwnerUi(page, {}, [{ ...facility, courts: [] }]); await page.reload(); await expect(page.getByText('Chưa có sân để cấu hình giá.', { exact: false })).toBeVisible(); await expect(page.getByLabel('Chọn sân để cấu hình giá', { exact: true })).toHaveCount(0);
});
