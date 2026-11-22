import { useMemo, useState, type ReactNode } from 'react';
import type { TimeRangeValue } from '../../../shared/time-range';
import { AdminTimeRangeContext } from './admin-time-range-context';

export function AdminTimeRangeProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<TimeRangeValue>({ preset: 'month' });
  const value = useMemo(() => ({ range, setRange }), [range]);
  return <AdminTimeRangeContext.Provider value={value}>{children}</AdminTimeRangeContext.Provider>;
}
