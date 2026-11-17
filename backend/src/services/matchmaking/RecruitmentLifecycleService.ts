import { db, conversations, conversationMembers, matchmakingRequestConversations } from '../../db';
import { and, eq } from 'drizzle-orm';
import { AppError, NotFoundError, TransactionRetryError } from '../../errors/AppError';
import {
  matchmakingRepository,
  type ExternalCourtFields,
  type RecruitmentCancellationReason,
} from '../../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../match/match.module';
import { matchmakingNotifications as notify } from './matchmaking-notifications';
import { rosterSufficient, type StartOutcome } from './recruitment-state';
import { addMinutes } from './matchmaking-time.util';
import type { TransactionContext } from '../../contracts/TransactionContext';
import type { BookingAction } from '../../contracts/RecruitmentPort';
import type { MatchType } from '../../contracts/MatchModule';
import { bookingPaymentGuard } from '../payments/BookingPaymentGuardService';
import { recruitmentChatPort } from '../messaging/RecruitmentChatService';
import type { RecruitmentChatRemoval } from '../../contracts/RecruitmentChatPort';
import { logger } from '../../shared/logging/logger';

// MM-25 (withdrawal, GROUP reopen, early close, host cancel KEEP, compatibility aliases),
// MM-28 (external court), MM-27 (start-time processing) and the Matchmaking side of
// SOC-04 author deletion. Matchmaking Tech Design §24.4, §24.7.3, §24.9, §24.15.
//
// Lock order for every operation here (§24.7.3 "Withdraw, early close, host cancel, author
// deletion", "Court set (external)", "Scheduler per recruitment"):
//   users(10: host, members, pending Players, ascending) → requests(30) → invitations(40)
//   → matches/match_players(50) → jobs(55) → [posts(100), author deletion only].
// Every rank-40 change happens before the first rank-50 lock. Matches and match players are
// written only through MatchModule. Departures then take bookings(80) for the payment
// barrier and conversations(90)/members(95) for linked-chat revocation. Membership UI
// events are published only after commit; independent chats are unaffected.

type Executor = any;

export interface LockedRecruitment {
  request: any;
  accepted: { id: number; playerId: number }[];
  pending: { id: number; playerId: number; kind: string }[];
  matchId: number | null;
  chatRemovals: RecruitmentChatRemoval[];
}

const conflict = (code: string, message: string) => new AppError(code, 409, message);
const requestNotFound = () => new NotFoundError('Không tìm thấy yêu cầu ghép trận', 'MATCHMAKING_REQUEST_NOT_FOUND');
const invitationNotFound = () => new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
const matchNotFound = () => new NotFoundError('Không tìm thấy trận đấu', 'MATCH_NOT_FOUND');
const notWithdrawable = (message = 'Không thể rút khỏi kèo ở thời điểm này') => conflict('MATCHMAKING_INVITATION_NOT_WITHDRAWABLE', message);
const notCancellable = () => conflict('MATCHMAKING_REQUEST_NOT_CANCELLABLE', 'Yêu cầu này không thể hủy ở trạng thái hiện tại');
const bookingActionUnavailable = () => conflict('MATCHMAKING_BOOKING_ACTION_UNAVAILABLE', 'Chưa hỗ trợ hủy lịch đặt sân kèm theo; hãy chọn giữ lịch đặt sân');
const courtChangeNotAllowed = () => conflict('MATCHMAKING_COURT_CHANGE_NOT_ALLOWED', 'Không thể thay đổi sân của kèo này');

const ACTIVE_MATCH = ['PENDING_COURT', 'CONFIRMED'] as const;
/** Match cancellation reasons keep the §3.13 vocabulary; the precise cause is on the recruitment (§13.4). */
const MATCH_REASON_PLAYERS = 'INSUFFICIENT_PLAYERS';

function uniqueIds(ids: readonly number[]): number[] {
  return [...new Set(ids)];
}

function matchIsActive(match: { status: string; bookingDeadlineAt: Date | null } | null, now: Date): boolean {
  if (!match || !(ACTIVE_MATCH as readonly string[]).includes(match.status)) return false;
  return !(match.status === 'PENDING_COURT' && match.bookingDeadlineAt && match.bookingDeadlineAt.getTime() <= now.getTime());
}

export function assignTeams(matchType: string, playerIds: number[]): { playerId: number; teamNo: number | null }[] {
  if (matchType === 'GROUP') return playerIds.map(playerId => ({ playerId, teamNo: null }));
  if (matchType === 'SINGLES') return playerIds.map((playerId, index) => ({ playerId, teamNo: index + 1 }));
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((playerId, index) => ({ playerId, teamNo: index < 2 ? 1 : 2 }));
}

/**
 * Creates the request's Match (rank 50; caller already made every rank-40 change):
 * CONFIRMED when the recruitment has a court, otherwise PENDING_COURT (§24.4). GROUP Matches
 * have no teams. Matchmaking never writes matches.booking_id/court_id for posts (§24.3).
 */
export async function formMatch(tx: Executor, request: any, memberIds: number[]): Promise<number> {
  const hasCourt = await matchmakingRepository.recruitmentHasCourt(request, tx);
  const { matchId } = await matchModule.createMatchWithPlayers({
    matchType: request.matchType as MatchType,
    scheduledAt: request.startAt,
    bookingDeadlineAt: request.startAt,
    status: hasCourt ? 'CONFIRMED' : 'PENDING_COURT',
    players: assignTeams(request.matchType, [request.playerId, ...memberIds]),
  }, tx);
  await matchmakingRepository.insertMatchLink(request.id, matchId, tx);
  return matchId;
}

/**
 * §24.7.1 rule 3 inside a transaction: snapshot the request's Players, lock their USERS rows
 * ascending, lock the request, re-read. A Player outside the locked set means the set changed
 * while waiting: throw TransactionRetryError (nothing written yet) so the transaction owner
 * retries. Every membership writer of a request locks its host first, so once the host is
 * held the member and pending sets are stable.
 */
export async function lockRecruitment(tx: Executor, requestId: number, extraUserIds: readonly number[] = []): Promise<LockedRecruitment> {
  const snapshot = await matchmakingRepository.findRequestById(requestId, tx);
  if (!snapshot) throw requestNotFound();
  const acceptedBefore = await matchmakingRepository.findAcceptedInvitees(requestId, tx);
  const pendingBefore = await matchmakingRepository.findPendingRows(requestId, tx);
  const userIds = uniqueIds([snapshot.playerId, ...acceptedBefore.map((m: any) => m.playerId), ...pendingBefore.map(p => p.playerId), ...extraUserIds]);
  await matchmakingRepository.lockUsersAscending(userIds, tx);
  const request = await matchmakingRepository.lockRequestById(requestId, tx);
  if (!request) throw requestNotFound();
  const accepted = await matchmakingRepository.findAcceptedInvitees(requestId, tx);
  const pending = await matchmakingRepository.findPendingRows(requestId, tx);
  if ([...accepted, ...pending].some((m: any) => !userIds.includes(m.playerId))) throw new TransactionRetryError();
  const link = await matchmakingRepository.findMatchLinkByRequestId(requestId, tx);
  return { request, accepted, pending, matchId: link?.matchId ?? null, chatRemovals: [] };
}

export async function runLocked<T>(requestId: number, extraUserIds: readonly number[], work: (tx: Executor, ctx: LockedRecruitment) => Promise<T>): Promise<T> {
  for (;;) {
    let result: T;
    let chatRemovals: RecruitmentChatRemoval[] = [];
    try {
      result = await db.transaction(async tx => {
        const ctx = await lockRecruitment(tx, requestId, extraUserIds);
        const value = await work(tx, ctx);
        chatRemovals = ctx.chatRemovals;
        return value;
      });
    } catch (error) {
      if (error instanceof TransactionRetryError) continue;
      throw error;
    }
    // Access was revoked atomically in the DB. A failed UI event must not replay the write.
    for (const event of chatRemovals) {
      try { await recruitmentChatPort.publishRemoval(event); }
      catch (error) { logger.error('Failed to publish recruitment chat removal', { requestId, error }); }
    }
    return result;
  }
}

export interface WithdrawResult {
  requestId: number;
  membershipId: number | null;
  status: 'WITHDRAWN' | 'CANCELLED';
  requestStatus: string;
  matchId: number | null;
  matchStatus: string | null;
}

export interface CancelResult {
  id: number;
  status: 'CANCELLED';
  cancelled: boolean;
}

interface CancelOptions {
  reason: RecruitmentCancellationReason;
  /** Player marked LEFT on the Match (host leaving through the leave alias). */
  leaverId?: number;
  /** Author deletion: a terminal recruitment is left unchanged instead of rejected. */
  terminalIsNoop?: boolean;
}

export class RecruitmentLifecycleService {
  // ---------------------------------------------------------------- withdraw

  /** POST /matchmaking-requests/:id/withdraw. The host leaving is a host cancellation (HOST_LEFT, KEEP). */
  async withdraw(actorId: number, requestId: number): Promise<WithdrawResult> {
    return runLocked(requestId, [actorId], (tx, ctx) => this.withdrawLocked(tx, ctx, actorId, null));
  }

  async removeMember(hostId: number, requestId: number, playerId: number): Promise<WithdrawResult> {
    return runLocked(requestId, [hostId, playerId], async (tx, ctx) => {
      if (ctx.request.playerId !== hostId) throw requestNotFound();
      if (playerId === hostId) throw conflict('MATCHMAKING_MEMBER_NOT_REMOVABLE', 'Không thể loại chủ kèo');
      const member = ctx.accepted.find(row => row.playerId === playerId);
      if (!member) throw conflict('MATCHMAKING_MEMBER_NOT_REMOVABLE', 'Người chơi không còn trong kèo');
      const result = await this.withdrawLocked(tx, ctx, playerId, null, hostId);
      await notify.memberRemoved(tx, requestId, member.id, playerId);
      return result;
    });
  }

  /** Alias POST /matchmaking-invitations/:id/withdraw (kept during the transition, §24.9). */
  async withdrawByInvitation(actorId: number, invitationId: number): Promise<{ id: number; status: 'WITHDRAWN' }> {
    const row = await matchmakingRepository.findInvitationById(invitationId);
    if (!row || row.kind !== 'INVITE' || row.playerId !== actorId) throw invitationNotFound();
    await runLocked(row.requestId, [actorId], (tx, ctx) => this.withdrawLocked(tx, ctx, actorId, invitationId));
    return { id: invitationId, status: 'WITHDRAWN' };
  }

  private async withdrawLocked(tx: Executor, ctx: LockedRecruitment, actorId: number, rowId: number | null, removalActorId = actorId): Promise<WithdrawResult> {
    const { request } = ctx;
    if (request.playerId === actorId && rowId === null) {
      const cancelled = await this.cancelLocked(tx, ctx, actorId, 'KEEP', { reason: 'HOST_LEFT', leaverId: actorId });
      const match = ctx.matchId ? await matchModule.getMatchRow(ctx.matchId, tx) : null;
      return { requestId: request.id, membershipId: null, status: cancelled.status, requestStatus: 'CANCELLED', matchId: ctx.matchId, matchStatus: match?.status ?? null };
    }
    const row = ctx.accepted.find(m => (rowId === null ? m.playerId === actorId : m.id === rowId));
    if (!row) return this.withdrawReplay(tx, request, actorId, rowId);
    const now = new Date();
    if (request.startAt.getTime() <= now.getTime()) throw notWithdrawable('Kèo đã bắt đầu, không thể rút');
    const remaining = ctx.accepted.filter(m => m.id !== row.id).map(m => m.playerId);

    if (request.status === 'OPEN' && (!request.expiresAt || request.expiresAt.getTime() > now.getTime())) {
      // Before full: the slot is released (§24.4). A reopened GROUP also leaves its Match roster.
      await matchmakingRepository.withdrawMembership(row.id, tx);
      if (ctx.matchId) {
        await matchModule.lockMatch(ctx.matchId, tx);
        await matchModule.markPlayerLeft({ matchId: ctx.matchId, playerId: actorId }, tx);
      }
      await notify.membershipChanged(tx, request.id, row.id, 'WITHDRAWN', [request.playerId, ...remaining], actorId);
      await this.finalizeMemberDeparture(tx, ctx, actorId, removalActorId);
      return this.withdrawResult(tx, request.id, row.id, ctx.matchId);
    }
    if (request.status !== 'MATCHED' || !ctx.matchId) throw notWithdrawable();
    const snapshot = await matchModule.getMatchRow(ctx.matchId, tx);
    if (!matchIsActive(snapshot, now)) throw notWithdrawable('Trận đấu đã kết thúc hoặc bị hủy');

    await matchmakingRepository.withdrawMembership(row.id, tx);
    const match = await matchModule.lockMatch(ctx.matchId, tx);
    if (!matchIsActive(match, now)) throw notWithdrawable('Trận đấu đã kết thúc hoặc bị hủy');
    await matchModule.markPlayerLeft({ matchId: match!.id, playerId: actorId }, tx);
    if (request.matchType === 'GROUP') {
      // GROUP after full: reopen for a manual replacement; the same Match is kept (§24.4).
      await matchmakingRepository.reopenRecruitment(request.id, tx);
      await notify.reopened(tx, request.id, row.id, [request.playerId, ...remaining], actorId);
    } else {
      // Singles/Doubles after full: the Match is cancelled (§3.9, unchanged leave rule).
      await matchModule.transitionStatus({ matchId: match!.id, from: match!.status as any, to: 'CANCELLED', cancellationReason: MATCH_REASON_PLAYERS }, tx);
      await matchmakingRepository.cancelRecruitment(request.id, 'PLAYER_LEFT', tx);
      if (match!.bookingId) await matchmakingRepository.insertCancellationJob(match!.id, match!.bookingId, tx);
      await notify.post(tx, request.id, 'CANCELLED', [request.playerId, ...remaining], actorId,
        'Một thành viên đã rời nên trận đấu đã bị hủy');
    }
    await this.finalizeMemberDeparture(tx, ctx, actorId, removalActorId);
    return this.withdrawResult(tx, request.id, row.id, match!.id);
  }

  /** Rank 80 payment barrier follows every roster write; failure rolls them all back. */
  private async finalizeMemberDeparture(tx: TransactionContext, ctx: LockedRecruitment, playerId: number, actorId: number) {
    const match = ctx.matchId ? await matchModule.getMatchRow(ctx.matchId, tx) : null;
    const bookingIds = [ctx.request.bookingId, match?.bookingId].filter((id): id is number => id != null);
    if (await bookingPaymentGuard.hasSuccessfulPayment(bookingIds, tx)) {
      throw notWithdrawable('Booking của kèo đã thanh toán thành công, không thể rút hoặc loại thành viên');
    }
    const event = await recruitmentChatPort.revokeMember(ctx.request.id, playerId, actorId, tx);
    if (event) ctx.chatRemovals.push(event);
  }

  private async withdrawReplay(tx: Executor, request: any, actorId: number, rowId: number | null): Promise<WithdrawResult> {
    const latest = rowId !== null
      ? await matchmakingRepository.findInvitationById(rowId, tx)
      : await matchmakingRepository.findLatestRowForPlayer(request.id, actorId, tx);
    if (!latest || latest.playerId !== actorId || latest.requestId !== request.id) {
      throw rowId !== null ? invitationNotFound() : requestNotFound();
    }
    if (latest.status === 'WITHDRAWN') {
      const link = await matchmakingRepository.findMatchLinkByRequestId(request.id, tx);
      return this.withdrawResult(tx, request.id, latest.id, link?.matchId ?? null);
    }
    throw notWithdrawable();
  }

  private async withdrawResult(tx: Executor, requestId: number, rowId: number, matchId: number | null): Promise<WithdrawResult> {
    const requestStatus = await matchmakingRepository.findEffectiveStatus(requestId, tx);
    const match = matchId ? await matchModule.getMatchRow(matchId, tx) : null;
    return { requestId, membershipId: rowId, status: 'WITHDRAWN', requestStatus: requestStatus ?? 'OPEN', matchId, matchStatus: match?.status ?? null };
  }

  /**
   * Alias POST /matches/:id/leave (kept during the transition, §24.9): a member withdraws;
   * the host leaving cancels the post/Match (HOST_LEFT, booking kept).
   */
  async leaveMatch(actorId: number, matchId: number) {
    const link = await matchmakingRepository.findMatchLinkByMatchId(matchId);
    if (!link) throw matchNotFound();
    const participant = await matchModule.findActiveMatchPlayer(matchId, actorId);
    if (!participant) throw matchNotFound();
    return runLocked(link.requestId, [actorId], async (tx, ctx) => {
      const match = await matchModule.getMatchRow(matchId, tx);
      if (!match) throw matchNotFound();
      if (match.status === 'CANCELLED') return { id: matchId, status: 'CANCELLED', cancellationReason: match.cancellationReason };
      const now = new Date();
      if (match.status === 'PENDING_COURT' && match.bookingDeadlineAt && match.bookingDeadlineAt.getTime() <= now.getTime()) {
        // Apply the same start-time outcome as the scheduler. Cancelling only the Match
        // would make claimDueRecruitments skip it forever, leaving its recruitment MATCHED.
        // Rank-40 pending closures must precede the Match lock (rank 50).
        const reason = ctx.request.matchType === 'GROUP' && !rosterSufficient(ctx.request, ctx.accepted.length)
          ? 'INSUFFICIENT_PLAYERS' as const : 'COURT_NOT_BOOKED' as const;
        await matchmakingRepository.closePendingForRequest(ctx.request.id, 'EXPIRED', 'POST_STARTED', tx);
        await this.cancelAtStart(tx, ctx, reason);
        return { id: matchId, status: 'CANCELLED', cancellationReason: reason };
      }
      if (match.status !== 'PENDING_COURT' && !(match.status === 'CONFIRMED' && match.scheduledAt.getTime() > now.getTime())) {
        throw conflict('MATCH_ALREADY_STARTED', 'Trận đấu đã bắt đầu, không thể rời');
      }
      if (ctx.request.playerId === actorId) {
        await this.cancelLocked(tx, ctx, actorId, 'KEEP', { reason: 'HOST_LEFT', leaverId: actorId });
        return { id: matchId, status: 'CANCELLED', cancellationReason: MATCH_REASON_PLAYERS };
      }
      await this.withdrawLocked(tx, ctx, actorId, null);
      const after = await matchModule.getMatchRow(matchId, tx);
      return { id: matchId, status: after!.status, cancellationReason: after!.status === 'CANCELLED' ? after!.cancellationReason : null };
    });
  }

  // ------------------------------------------------------------- early close

  /** Host confirmation: full Singles/Doubles or GROUP minimum, before expiry/start. */
  async close(actorId: number, requestId: number) {
    return runLocked(requestId, [], async (tx, ctx) => {
      const { request } = ctx;
      if (request.playerId !== actorId) throw requestNotFound();
      if (request.status === 'MATCHED' && ctx.matchId) {
        return { id: request.id, status: 'MATCHED', matchId: ctx.matchId, closedEarlyAt: request.closedEarlyAt };
      }
      const now = new Date();
      if (request.status !== 'OPEN' || request.startAt.getTime() <= now.getTime() || (request.expiresAt && request.expiresAt <= now)) {
        throw conflict('MATCHMAKING_REQUEST_NOT_OPEN', 'Yêu cầu không còn mở');
      }
      if (!rosterSufficient(request, ctx.accepted.length)) {
        throw conflict('MATCHMAKING_EARLY_CLOSE_NOT_ALLOWED', request.matchType === 'GROUP' ? 'Cần đủ số người tối thiểu và ít nhất một thành viên đã tham gia để chốt kèo' : 'Cần đủ người chơi để chốt kèo');
      }
      const memberIds = ctx.accepted.map(m => m.playerId);
      await this.assertNoConflicts(tx, request, [request.playerId, ...memberIds]);
      const closed = await matchmakingRepository.closePendingForRequest(request.id, 'CANCELLED', 'RECRUITMENT_CLOSED', tx);
      const matchId = ctx.matchId ?? await formMatch(tx, request, memberIds);
      await matchmakingRepository.markRecruitmentMatched(request.id, now, tx);
      await notify.post(tx, request.id, 'MATCHED', [...memberIds, ...closed.map(r => r.playerId)], actorId,
        'Chủ kèo đã chốt danh sách người chơi');
      return { id: request.id, status: 'MATCHED', matchId, closedEarlyAt: now };
    });
  }

  async createGroupChat(actorId: number, requestId: number) {
    return runLocked(requestId, [actorId], async (tx, ctx) => {
      if (ctx.request.playerId !== actorId) throw requestNotFound();
      const [existing] = await tx.select({ conversationId: matchmakingRequestConversations.conversationId,
        status: conversations.status, state: conversationMembers.state })
        .from(matchmakingRequestConversations)
        .innerJoin(conversations, eq(conversations.id, matchmakingRequestConversations.conversationId))
        .leftJoin(conversationMembers, and(eq(conversationMembers.conversationId, conversations.id), eq(conversationMembers.userId, actorId)))
        .where(eq(matchmakingRequestConversations.requestId, requestId));
      if (existing) {
        if (existing.status !== 'ACTIVE' || existing.state !== 'ACTIVE') {
          throw conflict('MATCHMAKING_CHAT_UNAVAILABLE', 'Nhóm chat đã giải tán hoặc bạn không còn trong nhóm');
        }
        return { conversationId: existing.conversationId, created: false };
      }
      if (ctx.request.status !== 'MATCHED' || !ctx.matchId) {
        throw conflict('MATCHMAKING_CHAT_NOT_READY', 'Chủ kèo cần chốt danh sách trước khi tạo nhóm chat');
      }
      const match = await matchModule.getMatchRow(ctx.matchId, tx);
      const now = new Date();
      if (!match || !['PENDING_COURT', 'CONFIRMED', 'IN_PROGRESS'].includes(match.status)
        || (match.status === 'PENDING_COURT' && match.bookingDeadlineAt && match.bookingDeadlineAt <= now)
        || addMinutes(ctx.request.startAt, ctx.request.durationMinutes) <= now) {
        throw conflict('MATCHMAKING_CHAT_NOT_READY', 'Trận đấu không còn hoạt động');
      }
      const { messagingService } = await import('../messaging/MessagingService');
      const conversationId = await messagingService.createGroupConversationInTransaction(
        tx, actorId, `Nhóm kèo #${requestId}`, ctx.accepted.map(row => row.playerId)
      );
      await tx.insert(matchmakingRequestConversations).values({ requestId, conversationId });
      return { conversationId, created: true };
    });
  }

  // ------------------------------------------------------------- host cancel

  /** POST /matchmaking-requests/:id/cancel { bookingAction }. */
  async cancel(actorId: number, requestId: number, bookingAction: BookingAction): Promise<CancelResult> {
    return runLocked(requestId, [], (tx, ctx) => {
      if (ctx.request.playerId !== actorId) throw requestNotFound();
      return this.cancelLocked(tx, ctx, actorId, bookingAction, { reason: 'HOST_CANCELLED' });
    });
  }

  /**
   * RecruitmentPort.cancelForAuthorDeletion (SOC-04): host cancellation with AUTHOR_DELETED
   * in the caller's transaction, before Social locks the post (rank 100). A terminal
   * recruitment is left unchanged (deletion only hides the post). Throws
   * TransactionRetryError when the lock set changed; the caller retries its transaction.
   */
  async cancelForAuthorDeletion(postId: number, actorId: number, bookingAction: BookingAction, tx: TransactionContext): Promise<{ cancelled: boolean }> {
    const recruitment = await matchmakingRepository.findRequestIdByPostId(postId, tx);
    if (!recruitment) return { cancelled: false };
    const ctx = await lockRecruitment(tx, recruitment, []);
    const result = await this.cancelLocked(tx, ctx, actorId, bookingAction, { reason: 'AUTHOR_DELETED', terminalIsNoop: true });
    return { cancelled: result.cancelled };
  }

  private async cancelLocked(tx: Executor, ctx: LockedRecruitment, actorId: number, bookingAction: BookingAction, options: CancelOptions): Promise<CancelResult> {
    const { request } = ctx;
    if (request.playerId !== actorId) throw requestNotFound();
    const now = new Date();
    if (request.status === 'CANCELLED') return { id: request.id, status: 'CANCELLED', cancelled: false };
    const effective = await matchmakingRepository.findEffectiveStatus(request.id, tx);
    const match = ctx.matchId ? await matchModule.getMatchRow(ctx.matchId, tx) : null;
    const terminal = effective === 'EXPIRED' || effective === 'CANCELLED'
      || (request.status === 'MATCHED' && !matchIsActive(match, now) && match?.status !== 'IN_PROGRESS');
    if (terminal) {
      if (options.terminalIsNoop) return { id: request.id, status: 'CANCELLED', cancelled: false };
      throw notCancellable();
    }
    // Host cancel is allowed before start only (§24.4); a started post is not cancellable.
    if (request.startAt.getTime() <= now.getTime()) throw notCancellable();

    const closed = await matchmakingRepository.closePendingForRequest(request.id, 'CANCELLED', 'POST_CANCELLED', tx);
    await matchmakingRepository.cancelRecruitment(request.id, options.reason, tx);
    if (ctx.matchId) {
      const locked = await matchModule.lockMatch(ctx.matchId, tx);
      if (locked && (ACTIVE_MATCH as readonly string[]).includes(locked.status)) {
        if (options.leaverId) await matchModule.markPlayerLeft({ matchId: locked.id, playerId: options.leaverId }, tx);
        await matchModule.transitionStatus({ matchId: locked.id, from: locked.status as any, to: 'CANCELLED', cancellationReason: MATCH_REASON_PLAYERS }, tx);
        if (bookingAction === 'CANCEL') {
          const bookingIds = [...new Set([request.bookingId, locked.bookingId].filter((id): id is number => id != null))];
          for (const bookingId of bookingIds) {
            await matchmakingRepository.insertCancellationJob(locked.id, bookingId, tx);
          }
        }
      }
    }
    const content = options.reason === 'AUTHOR_DELETED' ? 'Chủ kèo đã xóa bài tìm kèo, kèo đã bị hủy' : 'Chủ kèo đã hủy kèo';
    await notify.post(tx, request.id, 'CANCELLED', [...ctx.accepted.map(m => m.playerId), ...closed.map(r => r.playerId)], actorId, content);
    return { id: request.id, status: 'CANCELLED', cancelled: true };
  }

  // ------------------------------------------------------------------ court

  /**
   * PUT /matchmaking-requests/:id/court (MM-28). EXTERNAL only while the post has no court;
   * BOOKING returns MATCHMAKING_BOOKING_ACTION_UNAVAILABLE until MM-19/BK-15. The post time
   * is never changed. A formed PENDING_COURT Match becomes CONFIRMED through MatchModule.
   */
  async setCourt(actorId: number, requestId: number, input: { kind: 'EXTERNAL'; court: ExternalCourtFields } | { kind: 'BOOKING' }) {
    return runLocked(requestId, [], async (tx, ctx) => {
      const { request } = ctx;
      if (request.playerId !== actorId) throw requestNotFound();
      if (input.kind === 'BOOKING') throw bookingActionUnavailable();
      const court = input.court;
      if (request.externalCourtName) {
        const same = request.externalCourtName === court.name && request.externalCourtCity === court.city
          && request.externalCourtDistrict === court.district && request.externalCourtAddress === court.address;
        if (same && !request.bookingId) return { id: request.id, matchId: ctx.matchId, externalCourt: court };
        throw courtChangeNotAllowed();
      }
      if (request.bookingId) throw courtChangeNotAllowed();
      const now = new Date();
      if (request.startAt.getTime() <= now.getTime()) throw courtChangeNotAllowed();
      const match = ctx.matchId ? await matchModule.getMatchRow(ctx.matchId, tx) : null;
      const active = (request.status === 'OPEN' && (!request.expiresAt || request.expiresAt.getTime() > now.getTime()))
        || (request.status === 'MATCHED' && matchIsActive(match, now));
      if (!active) throw courtChangeNotAllowed();
      await matchmakingRepository.setExternalCourt(request.id, court, tx);
      if (ctx.matchId) {
        const locked = await matchModule.lockMatch(ctx.matchId, tx);
        if (locked?.status === 'PENDING_COURT') {
          await matchModule.transitionStatus({ matchId: locked.id, from: 'PENDING_COURT', to: 'CONFIRMED' }, tx);
        }
      }
      await notify.courtUpdated(tx, request.id, 'external', ctx.accepted.map(m => m.playerId), request.playerId);
      return { id: request.id, matchId: ctx.matchId, externalCourt: court };
    });
  }

  // -------------------------------------------------------------- scheduler

  /**
   * MM-27 start-time processing of one due recruitment (§24.4 start rows, §24.8), in its own
   * transaction with the §24.7 order. Idempotent: the state is re-read under the locks.
   */
  async processStart(requestId: number): Promise<StartOutcome | 'START_MATCHED' | 'NOOP'> {
    return runLocked(requestId, [], async (tx, ctx) => {
      const { request } = ctx;
      const now = new Date();
      if (request.startAt.getTime() > now.getTime()) return 'NOOP';
      if (request.status === 'OPEN') {
        // A roster left OPEN was never confirmed (or was reopened after a departure).
        await matchmakingRepository.closePendingForRequest(request.id, 'EXPIRED', 'POST_STARTED', tx);
        await matchmakingRepository.updateRequestStatus(request.id, 'EXPIRED', tx);
        if (ctx.matchId) {
          const match = await matchModule.lockMatch(ctx.matchId, tx);
          if (match && (ACTIVE_MATCH as readonly string[]).includes(match.status)) {
            await matchModule.transitionStatus({ matchId: match.id, from: match.status as any, to: 'CANCELLED', cancellationReason: MATCH_REASON_PLAYERS }, tx);
          }
        }
        return 'EXPIRE';
      }
      if (request.status !== 'MATCHED' || !ctx.matchId) return 'NOOP';
      const match = await matchModule.lockMatch(ctx.matchId, tx);
      if (!match || match.bookingId) return 'NOOP';
      if (match.status === 'PENDING_COURT') {
        await this.cancelAtStart(tx, ctx, 'COURT_NOT_BOOKED');
        return 'COURT_NOT_BOOKED';
      }
      if (match.status !== 'CONFIRMED') return 'NOOP';
      if (!rosterSufficient(request, ctx.accepted.length)) {
        await this.cancelAtStart(tx, ctx, 'INSUFFICIENT_PLAYERS');
        return 'INSUFFICIENT_PLAYERS';
      }
      await this.startMatch(tx, match.id, request.startAt);
      return 'START_MATCHED';
    });
  }

  private async startMatch(tx: Executor, matchId: number, startAt: Date): Promise<void> {
    const match = await matchModule.lockMatch(matchId, tx);
    if (match?.status === 'PENDING_COURT') {
      await matchModule.transitionStatus({ matchId, from: 'PENDING_COURT', to: 'CONFIRMED' }, tx);
    }
    await matchModule.transitionStatus({ matchId, from: 'CONFIRMED', to: 'IN_PROGRESS', startedAt: startAt }, tx);
  }

  /** COURT_NOT_BOOKED or INSUFFICIENT_PLAYERS at start: post and Match cancelled, booking kept. */
  private async cancelAtStart(tx: Executor, ctx: LockedRecruitment, reason: 'COURT_NOT_BOOKED' | 'INSUFFICIENT_PLAYERS'): Promise<void> {
    const { request } = ctx;
    await matchmakingRepository.cancelRecruitment(request.id, reason, tx);
    if (ctx.matchId) {
      const match = await matchModule.lockMatch(ctx.matchId, tx);
      if (match && (ACTIVE_MATCH as readonly string[]).includes(match.status)) {
        await matchModule.transitionStatus({ matchId: match.id, from: match.status as any, to: 'CANCELLED', cancellationReason: reason }, tx);
      }
    }
    const memberIds = ctx.accepted.map(m => m.playerId);
    if (reason === 'INSUFFICIENT_PLAYERS') {
      await notify.insufficientPlayers(tx, request.id, request.playerId, memberIds, request.bookingId != null);
    } else {
      await notify.post(tx, request.id, 'CANCELLED', [request.playerId, ...memberIds], null, 'Kèo chưa có sân khi đến giờ bắt đầu nên đã bị hủy');
    }
  }

  private async assertNoConflicts(tx: Executor, request: any, playerIds: number[]): Promise<void> {
    const end = addMinutes(request.startAt, request.durationMinutes);
    for (const playerId of playerIds) {
      if (await matchmakingRepository.hasOverlappingCommitment(playerId, request.startAt, end, request.id, tx)) {
        throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Thành viên đã có lịch chơi trùng');
      }
    }
  }
}

export const recruitmentLifecycleService = new RecruitmentLifecycleService();
