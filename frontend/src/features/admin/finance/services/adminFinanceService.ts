import { httpClient } from '../../../../shared/api/http-client';
import type {
  FinanceAudit,
  FinanceWalletEntry,
  FinanceOverview,
  FinanceOwnerEarning,
  FinancePageMeta,
  FinancePayout,
  FinanceReconciliation,
  FinanceRefund,
  FinanceReport,
  FinanceTopUp,
  FinanceTransaction,
  FinanceWallet,
} from '../types';

const BASE = '/api/v1/admin/finance';

function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const suffix = search.toString();
  return suffix ? `?${suffix}` : '';
}

export type FinanceExportType =
  | 'transactions'
  | 'top-ups'
  | 'payouts'
  | 'refunds'
  | 'revenue'
  | 'cash-flow'
  | 'reconciliation';

export const adminFinanceService = {
  overview(params: { range?: string; startDate?: string; endDate?: string } = {}) {
    return httpClient<{ data: FinanceOverview }>(`${BASE}/overview${qs(params)}`).then(r => r.data);
  },

  transactions(params: Record<string, string | number | undefined> = {}) {
    return httpClient<{ data: FinanceTransaction[]; meta: FinancePageMeta }>(`${BASE}/transactions${qs(params)}`);
  },

  transactionDetail(source: string, id: number) {
    return httpClient<{ data: unknown }>(`${BASE}/transactions/${source}/${id}`).then(r => r.data);
  },

  wallet(userId: number) {
    return httpClient<{ data: FinanceWallet }>(`${BASE}/wallets/${userId}`).then(r => r.data);
  },

  walletEntries(userId: number, params: { page?: number; limit?: number } = {}) {
    return httpClient<{ data: FinanceWalletEntry[]; meta: FinancePageMeta }>(`${BASE}/wallets/${userId}/entries${qs(params)}`);
  },

  walletHolds(userId: number, params: { page?: number; limit?: number; status?: string } = {}) {
    return httpClient<{ data: unknown[]; meta: FinancePageMeta }>(`${BASE}/wallets/${userId}/holds${qs(params)}`);
  },

  creditWallet(userId: number, body: { amount: string; reason: string }) {
    return httpClient<{ data: unknown }>(`${BASE}/wallets/${userId}/credit`, { method: 'POST', body: JSON.stringify(body) });
  },

  debitWallet(userId: number, body: { amount: string; reason: string }) {
    return httpClient<{ data: unknown }>(`${BASE}/wallets/${userId}/debit`, { method: 'POST', body: JSON.stringify(body) });
  },

  topUps(params: Record<string, string | number | undefined> = {}) {
    return httpClient<{ data: FinanceTopUp[]; meta: FinancePageMeta }>(`${BASE}/top-ups${qs(params)}`);
  },

  manualMatchTopUp(body: { provider: string; providerReference: string; amount: string; userId: number; reason: string }) {
    return httpClient<{ data: FinanceTopUp }>(`${BASE}/top-ups/1/manual-match`, { method: 'POST', body: JSON.stringify(body) });
  },

  payouts(params: Record<string, string | number | undefined> = {}) {
    return httpClient<{ data: FinancePayout[]; meta: FinancePageMeta }>(`${BASE}/payouts${qs(params)}`);
  },

  approvePayout(id: number, note?: string) {
    return httpClient<{ data: FinancePayout }>(`${BASE}/payouts/${id}/approve`, { method: 'POST', body: JSON.stringify({ note }) });
  },

  rejectPayout(id: number, note: string) {
    return httpClient<{ data: FinancePayout }>(`${BASE}/payouts/${id}/reject`, { method: 'POST', body: JSON.stringify({ note }) });
  },

  markPayoutPaid(id: number, transferReference: string) {
    return httpClient<{ data: FinancePayout }>(`${BASE}/payouts/${id}/paid`, { method: 'POST', body: JSON.stringify({ transferReference }) });
  },

  refunds(params: Record<string, string | number | undefined> = {}) {
    return httpClient<{ data: FinanceRefund[]; meta: FinancePageMeta }>(`${BASE}/refunds${qs(params)}`);
  },

  retryRefund(paymentId: number) {
    return httpClient<{ data: FinanceRefund }>(`${BASE}/refunds/${paymentId}/retry`, { method: 'POST' });
  },

  resolveRefund(paymentId: number, note: string) {
    return httpClient<{ data: unknown }>(`${BASE}/refunds/${paymentId}/resolve-note`, { method: 'POST', body: JSON.stringify({ note }) });
  },

  ownerEarnings(params: Record<string, string | number | undefined> = {}) {
    return httpClient<{ data: FinanceOwnerEarning[]; meta: FinancePageMeta }>(`${BASE}/owner-earnings${qs(params)}`);
  },

  sweepOwnerEarnings(body: { from?: string; to?: string; limit?: number; dryRun?: boolean } = {}) {
    return httpClient<{ data: { scanned: number; credited: number; skipped: number; failed: number; dryRun: boolean } }>(
      `${BASE}/owner-earnings/sweep`,
      { method: 'POST', body: JSON.stringify(body) },
    );
  },

  reconciliation(params: { range?: string; startDate?: string; endDate?: string } = {}) {
    return httpClient<{ data: FinanceReconciliation }>(`${BASE}/reconciliation${qs(params)}`).then(r => r.data);
  },

  resolveReconciliation(key: string, note: string) {
    return httpClient<{ data: unknown }>(`${BASE}/reconciliation/discrepancies/${encodeURIComponent(key)}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  },

  revenue(params: { range?: string; groupBy?: string } = {}) {
    return httpClient<{ data: FinanceReport }>(`${BASE}/reports/revenue${qs(params)}`).then(r => r.data);
  },

  cashFlow(params: { range?: string } = {}) {
    return httpClient<{ data: FinanceReport }>(`${BASE}/reports/cash-flow${qs(params)}`).then(r => r.data);
  },

  audit(params: Record<string, string | number | undefined> = {}) {
    return httpClient<{ data: FinanceAudit[]; meta: FinancePageMeta }>(`${BASE}/audit${qs(params)}`);
  },

  async downloadExport(type: FinanceExportType, params: Record<string, string | number | undefined> = {}): Promise<void> {
    const response = await fetch(`${BASE}/exports/${type}${qs(params)}`, { credentials: 'same-origin' });
    if (!response.ok) {
      let message = 'Không thể xuất Excel.';
      try {
        const body = await response.json();
        message = body?.error?.message || message;
      } catch {
        // ignore non-JSON errors
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] || `finance-${type}.xlsx`;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },
};
