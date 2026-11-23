import type { PointerEvent, ReactNode, Ref } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BadgeCheck, CalendarDays, ChevronRight, ClipboardList, Mail, MessagesSquare, Store, Target, Trophy, UsersRound, type LucideIcon } from 'lucide-react';
import { m, type Variants } from 'motion/react';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/utils/cn';
import { CONTAINER, EASE, FOCUS_ON_DARK, goToSection, LIGHT_TEXT_LINK, LIME_CTA, NUDGE_ICON, reveal, SECTION_TARGET } from './landing-ui';

export function SectionHead({ eyebrow, id, children, reduce, className }:
  { eyebrow: string; id: string; children: ReactNode; reduce: boolean; className?: string }) {
  return <m.header {...reveal(reduce)} className={cn('mx-auto mb-8 max-w-170 text-center min-[45.0625rem]:mb-12', className)}>
    <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
    <h2 id={id} className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">{children}</h2>
  </m.header>;
}

const FEATURES: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: Target, title: 'Tìm kèo đúng trình độ', text: 'Đăng tin tìm người, xem ai đang thiếu người và ứng tuyển vào kèo hợp với bậc của bạn.' },
  { Icon: CalendarDays, title: 'Đặt sân, trả bằng ví', text: 'Chọn sân và khung giờ còn trống, thanh toán bằng ví SmashPro và chia tiền sân với cả nhóm.' },
  { Icon: MessagesSquare, title: 'Bảng tin & nhắn tin', text: 'Chia sẻ khoảnh khắc trên sân, trò chuyện riêng hoặc trong nhóm kèo để hẹn lịch dễ dàng.' },
  { Icon: Trophy, title: 'Giải đấu chuyên nghiệp', text: 'Theo dõi và tham gia giải đấu; kết quả giải là cơ sở chính thức để nâng bậc trình độ.' },
];

/** Four feature cards; a soft spotlight follows a fine pointer. */
export function FeaturesSection({ reduce }: { reduce: boolean }) {
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const spotlight = (event: PointerEvent<HTMLElement>) => {
    if (reduce || !finePointer) return;
    const card = event.currentTarget;
    const box = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - box.left}px`);
    card.style.setProperty('--my', `${event.clientY - box.top}px`);
  };
  return <section id="features" tabIndex={-1} aria-labelledby="features-title" className={cn(SECTION_TARGET, 'py-16 min-[45.0625rem]:py-24')}>
    <div className={CONTAINER}>
      <SectionHead id="features-title" eyebrow="Một tài khoản, đủ cho cả buổi chơi" reduce={reduce}>
        Mọi thứ để bạn <span className="text-primary">ra sân</span> nhanh hơn
      </SectionHead>
      <div className="grid gap-4.5 min-[45.0625rem]:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ Icon, title, text }, index) => <m.article key={title} {...reveal(reduce, index)} onPointerMove={spotlight}
          className={cn('group relative overflow-hidden rounded-2xl border border-border bg-card px-5.5 py-6.5 shadow-panel',
            'motion-safe:transition-[translate,box-shadow,border-color] motion-safe:duration-300 hover:border-primary/25 hover:shadow-lg motion-safe:hover:-translate-y-1.5',
            'before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(260px_circle_at_var(--mx,50%)_var(--my,0%),color-mix(in_srgb,var(--color-brand-lime-deep)_22%,transparent),transparent_60%)] before:opacity-0 before:transition-opacity hover:before:opacity-100')}>
          <span className="relative grid size-12 place-items-center rounded-lg bg-primary/8 text-primary motion-safe:transition-[background-color,color,rotate,scale] motion-safe:duration-300 group-hover:bg-primary group-hover:text-brand-lime motion-safe:group-hover:-rotate-8 motion-safe:group-hover:scale-105">
            <Icon aria-hidden="true" className="size-5.5" />
          </span>
          <h3 className="relative mt-4.5 text-lg font-bold tracking-tight">{title}</h3>
          <p className="relative mt-2 text-sm leading-6.5 text-muted-foreground">{text}</p>
        </m.article>)}
      </div>
    </div>
  </section>;
}

const STEPS: { Icon: LucideIcon; title: string; text: string }[] = [
  { Icon: ClipboardList, title: 'Khảo sát trình độ', text: '16 câu về thời gian chơi, kỹ thuật, thể lực và thành tích. Khoảng 3 phút.' },
  { Icon: BadgeCheck, title: 'Nhận bậc của bạn', text: 'Hệ thống xếp bạn vào 1 trong 7 bậc, kèm điểm mạnh và điểm nên cải thiện.' },
  { Icon: UsersRound, title: 'Ra sân cùng nhau', text: 'Tìm kèo hợp trình độ, đặt sân và giữ liên lạc với những người bạn mới.' },
];
const stepVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  play: (index: number) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: index * 0.38, ease: EASE } }),
};
const stepIconVariants: Variants = {
  hidden: { scale: 0.6 },
  play: (index: number) => ({ scale: 1, transition: { type: 'spring', stiffness: 320, damping: 14, delay: index * 0.38 } }),
};
const lineVariants: Variants = { hidden: { scaleX: 0 }, play: { scaleX: 1, transition: { duration: 1.1, ease: EASE } } };

/** Three steps; the connector draws itself and the icons pop in order. */
export function StepsSection({ reduce }: { reduce: boolean }) {
  const play = reduce ? {} : { initial: 'hidden', whileInView: 'play', viewport: { once: true, amount: 0.35 } };
  return <section id="how" tabIndex={-1} aria-labelledby="how-title" className={cn(SECTION_TARGET, 'border-y border-border bg-muted py-16 min-[45.0625rem]:py-24')}>
    <div className={CONTAINER}>
      <SectionHead id="how-title" eyebrow="Bắt đầu trong 3 bước" reduce={reduce}>
        Từ người lạ đến <span className="text-primary">đồng đội</span>
      </SectionHead>
      <m.div {...play} className="relative">
        <span aria-hidden="true" className="absolute inset-x-[16%] top-8.5 h-0.5 bg-border max-[45rem]:hidden" />
        <m.span aria-hidden="true" variants={lineVariants} className="absolute inset-x-[16%] top-8.5 h-0.5 origin-left bg-linear-90 from-primary to-brand-lime-deep max-[45rem]:hidden" />
        <ol className="relative grid gap-8 min-[45.0625rem]:grid-cols-3 min-[45.0625rem]:gap-6">
        {STEPS.map(({ Icon, title, text }, index) => <m.li key={title} custom={index} variants={stepVariants} className="relative px-3 text-center">
          <m.span custom={index} variants={stepIconVariants} className="relative mx-auto grid size-17 place-items-center rounded-full border-2 border-primary bg-card text-primary ring-8 ring-primary/7">
            <Icon aria-hidden="true" className="size-6.5" />
            <span aria-hidden="true" className="absolute -right-1.5 -top-1.5 grid size-6 place-items-center rounded-full bg-brand-lime text-xs font-extrabold text-brand-forest">{index + 1}</span>
          </m.span>
          <h3 className="mt-5.5 text-lg font-bold">{title}</h3>
          <p className="mx-auto mt-2 max-w-72 text-sm leading-6.5 text-muted-foreground">{text}</p>
        </m.li>)}
        </ol>
      </m.div>
    </div>
  </section>;
}

/** Court-owner band. The partnership contact channel is still [TBD] (Auth PRD): no link, never an invented address. */
export function OwnersSection({ reduce }: { reduce: boolean }) {
  return <section id="owners" tabIndex={-1} aria-labelledby="owners-title" className={cn(SECTION_TARGET, 'pb-16 pt-4 min-[45.0625rem]:pb-24')}>
    <div className={CONTAINER}>
      <m.div {...reveal(reduce)} className="grid items-center gap-6 rounded-panel border border-border bg-linear-120 from-card to-soft p-6 shadow-panel min-[45.0625rem]:grid-cols-[auto_1fr_auto] min-[45.0625rem]:px-8 min-[45.0625rem]:py-7">
        <span aria-hidden="true" className="grid size-14 place-items-center rounded-2xl bg-primary/8 text-primary"><Store className="size-6.5" /></span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Dành cho chủ sân</p>
          <h2 id="owners-title" className="mt-1.5 text-2xl font-extrabold tracking-tight">Đưa sân của bạn lên SmashPro</h2>
          <p className="mt-1.5 max-w-176 text-sm leading-6 text-muted-foreground">
            Quản lý lịch đặt, bảng giá theo khung giờ và nhận tiền qua ví. Tài khoản chủ sân được quản trị viên tạo sau khi liên hệ hợp tác.
          </p>
        </div>
        <p data-slot="owner-contact" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground min-[45.0625rem]:justify-self-end">
          <Mail aria-hidden="true" className="size-4.5 text-primary" />Liên hệ quản trị viên
        </p>
      </m.div>
    </div>
  </section>;
}

/** Full-bleed closing call to action with the same two actions as the hero. */
export function ClosingCta({ ctaRef, reduce }: { ctaRef: Ref<HTMLAnchorElement>; reduce: boolean }) {
  return <section aria-labelledby="cta-title" className="pt-10">
    <div className="relative isolate overflow-hidden px-4 py-18 text-center text-white min-[45.0625rem]:py-26">
      <div aria-hidden="true" className="absolute inset-0 -z-1 bg-linear-145 from-brand-fern to-brand-forest to-70%">
        <span className="absolute -bottom-[55%] left-1/2 h-90 w-160 max-w-full -translate-x-1/2 rounded-full bg-brand-lime-deep/40 opacity-55 blur-3xl" />
      </div>
      <m.div {...reveal(reduce)}>
        <h2 id="cta-title" className="text-balance text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">Sẵn sàng <span className="text-brand-lime">ra sân?</span></h2>
        <p className="mx-auto mt-3.5 max-w-128 text-base text-brand-mint">Tạo tài khoản miễn phí và biết trình độ của bạn sau khoảng 3 phút.</p>
        <div className="mx-auto mt-7 flex max-w-330 flex-wrap items-center justify-center gap-x-4.5 gap-y-3">
          <Link ref={ctaRef} to="/register" className={cn(LIME_CTA, 'max-[45rem]:w-full')}>
            Khám phá trình độ – 3 phút<ArrowRight aria-hidden="true" className={NUDGE_ICON} />
          </Link>
          <Link to="/sign-in" className={cn(LIGHT_TEXT_LINK, 'max-[45rem]:w-full')}>
            Tôi đã có tài khoản<ChevronRight aria-hidden="true" className={NUDGE_ICON} />
          </Link>
        </div>
      </m.div>
    </div>
  </section>;
}

const FOOTER_LINK = `inline-flex min-h-11 items-center rounded-md px-2.5 hover:text-brand-lime motion-safe:transition-colors ${FOCUS_ON_DARK}`;

export function LandingFooter({ reduce }: { reduce: boolean }) {
  return <footer className="bg-brand-forest pb-10 pt-6 text-sm text-brand-mint max-[45rem]:pb-24">
    <div className={cn(CONTAINER, 'flex flex-wrap items-center justify-between gap-3')}>
      <p>SmashPro <span aria-hidden="true" className="px-2 opacity-50">/</span> Cộng đồng cầu lông</p>
      <nav aria-label="Liên kết cuối trang" className="flex flex-wrap gap-1">
        <Link to="/sign-in" className={FOOTER_LINK}>Đăng nhập</Link>
        <Link to="/register" className={FOOTER_LINK}>Tạo tài khoản</Link>
        <a href="#owners" onClick={event => { event.preventDefault(); goToSection('owners', reduce); }} className={FOOTER_LINK}>Hợp tác chủ sân</a>
      </nav>
    </div>
  </footer>;
}
