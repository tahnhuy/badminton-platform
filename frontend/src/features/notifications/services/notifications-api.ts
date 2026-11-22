import { httpClient } from '../../../shared/api/http-client';
import type { NotificationDetail, NotificationItem, NotificationList } from '../types';

const base = '/api/v1/notifications';

export const notificationsApi = {
  list: (params: { page?: number; limit?: number; isRead?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.isRead !== undefined) query.set('isRead', String(params.isRead));
    const suffix = query.toString();
    return httpClient<NotificationList>(`${base}${suffix ? `?${suffix}` : ''}`);
  },

  detail: async (id: number) => (await httpClient<{ data: NotificationDetail }>(`${base}/${id}`)).data,

  markRead: async (id: number) =>
    (await httpClient<{ data: NotificationItem }>(`${base}/${id}/read`, { method: 'POST' })).data,
};
