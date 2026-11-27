import { Check, KeyRound, Mail, Pencil, Phone, RotateCw, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FocusAlert } from '@/components/common/focus-alert';
import { LabeledInput } from '@/components/common/labeled-input';
import { PasswordInput } from '@/components/common/password-input';
import { cn } from '@/shared/utils/cn';
import { hasValidPasswordLength, hasPasswordLettersAndNumbers } from '../password-policy';
import { REVIEW_LABELS } from './survey-presentation';
import { answerLabel, isSkillStep, visibleIds } from './survey-logic';
import type { RegisterWizard } from './use-register-wizard';

export const ACCOUNT_FORM_ID = 'register-account-form';

/** Step ⑤: account fields with a live password checklist, plus a review of every survey answer. */
export function AccountStep({ wizard }: { wizard: RegisterWizard }) {
  const { form, submit, submitError } = wizard;
  const { errors, isSubmitting } = form.formState;
  const password = form.watch('password');
  const rules = [
    { id: 'length', label: '8–64 ký tự', ok: hasValidPasswordLength(password) },
    { id: 'composition', label: 'Gồm chữ và số', ok: hasPasswordLettersAndNumbers(password) },
  ];
  return <div className="mt-6 grid items-start gap-7 xl:grid-cols-2">
    <div className="min-w-0">
      {wizard.existingEmail && <Alert variant="warning" role="status" className="mb-5">
        <span>Email này đã có tài khoản. </span>
        <Link to="/sign-in" className="font-semibold underline">Đăng nhập</Link>
        <span> hoặc </span>
        <Link to="/forgot-password" className="font-semibold underline">quên mật khẩu</Link>.
      </Alert>}
      {submitError && (submitError.reload
        ? <Alert variant="destructive" role="alert" className="mb-5 flex flex-wrap items-center gap-3">
          <span className="flex-1">{submitError.message}</span>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}><RotateCw aria-hidden="true" />Tải lại trang</Button>
        </Alert>
        : <FocusAlert message={submitError.message} className="mb-5" />)}
      <form id={ACCOUNT_FORM_ID} onSubmit={submit} noValidate aria-busy={isSubmitting} className="grid gap-4">
        <LabeledInput id="register-email" label="Email" icon={Mail} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
          required disabled={isSubmitting} placeholder="ban@example.com" error={errors.email?.message} aria-describedby="register-email-hint" {...form.register('email')} />
        <p id="register-email-hint" className="-mt-2 text-xs text-muted-foreground">Dùng để đăng nhập.</p>
        <PasswordInput id="register-password" label="Mật khẩu" toggleLabel="mật khẩu" autoComplete="new-password" required disabled={isSubmitting}
          error={errors.password?.message} aria-describedby="register-password-rules" {...form.register('password')} />
        <ul id="register-password-rules" aria-label="Yêu cầu mật khẩu" className="-mt-1.5 flex flex-wrap gap-2">
          {rules.map(rule => <li key={rule.id} className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors duration-200',
            rule.ok ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground')}>
            <Check aria-hidden="true" strokeWidth={3} className={cn('size-3.25', !rule.ok && 'opacity-35')} />
            <span>{rule.label}</span><span className="sr-only">{rule.ok ? ': đã đạt' : ': chưa đạt'}</span>
          </li>)}
        </ul>
        <LabeledInput id="register-fullName" label="Họ và tên" icon={UserRound} autoComplete="name" required disabled={isSubmitting}
          placeholder="Nguyễn Văn A" error={errors.fullName?.message} {...form.register('fullName')} />
        <LabeledInput id="register-phone" label="Số điện thoại (không bắt buộc)" icon={Phone} type="tel" autoComplete="tel" maxLength={40}
          disabled={isSubmitting} error={errors.phone?.message} aria-describedby="register-phone-hint" {...form.register('phone')} />
        <p id="register-phone-hint" className="-mt-2 text-xs text-muted-foreground">Chỉ chủ sân của booking bạn đặt mới thấy.</p>
        <div className="mt-1 grid gap-4 rounded-2xl border border-border bg-soft p-4">
          <div>
            <h2 className="text-sm font-extrabold">Mã PIN rút tiền</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Tự đặt 6 chữ số, dùng để xác nhận mỗi lần rút tiền. Không dùng mã này để đăng nhập.</p>
          </div>
          <PasswordInput id="register-withdrawal-pin" label="Mã PIN rút tiền" toggleLabel="mã PIN rút tiền" icon={KeyRound} inputMode="numeric" autoComplete="new-password" maxLength={6} required disabled={isSubmitting}
            placeholder="••••••" error={errors.withdrawalPin?.message} {...form.register('withdrawalPin')} />
          <PasswordInput id="register-withdrawal-pin-confirm" label="Nhập lại mã PIN" toggleLabel="mã PIN xác nhận" icon={KeyRound} inputMode="numeric" autoComplete="new-password" maxLength={6} required disabled={isSubmitting}
            placeholder="••••••" error={errors.withdrawalPinConfirm?.message} {...form.register('withdrawalPinConfirm')} />
        </div>
      </form>
    </div>
    <AnswerReview wizard={wizard} />
  </div>;
}

function AnswerReview({ wizard }: { wizard: RegisterWizard }) {
  const { survey, questions, answers, goToStep, form } = wizard;
  const busy = form.formState.isSubmitting;
  return <section aria-labelledby="register-review-heading" className="rounded-2xl border border-border bg-soft p-5">
    <h2 id="register-review-heading" className="text-base font-extrabold">Xem lại câu trả lời</h2>
    <p className="mt-0.5 text-sm text-muted-foreground">Khảo sát chỉ làm một lần. Kiểm tra trước khi tạo tài khoản.</p>
    {survey.steps.map((step, index) => {
      const ids = visibleIds(survey, index, questions, answers);
      const answered = ids.filter(id => answers[id] !== undefined).length;
      const complete = answered === ids.length;
      return <section key={step.title} aria-labelledby={`review-step-${index}`} className="mt-3.5 rounded-2xl border border-border bg-card px-3.5 py-3">
        <header className="flex items-center gap-2.5">
          <span aria-hidden="true" className="text-xs font-extrabold text-primary">{String(index + 1).padStart(2, '0')}</span>
          <h3 id={`review-step-${index}`} className="flex-1 text-sm font-bold">{step.title}</h3>
          <span className={cn('text-xs font-bold', complete ? 'text-primary' : 'text-destructive')}>
            {answered}/{ids.length}<span className="sr-only"> câu đã trả lời</span>
          </span>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => goToStep(index)} className="h-11 px-2 text-primary" aria-label={`Sửa bước ${index + 1}: ${step.title}`}>
            <Pencil aria-hidden="true" />Sửa
          </Button>
        </header>
        {isSkillStep(survey, index, questions)
          ? <ul className="mt-1.5 grid grid-cols-2 gap-x-2.5 gap-y-2 sm:grid-cols-3">
            {ids.map(id => {
              const value = answers[id];
              return <li key={id} className="flex min-w-0 items-end gap-0.5 text-xs">
                <span aria-hidden="true" className="flex items-end gap-0.5">
                  {['h-1.5', 'h-2.5', 'h-3.5'].map((height, bar) => <i key={height} className={cn('w-1 rounded-md', height, typeof value === 'number' && bar < value ? 'bg-primary' : 'bg-muted')} />)}
                </span>
                <span className="ml-1.5 truncate text-muted-foreground">{questions[id]?.text}</span>
                <span className="sr-only">: {answerLabel(survey, questions[id], value) ?? 'Chưa chọn'}</span>
              </li>;
            })}
          </ul>
          : <dl className="mt-1 grid gap-1">
            {ids.map(id => <div key={id} className="flex justify-between gap-3 text-sm text-muted-foreground">
              <dt>{REVIEW_LABELS[id] ?? questions[id]?.text}</dt>
              <dd className="text-right font-semibold text-foreground">{answerLabel(survey, questions[id], answers[id]) ?? 'Chưa chọn'}</dd>
            </div>)}
          </dl>}
      </section>;
    })}
  </section>;
}
