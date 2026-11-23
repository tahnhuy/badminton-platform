import { createContext, useContext } from 'react';
import type { TimeRangeValue } from '../../../shared/time-range';

export interface AdminTimeRangeContextValue {
  range: TimeRangeValue;
  setRange: (range: TimeRangeValue) => void;
}

export const AdminTimeRangeContext = createContext<AdminTimeRangeContextValue | null>(null);

export function useAdminTimeRange(): AdminTimeRangeContextValue {
  const context = useContext(AdminTimeRangeContext);
  if (!context) throw new Error('useAdminTimeRange must be used within AdminTimeRangeProvider');
  return context;
}
