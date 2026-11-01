import { db } from '../../db';
import { AppError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository } from '../../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../match/match.module';
import { isBlockedEitherWay } from './block-port.registry';
import { isPostPublished } from '../social/recruitment-post';
import { addMinutes } from './matchmaking-time.util';

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

function assignTeams(matchType: string, playerIds: number[]): { playerId: number; teamNo: number }[] {
  if (matchType === 'SINGLES') return playerIds.map((playerId, index) => ({ playerId, teamNo: index + 1 }));
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.map((playerId, index) => ({ playerId, teamNo: index < 2 ? 1 : 2 }));
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
    const snapshotInterval = intervalOf(request);
    const overlapping = row.status === 'PENDING'
      ? await matchmakingRepository.findOverlappingPendingForPlayer(row.playerId, snapshotInterval.start, snapshotInterval.end, request.id)
      : [];
    const userIds = [request.playerId, row.playerId, ...members.map((m: any) => m.playerId)];
    const rowIds = [rowId, ...overlapping];
    return db.transaction(async tx => {
      // users(10) → requests(30) → invitations(40) (§24.7.3 "acceptMembership").
      await matchmakingRepository.lockUsersAscending(userIds, tx);
      const lockedRequest = await matchmakingRepository.lockRequestById(row.requestId, tx);
      if (!lockedRequest) throw notFound(row.kind);
      const currentMembers = await matchmakingRepository.findAcceptedInvitees(row.requestId, tx);
      if (currentMembers.some((m: any) => !userIds.includes(m.playerId))) return 'retry' as const;
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
      return this.decide(tx, lockedRequest, target, actorId, currentOverlap);
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

  private async decide(tx: Executor, request: any, row: any, actorId: number, overlapping: number[]): Promise<AcceptResult | CommitThenFail> {
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

  /** §24.5 steps 4–6. */
  private async applyAcceptance(tx: Executor, request: any, row: any, actorId: number, overlapping: number[]): Promise<AcceptResult> {
    const accepted = await matchmakingRepository.updateInvitationStatus(row.id, 'ACCEPTED', new Date(), 'PENDING', tx, { decidedBy: actorId });
    if (!accepted) throw conflict('MATCHMAKING_INVITATION_NOT_PENDING', 'Lời mời đã được xử lý hoặc đã đóng');
    // MM-26: confirmed participation closes the joiner's overlapping pending rows.
    await matchmakingRepository.closePendingRows(overlapping.filter(id => id !== row.id), 'SCHEDULE_CONFLICT', tx);
    const members = await matchmakingRepository.findAcceptedInvitees(request.id, tx);
    const groupIds: number[] = [request.playerId, ...members.map((m: any) => m.playerId)];
    if (1 + request.companionCount + members.length < request.capacity) {
      return { rowId: row.id, requestId: request.id, status: 'ACCEPTED', matchId: null };
    }
    if (request.matchType === 'GROUP') {
      throw new Error('GROUP formation/roster update is delivered with MM-23/MM-25 (no GROUP recruitment can exist yet)');
    }
    const { start, end } = intervalOf(request);
    for (const memberId of groupIds) {
      if (await matchmakingRepository.hasOverlappingCommitment(memberId, start, end, request.id, tx)) {
        throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Thành viên đã có lịch chơi trùng');
      }
    }
    // Rank 40 changes before rank 50 (§24.5 step 6, §24.7.3 inventory fix).
    await matchmakingRepository.closePendingInvitationsForRequest(request.id, 'CANCELLED', tx, 'RECRUITMENT_CLOSED');
    const { matchId } = await matchModule.createMatchWithPlayers({
      matchType: request.matchType as 'SINGLES' | 'DOUBLES',
      scheduledAt: request.startAt,
      bookingDeadlineAt: request.startAt,
      status: 'PENDING_COURT',
      players: assignTeams(request.matchType, groupIds),
    }, tx);
    await matchmakingRepository.insertMatchLink(request.id, matchId, tx);
    await matchmakingRepository.updateRequestStatus(request.id, 'MATCHED', tx);
    return { rowId: row.id, requestId: request.id, status: 'ACCEPTED', matchId };
  }
}

export const membershipService = new MembershipService();
