import { useEffect, useMemo, useRef, useState, type BaseSyntheticEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordFeedback, type ChangePasswordField } from './change-password-errors';
import { changePasswordSchema, type ChangePasswordValues } from './password-policy';
import { useAuth } from './use-auth';
import { useSignOut } from './use-sign-out';

export function useChangePasswordForm() {
  const { user, status, changePassword } = useAuth();
  const signOut = useSignOut();
  const email = user?.email ?? '';
  // Captured once: a successful change flips the auth status before the session is ended.
  const [isForced] = useState(() => status === 'passwordChangeRequired' || Boolean(user?.requiresPasswordChange));
  const schema = useMemo(() => changePasswordSchema(email), [email]);
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    reValidateMode: 'onChange',
  });
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const focusAfterSubmit = useRef<ChangePasswordField | null>(null);
  const { isSubmitting } = form.formState;

  // Inputs are disabled while submitting, so server field errors are focused once they are enabled again.
  useEffect(() => {
    if (isSubmitting || !focusAfterSubmit.current) return;
    form.setFocus(focusAfterSubmit.current);
    focusAfterSubmit.current = null;
  }, [isSubmitting, form]);

  const onValid = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
    setError(null);
    try {
      await changePassword({ currentPassword, newPassword });
    } catch (reason) {
      const feedback = changePasswordFeedback(reason);
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

  return { form, submit, error, email, isForced, signOut: () => signOut() };
}
