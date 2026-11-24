import { useEffect, useState, type Ref } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Clock, MapPin, Plus, Trophy } from 'lucide-react';
import { AnimatePresence, m } from 'motion/react';
import courtScene from '@/assets/illustrations/badminton-court.svg';
import { usePointerParallax } from '@/shared/hooks/use-pointer-parallax';
import { cn } from '@/shared/utils/cn';
import { CONTAINER, EASE, LIGHT_TEXT_LINK, LIME_CTA, NUDGE_ICON, SECTION_TARGET } from './landing-ui';

interface LandingHeroProps {
  sectionRef: Ref<HTMLElement>;
  /** The primary call to action; the mobile action bar appears once it leaves the viewport. */
  ctaRef: Ref<HTMLAnchorElement>;
  reduce: boolean;
}

/** Full-bleed forest hero under the fixed header: value proposition, the two actions and the decorative art. */
export function LandingHero({ sectionRef, ctaRef, reduce }: LandingHeroProps) {
  const { style, onPointerMove, onPointerLeave } = usePointerParallax();
  // Staggered entrance (prototype timing, a documented landing exception); final state at once under reduced motion.
  const enter = (order: number) => reduce ? {} : {
    initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 },
    transition: { duration: 0.64, delay: 0.12 + order * 0.09, ease: EASE },
  };

  return <section ref={sectionRef} id="top" tabIndex={-1} aria-labelledby="hero-title" onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}
    className={cn(SECTION_TARGET, 'relative isolate flex min-h-[min(700px,100svh)] items-center overflow-hidden pb-10 pt-24 text-white lg:pb-18 lg:pt-30')}>
    <div aria-hidden="true" className="absolute inset-0 -z-1 bg-[radial-gradient(var(--color-brand-grid)_0.7px,transparent_0.7px),linear-gradient(145deg,var(--color-brand-fern),var(--color-brand-forest)_72%)] bg-size-[13px_13px,auto]">
      <span className="absolute right-[8%] top-[18%] size-130 rounded-full bg-brand-lime-deep/35 opacity-55 blur-3xl motion-safe:animate-drift" />
      <span className="absolute -bottom-1/5 -left-[6%] size-105 rounded-full bg-brand-fern/90 opacity-55 blur-3xl motion-safe:animate-drift-slow" />
    </div>
    <div className={cn(CONTAINER, 'grid items-center gap-6 lg:grid-cols-[1.02fr_1fr] lg:gap-10')}>
      <div>
        <m.p {...enter(0)} className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-brand-mint">
          <span aria-hidden="true" className="size-1.75 rounded-full bg-brand-lime motion-safe:animate-beacon" />Cộng đồng cầu lông SmashPro
        </m.p>
        <h1 id="hero-title" className="mt-4.5 text-5xl font-extrabold leading-[1.04] tracking-tighter sm:text-6xl xl:text-7xl">
          <m.span {...enter(1)} className="block">Hẹn nhau</m.span>{' '}
          <m.span {...enter(2)} className="block">trên <span className="text-brand-lime">sân.</span></m.span>
        </h1>
        <m.p {...enter(3)} className="mt-5.5 max-w-120 text-base leading-7 text-brand-mint lg:text-lg lg:leading-8">
          Tìm bạn chơi đúng trình độ, đặt sân yêu thích và giữ kết nối sau mỗi trận. Bắt đầu bằng một khảo sát ngắn để biết bạn đang ở bậc nào.
        </m.p>
        <m.div {...enter(4)} className="mt-7.5 flex flex-wrap items-center gap-x-4.5 gap-y-3 max-[45rem]:justify-center">
          <Link ref={ctaRef} to="/register" className={cn(LIME_CTA, 'max-[45rem]:w-full')}>
            Khám phá trình độ – 3 phút<ArrowRight aria-hidden="true" className={NUDGE_ICON} />
          </Link>
          <Link to="/sign-in" className={cn(LIGHT_TEXT_LINK, 'max-[45rem]:w-full')}>
            Tôi đã có tài khoản<ChevronRight aria-hidden="true" className={NUDGE_ICON} />
          </Link>
        </m.div>
        <m.p {...enter(5)} className="mt-4.5 text-sm text-brand-mint/90 max-[45rem]:text-center">
          16 câu chọn nhanh, không có câu sai <span aria-hidden="true">→</span> tạo tài khoản miễn phí ở bước cuối.
        </m.p>
      </div>
      <HeroArt reduce={reduce} parallax={style} />
    </div>
  </section>;
}

function HeroArt({ reduce, parallax }: { reduce: boolean; parallax: ReturnType<typeof usePointerParallax>['style'] }) {
  const entrance = reduce ? {} : {
    initial: { opacity: 0, scale: 0.94, y: 14 }, animate: { opacity: 1, scale: 1, y: 0 },
    transition: { duration: 0.9, delay: 0.3, ease: EASE },
  };
  return <m.div {...entrance} aria-hidden="true" data-slot="hero-art"
    className="relative mx-auto h-82 w-full max-w-155 min-[45.0625rem]:h-100 lg:h-115 lg:max-w-none">
    <div className="absolute inset-x-[4%] inset-y-[12%] -rotate-18 rounded-[50%] border border-brand-lime/15 ring-26 ring-brand-lime/3" />
    <m.img src={courtScene} alt="" width={720} height={480} draggable={false} style={parallax}
      className="absolute -top-[4%] left-[6%] h-[94%] w-[88%] object-contain" />
    <svg viewBox="0 0 520 300" preserveAspectRatio="none" className="pointer-events-none absolute left-[4%] top-[2%] h-[62%] w-[92%] overflow-visible">
      <path id="landing-flight-path" d="M30 250 Q260 -40 490 210" fill="none" strokeWidth="1.5" strokeDasharray="4 7" className="stroke-brand-lime/35" />
      {/* The flying shuttle (SMIL) is only rendered when motion is allowed. */}
      {!reduce && <g data-slot="flight-shuttle">
        <circle r="6" className="fill-white" />
        <path d="M-4 -3 L-13 -9 M-4 3 L-13 9 M-6 0 L-16 0" strokeWidth="1.6" strokeLinecap="round" className="stroke-white" />
        <animateMotion dur="2.8s" repeatCount="indefinite" rotate="auto"><mpath href="#landing-flight-path" /></animateMotion>
      </g>}
    </svg>
    <div className="absolute right-[2%] top-0 inline-flex rotate-4 items-center gap-2 rounded-lg bg-brand-lime px-3.5 py-2.5 text-sm font-bold text-brand-forest shadow-lg motion-safe:animate-float lg:top-[2%]">
      <Trophy className="size-4" />7 bậc trình độ
    </div>
    <MatchCard reduce={reduce} />
  </m.div>;
}

const FILLED_SLOTS = [
  { initial: 'N', tone: 'bg-primary', delay: 1.3 },
  { initial: 'H', tone: 'bg-brand-fern', delay: 1.45 },
  { initial: 'T', tone: 'bg-brand-forest', delay: 1.6 },
];
const SLOT = 'grid size-8 place-items-center rounded-full border-2 border-white text-xs font-extrabold -mr-2';

/** Illustrative sample card (not real users or matches): the open slot fills, then resets. Static under reduced motion. */
function MatchCard({ reduce }: { reduce: boolean }) {
  const [full, setFull] = useState(false);
  // Only the first appearance of the open slot waits for the avatars; later resets pop in at once.
  const [cycled, setCycled] = useState(false);
  useEffect(() => {
    if (reduce) return;
    let interval = 0;
    let refill = 0;
    const start = window.setTimeout(() => {
      setFull(true);
      setCycled(true);
      interval = window.setInterval(() => {
        setFull(false);
        refill = window.setTimeout(() => setFull(true), 2600);
      }, 7000);
    }, 4200);
    return () => { window.clearTimeout(start); window.clearInterval(interval); window.clearTimeout(refill); };
  }, [reduce]);
  const shown = full && !reduce;
  const pop = (delay: number) => reduce ? {} : {
    initial: { opacity: 0, scale: 0.3 }, animate: { opacity: 1, scale: 1 },
    transition: { type: 'spring' as const, stiffness: 420, damping: 18, delay },
  };
  const status = shown ? 'Đủ người ✓' : 'Còn 1 chỗ';

  return <m.div data-slot="match-card" data-state={shown ? 'full' : 'open'}
    {...(reduce ? {} : { initial: { opacity: 0, y: 26, scale: 0.92 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: 'spring', stiffness: 260, damping: 20, delay: 0.9 } })}
    className="absolute bottom-0 left-0 w-75 rounded-2xl bg-white/97 p-4 text-foreground shadow-2xl motion-safe:animate-float-late max-[45rem]:inset-x-0 max-[45rem]:mx-auto max-[45rem]:w-66 max-[45rem]:p-3.5">
    <div className="flex items-center justify-between">
      <span className="text-2xs font-extrabold uppercase tracking-widest text-primary">Tìm kèo</span>
      <span className="rounded-full bg-primary/8 px-2.5 py-0.5 text-xs font-bold text-primary">Trung bình</span>
    </div>
    <p className="mt-2 text-base font-extrabold tracking-tight">Đánh đôi giao lưu tối thứ 7</p>
    <p className="mt-1 flex items-center gap-1.25 text-xs text-muted-foreground">
      <Clock className="size-3.25" />19:00 – 21:00<span className="px-0.5">·</span><MapPin className="size-3.25" />Sân gần bạn
    </p>
    <div className="mt-3.5 flex items-center justify-between">
      <div className="flex">
        {FILLED_SLOTS.map(slot => <m.span key={slot.initial} {...pop(slot.delay)} className={cn(SLOT, slot.tone, 'text-white')}>{slot.initial}</m.span>)}
        <m.span key={shown ? 'full' : 'open'} {...pop(shown || cycled ? 0 : 1.75)}
          className={cn(SLOT, shown ? 'bg-brand-lime text-brand-forest' : 'border-dashed border-brand-lime-deep bg-muted text-primary motion-safe:animate-beckon')}>
          <Plus className="size-3.5" strokeWidth={3} />
        </m.span>
      </div>
      <span data-slot="match-status" className={cn('inline-flex items-center gap-1.5 text-xs font-bold', shown ? 'text-primary' : 'text-caution')}>
        <span className="size-1.75 rounded-full bg-current" />
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span key={status} className="inline-block" {...(reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3, ease: EASE } })}>
            {status}
          </m.span>
        </AnimatePresence>
      </span>
    </div>
  </m.div>;
}
