import type { ReactNode } from 'react';
import { CircleAlert, Check, Medal, Zap } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ShuttlecockIcon } from '@/components/common/Icons';
import { cn } from '@/shared/utils/cn';
import type { SkillSurvey, SkillSurveyQuestion, SurveyAnswerValue } from '../auth-api';
import {
  BOOLEAN_ICONS, COACHING_ICONS, FREQUENCY_BARS, MEDAL_TIERS, questionVisual, RALLY_ATTACKING, RALLY_COUNTS, TIMELINE_SHORT,
  type QuestionVisual,
} from './survey-presentation';
import { fromRadioValue, toRadioValue } from './survey-logic';
import { questionHeadingId } from './use-register-wizard';

type Option = NonNullable<SkillSurveyQuestion['options']>[number];

const LAYOUT: Record<QuestionVisual, string> = {
  timeline: 'relative grid-cols-3 sm:grid-cols-6 sm:gap-2 sm:pt-7',
  dots: 'grid-cols-2 sm:grid-cols-4',
  cards: 'grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(12rem,1fr))]',
  toggle: 'grid-cols-2',
  rally: 'grid-cols-2 sm:grid-cols-3',
  energy: 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-5',
  medals: 'grid-cols-2 items-end sm:grid-cols-3 xl:grid-cols-5',
  list: 'grid-cols-1 sm:grid-cols-2',
};

const ITEM: Record<QuestionVisual, string> = {
  timeline: 'flex-col justify-center gap-1.5 px-2 py-3 text-center sm:min-h-23 sm:justify-start',
  dots: 'min-h-24 flex-col items-start',
  cards: '',
  toggle: '',
  rally: 'min-h-26 flex-col items-start',
  energy: 'min-h-28 flex-col items-start',
  medals: 'min-h-36 flex-col justify-end text-center',
  list: '',
};

const MEDAL_HEIGHT = ['xl:min-h-37.5', 'xl:min-h-40.5', 'xl:min-h-43.5', 'xl:min-h-46.5', 'xl:min-h-49.5'];
const MEDAL_TONE = ['border-2 border-dashed border-border', 'bg-brand-mint', 'bg-medal-bronze', 'bg-medal-silver', 'bg-medal-gold shadow-md'];
const ON = 'bg-primary/40 group-data-[state=checked]:bg-primary';

function OptionVisual({ visual, option, index }: { visual: QuestionVisual; option: Option; index: number }) {
  const code = String(option.code);
  switch (visual) {
    case 'timeline':
      return <span aria-hidden="true" className="absolute -top-5.75 left-1/2 hidden size-4 -translate-x-1/2 rounded-full border-3 border-border bg-card transition-all duration-200 group-data-[state=checked]:scale-125 group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:ring-5 group-data-[state=checked]:ring-primary/15 sm:block" />;
    case 'dots': {
      const filled = FREQUENCY_BARS[code] ?? index;
      return <span aria-hidden="true" className="flex gap-1">{[0, 1, 2, 3].map(dot => <i key={dot} className={cn('h-5.5 w-2 rounded-md', dot < filled ? ON : 'bg-muted')} />)}</span>;
    }
    case 'cards': {
      const Icon = COACHING_ICONS[code];
      return <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-primary transition-all duration-200 group-data-[state=checked]:bg-primary group-data-[state=checked]:text-brand-lime motion-safe:group-data-[state=checked]:-rotate-6">
        {Icon === 'shuttlecock' ? <ShuttlecockIcon size={18} /> : Icon ? <Icon className="size-4.5" /> : <Check className="size-4.5" />}
      </span>;
    }
    case 'toggle': {
      const Icon = BOOLEAN_ICONS[code] ?? Check;
      return <span aria-hidden="true" className="flex size-8.5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground"><Icon className="size-4" /></span>;
    }
    case 'rally': {
      const count = RALLY_COUNTS[code] ?? index + 1;
      return <span aria-hidden="true" className="flex h-5.5 items-center gap-0.75">
        {Array.from({ length: 6 }, (_, n) => <i key={n} className={cn('size-2.25 rounded-full', n < count ? ON : 'bg-muted')} />)}
        {RALLY_ATTACKING.has(code) && <Zap className="ml-1 size-4 text-caution" />}
      </span>;
    }
    case 'energy':
      return <span aria-hidden="true" className="relative flex gap-0.75 rounded-md border-2 border-border p-0.75 after:absolute after:-right-1.5 after:top-1.5 after:h-2 after:w-0.75 after:rounded-r-md after:bg-border">
        {[0, 1, 2, 3, 4].map(n => <i key={n} className={cn('h-3.5 w-1.75 rounded-md', n <= index ? ON : 'bg-muted')} />)}
      </span>;
    case 'medals': {
      const tier = MEDAL_TIERS[code] ?? Math.min(index, 4);
      return <span aria-hidden="true" className={cn('flex size-12 items-center justify-center rounded-full text-primary-foreground transition-transform duration-300 motion-safe:group-data-[state=checked]:-translate-y-1 motion-safe:group-data-[state=checked]:-rotate-6 motion-safe:group-data-[state=checked]:scale-110', MEDAL_TONE[tier])}>
        {tier > 0 && <Medal className="size-6" />}
      </span>;
    }
    default:
      return null;
  }
}

function OptionCheck({ visual }: { visual: QuestionVisual }) {
  if (visual === 'timeline') return null;
  const corner = ['dots', 'rally', 'energy', 'medals'].includes(visual);
  return <span aria-hidden="true" className={cn('flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 border-border text-transparent transition-all duration-200 group-data-[state=checked]:scale-105 group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground', corner && 'absolute right-3 top-3')}>
    <Check className="size-3.25" strokeWidth={3} />
  </span>;
}

interface ChoiceQuestionProps {
  survey: SkillSurvey;
  question: SkillSurveyQuestion;
  number: number;
  value: SurveyAnswerValue | undefined;
  missing: boolean;
  shake: boolean;
  onAnswer: (value: SurveyAnswerValue) => void;
}

/** One CHOICE/BOOLEAN item as a Radix radio group with the prototype's visual style for its id. */
export function ChoiceQuestion({ survey, question, number, value, missing, shake, onAnswer }: ChoiceQuestionProps) {
  const visual = questionVisual(question.id, question.type);
  const options = question.options ?? [];
  const selectedIndex = options.findIndex(option => option.code === value);
  const headingId = questionHeadingId(question.id);
  const descriptionId = `${headingId}-description`;
  const missingId = `${headingId}-missing`;
  const fillStyle = { width: `${(Math.max(selectedIndex, 0) * 100) / Math.max(options.length - 1, 1)}%` };
  return <section data-question={question.id} data-missing={missing || undefined}
    className={cn('min-w-0 rounded-2xl', shake && 'motion-safe:animate-shake')}>
    <h2 id={headingId} tabIndex={-1} className="flex flex-col gap-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-card">
      <span className="text-xs font-bold tracking-wide text-primary">Câu {number}</span>
      <span className="text-lg font-bold leading-snug tracking-tight">{question.text}</span>
    </h2>
    {question.description && <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">{question.description}</p>}
    <RadioGroup value={toRadioValue(value)} onValueChange={next => { const answer = fromRadioValue(survey, question, next); if (answer !== undefined) onAnswer(answer); }}
      aria-labelledby={headingId} aria-required="true" aria-invalid={missing || undefined}
      aria-describedby={[question.description ? descriptionId : '', missing ? missingId : ''].filter(Boolean).join(' ') || undefined}
      className={cn('mt-3.5 grid gap-2.5', LAYOUT[visual])}>
      {visual === 'timeline' && <span aria-hidden="true" className="absolute inset-x-[calc(100%/12)] top-3 hidden h-1 rounded-full bg-muted sm:block">
        <span className="block h-full rounded-full bg-linear-to-r from-brand-lime to-primary transition-[width] duration-300" style={fillStyle} />
      </span>}
      {options.map((option, index) => <RadioGroupItem key={String(option.code)} value={String(option.code)}
        className={cn('group relative size-auto min-h-14 w-full justify-start gap-3 rounded-2xl border-2 border-border bg-card px-3.5 py-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 hover:border-primary/30 hover:bg-card focus-visible:ring-offset-2 data-[state=checked]:border-primary data-[state=checked]:bg-accent data-[state=checked]:shadow-[0_0_0_3px] data-[state=checked]:shadow-primary/10 motion-safe:hover:-translate-y-px',
          missing && 'border-destructive/40', visual === 'medals' && MEDAL_HEIGHT[index], ITEM[visual])}>
        <OptionVisual visual={visual} option={option} index={index} />
        {visual === 'timeline'
          ? <span className="flex flex-col"><span aria-hidden="true" className="text-sm font-extrabold tracking-tight">{TIMELINE_SHORT[String(option.code)] ?? option.label}</span>
            <span className="mt-0.5 text-xs font-medium text-muted-foreground">{option.label}</span></span>
          : <span className="flex-1 text-sm font-semibold leading-snug">{option.label}</span>}
        <OptionCheck visual={visual} />
      </RadioGroupItem>)}
    </RadioGroup>
    {missing && <p id={missingId} className="mt-2.5 flex items-center gap-1.5 text-sm font-semibold text-destructive">
      <CircleAlert aria-hidden="true" className="size-4" />Bạn chưa chọn câu này
    </p>}
  </section>;
}

/** Collapsible wrapper for an item with `hiddenWhen` (item 4): smooth height change, none under reduced motion. */
export function RevealQuestion({ open, children }: { open: boolean; children: ReactNode }) {
  const reduce = useReducedMotion();
  return <AnimatePresence initial={false}>
    {open && <m.div key="reveal" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.3, ease: [0.2, 0.8, 0.2, 1] }} className="overflow-hidden">
      {children}
    </m.div>}
  </AnimatePresence>;
}
