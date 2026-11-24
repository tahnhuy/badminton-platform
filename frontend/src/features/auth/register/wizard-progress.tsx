import { Check, ShieldCheck } from 'lucide-react';
import { cn } from '@/shared/utils/cn';
import { ACCOUNT_STEP, stepCopy } from './survey-presentation';
import { missingIds } from './survey-logic';
import type { RegisterWizard } from './use-register-wizard';

function wizardSteps(wizard: RegisterWizard) {
  const { survey, questions, answers } = wizard;
  return [
    ...survey.steps.map((step, index) => ({ title: step.title, hint: stepCopy(step).hint, complete: missingIds(survey, index, questions, answers).length === 0 })),
    { title: ACCOUNT_STEP.title, hint: ACCOUNT_STEP.copy.hint, complete: false },
  ];
}

/** Desktop step rail: completed steps can be reopened. */
export function WizardRail({ wizard }: { wizard: RegisterWizard }) {
  const steps = wizardSteps(wizard);
  return <aside aria-label="Các bước đăng ký" className="sticky top-5 hidden rounded-panel border border-border bg-linear-to-b from-muted to-background px-6 py-7 lg:block">
    <p className="text-2xs font-bold uppercase tracking-widest text-primary">Hành trình của bạn</p>
    <p className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">Bắt đầu từ<br />điều làm nên bạn<span className="text-primary">.</span></p>
    <p className="mt-2.5 text-sm text-muted-foreground">Khoảng 3 phút. Câu trả lời giúp xếp bạn vào những trận cầu phù hợp hơn.</p>
    <ol className="relative mt-6.5 grid gap-1 before:absolute before:bottom-5.5 before:left-5.25 before:top-5.5 before:w-0.5 before:bg-border">
      {steps.map((step, index) => {
        const current = index === wizard.step;
        const status = current ? 'current' : step.complete && index < wizard.accountStep ? 'completed' : 'upcoming';
        const reachable = index <= wizard.maxStep && !current;
        const inner = <>
          <span aria-hidden="true" className={cn('relative ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-soft text-xs font-bold text-muted-foreground transition-all duration-200',
            status === 'current' && 'border-primary bg-primary text-primary-foreground ring-5 ring-primary/12',
            status === 'completed' && 'border-primary bg-accent text-primary')}>
            {status === 'completed' ? <Check className="size-3.75" strokeWidth={3} /> : String(index + 1).padStart(2, '0')}
          </span>
          <span className={cn('text-left', status === 'upcoming' && 'opacity-70')}>
            <strong className="block text-sm">{step.title}</strong>
            {step.hint && <small className="block text-xs text-muted-foreground">{step.hint}</small>}
          </span>
          {status === 'completed' && <span className="sr-only"> — đã hoàn thành</span>}
        </>;
        const rowClass = 'relative flex min-h-12 w-full items-center gap-3.5 rounded-lg px-1.5 py-2';
        return <li key={step.title} aria-current={current ? 'step' : undefined}>
          {reachable
            ? <button type="button" onClick={() => wizard.goToStep(index)} className={cn(rowClass, 'transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring')}>{inner}</button>
            : <div className={rowClass}>{inner}</div>}
        </li>;
      })}
    </ol>
    <div className="mt-6.5 flex gap-3 rounded-2xl bg-brand-forest p-4 text-sm text-brand-mint">
      <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-brand-lime" />
      <p><strong className="text-primary-foreground">Không có câu trả lời sai.</strong> Hãy chọn theo những gì bạn thường làm được, không phải lúc chơi hay nhất.</p>
    </div>
  </aside>;
}

/** Mobile sticky progress (below lg). Decorative; the step chip carries the same text for assistive tech. */
export function MobileProgress({ wizard }: { wizard: RegisterWizard }) {
  const steps = wizardSteps(wizard);
  return <div aria-hidden="true" className="sticky top-0 z-20 -mx-3.5 mb-3 bg-background/95 px-3.5 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
    <div className="grid auto-cols-fr grid-flow-col gap-1.25">
      {steps.map((step, index) => <span key={step.title} className={cn('h-1.25 rounded-full bg-border transition-colors duration-300',
        (index < wizard.step || (step.complete && index < wizard.accountStep)) && 'bg-primary',
        index === wizard.step && 'bg-linear-to-r from-primary to-brand-lime')} />)}
    </div>
    <p className="mt-1.5 text-xs font-bold text-muted-foreground">Bước {wizard.step + 1}/{steps.length} · {steps[wizard.step]?.title}</p>
  </div>;
}
