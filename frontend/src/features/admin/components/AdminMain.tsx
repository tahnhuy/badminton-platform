import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

/** Shared presentation wrapper; each existing Admin page retains its own sidebar state and overlays. */
export function AdminMain({ isCollapsed, children }: { isCollapsed: boolean; children: ReactNode }) {
  return <div className={cn('flex min-w-0 flex-1 flex-col transition-[margin-left] duration-200 motion-reduce:transition-none', isCollapsed ? 'lg:ml-17' : 'lg:ml-60')}>{children}</div>;
}
