export type RecruitmentMatchType = 'SINGLES' | 'DOUBLES' | 'GROUP';
export interface ExternalCourt { name: string; city: string; district: string; address: string; verified?: false }
export interface RecruitmentDraft {
  matchType: RecruitmentMatchType; startAt: string; durationMinutes?: number;
  capacity?: number; minPlayers?: number; companionCount?: number;
  minSkillLevelId: number; maxSkillLevelId: number; costNote?: string | null;
  court?: (ExternalCourt & { kind: 'EXTERNAL' }) | null;
}
export interface RecruitmentProjection {
  access: 'FULL' | 'PUBLIC' | 'INVITEE'; postId: number; requestId: number;
  viewerRelation: 'HOST' | 'ACCEPTED' | 'PENDING' | null; hostId: number;
  matchType: RecruitmentMatchType; status: string; startAt: string; durationMinutes: number;
  capacity: number; minPlayers: number; companionCount: number; filledSlots: number;
  hasOpenSlots: boolean; ended: boolean; acceptedCount?: number;
  skillRange: { min: { id: number; name: string | null }; max: { id: number; name: string | null } };
  costNote: string | null; externalCourt?: ExternalCourt | null;
  members?: { playerId: number; displayName: string | null; avatarUrl: string | null }[];
}
export interface RecruitmentDetail {
  id: number; postId: number; access: 'HOST' | 'MEMBER' | 'PUBLIC' | 'INVITEE';
  matchType: RecruitmentMatchType; status: string; startAt: string; durationMinutes: number;
  capacity: number; minPlayers: number; companionCount: number; acceptedCount?: number;
  minSkillLevelId: number; maxSkillLevelId: number; costNote: string | null;
  externalCourt?: ExternalCourt | null; cancellationReason?: string | null;
  members?: { playerId: number; displayName: string | null; isOwner?: boolean; skill?: { name: string | null } }[];
  invitationId?: number | null; matchId?: number | null; conversationId?: number | null;
  pendingApplicationCount?: number; pendingInvitationCount?: number;
}
