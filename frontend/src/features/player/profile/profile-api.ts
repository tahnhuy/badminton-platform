import { httpClient, ApiError } from '../../../shared/api/http-client';

export interface RatingDimension { average: number | null; count: number; notEnoughData: boolean }
export interface PlayerProfile {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  skillLevel: { code: string; name: string; rank: number; description: string | null };
  ratings: { skill: RatingDimension; attitude: RatingDimension } | null;
  stats: { matchesPlayed: number; wins: number; losses: number; resultsAvailable: boolean } | null;
}
export const profileApi = {
  async uploadAvatar(file: File): Promise<string> {
    const body = new FormData(); body.append('avatar', file);
    return (await httpClient<{ data: { avatarUrl: string } }>('/api/v1/players/me/avatar', { method: 'POST', body })).data.avatarUrl;
  },
  async own(signal?: AbortSignal): Promise<PlayerProfile> {
    return (await httpClient<{ data: PlayerProfile }>('/api/v1/players/me', { signal })).data;
  },
  async publicProfile(id: number, signal?: AbortSignal): Promise<PlayerProfile> {
    return (await httpClient<{ data: PlayerProfile }>(`/api/v1/players/${id}`, { signal })).data;
  },
  async updateName(fullName: string): Promise<PlayerProfile> {
    return (await httpClient<{ data: PlayerProfile }>('/api/v1/players/me', {
      method: 'PATCH', body: JSON.stringify({ fullName: fullName.trim() }),
    })).data;
  },
};
export function profileError(error: unknown): string {
  if (error instanceof ApiError && error.code === 'PLAYER_NOT_FOUND') return 'Hồ sơ không khả dụng.';
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') return 'Tên hiển thị cần có từ 2 đến 50 ký tự.';
  return 'Không thể tải hoặc cập nhật hồ sơ. Vui lòng thử lại.';
}
