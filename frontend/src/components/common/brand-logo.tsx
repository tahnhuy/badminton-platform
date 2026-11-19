import { ShuttlecockIcon } from './Icons';
import { cn } from '@/shared/utils/cn';

interface BrandLogoProps {
  className?: string;
  /** `sm` for app headers, `md` for Auth pages. */
  size?: 'sm' | 'md';
  /** Hide the “SmashPro.” wordmark below 640 px (mark only), e.g. in a crowded mobile header. */
  compactOnMobile?: boolean;
}

/** Brand identity, independent of feature routing and auth state. */
export function BrandLogo({ className, size = 'md', compactOnMobile = false }: BrandLogoProps) {
  const small = size === 'sm';
  return <div className={cn('inline-flex min-h-11 items-center gap-2.5 font-extrabold tracking-tight', small ? 'text-xl' : 'text-2xl', className)}>
    <span className={cn('flex -rotate-5 items-center justify-center rounded-lg bg-primary text-brand-lime', small ? 'size-9' : 'h-11 w-10')}>
      <ShuttlecockIcon size={small ? 22 : 27} className="rotate-5" />
    </span>
    <span className={cn(compactOnMobile && 'sr-only sm:not-sr-only')}>SmashPro<span className="text-primary">.</span></span>
  </div>;
}
