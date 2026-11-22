import { expect, test, type Page } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';
const player = { id: 2, email: 'two@example.test', role: 'PLAYER', status: 'ACTIVE', deletedAt: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', profile: { fullName: 'Người chơi Hai', skillLevelId: 2, avatarUrl: null } };
const admin = { ...player, id: 3, email: 'three@example.test', role: 'ADMIN', profile: null };
async function setup(page: Page, rows = [player, admin], fail = false) {
  const reads: URLSearchParams[] = [], writes: { path: string; method: string; body: any }[] = [];
  const handlers = Object.fromEntries(['', '/2/status', '/2/password', '/2', '/bulk/status', '/bulk/delete'].map(suffix => [`/api/v1/admin/users${suffix}`, (route: any) => {
    if (route.request().method() === 'GET') { reads.push(new URL(route.request().url()).searchParams); return fail ? route.fulfill({ status: 500, json: { error: { message: 'Không thể tải danh sách' } } }) : route.fulfill({ json: { data: rows, pagination: { page: 1, limit: 10, total: rows.length, totalPages: 2 }, stats: { total: 20, active: 15, suspended: 3, deactivated: 2 } } }); }
    writes.push({ path: suffix, method: route.request().method(), body: route.request().postData() ? route.request().postDataJSON() : null }); return route.fulfill({ status: suffix === '/2' ? 204 : 200, ...(suffix === '/2' ? {} : { json: { data: player, affectedCount: 1 } }) });
  }]));
  await mockAuthApi(page, { user: account('ADMIN'), handlers }); await page.goto('/admin/users'); await expect(page.getByRole('heading', { name: 'Quản lý người dùng hệ thống', level: 1 })).toBeVisible();
  if (!fail && rows.length) await expect(page.getByText('two@example.test', { exact: true })).toBeVisible(); return { reads, writes };
}
async function menu(page: Page, email = player.email) { await page.getByRole('button', { name: `Thao tác với ${email}`, exact: true }).click(); }
for (const width of [390, 1280]) test(`real fields, table scroll and explicit dialog dismissal at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await setup(page); await expect(page.getByText('+12.4%')).toHaveCount(0); await expect(page.getByText('98/100', { exact: false })).toHaveCount(0);
  const table = page.getByRole('region', { name: 'Bảng dữ liệu' }); await expect(table.getByRole('columnheader')).toHaveCount(6); await table.getByRole('button', { name: 'Xem chi tiết', exact: true }).first().click(); const dialog = page.getByRole('dialog'); await expect(dialog).toContainText('#UID-10002'); await expect(dialog.getByText('Cấp 2', { exact: true })).toBeVisible(); expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  await page.mouse.click(4, 4); await expect(dialog).toBeVisible(); await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
});
test('filters, sorting, page and page size keep the server contract', async ({ page }) => {
  const { reads } = await setup(page); await page.getByLabel('Lọc theo vai trò', { exact: true }).selectOption('PLAYER'); await page.getByLabel('Lọc theo trạng thái', { exact: true }).selectOption('SUSPENDED'); await page.getByLabel('Sắp xếp danh sách', { exact: true }).selectOption('name_desc'); await page.getByRole('button', { name: 'Trang 2', exact: true }).click(); await expect.poll(() => reads.at(-1)?.get('page')).toBe('2'); await page.getByLabel('Hiển thị', { exact: true }).selectOption('20'); await expect.poll(() => Object.fromEntries(reads.at(-1)!)).toEqual({ page: '1', limit: '20', role: 'PLAYER', status: 'SUSPENDED', sort: 'name_desc' });
  await page.getByPlaceholder('Tìm theo họ tên, email, SĐT, mã định danh...').fill('Hai'); await expect.poll(() => reads.at(-1)?.get('search')).toBe('Hai'); await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click(); await expect.poll(() => Object.fromEntries(reads.at(-1)!)).toEqual({ page: '1', limit: '20', sort: 'newest' });
});
test('bulk status keeps selected IDs and clears selection after success', async ({ page }) => {
  const { writes } = await setup(page); await page.getByRole('row').filter({ hasText: player.email }).getByRole('checkbox').check(); await page.getByRole('button', { name: 'Tác vụ hàng loạt (1)', exact: true }).click(); await page.getByRole('menuitem', { name: 'Tạm đình chỉ (SUSPENDED)', exact: true }).click(); await expect.poll(() => writes).toEqual([{ path: '/bulk/status', method: 'PATCH', body: { ids: [2], status: 'SUSPENDED' } }]); await expect(page.getByRole('row').filter({ hasText: player.email }).getByRole('checkbox')).not.toBeChecked();
});
test('bulk delete retains browser confirmation', async ({ page }) => {
  const { writes } = await setup(page); await page.getByRole('row').filter({ hasText: player.email }).getByRole('checkbox').check(); page.once('dialog', d => d.dismiss()); await page.getByRole('button', { name: 'Tác vụ hàng loạt (1)', exact: true }).click(); await page.getByRole('menuitem', { name: 'Xóa mềm hàng loạt', exact: true }).click(); expect(writes).toEqual([]); page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Tác vụ hàng loạt (1)', exact: true }).click(); await page.getByRole('menuitem', { name: 'Xóa mềm hàng loạt', exact: true }).click(); await expect.poll(() => writes).toEqual([{ path: '/bulk/delete', method: 'POST', body: { ids: [2] } }]);
});
test('create preserves Player defaults, validation, trim and reset on reopen', async ({ page }) => {
  const { writes } = await setup(page); await page.getByRole('button', { name: 'Thêm người dùng', exact: true }).click(); const dialog = page.getByRole('dialog'); await expect(dialog.getByLabel('Trình độ kỹ năng')).toHaveValue('2'); await dialog.getByLabel('Email đăng nhập').fill('NEW@Example.test'); await dialog.getByLabel('Mật khẩu khởi tạo').fill('123'); await dialog.getByLabel('Họ và tên VĐV').fill('  Tên Mới  '); await dialog.getByRole('button', { name: '+ Tạo người dùng', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('Mật khẩu tối thiểu 6 ký tự'); expect(writes).toEqual([]); await dialog.getByLabel('Mật khẩu khởi tạo').fill('ValidPassword123!'); await dialog.getByRole('button', { name: '+ Tạo người dùng', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(writes[0].body).toEqual({ email: 'new@example.test', password: 'ValidPassword123!', role: 'PLAYER', status: 'ACTIVE', fullName: 'Tên Mới', skillLevelId: 2, avatarUrl: '/images/avatar_player1-56586a.png' }); await page.getByRole('button', { name: 'Thêm người dùng', exact: true }).click(); await expect(page.getByRole('dialog').getByLabel('Email đăng nhập')).toHaveValue('');
});
test('status and delete preserve Admin restrictions', async ({ page }) => {
  const { writes } = await setup(page); await menu(page); await page.getByRole('menuitem', { name: 'Đổi trạng thái', exact: true }).click(); await page.getByRole('radio', { name: /SUSPENDED/ }).check(); await page.getByRole('button', { name: 'Lưu thay đổi', exact: true }).click(); await expect.poll(() => writes).toEqual([{ path: '/2/status', method: 'PATCH', body: { status: 'SUSPENDED' } }]); await menu(page, admin.email); await page.getByRole('menuitem', { name: 'Đổi trạng thái', exact: true }).click(); await expect(page.getByRole('radio', { name: /SUSPENDED/ })).toBeDisabled(); await expect(page.getByRole('radio', { name: /DEACTIVATED/ })).toBeDisabled(); await page.keyboard.press('Escape'); await menu(page, admin.email); await page.getByRole('menuitem', { name: 'Xóa tài khoản', exact: true }).click(); await expect(page.getByRole('dialog').getByRole('button', { name: 'Xóa tài khoản', exact: true })).toBeDisabled();
});
test('password validation and individual delete preserve payloads', async ({ page }) => {
  const { writes } = await setup(page); await menu(page); await page.getByRole('menuitem', { name: 'Đặt lại mật khẩu', exact: true }).click(); const dialog = page.getByRole('dialog'); await dialog.getByLabel('Mật khẩu mới', { exact: true }).fill('Password123!'); await dialog.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('different'); await dialog.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true }).click(); await expect(dialog.getByRole('alert')).toContainText('không khớp'); expect(writes).toEqual([]); await dialog.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill('Password123!'); await dialog.getByRole('button', { name: 'Cập nhật mật khẩu', exact: true }).click(); await expect(dialog).toHaveCount(0); expect(writes[0]).toEqual({ path: '/2/password', method: 'POST', body: { new_password: 'Password123!' } }); await menu(page); await page.getByRole('menuitem', { name: 'Xóa tài khoản', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Xóa tài khoản', exact: true }).click(); await expect.poll(() => writes.at(-1)).toEqual({ path: '/2', method: 'DELETE', body: null });
});
test('Excel export reads all pages at limit 500 and downloads xls', async ({ page }) => {
  const { reads } = await setup(page); const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Xuất Excel (.xls)', exact: true }).click(); expect((await download).suggestedFilename()).toMatch(/\.xls$/); await expect.poll(() => reads.filter(q => q.get('limit') === '500').map(q => q.get('page'))).toEqual(['1', '2']);
});
test('empty and failed reads remain usable', async ({ page }) => { await setup(page, []); await expect(page.getByRole('heading', { name: 'Không tìm thấy người dùng' })).toBeVisible(); await setup(page, [], true); await expect(page.getByText('Lỗi khi tải dữ liệu người dùng: Không thể tải danh sách', { exact: true })).toBeVisible(); });

test('shared filter and pager preserve the pending Court page query contract', async ({ page }) => {
  const queries: URLSearchParams[] = [];
  await mockAuthApi(page, { user: account('ADMIN'), handlers: { '/api/v1/admin/facilities': route => {
    queries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { data: { items: [], meta: { page: 1, total: 12, totalPages: 2, limit: 10 }, stats: {} } } });
  } } });
  await page.goto('/admin/courts');
  await page.getByLabel('Lọc theo tỉnh thành', { exact: true }).selectOption('Hà Nội');
  await page.getByLabel('Lọc theo tiêu chuẩn sân', { exact: true }).selectOption('Grade 1');
  await page.getByRole('button', { name: 'Trang 2', exact: true }).click();
  await expect.poll(() => queries.at(-1)?.get('page')).toBe('2');
  await page.getByLabel('Hiển thị', { exact: true }).selectOption('20');
  await expect.poll(() => Object.fromEntries(queries.at(-1)!)).toEqual({ page: '2', limit: '20', city: 'Hà Nội', bwfStandard: 'Grade 1', sort: 'courtCount_desc' });
  await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click();
  await expect.poll(() => Object.fromEntries(queries.at(-1)!)).toEqual({ page: '1', limit: '20', sort: 'courtCount_desc' });
});

test('shared Sonner presentation keeps the Court page four-second toast timer', async ({ page }) => {
  await page.clock.install();
  await mockAuthApi(page, { user: account('ADMIN'), handlers: { '/api/v1/admin/facilities': route => route.fulfill({ json: { data: { items: [], meta: { page: 1, total: 0, totalPages: 1, limit: 10 }, stats: {} } } }) } });
  await page.goto('/admin/courts'); await page.getByRole('button', { name: 'Xuất Excel', exact: true }).click();
  const message = page.getByText('Không có dữ liệu cơ sở nào để xuất', { exact: true });
  await expect(message).toBeVisible(); await page.clock.runFor(3999); await expect(message).toBeVisible(); await page.clock.runFor(501); await expect(message).toHaveCount(0);
});
