import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { Building2, CalendarDays, CircleCheck, Hash, LayoutGrid, LoaderCircle, Mail, MapPin, Phone, Send, Store, Tags, UserRound, Wallet } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import courtScene from '@/assets/illustrations/badminton-court.svg';
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
  { title: 'Gửi yêu cầu', text: 'Thông tin liên hệ và cơ sở của bạn.' },
  { title: 'SmashPro liên hệ xác minh', text: 'Chúng tôi gọi điện trong 1–2 ngày làm việc.' },
  { title: 'Nhận email kích hoạt', text: 'Tự đặt mật khẩu bằng mã xác minh rồi đưa sân lên.' },
];
const BENEFITS = [
  { Icon: CalendarDays, text: 'Quản lý lịch đặt sân theo thời gian thực' },
  { Icon: Tags, text: 'Bảng giá linh hoạt theo khung giờ' },
  { Icon: Wallet, text: 'Nhận tiền đặt sân thẳng vào ví' },
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
    <div className="mx-auto max-w-360">
      <header className="flex h-18 items-center justify-between gap-5 min-[50.0625rem]:h-23">
        <Link to="/" aria-label="Về trang giới thiệu SmashPro" className={BRAND_HOME_LINK_CLASS}><BrandLogo compactOnMobile /></Link>
        <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span aria-hidden="true" className="size-1 rounded-full bg-primary" />Hợp tác chủ sân
        </p>
        <AuthHomeLink />
      </header>
      <div className="grid overflow-hidden rounded-panel border border-border bg-card shadow-panel lg:min-h-[max(45rem,calc(100svh-10.5rem))] lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <PartnershipHero />
        <main className="relative flex min-w-0 items-center overflow-hidden px-5 py-7 sm:px-9 sm:py-9 xl:px-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border border-primary/5 ring-28 ring-primary/2" />
          <div className="relative mx-auto w-full max-w-190">
            {view === 'success' ? <SuccessState /> : disabled ? <DisabledState /> : <>
              <h2 className="text-xl font-bold tracking-tight">Gửi yêu cầu hợp tác</h2>
              <p className="mt-1 text-sm text-muted-foreground">Mất khoảng 2 phút. Các ô có dấu * là bắt buộc.</p>
              {user && <Alert variant="default" role="note" className="mt-5">Tài khoản chủ sân dùng email riêng, tách khỏi tài khoản hiện tại của bạn.</Alert>}
              {error && <Alert variant="destructive" role="alert" className="mt-5">{error}</Alert>}
              <form onSubmit={submit} noValidate aria-busy={isSubmitting} className="mt-5 grid gap-5">
                <fieldset className="grid gap-3.5" disabled={isSubmitting}>
                  <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Người liên hệ</legend>
                  <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_0.9fr]">
                    <div className="sm:col-span-2 xl:col-span-1">
                      <LabeledInput id="partner-name" label="Họ và tên *" icon={UserRound} autoComplete="name" error={errors.contactName?.message} {...form.register('contactName')} />
                    </div>
                    <LabeledInput id="partner-email" label="Email *" icon={Mail} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                      placeholder="ban@example.com" error={errors.email?.message} {...form.register('email')} />
                    <LabeledInput id="partner-phone" label="Số điện thoại *" icon={Phone} type="tel" autoComplete="tel" inputMode="tel"
                      placeholder="0901234567" error={errors.phone?.message} {...form.register('phone')} />
                  </div>
                </fieldset>
                <fieldset className="grid gap-3.5" disabled={isSubmitting}>
                  <legend className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Cơ sở của bạn</legend>
                  <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_9.5rem]">
                    <LabeledInput id="partner-facility" label="Tên cơ sở *" icon={Store} placeholder="Sân cầu lông …" error={errors.facilityName?.message} {...form.register('facilityName')} />
                    <LabeledInput id="partner-courts" label="Số sân dự kiến *" icon={Hash} type="number" inputMode="numeric" min={1} max={50}
                      placeholder="6" error={errors.expectedCourts?.message} {...form.register('expectedCourts')} />
                  </div>
                  <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-[1.6fr_1fr_1fr]">
                    <div className="sm:col-span-2 xl:col-span-1">
                      <LabeledInput id="partner-address" label="Địa chỉ (số nhà, đường) *" icon={MapPin} autoComplete="street-address" error={errors.addressLine?.message} {...form.register('addressLine')} />
                    </div>
                    <LabeledInput id="partner-district" label="Quận/huyện *" icon={Building2} error={errors.district?.message} {...form.register('district')} />
                    <LabeledInput id="partner-city" label="Tỉnh/thành phố *" icon={LayoutGrid} placeholder="Hồ Chí Minh" error={errors.city?.message} {...form.register('city')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="partner-note" className="text-xs font-semibold">Ghi chú <span className="font-normal text-muted-foreground">(không bắt buộc)</span></Label>
                    <Textarea id="partner-note" rows={2} maxLength={1000} placeholder="Giờ mở cửa, loại mặt sân, điều bạn muốn trao đổi…"
                      aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? 'partner-note-error' : undefined} {...form.register('note')} />
                    {errors.note && <p id="partner-note-error" className="text-sm text-destructive">{errors.note.message}</p>}
                  </div>
                </fieldset>
                {/* Hidden bot field: off-screen, skipped by keyboard and screen readers. */}
                <div aria-hidden="true" className="absolute -left-2500 size-px overflow-hidden">
                  <label htmlFor="partner-website">Website</label>
                  <input id="partner-website" type="text" tabIndex={-1} autoComplete="off" {...form.register('website')} />
                </div>
                <div className="flex flex-col gap-3 border-t border-border pt-5 md:flex-row md:items-center md:justify-between md:gap-6">
                  <div className="space-y-1">
                    <label htmlFor="partner-consent" className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-6">
                      <input id="partner-consent" type="checkbox" className="mt-1 size-4.5 shrink-0 accent-primary" disabled={isSubmitting}
                        aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? 'partner-consent-error' : undefined} {...form.register('consent')} />
                      <span>Tôi đồng ý để SmashPro liên hệ qua email và số điện thoại trên. *</span>
                    </label>
                    {errors.consent && <p id="partner-consent-error" className="text-sm text-destructive">{errors.consent.message}</p>}
                  </div>
                  <Button type="submit" variant="brand" size="comfortable" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full shrink-0 md:w-auto md:px-7">
                    {isSubmitting ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang gửi…</span></> : <><Send aria-hidden="true" />Gửi yêu cầu</>}
                  </Button>
                </div>
              </form>
            </>}
          </div>
        </main>
      </div>
      <footer className="px-1 py-5 text-xs text-muted-foreground">
        <p>SmashPro <span aria-hidden="true" className="px-2 opacity-50">/</span> Cộng đồng cầu lông</p>
      </footer>
    </div>
  </div>;
}

/** Forest brand panel (same surface as the sign-in hero): pitch, benefits, the three steps and the court art. */
function PartnershipHero() {
  return <section aria-labelledby="partnership-title" className="relative isolate overflow-hidden bg-brand-forest px-6 py-7 text-white sm:px-9 sm:py-9 lg:flex lg:flex-col xl:px-11 xl:py-11">
    <div aria-hidden="true" className="absolute inset-0 -z-2 bg-[radial-gradient(ellipse_at_45%_62%,var(--color-brand-glow),transparent_60%),linear-gradient(145deg,var(--color-brand-moss),var(--color-brand-forest-deep)_75%)]" />
    <div aria-hidden="true" className="absolute inset-0 -z-1 bg-[radial-gradient(var(--color-brand-grid)_0.7px,transparent_0.7px)] bg-size-[13px_13px] opacity-70" />
    <img src={courtScene} alt="" aria-hidden="true" width={720} height={480} draggable={false}
      className="pointer-events-none absolute -bottom-6 -right-16 -z-1 hidden w-[115%] max-w-none opacity-25 min-[90rem]:block" />
    <p className="flex items-center gap-2 text-2xs font-semibold tracking-[0.18em] text-brand-mint">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-brand-lime" />DÀNH CHO CHỦ SÂN
    </p>
    <h1 id="partnership-title" className="mt-4 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl xl:text-5xl">
      Đưa sân của bạn lên <span className="text-brand-lime">SmashPro.</span>
    </h1>
    <p className="mt-4 max-w-110 text-sm leading-6 text-brand-mint lg:text-base lg:leading-7">
      Người chơi tìm sân, đặt giờ và ghép kèo ngay trên SmashPro. Bạn lo sân, phần lịch đặt và thanh toán để SmashPro lo.
    </p>
    <ul className="mt-5 grid gap-2.5 pb-8 text-sm text-white/90 lg:pb-10">
      {BENEFITS.map(({ Icon, text }) => <li key={text} className="flex items-center gap-2.5">
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-lime/12 text-brand-lime"><Icon className="size-4" /></span>{text}
      </li>)}
    </ul>
    <ol className="relative hidden gap-4 rounded-2xl border border-white/10 bg-brand-forest-deep/55 p-5 backdrop-blur-sm lg:mt-auto lg:grid">
      {STEPS.map((step, index) => <li key={step.title} className="flex gap-3.5">
        <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-lime text-xs font-extrabold text-brand-forest">{index + 1}</span>
        <div><p className="text-sm font-semibold">{step.title}</p><p className="mt-0.5 text-sm leading-5.5 text-brand-mint">{step.text}</p></div>
      </li>)}
    </ol>
  </section>;
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
