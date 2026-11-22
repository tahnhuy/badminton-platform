import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import type { CourtSearchParams } from '../types/booking';
import { todayIso } from '../utils/booking';
import {
  readCourtSearch, toCourtSearchParams, writeCourtSearch, type CourtFilterValues, type CourtSearchState,
} from '../utils/courtSearch';

/** Court search is public data, so keys are not scoped by account. */
export const facilitySearchKey = (params: CourtSearchParams) => ['facilities', 'search', params] as const;

export function useCourtSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = todayIso();
  const state = useMemo(() => readCourtSearch(searchParams, today), [searchParams, today]);
  const params = useMemo(() => toCourtSearchParams(state), [state]);

  const results = useQuery({
    queryKey: facilitySearchKey(params),
    queryFn: ({ signal }) => bookingService.searchFacilities(params, signal),
    placeholderData: keepPreviousData,
  });

  const navigate = useCallback((next: CourtSearchState) => {
    setSearchParams(writeCourtSearch(next, searchParams, today));
  }, [searchParams, setSearchParams, today]);

  return {
    state,
    results,
    hasWindow: Boolean(state.from && state.to),
    apply: (values: CourtFilterValues) => navigate({ ...values, page: 1 }),
    reset: () => navigate({ name: '', city: '', district: '', date: today, from: '', to: '', page: 1 }),
    goToPage: (page: number) => navigate({ ...state, page }),
  };
}
