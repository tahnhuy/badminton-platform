import type { MouseEvent, Ref } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { m, useScroll } from 'motion/react';
import { BrandLogo } from '@/components/common/brand-logo';
import { cn } from '@/shared/utils/cn';
import { CONTAINER, FOCUS_ON_DARK, FOCUS_ON_LIGHT, goToSection, LANDING_SECTIONS } from './landing-ui';

interface LandingHeaderProps {
  headerRef: Ref<HTMLElement>;
  /** Transparent with light text while the hero is under the header; frosted afterwards. */
  overHero: boolean;
  active: string | null;
  reduce: boolean;
}

/** Fixed header: brand, in-page navigation, "Đăng nhập" and "Tạo tài khoản", thin scroll progress. */
export function LandingHeader({ headerRef, overHero, active, reduce }: LandingHeaderProps) {
  const { scrollYProgress } = useScroll();
  const progressStyle = { scaleX: scrollYProgress };
  const focus = overHero ? FOCUS_ON_DARK : FOCUS_ON_LIGHT;
  const jump = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); goToSection(id, reduce); };

  return <header ref={headerRef} data-surface={overHero ? 'hero' : 'solid'}
    className={cn('fixed inset-x-0 top-0 z-50 flex h-16 items-center motion-safe:transition-[background-color,box-shadow] motion-safe:duration-300 min-[45.0625rem]:h-18',
      overHero ? 'bg-transparent' : 'bg-background/85 shadow-[0_1px_0_var(--color-border)] backdrop-blur-md backdrop-saturate-150')}>
    <div className={cn(CONTAINER, 'flex items-center justify-between gap-5')}>
      <a href="#top" onClick={jump('top')} aria-label="SmashPro — về đầu trang" className={cn('group rounded-lg', focus)}>
        <BrandLogo tone={overHero ? 'dark' : 'light'}
          markClassName="motion-safe:transition-[rotate,scale,background-color,color] motion-safe:duration-300 motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-105" />
      </a>
      <nav aria-label="Mục trên trang" className="hidden gap-1 lg:flex">
        {LANDING_SECTIONS.map(({ id, label }) => {
          const current = active === id;
          return <a key={id} href={`#${id}`} onClick={jump(id)} aria-current={current ? 'true' : undefined}
            className={cn('relative inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold motion-safe:transition-colors',
              'after:absolute after:inset-x-3 after:bottom-2 after:h-0.5 after:rounded-full after:bg-current motion-safe:after:transition-transform motion-safe:after:duration-300 hover:after:scale-x-100',
              current ? 'after:scale-x-100' : 'after:scale-x-0',
              overHero ? (current ? 'text-white' : 'text-brand-mint hover:text-white') : (current ? 'text-primary' : 'text-muted-foreground hover:text-primary'), focus)}>
            {label}
          </a>;
        })}
      </nav>
      <div className="flex gap-2">
        <Link to="/sign-in" className={cn('inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4.5 text-sm font-bold motion-safe:transition-colors max-[45rem]:w-11 max-[45rem]:px-0',
          overHero ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-white/80', focus)}>
          <LogIn aria-hidden="true" className="size-4.5" /><span className="max-[45rem]:sr-only">Đăng nhập</span>
        </Link>
        <Link to="/register" className={cn('inline-flex min-h-11 items-center justify-center rounded-lg border px-4.5 text-sm font-bold motion-safe:transition-colors max-[45rem]:hidden',
          overHero ? 'border-brand-lime/45 bg-transparent text-white hover:border-brand-lime hover:bg-white/8'
            : 'border-transparent bg-primary text-primary-foreground shadow-primary hover:bg-brand-hover', focus)}>
          Tạo tài khoản
        </Link>
      </div>
    </div>
    <m.div aria-hidden="true" style={progressStyle}
      className={cn('absolute inset-x-0 bottom-0 h-0.5 origin-left bg-linear-90 from-primary to-brand-lime-deep motion-safe:transition-opacity motion-safe:duration-300', overHero && 'opacity-0')} />
  </header>;
}
