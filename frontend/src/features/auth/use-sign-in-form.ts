import { useRef, useState, type BaseSyntheticEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ApiError } from '@/shared/api/http-client';
import { getRoleHomePath, isPathInRoleArea } from '@/app/role-home';
import { useAuth } from './use-auth';
import { signInErrorMessage } from './sign-in-errors';

const schema = z.object({
  email: z.string().trim().min(1, 'Vui lòng nhập email.').max(254, 'Email quá dài.').email('Email không đúng định dạng.'),
  // Sign-in accepts existing passwords; registration/change-password policy does not belong here.
  password: z.string().min(1, 'Vui lòng nhập mật khẩu.'),
});
type SignInValues = z.infer<typeof schema>;

export function useSignInForm() {
  const { signIn, sessionMessage, clearSessionMessage } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pending = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<SignInValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onValid = async (values: SignInValues) => {
    setError(null);
    clearSessionMessage();
    try {
      const user = await signIn(values);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(user.requiresPasswordChange ? '/change-password'
        : from && isPathInRoleArea(from, user.role) ? from : getRoleHomePath(user.role), { replace: true });
    } catch (reason) {
      setError(signInErrorMessage(reason));
      if (reason instanceof ApiError && reason.code === 'VALIDATION_FAILED') {
        for (const detail of reason.details) {
          if (detail.field === 'email' || detail.field === 'password') {
            form.setError(detail.field, { type: 'server', message: 'Dữ liệu nhập không hợp lệ' });
          }
        }
      }
    }
  };
  // Guard the whole validation/submission cycle, including a second submit event.
  const submit = (event: BaseSyntheticEvent) => {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    return form.handleSubmit(onValid)(event).finally(() => { pending.current = false; });
  };
  return { form, submit, error, sessionMessage };
}
