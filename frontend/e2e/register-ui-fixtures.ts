import { expect, type Page } from '@playwright/test';

/**
 * Registration survey fixtures (AUTH-31). `SURVEY_V1` mirrors the public shape of
 * `GET /api/v1/auth/skill-survey` for version 1 (wording only, no scoring), as in
 * backend/src/services/auth/skill-survey/definition-v1.ts.
 */
export const SURVEY_V1 = {
  version: 1,
  steps: [
    { title: 'Tiểu sử & thói quen', questionIds: ['yearsPlaying', 'frequencyPerWeek', 'coaching', 'returningAfterBreak'] },
    { title: 'Kỹ thuật', questionIds: ['skill.service', 'skill.clear', 'skill.smash', 'skill.netPlay', 'skill.defense', 'skill.drive', 'skill.backhand', 'skill.footwork', 'skill.doublesPlay'] },
    { title: 'Thực chiến & thể lực', questionIds: ['rallyConsistency', 'stamina'] },
    { title: 'Thành tích thi đấu', questionIds: ['tournamentAchievement'] },
  ],
  skillScale: [
    { value: 0, label: 'Chưa làm được' },
    { value: 1, label: 'Làm được khi cầu chậm/dễ' },
    { value: 2, label: 'Ổn định khi đánh giao lưu' },
    { value: 3, label: 'Ổn định cả khi bị ép tốc độ cao' },
  ],
  questions: [
    { id: 'yearsPlaying', type: 'CHOICE', text: 'Tổng thời gian bạn thực sự chơi cầu lông là bao lâu (không tính các giai đoạn nghỉ)?', options: [
      { code: 'LESS_THAN_6M', label: 'Dưới 6 tháng' }, { code: '6M_TO_1Y', label: '6 tháng – dưới 1 năm' }, { code: '1Y_TO_2Y', label: '1 – dưới 2 năm' },
      { code: '2Y_TO_4Y', label: '2 – dưới 4 năm' }, { code: '4Y_TO_7Y', label: '4 – dưới 7 năm' }, { code: '7Y_PLUS', label: 'Từ 7 năm trở lên' }] },
    { id: 'frequencyPerWeek', type: 'CHOICE', text: 'Hiện tại bạn chơi trung bình bao nhiêu buổi mỗi tuần?', options: [
      { code: 'LESS_THAN_1', label: 'Dưới 1 buổi' }, { code: 'ONE', label: '1 buổi' }, { code: 'TWO_TO_THREE', label: '2–3 buổi' }, { code: 'FOUR_PLUS', label: 'Từ 4 buổi trở lên' }] },
    { id: 'coaching', type: 'CHOICE', text: 'Bạn đã từng học cầu lông bài bản chưa?', options: [
      { code: 'NONE', label: 'Chưa từng học' }, { code: 'SELF_TAUGHT', label: 'Tự học qua video/bạn bè' }, { code: 'COACH_LESS_THAN_6M', label: 'Học lớp cơ bản/HLV dưới 6 tháng' },
      { code: 'COACH_6M_PLUS', label: 'Học có giáo trình từ 6 tháng trở lên' }, { code: 'TALENT_TEAM', label: 'Từng ở đội tuyển/lớp năng khiếu' }] },
    { id: 'returningAfterBreak', type: 'BOOLEAN', text: 'Bạn có đang quay lại chơi sau một thời gian nghỉ liên tục trên 6 tháng, và mới chơi lại chưa đến 3 tháng không?',
      options: [{ code: false, label: 'Không' }, { code: true, label: 'Có' }], hiddenWhen: { questionId: 'yearsPlaying', optionCode: 'LESS_THAN_6M' } },
    { id: 'skill.service', type: 'SKILL', text: 'Giao cầu', description: 'Giao cầu ngắn sát lưới và giao cầu cao sâu cuối sân' },
    { id: 'skill.clear', type: 'SKILL', text: 'Phông cầu', description: 'Từ cuối sân đánh cầu cao sâu về sát cuối sân đối phương' },
    { id: 'skill.smash', type: 'SKILL', text: 'Đập cầu', description: 'Đập cầu cắm, có lực và điều chỉnh được hướng' },
    { id: 'skill.netPlay', type: 'SKILL', text: 'Bỏ nhỏ / cầu lưới', description: 'Bỏ nhỏ, ve, móc cầu sát mép lưới' },
    { id: 'skill.defense', type: 'SKILL', text: 'Thủ cầu', description: 'Đỡ đập, hất cầu cao sâu thoát hiểm khi bị tấn công' },
    { id: 'skill.drive', type: 'SKILL', text: 'Tạt cầu & phản tạt', description: 'Đánh cầu ngang lưới tốc độ nhanh, chủ động hoặc phản tạt khi bị ép' },
    { id: 'skill.backhand', type: 'SKILL', text: 'Trái tay', description: 'Đánh trái tay từ cuối sân qua lưới để thoát thế bị động' },
    { id: 'skill.footwork', type: 'SKILL', text: 'Bộ pháp', description: 'Di chuyển bao các góc sân và hồi về vị trí trung tâm' },
    { id: 'skill.doublesPlay', type: 'SKILL', text: 'Phối hợp đánh đôi', description: 'Hiểu vị trí tấn công (trên–dưới) và phòng thủ (hai bên), biết bọc lót đồng đội' },
    { id: 'rallyConsistency', type: 'CHOICE', text: 'Khi đánh qua lại giằng co với người cùng trình độ, bạn thường giữ được bao nhiêu lượt chạm cầu trước khi chính bạn đánh hỏng?',
      description: 'Đếm cả hai bên: bạn đánh, đối phương đánh lại là 2 lượt.', options: [
        { code: 'LESS_THAN_5', label: 'Dưới 5 lượt' }, { code: '5_TO_9', label: '5–9 lượt' }, { code: '10_TO_14', label: '10–14 lượt' }, { code: '15_TO_19', label: '15–19 lượt' },
        { code: '20_PLUS', label: 'Từ 20 lượt trở lên' }, { code: '20_PLUS_ATTACKING', label: 'Từ 20 lượt trở lên và thường chủ động kết thúc pha cầu bằng tấn công' }] },
    { id: 'stamina', type: 'CHOICE', text: 'Trong một buổi chơi, bạn duy trì được chất lượng đánh như thế nào?', options: [
      { code: 'UNDER_20M', label: 'Hụt hơi trước 20 phút' }, { code: '20_TO_40M', label: 'Trụ được 20–40 phút' }, { code: 'ONE_HOUR_FADES_GAME_3', label: 'Đánh khoảng 1 giờ nhưng tụt sức ở ván 3' },
      { code: 'THREE_GAMES', label: 'Giữ phong độ qua cả 3 ván' }, { code: 'MULTIPLE_MATCHES', label: 'Đánh nhiều trận liên tục trong buổi mà vẫn giữ chất lượng' }] },
    { id: 'tournamentAchievement', type: 'CHOICE', text: 'Thành tích thi đấu cao nhất bạn từng đạt được là gì?', description: 'Chỉ tính khi đạt giải Nhất, Nhì hoặc Ba.', options: [
      { code: 'NONE', label: 'Chưa từng đạt giải' }, { code: 'INTERNAL', label: 'Đạt giải nội bộ CLB/công ty/trường' }, { code: 'DISTRICT_OR_STUDENT', label: 'Đạt giải cấp quận/huyện hoặc giải sinh viên' },
      { code: 'PROVINCIAL_MEDAL', label: 'Đạt huy chương giải cấp tỉnh/thành phố' }, { code: 'NATIONAL_OR_PRO', label: 'Đạt giải cấp quốc gia hoặc thi đấu chuyên nghiệp' }] },
  ],
};

export const SKILL_IDS = SURVEY_V1.steps[1].questionIds;
const SKILL_LABELS = SURVEY_V1.skillScale.map(level => level.label);

/** PRD acceptance example #2 (2–4 years, 2–3 sessions, never coached, all skills 3, 5–9 shots, 20–40 min, no prize). */
export const EXAMPLE_2_ANSWERS = {
  yearsPlaying: '2Y_TO_4Y', frequencyPerWeek: 'TWO_TO_THREE', coaching: 'NONE', returningAfterBreak: false,
  ...Object.fromEntries(SKILL_IDS.map(id => [id, 3])),
  rallyConsistency: '5_TO_9', stamina: '20_TO_40M', tournamentAchievement: 'NONE',
} as Record<string, string | number | boolean>;

const level = (code: string, name: string, rank: number) => ({ code, name, rank });
export const SKILL_LEVELS = [
  { ...level('BEGINNER', 'Mới chơi', 1), description: 'Mới làm quen; chủ yếu cố đưa cầu qua lưới.' },
  { ...level('WEAK', 'Yếu', 2), description: 'Đánh qua lại được ở tốc độ chậm.' },
  { ...level('AVERAGE_MINUS', 'Trung bình yếu', 3), description: 'Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định.' },
  { ...level('AVERAGE', 'Trung bình', 4), description: 'Kỹ thuật cơ bản tương đối đều.' },
  { ...level('AVERAGE_PLUS', 'Trung bình khá', 5), description: 'Kỹ thuật vững, ít lỗi tự đánh hỏng.' },
  { ...level('GOOD', 'Khá', 6), description: 'Kỹ thuật toàn diện, độ ổn định cao.' },
  { ...level('EXCELLENT', 'Giỏi', 7), description: 'Kỹ thuật chuyên sâu, chính xác dưới áp lực.' },
];

/** Engine output for example #2 (backend skill-survey-api.test.ts): G1 on R caps AVERAGE to AVERAGE_MINUS. */
export const EXAMPLE_2_RESULT = {
  version: 1,
  nominalSkillLevel: level('AVERAGE', 'Trung bình', 4),
  skillLevel: level('AVERAGE_MINUS', 'Trung bình yếu', 3),
  isSkillTentative: true,
  finalScore: 55.8,
  components: { K: 100, R: 20, X: 62, P: 25, A: 0, T: 0 },
  appliedGuardrails: ['G1_BOTTLENECK'],
  guardrails: [{ code: 'G1_BOTTLENECK', cap: level('AVERAGE_MINUS', 'Trung bình yếu', 3), criterion: 'R' }],
  strengths: [{ criterion: 'K', score: 100 }, { criterion: 'X', score: 62 }],
  areaToImprove: { criterion: 'R', score: 20 },
};

const question = (id: string) => SURVEY_V1.questions.find(item => item.id === id)!;

/** The radio group of a question: its accessible name is "Câu n <text>". */
export const group = (page: Page, id: string) => page.getByRole('radiogroup', { name: question(id).text });

export async function choose(page: Page, id: string, code: string | boolean) {
  const label = question(id).options!.find(option => option.code === code)!.label;
  await group(page, id).getByRole('radio', { name: label, exact: true }).click();
}

export const nextButton = (page: Page) => page.locator('#register-next');

/** Answers steps 1–4 with `answers` through the UI (pointer selection; skills auto-advance) and stops on step ⑤. */
export async function answerSurvey(page: Page, answers: Record<string, string | number | boolean> = EXAMPLE_2_ANSWERS) {
  for (const id of SURVEY_V1.steps[0].questionIds) if (answers[id] !== undefined) await choose(page, id, answers[id]);
  await nextButton(page).click();
  for (const [index, id] of SKILL_IDS.entries()) {
    await expect(page.locator(`[id="question-${id}"]`)).toBeVisible();
    await page.locator('[data-skill-card]').getByRole('radio', { name: SKILL_LABELS[answers[id] as number] }).click();
    await expect(page.getByText(`Đã trả lời ${index + 1} / ${SKILL_IDS.length}`)).toBeVisible();
  }
  await nextButton(page).click();
  for (const id of SURVEY_V1.steps[2].questionIds) await choose(page, id, answers[id]);
  await nextButton(page).click();
  for (const id of SURVEY_V1.steps[3].questionIds) await choose(page, id, answers[id]);
  await nextButton(page).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tạo tài khoản SmashPro' })).toBeVisible();
}

export async function fillAccount(page: Page, values: { email: string; password?: string; fullName?: string; phone?: string; pin?: string }) {
  await page.getByLabel('Email', { exact: true }).fill(values.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(values.password ?? 'ValidPassword123!');
  await page.getByLabel('Họ và tên', { exact: true }).fill(values.fullName ?? 'Nguyễn Minh Khoa');
  const pin = values.pin ?? '284691';
  await page.getByLabel('Mã PIN rút tiền', { exact: true }).fill(pin);
  await page.getByLabel('Nhập lại mã PIN', { exact: true }).fill(pin);
  if (values.phone !== undefined) await page.getByLabel('Số điện thoại (không bắt buộc)').fill(values.phone);
}

/** Completes the `/register/verify` step; live E2E passes the email to read the fake-adapter OTP. */
export async function completeRegistrationOtp(page: Page, email?: string) {
  let otp = '123456';
  if (email) {
    const response = await page.request.get(`/api/v1/test/latest-otp?email=${encodeURIComponent(email.toLowerCase())}&template=REGISTER_OTP`);
    if (!response.ok()) throw new Error(`No registration OTP for ${email}: ${await response.text()}`);
    otp = (await response.json()).otp;
  }
  await page.getByLabel('Mã xác minh', { exact: true }).fill(otp);
  await page.getByRole('button', { name: 'Xác minh và tạo tài khoản' }).click();
}
