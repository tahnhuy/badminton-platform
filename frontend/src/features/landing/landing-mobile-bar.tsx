import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/shared/utils/cn';

/**
 * Phones only (≤ 720 px): the two actions stay at hand once the hero actions have scrolled away, and give way to
 * the closing call to action. While hidden it is inert, so it is neither focusable nor announced.
 */
export function MobileActionBar({ show }: { show: boolean }) {
  return <div data-slot="mobile-action-bar" data-state={show ? 'shown' : 'hidden'} inert={!show} aria-hidden={!show}
    className={cn('fixed inset-x-0 bottom-0 z-60 grid grid-cols-[auto_1fr] gap-2 bg-background/95 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-1px_0_var(--color-border)] backdrop-blur-md',
      'motion-safe:transition-transform motion-safe:duration-300 min-[45.0625rem]:hidden', show ? 'translate-y-0' : 'translate-y-[110%]')}>
    <Link to="/sign-in" className={cn(buttonVariants({ variant: 'ghost' }), 'h-11 text-foreground')}>Đăng nhập</Link>
    <Link to="/register" className={cn(buttonVariants(), 'h-11 font-bold')}>Khám phá trình độ<ArrowRight aria-hidden="true" /></Link>
  </div>;
}
