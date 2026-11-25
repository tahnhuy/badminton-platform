import type { ReactNode } from 'react';

/** Keep long audit lists inside a keyboard-accessible, two-axis scroll region. */
export function AuditScrollArea({ label, children }: { label: string; children: ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0}
    className="max-h-112 w-full min-w-0 max-w-full overflow-auto overscroll-contain rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <div className="w-max min-w-full space-y-3 p-1 [&>article]:min-w-160 [&>section]:min-w-160">
      {children}
    </div>
  </div>;
}
