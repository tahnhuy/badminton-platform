import { ShuttlecockIcon } from './Icons';
import { cn } from '@/shared/utils/cn';

interface BrandLogoProps {
  className?: string;
  /** `sm` for app headers, `md` for Auth pages. */
  size?: 'sm' | 'md';
  /** Hide the “SmashPro.” wordmark below 640 px (mark only), e.g. in a crowded mobile header. */
  compactOnMobile?: boolean;
  /** `dark` over the forest hero art (landing header): lime mark, white wordmark. */
  tone?: 'light' | 'dark';
  /** Extra classes for the mark tile, e.g. a hover turn when the logo is a link. */
  markClassName?: string;
}

/** Brand identity, independent of feature routing and auth state. */
export function BrandLogo({ className, size = 'md', compactOnMobile = false, tone = 'light', markClassName }: BrandLogoProps) {
  const small = size === 'sm';
  const dark = tone === 'dark';
  return <div className={cn('inline-flex min-h-11 items-center gap-2.5 font-extrabold tracking-tight', small ? 'text-xl' : 'text-2xl', dark && 'text-white', className)}>
    <span className={cn('flex -rotate-5 items-center justify-center rounded-lg', dark ? 'bg-brand-lime text-brand-forest' : 'bg-primary text-brand-lime',
      small ? 'size-9' : 'h-11 w-10', markClassName)}>
      <ShuttlecockIcon size={small ? 22 : 27} className="rotate-5" />
    </span>
    <span className={cn(compactOnMobile && 'sr-only sm:not-sr-only')}>SmashPro<span className={dark ? 'text-brand-lime' : 'text-primary'}>.</span></span>
  </div>;
}
