import { AppError } from '../../errors/AppError';
import { socialRepository } from '../../repositories/social/SocialRepository';
import { postVisibility, type SocialViewer } from '../social/post-visibility';
import { matchmakingRequestService } from '../matchmaking/MatchmakingRequestService';
import { matchService } from '../matchmaking/MatchService';
import { messagingService } from '../messaging/MessagingService';
import { bookingService } from '../booking/booking.service';
import { reportRepository } from '../../repositories/reports/ReportRepository';
import { facilityRepository } from '../../repositories/facility/FacilityRepository';
import { walletRepository } from '../../repositories/wallet/WalletRepository';
import { refundRepository } from '../../repositories/payment/RefundRepository';
import { ownerEarningSettlementRepository } from '../../repositories/finance/OwnerEarningSettlementRepository';
import { userRepository } from '../../repositories/user/UserRepository';
import { tournamentRepository } from '../../repositories/tournaments/TournamentRepository';
import { db } from '../../db';
import { systemConfigAudit } from '../../db/schema/config-audit';
import { eq } from 'drizzle-orm';

// NTF-05 (Notifications Tech Design; G0-07/D5). A notification link never grants
// access: every resolver re-checks the owning module at open time and answers null
// when the resource is missing, hidden, deleted or no longer readable by the viewer.

export interface NotificationViewer {
  id: number;
  role: string;
}

type Resolver = (viewer: NotificationViewer, resourceId: number) => Promise<string | null>;

function positiveId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function asPlayer(viewer: NotificationViewer): SocialViewer | null {
  return viewer.role === 'PLAYER' ? { id: viewer.id, role: viewer.role } : null;
}

const resolvers: Readonly<Record<string, Resolver>> = {
  POST: async (viewer, postId) => {
    const player = asPlayer(viewer);
    if (!player) return null;
    const post = await socialRepository.findPost(postId);
    if (!post) return null;
    const visible = await postVisibility.filterVisible([post], player);
    return visible.has(post.id) ? `/posts/${post.id}` : null;
  },

  COMMENT: async (viewer, commentId) => {
    const player = asPlayer(viewer);
    if (!player) return null;
    const comment = await socialRepository.findComment(commentId);
    if (!comment || comment.deletedAt || comment.hiddenAt) return null;
    const post = await socialRepository.findPost(comment.postId);
    if (!post) return null;
    const visible = await postVisibility.filterVisible([post], player);
    return visible.has(post.id) ? `/posts/${post.id}#comment-${comment.id}` : null;
  },

  MATCHMAKING_REQUEST: async (viewer, requestId) => {
    if (!asPlayer(viewer)) return null;
    await matchmakingRequestService.getRequestDetail(viewer.id, requestId);
    return `/matchmaking/requests/${requestId}`;
  },

  MATCH: async (viewer, matchId) => {
    if (!asPlayer(viewer)) return null;
    await matchService.getMatchDetail(viewer.id, matchId);
    return `/matchmaking/matches/${matchId}`;
  },

  // CONVERSATION stays in the allowlist even though no producer targets it yet
  // (human-approved scope note, Notifications Tech Design 2026-11-01).
  CONVERSATION: async (viewer, conversationId) => {
    if (!asPlayer(viewer)) return null;
    await messagingService.getConversationAccess(viewer.id, conversationId);
    return `/messages/${conversationId}`;
  },

  BOOKING: async (viewer, bookingId) => {
    if (!asPlayer(viewer)) return null;
    await bookingService.getBookingDetail(viewer.id, bookingId);
    return `/bookings/${bookingId}`;
  },

  // Admin inbox resources open the Admin portal, never the Player shell.
  ADMIN_REPORT: async (viewer, reportId) => {
    if (viewer.role !== 'ADMIN') return null;
    const report = await reportRepository.findById(reportId);
    return report ? `/admin/reports?reportId=${report.id}` : null;
  },

  ADMIN_FACILITY: async (viewer, facilityId) => {
    if (viewer.role !== 'ADMIN') return null;
    const facility = await facilityRepository.findById(facilityId);
    if (!facility || facility.deletedAt) return null;
    return '/admin/courts?status=PENDING_APPROVAL';
  },

  ADMIN_PAYOUT: async (viewer, payoutId) => {
    if (viewer.role !== 'ADMIN') return null;
    const payout = await walletRepository.findPayoutRequest(payoutId);
    return payout ? `/admin/wallet/payouts?payoutId=${payout.id}` : null;
  },

  ADMIN_REFUND: async (viewer, paymentId) => {
    if (viewer.role !== 'ADMIN') return null;
    const refund = await refundRepository.findById(paymentId);
    return refund ? `/admin/wallet/refunds?paymentId=${refund.paymentId}` : null;
  },

  ADMIN_PAYMENT: async (viewer) => {
    if (viewer.role !== 'ADMIN') return null;
    return '/admin/wallet/reconciliation';
  },

  ADMIN_OWNER_EARNING: async (viewer, settlementId) => {
    if (viewer.role !== 'ADMIN') return null;
    const settlement = await ownerEarningSettlementRepository.findById(settlementId);
    return settlement ? `/admin/finance/owner-earnings?settlementId=${settlement.id}` : null;
  },

  ADMIN_CONFIG_AUDIT: async (viewer, auditId) => {
    if (viewer.role !== 'ADMIN') return null;
    const [audit] = await db
      .select({ id: systemConfigAudit.id, configKey: systemConfigAudit.configKey })
      .from(systemConfigAudit)
      .where(eq(systemConfigAudit.id, auditId))
      .limit(1);
    return audit ? `/admin/configs?key=${encodeURIComponent(audit.configKey)}` : null;
  },

  ADMIN_USER: async (viewer, userId) => {
    if (viewer.role !== 'ADMIN') return null;
    const user = await userRepository.findRawUserById(userId);
    if (!user || user.deletedAt) return null;
    return `/admin/users?userId=${user.id}`;
  },

  // Tournament pages (TRN-11): visible tournaments only; a DRAFT only for its Organizer.
  TOURNAMENT: async (viewer, tournamentId) => {
    const t = await tournamentRepository.findById(tournamentId);
    if (!t) return null;
    if (viewer.role === 'ADMIN') return `/admin/tournaments?tournamentId=${t.id}`;
    if (viewer.role !== 'PLAYER') return null;
    if (t.status === 'DRAFT') return t.creatorId === viewer.id ? `/tournaments/${t.id}/manage` : null;
    return `/tournaments/${t.id}`;
  },
};

export const notificationResourceResolver = {
  /** Allowlisted resource types only; anything else resolves to no link. */
  async resolve(viewer: NotificationViewer, resourceType: string | null, resourceId: number | null): Promise<string | null> {
    if (!resourceType || resourceId === null || !positiveId(resourceId)) return null;
    const resolver = Object.prototype.hasOwnProperty.call(resolvers, resourceType) ? resolvers[resourceType] : undefined;
    if (!resolver) return null;
    try {
      return await resolver(viewer, resourceId);
    } catch (error) {
      // 403/404/409 from the owning module all mean "no usable link". Unexpected errors
      // still surface as 500 instead of being hidden.
      if (error instanceof AppError) return null;
      throw error;
    }
  },
};
