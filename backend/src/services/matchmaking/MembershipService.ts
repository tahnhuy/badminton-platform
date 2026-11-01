import { db } from '../../db';
import { AppError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../match/match.module';
import { isBlockedEitherWay } from './block-port.registry';
import { isPostPublished } from '../social/recruitment-post';
import { addMinutes } from './matchmaking-time.util';
import { isFull } from './recruitment-state';
import { formMatch } from './RecruitmentLifecycleService';
import { matchmakingNotifications as notify } from './matchmaking-notifications';

// MM-22: shared acceptance transaction (Matchmaking Tech Design §24.5) used by Invite
// response and, from MM-24, Apply decision. Lock order (§24.7.3 "acceptMembership"):
// users(10) → requests(30) → invitations(40, complete affected set ascending) → matches(50).
// No conversation is created, synced or locked (Messaging is standalone).

type Executor = any;

export interface AcceptResult {
  rowId: number;
  requestId: number;
  status: 'ACCEPTED';
  matchId: number | null;
}

/** Thrown inside the transaction after a state change that must still commit. */
class CommitThenFail {
  constructor(readonly error: AppError) {}
}

const conflict = (code: string, message: string) => new AppError(code, 409, message);

function notFound(kind: string): NotFoundError {
  return kind === 'APPLY'
    ? new NotFoundError('Không tìm thấy đơn xin tham gia', 'MATCHMAKING_APPLICATION_NOT_FOUND')
    : new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
}

function intervalOf(request: { startAt: Date; durationMinutes: number }) {
  return { start: request.startAt, end: addMinutes(request.startAt, request.durationMinutes) };
}

function isRecruitmentOpen(request: any, now: Date): boolean {
  if (request.status !== 'OPEN') return false;
  if (request.expiresAt && request.expiresAt.getTime() <= now.getTime()) return false;
  return request.startAt.getTime() > now.getTime();
}

/** Overlapping PENDING row of another recruitment to close on confirmed participation (MM-26). */
interface ClosableRow {
  rowId: number;
  requestId: number;
  playerId: number;
  applyHostId: number | null;
}

export class MembershipService {
  async acceptMembership(rowId: number, actorId: number): Promise<AcceptResult> {
    for (;;) {
      const outcome = await this.attempt(rowId, actorId);
      if (outcome === 'retry') continue;
      if (outcome instanceof CommitThenFail) throw outcome.error;
      return outcome;
    }
  }

  /**
   * One attempt: snapshot outside, lock in global order, retry if the locked set changed.
   * The required rank-40 set is derived from the snapshot interval; under the request lock
   * it is recomputed from the locked recruitment's interval (never from the snapshot).
   */
  private async attempt(rowId: number, actorId: number): Promise<AcceptResult | CommitThenFail | 'retry'> {
    const row = await matchmakingRepository.findInvitationById(rowId);
    if (!row) throw new NotFoundError('Không tìm thấy lời mời', 'MATCHMAKING_INVITATION_NOT_FOUND');
    const request = await matchmakingRepository.findRequestById(row.requestId);
    if (!request) throw notFound(row.kind);
    const members = await matchmakingRepository.findAcceptedInvitees(row.requestId);
    const pendingPlayers = await matchmakingRepository.findPendingRows(row.requestId);
    const snapshotInterval = intervalOf(request);
    const overlapping = row.status === 'PENDING'
      ? await matchmakingRepository.findOverlappingPendingForPlayer(row.playerId, snapshotInterval.start, snapshotInterval.end, request.id)
      : [];
    const applyHosts = await matchmakingRepository.findApplyRowHosts(overlapping);
    // MM-31: every notification recipient's USERS row is locked up front (rank 10), because a
    // notification insert takes an implicit KEY SHARE lock on it: host, joiner, members,
    // pending Players of this request (closed when it fills) and hosts of overlapping Applies.
    const userIds = [request.playerId, row.playerId, ...members.map((m: any) => m.playerId),
      ...pendingPlayers.map(p => p.playerId), ...applyHosts.map(h => h.hostId)];
    const rowIds = [rowId, ...overlapping];
    return db.transaction(async tx => {
      // users(10) → requests(30) → invitations(40) (§24.7.3 "acceptMembership").
      await matchmakingRepository.lockUsersAscending(userIds, tx);
      const lockedRequest = await matchmakingRepository.lockRequestById(row.requestId, tx);
      if (!lockedRequest) throw notFound(row.kind);
      const currentMembers = await matchmakingRepository.findAcceptedInvitees(row.requestId, tx);
      if (currentMembers.some((m: any) => !userIds.includes(m.playerId))) return 'retry' as const;
      const currentPending = await matchmakingRepository.findPendingRows(row.requestId, tx);
      if (currentPending.some(p => !userIds.includes(p.playerId))) return 'retry' as const;
      const locked = await matchmakingRepository.lockMembershipRowsAscending(rowIds, tx);
      const target = locked.find((candidate: any) => candidate.id === rowId);
      // Authorize against the locked rows before any replay or state-dependent branch.
      this.authorize(lockedRequest, target, actorId);
      // Replay: an ACCEPTED row closes nothing, so the overlap set is irrelevant.
      if (target.status === 'ACCEPTED') return this.replayAccepted(tx, target);
      if (target.status !== 'PENDING') return this.decide(tx, lockedRequest, target, actorId, []);
      // The recruitment interval may have changed while waiting for the locks: the
      // snapshot-derived lock set is no longer trustworthy, so retry with a new snapshot.
      const lockedInterval = intervalOf(lockedRequest);
      if (lockedInterval.start.getTime() !== snapshotInterval.start.getTime()
        || lockedInterval.end.getTime() !== snapshotInterval.end.getTime()) return 'retry' as const;
      const currentOverlap = await matchmakingRepository.findOverlappingPendingForPlayer(
        target.playerId, lockedInterval.start, lockedInterval.end, lockedRequest.id, tx);
      if (currentOverlap.some(id => !rowIds.includes(id))) return 'retry' as const;
      const applyHostByRow = new Map(applyHosts.map(h => [h.rowId, h.hostId]));
      const closable = locked
        .filter((candidate: any) => candidate.id !== rowId && currentOverlap.includes(candidate.id))
        .map((candidate: any) => ({ rowId: candidate.id, requestId: candidate.requestId, playerId: candidate.playerId, applyHostId: applyHostByRow.get(candidate.id) ?? null }));
      return this.decide(tx, lockedRequest, target, actorId, closable);
    });
  }

  /** Actor must be the decider of the locked row (§24.5 step 3); otherwise not found. */
  private authorize(request: any, row: any, actorId: number): void {
    const decider = row?.kind === 'APPLY' ? request?.playerId : row?.playerId;
    if (!row || !request || decider !== actorId) throw notFound(row?.kind ?? 'INVITE');
  }

  private async replayAccepted(tx: Executor, row: any): Promise<AcceptResult> {
    const link = await matchmakingRepository.findMatchLinkByRequestId(row.requestId, tx);
    return { rowId: row.id, requestId: row.requestId, status: 'ACCEPTED', matchId: link?.matchId ?? null };
  }

  private async decide(tx: Executor, request: any, row: any, actorId: number, overlapping: ClosableRow[]): Promise<AcceptResult | CommitThenFail> {
    this.authorize(request, row, actorId);
    if (row.status === 'ACCEPTED') return this.replayAccepted(tx, row);
    const persisted = await this.closeIfNoLongerAcceptable(tx, request, row);
    if (persisted) return persisted;
    await this.assertAcceptable(tx, request, row);
    return this.applyAcceptance(tx, request, row, actorId, overlapping);
  }

  /** Expired row or closed recruitment: persist the closure (commit), then report the error. */
  private async closeIfNoLongerAcceptable(tx: Executor, request: any, row: any): Promise<CommitThenFail | null> {
    const now = new Date();
    if (row.status !== 'PENDING') throw this.closedRowError(row, now);
    if (row.expiresAt.getTime() <= now.getTime()) {
      await matchmakingRepository.updateInvitationStatus(row.id, 'EXPIRED', null, 'PENDING', tx);
      return new CommitThenFail(conflict('MATCHMAKING_INVITATION_EXPIRED', 'Lời mời đã hết hạn'));
    }
    if (isRecruitmentOpen(request, now)) return null;
    const full = request.status === 'MATCHED';
    await matchmakingRepository.updateInvitationStatus(row.id, full || request.status === 'CANCELLED' ? 'CANCELLED' : 'EXPIRED', null, 'PENDING', tx,
      full ? { closeReason: 'RECRUITMENT_CLOSED' } : {});
    return new CommitThenFail(full
      ? conflict('MATCHMAKING_REQUEST_FULL', 'Kèo đã đủ người')
      : conflict('MATCHMAKING_INVITATION_EXPIRED', 'Yêu cầu không còn mở'));
  }

  /** §24.5 step 3 recheck list (no state change; any failure rolls back). */
  private async assertAcceptable(tx: Executor, request: any, row: any): Promise<void> {
    if (row.kind === 'APPLY' && !(await isPostPublished(request.postId, tx))) {
      throw conflict('MATCHMAKING_POST_NOT_PUBLISHED', 'Bài tìm kèo chưa được công khai');
    }
    if (await isBlockedEitherWay(row.playerId, request.playerId, tx)) {
      throw conflict('MATCHMAKING_ACTION_NOT_AVAILABLE', 'Không thể thực hiện thao tác này');
    }
    const accepted = await matchmakingRepository.findAcceptedInvitees(request.id, tx);
    if (1 + request.companionCount + accepted.length >= request.capacity) {
      throw conflict('MATCHMAKING_REQUEST_FULL', 'Kèo đã đủ người');
    }
    const { start, end } = intervalOf(request);
    if (await matchmakingRepository.hasOverlappingCommitment(row.playerId, start, end, request.id, tx)) {
      throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Người chơi đã có lịch chơi trùng với khung giờ này');
    }
  }

  private closedRowError(row: any, now: Date): AppError {
    if (row.closeReason === 'SCHEDULE_CONFLICT') return conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Người chơi đã có lịch chơi trùng với khung giờ này');
    if (row.closeReason === 'RECRUITMENT_CLOSED') return conflict('MATCHMAKING_REQUEST_FULL', 'Kèo đã đủ người');
    if (row.status === 'EXPIRED' || row.expiresAt.getTime() <= now.getTime()) {
      return conflict('MATCHMAKING_INVITATION_EXPIRED', 'Lời mời đã hết hạn');
    }
    return conflict('MATCHMAKING_INVITATION_NOT_PENDING', 'Lời mời đã được xử lý hoặc đã đóng');
  }

  /** §24.5 steps 4–7. */
  private async applyAcceptance(tx: Executor, request: any, row: any, actorId: number, overlapping: ClosableRow[]): Promise<AcceptResult> {
    const accepted = await matchmakingRepository.updateInvitationStatus(row.id, 'ACCEPTED', new Date(), 'PENDING', tx, { decidedBy: actorId });
    if (!accepted) throw conflict('MATCHMAKING_INVITATION_NOT_PENDING', 'Lời mời đã được xử lý hoặc đã đóng');
    // MM-26: confirmed participation closes the joiner's overlapping pending rows.
    const closedIds = await matchmakingRepository.closePendingRows(overlapping.map(r => r.rowId), 'SCHEDULE_CONFLICT', tx);
    const members = await matchmakingRepository.findAcceptedInvitees(request.id, tx);
    const memberIds: number[] = members.map((m: any) => m.playerId);
    const groupIds: number[] = [request.playerId, ...memberIds];
    // A reopened GROUP keeps its Match (§24.4): the replacement joins the same roster.
    const link = request.matchType === 'GROUP' ? await matchmakingRepository.findMatchLinkByRequestId(request.id, tx) : null;
    let matchId: number | null = link?.matchId ?? null;
    let closedForFull: { playerId: number }[] = [];

    if (!isFull(request, members.length)) {
      if (link) await matchModule.activateGroupPlayer({ matchId: link.matchId, playerId: row.playerId }, tx);
    } else {
      const { start, end } = intervalOf(request);
      for (const memberId of groupIds) {
        if (await matchmakingRepository.hasOverlappingCommitment(memberId, start, end, request.id, tx)) {
          throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Thành viên đã có lịch chơi trùng');
        }
      }
      // Rank 40 changes before rank 50 (§24.5 step 6, §24.7.3 inventory fix).
      closedForFull = await matchmakingRepository.closePendingForRequest(request.id, 'CANCELLED', 'RECRUITMENT_CLOSED', tx);
      if (link) {
        await matchModule.activateGroupPlayer({ matchId: link.matchId, playerId: row.playerId }, tx);
      } else {
        matchId = await formMatch(tx, request, memberIds);
      }
      await matchmakingRepository.markRecruitmentMatched(request.id, null, tx);
    }

    // §24.5 step 7 (MM-31): inserts only, same transaction; recipients locked in attempt().
    await notify.pendingClosedByConflict(tx, overlapping.filter(r => closedIds.includes(r.rowId)));
    await notify.membershipChanged(tx, request.id, row.id, 'ACCEPTED', groupIds, row.playerId);
    if (closedForFull.length > 0) {
      await notify.post(tx, request.id, 'MATCHED', closedForFull.map(r => r.playerId), null, 'Kèo đã đủ người, yêu cầu tham gia của bạn đã đóng');
    }
    return { rowId: row.id, requestId: request.id, status: 'ACCEPTED', matchId };
  }
}

export const membershipService = new MembershipService();
