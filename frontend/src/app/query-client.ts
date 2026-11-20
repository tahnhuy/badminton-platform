import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@/shared/api/http-client';

const MAX_RETRIES = 2;

/**
 * Retries only transient failures (network errors and 5xx). Client errors such
 * as 401/403 are handled once by the global auth handler in `http-client` and
 * must not be repeated.
 */
export function shouldRetryRequest(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof ApiError) return error.statusCode >= 500;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryRequest,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
