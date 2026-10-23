import { httpClient } from '../../shared/api/http-client';

export type SystemRole = 'PLAYER' | 'COURT_OWNER' | 'ADMIN';

export interface AuthUser {
  id: number;
  email: string;
  role: SystemRole;
  requiresPasswordChange: boolean;
}

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string | null;
  skillLevelCode: string;
}

export interface SignInPayload {
  email: string;
  password: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface SkillLevel {
  code: string;
  name: string;
  rank: number;
  description: string | null;
}

export const authApi = {
  async register(payload: RegisterPayload): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async signIn(payload: SignInPayload): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async signOut(): Promise<void> {
    return httpClient<void>('/api/v1/auth/logout', {
      method: 'POST',
    });
  },

  async me(): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/me');
  },

  async changePassword(payload: ChangePasswordPayload): Promise<{ data: AuthUser }> {
    return httpClient<{ data: AuthUser }>('/api/v1/auth/password/change', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listSkillLevels(): Promise<{ data: SkillLevel[] }> {
    return httpClient<{ data: SkillLevel[] }>('/api/v1/skill-levels');
  },
};
