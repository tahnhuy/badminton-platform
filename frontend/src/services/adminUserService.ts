import type {
  UserListResponse,
  UserDetailResponse,
  UserFilterParams,
  UserStatus,
  CreateUserPayload,
} from '../types/user';
import { getCsrfTokenFromCookie } from '../shared/api/http-client';

const BASE_URL = '/api/v1/admin/users';

// Helper to handle response and parse error
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMessage = 'Đã có lỗi xảy ra';
    try {
      const errJson = await res.json();
      if (errJson.error?.message) {
        errorMessage = errJson.error.message;
      }
    } catch {
      errorMessage = res.statusText || errorMessage;
    }
    throw new Error(errorMessage);
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

export const adminUserService = {
  async fetchUsers(params: UserFilterParams = {}): Promise<UserListResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    if (params.sort) query.set('sort', params.sort);

    const url = `${BASE_URL}?${query.toString()}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<UserListResponse>(res);
  },

  async createUser(payload: CreateUserPayload): Promise<UserDetailResponse> {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<UserDetailResponse>(res);
  },

  async fetchUserDetails(id: number): Promise<UserDetailResponse> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    return handleResponse<UserDetailResponse>(res);
  },

  async updateUserStatus(id: number, status: UserStatus): Promise<UserDetailResponse> {
    const res = await fetch(`${BASE_URL}/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status }),
    });
    return handleResponse<UserDetailResponse>(res);
  },

  async bulkUpdateStatus(ids: number[], status: UserStatus): Promise<{ affectedCount: number }> {
    const res = await fetch(`${BASE_URL}/bulk/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids, status }),
    });
    return handleResponse<{ affectedCount: number }>(res);
  },

  async deleteUser(id: number): Promise<void> {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    return handleResponse<void>(res);
  },

  async bulkDeleteUsers(ids: number[]): Promise<{ affectedCount: number }> {
    const res = await fetch(`${BASE_URL}/bulk/delete`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids }),
    });
    return handleResponse<{ affectedCount: number }>(res);
  },

  async resetPassword(id: number, newPassword: string): Promise<UserDetailResponse> {
    const res = await fetch(`${BASE_URL}/${id}/password`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ new_password: newPassword }),
    });
    return handleResponse<UserDetailResponse>(res);
  },
};
