import { LoaderCircle } from 'lucide-react';
import { BrandLogo } from '@/components/common/brand-logo';
import { cn } from '@/shared/utils/cn';
import { AUTH_SURFACE_CLASS } from './auth-theme';

/** Shown by the route guard while the current session is being checked. */
export function SessionLoading({ label = 'Đang tải phiên đăng nhập…' }: { label?: string }) {
  return <div role="status" className={cn(AUTH_SURFACE_CLASS, 'flex flex-col items-center justify-center gap-5')}>
    <BrandLogo />
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <LoaderCircle aria-hidden="true" className="size-4 motion-safe:animate-spin" />{label}
    </p>
  </div>;
}
