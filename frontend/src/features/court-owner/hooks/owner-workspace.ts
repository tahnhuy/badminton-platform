import { createContext, useContext } from 'react';
import type { Facility } from '../types/owner';
export const OwnerWorkspace = createContext<{ facilities: Facility[]; facilityId: number | null; select: (id: number) => void; refresh: () => void } | null>(null);
export function useOwnerWorkspace() { const value = useContext(OwnerWorkspace); if (!value) throw new Error('Owner workspace missing'); return value; }
