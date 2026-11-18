import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/common/brand-logo';
import { AUTH_SURFACE_CLASS } from './auth-theme';

/** Focused single-card page for signed-in account steps (change password, access denied). No marketing panel. */
export function AuthFocusLayout({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return <div className={AUTH_SURFACE_CLASS}>
    <div className="mx-auto flex min-h-svh max-w-360 flex-col">
      <header className="flex h-18 shrink-0 items-center justify-between gap-5 min-[50.0625rem]:h-23">
        <BrandLogo />
        {action}
      </header>
      <main className="flex flex-1 items-center justify-center pb-10 pt-2 sm:pb-16">
        <div className="w-full max-w-110 rounded-brand border border-brand-border bg-card px-6 py-8 shadow-brand sm:px-10 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  </div>;
}
