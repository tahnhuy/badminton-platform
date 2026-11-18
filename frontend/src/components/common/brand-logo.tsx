import { ShuttlecockIcon } from './Icons';
import { cn } from '@/shared/utils/cn';

/** Brand identity, independent of feature routing and auth state. */
export function BrandLogo({ className }: { className?: string }) {
  return <div className={cn('inline-flex min-h-11 items-center gap-2.5 text-2xl font-extrabold tracking-tight', className)}>
    <span className="flex h-11 w-10 -rotate-5 items-center justify-center rounded-lg bg-primary text-brand-lime">
      <ShuttlecockIcon size={27} className="rotate-5" />
    </span>
    <span>SmashPro<span className="text-primary">.</span></span>
  </div>;
}
