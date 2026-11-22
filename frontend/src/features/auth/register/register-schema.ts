import { z } from 'zod';
import { hasValidPasswordLength, isPasswordSameAsEmail, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../password-policy';
import type { SkillSurvey, SurveyAnswers } from '../auth-api';
import { missingIds, type QuestionMap } from './survey-logic';

/** Step ⑤ account form. Mirrors the server rules (Auth Tech Design); the server stays authoritative. */
export const accountSchema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email.').max(254, 'Email quá dài.').email('Email không đúng định dạng.'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.')
    .refine(hasValidPasswordLength, `Mật khẩu phải có từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự.`),
  fullName: z.string().trim().min(1, 'Vui lòng nhập họ và tên.').max(255, 'Họ và tên tối đa 255 ký tự.'),
  // Same shape as the server's `playerPhone`: digits with optional + and separators, 7–15 digits.
  phone: z.string().trim().max(40, 'Số điện thoại quá dài.')
    .refine(value => value === '' || (/^[+\d ()-]+$/.test(value) && /^\+?\d{7,15}$/.test(value.replace(/[ ()-]/g, ''))),
      'Số điện thoại không đúng định dạng.'),
}).superRefine((values, ctx) => {
  if (isPasswordSameAsEmail(values.password, values.email.trim())) {
    ctx.addIssue({ code: 'custom', path: ['password'], message: 'Mật khẩu không được trùng với email.' });
  }
});

export type AccountValues = z.infer<typeof accountSchema>;

/**
 * Per-step survey schema built from the definition: every visible item of the step
 * must be answered. Answers use question ids with dots (`skill.service`), so they
 * are validated with zod directly instead of as react-hook-form paths.
 */
export function surveyStepSchema(survey: SkillSurvey, stepIndex: number, questions: QuestionMap) {
  return z.custom<SurveyAnswers>().superRefine((answers, ctx) => {
    for (const id of missingIds(survey, stepIndex, questions, answers)) {
      ctx.addIssue({ code: 'custom', path: [id], message: 'Bạn chưa chọn câu này' });
    }
  });
}

/** Question ids reported missing by the step schema, in survey order. */
export function stepMissing(survey: SkillSurvey, stepIndex: number, questions: QuestionMap, answers: SurveyAnswers): string[] {
  const result = surveyStepSchema(survey, stepIndex, questions).safeParse(answers);
  return result.success ? [] : result.error.issues.map(issue => String(issue.path[0]));
}
