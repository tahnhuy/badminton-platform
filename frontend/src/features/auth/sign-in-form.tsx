import { ArrowRight, LoaderCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LabeledInput } from '@/components/common/labeled-input';
import { PasswordInput } from '@/components/common/password-input';
import type { useSignInForm } from './use-sign-in-form';

type SignInFormProps = Pick<ReturnType<typeof useSignInForm>, 'form' | 'submit'>;

export function SignInForm({ form, submit }: SignInFormProps) {
  const { errors, isSubmitting } = form.formState;
  return <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="space-y-5">
    <LabeledInput id="email" label="Email" icon={Mail} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
      required disabled={isSubmitting} placeholder="ban@example.com" error={errors.email?.message} {...form.register('email')} />
    <PasswordInput id="password" label="Mật khẩu" toggleLabel="mật khẩu" autoComplete="current-password" required
      disabled={isSubmitting} error={errors.password?.message} placeholder="Nhập mật khẩu của bạn" {...form.register('password')} />
    <Button type="submit" variant="brand" size="comfortable" disabled={isSubmitting} className="group relative mt-1 w-full" aria-busy={isSubmitting} aria-label={isSubmitting ? 'Đang đăng nhập...' : undefined}>
      {isSubmitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang đăng nhập...</span></>
        : <>Đăng nhập<ArrowRight aria-hidden="true" className="absolute right-5 transition-transform duration-200 motion-safe:group-hover:translate-x-1" /></>}
    </Button>
  </form>;
}
