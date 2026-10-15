import { httpClient } from '../../../shared/api/http-client';
import type {
  CreateRatingsResult,
  CreateRatingItem,
  PendingResponse,
  RatingSummary,
  SkillAdjustmentRow,
  UserRatingRow,
} from '../types/ratings';

interface ListEnvelope<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

const MATCH_BASE = '/api/v1/matches';
const USER_BASE = '/api/v1/users';

export const ratingsService = {
  async getPending(matchId: number): Promise<PendingResponse> {
    const res = await httpClient<{ data: PendingResponse }>(
      `${MATCH_BASE}/${matchId}/ratings/pending`
    );
    return res.data;
  },

  async submitRatings(matchId: number, ratings: CreateRatingItem[]): Promise<CreateRatingsResult> {
    const res = await httpClient<{ data: CreateRatingsResult }>(
      `${MATCH_BASE}/${matchId}/ratings`,
      { method: 'POST', body: JSON.stringify({ ratings }) }
    );
    return res.data;
  },

  async getGivenRatings(userId: number, page = 1, limit = 20): Promise<ListEnvelope<UserRatingRow>> {
    return httpClient<ListEnvelope<UserRatingRow>>(
      `${USER_BASE}/${userId}/ratings?direction=given&page=${page}&limit=${limit}`
    );
  },

  async getReceivedRatings(userId: number, page = 1, limit = 20): Promise<ListEnvelope<UserRatingRow>> {
    return httpClient<ListEnvelope<UserRatingRow>>(
      `${USER_BASE}/${userId}/ratings?direction=received&page=${page}&limit=${limit}`
    );
  },

  async getSkillAdjustments(userId: number, page = 1, limit = 20): Promise<ListEnvelope<SkillAdjustmentRow>> {
    return httpClient<ListEnvelope<SkillAdjustmentRow>>(
      `${USER_BASE}/${userId}/skill-adjustments?page=${page}&limit=${limit}`
    );
  },

  async getSummary(userId: number): Promise<RatingSummary> {
    const res = await httpClient<{ data: RatingSummary }>(`${USER_BASE}/${userId}/ratings/summary`);
    return res.data;
  },
};
