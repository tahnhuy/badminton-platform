import type {
  FacilityListResponse,
  Facility,
  FacilityFilterParams,
  FacilityStatus,
} from '../types/facility';

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
  return {
    'Content-Type': 'application/json',
    'x-user-email': 'admin@smashpro.vn',
  };
};

export const adminFacilityService = {
  async fetchFacilities(params: FacilityFilterParams = {}): Promise<FacilityListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.status) query.set('status', params.status);
    if (params.city) query.set('city', params.city);
    if (params.bwfStandard) query.set('bwfStandard', params.bwfStandard);
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

  async updateFacilityStatus(id: number, status: FacilityStatus): Promise<{ data: Facility; message: string }> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<{ data: Facility; message: string }>(res);
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
