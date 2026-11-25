import { httpClient } from '../../../shared/api/http-client';
import type { Facility, Meta } from '../types/owner';
const root = '/api/v1/owner';
export const ownerApi = {
  get<T>(path: string, signal?: AbortSignal) { return httpClient<T>(root + path, { signal }); },
  write<T = unknown>(path: string, body: unknown, method: 'POST' | 'PUT' = 'POST') { return httpClient<{ data: T }>(root + path, { method, body: JSON.stringify(body) }); },
  upload<T = unknown>(path: string, body: FormData) { return httpClient<{ data: T }>(root + path, { method: 'POST', body }); },
  async facilities(signal?: AbortSignal) {
    const rows: Facility[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await this.get<{ data: Facility[]; meta: Meta }>(`/facilities?page=${page}&limit=100`, signal);
      rows.push(...result.data); totalPages = result.meta.totalPages; page += 1;
    } while (page <= totalPages);
    return rows;
  },
};
