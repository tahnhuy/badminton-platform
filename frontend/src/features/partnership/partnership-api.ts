import { httpClient } from '@/shared/api/http-client';

/** Court Owner partnership requests (docs/features/court-owner/partnership-request/tech-design.md §5). */

export type OwnerRequestStatus = 'PENDING' | 'CONTACTED' | 'APPROVED' | 'REJECTED';

export interface OwnerRequestSubmission {
  contactName: string;
  email: string;
  phone: string;
  facilityName: string;
  addressLine: string;
  district: string;
  city: string;
  expectedCourts: number;
  note?: string;
  consent: true;
  /** Hidden bot field; people leave it empty. */
  website: string;
}

export interface OwnerRequestUserRef { id: number; email: string }

export interface OwnerRequest {
  id: number;
  contactName: string;
  email: string;
  phone: string;
  facilityName: string;
  addressLine: string;
  district: string;
  city: string;
  expectedCourts: number;
  note: string | null;
  status: OwnerRequestStatus;
  adminNote: string | null;
  rejectReason: string | null;
  processedAt: string | null;
  processedBy: OwnerRequestUserRef | null;
  createdUser: OwnerRequestUserRef | null;
  submittedIp: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OwnerRequestCounts = Record<OwnerRequestStatus, number>;

export interface OwnerRequestPage {
  data: OwnerRequest[];
  meta: { page: number; limit: number; total: number; totalPages: number; counts: OwnerRequestCounts };
}

export const OWNER_REQUEST_STATUS_LABELS: Record<OwnerRequestStatus, string> = {
  PENDING: 'Chờ xử lý',
  CONTACTED: 'Đã liên hệ',
  APPROVED: 'Đã tạo tài khoản',
  REJECTED: 'Đã từ chối',
};

export const isOpenOwnerRequest = (status: OwnerRequestStatus) => status === 'PENDING' || status === 'CONTACTED';

/** Fired after every Admin change so the sidebar badge refreshes. */
export const ADMIN_OWNER_REQUESTS_CHANGED_EVENT = 'admin-owner-requests-changed';

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) });

export const partnershipApi = {
  availability: () => httpClient<{ data: { enabled: boolean } }>('/api/v1/owner-requests/availability'),
  submit: (body: OwnerRequestSubmission) => httpClient<{ data: { received: true } }>('/api/v1/owner-requests', json(body)),
};

async function changed<T>(request: Promise<T>): Promise<T> {
  const result = await request;
  window.dispatchEvent(new Event(ADMIN_OWNER_REQUESTS_CHANGED_EVENT));
  return result;
}

const base = '/api/v1/admin/owner-requests';

export const adminOwnerRequestApi = {
  list(params: { status?: OwnerRequestStatus | ''; q?: string; page: number; limit: number }) {
    const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
    if (params.status) query.set('status', params.status);
    if (params.q?.trim()) query.set('q', params.q.trim());
    return httpClient<OwnerRequestPage>(`${base}?${query.toString()}`);
  },
  get: (id: number) => httpClient<{ data: OwnerRequest }>(`${base}/${id}`),
  pendingCount: () => httpClient<{ data: { count: number } }>(`${base}/pending-count`),
  saveNote: (id: number, adminNote: string) =>
    changed(httpClient<{ data: OwnerRequest }>(`${base}/${id}/note`, { method: 'PATCH', body: JSON.stringify({ adminNote }) })),
  markContacted: (id: number) => changed(httpClient<{ data: OwnerRequest }>(`${base}/${id}/contact`, json({}))),
  approve: (id: number, body: { businessName: string; phone: string }) =>
    changed(httpClient<{ data: OwnerRequest }>(`${base}/${id}/approve`, json(body))),
  reject: (id: number, reason: string) => changed(httpClient<{ data: OwnerRequest }>(`${base}/${id}/reject`, json({ reason }))),
};
