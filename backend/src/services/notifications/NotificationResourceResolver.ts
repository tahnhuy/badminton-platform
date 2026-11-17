import { AppError } from '../../errors/AppError';
import { socialRepository } from '../../repositories/social/SocialRepository';
import { postVisibility, type SocialViewer } from '../social/post-visibility';
import { matchmakingRequestService } from '../matchmaking/MatchmakingRequestService';
import { matchService } from '../matchmaking/MatchService';
import { messagingService } from '../messaging/MessagingService';
import { bookingService } from '../booking/booking.service';

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

  // TOURNAMENT is intentionally absent: the Player portal has no tournament detail
  // route yet (only the /tournaments placeholder), so no link is invented.
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
