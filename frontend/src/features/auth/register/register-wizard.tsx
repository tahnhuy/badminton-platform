import { useEffect, useMemo, useRef } from 'react';
import { ArrowLeft, ArrowRight, CircleAlert, Clock, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import type { SkillSurvey } from '../auth-api';
import { AccountStep } from './account-step';
import { ChoiceQuestion, RevealQuestion } from './choice-question';
import { SkillStep } from './skill-step';
import { ACCOUNT_STEP, stepCopy } from './survey-presentation';
import { isHidden, isSkillStep, minutesLeftLabel, questionNumbers } from './survey-logic';
import { NEXT_BUTTON_ID, questionHeadingId, STEP_HEADING_ID, useRegisterWizard, type RegisterWizard } from './use-register-wizard';
import { MobileProgress, WizardRail } from './wizard-progress';

const pad = (value: number) => String(value).padStart(2, '0');

/** Survey-first registration wizard (AUTH-31, prototype v3). */
export function RegisterWizardView({ survey }: { survey: SkillSurvey }) {
  const wizard = useRegisterWizard(survey);
  return <LazyMotion features={domAnimation} strict>
    <MobileProgress wizard={wizard} />
    <div className="grid items-start gap-6 lg:grid-cols-[18.75rem_minmax(0,1fr)]">
      <WizardRail wizard={wizard} />
      <div className="min-w-0">
        {wizard.resumed && <ResumeBanner wizard={wizard} />}
        <Stage wizard={wizard} />
      </div>
    </div>
  </LazyMotion>;
}

function ResumeBanner({ wizard }: { wizard: RegisterWizard }) {
  return <div role="status" className="mb-3.5 flex items-center gap-3 rounded-2xl border border-border bg-card py-2 pl-4.5 pr-2 text-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-2">
    <RotateCcw aria-hidden="true" className="size-4.5 shrink-0 text-primary" />
    <p className="flex-1"><strong>Bạn đang làm dở khảo sát.</strong> Câu trả lời trước đó vẫn được giữ trong tab này.</p>
    <Button type="button" variant="ghost" onClick={wizard.resetDraft} className="h-11 px-2 text-primary">Làm lại từ đầu</Button>
    <Button type="button" variant="ghost" size="icon" onClick={wizard.dismissResume} aria-label="Đóng thông báo"><X aria-hidden="true" /></Button>
  </div>;
}

function Stage({ wizard }: { wizard: RegisterWizard }) {
  const { survey, questions, step, accountStep, answers, direction } = wizard;
  const reduce = useReducedMotion();
  const onAccount = step === accountStep;
  const busy = wizard.form.formState.isSubmitting;
  const copy = onAccount ? ACCOUNT_STEP.copy : stepCopy(survey.steps[step]);
  const timeLeft = minutesLeftLabel(survey, Math.min(step, accountStep), questions, answers);
  const nextLabel = onAccount ? 'Tạo tài khoản' : step === accountStep - 1 ? 'Đến bước cuối' : 'Tiếp tục';
  return <section aria-labelledby={STEP_HEADING_ID} className="relative rounded-panel border border-border bg-card shadow-panel">
    <div className="flex items-center justify-between gap-3 px-5 pt-5 sm:px-10 sm:pt-7">
      <span className="rounded-full bg-accent px-3 py-1.5 text-xs font-bold tracking-wider text-primary">
        Bước {pad(step + 1)} / {pad(accountStep + 1)}
        {/* Below lg the rail is hidden and the mobile progress is decorative: name the step for assistive tech here. */}
        <span className="sr-only lg:hidden"> · {onAccount ? ACCOUNT_STEP.title : survey.steps[step].title}</span>
      </span>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Clock aria-hidden="true" className="size-3.75" />{timeLeft}</span>
    </div>
    <div className="overflow-hidden px-5 sm:px-10">
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <m.div key={step} custom={direction} className="pb-8 pt-6"
          initial={reduce ? false : { opacity: 0, x: 24 * direction }}
          animate={{ opacity: 1, x: 0, transition: { duration: reduce ? 0 : 0.26, ease: [0.2, 0.8, 0.2, 1] } }}
          exit={reduce ? { opacity: 1, transition: { duration: 0 } } : { opacity: 0, x: -20 * direction, transition: { duration: 0.15 } }}>
          <StepPane wizard={wizard} copy={copy} />
        </m.div>
      </AnimatePresence>
    </div>
    <div className="fixed inset-x-0 bottom-0 z-30 flex justify-between gap-3 border-t border-border bg-card/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-16px] shadow-foreground/35 backdrop-blur-md lg:static lg:rounded-b-panel lg:bg-soft lg:px-10 lg:py-4.5 lg:shadow-none lg:backdrop-blur-none">
      <Button type="button" variant="outline" size="default" disabled={step === 0 || busy} onClick={wizard.back} className="shrink-0">
        <ArrowLeft aria-hidden="true" />Quay lại
      </Button>
      {/* On step ⑤ the button calls the form's submit directly: right after a step change the form may still be mounting. */}
      <Button id={NEXT_BUTTON_ID} type="button" variant="brand" disabled={busy} aria-busy={busy || undefined}
        aria-label={busy ? 'Đang tạo tài khoản…' : undefined} onClick={onAccount ? () => void wizard.submit() : wizard.next}
        className={cn('flex-1 lg:flex-none', wizard.attention && 'motion-safe:animate-attention')}>
        {busy ? <><LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /><span role="status">Đang tạo tài khoản…</span></>
          : <>{nextLabel}<ArrowRight aria-hidden="true" /></>}
      </Button>
    </div>
  </section>;
}

function StepPane({ wizard, copy }: { wizard: RegisterWizard; copy: { eyebrow: string; heading: string; lead: string } }) {
  const { survey, questions, step, accountStep, answers, missing, shakeId, focusOnEnter } = wizard;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const numbers = useMemo(() => questionNumbers(survey), [survey]);
  // After a step change (not on first render) focus the step heading, or the first item the Player must answer again
  // when the step was opened because of missing/rejected answers. Runs after the children's mount effects.
  useEffect(() => {
    if (!focusOnEnter) return;
    const first = missing[0] ? document.getElementById(questionHeadingId(missing[0])) : null;
    if (first) {
      first.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      first.focus({ preventScroll: true });
    } else {
      headingRef.current?.focus({ preventScroll: true });
    }
    // Only on entering a step; later changes to `missing` are handled by the wizard hook.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [focusOnEnter, step]);
  const skill = step < accountStep && isSkillStep(survey, step, questions);
  return <>
    {copy.eyebrow && <p className="text-2xs font-bold uppercase tracking-widest text-primary">{copy.eyebrow}</p>}
    <h1 ref={headingRef} id={STEP_HEADING_ID} tabIndex={-1} className="mt-2 text-2xl font-extrabold leading-tight tracking-tight outline-none sm:text-3xl">{copy.heading}</h1>
    {copy.lead && <p className="mt-2 max-w-160 text-base text-muted-foreground">{copy.lead}</p>}
    {missing.length > 0 && <div role="alert" className="mt-4.5 flex items-center gap-2.5 rounded-lg bg-danger-bg px-3.5 py-3 text-sm font-semibold text-destructive motion-safe:animate-in motion-safe:fade-in">
      <CircleAlert aria-hidden="true" className="size-4.5 shrink-0" />
      <span>{skill ? `Còn ${missing.length} kỹ năng chưa chọn.` : `Còn ${missing.length} câu chưa trả lời.`} Hãy hoàn thành để tiếp tục.</span>
    </div>}
    {step === accountStep
      ? <AccountStep wizard={wizard} />
      : skill
        ? <SkillStep wizard={wizard} numbers={numbers} />
        : <div className="mt-7 grid gap-7.5">
          {survey.steps[step].questionIds.map(id => {
            const question = questions[id];
            if (!question) return null;
            const node = <ChoiceQuestion key={id} survey={survey} question={question} number={numbers[id]} value={answers[id]}
              missing={missing.includes(id)} shake={shakeId === id} onAnswer={value => wizard.answer(id, value)} />;
            return question.hiddenWhen ? <RevealQuestion key={id} open={!isHidden(question, answers)}>{node}</RevealQuestion> : node;
          })}
        </div>}
  </>;
}
