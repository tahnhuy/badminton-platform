export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type MatchType = 'SINGLES' | 'DOUBLES' | 'GROUP';
export type RequestStatus = 'OPEN' | 'MATCHED' | 'CANCELLED' | 'EXPIRED';
export type InvitationStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export interface SkillInfo {
  id: number | null;
  code: string | null;
  name: string | null;
  rank: number | null;
}

export interface SkillLevel {
  id: number;
  code: string;
  name: string;
  rank: number;
  description: string | null;
}

export interface RequestMember {
  playerId: number;
  displayName: string | null;
  skill: SkillInfo | null;
  isOwner: boolean;
}

export interface MatchmakingRequestSummary {
  id: number;
  isOwner: boolean;
  matchType: MatchType;
  status: RequestStatus;
  preferredDate: string | null;
  preferredStartTime: string | null;
  preferredEndTime: string | null;
  area: string | null;
  matchDurationMinutes: number;
  expiresAt: string | null;
  createdAt: string;
  requiredPlayers: number;
  acceptedCount: number;
  remainingCount: number;
  matchId: number | null;
}

export interface MatchmakingRequestDetail extends MatchmakingRequestSummary {
  invitationId: number | null;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  currentPlayers: number;
  isOwner: boolean;
  members: RequestMember[];
}

export interface Candidate {
  playerId: number;
  displayName: string | null;
  skill: SkillInfo | null;
  skillMismatch: boolean;
}

export interface Invitation {
  matchId: number | null;
  id: number;
  requestId: number;
  direction: 'RECEIVED' | 'SENT';
  status: InvitationStatus;
  expiresAt: string;
  respondedAt: string | null;
  createdAt: string;
  counterpart: {
    playerId: number | null;
    displayName: string | null;
    skill: SkillInfo | null;
  };
  request: {
    matchType: MatchType;
    preferredDate: string | null;
    preferredStartTime: string | null;
    preferredEndTime: string | null;
    area: string | null;
    status: RequestStatus;
  };
}

export interface CreateRequestPayload {
  matchType: Exclude<MatchType, 'GROUP'>;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  area: string;
}

export interface ListRequestsParams {
  status?: RequestStatus;
  page?: number;
  limit?: number;
}

export interface BrowseCandidatesParams {
  search?: string;
  includeOutOfRange?: boolean;
  page?: number;
  limit?: number;
}

export interface ListInvitationsParams {
  direction?: 'RECEIVED' | 'SENT';
  status?: InvitationStatus;
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export type MatchStatus = 'PENDING_COURT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export interface MatchSummary {
  id: number;
  matchType: MatchType;
  status: MatchStatus;
  scheduledAt: string;
  bookingDeadlineAt: string | null;
  court: { id: number; name: string } | null;
  facility: { id: number; name: string; address: string; ward: string | null; district: string; city: string } | null;
}
export interface MatchDetail extends MatchSummary {
  scheduledEndAt: string | null;
  cancellationReason: string | null;
  price: number | null;
  booking: { id: number; status: string } | null;
  payer: { playerId: number } | null;
  players: { playerId: number; displayName: string | null; skill: SkillInfo | null; teamNo: number | null; status: string }[];
  requiredPlayers: number;
  currentPlayers: number;
  isOwner: boolean;
}
