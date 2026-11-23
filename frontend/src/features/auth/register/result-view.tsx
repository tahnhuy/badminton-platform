import { useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Check, CheckCheck, CircleHelp, Clock, Sparkles, TrendingUp } from 'lucide-react';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { authApi, type SkillSurveyResult } from '../auth-api';
import { RegisterShell } from './register-shell';
import { CRITERIA, G2_DURATION_BY_CAP, RADAR_AXES } from './survey-presentation';
import { useConfettiOnce } from './use-confetti';
import { skillLevelsKey } from './register-queries';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Result screen content (PRD "Result screen"): server data only, presentation per prototype v3. */
export function ResultView({ result, fullName, fresh }: { result: SkillSurveyResult; fullName: string; fresh: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduce = useReducedMotion();
  const level = result.skillLevel;
  const firstName = fullName.trim().split(/\s+/).pop() ?? '';
  useEffect(() => { window.scrollTo(0, 0); headingRef.current?.focus({ preventScroll: true }); }, []);
  useConfettiOnce(canvasRef, fresh, reduce ? 0 : 900);

  return <RegisterShell signInLink={false}>
    <LazyMotion features={domAnimation} strict>
      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <main aria-labelledby="result-heading" className="min-w-0 rounded-panel border border-border bg-card px-4 py-6.5 shadow-panel sm:p-10">
          {fresh && <p className="mb-6.5 inline-flex items-center gap-2 rounded-full bg-accent py-1.5 pl-2 pr-3 text-xs font-bold text-primary">
            <CheckCheck aria-hidden="true" className="size-4" />Tài khoản đã sẵn sàng
          </p>}
          <p className="text-2xs font-bold uppercase tracking-widest text-primary">Một khởi đầu dành riêng cho bạn</p>
          <h1 ref={headingRef} id="result-heading" tabIndex={-1} className="mt-2.5 text-3xl font-extrabold leading-tight tracking-tight outline-none sm:text-4xl lg:text-5xl">
            Sẵn sàng tìm<br />đồng đội của bạn<span className="text-primary">?</span>
          </h1>
          <p className="mt-3.5 max-w-130 text-base text-muted-foreground">
            {firstName ? `${firstName}, bạn` : 'Bạn'} bắt đầu ở bậc <strong className="text-foreground">{level.name}</strong>. Một điểm xuất phát — rất nhiều đồng đội phù hợp đang chờ bạn ra sân.
          </p>
          <Ladder result={result} />
          <Insights result={result} />
          <GuardrailNotes result={result} />
          {result.isSkillTentative && <p className="mt-4.5 flex gap-2.5 text-sm text-muted-foreground">
            <CircleHelp aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>Đây là mức tự đánh giá ban đầu, mang tính tạm thời. Trình độ được điều chỉnh chính thức thông qua các giải đấu chuyên nghiệp trên nền tảng.</span>
          </p>}
          <div className="mt-5.5 flex flex-wrap gap-2.5">
            <Button asChild variant="brand" size="comfortable" className="group min-w-60 flex-1 justify-between px-6.5 text-base">
              <Link to="/matchmaking">Tìm kèo phù hợp<ArrowRight aria-hidden="true" className="transition-transform duration-200 motion-safe:group-hover:translate-x-1" /></Link>
            </Button>
            <Button asChild variant="outline" size="comfortable"><Link to="/profile">Xem hồ sơ của bạn</Link></Button>
          </div>
        </main>
        <Hero result={result} canvasRef={canvasRef} />
      </div>
    </LazyMotion>
  </RegisterShell>;
}

function Ladder({ result }: { result: SkillSurveyResult }) {
  const reduce = useReducedMotion(); // reduced motion: entrances are instant, no delays
  const levels = useQuery({
    queryKey: skillLevelsKey,
    queryFn: ({ signal }) => authApi.listSkillLevels(signal).then(response => [...response.data].sort((a, b) => a.rank - b.rank)),
    staleTime: 5 * 60_000,
  });
  const own = result.skillLevel;
  const [viewing, setViewing] = useState(own.rank);
  const shown = levels.data?.find(item => item.rank === viewing);
  return <section aria-labelledby="ladder-heading" className="mt-7.5">
    <div className="flex justify-between text-sm font-bold text-muted-foreground">
      <h2 id="ladder-heading">Trình độ ban đầu</h2>
      {levels.data && <span>{own.rank} / {levels.data.length} bậc</span>}
    </div>
    {levels.isPending && <Skeleton className="mt-2.5 h-14 w-full rounded-lg" />}
    {levels.isError && <p className="mt-2.5 rounded-lg border border-border bg-soft px-3.5 py-3 text-sm"><strong>{own.name}</strong> · bậc {own.rank}</p>}
    {levels.data && <>
      <ul className="mt-2.5 grid auto-cols-fr grid-flow-col gap-0.5 sm:gap-1.5">
        {levels.data.map((item, index) => {
          const filled = item.rank <= own.rank;
          const current = item.rank === own.rank;
          return <li key={item.code}>
            <button type="button" onClick={() => setViewing(item.rank)} aria-pressed={viewing === item.rank}
              aria-label={`${item.name}${current ? ' — bậc của bạn' : ''}`}
              className="group flex min-h-14 w-full min-w-11 flex-col gap-2 rounded-md text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <span className={cn('relative flex h-3 items-center justify-center overflow-hidden rounded-md bg-muted group-hover:ring-2 group-hover:ring-primary/15', current && '-mt-1.25 h-5.5 overflow-visible')}>
                <m.span aria-hidden="true" className={cn('absolute inset-0 origin-left rounded-md', current ? 'bg-primary shadow-md' : 'bg-primary/40')}
                  initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: filled ? 1 : 0 }} transition={{ delay: 0.2 + index * 0.08, duration: 0.38, ease: EASE }} />
                {current && <m.span aria-hidden="true" className="relative text-primary-foreground" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.56 + index * 0.08 }}>
                  <Check className="size-3.5" strokeWidth={3} />
                </m.span>}
              </span>
              <span className={cn('text-xs font-semibold leading-tight text-muted-foreground', current && 'font-extrabold text-primary', viewing === item.rank && 'underline underline-offset-3')}>{item.name}</span>
            </button>
          </li>;
        })}
      </ul>
      <div aria-live="polite" className="mt-2.5 grid gap-0.5 rounded-lg border border-border bg-soft px-3.5 py-3 text-sm text-muted-foreground">
        {shown && <><strong className="text-foreground">{shown.name}{shown.rank === own.rank ? ' · bậc của bạn' : ''}</strong>{shown.description && <span>{shown.description}</span>}</>}
      </div>
    </>}
  </section>;
}

function Insights({ result }: { result: SkillSurveyResult }) {
  const improve = CRITERIA[result.areaToImprove.criterion];
  const cards = result.strengths.map(item => ({ key: item.criterion, copy: CRITERIA[item.criterion] }));
  return <section aria-label="Điểm mạnh và điểm cần cải thiện" className="mt-5.5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {cards.length === 0 && <InsightCard index={0} kind="empty" kicker="Điểm mạnh" title="Chưa có điểm mạnh nổi bật — cứ ra sân thường xuyên nhé!" text="" icon={Sparkles} />}
    {cards.map((card, index) => <InsightCard key={card.key} index={index} kind="strength" kicker="Điểm mạnh" title={card.copy.name} text={card.copy.strength ?? ''} icon={card.copy.icon} />)}
    <InsightCard index={Math.max(cards.length, 1)} kind="improve" kicker="Cùng cải thiện" title={improve.name} text={improve.improve ?? ''} icon={improve.icon} />
  </section>;
}

function InsightCard({ index, kind, kicker, title, text, icon: Icon }:
  { index: number; kind: 'strength' | 'improve' | 'empty'; kicker: string; title: string; text: string; icon: typeof Sparkles }) {
  const reduce = useReducedMotion(); // reduced motion: entrances are instant, no delays
  return <m.article initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 + index * 0.1, duration: 0.4, ease: EASE }}
    className={cn('rounded-2xl border border-border bg-soft p-4', kind === 'improve' && 'border-caution/20 bg-caution-bg/60')}>
    <span aria-hidden="true" className={cn('flex size-9 items-center justify-center rounded-lg bg-accent text-primary', kind === 'improve' && 'bg-caution-bg text-caution')}><Icon className="size-4.5" /></span>
    <p className="mt-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">{kicker}</p>
    <h3 className="mt-0.5 text-base font-bold">{title}</h3>
    {text && <p className="mt-1 text-sm text-muted-foreground">{text}</p>}
  </m.article>;
}

function GuardrailNotes({ result }: { result: SkillSurveyResult }) {
  if (!result.guardrails.length) return null;
  return <div className="mt-3.5 grid gap-2">
    {result.guardrails.map(item => {
      if (item.code === 'G1_BOTTLENECK') {
        const name = item.criterion ? CRITERIA[item.criterion].name : CRITERIA[result.areaToImprove.criterion].name;
        return <p key={item.code} className="flex gap-2.5 rounded-lg bg-caution-bg px-3.5 py-3 text-sm text-caution-hover">
          <TrendingUp aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-caution" />
          <span>Bạn được xếp ở bậc này vì <strong>{name}</strong> đang là điểm yếu nhất. Cải thiện tiêu chí này là cách nhanh nhất để phát huy hết tiềm năng của bạn.</span>
        </p>;
      }
      const duration = G2_DURATION_BY_CAP[item.cap.code];
      return <p key={item.code} className="flex gap-2.5 rounded-lg bg-caution-bg px-3.5 py-3 text-sm text-caution-hover">
        <Clock aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-caution" />
        <span>Người mới chơi{duration ? <> dưới <strong>{duration}</strong></> : ''} được xếp tối đa ở bậc <strong>{item.cap.name}</strong>. Cứ tiếp tục ra sân, trình độ sẽ theo kịp bạn.</span>
      </p>;
    })}
  </div>;
}

function Hero({ result, canvasRef }: { result: SkillSurveyResult; canvasRef: RefObject<HTMLCanvasElement | null> }) {
  const reduce = useReducedMotion(); // reduced motion: entrances are instant, no delays
  const level = result.skillLevel;
  return <aside aria-label="Huy hiệu trình độ" className="relative isolate order-first flex flex-col items-center overflow-hidden rounded-panel bg-brand-forest px-5 py-6.5 text-center text-primary-foreground sm:px-7 sm:py-8.5 lg:order-none">
    <div aria-hidden="true" className="absolute inset-0 -z-2 bg-[radial-gradient(90%_60%_at_50%_22%,var(--color-brand-glow),transparent_60%),radial-gradient(140%_100%_at_0_0,var(--color-brand-moss),var(--color-brand-forest)_55%,var(--color-brand-forest-deep))]" />
    <div aria-hidden="true" className="absolute inset-0 -z-1 bg-[radial-gradient(var(--color-brand-grid)_0.7px,transparent_0.7px)] bg-size-[13px_13px] opacity-70" />
    <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-3 size-full" />
    <p className="text-2xs font-bold uppercase tracking-[0.28em] text-brand-mint">SmashPro Player</p>
    <Badge rank={level.rank} />
    {result.isSkillTentative && <span className="mt-4.5 rounded-full border border-brand-lime/40 px-3.5 py-1.5 text-2xs font-bold uppercase tracking-widest text-brand-lime">Trình độ tạm thời</span>}
    <m.p initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.5, ease: EASE }}
      className="mt-3 text-4xl font-extrabold leading-none tracking-tighter sm:text-5xl">{level.name}<span aria-hidden="true" className="text-brand-lime">.</span></m.p>
    <Radar result={result} />
  </aside>;
}

function Badge({ rank }: { rank: number }) {
  const reduce = useReducedMotion(); // reduced motion: entrances are instant, no delays
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return <m.div className="relative mt-4.5 w-47.5" initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }}
    transition={{ delay: 0.3, opacity: { delay: 0.3, duration: 0.4 }, type: 'spring', stiffness: 220, damping: 13 }}>
    <svg viewBox="0 0 200 220" role="img" aria-label={`Bậc trình độ ${rank}`} className="h-auto w-full drop-shadow-2xl">
      <defs>
        <linearGradient id={`${id}fill`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="[stop-color:var(--color-brand-accent)]" /><stop offset="1" className="[stop-color:var(--color-brand-forest)]" /></linearGradient>
        <linearGradient id={`${id}edge`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" className="[stop-color:var(--color-brand-lime)]" /><stop offset="1" className="[stop-color:var(--color-brand-mint)]" /></linearGradient>
      </defs>
      <polygon points="100,8 182,55 182,150 100,206 18,150 18,55" fill={`url(#${id}fill)`} stroke={`url(#${id}edge)`} strokeWidth={5} />
      <polygon points="100,26 166,64 166,141 100,186 34,141 34,64" strokeWidth={1.5} className="fill-none stroke-brand-lime/25" />
      <g transform="translate(76 46)" strokeWidth={2.4} className="fill-none stroke-brand-lime [stroke-linecap:round] [stroke-linejoin:round]">
        <path d="M24 4C17 4 10 14 10 24C10 29 12 34 16 37V42C16 43.2 16.8 44 18 44H30C31.2 44 32 43.2 32 42V37C36 34 38 29 38 24C38 14 31 4 24 4Z" />
        <path d="M16 24H32M14 32H34M18 14L24 44M30 14L24 44" />
      </g>
      <text x={100} y={128} textAnchor="middle" fontSize={44} fontWeight={800} letterSpacing="-0.04em" className="fill-primary-foreground">{rank}</text>
      <text x={100} y={152} textAnchor="middle" fontSize={9} fontWeight={700} letterSpacing="0.22em" className="fill-brand-lime/85">BẬC TRÌNH ĐỘ</text>
    </svg>
  </m.div>;
}

function Radar({ result }: { result: SkillSurveyResult }) {
  const reduce = useReducedMotion(); // reduced motion: entrances are instant, no delays
  const cx = 130; const cy = 112; const radius = 78;
  const point = (index: number, value: number) => {
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / RADAR_AXES.length;
    return [cx + Math.cos(angle) * radius * value, cy + Math.sin(angle) * radius * value] as const;
  };
  const ring = (value: number) => RADAR_AXES.map((_, index) => point(index, value).join(',')).join(' ');
  const values = RADAR_AXES.map(key => Math.max(0.04, Math.min(result.components[key], 100) / 100));
  const shape = values.map((value, index) => point(index, value).join(',')).join(' ');
  return <figure className="relative mt-auto w-full max-w-65 pt-4.5 lg:max-w-75">
    <svg viewBox="0 0 260 230" role="img" aria-labelledby="radar-title radar-desc" className="h-auto w-full overflow-visible">
      <title id="radar-title">Hồ sơ sáu tiêu chí</title>
      <desc id="radar-desc">{RADAR_AXES.map(key => `${CRITERIA[key].name} ${Math.round(result.components[key])} trên 100`).join(', ')}</desc>
      {[0.25, 0.5, 0.75, 1].map(value => <polygon key={value} points={ring(value)} className="fill-none stroke-brand-lime/15" />)}
      {RADAR_AXES.map((key, index) => { const [x, y] = point(index, 1); return <line key={key} x1={cx} y1={cy} x2={x} y2={y} className="stroke-brand-lime/15" />; })}
      <m.polygon points={shape} strokeWidth={2} className="fill-brand-lime/30 stroke-brand-lime [stroke-linejoin:round]"
        initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1, type: 'spring', stiffness: 160, damping: 14 }} />
      {RADAR_AXES.map((key, index) => {
        const [lx, ly] = point(index, 1.24);
        const [dx, dy] = point(index, values[index]);
        return <g key={key}>
          <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize={10.5} fontWeight={600} className="fill-brand-mint">{CRITERIA[key].short}</text>
          <m.circle cx={dx} cy={dy} r={3} className="fill-brand-lime" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6, duration: 0.3 }} />
        </g>;
      })}
    </svg>
    <figcaption className="mt-1 text-xs text-brand-mint">Hồ sơ 6 tiêu chí</figcaption>
  </figure>;
}
