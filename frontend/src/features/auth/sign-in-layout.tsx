import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/common/brand-logo';
import { SignInHero } from './sign-in-hero';

/** Opt-in D01 shell. Legacy AuthLayout remains with its existing consumers. */
export function SignInLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-svh bg-brand-page px-3.5 font-sans text-brand-ink [--border:var(--color-brand-border)] [--foreground:var(--color-brand-ink)] [--input:var(--color-brand-border)] [--muted-foreground:var(--color-brand-muted)] sm:px-6 xl:px-7.5">
    <div className="mx-auto max-w-360">
      <header className="flex h-18 items-center justify-between gap-5 min-[50.0625rem]:h-23">
        <BrandLogo />
        <p className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
          <span aria-hidden="true" className="size-1 rounded-full bg-primary" />Cầu lông kết nối chúng ta.
        </p>
      </header>
      <div className="grid overflow-hidden rounded-brand border border-brand-border bg-card shadow-brand min-[50.0625rem]:min-h-180 min-[50.0625rem]:grid-cols-[1.1fr_1fr]">
        <SignInHero />
        <main className="relative flex min-w-0 items-center justify-center overflow-hidden bg-card px-6 pb-14 pt-8 sm:px-9 min-[50.0625rem]:px-8 min-[50.0625rem]:py-16 xl:px-12">
          <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full border border-primary/5 ring-28 ring-primary/2" />
          {children}
          <p className="absolute inset-x-4 bottom-6 text-center text-[0.5rem] tracking-[0.16em] text-muted-foreground">GẶP ĐỒNG ĐỘI. CHUNG NIỀM VUI.</p>
        </main>
      </div>
      <footer className="flex justify-between gap-5 px-1 py-5 text-[0.625rem] text-muted-foreground">
        <p>SmashPro <span aria-hidden="true" className="px-2 opacity-50">/</span> Cộng đồng cầu lông</p>
        <p className="hidden sm:block">Gặp nhau trên sân. Gắn kết ngoài sân.</p>
      </footer>
    </div>
  </div>;
}
