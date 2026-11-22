import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, RotateCw } from 'lucide-react';
import { AnimatePresence, m, useInView, type Variants } from 'motion/react';
import { RadioGroup as RadioPrimitive } from 'radix-ui';
import { buttonVariants } from '@/components/ui/button-variants';
import { Skeleton } from '@/components/ui/skeleton';
import type { SkillLevel } from '@/features/auth/auth-api';
import { skillLevelsQuery } from '@/features/auth/register/register-queries';
import { cn } from '@/shared/utils/cn';
import { CONTAINER, EASE, FOCUS_ON_LIGHT, NUDGE_ICON, reveal, SECTION_TARGET } from './landing-ui';

/** Placeholder rungs while the catalog is loading or unavailable; presentation only, no level data. */
const PLACEHOLDER_RUNGS = 7;
/** The level shown first and where the one-time demo stops (the middle of the seven-level ladder). */
const DEMO_LAST_INDEX = 3;
const DEMO_STEP_MS = 520;

const rungHeight = (index: number, count: number) => ({ height: `${28 + (count > 1 ? index * 63 / (count - 1) : 63)}%` });

/** Seven-level ladder: names and descriptions come only from `GET /api/v1/skill-levels` (matrix §1.2). */
export function LevelsSection({ reduce }: { reduce: boolean }) {
  const levels = useQuery(skillLevelsQuery);
  return <section id="levels" tabIndex={-1} aria-labelledby="levels-title" className={cn(SECTION_TARGET, 'py-16 min-[45.0625rem]:py-24')}>
    <div className={cn(CONTAINER, 'grid items-center gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-14')}>
      <m.div {...reveal(reduce)}>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Thang 7 bậc</p>
        <h2 id="levels-title" className="mt-3 text-balance text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">Bạn đang ở <span className="text-primary">bậc nào?</span></h2>
        <p className="mt-4 text-base leading-7 text-muted-foreground">
          Thang trình độ dùng chung cho tìm kèo và giải đấu, đặt theo cách gọi quen thuộc của cộng đồng cầu lông phong trào. Chọn một bậc để xem mô tả.
        </p>
        <Link to="/register" className={cn(buttonVariants({ size: 'comfortable' }), 'group mt-7 px-6 text-base font-bold')}>
          Làm khảo sát ngay<ArrowRight aria-hidden="true" className={NUDGE_ICON} />
        </Link>
        <p className="mt-4 max-w-120 text-xs leading-5 text-muted-foreground">
          Bậc từ khảo sát là mức tự đánh giá ban đầu, mang tính tạm thời; được điều chỉnh chính thức qua giải đấu chuyên nghiệp.
        </p>
      </m.div>
      <m.div {...reveal(reduce, 1)} data-slot="ladder-card" className="rounded-panel border border-border bg-card p-4.5 shadow-panel min-[45.0625rem]:p-7">
        {levels.data && levels.data.length > 0
          ? <Ladder levels={levels.data} reduce={reduce} />
          : <LadderPlaceholder failed={levels.isError || (levels.isSuccess && levels.data.length === 0)} retrying={levels.isFetching} onRetry={() => void levels.refetch()} />}
      </m.div>
    </div>
  </section>;
}

const rungVariants: Variants = {
  hidden: { scaleY: 0.12, opacity: 0 },
  shown: (index: number) => ({ scaleY: 1, opacity: 1, transition: { duration: 0.7, delay: index * 0.07, ease: EASE } }),
};

function Ladder({ levels, reduce }: { levels: SkillLevel[]; reduce: boolean }) {
  const groupRef = useRef<HTMLDivElement>(null);
  const inView = useInView(groupRef, { once: true, amount: 0.4 });
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const touched = useRef(false);
  const fallback = levels[Math.min(DEMO_LAST_INDEX, levels.length - 1)];
  const selected = levels.find(level => level.code === selectedCode) ?? fallback;

  // One-time demo 1 → 4 when the ladder scrolls into view; any pointer or focus on it hands control to the visitor.
  useEffect(() => {
    if (reduce || !inView || touched.current) return;
    let step = 0;
    const demo = window.setInterval(() => {
      if (touched.current || step > Math.min(DEMO_LAST_INDEX, levels.length - 1)) { window.clearInterval(demo); return; }
      setSelectedCode(levels[step].code);
      step += 1;
    }, DEMO_STEP_MS);
    return () => window.clearInterval(demo);
  }, [reduce, inView, levels]);

  const takeOver = () => { touched.current = true; };
  // Radix moves focus (roving tabindex) and selects on arrows only after its deferred focus; select here as well,
  // so arrows and Home/End always select the level that receives focus.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const from = levels.findIndex(level => level.code === (event.target as HTMLElement).getAttribute('value'));
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    let next: number | null = null;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = levels.length - 1;
    else if (step && from >= 0) next = (from + step + levels.length) % levels.length;
    if (next !== null) setSelectedCode(levels[next].code);
  };
  const grow = reduce ? {} : { initial: 'hidden', animate: inView ? 'shown' : 'hidden' };

  return <>
    <RadioPrimitive.Root ref={groupRef} value={selected.code} onValueChange={code => { takeOver(); setSelectedCode(code); }}
      onPointerDown={takeOver} onFocus={takeOver} onKeyDown={onKeyDown} aria-label="Chọn một bậc để xem mô tả"
      className="grid h-50 auto-cols-fr grid-flow-col items-end gap-1 min-[45.0625rem]:h-65 min-[45.0625rem]:gap-2">
      {levels.map((level, index) => {
        const checked = level.code === selected.code;
        return <div key={level.code} className="flex h-full min-w-0 flex-col justify-end gap-2">
          <RadioPrimitive.Item value={level.code} aria-label={`Bậc ${level.rank}: ${level.name}`} asChild>
            <m.button type="button" custom={index} variants={rungVariants} {...grow} style={rungHeight(index, levels.length)}
              className={cn('relative flex min-h-11 w-full origin-bottom flex-col items-center justify-end rounded-b-md rounded-t-lg px-0.5 py-2.5',
                'motion-safe:transition-[background-color,color,box-shadow,translate] motion-safe:duration-300 motion-safe:hover:-translate-y-1',
                checked ? 'bg-primary bg-linear-to-b from-primary to-brand-forest text-brand-lime shadow-[0_16px_28px_-16px_var(--color-brand)] motion-safe:-translate-y-1'
                  : 'bg-muted text-muted-foreground hover:bg-primary/12', FOCUS_ON_LIGHT)}>
              <span className="text-base font-extrabold">{level.rank}</span>
            </m.button>
          </RadioPrimitive.Item>
          <span aria-hidden="true" className={cn('min-h-7 text-center text-xs leading-tight max-[45rem]:hidden', checked ? 'font-extrabold text-primary' : 'font-semibold text-muted-foreground')}>
            {level.name}
          </span>
        </div>;
      })}
    </RadioPrimitive.Root>
    <div data-slot="ladder-detail" aria-live="polite" className="mt-4.5 min-h-27 overflow-hidden rounded-2xl border border-border bg-soft px-5 py-4.5">
      <AnimatePresence mode="wait" initial={false}>
        <m.div key={selected.code} {...(reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2, ease: EASE } })}>
          <p className="flex flex-wrap items-baseline gap-x-2.5 text-lg font-extrabold">
            <small className="text-xs font-bold uppercase tracking-wider text-primary">Bậc {selected.rank}/{levels.length}</small>{selected.name}
          </p>
          <p className="mt-1.5 text-sm leading-6.5 text-muted-foreground">{selected.description ?? 'Chưa có mô tả cho bậc này.'}</p>
        </m.div>
      </AnimatePresence>
    </div>
  </>;
}

/** Loading or failed catalog: decorative rungs and, on failure, a retry. The rest of the page keeps working. */
function LadderPlaceholder({ failed, retrying, onRetry }: { failed: boolean; retrying: boolean; onRetry: () => void }) {
  return <div data-slot="ladder-placeholder">
    <div aria-hidden="true" className="grid h-50 auto-cols-fr grid-flow-col items-end gap-1 min-[45.0625rem]:h-65 min-[45.0625rem]:gap-2">
      {Array.from({ length: PLACEHOLDER_RUNGS }, (_, index) => failed
        ? <span key={index} style={rungHeight(index, PLACEHOLDER_RUNGS)} className="flex items-end justify-center rounded-b-md rounded-t-lg bg-muted pb-2.5 text-base font-extrabold text-muted-foreground">{index + 1}</span>
        : <Skeleton key={index} style={rungHeight(index, PLACEHOLDER_RUNGS)} className="rounded-b-md rounded-t-lg" />)}
    </div>
    <div role="status" className="mt-4.5 flex min-h-27 flex-col items-start justify-center gap-3 rounded-2xl border border-border bg-soft px-5 py-4.5 text-sm text-muted-foreground">
      {failed ? <>
        <p>Chưa tải được mô tả các bậc. Bạn vẫn có thể làm khảo sát để biết trình độ của mình.</p>
        <button type="button" onClick={onRetry} disabled={retrying} className={cn(buttonVariants({ variant: 'outline' }), 'h-11')}>
          <RotateCw aria-hidden="true" className={cn(retrying && 'motion-safe:animate-spin')} />Thử lại
        </button>
      </> : <p>Đang tải các bậc trình độ…</p>}
    </div>
  </div>;
}
