import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookingService } from '../services/bookingService';
import type { CourtSearchParams, CourtSearchResponse } from '../types/booking';
import { todayIso } from '../utils/booking';
import {
  readCourtSearch, toCourtSearchParams, writeCourtSearch, type CourtFilterValues, type CourtSearchState,
} from '../utils/courtSearch';

/** Court search is public data, so keys are not scoped by account. */
export const courtSearchKey = (params: CourtSearchParams) => ['courts', 'search', params] as const;

const searchQuery = (params: CourtSearchParams) => ({
  queryKey: courtSearchKey(params),
  queryFn: ({ signal }: { signal: AbortSignal }) => bookingService.searchCourts(params, signal),
});

export function useCourtSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const today = todayIso();
  const state = useMemo(() => readCourtSearch(searchParams, today), [searchParams, today]);
  const params = useMemo(() => toCourtSearchParams(state), [state]);

  const results = useQuery({ ...searchQuery(params), placeholderData: keepPreviousData });
  const totalPages = results.data?.meta.totalPages ?? 0;
  // The next page tells whether the last facility on this page continues there (and makes paging instant).
  const nextPage = useQuery({ ...searchQuery({ ...params, page: state.page + 1 }), enabled: !results.isPlaceholderData && state.page < totalPages });
  const previousPage = state.page > 1
    ? queryClient.getQueryData<CourtSearchResponse>(courtSearchKey({ ...params, page: state.page - 1 }))
    : undefined;

  const navigate = useCallback((next: CourtSearchState) => {
    setSearchParams(writeCourtSearch(next, searchParams, today));
  }, [searchParams, setSearchParams, today]);

  return {
    state,
    results,
    hasWindow: Boolean(state.from && state.to),
    nextPageFirstFacilityId: nextPage.data?.data[0]?.facility.id,
    previousPageLastFacilityId: previousPage?.data.at(-1)?.facility.id,
    apply: (values: CourtFilterValues) => navigate({ ...values, page: 1 }),
    reset: () => navigate({ city: '', district: '', date: today, from: '', to: '', page: 1 }),
    goToPage: (page: number) => navigate({ ...state, page }),
  };
}
