import { describe, it, expect, beforeEach } from 'vitest';
import { asc, eq, sql } from 'drizzle-orm';
import { db, pool, notifications, reports } from '../db';
import { notificationService } from '../services/notifications/NotificationService';
import type { NotificationEvent } from '../contracts/NotificationService';
import type { TransactionContext } from '../contracts/TransactionContext';
import { createTestUser } from './test-helpers';

// NTF-02: persistence inside the caller's transaction with dedup keys.
const event = (recipientId: number, dedupKey: string, extra: Partial<NotificationEvent> = {}): NotificationEvent => ({
  recipientId,
  type: 'MM_APPLICATION_RECEIVED',
  title: 'Có người xin tham gia',
  content: 'Một Player vừa xin tham gia kèo của bạn.',
  resource: { type: 'MATCHMAKING_REQUEST', id: 42 },
  dedupKey,
  ...extra,
});

async function rowsFor(userId: number) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(asc(notifications.id));
}

describe('NotificationService.notify (NTF-02)', () => {
  let alice: number;
  let bob: number;

  beforeEach(async () => {
    alice = (await createTestUser()).id;
    bob = (await createTestUser()).id;
  });

  it('stores resource reference and dedup key in the caller transaction, invisible to others until commit', async () => {
    let seenOutside = -1;
    await db.transaction(async tx => {
      const result = await notificationService.notify(tx, [event(alice, 'mm-app-received:1')]);
      expect(result.insertedIds).toHaveLength(1);
      expect(result.duplicateCount).toBe(0);
      const outside = await pool.query('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1', [alice]);
      seenOutside = outside.rows[0].n;
    });
    expect(seenOutside).toBe(0);
    const [row] = await rowsFor(alice);
    expect(row).toMatchObject({
      userId: alice, type: 'MM_APPLICATION_RECEIVED', resourceType: 'MATCHMAKING_REQUEST', resourceId: 42,
      dedupKey: 'mm-app-received:1', isRead: false, readAt: null,
    });
  });

  it('rolls back with the domain state when the caller transaction fails', async () => {
    const [report] = await db.insert(reports).values({ reporterId: alice, reportedPlayerId: bob, reasonCode: 'SPAM', status: 'OPEN' }).returning();
    await expect(db.transaction(async tx => {
      await tx.update(reports).set({ status: 'RESOLVED' }).where(eq(reports.id, report.id));
      await notificationService.notify(tx, [event(alice, 'rollback:1'), event(bob, 'rollback:1')]);
      throw new Error('domain failure after notify');
    })).rejects.toThrow('domain failure after notify');
    expect(await rowsFor(alice)).toEqual([]);
    expect(await rowsFor(bob)).toEqual([]);
    expect((await db.select().from(reports).where(eq(reports.id, report.id)))[0].status).toBe('OPEN');
  });

  it('propagates insert failures so the caller rolls back (never silently dropped)', async () => {
    const [report] = await db.insert(reports).values({ reporterId: alice, reportedPlayerId: bob, reasonCode: 'SPAM', status: 'OPEN' }).returning();
    await expect(db.transaction(async tx => {
      await tx.update(reports).set({ status: 'RESOLVED' }).where(eq(reports.id, report.id));
      await notificationService.notify(tx, [event(alice, 'fk:1'), event(999_999_999, 'fk:1')]);
    })).rejects.toThrow();
    expect(await rowsFor(alice)).toEqual([]);
    expect((await db.select().from(reports).where(eq(reports.id, report.id)))[0].status).toBe('OPEN');
  });

  it('refuses the root database handle and invalid events', async () => {
    await expect(notificationService.notify(db as unknown as TransactionContext, [event(alice, 'root:1')])).rejects.toThrow(/caller transaction/);
    await expect(db.transaction(tx => notificationService.notify(tx, [event(alice, '  ')]))).rejects.toThrow(/dedupKey/);
    await expect(db.transaction(tx => notificationService.notify(tx, [event(0, 'bad:1')]))).rejects.toThrow(/recipientId/);
    await expect(db.transaction(tx => notificationService.notify(tx, [event(alice, 'bad:2', { resource: { type: 'POST', id: -1 } })]))).rejects.toThrow(/resource/);
    expect(await rowsFor(alice)).toEqual([]);
  });

  it('scopes each row to its recipient and treats the same key for different recipients as distinct', async () => {
    await db.transaction(tx => notificationService.notify(tx, [
      event(alice, 'mm-post:7:CANCELLED', { resource: null }),
      event(bob, 'mm-post:7:CANCELLED', { resource: null }),
    ]));
    const aliceRows = await rowsFor(alice);
    const bobRows = await rowsFor(bob);
    expect(aliceRows).toHaveLength(1);
    expect(bobRows).toHaveLength(1);
    expect(aliceRows[0]).toMatchObject({ userId: alice, resourceType: null, resourceId: null });
    expect(bobRows[0].userId).toBe(bob);
  });

  it('skips sequential retries and duplicates within one call', async () => {
    const first = await db.transaction(tx => notificationService.notify(tx, [event(alice, 'retry:1'), event(alice, 'retry:1')]));
    expect(first).toMatchObject({ duplicateCount: 1 });
    const retry = await db.transaction(tx => notificationService.notify(tx, [event(alice, 'retry:1')]));
    expect(retry).toEqual({ insertedIds: [], duplicateCount: 1 });
    expect(await rowsFor(alice)).toHaveLength(1);
  });

  it('keeps exactly one row per recipient under concurrent retries of the same transition', async () => {
    const attempts = 8;
    const results = await Promise.all(Array.from({ length: attempts }, () => db.transaction(async tx => {
      const outcome = await notificationService.notify(tx, [event(bob, 'concurrent:1'), event(alice, 'concurrent:1')]);
      await tx.execute(sql`SELECT pg_sleep(0.05)`);
      return outcome;
    })));
    expect(results.reduce((sum, result) => sum + result.insertedIds.length, 0)).toBe(2);
    expect(await rowsFor(alice)).toHaveLength(1);
    expect(await rowsFor(bob)).toHaveLength(1);
  });

  it('lets a concurrent retry insert when the first attempt rolls back', async () => {
    let releaseFirst!: () => void;
    const firstHolding = new Promise<void>(resolve => { releaseFirst = resolve; });
    let firstInserted!: () => void;
    const inserted = new Promise<void>(resolve => { firstInserted = resolve; });
    const first = db.transaction(async tx => {
      await notificationService.notify(tx, [event(alice, 'race:1')]);
      firstInserted();
      await firstHolding;
      throw new Error('first attempt aborted');
    });
    await inserted;
    const second = db.transaction(tx => notificationService.notify(tx, [event(alice, 'race:1')]));
    await new Promise(resolve => setTimeout(resolve, 100));
    releaseFirst();
    await expect(first).rejects.toThrow('first attempt aborted');
    expect((await second).insertedIds).toHaveLength(1);
    expect(await rowsFor(alice)).toHaveLength(1);
  });
});
