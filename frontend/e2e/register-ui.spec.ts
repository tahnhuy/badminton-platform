import { expect, test, type Page, type Route } from '@playwright/test';
import { account, errorBody, mockAuthApi, type MockState } from './auth-ui-mocks';
import {
  answerSurvey, choose, EXAMPLE_2_ANSWERS, EXAMPLE_2_RESULT, fillAccount, group, nextButton, SKILL_IDS, SKILL_LEVELS, SURVEY_V1,
} from './register-ui-fixtures';

/** UI contract tests for the survey-first /register wizard and /register/result (AUTH-31, mocked API). */

type Handler = (route: Route, state: MockState) => Promise<void> | void;
interface Log { registerBodies: Record<string, unknown>[]; ownResultCalls: number }

async function openRegister(page: Page, options: { register?: Handler; survey?: Handler; ownResult?: Handler } = {}) {
  const log: Log = { registerBodies: [], ownResultCalls: 0 };
  const state = await mockAuthApi(page, { handlers: {
    '/api/v1/auth/skill-survey': options.survey ?? (route => route.fulfill({ json: { data: SURVEY_V1 } })),
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: SKILL_LEVELS } }),
    '/api/v1/auth/register': async (route, mock) => {
      log.registerBodies.push(route.request().postDataJSON());
      if (options.register) return options.register(route, mock);
      mock.user = account('PLAYER');
      return route.fulfill({ status: 201, json: { data: mock.user, meta: { skillSurveyResult: EXAMPLE_2_RESULT } } });
    },
    '/api/v1/players/me/skill-survey': async (route, mock) => {
      log.ownResultCalls++;
      if (options.ownResult) return options.ownResult(route, mock);
      return route.fulfill({ json: { data: EXAMPLE_2_RESULT } });
    },
  } });
  await page.goto('/register');
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn đã gắn bó với cầu lông thế nào?' })).toBeVisible();
  return { log, state };
}

const noHorizontalOverflow = async (page: Page, width: number) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);

test('an unanswered item blocks Next, is highlighted and focused', async ({ page }) => {
  const { log } = await openRegister(page);
  await choose(page, 'yearsPlaying', '2Y_TO_4Y');
  await nextButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Còn 3 câu chưa trả lời.');
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn đã gắn bó với cầu lông thế nào?' })).toBeVisible();
  await expect(group(page, 'frequencyPerWeek')).toHaveAttribute('aria-invalid', 'true');
  await expect(group(page, 'yearsPlaying')).not.toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[id="question-frequencyPerWeek"]')).toBeFocused();
  await expect(page.getByText('Bạn chưa chọn câu này')).toHaveCount(3);
  await choose(page, 'frequencyPerWeek', 'ONE');
  await expect(page.getByText('Bạn chưa chọn câu này')).toHaveCount(2);
  await expect(page.getByRole('alert')).toContainText('Còn 2 câu chưa trả lời.');
  expect(log.registerBodies).toHaveLength(0);
});

test('choosing "Dưới 6 tháng" hides and clears item 4; it comes back unanswered', async ({ page }) => {
  await openRegister(page);
  await choose(page, 'yearsPlaying', '2Y_TO_4Y');
  await choose(page, 'returningAfterBreak', true);
  await expect(group(page, 'returningAfterBreak').getByRole('radio', { name: 'Có', exact: true })).toBeChecked();
  await choose(page, 'yearsPlaying', 'LESS_THAN_6M');
  await expect(group(page, 'returningAfterBreak')).toHaveCount(0);
  await choose(page, 'yearsPlaying', '1Y_TO_2Y');
  await expect(group(page, 'returningAfterBreak')).toBeVisible();
  await expect(group(page, 'returningAfterBreak').getByRole('radio', { checked: true })).toHaveCount(0);
  // Hidden item 4 is not required.
  await choose(page, 'yearsPlaying', 'LESS_THAN_6M');
  await choose(page, 'frequencyPerWeek', 'FOUR_PLUS');
  await choose(page, 'coaching', 'COACH_LESS_THAN_6M');
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn tự tin với đường cầu nào?' })).toBeFocused();
});

test('technique step: pointer selection auto-advances, keys 1–4 answer, unanswered skill is shown', async ({ page }) => {
  await openRegister(page);
  for (const id of SURVEY_V1.steps[0].questionIds) await choose(page, id, EXAMPLE_2_ANSWERS[id]);
  await nextButton(page).click();
  await expect(page.locator('[id="question-skill.service"]')).toBeVisible();
  await page.locator('[data-skill-card]').getByRole('radio', { name: 'Ổn định khi đánh giao lưu' }).click();
  await expect(page.locator('[id="question-skill.clear"]')).toBeFocused();
  await page.keyboard.press('4');
  await expect(page.locator('[id="question-skill.smash"]')).toBeVisible();
  await expect(page.getByText('Đã trả lời 2 / 9')).toBeVisible();
  await nextButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Còn 7 kỹ năng chưa chọn.');
  await expect(page.locator('[id="question-skill.smash"]')).toBeVisible();
  await expect(page.getByRole('radiogroup', { name: 'Đập cầu' })).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-slot="skill-art"]')).toBeVisible();
});

test('a reload keeps the step and answers but never the password', async ({ page }) => {
  await openRegister(page);
  await answerSurvey(page);
  await fillAccount(page, { email: 'draft@example.com', password: 'SecretPassword123!' });
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản SmashPro' })).toBeVisible();
  await expect(page.getByText('Bạn đang làm dở khảo sát.')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('draft@example.com');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
  expect(await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }))).not.toContain('SecretPassword123!');
  const review = page.getByRole('region', { name: 'Xem lại câu trả lời' });
  for (const count of ['4/4', '9/9', '2/2', '1/1']) await expect(review.getByText(count)).toBeVisible();
  await page.getByRole('button', { name: 'Sửa bước 1: Tiểu sử & thói quen' }).click();
  await expect(group(page, 'yearsPlaying').getByRole('radio', { name: '2 – dưới 4 năm' })).toBeChecked();
  await expect(group(page, 'returningAfterBreak').getByRole('radio', { name: 'Không', exact: true })).toBeChecked();
});

test('"Làm lại từ đầu" clears the draft', async ({ page }) => {
  await openRegister(page);
  await choose(page, 'yearsPlaying', '7Y_PLUS');
  await page.reload();
  await page.getByRole('button', { name: 'Làm lại từ đầu' }).click();
  await expect(group(page, 'yearsPlaying').getByRole('radio', { checked: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Bạn đang làm dở khảo sát.')).toHaveCount(0);
});

for (const code of ['AUTH_SKILL_SURVEY_OUTDATED', 'AUTH_REGISTRATION_FORM_OUTDATED']) {
  test(`${code} asks to reload the page`, async ({ page }) => {
    await openRegister(page, { register: route => route.fulfill({ status: 400, json: errorBody(code) }) });
    await answerSurvey(page);
    await fillAccount(page, { email: 'outdated@example.com' });
    await nextButton(page).click();
    await expect(page.getByRole('alert')).toContainText('Biểu mẫu đã cập nhật, vui lòng tải lại trang.');
    await expect(page.getByRole('button', { name: 'Tải lại trang' })).toBeVisible();
    await expect(page.getByText('Internal message must not be displayed')).toHaveCount(0);
  });
}

test('survey unavailable (503) shows that registration is temporarily unavailable', async ({ page }) => {
  await mockAuthApi(page, { handlers: { '/api/v1/auth/skill-survey': route => route.fulfill({ status: 503, json: errorBody('AUTH_SKILL_SURVEY_UNAVAILABLE') }) } });
  await page.goto('/register');
  await expect(page.getByRole('alert')).toContainText('Đăng ký tạm thời chưa khả dụng');
});

test('503 on submit shows the unavailable message and keeps the answers', async ({ page }) => {
  await openRegister(page, { register: route => route.fulfill({ status: 503, json: errorBody('AUTH_SKILL_SURVEY_UNAVAILABLE') }) });
  await answerSurvey(page);
  await fillAccount(page, { email: 'unavailable@example.com' });
  await nextButton(page).click();
  await expect(page.getByRole('alert')).toContainText('Đăng ký tạm thời chưa khả dụng');
  await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản SmashPro' })).toBeVisible();
});

test('an email already registered keeps step ⑤ with the email error and all 16 answers', async ({ page }) => {
  let first = true;
  const { log } = await openRegister(page, { register: async (route, mock) => {
    if (first) { first = false; return route.fulfill({ status: 409, json: errorBody('AUTH_EMAIL_ALREADY_REGISTERED') }); }
    mock.user = account('PLAYER');
    return route.fulfill({ status: 201, json: { data: mock.user, meta: { skillSurveyResult: EXAMPLE_2_RESULT } } });
  } });
  await answerSurvey(page);
  await fillAccount(page, { email: 'taken@example.com' });
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản SmashPro' })).toBeVisible();
  const email = page.getByLabel('Email', { exact: true });
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toBeFocused();
  await expect(page.locator('#register-email-error')).toContainText('Email này đã được sử dụng.');
  const review = page.getByRole('region', { name: 'Xem lại câu trả lời' });
  for (const count of ['4/4', '9/9', '2/2', '1/1']) await expect(review.getByText(count)).toBeVisible();
  await email.fill('fresh@example.com');
  await nextButton(page).click();
  await expect(page).toHaveURL('/register/result');
  expect(log.registerBodies).toHaveLength(2);
  const body = log.registerBodies[1] as { skillSurvey: { answers: Record<string, unknown> } };
  expect(Object.keys(body.skillSurvey.answers)).toHaveLength(16);
});

test('PRD example #2: success opens /register/result with AVERAGE_MINUS and the G1 explanation; reload reads the saved result', async ({ page }) => {
  const { log } = await openRegister(page);
  await answerSurvey(page);
  await fillAccount(page, { email: ' player2@example.com ', fullName: 'Lê Thu Hà', phone: '0901 234 567' });
  await nextButton(page).click();
  await expect(page).toHaveURL('/register/result');
  expect(log.registerBodies[0]).toEqual({
    email: 'player2@example.com', password: 'ValidPassword123!', fullName: 'Lê Thu Hà', phone: '0901 234 567',
    skillSurvey: { version: 1, answers: EXAMPLE_2_ANSWERS },
  });
  const assertResult = async () => {
    await expect(page.getByRole('heading', { level: 1, name: /Sẵn sàng tìm/ })).toBeVisible();
    await expect(page.getByLabel('Huy hiệu trình độ').getByText(/^Trung bình yếu\.?$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trung bình yếu — bậc của bạn' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByText('Bạn được xếp ở bậc này vì Độ ổn định giữ cầu đang là điểm yếu nhất.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kỹ thuật', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kinh nghiệm', exact: true })).toBeVisible();
    await expect(page.getByText('Trình độ tạm thời')).toBeVisible();
    await expect(page.getByRole('img', { name: /Hồ sơ sáu tiêu chí/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tìm kèo phù hợp' })).toHaveAttribute('href', '/matchmaking');
    await expect(page.getByRole('link', { name: 'Xem hồ sơ của bạn' })).toHaveAttribute('href', '/profile');
  };
  await assertResult();
  await expect(page.getByText('Hà, bạn bắt đầu ở bậc')).toBeVisible();
  expect(log.ownResultCalls).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem('smashpro.registerDraft.v1'))).toBeNull();
  await page.getByRole('button', { name: 'Giỏi', exact: true }).click();
  await expect(page.getByText('Kỹ thuật chuyên sâu, chính xác dưới áp lực.')).toBeVisible();
  await page.reload();
  await assertResult();
  expect(log.ownResultCalls).toBeGreaterThanOrEqual(1); // dev StrictMode may fetch twice
});

test('the "no strengths" line replaces strength cards', async ({ page }) => {
  await mockAuthApi(page, { user: account('PLAYER'), handlers: {
    '/api/v1/skill-levels': route => route.fulfill({ json: { data: SKILL_LEVELS } }),
    '/api/v1/players/me/skill-survey': route => route.fulfill({ json: { data: { ...EXAMPLE_2_RESULT, strengths: [], guardrails: [], appliedGuardrails: [] } } }),
  } });
  await page.goto('/register/result');
  await expect(page.getByText('Chưa có điểm mạnh nổi bật — cứ ra sân thường xuyên nhé!')).toBeVisible();
  await expect(page.getByText('đang là điểm yếu nhất')).toHaveCount(0);
});

test('a direct visit without a saved result redirects to /profile', async ({ page }) => {
  await mockAuthApi(page, { user: account('PLAYER'), handlers: {
    '/api/v1/players/me/skill-survey': route => route.fulfill({ status: 404, json: errorBody('PLAYER_SKILL_SURVEY_NOT_FOUND') }),
  } });
  await page.goto('/register/result');
  await expect(page).toHaveURL('/profile');
});

test('/register/result requires a signed-in Player', async ({ page }) => {
  await mockAuthApi(page);
  await page.goto('/register/result');
  await expect(page).toHaveURL('/sign-in');
});

for (const width of [390, 1280]) {
  test(`responsive ${width}px: no horizontal overflow on every step and the result`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openRegister(page);
    await noHorizontalOverflow(page, width);
    if (width < 1024) await expect(nextButton(page)).toBeInViewport(); // sticky actions on mobile
    const box = (await nextButton(page).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    for (const id of SURVEY_V1.steps[0].questionIds) await choose(page, id, EXAMPLE_2_ANSWERS[id]);
    await page.screenshot({ path: `/tmp/smashpro-auth31/register-step1-${width}.png`, fullPage: true });
    await nextButton(page).click();
    await expect(page.locator('[id="question-skill.service"]')).toBeVisible();
    await noHorizontalOverflow(page, width);
    await page.screenshot({ path: `/tmp/smashpro-auth31/register-step2-${width}.png`, fullPage: true });
    await page.goto('/register'); // resumes the draft on step 2
    await answerSurveyFromSkills(page);
    await noHorizontalOverflow(page, width);
    await fillAccount(page, { email: `w${width}@example.com` });
    await page.screenshot({ path: `/tmp/smashpro-auth31/register-step5-${width}.png`, fullPage: true });
    await nextButton(page).click();
    await expect(page).toHaveURL('/register/result');
    await expect(page.getByLabel('Huy hiệu trình độ')).toBeVisible();
    await noHorizontalOverflow(page, width);
    // Entrance animations settle: insight cards and radar end fully visible.
    await expect(page.locator('article').filter({ hasText: 'Cùng cải thiện' })).toHaveCSS('opacity', '1');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/smashpro-auth31/register-result-${width}.png`, fullPage: true });
  });
}

async function answerSurveyFromSkills(page: Page) {
  for (const [index, id] of SKILL_IDS.entries()) {
    await expect(page.locator(`[id="question-${id}"]`)).toBeVisible();
    await page.locator('[data-skill-card]').getByRole('radio', { name: 'Ổn định cả khi bị ép tốc độ cao' }).click();
    await expect(page.getByText(`Đã trả lời ${index + 1} / 9`)).toBeVisible();
  }
  await nextButton(page).click();
  await choose(page, 'rallyConsistency', '5_TO_9');
  await choose(page, 'stamina', '20_TO_40M');
  await nextButton(page).click();
  await choose(page, 'tournamentAchievement', 'NONE');
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản SmashPro' })).toBeVisible();
}

test('reduced motion: static skill art, no shake, focus still moves to the step heading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openRegister(page);
  await nextButton(page).click();
  await expect(page.locator('[id="question-yearsPlaying"]')).toBeFocused();
  await expect(page.locator('[data-question="yearsPlaying"]')).toHaveCSS('animation-name', 'none');
  for (const id of SURVEY_V1.steps[0].questionIds) await choose(page, id, EXAMPLE_2_ANSWERS[id]);
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Bạn tự tin với đường cầu nào?' })).toBeFocused();
  await expect(page.locator('[data-slot="skill-art"]')).toBeVisible();
  expect(await page.locator('[data-slot="skill-art"] animate, [data-slot="skill-art"] animateMotion, [data-slot="skill-art"] set').count()).toBe(0);
  // Exactly one (static) shuttle, drawn at the landing point, not a stray one at the SVG origin.
  const shuttles = page.locator('[data-slot="skill-art"] [data-slot="shuttle"]');
  await expect(shuttles).toHaveCount(1);
  await expect(shuttles).toHaveAttribute('cx', '186');
});

test('with motion, the moving shuttle stays hidden until its animation starts', async ({ page }) => {
  await openRegister(page);
  for (const id of SURVEY_V1.steps[0].questionIds) await choose(page, id, EXAMPLE_2_ANSWERS[id]);
  await nextButton(page).click();
  const shuttle = page.locator('[data-slot="skill-art"] [data-slot="shuttle"]');
  await expect(shuttle).toHaveCount(1);
  await expect(shuttle).toHaveAttribute('opacity', '0');
  await expect(shuttle.locator('set[attributeName="opacity"]')).toHaveCount(1);
});

test('keyboard: radio groups are operable with arrows and focus is visible', async ({ page }) => {
  await openRegister(page);
  const first = group(page, 'yearsPlaying').getByRole('radio', { name: 'Dưới 6 tháng', exact: true });
  await first.focus();
  // Radix checks on focus only while the arrow key is held (focus moves in a timeout), so hold it like a person would.
  await page.keyboard.down('ArrowRight');
  const second = group(page, 'yearsPlaying').getByRole('radio', { name: '6 tháng – dưới 1 năm' });
  await expect(second).toBeFocused();
  await page.keyboard.up('ArrowRight');
  await expect(second).toBeChecked();
  expect(await second.evaluate(el => getComputedStyle(el).boxShadow)).not.toBe('none');
});

test('VALIDATION_FAILED on an answer clears it and returns to its step with the item highlighted and focused', async ({ page }) => {
  let first = true;
  const { log } = await openRegister(page, { register: async (route, mock) => {
    if (first) { first = false; return route.fulfill({ status: 400, json: errorBody('VALIDATION_FAILED', [{ field: 'stamina', code: 'VALIDATION_FAILED' }]) }); }
    mock.user = account('PLAYER');
    return route.fulfill({ status: 201, json: { data: mock.user, meta: { skillSurveyResult: EXAMPLE_2_RESULT } } });
  } });
  await answerSurvey(page);
  await fillAccount(page, { email: 'invalid-answer@example.com' });
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Khi vào trận, bạn trụ được đến đâu?' })).toBeVisible();
  await expect(page.locator('[id="question-stamina"]')).toBeFocused();
  await expect(group(page, 'stamina')).toHaveAttribute('aria-invalid', 'true');
  await expect(group(page, 'stamina').getByRole('radio', { checked: true })).toHaveCount(0);
  await expect(group(page, 'rallyConsistency').getByRole('radio', { name: '5–9 lượt' })).toBeChecked();
  await choose(page, 'stamina', '20_TO_40M');
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Thành tích cao nhất của bạn là gì?' })).toBeVisible();
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản SmashPro' })).toBeVisible();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('ValidPassword123!'); // kept in memory, never in the draft
  await nextButton(page).click();
  await expect(page).toHaveURL('/register/result');
  expect(log.registerBodies).toHaveLength(2);
});

test('a signed-in non-Player opening /register/result sees access denied', async ({ page }) => {
  await mockAuthApi(page, { user: account('COURT_OWNER') });
  await page.goto('/register/result');
  await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeVisible();
});

test('double submit sends one registration request', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const { log } = await openRegister(page, { register: async (route, mock) => {
    await gate;
    mock.user = account('PLAYER');
    return route.fulfill({ status: 201, json: { data: mock.user, meta: { skillSurveyResult: EXAMPLE_2_RESULT } } });
  } });
  await answerSurvey(page);
  await fillAccount(page, { email: 'double@example.com' });
  await nextButton(page).click();
  await expect(page.getByRole('button', { name: 'Đang tạo tài khoản…' })).toBeDisabled();
  await page.locator('#register-account-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await page.locator('#register-account-form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  release();
  await expect(page).toHaveURL('/register/result');
  expect(log.registerBodies).toHaveLength(1);
});
