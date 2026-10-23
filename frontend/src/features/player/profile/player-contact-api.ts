import { httpClient } from '../../../shared/api/http-client';
export const playerContactApi = {
  async read() { return httpClient<{ data: { phone: string | null } }>('/api/v1/players/me/contact'); },
  async save(phone: string | null) { return httpClient<{ data: { phone: string | null } }>('/api/v1/players/me/contact', { method: 'PATCH', body: JSON.stringify({ phone }) }); },
};
