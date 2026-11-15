import { and, eq, inArray, lte } from 'drizzle-orm';
import { db, matchmakingInvitations } from '../../db';
import { AppError, NotFoundError } from '../../errors/AppError';
import { matchmakingRepository as repository } from '../../repositories/matchmaking/MatchmakingRepository';
import { applicationRepository } from '../../repositories/matchmaking/ApplicationRepository';
import { matchmakingConfig } from '../../shared/config/matchmaking-config';
import { isPostPublished, postContentPort } from '../social/recruitment-post';
import { isBlockedEitherWay } from './block-port.registry';
import { addMinutes, minInstant } from './matchmaking-time.util';
import { membershipService } from './MembershipService';
import { matchmakingNotifications as notify } from './matchmaking-notifications';
import type { ApplicationsQuery } from '../../validation/matchmaking';

const notFound = () => new NotFoundError('Không tìm thấy đơn xin tham gia', 'MATCHMAKING_APPLICATION_NOT_FOUND');
const requestNotFound = () => new NotFoundError('Không tìm thấy kèo', 'MATCHMAKING_REQUEST_NOT_FOUND');
const conflict = (code: string, message: string) => new AppError(code, 409, message);
const expired = () => conflict('MATCHMAKING_APPLICATION_EXPIRED', 'Đơn xin tham gia đã hết hạn');
const notPending = () => conflict('MATCHMAKING_APPLICATION_NOT_PENDING', 'Đơn xin tham gia đã được xử lý hoặc đã đóng');

export class ApplicationService {
  async create(playerId: number, requestId: number) {
    const config = await matchmakingConfig.get();
    if (!config.enabled) throw conflict('MATCHMAKING_DISABLED', 'Tính năng tìm kèo đang tạm khóa');
    const snapshot = await repository.findRequestById(requestId);
    if (!snapshot) throw requestNotFound();
    let id: number;
    try {
      id = await db.transaction(async tx => {
        // Rank 10 -> 30 -> 40; serializes with Invite and block creation.
        await repository.lockUsersAscending([playerId, snapshot.playerId], tx);
        const request = await repository.lockRequestById(requestId, tx);
        if (!request) throw requestNotFound();
        if (request.playerId === playerId) throw conflict('MATCHMAKING_ACTION_NOT_AVAILABLE', 'Không thể xin tham gia kèo của chính mình');
        if (!(await isPostPublished(request.postId, tx))) throw conflict('MATCHMAKING_POST_NOT_PUBLISHED', 'Bài tìm kèo chưa được công khai');
        if (!(await postContentPort.isVisible(request.postId, playerId, tx))) throw requestNotFound();
        const now = new Date();
        if (request.status === 'MATCHED') throw conflict('MATCHMAKING_REQUEST_FULL', 'Kèo đã chốt danh sách');
        if (request.status !== 'OPEN' || request.startAt <= now || (request.expiresAt && request.expiresAt <= now)) {
          throw conflict('MATCHMAKING_REQUEST_NOT_OPEN', 'Kèo không còn nhận người chơi');
        }
        const applicant = await repository.findInviteeProfile(playerId, tx);
        if (!applicant || applicant.role !== 'PLAYER' || applicant.deletedAt) throw notFound();
        // Expire only this player's stale row, with explicit ascending rank-40 locks.
        const old = await tx.select({ id: matchmakingInvitations.id }).from(matchmakingInvitations)
          .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.playerId, playerId), inArray(matchmakingInvitations.status, ['PENDING', 'ACCEPTED'])));
        await repository.lockMembershipRowsAscending(old.map(row => row.id), tx);
        await tx.update(matchmakingInvitations).set({ status: 'EXPIRED', updatedAt: now })
          .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.playerId, playerId), eq(matchmakingInvitations.status, 'PENDING'),
            // Same captured time as the remaining send guards.
            inArray(matchmakingInvitations.id, old.map(row => row.id)),
            // Compare in SQL to retain conditional-update safety.
            lte(matchmakingInvitations.expiresAt, now)));
        const members = await repository.findAcceptedInvitees(requestId, tx);
        if (members.some((member: { playerId: number }) => member.playerId === playerId) || await repository.findPendingInvitation(requestId, playerId, tx)) {
          throw conflict('MATCHMAKING_ALREADY_ACTIVE', 'Bạn đã có lời mời hoặc yêu cầu tham gia còn hiệu lực cho kèo này');
        }
        if (1 + request.companionCount + members.length >= request.capacity) throw conflict('MATCHMAKING_REQUEST_FULL', 'Kèo đã đủ người');
        if (await isBlockedEitherWay(playerId, request.playerId, tx)) throw conflict('MATCHMAKING_ACTION_NOT_AVAILABLE', 'Không thể thực hiện thao tác này');
        if (await repository.hasOverlappingCommitment(playerId, request.startAt, addMinutes(request.startAt, request.durationMinutes), request.id, tx)) {
          throw conflict('MATCHMAKING_SCHEDULE_CONFLICT', 'Bạn đã có lịch chơi trùng với khung giờ này');
        }
        const expiresAt = minInstant(minInstant(addMinutes(now, config.applicationTimeoutMinutes), request.startAt), request.expiresAt ?? request.startAt);
        const inserted = await repository.insertInvitation({ requestId, playerId, createdBy: playerId, kind: 'APPLY', expiresAt }, tx);
        await notify.applicationReceived(tx, requestId, inserted.id, request.playerId);
        return inserted.id;
      });
    } catch (error) {
      const pg = error as { code?: string; cause?: { code?: string } };
      if (pg.code === '23505' || pg.cause?.code === '23505') throw conflict('MATCHMAKING_ALREADY_ACTIVE', 'Bạn đã có lời mời hoặc yêu cầu tham gia còn hiệu lực');
      throw error;
    }
    return applicationRepository.byId(id);
  }

  async listForHost(hostId: number, requestId: number, query: ApplicationsQuery) {
    const request = await repository.findRequestById(requestId);
    if (!request || request.playerId !== hostId) throw requestNotFound();
    return applicationRepository.list({ requestId }, query);
  }
  listMine(playerId: number, query: ApplicationsQuery) { return applicationRepository.list({ playerId }, query); }

  async decide(hostId: number, id: number, decision: 'ACCEPTED' | 'DECLINED') {
    const row = await repository.findInvitationById(id);
    if (!row || row.kind !== 'APPLY') throw notFound();
    const request = await repository.findRequestById(row.requestId);
    if (!request || request.playerId !== hostId) throw notFound();
    if (decision === 'ACCEPTED') {
      const accepted = await membershipService.acceptMembership(id, hostId);
      return { id, requestId: accepted.requestId, status: accepted.status, matchId: accepted.matchId };
    }
    return this.close(hostId, id, 'DECLINED');
  }
  cancel(playerId: number, id: number) { return this.close(playerId, id, 'CANCELLED'); }

  private async close(actorId: number, id: number, target: 'DECLINED' | 'CANCELLED') {
    const snapshot = await repository.findInvitationById(id);
    if (!snapshot || snapshot.kind !== 'APPLY') throw notFound();
    const requestSnapshot = await repository.findRequestById(snapshot.requestId);
    if (!requestSnapshot) throw notFound();
    const result = await db.transaction(async tx => {
      await repository.lockUsersAscending([requestSnapshot.playerId, snapshot.playerId], tx);
      const request = await repository.lockRequestById(snapshot.requestId, tx);
      const row = await repository.lockInvitationById(id, tx);
      if (!request || !row || row.kind !== 'APPLY' || (target === 'DECLINED' ? request.playerId : row.playerId) !== actorId) throw notFound();
      if (row.status === target) return { id, requestId: row.requestId, status: target, matchId: null };
      if (row.status !== 'PENDING') {
        if (row.status === 'EXPIRED') throw expired();
        throw notPending();
      }
      const now = new Date();
      if (row.expiresAt <= now || request.startAt <= now || request.status !== 'OPEN' || (request.expiresAt && request.expiresAt <= now)) {
        const closed = request.status === 'MATCHED' || request.status === 'CANCELLED';
        await repository.updateInvitationStatus(id, closed ? 'CANCELLED' : 'EXPIRED', null, 'PENDING', tx,
          closed ? { closeReason: 'RECRUITMENT_CLOSED' } : {});
        return closed ? notPending() : expired(); // Commit closure, then throw outside.
      }
      await repository.updateInvitationStatus(id, target, target === 'DECLINED' ? now : null, 'PENDING', tx,
        target === 'DECLINED' ? { decidedBy: actorId } : {});
      if (target === 'DECLINED') await notify.applicationDecided(tx, row.requestId, id, row.playerId, 'DECLINED');
      return { id, requestId: row.requestId, status: target, matchId: null };
    });
    if (result instanceof AppError) throw result;
    return result;
  }
}

export const applicationService = new ApplicationService();
