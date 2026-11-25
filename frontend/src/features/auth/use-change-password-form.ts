import { useCallback, useEffect, useMemo, useRef, useState, type BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ApiError } from '@/shared/api/http-client';
import { authApi, type RegistrationChallenge } from './auth-api';
import { changePasswordFeedback, type ChangePasswordField } from './change-password-errors';
import { changePasswordSchema, type ChangePasswordValues } from './password-policy';
import { useAuth } from './use-auth';
import { useSignOut } from './use-sign-out';

export type ChangeOtpStage = 'INTRO' | 'VERIFY' | 'DONE';

function otpFeedback(error: unknown): string {
  const feedback = changePasswordFeedback(error);
  if (feedback.message) return feedback.message;
  const first = Object.values(feedback.fieldErrors)[0];
  return first ?? 'Mã xác minh không đúng. Vui lòng thử lại.';
}

export function useChangePasswordForm() {
  const { user, status, changePassword } = useAuth();
  const signOut = useSignOut();
  const email = user?.email ?? '';
  // Captured once: a successful change flips the auth status before the session is ended.
  const [isForced] = useState(() => status === 'passwordChangeRequired' || Boolean(user?.requiresPasswordChange));
  const schema = useMemo(() => changePasswordSchema(), []);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    reValidateMode: 'onChange',
  });
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const focusAfterSubmit = useRef<ChangePasswordField | null>(null);
  const { isSubmitting } = form.formState;

  // Voluntary change requires email OTP first; the forced first-sign-in change does not.
  const [otpStage, setOtpStage] = useState<ChangeOtpStage>(isForced ? 'DONE' : 'INTRO');
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(null);
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpNotice, setOtpNotice] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (otpStage !== 'VERIFY') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [otpStage]);

  const resendInSeconds = useMemo(() => {
    if (!challenge) return 0;
    return Math.max(0, Math.ceil((new Date(challenge.resendAvailableAt).getTime() - now) / 1000));
  }, [challenge, now]);

  // Inputs are disabled while submitting, so server field errors are focused once they are enabled again.
  useEffect(() => {
    if (isSubmitting || !focusAfterSubmit.current) return;
    form.setFocus(focusAfterSubmit.current);
    focusAfterSubmit.current = null;
  }, [isSubmitting, form]);

  const requestOtp = useCallback(async () => {
    setOtpBusy(true);
    setOtpError(null);
    setOtpNotice(null);
    try {
      const response = await authApi.requestPasswordChangeOtp();
      setChallenge(response.data);
      setOtp('');
      setOtpStage('VERIFY');
      setOtpNotice('Mã xác minh đã được gửi tới email tài khoản.');
    } catch (reason) {
      setOtpError(otpFeedback(reason));
    } finally {
      setOtpBusy(false);
    }
  }, []);

  const verifyOtp = useCallback(async () => {
    if (!challenge) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const response = await authApi.verifyPasswordChangeOtp({ challengeId: challenge.challengeId, otp });
      setResetToken(response.data.resetToken);
      setOtpStage('DONE');
      setError(null);
    } catch (reason) {
      setOtpError(otpFeedback(reason));
    } finally {
      setOtpBusy(false);
    }
  }, [challenge, otp]);

  const resendOtp = useCallback(async () => {
    if (!challenge || resendInSeconds > 0) return;
    setOtpBusy(true);
    setOtpError(null);
    try {
      const response = await authApi.resendPasswordChangeOtp({ challengeId: challenge.challengeId });
      setChallenge(response.data);
      setOtp('');
      setOtpNotice('Đã gửi lại mã xác minh. Mã cũ không còn hiệu lực.');
    } catch (reason) {
      setOtpError(otpFeedback(reason));
    } finally {
      setOtpBusy(false);
    }
  }, [challenge, resendInSeconds]);

  const onValid = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
    setError(null);
    try {
      await changePassword({
        currentPassword,
        newPassword,
        ...(resetToken ? { resetToken } : {}),
      });
    } catch (reason) {
      const feedback = changePasswordFeedback(reason);
      if (
        !isForced &&
        reason instanceof ApiError &&
        (reason.code === 'AUTH_RESET_TOKEN_INVALID' || reason.code === 'AUTH_PASSWORD_CHANGE_OTP_REQUIRED')
      ) {
        // The one-time authorization expired or was already used: the form would stay
        // stuck, so send the user back to the email verification step.
        setResetToken(null);
        setChallenge(null);
        setOtp('');
        setOtpNotice(null);
        setOtpError(feedback.message);
        setOtpStage('INTRO');
        return;
      }
      const fields = Object.entries(feedback.fieldErrors) as [ChangePasswordField, string][];
      for (const [field, message] of fields) form.setError(field, { type: 'server', message });
      focusAfterSubmit.current = fields[0]?.[0] ?? null;
      setError(feedback.message);
      return;
    }
    // Decision 2026-11-18: a changed password ends this device's session; sign in again with it.
    await signOut('passwordChanged');
  };

  const submit = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    return form.handleSubmit(onValid)(event).finally(() => { pending.current = false; });
  };

  return {
    form,
    submit,
    error,
    email,
    isForced,
    signOut: () => signOut(),
    otpStage,
    otp,
    setOtp,
    otpError,
    otpNotice,
    otpBusy,
    resendInSeconds,
    requestOtp,
    verifyOtp,
    resendOtp,
  };
}
