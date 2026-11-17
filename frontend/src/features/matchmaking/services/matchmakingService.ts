import { httpClient } from '../../../shared/api/http-client';
import type {
  MatchSummary, MatchDetail, MatchBookingCandidate,
  BrowseCandidatesParams,
  Candidate,
  CreateRequestPayload,
  Invitation,
  ListInvitationsParams,
  ListRequestsParams,
  MatchmakingRequestDetail,
  MatchmakingRequestSummary,
  Paginated,
  SkillLevel,
} from '../types/matchmaking';

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }
  return query.toString();
}

export const matchmakingService = {
  async listAreas(): Promise<string[]> {
    const areas = new Set<string>();
    let page = 1;
    for (;;) {
      const response = await httpClient<Paginated<{ facility: { city: string; district: string } }>>(`/api/v1/courts?page=${page}&limit=50`);
      for (const court of response.data) {
        if (court.facility.city && court.facility.district) areas.add(`${court.facility.district}, ${court.facility.city}`);
      }
      if (page >= response.meta.totalPages || response.data.length === 0) break;
      page++;
    }
    return [...areas].sort((a, b) => a.localeCompare(b, 'vi'));
  },
  async listMatches(page = 1): Promise<Paginated<MatchSummary>> {
    return httpClient(`/api/v1/matches?page=${page}&limit=10`);
  },
  async getMatch(id: number): Promise<MatchDetail> {
    const response = await httpClient<{ data: MatchDetail }>(`/api/v1/matches/${id}`);
    return response.data;
  },
  async leaveMatch(id: number): Promise<{ status: string }> {
    const response = await httpClient<{ data: { status: string } }>(`/api/v1/matches/${id}/leave`, { method: 'POST' });
    return response.data;
  },
  async listBookingCandidates(id: number): Promise<MatchBookingCandidate[]> {
    const response = await httpClient<{ data: MatchBookingCandidate[] }>(`/api/v1/matches/${id}/booking-candidates`);
    return response.data;
  },
  async linkBooking(id: number, bookingId: number): Promise<{ status: string; bookingId: number }> {
    const response = await httpClient<{ data: { status: string; bookingId: number } }>(`/api/v1/matches/${id}/booking`, {
      method: 'POST',
      body: JSON.stringify({ bookingId }),
    });
    return response.data;
  },
  async listSkillLevels(): Promise<SkillLevel[]> {
    const response = await httpClient<{ data: SkillLevel[] }>('/api/v1/skill-levels');
    return response.data;
  },

  async listRequests(params: ListRequestsParams = {}): Promise<Paginated<MatchmakingRequestSummary>> {
    return httpClient<Paginated<MatchmakingRequestSummary>>(
      `/api/v1/matchmaking-requests?${buildQuery({
        status: params.status,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      })}`
    );
  },

  async createRequest(payload: CreateRequestPayload): Promise<MatchmakingRequestDetail> {
    const response = await httpClient<{ data: MatchmakingRequestDetail }>('/api/v1/matchmaking-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return response.data;
  },

  async getRequest(requestId: number): Promise<MatchmakingRequestDetail> {
    const response = await httpClient<{ data: MatchmakingRequestDetail }>(
      `/api/v1/matchmaking-requests/${requestId}`
    );
    return response.data;
  },

  async cancelRequest(requestId: number): Promise<{ id: number; status: string }> {
    const response = await httpClient<{ data: { id: number; status: string } }>(
      `/api/v1/matchmaking-requests/${requestId}/cancel`,
      { method: 'POST' }
    );
    return response.data;
  },

  async browseCandidates(
    requestId: number,
    params: BrowseCandidatesParams = {}
  ): Promise<Paginated<Candidate>> {
    return httpClient<Paginated<Candidate>>(
      `/api/v1/matchmaking-requests/${requestId}/candidates?${buildQuery({
        search: params.search,
        includeOutOfRange: params.includeOutOfRange,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      })}`
    );
  },

  async sendInvitation(requestId: number, inviteeId: number): Promise<{ id: number; status: string }> {
    const response = await httpClient<{ data: { id: number; status: string } }>(
      `/api/v1/matchmaking-requests/${requestId}/invitations`,
      { method: 'POST', body: JSON.stringify({ inviteeId }) }
    );
    return response.data;
  },

  async listInvitations(params: ListInvitationsParams = {}): Promise<Paginated<Invitation>> {
    return httpClient<Paginated<Invitation>>(
      `/api/v1/matchmaking-invitations?${buildQuery({
        direction: params.direction ?? 'RECEIVED',
        status: params.status,
        page: params.page ?? 1,
        limit: params.limit ?? 10,
      })}`
    );
  },

  async respondInvitation(
    invitationId: number,
    decision: 'ACCEPTED' | 'DECLINED'
  ): Promise<{ invitationId: number; requestId: number; status: string; matchId: number | null }> {
    const response = await httpClient<{
      data: { invitationId: number; requestId: number; status: string; matchId: number | null };
    }>(`/api/v1/matchmaking-invitations/${invitationId}`, {
      method: 'PUT',
      body: JSON.stringify({ decision }),
    });
    return response.data;
  },

  async cancelInvitation(invitationId: number): Promise<{ id: number; status: string }> {
    const response = await httpClient<{ data: { id: number; status: string } }>(
      `/api/v1/matchmaking-invitations/${invitationId}/cancel`,
      { method: 'POST' }
    );
    return response.data;
  },

  async withdrawInvitation(invitationId: number): Promise<{ id: number; status: string }> {
    const response = await httpClient<{ data: { id: number; status: string } }>(
      `/api/v1/matchmaking-invitations/${invitationId}/withdraw`,
      { method: 'POST' }
    );
    return response.data;
  },
};
