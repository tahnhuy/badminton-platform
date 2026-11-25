import { useWatch } from 'react-hook-form';
import { Circle, CircleCheck, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/common/password-input';
import { cn } from '@/shared/utils/cn';
import { hasValidPasswordLength, hasPasswordLettersAndNumbers, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from './password-policy';
import type { useChangePasswordForm } from './use-change-password-form';

type ChangePasswordFormProps = Pick<ReturnType<typeof useChangePasswordForm>, 'form' | 'submit'>;

/** Live policy checklist; text states (not only color) tell whether each rule is met. */
function PasswordRules({ id, password }: { id: string; password: string }) {
  const rules = [
    { label: `Từ ${PASSWORD_MIN_LENGTH} đến ${PASSWORD_MAX_LENGTH} ký tự`, met: hasValidPasswordLength(password) },
    { label: 'Gồm chữ và số', met: hasPasswordLettersAndNumbers(password) },
  ];
  return <ul id={id} className="space-y-1.5 text-xs">
    {rules.map(({ label, met }) => {
      const passed = password.length > 0 && met;
      return <li key={label} className={cn('flex items-center gap-2', passed ? 'text-success' : 'text-muted-foreground')}>
        {passed ? <CircleCheck aria-hidden="true" className="size-4" /> : <Circle aria-hidden="true" className="size-4" />}
        <span><span className="sr-only">{passed ? 'Đã đạt: ' : 'Chưa đạt: '}</span>{label}</span>
      </li>;
    })}
  </ul>;
}

export function ChangePasswordForm({ form, submit }: ChangePasswordFormProps) {
  const { errors, isSubmitting } = form.formState;
  const newPassword = useWatch({ control: form.control, name: 'newPassword' });
  return <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="space-y-5">
    <PasswordInput id="currentPassword" label="Mật khẩu hiện tại" toggleLabel="mật khẩu hiện tại" autoComplete="current-password"
      required disabled={isSubmitting} placeholder="Nhập mật khẩu hiện tại" error={errors.currentPassword?.message}
      {...form.register('currentPassword')} />
    <div className="space-y-3">
      <PasswordInput id="newPassword" label="Mật khẩu mới" toggleLabel="mật khẩu mới" autoComplete="new-password"
        required disabled={isSubmitting} placeholder="Tạo mật khẩu mới" error={errors.newPassword?.message}
        aria-describedby="new-password-rules" {...form.register('newPassword')} />
      <PasswordRules id="new-password-rules" password={newPassword} />
    </div>
    <PasswordInput id="confirmPassword" label="Nhập lại mật khẩu mới" toggleLabel="mật khẩu nhập lại" autoComplete="new-password"
      required disabled={isSubmitting} placeholder="Nhập lại mật khẩu mới" error={errors.confirmPassword?.message}
      {...form.register('confirmPassword')} />
    <Button type="submit" variant="brand" size="comfortable" disabled={isSubmitting} className="mt-1 w-full"
      aria-busy={isSubmitting} aria-label={isSubmitting ? 'Đang cập nhật...' : undefined}>
      {isSubmitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang cập nhật...</span></>
        : 'Cập nhật mật khẩu'}
    </Button>
  </form>;
}
