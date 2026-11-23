import { test } from '@playwright/test';
import { account, mockAuthApi } from './auth-ui-mocks';

test('tmp courts icons', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await mockAuthApi(page, { user: account() });
  await page.goto('/courts');
  const city = page.getByRole('combobox', { name: 'Tỉnh / Thành phố' });
  await city.screenshot({ path: '/tmp/courts-city-before.png' });
  await city.click();
  await city.screenshot({ path: '/tmp/courts-city-after.png' });
  const district = page.getByRole('combobox', { name: 'Quận / Huyện' });
  await district.screenshot({ path: '/tmp/courts-district-before.png' });
  await district.click();
  await district.screenshot({ path: '/tmp/courts-district-after.png' });
  const name = page.getByLabel('Tên sân hoặc cơ sở');
  await name.screenshot({ path: '/tmp/courts-name-before.png' });
  await name.click();
  await name.screenshot({ path: '/tmp/courts-name-after.png' });
});
