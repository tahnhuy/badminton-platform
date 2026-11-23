import { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, Hand, Keyboard } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/utils/cn';
import { SkillArt } from './skill-art';
import { SKILL_SCALE_HINTS } from './survey-presentation';
import { fromRadioValue, toRadioValue } from './survey-logic';
import { questionHeadingId, type RegisterWizard } from './use-register-wizard';

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Technique step: one skill at a time with its illustration. Pointer selection (and
 * keys 1–4) moves on to the next unanswered skill; arrows switch skills when focus
 * is not on the scale; horizontal swipe on touch screens.
 */
export function SkillStep({ wizard, numbers }: { wizard: RegisterWizard; numbers: Record<string, number> }) {
  const { survey, questions, skillIds, skillIndex, answers, missing, shakeId, direction, focusOnEnter, answer, goToSkill } = wizard;
  const reduce = useReducedMotion();
  const coarse = useMediaQuery('(pointer: coarse)');
  /** Time of the last pointer release on a scale option; a selection right after it counts as a pointer pick. */
  const lastPointerUp = useRef(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  /** Whether the latest selection came from a pointer (auto-advance); reading it resets it. */
  // Only a selection that follows the same pointer release auto-advances (not a later keyboard choice).
  const takePointerSelect = () => { const value = performance.now() - lastPointerUp.current < 400; lastPointerUp.current = 0; return value; };
  const id = skillIds[skillIndex];
  const answered = skillIds.filter(skillId => answers[skillId] !== undefined).length;

  // Keys 1–N choose a level; ←/→ switch skills when not on a radio.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const level = survey.skillScale[Number(event.key) - 1];
      if (/^[1-9]$/.test(event.key) && level) {
        event.preventDefault();
        answer(id, level.value, { advance: true });
        document.querySelector<HTMLElement>(`[data-skill-card] [role="radio"][value="${level.value}"]`)?.focus({ preventScroll: true });
      } else if (!target?.closest('[role="radio"]') && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        goToSkill(skillIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [survey.skillScale, answer, id, goToSkill, skillIndex]);

  useEffect(() => {
    navRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [skillIndex, reduce]);

  return <div className="mt-6">
    <div ref={navRef} role="group" aria-label="Danh sách kỹ năng" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] xl:grid xl:grid-cols-9 xl:overflow-visible">
      {skillIds.map((skillId, index) => {
        const done = answers[skillId] !== undefined;
        const current = index === skillIndex;
        return <button key={skillId} type="button" onClick={() => goToSkill(index)} aria-current={current || undefined}
          aria-label={`Kỹ năng ${index + 1}: ${questions[skillId]?.text}${done ? ', đã trả lời' : ''}`}
          className={cn('flex min-h-16 w-18 shrink-0 flex-col items-center gap-1.5 rounded-lg border-2 border-border bg-soft px-1 py-2 transition-colors duration-200 hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:w-auto',
            current && 'border-primary bg-card shadow-[0_0_0_3px] shadow-primary/10', missing.includes(skillId) && !current && 'border-destructive/40')}>
          <span aria-hidden="true" className={cn('flex size-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground', done && 'bg-accent text-primary', current && 'bg-primary text-primary-foreground')}>
            {done ? <Check className="size-3.25" strokeWidth={3} /> : index + 1}
          </span>
          <span aria-hidden="true" className="line-clamp-2 text-center text-xs font-semibold leading-tight text-muted-foreground">{questions[skillId]?.text}</span>
        </button>;
      })}
    </div>
    <div className="mx-0.5 mb-2.5 mt-4.5 flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
      <span>Kỹ năng {pad(skillIndex + 1)} / {pad(skillIds.length)}</span><span aria-live="polite">Đã trả lời {answered} / {skillIds.length}</span>
    </div>
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <m.div key={id} data-skill-card="" custom={direction}
        initial={reduce ? false : { opacity: 0, x: 32 * direction }} animate={{ opacity: 1, x: 0, transition: { duration: 0.24, ease: [0.2, 0.8, 0.2, 1] } }}
        exit={reduce ? { opacity: 1 } : { opacity: 0, x: -28 * direction, transition: { duration: 0.14 } }}
        onPointerDown={event => {
          if (event.pointerType !== 'mouse') swipe.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerCancel={() => { swipe.current = null; lastPointerUp.current = 0; }}
        onPointerUp={event => {
          const onRadio = Boolean((event.target as HTMLElement).closest('[role="radio"]'));
          lastPointerUp.current = onRadio ? performance.now() : 0;
          const start = swipe.current; swipe.current = null;
          if (!start) return;
          const dx = event.clientX - start.x; const dy = event.clientY - start.y;
          if (Math.abs(dx) > 60 && Math.abs(dy) < 45) { lastPointerUp.current = 0; goToSkill(skillIndex + (dx < 0 ? 1 : -1)); }
        }}
        className={cn('grid touch-pan-y overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]', shakeId === id && 'motion-safe:animate-shake')}>
        <div className="relative flex items-center justify-center bg-[radial-gradient(120%_90%_at_20%_0,var(--color-brand-moss),var(--color-brand-forest)_60%,var(--color-brand-forest-deep))] px-3 py-3.5 lg:px-4.5 lg:py-6">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(var(--color-brand-grid)_1px,transparent_1px)] bg-size-[14px_14px]" />
          <SkillArt questionId={id} />
        </div>
        <SkillQuestion key={id} wizard={wizard} questionId={id} number={numbers[id]} focus={focusOnEnter} takePointerSelect={takePointerSelect} />
      </m.div>
    </AnimatePresence>
    <div className="mt-3.5 flex items-center justify-between gap-3">
      <Button type="button" variant="outline" disabled={skillIndex === 0} onClick={() => goToSkill(skillIndex - 1)} className="min-h-11" aria-label="Kỹ năng trước">
        <ArrowLeft aria-hidden="true" /><span className="hidden sm:inline">Kỹ năng trước</span>
      </Button>
      <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
        {coarse
          ? <><Hand aria-hidden="true" className="size-4" />Vuốt ngang để chuyển kỹ năng</>
          : <><Keyboard aria-hidden="true" className="size-4" />Phím <kbd className="rounded-md border border-b-2 border-border bg-card px-1.5 py-0.5 font-sans text-xs font-semibold">1</kbd>–<kbd className="rounded-md border border-b-2 border-border bg-card px-1.5 py-0.5 font-sans text-xs font-semibold">{survey.skillScale.length}</kbd> để chọn nhanh</>}
      </p>
      <Button type="button" variant="outline" disabled={skillIndex === skillIds.length - 1} onClick={() => goToSkill(skillIndex + 1)} className="min-h-11" aria-label="Kỹ năng sau">
        <span className="hidden sm:inline">Kỹ năng sau</span><ArrowRight aria-hidden="true" />
      </Button>
    </div>
  </div>;
}

function SkillQuestion({ wizard, questionId, number, focus, takePointerSelect }:
  { wizard: RegisterWizard; questionId: string; number: number; focus: boolean; takePointerSelect: () => boolean }) {
  const { survey, questions, answers, missing, answer } = wizard;
  const question = questions[questionId];
  const value = answers[questionId];
  const headingId = questionHeadingId(questionId);
  const isMissing = missing.includes(questionId);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const coarse = useMediaQuery('(pointer: coarse)');
  useEffect(() => { if (focus) headingRef.current?.focus({ preventScroll: true }); }, [focus]);
  return <section className="min-w-0 p-4 sm:p-6">
    <h2 ref={headingRef} id={headingId} tabIndex={-1} className="flex flex-col gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card">
      <span className="text-xs font-bold tracking-wide text-primary">Câu {number}</span>
      <span className="text-2xl font-extrabold tracking-tight">{question?.text}</span>
    </h2>
    {question?.description && <p id={`${headingId}-description`} className="mt-1 text-sm text-muted-foreground">{question.description}</p>}
    <RadioGroup value={toRadioValue(value)} aria-labelledby={headingId} aria-required="true" aria-invalid={isMissing || undefined}
      aria-describedby={[question?.description ? `${headingId}-description` : '', isMissing ? `${headingId}-missing` : ''].filter(Boolean).join(' ') || undefined}
      onValueChange={next => {
        const level = question && fromRadioValue(survey, question, next);
        if (level === undefined) return;
        answer(questionId, level, { advance: takePointerSelect() });
      }}
      className="mt-4 grid gap-2">
      {survey.skillScale.map(level => <RadioGroupItem key={level.value} value={String(level.value)}
        className={cn('group size-auto min-h-15 w-full justify-start gap-3.5 rounded-2xl border-2 border-border bg-card px-3.5 py-2.5 text-left transition-[border-color,background-color,transform] duration-200 hover:border-primary/30 hover:bg-card data-[state=checked]:border-primary data-[state=checked]:bg-accent motion-safe:hover:translate-x-0.5',
          isMissing && 'border-destructive/40')}>
        <span aria-hidden="true" className="flex h-5.5 items-end gap-0.75">
          {['h-2.25', 'h-3.75', 'h-5.5'].map((height, bar) => <i key={height} className={cn('w-1.5 rounded-md', height, bar < level.value ? 'bg-primary/40 group-data-[state=checked]:bg-primary' : 'bg-muted')} />)}
        </span>
        <span className="flex-1">
          <strong className="block text-sm">{level.label}</strong>
          {SKILL_SCALE_HINTS[level.value] && <span className="block text-xs text-muted-foreground">{SKILL_SCALE_HINTS[level.value]}</span>}
        </span>
        {!coarse && <kbd aria-hidden="true" className="rounded-md border border-b-2 border-border bg-card px-1.5 py-0.5 font-sans text-xs font-semibold text-muted-foreground group-data-[state=checked]:border-primary group-data-[state=checked]:text-primary">{level.value + 1}</kbd>}
      </RadioGroupItem>)}
    </RadioGroup>
    {isMissing && <p id={`${headingId}-missing`} className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-destructive">
      <CircleAlert aria-hidden="true" className="size-4" />Bạn chưa chọn kỹ năng này
    </p>}
  </section>;
}
