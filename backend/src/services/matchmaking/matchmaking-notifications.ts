import { notificationService } from '../notifications/NotificationService';
import type { NotificationEvent, NotifyResult } from '../../contracts/NotificationService';
import type { TransactionContext } from '../../contracts/TransactionContext';

// MM-31 producers (Notifications Tech Design, "Social Matchmaking extension"). Every event
// is inserted through NotificationService in the caller's state-transition transaction with
// the documented dedup key, so retries never duplicate and a rollback removes it.
//
// Lock note (§24.7.1 rule 5): inserting a notification takes an implicit KEY SHARE lock on
// the recipient's USERS row. Callers must already hold every recipient's USERS row (rank 10)
// before any higher-rank lock; the lifecycle and acceptance transactions lock host, members,
// pending Players and Apply hosts up front for this reason.

const RESOURCE = 'MATCHMAKING_REQUEST';

function unique(ids: readonly number[], exclude: readonly number[] = []): number[] {
  return [...new Set(ids)].filter(id => !exclude.includes(id)).sort((a, b) => a - b);
}

async function emit(tx: TransactionContext, events: NotificationEvent[]): Promise<NotifyResult> {
  if (events.length === 0) return { insertedIds: [], duplicateCount: 0 };
  return notificationService.notify(tx, events);
}

function forEach(requestId: number, recipients: number[], type: string, title: string, content: string, key: (id: number) => string): NotificationEvent[] {
  return recipients.map(recipientId => ({
    recipientId, type, title, content, resource: { type: RESOURCE, id: requestId }, dedupKey: key(recipientId),
  }));
}

export const matchmakingNotifications = {
  memberRemoved(tx: TransactionContext, requestId: number, rowId: number, playerId: number) {
    return emit(tx, forEach(requestId, [playerId], 'MM_MEMBERSHIP_CHANGED', 'Bạn đã được loại khỏi kèo',
      'Chủ kèo đã loại bạn khỏi danh sách người chơi', () => `mm-member-removed:${rowId}`));
  },
  applicationReceived(tx: TransactionContext, requestId: number, rowId: number, hostId: number) {
    return emit(tx, forEach(requestId, [hostId], 'MM_APPLICATION_RECEIVED', 'Yêu cầu tham gia kèo',
      'Một người chơi muốn tham gia kèo của bạn', () => `mm-app-received:${rowId}`));
  },
  applicationDecided(tx: TransactionContext, requestId: number, rowId: number, playerId: number, status: 'ACCEPTED' | 'DECLINED') {
    return emit(tx, forEach(requestId, [playerId], `MM_APPLICATION_${status}`, 'Kết quả yêu cầu tham gia',
      status === 'ACCEPTED' ? 'Chủ kèo đã duyệt yêu cầu tham gia của bạn' : 'Chủ kèo đã từ chối yêu cầu tham gia của bạn',
      () => `mm-app-decided:${rowId}`));
  },
  /** MM_INVITATION_RECEIVED (including unpublished posts) → invitee. */
  invitationReceived(tx: TransactionContext, requestId: number, rowId: number, inviteeId: number) {
    return emit(tx, forEach(requestId, [inviteeId], 'MM_INVITATION_RECEIVED', 'Lời mời tham gia kèo',
      'Bạn nhận được lời mời tham gia một kèo', () => `mm-inv-received:${rowId}`));
  },

  /** MM_MEMBERSHIP_CHANGED → host and current members (the actor excluded). */
  membershipChanged(tx: TransactionContext, requestId: number, rowId: number, status: 'ACCEPTED' | 'WITHDRAWN',
    recipients: number[], actorId: number) {
    const content = status === 'ACCEPTED' ? 'Một người chơi đã tham gia kèo' : 'Một thành viên đã rút khỏi kèo';
    return emit(tx, forEach(requestId, unique(recipients, [actorId]), 'MM_MEMBERSHIP_CHANGED', 'Thành viên kèo thay đổi',
      content, id => `mm-member:${rowId}:${status}:${id}`));
  },

  /** MM_PENDING_CLOSED_CONFLICT → the joiner of each closed row, and the host for Apply rows. */
  pendingClosedByConflict(tx: TransactionContext, closed: { rowId: number; requestId: number; playerId: number; applyHostId: number | null }[]) {
    const events = closed.flatMap(row => forEach(row.requestId, unique([row.playerId, ...(row.applyHostId ? [row.applyHostId] : [])]),
      'MM_PENDING_CLOSED_CONFLICT', 'Yêu cầu tham gia đã đóng', 'Yêu cầu tham gia đã đóng vì trùng lịch với kèo đã xác nhận',
      id => `mm-conflict-close:${row.rowId}:${id}`));
    return emit(tx, events);
  },

  /** MM_POST_CANCELLED / MM_POST_CLOSED → members and pending Players (the actor excluded). */
  post(tx: TransactionContext, requestId: number, status: 'CANCELLED' | 'MATCHED', recipients: number[], actorId: number | null, content: string) {
    const type = status === 'CANCELLED' ? 'MM_POST_CANCELLED' : 'MM_POST_CLOSED';
    const title = status === 'CANCELLED' ? 'Kèo đã bị hủy' : 'Kèo đã chốt danh sách';
    return emit(tx, forEach(requestId, unique(recipients, actorId ? [actorId] : []), type, title, content,
      id => `mm-post:${requestId}:${status}:${id}`));
  },

  /** MM_RECRUITMENT_REOPENED → host and remaining members. */
  reopened(tx: TransactionContext, requestId: number, withdrawRowId: number, recipients: number[], actorId: number) {
    return emit(tx, forEach(requestId, unique(recipients, [actorId]), 'MM_RECRUITMENT_REOPENED', 'Kèo mở lại tuyển người',
      'Một thành viên đã rút, kèo giao lưu mở lại để tìm người thay thế', id => `mm-reopen:${requestId}:${withdrawRowId}:${id}`));
  },

  /** MM_CLOSED_INSUFFICIENT_PLAYERS → host (told whether a kept booking remains valid) and members. */
  insufficientPlayers(tx: TransactionContext, requestId: number, hostId: number, members: number[], bookingKept: boolean) {
    const hostContent = bookingKept
      ? 'Kèo giao lưu không đủ người khi bắt đầu nên đã bị hủy. Lịch đặt sân của bạn vẫn còn hiệu lực.'
      : 'Kèo giao lưu không đủ người khi bắt đầu nên đã bị hủy.';
    const events = [
      ...forEach(requestId, [hostId], 'MM_CLOSED_INSUFFICIENT_PLAYERS', 'Kèo bị hủy do không đủ người', hostContent,
        id => `mm-insufficient:${requestId}:${id}`),
      ...forEach(requestId, unique(members, [hostId]), 'MM_CLOSED_INSUFFICIENT_PLAYERS', 'Kèo bị hủy do không đủ người',
        'Kèo giao lưu không đủ người khi bắt đầu nên đã bị hủy.', id => `mm-insufficient:${requestId}:${id}`),
    ];
    return emit(tx, events);
  },

  /**
   * MM_COURT_UPDATED → members. The documented key carries the booking id; an external
   * court (one per post, never replaced by another external court) uses `external`.
   */
  courtUpdated(tx: TransactionContext, requestId: number, courtRef: number | 'external', members: number[], hostId: number) {
    return emit(tx, forEach(requestId, unique(members, [hostId]), 'MM_COURT_UPDATED', 'Kèo đã có sân',
      'Chủ kèo đã cập nhật sân cho kèo của bạn', id => `mm-court:${requestId}:${courtRef}:${id}`));
  },

  /** MM_BOOKING_CANCELLED → host and members when the linked booking is cancelled. */
  bookingCancelled(tx: TransactionContext, requestId: number, recipients: number[]) {
    return emit(tx, forEach(requestId, unique(recipients), 'MM_BOOKING_CANCELLED', 'Lịch đặt sân của kèo đã bị hủy',
      'Lịch đặt sân liên kết với kèo đã bị hủy. Kèo của bạn cũng đã bị hủy.', id => `mm-booking-cancelled:${requestId}:${id}`));
  },

  /** Split booking succeeded: every contributor is told how much their wallet was charged. */
  splitCostShared(tx: TransactionContext, requestId: number, bookingId: number,
    shares: { playerId: number; amount: string }[], hostId: number) {
    const events = shares.map(share => ({
      recipientId: share.playerId,
      type: 'MM_SPLIT_COST_SHARED',
      title: 'Đã chia tiền sân cho kèo',
      content: share.playerId === hostId
        ? `Bạn đã đặt sân và thanh toán ${Number(share.amount).toLocaleString('vi-VN')}đ tiền sân kèo #${requestId}.`
        : `Bạn đã thanh toán ${Number(share.amount).toLocaleString('vi-VN')}đ tiền sân kèo #${requestId}.`,
      resource: { type: RESOURCE, id: requestId },
      dedupKey: `mm-split-cost:${bookingId}:${share.playerId}`,
    }));
    return emit(tx, events);
  },

  /** Host asks members with insufficient wallet balance to top up. One per member per day. */
  splitTopupRequired(tx: TransactionContext, requestId: number,
    members: { playerId: number; shortfall: number }[], dedupDate: string) {
    const events = members.map(member => ({
      recipientId: member.playerId,
      type: 'MM_SPLIT_TOPUP_REQUIRED',
      title: 'Cần nạp thêm tiền để chia sân kèo',
      content: `Bạn cần nạp thêm ${member.shortfall.toLocaleString('vi-VN')}đ vào ví để thanh toán phần sân kèo #${requestId}. Chủ kèo đang chờ.`,
      resource: { type: RESOURCE, id: requestId },
      dedupKey: `mm-split-topup:${requestId}:${member.playerId}:${dedupDate}`,
    }));
    return emit(tx, events);
  },
};
