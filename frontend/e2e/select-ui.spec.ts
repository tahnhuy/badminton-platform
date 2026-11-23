import { expect, test } from '@playwright/test';
import { chooseSelectOption } from './e2e-helpers';

test.beforeEach(async ({ page }) => {
  await page.route('**/__select-regression', route => route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script type="module">
    import RefreshRuntime from '/@react-refresh';
    RefreshRuntime.injectIntoGlobalHook(window);
    window.$RefreshReg$ = () => {};
    window.$RefreshSig$ = () => type => type;
    window.__vite_plugin_react_preamble_installed__ = true;
    await import('/e2e/fixtures/select-regression.tsx');
  </script>` }));
  await page.goto('/__select-regression');
});

test('controlled empty value clears selection and can be selected again', async ({ page }) => {
  const control = page.getByRole('combobox', { name: 'Controlled', exact: true });
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(control).toHaveText('Choose');
  await chooseSelectOption(control, 'a');
  await expect(control).toHaveText('Alpha');
});

test('required empty options block submission and focus the trigger', async ({ page }) => {
  const required = page.getByRole('combobox', { name: 'Required', exact: true });
  await page.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(required).toBeFocused();
  expect(await page.locator('#test-form').evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(false);
  await chooseSelectOption(required, '__empty__');
  expect(await page.locator('#test-form').evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(true);
  expect(await page.locator('#test-form').evaluate(form => Object.fromEntries(new FormData(form as HTMLFormElement)))).toEqual({ required: '__empty__', uncontrolled: 'a' });
  await chooseSelectOption(required, '');
  expect(await page.locator('#test-form').evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(false);
});

test('uncontrolled labels follow selection and form reset restores defaults', async ({ page }) => {
  const control = page.getByRole('combobox', { name: 'Uncontrolled', exact: true });
  await chooseSelectOption(control, '__empty__');
  await expect(control).toHaveText('Real sentinel');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(control).toHaveText('Alpha');
  expect(await page.locator('#test-form').evaluate(form => new FormData(form as HTMLFormElement).get('uncontrolled'))).toBe('a');
  await expect(page.getByRole('combobox', { name: 'Disabled', exact: true })).toBeDisabled();
});
