import { httpClient, ApiError } from '../../../shared/api/http-client';

export interface RatingDimension { average: number | null; count: number; notEnoughData: boolean }
export interface PlayerProfile {
  userId: number;
  fullName: string;
  avatarUrl: string | null;
  skillLevel: { code: string; name: string; rank: number; description: string | null };
  /** Initial survey level not yet confirmed by an official promotion (AUTH-30/32). */
  isSkillTentative?: boolean;
  ratings: { skill: RatingDimension; attitude: RatingDimension } | null;
  stats: { matchesPlayed: number; wins: number; losses: number; resultsAvailable: boolean } | null;
}
export const profileApi = {
  async uploadAvatar(file: File): Promise<string> {
    const body = new FormData(); body.append('avatar', file);
    return (await httpClient<{ data: { avatarUrl: string } }>('/api/v1/players/me/avatar', { method: 'POST', body })).data.avatarUrl;
  },
  /** Whether the signed-in Player has a registration survey result (404 → false). */
  async hasOwnSkillSurvey(signal?: AbortSignal): Promise<boolean> {
    try {
      await httpClient<{ data: unknown }>('/api/v1/players/me/skill-survey', { signal });
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) return false;
      throw error;
    }
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
