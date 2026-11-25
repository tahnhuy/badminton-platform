import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/common/brand-logo';
import { cn } from '@/shared/utils/cn';
import { AUTH_SURFACE_CLASS, BRAND_HOME_LINK_CLASS } from '../auth-theme';
import { AuthHomeLink } from '../auth-home-link';

/** Page frame of `/register` and `/register/result`: brand bar on the Auth surface (Sign-in visual language). */
export function RegisterShell({ children, note, signInLink = true, className }:
  { children: ReactNode; note?: string; signInLink?: boolean; className?: string }) {
  return <div className={cn(AUTH_SURFACE_CLASS, 'bg-[radial-gradient(75rem_31rem_at_10%_-10%,var(--color-accent),transparent_60%)]', className)}>
    <div className="mx-auto max-w-350 pb-10">
      <header className="flex min-h-18 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3 lg:min-h-23">
        <Link to="/" aria-label="Về trang giới thiệu SmashPro" className={BRAND_HOME_LINK_CLASS}><BrandLogo /></Link>
        {note && <p className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground md:flex">
          <span aria-hidden="true" className="size-1.75 rounded-full bg-primary motion-safe:animate-pulse" />{note}
        </p>}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <AuthHomeLink />
        {signInLink && <Link to="/sign-in" className="inline-flex min-h-11 items-center rounded-md text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          <span className="hidden sm:inline">Đã có tài khoản?&nbsp;</span><strong className="whitespace-nowrap text-primary">Đăng nhập</strong>
        </Link>}
        </div>
      </header>
      {children}
    </div>
  </div>;
}
