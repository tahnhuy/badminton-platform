import type {
  FacilityListResponse,
  Facility,
  FacilityFilterParams,
  FacilityStatus,
  Court,
  CourtProfileChange,
} from '../types/facility';
import { getCsrfTokenFromCookie } from '../../../shared/api/http-client';

const BASE_URL = '/api/v1/admin/facilities';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = 'Đã có lỗi xảy ra';
    let errorDetails: Array<{ field: string; message: string }> = [];
    try {
      const errJson = await res.json();
      if (errJson.error?.message) {
        errorMessage = errJson.error.message;
      }
      if (errJson.error?.details && Array.isArray(errJson.error.details)) {
        errorDetails = errJson.error.details;
      }
    } catch {
      errorMessage = res.statusText || errorMessage;
    }
    const err: any = new Error(errorMessage);
    err.details = errorDetails;
    throw err;
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json();
}

const getAuthHeaders = (): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const csrfToken = getCsrfTokenFromCookie();
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }
  return headers;
};

export const adminFacilityService = {
  async fetchFacilities(params: FacilityFilterParams = {}): Promise<FacilityListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.city) query.set('city', params.city);
    if (params.condition) query.set('condition', params.condition);
    if (params.surfaceType) query.set('surfaceType', params.surfaceType);
    if (params.sort) query.set('sort', params.sort);

    const url = `${BASE_URL}?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<FacilityListResponse>(res);
  },

  async getFacilityById(id: number): Promise<{ data: Facility }> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<{ data: Facility }>(res);
  },

  async updateFacilityStatus(
    id: number,
    status: 'ACTIVE' | 'SUSPENDED',
    details?: { reason?: string; note?: string }
  ): Promise<{ data: Facility; message: string }> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, reason: details?.reason, note: details?.note }),
    });
    return handleResponse<{ data: Facility; message: string }>(res);
  },

  async updateCourtProfile(
    facilityId: number,
    courtId: number,
    payload: Record<string, unknown>
  ): Promise<{ data: Court }> {
    const res = await fetch(`${BASE_URL}/${facilityId}/courts/${courtId}/profile`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ data: Court }>(res);
  },

  async getCourtProfileHistory(
    facilityId: number,
    courtId: number,
    page = 1,
    limit = 10
  ): Promise<{ data: CourtProfileChange[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const res = await fetch(`${BASE_URL}/${facilityId}/courts/${courtId}/profile-changes?page=${page}&limit=${limit}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse(res);
  },

  async deleteFacility(id: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<void>(res);
  },

  async updateCourtStatus(
    facilityId: number,
    courtId: number,
    status: FacilityStatus
  ): Promise<{ data: any; message: string }> {
    const res = await fetch(`${BASE_URL}/${facilityId}/courts/${courtId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<{ data: any; message: string }>(res);
  },

  async createFacility(
    payload: any
  ): Promise<{ data: Facility; message: string }> {
    const res = await fetch(`${BASE_URL}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<{ data: Facility; message: string }>(res);
  },
};
