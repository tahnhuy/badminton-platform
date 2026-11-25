import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { httpClient } from '@/shared/api/http-client';
import { tournamentApi } from './tournament-api';
import { errorMessage } from './format';
import type { ListFilters, ResultInput, TournamentStatus } from './types';

/** TanStack Query keys and hooks of the Tournament feature (TRN-07/08). */
export const tournamentKeys = {
  all: ['tournaments'] as const,
  list: (filters: ListFilters) => ['tournaments', 'list', filters] as const,
  mine: (role: string) => ['tournaments', 'mine', role] as const,
  detail: (id: number) => ['tournaments', id, 'detail'] as const,
  participants: (id: number) => ['tournaments', id, 'participants'] as const,
  bracket: (id: number) => ['tournaments', id, 'bracket'] as const,
  schedule: (id: number) => ['tournaments', id, 'schedule'] as const,
  seeds: (id: number) => ['tournaments', id, 'seeds'] as const,
  one: (id: number) => ['tournaments', id] as const,
};

/** Live states refresh every 30 s until realtime arrives (TRN-15). */
export const LIVE_STATUSES: readonly TournamentStatus[] = ['READY', 'IN_PROGRESS'];
const liveInterval = (status?: TournamentStatus) => (status && LIVE_STATUSES.includes(status) ? 30_000 : false);

export const skillLevelOptionsQuery = queryOptions({
  queryKey: ['skill-levels', 'with-id'] as const,
  queryFn: async () => (await httpClient<{ data: Array<{ id: number; code: string; name: string; rank: number }> }>('/api/v1/skill-levels')).data
    .sort((a, b) => a.rank - b.rank),
  staleTime: 5 * 60_000,
});

export function useTournamentList(filters: ListFilters) {
  return useQuery({ queryKey: tournamentKeys.list(filters), queryFn: () => tournamentApi.list(filters), placeholderData: keepPreviousData });
}

export function useMyTournaments(role: 'organized' | 'registered' | 'invited') {
  return useQuery({ queryKey: tournamentKeys.mine(role), queryFn: () => tournamentApi.mine(role) });
}

export function useTournament(id: number) {
  return useQuery({
    queryKey: tournamentKeys.detail(id),
    queryFn: () => tournamentApi.detail(id),
    refetchInterval: query => liveInterval(query.state.data?.status),
  });
}

export function useParticipants(id: number, enabled = true) {
  return useQuery({ queryKey: tournamentKeys.participants(id), queryFn: () => tournamentApi.participants(id), enabled });
}

export function useBracket(id: number, status?: TournamentStatus, enabled = true) {
  return useQuery({ queryKey: tournamentKeys.bracket(id), queryFn: () => tournamentApi.bracket(id), enabled, refetchInterval: liveInterval(status) });
}

export function useSchedule(id: number, status?: TournamentStatus, enabled = true) {
  return useQuery({ queryKey: tournamentKeys.schedule(id), queryFn: () => tournamentApi.schedule(id), enabled, refetchInterval: liveInterval(status) });
}

export function useSeeds(id: number, enabled = true) {
  return useQuery({ queryKey: tournamentKeys.seeds(id), queryFn: () => tournamentApi.seeds(id), enabled });
}

/**
 * Mutation that refreshes everything of the tournament (detail, lists, bracket, schedule, seeds)
 * and shows the Vietnamese error message; `onDone` runs after a successful refresh.
 */
export function useTournamentMutation<TArgs, TResult>(id: number | null, fn: (args: TArgs) => Promise<TResult>, success?: string | ((result: TResult) => string)) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async result => {
      await Promise.all([
        id !== null ? client.invalidateQueries({ queryKey: tournamentKeys.one(id) }) : Promise.resolve(),
        client.invalidateQueries({ queryKey: ['tournaments', 'list'] }),
        client.invalidateQueries({ queryKey: ['tournaments', 'mine'] }),
        client.invalidateQueries({ queryKey: ['wallet'] }),
      ]);
      if (success) toast.success(typeof success === 'function' ? success(result) : success);
    },
    onError: error => { toast.error(errorMessage(error)); },
  });
}

export function useMatchResult(id: number) {
  return useTournamentMutation(id, ({ matchId, input }: { matchId: number; input: ResultInput }) => tournamentApi.result(id, matchId, input));
}
