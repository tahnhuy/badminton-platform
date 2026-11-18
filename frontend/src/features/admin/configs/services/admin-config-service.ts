import { httpClient } from '../../../../shared/api/http-client';
import type { ConfigItem, ConfigListParams, ConfigListResponse } from '../types/config';

const BASE_URL = '/api/v1/admin/configs';

export const adminConfigService = {
  async list(params: ConfigListParams = {}): Promise<ConfigListResponse> {
    const query = new URLSearchParams();
    if (params.domain) query.set('domain', params.domain);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    return httpClient<ConfigListResponse>(`${BASE_URL}?${query.toString()}`);
  },

  async update(configKey: string, value: string | number | boolean): Promise<ConfigItem> {
    const response = await httpClient<{ data: ConfigItem }>(`${BASE_URL}/${configKey}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
    return response.data;
  },
};
