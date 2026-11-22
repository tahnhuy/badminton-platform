import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/common/brand-logo';
import { AUTH_SURFACE_CLASS } from './auth-theme';
import { SignInHero } from './sign-in-hero';

/** Sign-in page shell (D01): brand bar, hero art and the form panel. */
export function SignInLayout({ children }: { children: ReactNode }) {
  return <div className={AUTH_SURFACE_CLASS}>
    <div className="mx-auto max-w-360">
      <header className="flex h-18 items-center justify-between gap-5 min-[50.0625rem]:h-23">
        <BrandLogo />
        <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span aria-hidden="true" className="size-1 rounded-full bg-primary" />Cầu lông kết nối chúng ta.
        </p>
      </header>
      <div className="grid overflow-hidden rounded-panel border border-border bg-card shadow-panel min-[50.0625rem]:min-h-180 min-[50.0625rem]:grid-cols-[1.1fr_1fr]">
        <SignInHero />
        <main className="relative flex min-w-0 items-center justify-center overflow-hidden bg-card px-6 pb-10 pt-8 sm:px-9 min-[50.0625rem]:px-8 min-[50.0625rem]:py-16 xl:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border border-primary/5 ring-28 ring-primary/2" />
          {children}
        </main>
      </div>
      <footer className="px-1 py-5 text-xs text-muted-foreground">
        <p>SmashPro <span aria-hidden="true" className="px-2 opacity-50">/</span> Cộng đồng cầu lông</p>
      </footer>
    </div>
  </div>;
}
