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
  hostName?: string | null;
  startAt?: string | null;
  durationMinutes?: number | null;
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
    hostName?: string | null;
    startAt?: string | null;
    durationMinutes?: number | null;
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
  role?: 'host' | 'member';
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
export interface MatchBookingWindow {
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number | null;
}

export interface MatchCostShare {
  playerId: number;
  displayName: string | null;
  amount: number;
  status: 'PAID' | 'REFUNDED';
  isHost: boolean;
}

export interface MatchCostSharing {
  totalAmount: number | null;
  memberCount: number;
  shareAmount: number | null;
  members: MatchCostShare[];
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
  bookingWindow: MatchBookingWindow | null;
  costSharing: MatchCostSharing | null;
}

export interface MatchSplitMember {
  playerId: number;
  displayName: string;
  isHost: boolean;
  amount: number;
  sufficient: boolean;
  shortfall: number;
}

export interface MatchSplitBlockedMember {
  playerId: number;
  displayName: string;
  isHost: boolean;
  amount: number;
  shortfall: number;
}

export interface MatchBookingPreview {
  court: { id: number; name: string };
  facility: { id: number; name: string };
  bookingWindow: MatchBookingWindow;
  totalAmount: number;
  memberCount: number;
  shareAmount: number;
  members: MatchSplitMember[];
  blockedMembers: MatchSplitBlockedMember[];
  canBook: boolean;
}

export interface MatchSplitBookingResult {
  matchId: number;
  bookingId: number;
  status: string;
  courtId: number;
  scheduledAt: string;
  totalAmount: number;
  shareAmount: number | null;
  shares: { playerId: number; amount: number; isHost: boolean }[];
}

export interface MatchBookingCandidate {
  id: number;
  bookingCode: string;
  bookingDate: string;
  startTime: string;
  endTime: string;
  totalAmount: number;
  status: string;
  court: { id: number; name: string };
  facility: { id: number; name: string };
  eligible: boolean;
  reason: 'ALREADY_LINKED' | 'NOT_PAID' | 'PAST' | 'WRONG_WINDOW' | null;
}
