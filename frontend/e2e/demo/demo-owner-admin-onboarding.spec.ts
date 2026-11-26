import { test, expect, type Page } from '@playwright/test';
import { createE2EUser, loginViaUi, resetDatabase, vnDate } from '../e2e-helpers';

async function createFacility(page: Page) {
  await page.goto('/owner');
  await page.getByLabel('Tên cơ sở').fill('Owner E2E Club');
  await page.getByLabel('Điện thoại cơ sở').fill('0900000000');
  await page.getByLabel('Giờ mở cửa').fill('06:00');
  await page.getByLabel('Giờ đóng cửa').fill('22:00');
  await page.getByLabel('Địa chỉ').fill('1 Duong E2E');
  await page.getByLabel('Quận/huyện').fill('Quận 7');
  await page.getByLabel('Tỉnh/thành phố').fill('Hồ Chí Minh');
  const response = page.waitForResponse(
    (res) => res.url().endsWith('/api/v1/owner/facilities') && res.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Gửi cơ sở để duyệt', exact: true }).click();
  const body = await (await response).json();
  return body.data.id as number;
}

/**
 * Demo flow 2: Court Owner onboarding → Admin review (reject/resubmit/approve) → courts and
 * pricing → the Player sees the facility in the public court search.
 */
test.describe('Demo: owner onboarding + admin approval', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('owner facility/court/pricing becomes visible to players after admin approval', async ({ browser, page }) => {
    test.setTimeout(180_000);
    const owner = await createE2EUser({ email: 'demo_owner@example.com', role: 'COURT_OWNER' });
    const admin = await createE2EUser({ email: 'demo_admin_onboarding@example.com', role: 'ADMIN' });
    const player = await createE2EUser({ email: 'demo_player_search@example.com', role: 'PLAYER' });

    await loginViaUi(page, owner.email, owner.plainPassword);
    const facilityId = await createFacility(page);

    await page.goto(`/owner/facilities?facilityId=${facilityId}`);
    await expect(page.getByText('Chờ duyệt', { exact: true }).first()).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginViaUi(adminPage, admin.email, admin.plainPassword);
    await adminPage.goto(`/admin/courts/${facilityId}/reviews`);
    await expect(adminPage.getByRole('heading', { name: 'Duyệt hồ sơ cơ sở', exact: true })).toBeVisible();

    // Reject with a mandatory reason.
    await adminPage.getByLabel('Lý do từ chối (bắt buộc khi từ chối)').fill('Bổ sung mô tả cơ sở');
    await adminPage.getByRole('button', { name: 'Từ chối hồ sơ', exact: true }).first().click();
    await expect(adminPage.getByText('Lý do từ chối: Bổ sung mô tả cơ sở')).toBeVisible();

    // Owner sees the rejection, edits and resubmits.
    await page.getByRole('button', { name: 'Làm mới cơ sở' }).click();
    await expect(page.getByText('Bị từ chối', { exact: true }).first()).toBeVisible();
    await page.getByLabel('Mô tả', { exact: true }).fill('Mô tả đã bổ sung');
    await page.getByRole('button', { name: 'Lưu thông tin cơ sở' }).click();
    await expect(page.getByText('Đã lưu thay đổi.').first()).toBeVisible();
    await page.getByRole('button', { name: 'Gửi lại hồ sơ cơ sở' }).click();

    // Admin approves the resubmission.
    await adminPage.reload();
    await adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }).first().click();
    await expect(adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Làm mới cơ sở' }).click();
    await expect(page.getByText('Đang hoạt động', { exact: true }).first()).toBeVisible();

    // Owner creates a court; admin approves it.
    await page.getByLabel('Tên sân').fill('Sân E2E 01');
    const courtResponse = page.waitForResponse(
      (res) => res.url().endsWith(`/facilities/${facilityId}/courts`) && res.request().method() === 'POST'
    );
    await page.getByRole('button', { name: 'Gửi sân để duyệt', exact: true }).click();
    const courtId = (await (await courtResponse).json()).data.id as number;

    await adminPage.reload();
    await adminPage.getByRole('button', { name: 'Xem hồ sơ sân Sân E2E 01', exact: true }).click();
    await adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true }).first().click();
    await expect(adminPage.getByRole('button', { name: 'Duyệt hồ sơ', exact: true })).toHaveCount(0);

    // Pricing for the approved court.
    await page.goto(`/owner/pricing?facilityId=${facilityId}`);
    await page.getByLabel('Giờ bắt đầu').fill('06:00');
    await page.getByLabel('Giờ kết thúc').fill('22:00');
    await page.getByLabel('Giá mỗi giờ (VNĐ)').fill('100000');
    await page.getByLabel('Ngày bắt đầu hiệu lực').fill(vnDate(0));
    await page.getByRole('button', { name: 'Lưu khung giá' }).click();
    await expect(page.getByRole('button', { name: 'Sửa khung giá' })).toBeVisible();

    // Player discovers the now-active facility and court.
    const playerContext = await browser.newContext();
    const playerPage = await playerContext.newPage();
    await loginViaUi(playerPage, player.email, player.plainPassword);
    await playerPage.goto('/courts');
    await playerPage.getByRole('button', { name: 'Ngày & giờ' }).click();
    await playerPage.getByLabel('Ngày chơi').fill(vnDate(1));
    await playerPage.getByLabel('Từ giờ').fill('10:00');
    await playerPage.getByLabel('Đến giờ').fill('11:00');
    await playerPage.getByRole('button', { name: 'Áp dụng', exact: true }).click();

    const facilityCard = playerPage.getByRole('article', { name: 'Owner E2E Club' });
    await expect(facilityCard).toBeVisible();
    await expect(facilityCard.getByRole('link', { name: /Sân E2E 01/ })).toBeVisible();
    await expect(facilityCard.getByText('100.000đ', { exact: true })).toBeVisible();
    await expect(facilityCard.getByRole('link', { name: /Sân E2E 01/ })).toHaveAttribute(
      'href',
      new RegExp(`/courts/${courtId}`)
    );

    await adminContext.close();
    await playerContext.close();
  });
});
