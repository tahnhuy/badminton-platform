import { httpClient } from '../../../../shared/api/http-client';
import type { AdminPayout, AdminRefund, PayoutStatus, Reconciliation, RefundPageMeta, RefundStatus } from '../types';

const BASE = '/api/v1/admin/wallet';

export const adminWalletService = {
  async payouts(status?: PayoutStatus): Promise<AdminPayout[]> {
    const suffix = status ? `?status=${status}` : '';
    return (await httpClient<{ data: AdminPayout[] }>(`${BASE}/payouts${suffix}`)).data;
  },

  async approvePayout(id: number, note?: string): Promise<AdminPayout> {
    return (await httpClient<{ data: AdminPayout }>(`${BASE}/payouts/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })).data;
  },

  async rejectPayout(id: number, note: string): Promise<AdminPayout> {
    return (await httpClient<{ data: AdminPayout }>(`${BASE}/payouts/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    })).data;
  },

  async markPayoutPaid(id: number, transferReference: string): Promise<AdminPayout> {
    return (await httpClient<{ data: AdminPayout }>(`${BASE}/payouts/${id}/paid`, {
      method: 'POST',
      body: JSON.stringify({ transferReference }),
    })).data;
  },

  async refunds(params: { status?: RefundStatus; page?: number; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    return httpClient<{ data: AdminRefund[]; meta: RefundPageMeta }>(`${BASE}/refunds${suffix ? `?${suffix}` : ''}`);
  },

  async reconciliation(): Promise<Reconciliation> {
    return (await httpClient<{ data: Reconciliation }>(`${BASE}/reconciliation`)).data;
  },
};
