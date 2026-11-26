import { NotFoundError } from '../../errors/AppError';
import { adminReportTargetRepository } from '../../repositories/admin/AdminReportTargetRepository';
import { messagingRepository } from '../../repositories/messaging/MessagingRepository';
import { type ReportTargetType } from '../../repositories/reports/ReportRepository';
import { socialRepository } from '../../repositories/social/SocialRepository';
import { userRepository, type UserWithProfile } from '../../repositories/user/UserRepository';
import { adminFacilityService } from './AdminFacilityService';

// Report Management §16 follow-up: Admin report detail includes a read-only
// snapshot/summary of the reported target. Social/Messaging visibility rules are
// intentionally bypassed for moderation reads, but private conversations are not.

const EXCERPT_MAX = 160;

export interface TargetReportHistoryView {
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

export interface TargetUserSummaryView {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  status: string;
}

export interface AdminReportTargetPlayerView {
  type: 'PLAYER';
  available: true;
  reportHistory: TargetReportHistoryView;
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

export interface AdminReportTargetPostView {
  type: 'POST';
  available: true;
  reportHistory: TargetReportHistoryView;
  post: {
    id: string;
    type: string;
    title: string | null;
    body: string | null;
    author: TargetUserSummaryView;
    publishedAt: string | null;
    editedAt: string | null;
    createdAt: string;
    deletedAt: string | null;
    hiddenAt: string | null;
    hiddenBy: string | null;
  };
}

export interface AdminReportTargetCommentView {
  type: 'COMMENT';
  available: true;
  reportHistory: TargetReportHistoryView;
  comment: {
    id: string;
    body: string;
    author: TargetUserSummaryView;
    createdAt: string;
    deletedAt: string | null;
    hiddenAt: string | null;
  };
  post: {
    id: string;
    title: string | null;
    bodyExcerpt: string;
    author: TargetUserSummaryView;
    deletedAt: string | null;
    hiddenAt: string | null;
  } | null;
}

export interface AdminReportTargetMessageView {
  type: 'MESSAGE';
  available: true;
  reportHistory: TargetReportHistoryView;
  message: {
    id: string;
    sender: { id: string; displayName: string };
    body: string | null;
    createdAt: string;
    deletedAt: string | null;
  };
}

export interface AdminReportTargetFacilityView {
  type: 'FACILITY';
  available: true;
  reportHistory: TargetReportHistoryView;
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

export interface AdminReportTargetTournamentView {
  type: 'TOURNAMENT';
  available: true;
  reportHistory: TargetReportHistoryView;
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
    creator: TargetUserSummaryView;
    facility: { id: string; name: string } | null;
  };
}

export interface AdminReportTargetUnavailableView {
  type: ReportTargetType;
  available: false;
  reportHistory: TargetReportHistoryView;
}

export type AdminReportTargetView =
  | AdminReportTargetPlayerView
  | AdminReportTargetPostView
  | AdminReportTargetCommentView
  | AdminReportTargetMessageView
  | AdminReportTargetFacilityView
  | AdminReportTargetTournamentView
  | AdminReportTargetUnavailableView;

export interface AdminReportTargetContext {
  /** Evidence text captured with the report; authoritative for the MESSAGE snapshot. */
  evidenceText?: string | null;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function excerpt(value: string | null | undefined): string {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX - 1)}…` : text;
}

function postExcerpt(title: string | null, body: string | null): string {
  return excerpt([title?.trim(), body?.trim()].filter(Boolean).join(' — '));
}

function profileDisplayName(user: UserWithProfile | null): string | null {
  if (!user?.profile) return null;
  const profile = user.profile;
  return 'fullName' in profile ? profile.fullName : profile.businessName;
}

function profileAvatarUrl(user: UserWithProfile | null): string | null {
  if (!user?.profile) return null;
  const profile = user.profile;
  return 'avatarUrl' in profile ? profile.avatarUrl : null;
}

async function userSummary(userId: number): Promise<TargetUserSummaryView> {
  const user = await userRepository.findUserById(userId);
  return {
    id: String(userId),
    displayName: profileDisplayName(user) ?? user?.email ?? `Người dùng #${userId}`,
    email: user?.email ?? '',
    avatarUrl: profileAvatarUrl(user),
    status: user?.status ?? 'UNKNOWN',
  };
}

function historyView(record: Awaited<ReturnType<typeof adminReportTargetRepository.reportHistory>>): TargetReportHistoryView {
  return {
    total: record.total,
    open: record.open,
    last30Days: record.last30Days,
    distinctReporters: record.distinctReporters,
    byReason: record.byReason,
    recent: record.recent.map(row => ({
      id: String(row.id),
      reporterId: String(row.reporterId),
      reasonCode: row.reasonCode,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

async function facilityTarget(targetId: number) {
  try {
    return await adminFacilityService.getFacilityById(targetId);
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

export const adminReportTargetService = {
  async getTarget(
    type: ReportTargetType,
    targetId: number,
    context: AdminReportTargetContext = {},
  ): Promise<AdminReportTargetView> {
    switch (type) {
      case 'PLAYER': {
        return this.getPlayerTarget(type, targetId);
      }
      case 'POST': {
        return this.getPostTarget(type, targetId);
      }
      case 'COMMENT': {
        return this.getCommentTarget(type, targetId);
      }
      case 'MESSAGE': {
        return this.getMessageTarget(type, targetId, context);
      }
      case 'FACILITY': {
        return this.getFacilityTarget(type, targetId);
      }
      case 'TOURNAMENT': {
        return this.getTournamentTarget(type, targetId);
      }
    }
  },
  async getPlayerTarget(type: 'PLAYER', targetId: number): Promise<AdminReportTargetView> {
    const [history, player, posts, comments, hidden] = await Promise.all([
      adminReportTargetRepository.reportHistory(type, targetId),
      adminReportTargetRepository.findPlayer(targetId),
      adminReportTargetRepository.recentPostsByAuthor(targetId),
      adminReportTargetRepository.recentCommentsByAuthor(targetId),
      adminReportTargetRepository.hiddenContentCounts(targetId),
    ]);
    const reportHistory = historyView(history);
    if (!player) return { type, available: false, reportHistory };
    return {
      type,
      available: true,
      reportHistory,
      player: {
        id: String(player.id),
        displayName: player.displayName ?? player.email,
        email: player.email,
        phone: player.phone,
        avatarUrl: player.avatarUrl,
        role: player.role,
        status: player.status,
        deletedAt: iso(player.deletedAt),
        joinedAt: player.joinedAt.toISOString(),
        skillLevel: player.skillLevelId !== null && player.skillLevelName
          ? { id: player.skillLevelId, name: player.skillLevelName }
          : null,
      },
      recentContent: {
        posts: posts.map(post => ({
          id: String(post.id),
          type: post.type,
          excerpt: postExcerpt(post.title, post.body),
          createdAt: post.createdAt.toISOString(),
          hiddenAt: iso(post.hiddenAt),
          deletedAt: iso(post.deletedAt),
        })),
        comments: comments.map(comment => ({
          id: String(comment.id),
          postId: String(comment.postId),
          excerpt: excerpt(comment.body),
          createdAt: comment.createdAt.toISOString(),
          hiddenAt: iso(comment.hiddenAt),
          deletedAt: iso(comment.deletedAt),
        })),
        hiddenPostCount: hidden.hiddenPostCount,
        hiddenCommentCount: hidden.hiddenCommentCount,
      },
    };

  },

  async getPostTarget(type: 'POST', targetId: number): Promise<AdminReportTargetView> {
    const [history, post] = await Promise.all([
      adminReportTargetRepository.reportHistory(type, targetId),
      socialRepository.findPost(targetId),
    ]);
    const reportHistory = historyView(history);
    if (!post) return { type, available: false, reportHistory };
    return {
      type,
      available: true,
      reportHistory,
      post: {
        id: String(post.id),
        type: post.type,
        title: post.title,
        body: post.body,
        author: await userSummary(post.authorId),
        publishedAt: iso(post.publishedAt),
        editedAt: iso(post.editedAt),
        createdAt: post.createdAt.toISOString(),
        deletedAt: iso(post.deletedAt),
        hiddenAt: iso(post.hiddenAt),
        hiddenBy: post.hiddenBy === null ? null : String(post.hiddenBy),
      },
    };

  },

  async getCommentTarget(type: 'COMMENT', targetId: number): Promise<AdminReportTargetView> {
    const [history, comment] = await Promise.all([
      adminReportTargetRepository.reportHistory(type, targetId),
      socialRepository.findComment(targetId),
    ]);
    const reportHistory = historyView(history);
    if (!comment) return { type, available: false, reportHistory };
    const [author, parent] = await Promise.all([
      userSummary(comment.authorId),
      socialRepository.findPost(comment.postId),
    ]);
    return {
      type,
      available: true,
      reportHistory,
      comment: {
        id: String(comment.id),
        body: comment.body,
        author,
        createdAt: comment.createdAt.toISOString(),
        deletedAt: iso(comment.deletedAt),
        hiddenAt: iso(comment.hiddenAt),
      },
      post: parent
        ? {
          id: String(parent.id),
          title: parent.title,
          bodyExcerpt: postExcerpt(parent.title, parent.body),
          author: await userSummary(parent.authorId),
          deletedAt: iso(parent.deletedAt),
          hiddenAt: iso(parent.hiddenAt),
        }
        : null,
    };

  },

  async getMessageTarget(type: 'MESSAGE', targetId: number, context: AdminReportTargetContext): Promise<AdminReportTargetView> {
    const [history, message] = await Promise.all([
      adminReportTargetRepository.reportHistory(type, targetId),
      messagingRepository.findMessageById(targetId),
    ]);
    const reportHistory = historyView(history);
    if (!message) return { type, available: false, reportHistory };
    const sender = await userSummary(message.senderId);
    return {
      type,
      available: true,
      reportHistory,
      message: {
        id: String(message.id),
        sender: { id: sender.id, displayName: sender.displayName },
        // Messages can be edited/deleted after the report; keep the snapshot Admin
        // actually received, falling back to the live body for legacy reports.
        body: context.evidenceText ?? message.body,
        createdAt: message.createdAt.toISOString(),
        deletedAt: iso(message.deletedAt),
      },
    };

  },

  async getFacilityTarget(type: 'FACILITY', targetId: number): Promise<AdminReportTargetView> {
    const [history, facility] = await Promise.all([
      adminReportTargetRepository.reportHistory(type, targetId),
      facilityTarget(targetId),
    ]);
    const reportHistory = historyView(history);
    if (!facility) return { type, available: false, reportHistory };
    return {
      type,
      available: true,
      reportHistory,
      facility: {
        id: String(facility.id),
        facilityCode: facility.facilityCode,
        name: facility.name,
        address: facility.address,
        ward: facility.ward,
        district: facility.district,
        city: facility.city,
        phone: facility.phone,
        description: facility.description,
        openingTime: facility.openingTime,
        closingTime: facility.closingTime,
        status: facility.status,
        deletedAt: iso(facility.deletedAt),
        owner: {
          id: String(facility.owner.id),
          name: facility.owner.name,
          email: facility.owner.email,
          phone: facility.owner.phone,
        },
        courtCount: facility.courtStats.totalCourts,
      },
    };

  },

  async getTournamentTarget(type: 'TOURNAMENT', targetId: number): Promise<AdminReportTargetView> {
    const [history, tournament] = await Promise.all([
      adminReportTargetRepository.reportHistory(type, targetId),
      adminReportTargetRepository.findTournament(targetId),
    ]);
    const reportHistory = historyView(history);
    if (!tournament) return { type, available: false, reportHistory };
    return {
      type,
      available: true,
      reportHistory,
      tournament: {
        id: String(tournament.id),
        name: tournament.name,
        description: tournament.description,
        format: tournament.format,
        matchType: tournament.matchType,
        status: tournament.status,
        participantLimit: tournament.participantLimit,
        entryFee: tournament.entryFee,
        registrationStart: tournament.registrationStart.toISOString(),
        registrationEnd: tournament.registrationEnd.toISOString(),
        tournamentStart: tournament.tournamentStart.toISOString(),
        tournamentEnd: tournament.tournamentEnd.toISOString(),
        deletedAt: iso(tournament.deletedAt),
        creator: {
          id: String(tournament.creatorId),
          displayName: tournament.creatorDisplayName ?? tournament.creatorBusinessName ?? tournament.creatorEmail ?? `Người dùng #${tournament.creatorId}`,
          email: tournament.creatorEmail ?? '',
          avatarUrl: null,
          status: tournament.creatorStatus ?? 'UNKNOWN',
        },
        facility: tournament.facilityId !== null
          ? { id: String(tournament.facilityId), name: tournament.facilityName ?? `Cơ sở #${tournament.facilityId}` }
          : null,
      },
    };

  },

};
