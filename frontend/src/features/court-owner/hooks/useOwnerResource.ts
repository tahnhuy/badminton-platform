import { useApiResource } from '../../../shared/hooks/useApiResource';
export function useOwnerResource<T>(path: string | null, polling = false) {
  return useApiResource<T>(path ? `/api/v1/owner${path}` : null, polling);
}
