export type ReportTargetType = 'PLAYER' | 'FACILITY' | 'TOURNAMENT' | 'POST' | 'COMMENT' | 'MESSAGE';
export type ReportStatus = 'OPEN' | 'RESOLVED';

export interface AdminReport {
  id: string;
  reporterId: string;
  targetType: ReportTargetType;
  reportedPlayerId?: string;
  reportedFacilityId?: string;
  reportedTournamentId?: string;
  reportedPostId?: string;
  reportedCommentId?: string;
  reportedMessageId?: string;
  reportedAttachmentId?: string;
  reasonCode: string;
  description: string | null;
  status: ReportStatus;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportEvidenceMedia {
  mediaId: string;
  kind: string;
  mimeType: string;
  byteSize: number;
  originalName: string | null;
  url: string;
}

export interface AdminReportDetail extends AdminReport {
  evidence: {
    text: string | null;
    media: ReportEvidenceMedia[];
  };
}

export interface ReportPageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  PLAYER: 'Người chơi',
  FACILITY: 'Cơ sở',
  TOURNAMENT: 'Giải đấu',
  POST: 'Bài viết',
  COMMENT: 'Bình luận',
  MESSAGE: 'Tin nhắn',
};

export const REASON_LABELS: Record<string, string> = {
  SPAM: 'Spam/quảng cáo',
  HARASSMENT: 'Quấy rối, xúc phạm',
  INAPPROPRIATE_CONTENT: 'Nội dung không phù hợp',
  SCAM: 'Lừa đảo',
  PRIVACY_VIOLATION: 'Tiết lộ thông tin riêng tư',
  OTHER: 'Khác',
  FACILITY_ISSUE: 'Vấn đề cơ sở',
};

const TARGET_ID_FIELDS: Array<[ReportTargetType, keyof AdminReport]> = [
  ['PLAYER', 'reportedPlayerId'],
  ['FACILITY', 'reportedFacilityId'],
  ['TOURNAMENT', 'reportedTournamentId'],
  ['POST', 'reportedPostId'],
  ['COMMENT', 'reportedCommentId'],
  ['MESSAGE', 'reportedMessageId'],
];

export function targetIdOf(report: AdminReport): string | null {
  for (const [type, field] of TARGET_ID_FIELDS) {
    if (report.targetType === type) return (report[field] as string | undefined) ?? null;
  }
  return null;
}
