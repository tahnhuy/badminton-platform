import type { RecruitmentMatchType } from './recruitment';
export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED' | 'WITHDRAWN';
export interface Application {
  id: number; requestId: number; playerId: number; status: ApplicationStatus;
  expiresAt: string; respondedAt: string | null; closeReason: string | null; createdAt: string;
  applicant: { playerId: number; displayName: string | null; skill: { id: number; name: string | null; rank: number | null } | null; skillMismatch: boolean };
  request: { id: number; postId: number; hostId: number; matchType: RecruitmentMatchType; startAt: string; durationMinutes: number; status: string };
}
