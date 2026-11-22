import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationService } from '../services/notifications/NotificationService';
import { matchmakingNotifications } from '../services/matchmaking/matchmaking-notifications';
import type { NotificationEvent } from '../contracts/NotificationService';

// C3 producer audit: existing Matchmaking producers emit one stable event per
// recipient, exclude the actor, and use the documented dedup keys. Persistence
// (rollback/dedup) is covered by notification-service.test.ts.

const tx = {} as never;

function capture(txArg: unknown = tx) {
  const spy = vi.spyOn(notificationService, 'notify').mockResolvedValue({ insertedIds: [], duplicateCount: 0 });
  return {
    spy,
    async events(call: Promise<unknown>): Promise<NotificationEvent[]> {
      await call;
      const last = spy.mock.calls.at(-1);
      if (!last) return [];
      expect(last[0]).toBe(txArg);
      return last[1] as NotificationEvent[];
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('notification producers (C3)', () => {
  it('MM_APPLICATION_RECEIVED / _ACCEPTED / _DECLINED target only their recipient with stable keys', async () => {
    const c = capture();
    const received = await c.events(matchmakingNotifications.applicationReceived(tx, 10, 77, 5));
    expect(received).toEqual([{
      recipientId: 5, type: 'MM_APPLICATION_RECEIVED', title: 'Yêu cầu tham gia kèo',
      content: 'Một người chơi muốn tham gia kèo của bạn',
      resource: { type: 'MATCHMAKING_REQUEST', id: 10 }, dedupKey: 'mm-app-received:77',
    }]);
    expect(await c.events(matchmakingNotifications.applicationDecided(tx, 10, 77, 6, 'ACCEPTED')))
      .toMatchObject([{ recipientId: 6, type: 'MM_APPLICATION_ACCEPTED', dedupKey: 'mm-app-decided:77' }]);
    expect(await c.events(matchmakingNotifications.applicationDecided(tx, 10, 77, 6, 'DECLINED')))
      .toMatchObject([{ recipientId: 6, type: 'MM_APPLICATION_DECLINED', dedupKey: 'mm-app-decided:77' }]);
  });

  it('MM_INVITATION_RECEIVED and membership changes exclude the actor and drop duplicate recipients', async () => {
    const c = capture();
    expect(await c.events(matchmakingNotifications.invitationReceived(tx, 11, 88, 7)))
      .toMatchObject([{ recipientId: 7, type: 'MM_INVITATION_RECEIVED', dedupKey: 'mm-inv-received:88' }]);

    const joined = await c.events(matchmakingNotifications.membershipChanged(tx, 11, 88, 'ACCEPTED', [7, 8, 7, 9], 9));
    expect(joined.map(event => event.recipientId)).toEqual([7, 8]);
    expect(joined.every(event => event.type === 'MM_MEMBERSHIP_CHANGED')).toBe(true);
    expect(joined.map(event => event.dedupKey)).toEqual([
      'mm-member:88:ACCEPTED:7', 'mm-member:88:ACCEPTED:8',
    ]);
  });

  it('conflict closure notifies each affected player and Apply host once', async () => {
    const c = capture();
    const events = await c.events(matchmakingNotifications.pendingClosedByConflict(tx, [
      { rowId: 1, requestId: 20, playerId: 7, applyHostId: 5 },
      { rowId: 2, requestId: 20, playerId: 8, applyHostId: null },
    ]));
    expect(events.map(event => event.recipientId)).toEqual([5, 7, 8]);
    expect(events.map(event => event.dedupKey)).toEqual([
      'mm-conflict-close:1:5', 'mm-conflict-close:1:7', 'mm-conflict-close:2:8',
    ]);
    expect(events.every(event => event.type === 'MM_PENDING_CLOSED_CONFLICT' && event.resource?.id === 20)).toBe(true);
  });

  it('post cancel/close, reopen, insufficient players and court updates never notify the actor', async () => {
    const c = capture();
    const cancelled = await c.events(matchmakingNotifications.post(tx, 30, 'CANCELLED', [40, 41, 42], 40, 'Chủ kèo đã hủy kèo'));
    expect(cancelled.map(event => event.recipientId)).toEqual([41, 42]);
    expect(cancelled.map(event => event.dedupKey)).toEqual([
      'mm-post:30:CANCELLED:41', 'mm-post:30:CANCELLED:42',
    ]);
    expect(cancelled[0].type).toBe('MM_POST_CANCELLED');

    const closed = await c.events(matchmakingNotifications.post(tx, 30, 'MATCHED', [40, 41], null, 'Kèo đã chốt danh sách'));
    expect(closed.map(event => event.recipientId)).toEqual([40, 41]);
    expect(closed[0].type).toBe('MM_POST_CLOSED');

    const reopened = await c.events(matchmakingNotifications.reopened(tx, 30, 99, [40, 41, 42], 41));
    expect(reopened.map(event => event.recipientId)).toEqual([40, 42]);
    expect(reopened[0].dedupKey).toBe('mm-reopen:30:99:40');

    const insufficient = await c.events(matchmakingNotifications.insufficientPlayers(tx, 30, 40, [41, 42], true));
    expect(insufficient.map(event => event.recipientId)).toEqual([40, 41, 42]);
    expect(insufficient[0].content).toContain('Lịch đặt sân của bạn vẫn còn hiệu lực');
    expect(insufficient[1].content).not.toContain('Lịch đặt sân');

    const court = await c.events(matchmakingNotifications.courtUpdated(tx, 30, 55, [40, 41], 40));
    expect(court.map(event => event.recipientId)).toEqual([41]);
    expect(court[0].dedupKey).toBe('mm-court:30:55:41');
  });

  it('a repeated transition produces the same dedup keys so retries cannot duplicate', async () => {
    const c = capture();
    const first = await c.events(matchmakingNotifications.post(tx, 30, 'CANCELLED', [41], 40, 'x'));
    const retry = await c.events(matchmakingNotifications.post(tx, 30, 'CANCELLED', [41], 40, 'x'));
    expect(retry).toEqual(first);
  });

  it('emits no events when every recipient is the actor', async () => {
    const c = capture();
    expect(await c.events(matchmakingNotifications.post(tx, 30, 'CANCELLED', [40, 40], 40, 'x'))).toEqual([]);
    expect(await c.events(matchmakingNotifications.membershipChanged(tx, 30, 88, 'WITHDRAWN', [40], 40))).toEqual([]);
  });
});
