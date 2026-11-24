import { useCallback, useEffect, useMemo, useRef, useState, type BaseSyntheticEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ApiError } from '@/shared/api/http-client';
import type { SkillSurvey, SurveyAnswers, SurveyAnswerValue } from '../auth-api';
import { useAuth } from '../use-auth';
import { clearRegisterDraft, EMPTY_ACCOUNT, readRegisterDraft, writeRegisterDraft } from './register-draft';
import { FORM_OUTDATED_CODES, registerErrorMessage } from './register-errors';
import { accountSchema, stepMissing, type AccountValues } from './register-schema';
import { clearHiddenAnswers, isSkillStep, questionMap, sanitizeAnswers } from './survey-logic';

const ACCOUNT_FIELDS = ['email', 'password', 'fullName', 'phone'] as const;
type AccountField = typeof ACCOUNT_FIELDS[number];
const isAccountField = (field: string): field is AccountField => (ACCOUNT_FIELDS as readonly string[]).includes(field);

export interface SubmitError { message: string; reload: boolean }

/** Stable DOM ids used for focus and scrolling. Question ids may contain dots, which getElementById accepts. */
export const questionHeadingId = (id: string) => `question-${id}`;
export const STEP_HEADING_ID = 'register-step-heading';
export const NEXT_BUTTON_ID = 'register-next';

function initialState(survey: SkillSurvey) {
  const questions = questionMap(survey);
  const draft = readRegisterDraft();
  const accountStep = survey.steps.length;
  if (!draft || draft.version !== survey.version) {
    return { step: 0, maxStep: 0, skillIndex: 0, answers: {} as SurveyAnswers, account: EMPTY_ACCOUNT, resumed: false };
  }
  const answers = sanitizeAnswers(survey, questions, draft.answers);
  const maxStep = Math.min(draft.maxStep, accountStep);
  return {
    step: Math.min(draft.step, maxStep),
    maxStep,
    skillIndex: draft.skillIndex,
    answers,
    account: draft.account,
    resumed: Object.keys(answers).length > 0,
  };
}

/**
 * State and commands of the survey-first registration wizard (AUTH-31): steps from
 * the survey API plus the account step, per-step required answers, draft
 * persistence without the password, and registration with error mapping.
 */
export function useRegisterWizard(survey: SkillSurvey) {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const previousChallengeId = (location.state as { previousChallengeId?: string } | null)?.previousChallengeId;
  const questions = useMemo(() => questionMap(survey), [survey]);
  const accountStep = survey.steps.length;
  const [initial] = useState(() => initialState(survey));

  const [step, setStep] = useState(initial.step);
  const [maxStep, setMaxStep] = useState(initial.maxStep);
  const [skillIndex, setSkillIndex] = useState(initial.skillIndex);
  const [answers, setAnswers] = useState<SurveyAnswers>(initial.answers);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [missing, setMissing] = useState<string[]>([]);
  /** Set on each blocked attempt; the effect below scrolls to and focuses that item. */
  const [missingFocus, setMissingFocus] = useState<{ id: string } | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [resumed, setResumed] = useState(initial.resumed);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [existingEmail, setExistingEmail] = useState(false);
  const [attention, setAttention] = useState(false);
  /** Focus moves to the new step/skill heading only after the user navigates, not on first render. */
  const [focusOnEnter, setFocusOnEnter] = useState(false);
  const advanceTimer = useRef<number | undefined>(undefined);
  const attentionTimer = useRef<number | undefined>(undefined);
  const finished = useRef(false);
  /** Field to focus once submission ends (inputs are disabled while submitting). */
  const [focusField, setFocusField] = useState<'email' | 'password' | null>(null);
  const pending = useRef(false);

  const form = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { ...initial.account, password: '' },
  });
  const [email, fullName, phone] = form.watch(['email', 'fullName', 'phone']);
  const submitting = form.formState.isSubmitting;
  useEffect(() => {
    if (!focusField || submitting) return;
    form.setFocus(focusField);
    setFocusField(null);
  }, [focusField, submitting, form]);

  const skillIds = useMemo(() => {
    const index = survey.steps.findIndex((_, i) => isSkillStep(survey, i, questions));
    return index >= 0 ? survey.steps[index].questionIds : [];
  }, [survey, questions]);
  const safeSkillIndex = Math.min(skillIndex, Math.max(skillIds.length - 1, 0));

  // Persist the draft (never the password).
  useEffect(() => {
    if (finished.current) return;
    writeRegisterDraft({ version: survey.version, step, maxStep, skillIndex: safeSkillIndex, answers, account: { email, fullName, phone } });
  }, [survey.version, step, maxStep, safeSkillIndex, answers, email, fullName, phone]);

  useEffect(() => () => { window.clearTimeout(advanceTimer.current); window.clearTimeout(attentionTimer.current); }, []);

  // After a blocked "Next": scroll to and focus the first missing item (the skill step moves to it instead).
  useEffect(() => {
    if (!missingFocus) return;
    const first = document.getElementById(questionHeadingId(missingFocus.id));
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    first?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    first?.focus({ preventScroll: true });
    setShakeId(missingFocus.id);
    const timer = window.setTimeout(() => setShakeId(null), 420);
    return () => window.clearTimeout(timer);
  }, [missingFocus]);

  const goToSkill = useCallback((index: number) => {
    if (index < 0 || index >= skillIds.length || index === safeSkillIndex) return;
    window.clearTimeout(advanceTimer.current);
    setDirection(index > safeSkillIndex ? 1 : -1);
    setFocusOnEnter(true);
    setSkillIndex(index);
  }, [skillIds.length, safeSkillIndex]);

  const goToStep = useCallback((index: number, options: { missing?: string[] } = {}) => {
    if (index < 0 || index > accountStep || index === step) return;
    window.clearTimeout(advanceTimer.current);
    setResumed(false);
    setDirection(index > step ? 1 : -1);
    setFocusOnEnter(true);
    setMissing(options.missing ?? []);
    setSubmitError(null);
    setStep(index);
    setMaxStep(current => Math.max(current, index));
    if (isSkillStep(survey, index, questions)) {
      const ids = survey.steps[index].questionIds;
      const target = options.missing?.length ? ids.indexOf(options.missing[0]) : ids.findIndex(id => answers[id] === undefined);
      if (target >= 0) setSkillIndex(target);
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [accountStep, step, survey, questions, answers]);

  const showMissing = useCallback((ids: string[]) => {
    setMissing(ids);
    if (isSkillStep(survey, step, questions)) {
      const index = skillIds.indexOf(ids[0]);
      if (index === safeSkillIndex) setMissingFocus({ id: ids[0] });
      else goToSkill(index);
      return;
    }
    setMissingFocus({ id: ids[0] });
  }, [survey, step, questions, skillIds, safeSkillIndex, goToSkill]);

  const next = useCallback(() => {
    if (step >= accountStep) return;
    const ids = stepMissing(survey, step, questions, answers);
    if (ids.length) showMissing(ids);
    else goToStep(step + 1);
  }, [step, accountStep, survey, questions, answers, showMissing, goToStep]);

  const back = useCallback(() => goToStep(step - 1), [goToStep, step]);

  const scheduleAdvance = useCallback((current: number, nextAnswers: SurveyAnswers, wasComplete: boolean) => {
    window.clearTimeout(advanceTimer.current);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    advanceTimer.current = window.setTimeout(() => {
      const after = skillIds.findIndex((id, index) => index > current && nextAnswers[id] === undefined);
      const any = after >= 0 ? after : skillIds.findIndex(id => nextAnswers[id] === undefined);
      if (any >= 0) { goToSkill(any); return; }
      if (wasComplete) return; // editing an already complete set: no repeated "done" cue
      toast(`Đã xong ${skillIds.length} kỹ năng · bấm Tiếp tục`);
      document.getElementById(NEXT_BUTTON_ID)?.focus({ preventScroll: true });
      setAttention(true);
      window.clearTimeout(attentionTimer.current);
      attentionTimer.current = window.setTimeout(() => setAttention(false), 1600);
    }, reduce ? 0 : 360);
  }, [skillIds, goToSkill]);

  const answer = useCallback((id: string, value: SurveyAnswerValue, options: { advance?: boolean } = {}) => {
    const wasComplete = skillIds.length > 0 && skillIds.every(skillId => answers[skillId] !== undefined);
    const nextAnswers = clearHiddenAnswers(questions, { ...answers, [id]: value });
    setAnswers(nextAnswers);
    setMissing(current => current.filter(item => item !== id && nextAnswers[item] === undefined));
    if (options.advance && questions[id]?.type === 'SKILL') scheduleAdvance(skillIds.indexOf(id), nextAnswers, wasComplete);
  }, [answers, questions, scheduleAdvance, skillIds]);

  const resetDraft = useCallback(() => {
    clearRegisterDraft();
    window.clearTimeout(advanceTimer.current);
    setAnswers({});
    setStep(0); setMaxStep(0); setSkillIndex(0); setMissing([]); setResumed(false); setSubmitError(null);
    setDirection(-1); setFocusOnEnter(true);
    form.reset({ ...EMPTY_ACCOUNT, password: '', withdrawalPin: '', withdrawalPinConfirm: '' });
    if (step === 0) document.getElementById(STEP_HEADING_ID)?.focus({ preventScroll: true });
  }, [form, step]);

  const onValid = async (values: AccountValues) => {
    const incomplete = survey.steps.findIndex((_, index) => stepMissing(survey, index, questions, answers).length > 0);
    if (incomplete >= 0) {
      toast(`Bước ${incomplete + 1} còn câu chưa trả lời`);
      goToStep(incomplete, { missing: stepMissing(survey, incomplete, questions, answers) });
      return;
    }
    setSubmitError(null);
    setExistingEmail(false);
    const surveyIds = new Set(survey.steps.flatMap(item => item.questionIds));
    const submitted = Object.fromEntries(Object.entries(clearHiddenAnswers(questions, answers)).filter(([id]) => surveyIds.has(id)));
    try {
      const challenge = await register({
        email: values.email.trim(),
        password: values.password,
        fullName: values.fullName.trim(),
        withdrawalPin: values.withdrawalPin,
        withdrawalPinConfirm: values.withdrawalPinConfirm,
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
        ...(previousChallengeId ? { previousChallengeId } : {}),
        skillSurvey: { version: survey.version, answers: submitted },
      });
      finished.current = true;
      navigate('/register/verify', {
        replace: true,
        state: { challenge, email: values.email.trim(), fullName: values.fullName.trim() },
      });
    } catch (reason) {
      handleSubmitError(reason);
    }
  };

  function handleSubmitError(reason: unknown) {
    if (reason instanceof ApiError) {
      if (reason.code === 'AUTH_EMAIL_ALREADY_REGISTERED') {
        setExistingEmail(true);
        form.setError('email', { type: 'server', message: 'Email này đã có tài khoản. Đăng nhập hoặc dùng Quên mật khẩu.' });
        setFocusField('email');
        return;
      }
      if (reason.code === 'AUTH_PASSWORD_POLICY_VIOLATION') {
        form.setError('password', { type: 'server', message: 'Mật khẩu phải có từ 8 đến 64 ký tự và không được trùng với email.' });
        setFocusField('password');
        return;
      }
      if (reason.code === 'VALIDATION_FAILED') {
        const fields = reason.details.map(detail => detail.field).filter((field): field is string => Boolean(field));
        const invalidQuestions = fields.filter(field => questions[field]);
        fields.filter(isAccountField).forEach(field => form.setError(field, { type: 'server', message: 'Dữ liệu nhập không hợp lệ.' }));
        if (invalidQuestions.length) {
          // The server rejected these answers: clear them and send the Player back to answer again.
          const nextAnswers = { ...answers };
          invalidQuestions.forEach(id => delete nextAnswers[id]);
          setAnswers(nextAnswers);
          const target = survey.steps.findIndex(item => item.questionIds.some(id => invalidQuestions.includes(id)));
          goToStep(target, { missing: stepMissing(survey, target, questions, nextAnswers) });
          toast('Một số câu trả lời chưa hợp lệ, vui lòng chọn lại.');
          return;
        }
        if (fields.some(isAccountField)) return;
      }
    }
    setSubmitError({ message: registerErrorMessage(reason), reload: reason instanceof ApiError && FORM_OUTDATED_CODES.has(reason.code) });
  }

  // One submission at a time, including a second submit event while validating.
  const submit = (event?: BaseSyntheticEvent) => {
    event?.preventDefault();
    if (pending.current) return;
    pending.current = true;
    return form.handleSubmit(onValid)(event).finally(() => { pending.current = false; });
  };

  return {
    survey, questions, accountStep, step, maxStep, skillIds, skillIndex: safeSkillIndex, answers, direction, missing, shakeId,
    resumed, dismissResume: () => setResumed(false), resetDraft, submitError, existingEmail, attention, focusOnEnter,
    form, submit, next, back, goToStep, goToSkill, answer,
  };
}

export type RegisterWizard = ReturnType<typeof useRegisterWizard>;
