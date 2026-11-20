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

export interface TargetReportHistory {
  total: number;
  open: number;
  last30Days: number;
  distinctReporters: number;
  byReason: Array<{ reasonCode: string; count: number }>;
  recent: Array<{
    id: string;
    reporterId: string;
    reasonCode: string;
    status: string;
    createdAt: string;
  }>;
}

export interface TargetUserSummary {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

export interface TargetPlayerDetail {
  type: 'PLAYER';
  available: true;
  reportHistory: TargetReportHistory;
  player: {
    id: string;
    displayName: string;
    email: string;
    phone: string | null;
    avatarUrl: string | null;
    role: string;
    status: string;
    deletedAt: string | null;
    joinedAt: string;
    skillLevel: { id: number; name: string } | null;
  };
  recentContent: {
    posts: Array<{
      id: string;
      type: string;
      excerpt: string;
      createdAt: string;
      hiddenAt: string | null;
      deletedAt: string | null;
    }>;
    comments: Array<{
      id: string;
      postId: string;
      excerpt: string;
      createdAt: string;
      hiddenAt: string | null;
      deletedAt: string | null;
    }>;
    hiddenPostCount: number;
    hiddenCommentCount: number;
  };
}

export interface TargetPostDetail {
  type: 'POST';
  available: true;
  reportHistory: TargetReportHistory;
  post: {
    id: string;
    type: string;
    title: string | null;
    body: string | null;
    author: TargetUserSummary;
    publishedAt: string | null;
    editedAt: string | null;
    createdAt: string;
    deletedAt: string | null;
    hiddenAt: string | null;
    hiddenBy: string | null;
  };
}

export interface TargetCommentDetail {
  type: 'COMMENT';
  available: true;
  reportHistory: TargetReportHistory;
  comment: {
    id: string;
    body: string;
    author: TargetUserSummary;
    createdAt: string;
    deletedAt: string | null;
    hiddenAt: string | null;
  };
  post: {
    id: string;
    title: string | null;
    bodyExcerpt: string;
    author: TargetUserSummary;
    deletedAt: string | null;
    hiddenAt: string | null;
  } | null;
}

export interface TargetMessageDetail {
  type: 'MESSAGE';
  available: true;
  reportHistory: TargetReportHistory;
  message: {
    id: string;
    sender: { id: string; displayName: string };
    body: string | null;
    createdAt: string;
    deletedAt: string | null;
  };
}

export interface TargetFacilityDetail {
  type: 'FACILITY';
  available: true;
  reportHistory: TargetReportHistory;
  facility: {
    id: string;
    facilityCode: string;
    name: string;
    address: string;
    ward: string | null;
    district: string;
    city: string;
    phone: string;
    description: string | null;
    openingTime: string;
    closingTime: string;
    status: string;
    deletedAt: string | null;
    owner: { id: string; name: string; email: string; phone: string };
    courtCount: number;
  };
}

export interface TargetTournamentDetail {
  type: 'TOURNAMENT';
  available: true;
  reportHistory: TargetReportHistory;
  tournament: {
    id: string;
    name: string;
    description: string | null;
    format: string;
    matchType: string;
    status: string;
    participantLimit: number;
    entryFee: string;
    registrationStart: string;
    registrationEnd: string;
    tournamentStart: string;
    tournamentEnd: string;
    deletedAt: string | null;
    creator: TargetUserSummary;
    facility: { id: string; name: string } | null;
  };
}

export interface TargetUnavailableDetail {
  type: ReportTargetType;
  available: false;
  reportHistory: TargetReportHistory;
}

export type AdminReportTarget =
  | TargetPlayerDetail
  | TargetPostDetail
  | TargetCommentDetail
  | TargetMessageDetail
  | TargetFacilityDetail
  | TargetTournamentDetail
  | TargetUnavailableDetail;

export interface AdminReportDetail extends AdminReport {
  evidence: {
    text: string | null;
    media: ReportEvidenceMedia[];
  };
  target: AdminReportTarget;
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
