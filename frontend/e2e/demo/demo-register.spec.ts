import { test, expect } from '@playwright/test';
import { resetDatabase } from '../e2e-helpers';
import {
  answerSurvey,
  completeRegistrationOtp,
  EXAMPLE_2_ANSWERS,
  fillAccount,
  nextButton,
} from '../register-ui-fixtures';

/**
 * Demo flow 1: real registration through the UI — 16-question survey, OTP, result page.
 * PRD example #2 is deterministic: score 55.8 → nominal AVERAGE, G1 bottleneck on R →
 * final AVERAGE_MINUS (Trung bình yếu, rank 3), per business-rules-config-matrix.md §1.2.
 */
test.describe('Demo: registration + skill survey', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('16-question survey and OTP produce the matrix skill level', async ({ page }) => {
    const email = 'demo.register@example.com';
    await page.goto('/register');

    await answerSurvey(page, EXAMPLE_2_ANSWERS);
    await fillAccount(page, { email, fullName: 'Lê Thu Hà' });
    await expect(page.getByRole('heading', { name: 'Tạo tài khoản SmashPro', exact: true })).toBeVisible();

    await nextButton(page).click();
    await expect(page).toHaveURL('/register/verify');
    await expect(page.getByRole('heading', { name: 'Nhập mã xác minh', exact: true })).toBeVisible();

    await completeRegistrationOtp(page, email);
    await expect(page).toHaveURL('/register/result');

    // Badge rank 3 (AVERAGE_MINUS) and the Vietnamese level name.
    await expect(page.getByRole('img', { name: 'Bậc trình độ 3' })).toBeVisible();
    const badge = page.getByLabel('Huy hiệu trình độ');
    await expect(badge.getByText(/^Trung bình yếu\.?$/)).toBeVisible();
    await expect(page.getByText('Trình độ tạm thời', { exact: true })).toBeVisible();

    // Score band + guardrail G1 (weakest criterion = rally consistency / Độ ổn định giữ cầu).
    await expect(
      page.getByText(
        'Bạn được xếp ở bậc này vì Độ ổn định giữ cầu đang là điểm yếu nhất. Cải thiện tiêu chí này là cách nhanh nhất để phát huy hết tiềm năng của bạn.',
        { exact: true }
      )
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trung bình yếu — bậc của bạn' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    // The result is persisted and re-read from the server on reload (not only router state).
    await page.reload();
    await expect(page.getByRole('img', { name: 'Bậc trình độ 3' })).toBeVisible();
    await expect(badge.getByText(/^Trung bình yếu\.?$/)).toBeVisible();
  });
});
