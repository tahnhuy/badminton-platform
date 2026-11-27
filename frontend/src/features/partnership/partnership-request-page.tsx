import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Building2, CircleCheck, Hash, LayoutGrid, LoaderCircle, Mail, MapPin, Phone, Send, Store, UserRound } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BrandLogo } from '@/components/common/brand-logo';
import { LabeledInput } from '@/components/common/labeled-input';
import { ApiError } from '@/shared/api/http-client';
import { AUTH_SURFACE_CLASS, BRAND_HOME_LINK_CLASS } from '@/features/auth/auth-theme';
import { AuthHomeLink } from '@/features/auth/auth-home-link';
import { useAuth } from '@/features/auth/use-auth';
import { partnershipApi } from './partnership-api';
import { EMAIL_HAS_ACCOUNT_MESSAGE, normalizePhone, PARTNERSHIP_DEFAULTS, partnershipSchema, type PartnershipField, type PartnershipValues } from './partnership-schema';

const PAGE_TITLE = 'Hợp tác chủ sân — SmashPro';
const STEPS = [
  { title: 'Gửi yêu cầu', text: 'Điền thông tin liên hệ và cơ sở của bạn.' },
  { title: 'SmashPro liên hệ xác minh', text: 'Chúng tôi gọi điện trong 1–2 ngày làm việc.' },
  { title: 'Nhận email kích hoạt', text: 'Tự đặt mật khẩu bằng mã xác minh và bắt đầu đưa sân lên.' },
];
const FIELDS = new Set<PartnershipField>(Object.keys(PARTNERSHIP_DEFAULTS) as PartnershipField[]);

type View = 'form' | 'success' | 'disabled';

/** Public partnership request at `/hop-tac` (PRD §6.1, §9). Anyone can open it, signed in or not. */
export function PartnershipRequestPage() {
  const { user } = useAuth();
  const [view, setView] = useState<View>('form');
  const [error, setError] = useState<string | null>(null);
  const availability = useQuery({ queryKey: ['owner-requests', 'availability'], queryFn: partnershipApi.availability, retry: false });
  const form = useForm<PartnershipValues>({ resolver: zodResolver(partnershipSchema), defaultValues: PARTNERSHIP_DEFAULTS });
  const { errors, isSubmitting } = form.formState;

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => { document.title = previous; };
  }, []);

  const disabled = view === 'disabled' || availability.data?.data.enabled === false;

  const submit = form.handleSubmit(async values => {
    setError(null);
    try {
      await partnershipApi.submit({
        contactName: values.contactName, email: values.email.toLowerCase(), phone: normalizePhone(values.phone),
        facilityName: values.facilityName, addressLine: values.addressLine, district: values.district, city: values.city,
        expectedCourts: Number(values.expectedCourts), note: values.note || undefined, consent: true, website: values.website,
      });
      setView('success');
      window.scrollTo({ top: 0 });
    } catch (reason) {
      if (!(reason instanceof ApiError)) { setError('Không thể kết nối đến máy chủ. Vui lòng thử lại.'); return; }
      switch (reason.code) {
        case 'OWNER_REQUEST_EMAIL_HAS_ACCOUNT':
          form.setError('email', { message: EMAIL_HAS_ACCOUNT_MESSAGE }, { shouldFocus: true });
          return;
        case 'OWNER_REQUEST_DISABLED':
          setView('disabled');
          return;
        case 'AUTH_RATE_LIMITED':
          setError('Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau.');
          return;
        case 'VALIDATION_FAILED': {
          let mapped = false;
          for (const detail of reason.details) {
            if (detail.field && FIELDS.has(detail.field as PartnershipField)) {
              form.setError(detail.field as PartnershipField, { message: 'Giá trị chưa hợp lệ, vui lòng kiểm tra lại.' }, { shouldFocus: !mapped });
              mapped = true;
            }
          }
          if (!mapped) setError('Vui lòng kiểm tra lại thông tin đã nhập.');
          return;
        }
        default:
          setError('Không thể gửi yêu cầu lúc này. Vui lòng thử lại.');
      }
    }
  });

  return <div data-slot="partnership-page" className={AUTH_SURFACE_CLASS}>
    <div className="mx-auto flex min-h-svh max-w-360 flex-col">
      <header className="flex h-18 shrink-0 items-center justify-between gap-5 min-[50.0625rem]:h-23">
        <Link to="/" aria-label="Về trang giới thiệu SmashPro" className={BRAND_HOME_LINK_CLASS}><BrandLogo compactOnMobile /></Link>
        <AuthHomeLink />
      </header>
      <main className="grid flex-1 items-start gap-6 pb-12 pt-2 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-10">
        <section aria-labelledby="partnership-title" className="lg:sticky lg:top-6">
          <p className="mb-3 text-2xs font-semibold tracking-widest text-primary">DÀNH CHO CHỦ SÂN</p>
          <h1 id="partnership-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Đưa sân của bạn lên SmashPro<span aria-hidden="true" className="text-primary">.</span></h1>
          <p className="mt-3 max-w-120 text-sm leading-6 text-muted-foreground">
            Quản lý lịch đặt, bảng giá theo khung giờ và nhận tiền qua ví. Tài khoản chủ sân do quản trị viên tạo sau khi xác minh yêu cầu hợp tác.
          </p>
          <ol className="mt-6 grid gap-3">
            {STEPS.map((step, index) => <li key={step.title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{index + 1}</span>
              <div><p className="text-sm font-semibold">{step.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{step.text}</p></div>
            </li>)}
          </ol>
        </section>

        <div className="rounded-panel border border-border bg-card px-5 py-7 shadow-panel sm:px-8 sm:py-9">
          {view === 'success' ? <SuccessState /> : disabled ? <DisabledState /> : <>
            <h2 className="text-xl font-bold tracking-tight">Gửi yêu cầu hợp tác</h2>
            <p className="mt-1 text-sm text-muted-foreground">Các ô có dấu * là bắt buộc.</p>
            {user && <Alert variant="default" role="note" className="mt-5">Tài khoản chủ sân dùng email riêng, tách khỏi tài khoản hiện tại của bạn.</Alert>}
            {error && <Alert variant="destructive" role="alert" className="mt-5">{error}</Alert>}
            <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="mt-6 grid gap-5">
              <fieldset className="grid gap-4" disabled={isSubmitting}>
                <legend className="mb-1 text-sm font-bold">Người liên hệ</legend>
                <LabeledInput id="partner-name" label="Họ và tên *" icon={UserRound} autoComplete="name" error={errors.contactName?.message} {...form.register('contactName')} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabeledInput id="partner-email" label="Email *" icon={Mail} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                    placeholder="ban@example.com" error={errors.email?.message} {...form.register('email')} />
                  <LabeledInput id="partner-phone" label="Số điện thoại *" icon={Phone} type="tel" autoComplete="tel" inputMode="tel"
                    placeholder="0901234567" error={errors.phone?.message} {...form.register('phone')} />
                </div>
              </fieldset>
              <fieldset className="grid gap-4" disabled={isSubmitting}>
                <legend className="mb-1 text-sm font-bold">Cơ sở của bạn</legend>
                <LabeledInput id="partner-facility" label="Tên cơ sở *" icon={Store} error={errors.facilityName?.message} {...form.register('facilityName')} />
                <LabeledInput id="partner-address" label="Địa chỉ (số nhà, đường) *" icon={MapPin} autoComplete="street-address" error={errors.addressLine?.message} {...form.register('addressLine')} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <LabeledInput id="partner-district" label="Quận/huyện *" icon={Building2} error={errors.district?.message} {...form.register('district')} />
                  <LabeledInput id="partner-city" label="Tỉnh/thành phố *" icon={LayoutGrid} error={errors.city?.message} {...form.register('city')} />
                </div>
                <LabeledInput id="partner-courts" label="Số sân dự kiến *" icon={Hash} type="number" inputMode="numeric" min={1} max={50}
                  error={errors.expectedCourts?.message} {...form.register('expectedCourts')} />
                <div className="space-y-2">
                  <Label htmlFor="partner-note" className="text-xs font-semibold">Ghi chú</Label>
                  <Textarea id="partner-note" rows={4} maxLength={1000} placeholder="Giờ mở cửa, loại mặt sân, điều bạn muốn trao đổi…"
                    aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? 'partner-note-error' : undefined} {...form.register('note')} />
                  {errors.note && <p id="partner-note-error" className="text-sm text-destructive">{errors.note.message}</p>}
                </div>
              </fieldset>
              {/* Hidden bot field: off-screen, skipped by keyboard and screen readers. */}
              <div aria-hidden="true" className="absolute -left-2500 size-px overflow-hidden">
                <label htmlFor="partner-website">Website</label>
                <input id="partner-website" type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
              </div>
              <div className="space-y-2">
                <label htmlFor="partner-consent" className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6">
                  <input id="partner-consent" type="checkbox" className="mt-1 size-4.5 shrink-0 accent-primary" disabled={isSubmitting}
                    aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'partner-consent-error' : undefined} {...form.register('consent')} />
                  <span>Tôi đồng ý để SmashPro liên hệ qua email và số điện thoại trên. *</span>
                </label>
                {errors.consent && <p id="partner-consent-error" className="text-sm text-destructive">{errors.consent.message}</p>}
              </div>
              <Button type="submit" variant="brand" size="comfortable" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full">
                {isSubmitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang gửi…</span></> : <><Send aria-hidden="true" />Gửi yêu cầu hợp tác</>}
              </Button>
            </form>
          </>}
        </div>
      </main>
    </div>
  </div>;
}

function SuccessState() {
  return <div role="status" className="flex flex-col items-start gap-4 py-4">
    <span aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-success-bg text-success"><CircleCheck className="size-6" /></span>
    <h2 className="text-2xl font-bold tracking-tight">Đã nhận yêu cầu</h2>
    <p className="text-sm leading-6 text-muted-foreground">SmashPro sẽ liên hệ với bạn trong 1–2 ngày làm việc. Chúng tôi cũng đã gửi email xác nhận tới hộp thư của bạn.</p>
    <Button asChild variant="outline"><Link to="/">Về trang chủ</Link></Button>
  </div>;
}

function DisabledState() {
  return <div role="status" className="flex flex-col items-start gap-4 py-4">
    <h2 className="text-2xl font-bold tracking-tight">Tạm ngừng nhận yêu cầu</h2>
    <p className="text-sm leading-6 text-muted-foreground">Hiện SmashPro tạm ngừng nhận yêu cầu hợp tác. Vui lòng quay lại sau.</p>
    <Button asChild variant="outline"><Link to="/">Về trang chủ</Link></Button>
  </div>;
}
