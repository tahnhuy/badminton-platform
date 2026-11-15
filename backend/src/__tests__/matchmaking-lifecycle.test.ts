import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { and, eq, inArray } from 'drizzle-orm';
import {
  db, matches, matchPlayers, matchmakingInvitations, matchmakingMatches, matchmakingRequests, notifications, bookings,
  facilities, courts,
} from '../db';
import { as, player, setConfig, skillIds, startIn } from './social-fixture';
import { createTestUser } from './test-helpers';
import { matchmakingExpiryService } from '../services/matchmaking/MatchmakingExpiryService';

// MM-22 GROUP acceptance, MM-25 lifecycle, MM-27 scheduler, MM-28 external court and the MM-31
// producers they emit (Matchmaking Tech Design §24.4–§24.9, §24.12; Notifications extension).
// Posts are created through the canonical POST /posts (SOC-04). Time is simulated by moving
// the recruitment interval into the past on the test database only.

const requestRow = async (id: number) => (await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, id)))[0];
const rowOf = async (id: number) => (await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, id)))[0];
const matchOf = async (id: number) => (await db.select().from(matches).where(eq(matches.id, id)))[0];
const playersOf = async (matchId: number) => db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
const linkOf = async (requestId: number) => (await db.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, requestId)));
const notesFor = async (userId: number, type?: string) => (await db.select().from(notifications).where(eq(notifications.userId, userId)))
  .filter(n => !type || n.type === type);

const COURT = { kind: 'EXTERNAL', name: 'Sân Phú Thọ', city: 'Hồ Chí Minh', district: 'Quận 11', address: '1 Lữ Gia' };

async function createPost(host: number, recruitment: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const levels = await skillIds();
  const res = await as(host, 'post', '/api/v1/posts').send({
    type: 'MATCH_FINDING', body: 'Tìm kèo', clientRequestId: randomUUID(),
    recruitment: { matchType: 'GROUP', startAt: startIn(48), capacity: 4, minPlayers: 3, minSkillLevelId: levels.min, maxSkillLevelId: levels.max, ...recruitment },
    ...extra,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { postId: res.body.data.id as number, requestId: res.body.data.recruitment.requestId as number };
}

async function invite(host: number, requestId: number, target: number): Promise<number> {
  const res = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: target });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id;
}
const accept = (target: number, row: number) => as(target, 'put', `/api/v1/matchmaking-invitations/${row}`).send({ decision: 'ACCEPTED' });

async function joinAndCloseWhenFull(host: number, requestId: number, target: number) {
  const res = await accept(target, await invite(host, requestId, target));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const result = res.body.data as { invitationId: number; matchId: number | null };
  const request = await requestRow(requestId);
  const members = await db.select().from(matchmakingInvitations).where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'ACCEPTED')));
  if (1 + request.companionCount + members.length >= request.capacity) {
    const closed = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    result.matchId = closed.body.data.matchId;
  }
  return result;
}

/** Moves the post to start `minutesAgo` in the past (and its Match schedule with it). */
async function startedAgo(requestId: number, minutesAgo: number) {
  const startAt = new Date(Date.now() - minutesAgo * 60_000);
  await db.update(matchmakingRequests).set({ startAt, expiresAt: startAt }).where(eq(matchmakingRequests.id, requestId));
  for (const link of await linkOf(requestId)) {
    await db.update(matches).set({ scheduledAt: startAt, bookingDeadlineAt: startAt }).where(eq(matches.id, link.matchId));
  }
  return startAt;
}

describe('GROUP acceptance and MM-25 lifecycle', () => {
  let host: number;
  let p1: number;
  let p2: number;
  let p3: number;
  beforeEach(async () => {
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    await setConfig('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3');
    host = await player();
    p1 = await player();
    p2 = await player();
    p3 = await player();
  });

  it.each(['SINGLES', 'DOUBLES', 'GROUP'])('%s waits for its host to confirm even when full', async matchType => {
    const capacity = matchType === 'SINGLES' ? 2 : matchType === 'DOUBLES' ? 4 : 3;
    const { requestId } = await createPost(host, { matchType, capacity, minPlayers: capacity });
    const pending = await invite(host, requestId, await player());
    for (const target of [p1, p2, p3].slice(0, capacity - 1)) {
      const response = await accept(target, await invite(host, requestId, target));
      expect(response.status).toBe(200);
      expect(response.body.data.matchId).toBeNull();
    }
    expect((await requestRow(requestId)).status).toBe('OPEN');
    expect(await linkOf(requestId)).toHaveLength(0);
    expect((await rowOf(pending)).status).toBe('PENDING');
    expect((await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(404);
    const closed = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    expect((await requestRow(requestId)).status).toBe('MATCHED');
    expect((await rowOf(pending)).status).toBe('CANCELLED');
    const replay = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`);
    expect(replay.body.data.matchId).toBe(closed.body.data.matchId);
    expect(await linkOf(requestId)).toHaveLength(1);
  });

  it('an approved application fills a seat without sealing the roster', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: 2, minPlayers: 2 });
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/publish`)).status).toBe(200);
    const application = await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/applications`).send({});
    expect(application.status).toBe(201);
    const approved = await as(host, 'put', `/api/v1/matchmaking-applications/${application.body.data.id}`).send({ decision: 'ACCEPTED' });
    expect(approved.status).toBe(200);
    expect(approved.body.data.matchId).toBeNull();
    expect((await requestRow(requestId)).status).toBe('OPEN');
    expect(await linkOf(requestId)).toHaveLength(0);
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(200);
  });

  it('full but unconfirmed members can leave without cancelling a SINGLES', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: 2, minPlayers: 2 });
    await accept(p1, await invite(host, requestId, p1));
    expect((await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`)).status).toBe(200);
    expect((await requestRow(requestId)).status).toBe('OPEN');
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(409);
    expect(await linkOf(requestId)).toHaveLength(0);
  });

  const remove = (actor: number, requestId: number, target: number) => as(actor, 'delete', `/api/v1/matchmaking-requests/${requestId}/members/${target}`);

  it('restricts removal to the host and notifies the removed member', async () => {
    const { requestId } = await createPost(host, {});
    const joined = await joinAndCloseWhenFull(host, requestId, p1);
    expect((await remove(p2, requestId, p1)).status).toBe(404);
    expect((await rowOf(joined.invitationId)).status).toBe('ACCEPTED');
    expect((await remove(host, requestId, host)).status).toBe(409);
    expect((await remove(host, requestId, p2)).status).toBe(409);
    expect((await remove(host, requestId, p1)).status).toBe(200);
    expect((await rowOf(joined.invitationId)).status).toBe('WITHDRAWN');
    expect((await requestRow(requestId)).status).toBe('OPEN');
    expect((await notesFor(p1)).some(note => note.title === 'Bạn đã được loại khỏi kèo')).toBe(true);
    expect((await remove(host, requestId, p1)).status).toBe(409);
  });

  it('reopens a full GROUP and marks the removed player LEFT without cancelling its match', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const formed = await joinAndCloseWhenFull(host, requestId, p2);
    expect((await remove(host, requestId, p1)).status).toBe(200);
    expect((await requestRow(requestId)).status).toBe('OPEN');
    expect((await matchOf(formed.matchId!)).status).toBe('PENDING_COURT');
    expect((await playersOf(formed.matchId!)).find(row => row.playerId === p1)?.status).toBe('LEFT');
  });

  it('cancels a full SINGLES when the host removes its member', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: 2, minPlayers: 2 });
    const formed = await joinAndCloseWhenFull(host, requestId, p1);
    expect((await remove(host, requestId, p1)).status).toBe(200);
    expect((await requestRow(requestId)).status).toBe('CANCELLED');
    expect((await matchOf(formed.matchId!)).status).toBe('CANCELLED');
  });

  it('rejects removal after start or expiry and retains membership', async () => {
    const { requestId } = await createPost(host, {});
    const joined = await joinAndCloseWhenFull(host, requestId, p1);
    await db.update(matchmakingRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(matchmakingRequests.id, requestId));
    expect((await remove(host, requestId, p1)).status).toBe(409);
    await startedAgo(requestId, 1);
    expect((await remove(host, requestId, p1)).status).toBe(409);
    expect((await rowOf(joined.invitationId)).status).toBe('ACCEPTED');
  });

  it('forms one GROUP Match without teams after the host confirms a full roster; closes pending rows; notifies host/members', async () => {
    const { requestId } = await createPost(host, { capacity: 4, minPlayers: 3, companionCount: 1 });
    const pendingRow = await invite(host, requestId, p3);
    expect((await joinAndCloseWhenFull(host, requestId, p1)).matchId).toBeNull();
    const formed = await joinAndCloseWhenFull(host, requestId, p2);
    expect(formed.matchId).not.toBeNull();
    expect(await requestRow(requestId)).toMatchObject({ status: 'MATCHED' });
    const match = await matchOf(formed.matchId!);
    expect(match).toMatchObject({ matchType: 'GROUP', status: 'PENDING_COURT' });
    const roster = await playersOf(match.id);
    expect(roster.map(r => r.playerId).sort()).toEqual([host, p1, p2].sort());
    expect(roster.every(r => r.teamNo === null && r.status === 'ACTIVE')).toBe(true);
    expect(await rowOf(pendingRow)).toMatchObject({ status: 'CANCELLED', closeReason: 'RECRUITMENT_CLOSED' });
    expect(await notesFor(p3, 'MM_POST_CLOSED')).toHaveLength(1);
    expect(await notesFor(host, 'MM_MEMBERSHIP_CHANGED')).toHaveLength(2);
    expect(await notesFor(p3, 'MM_INVITATION_RECEIVED')).toHaveLength(1);
  });

  it('last GROUP slot race reserves one seat and waits for host confirmation', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const a = await invite(host, requestId, p2);
    const b = await invite(host, requestId, p3);
    const results = await Promise.all([accept(p2, a), accept(p3, b)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 409)!.body.error.code).toBe('MATCHMAKING_REQUEST_FULL');
    expect(await linkOf(requestId)).toHaveLength(0);
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(200);
    expect(await linkOf(requestId)).toHaveLength(1);
    expect(await db.select().from(matches)).toHaveLength(1);
  });

  it('withdrawal before full releases the slot and keeps the decision history', async () => {
    const { requestId } = await createPost(host, { capacity: 5, minPlayers: 3 });
    const { invitationId } = await joinAndCloseWhenFull(host, requestId, p1);
    const before = await rowOf(invitationId);
    const res = await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'WITHDRAWN', requestStatus: 'OPEN', matchId: null });
    const after = await rowOf(invitationId);
    expect(after.status).toBe('WITHDRAWN');
    expect(after.respondedAt).toEqual(before.respondedAt);
    expect(after.decidedBy).toBe(before.decidedBy);
    const again = await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    expect(again.status).toBe(200);
    expect(await notesFor(host, 'MM_MEMBERSHIP_CHANGED')).toHaveLength(2); // joined + withdrew, no duplicate on replay
  });

  it('GROUP after full: withdrawal reopens with the same Match; replacement rechecks and reactivates MATCH_PLAYERS', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p2);
    const res = await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await requestRow(requestId)).toMatchObject({ status: 'OPEN' });
    expect((await linkOf(requestId)).map(l => l.matchId)).toEqual([matchId]);
    expect((await playersOf(matchId!)).find(r => r.playerId === p1)!.status).toBe('LEFT');
    expect(await notesFor(host, 'MM_RECRUITMENT_REOPENED')).toHaveLength(1);
    expect(await notesFor(p2, 'MM_RECRUITMENT_REOPENED')).toHaveLength(1);

    // Replacement with an overlapping commitment is rejected (conflict recheck).
    const busy = await createPost(p3, { capacity: 3, minPlayers: 2 });
    void busy;
    const conflicting = await accept(p3, await invite(host, requestId, p3));
    expect(conflicting.status).toBe(409);
    expect(conflicting.body.error.code).toBe('MATCHMAKING_SCHEDULE_CONFLICT');

    // The Player who left earlier comes back: the LEFT row is reused (LEFT → ACTIVE).
    const back = await joinAndCloseWhenFull(host, requestId, p1);
    expect(back.matchId).toBe(matchId);
    expect(await requestRow(requestId)).toMatchObject({ status: 'MATCHED' });
    const roster = await playersOf(matchId!);
    expect(roster.filter(r => r.playerId === p1)).toHaveLength(1);
    expect(roster.find(r => r.playerId === p1)!.status).toBe('ACTIVE');
    expect(await db.select().from(matches)).toHaveLength(1);
  });

  it('Singles after full: withdrawal cancels the Match and the recruitment (PLAYER_LEFT)', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    const res = await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'INSUFFICIENT_PLAYERS' });
    expect(await requestRow(requestId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'PLAYER_LEFT' });
    expect(await notesFor(host, 'MM_POST_CANCELLED')).toHaveLength(1);
  });

  it('early close: requires GROUP, minimum and accepted >= 1; forms the Match and closes pending rows', async () => {
    const companionsOnly = await createPost(host, { capacity: 6, minPlayers: 3, companionCount: 2, startAt: startIn(30) });
    const rejected = await as(host, 'post', `/api/v1/matchmaking-requests/${companionsOnly.requestId}/close`);
    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe('MATCHMAKING_EARLY_CLOSE_NOT_ALLOWED');

    const { requestId } = await createPost(host, { capacity: 6, minPlayers: 3, companionCount: 1 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const pendingRow = await invite(host, requestId, p2);
    expect((await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(404);
    const closed = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`);
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const request = await requestRow(requestId);
    expect(request.status).toBe('MATCHED');
    expect(request.closedEarlyAt).not.toBeNull();
    expect(await rowOf(pendingRow)).toMatchObject({ status: 'CANCELLED', closeReason: 'RECRUITMENT_CLOSED' });
    expect((await playersOf(closed.body.data.matchId)).map(r => r.playerId).sort()).toEqual([host, p1].sort());
    expect(await notesFor(p1, 'MM_POST_CLOSED')).toHaveLength(1);
    expect(await notesFor(p2, 'MM_POST_CLOSED')).toHaveLength(1);
    const again = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`);
    expect(again.body.data.matchId).toBe(closed.body.data.matchId);

    const doubles = await createPost(host, { matchType: 'DOUBLES', capacity: undefined, minPlayers: undefined, startAt: startIn(70) });
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${doubles.requestId}/close`)).body.error.code).toBe('MATCHMAKING_EARLY_CLOSE_NOT_ALLOWED');
  });

  it('host cancel KEEP cancels post and Match and notifies; CANCEL is rejected without any change', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p2);
    const before = await db.select().from(notifications);
    const unavailable = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/cancel`).send({ bookingAction: 'CANCEL' });
    expect(unavailable.status).toBe(409);
    expect(unavailable.body.error.code).toBe('MATCHMAKING_BOOKING_ACTION_UNAVAILABLE');
    expect(await requestRow(requestId)).toMatchObject({ status: 'MATCHED' });
    expect(await matchOf(matchId!)).toMatchObject({ status: 'PENDING_COURT' });
    expect(await db.select().from(notifications)).toEqual(before);

    expect((await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/cancel`).send({ bookingAction: 'KEEP' })).status).toBe(404);
    const kept = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/cancel`).send({ bookingAction: 'KEEP' });
    expect(kept.status, JSON.stringify(kept.body)).toBe(200);
    expect(await requestRow(requestId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'HOST_CANCELLED' });
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CANCELLED' });
    expect(await notesFor(p1, 'MM_POST_CANCELLED')).toHaveLength(1);
    expect(await notesFor(host, 'MM_POST_CANCELLED')).toHaveLength(0);
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/cancel`)).status).toBe(200); // idempotent, empty body = KEEP
  });

  it('aliases: /matches/:id/leave reopens a full GROUP for a member and cancels with HOST_LEFT for the host', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId, invitationId } = await joinAndCloseWhenFull(host, requestId, p2);
    void invitationId;
    const member = await as(p2, 'post', `/api/v1/matches/${matchId}/leave`);
    expect(member.status, JSON.stringify(member.body)).toBe(200);
    expect(member.body.data).toMatchObject({ id: matchId, status: 'PENDING_COURT', cancellationReason: null });
    expect(await requestRow(requestId)).toMatchObject({ status: 'OPEN' });
    const beforeReplay = await db.select().from(notifications);
    const replay = await as(p2, 'post', `/api/v1/matches/${matchId}/leave`);
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.data).toEqual(member.body.data);
    expect(await db.select().from(notifications)).toEqual(beforeReplay);
    const hostLeave = await as(host, 'post', `/api/v1/matches/${matchId}/leave`);
    expect(hostLeave.status).toBe(200);
    expect(await requestRow(requestId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'HOST_LEFT' });
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CANCELLED' });
  });

  it('keeps start, type and capacity locked after all accepted members withdraw', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p2);
    await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    await as(p2, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    const before = await requestRow(requestId);
    expect(before.status).toBe('OPEN');
    expect((await playersOf(matchId!)).filter(p => p.status === 'ACTIVE').map(p => p.playerId)).toEqual([host]);
    for (const patch of [{ startAt: startIn(80) }, { matchType: 'SINGLES' }, { capacity: 5 }]) {
      const response = await as(host, 'patch', `/api/v1/matchmaking-requests/${requestId}`).send(patch);
      expect(response.status, JSON.stringify(response.body)).toBe(409);
      expect(response.body.error.code).toBe('MATCHMAKING_FIELD_LOCKED');
    }
    expect(await requestRow(requestId)).toEqual(before);
    expect((await as(host, 'patch', `/api/v1/matchmaking-requests/${requestId}`).send({ costNote: 'still editable' })).status).toBe(200);
  });

  it('invitation cancel/withdraw aliases never mutate APPLY memberships', async () => {
    const { requestId } = await createPost(host, { capacity: 4, minPlayers: 2 });
    for (const status of ['PENDING', 'ACCEPTED']) {
      const [application] = await db.insert(matchmakingInvitations).values({
        requestId, createdBy: p1, playerId: p1, kind: 'APPLY', status,
        expiresAt: new Date(Date.now() + 3_600_000),
      }).returning();
      for (const action of ['cancel', 'withdraw']) {
        const response = await as(p1, 'post', `/api/v1/matchmaking-invitations/${application.id}/${action}`);
        expect(response.status, JSON.stringify(response.body)).toBe(404);
        expect(response.body.error.code).toBe('MATCHMAKING_INVITATION_NOT_FOUND');
        expect(await rowOf(application.id)).toEqual(application);
      }
      await db.delete(matchmakingInvitations).where(eq(matchmakingInvitations.id, application.id));
    }
  });

  it('concurrent withdraw, final acceptance and host cancel on one GROUP never deadlock', async () => {
    for (let i = 0; i < 5; i += 1) {
      const players = [await player(), await player(), await player()];
      const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2, startAt: startIn(30 + i * 5) });
      await joinAndCloseWhenFull(host, requestId, players[0]);
      const last = await invite(host, requestId, players[1]);
      const results = await Promise.all([
        accept(players[1], last),
        as(players[0], 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`),
        as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/cancel`).send({ bookingAction: 'KEEP' }),
      ]);
      expect(results.every(r => r.status !== 500), JSON.stringify(results.map(r => r.body))).toBe(true);
      expect(await requestRow(requestId)).toMatchObject({ status: 'CANCELLED' });
      expect((await linkOf(requestId)).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('MM-28 external court', () => {
  let host: number;
  let p1: number;
  beforeEach(async () => {
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    host = await player();
    p1 = await player();
  });

  it('sets the court once, confirms a PENDING_COURT Match, notifies members and never moves the post time', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    const before = await requestRow(requestId);
    const invalid = await as(host, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send({ ...COURT, name: '  ' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('MATCHMAKING_INVALID_COURT');
    const booking = await as(host, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send({ kind: 'BOOKING', bookingId: 1 });
    expect(booking.status).toBe(409);
    expect(booking.body.error.code).toBe('MATCHMAKING_BOOKING_ACTION_UNAVAILABLE');
    expect((await as(p1, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send(COURT)).status).toBe(404);

    const set = await as(host, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send(COURT);
    expect(set.status, JSON.stringify(set.body)).toBe(200);
    const after = await requestRow(requestId);
    expect(after).toMatchObject({ externalCourtName: 'Sân Phú Thọ', externalCourtDistrict: 'Quận 11' });
    expect(after.startAt).toEqual(before.startAt);
    expect(after.durationMinutes).toBe(before.durationMinutes);
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CONFIRMED', courtId: null, bookingId: null });
    expect(await notesFor(p1, 'MM_COURT_UPDATED')).toHaveLength(1);
    expect((await as(host, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send(COURT)).status).toBe(200);
    const change = await as(host, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send({ ...COURT, name: 'Sân khác' });
    expect(change.status).toBe(409);
    expect(change.body.error.code).toBe('MATCHMAKING_COURT_CHANGE_NOT_ALLOWED');
    expect(await notesFor(p1, 'MM_COURT_UPDATED')).toHaveLength(1);
    const detail = await as(p1, 'get', `/api/v1/matches/${matchId}`);
    expect(detail.body.data.externalCourt).toMatchObject({ name: 'Sân Phú Thọ', verified: false });
  });

  it('a court declared at creation makes the formed Match CONFIRMED', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined, court: COURT });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CONFIRMED' });
  });
});

describe('MM-27 scheduler start/end processing', () => {
  let host: number;
  let p1: number;
  let p2: number;
  beforeEach(async () => {
    await setConfig('MATCHMAKING_ENABLED', 'true');
    await setConfig('SOCIAL_FEED_ENABLED', 'true');
    await setConfig('MATCHMAKING_MAX_OPEN_POSTS_PER_PLAYER', '3');
    host = await player();
    p1 = await player();
    p2 = await player();
  });

  it('an unconfirmed reopened GROUP expires instead of starting its previous Match', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2, court: COURT });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p2);
    await as(p2, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    await startedAgo(requestId, 1);
    expect((await as(host, 'get', `/api/v1/matchmaking-requests/${requestId}`)).body.data.status).toBe('EXPIRED');
    expect((await as(p1, 'get', `/api/v1/matches/${matchId}`)).body.data.status).toBe('CANCELLED');
    await matchmakingExpiryService.runOnce();
    expect((await requestRow(requestId)).status).toBe('EXPIRED');
    expect((await matchOf(matchId!)).status).toBe('CANCELLED');
  });

  it('unconfirmed GROUP expires with or without a court and never creates a Match', async () => {
    const ready = await createPost(host, { capacity: 6, minPlayers: 2, court: COURT, startAt: startIn(30) });
    await joinAndCloseWhenFull(host, ready.requestId, p1);
    const noCourt = await createPost(host, { capacity: 6, minPlayers: 2, startAt: startIn(40) });
    await joinAndCloseWhenFull(host, noCourt.requestId, p2);
    const below = await createPost(host, { capacity: 6, minPlayers: 4, companionCount: 2, court: COURT, startAt: startIn(50) });
    for (const id of [ready.requestId, noCourt.requestId, below.requestId]) await startedAgo(id, 1);
    await matchmakingExpiryService.runOnce();
    for (const id of [ready.requestId, noCourt.requestId, below.requestId]) {
      expect((await requestRow(id)).status).toBe('EXPIRED');
      expect(await linkOf(id)).toHaveLength(0);
    }
  });

  it('MATCHED without court at start: COURT_NOT_BOOKED for post and Match', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    await startedAgo(requestId, 1);
    await matchmakingExpiryService.runOnce();
    expect(await requestRow(requestId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' });
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' });
  });

  it('reports the same unconfirmed-roster reason before and after a reopened GROUP start tick', async () => {
    const { requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p2);
    await as(p2, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    await startedAgo(requestId, 1);
    const before = await as(p1, 'get', `/api/v1/matches/${matchId}`);
    expect(before.body.data).toMatchObject({ status: 'CANCELLED', cancellationReason: 'INSUFFICIENT_PLAYERS' });
    await matchmakingExpiryService.runOnce();
    expect(await requestRow(requestId)).toMatchObject({ status: 'EXPIRED' });
    const after = await as(p1, 'get', `/api/v1/matches/${matchId}`);
    expect(after.body.data.cancellationReason).toBe(before.body.data.cancellationReason);
  });

  it('late leave without a court cancels both Match and recruitment before the scheduler', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    await startedAgo(requestId, 1);
    const response = await as(p1, 'post', `/api/v1/matches/${matchId}/leave`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' });
    expect(await requestRow(requestId)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' });
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CANCELLED', cancellationReason: 'COURT_NOT_BOOKED' });
    const notes = await db.select().from(notifications);
    expect(await notesFor(host, 'MM_POST_CANCELLED')).toHaveLength(1);
    await matchmakingExpiryService.runOnce();
    expect(await db.select().from(notifications)).toEqual(notes);
  });

  it('external-court Match starts and completes at the fixed times; catch-up and repeated runs are idempotent', async () => {
    const { requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined, court: COURT });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    const request = await requestRow(requestId);
    // Downtime: both start and end are in the past before the first tick.
    const startAt = await startedAgo(requestId, request.durationMinutes + 10);
    expect((await as(p1, 'get', `/api/v1/matches/${matchId}`)).body.data.status).toBe('COMPLETED');
    const first = await matchmakingExpiryService.runOnce();
    expect(first.matchesCompleted).toBe(1);
    const match = await matchOf(matchId!);
    expect(match).toMatchObject({ status: 'COMPLETED', startedAt: startAt });
    expect(match.completedAt).toEqual(new Date(startAt.getTime() + request.durationMinutes * 60_000));
    const notes = await db.select().from(notifications);
    const second = await matchmakingExpiryService.runOnce();
    expect(second).toMatchObject({ recruitmentsProcessed: 0, matchesStarted: 0, matchesCompleted: 0 });
    expect(await matchOf(matchId!)).toEqual(match);
    expect(await db.select().from(notifications)).toEqual(notes);
  });

  it('ticks racing with host cancel and member withdrawal on a due post serialize without deadlock', async () => {
    for (let i = 0; i < 5; i += 1) {
      const member = await player();
      const host = await player(); // started posts count toward the open-post limit (§24.14)
      const { requestId } = await createPost(host, { capacity: 4, minPlayers: 2, court: COURT, startAt: startIn(30 + i * 5) });
      await joinAndCloseWhenFull(host, requestId, member);
      expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(200);
      await startedAgo(requestId, 1);
      const [tickA, tickB, cancel, withdraw] = await Promise.all([
        matchmakingExpiryService.runOnce(),
        matchmakingExpiryService.runOnce(),
        as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/cancel`).send({ bookingAction: 'KEEP' }),
        as(member, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`),
      ]);
      void tickA; void tickB;
      // After start, host cancel and withdrawal are rejected; the post starts exactly once.
      expect(cancel.body.error?.code).toBe('MATCHMAKING_REQUEST_NOT_CANCELLABLE');
      expect(withdraw.status).toBe(409);
      await matchmakingExpiryService.runOnce();
      expect(await requestRow(requestId)).toMatchObject({ status: 'MATCHED' });
      const links = await linkOf(requestId);
      expect(links).toHaveLength(1);
      expect(await matchOf(links[0].matchId)).toMatchObject({ status: 'IN_PROGRESS' });
    }
  });

  it('SOC-07: a hidden match-finding post with a CONFIRMED Match proceeds unchanged at start', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const { postId, requestId } = await createPost(host, { matchType: 'SINGLES', capacity: undefined, minPlayers: undefined, court: COURT });
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p1);
    expect(await matchOf(matchId!)).toMatchObject({ status: 'CONFIRMED' });
    expect((await as(admin.id, 'post', `/api/v1/admin/posts/${postId}/hide`)).status).toBe(200);
    await startedAgo(requestId, 1);
    await matchmakingExpiryService.runOnce();
    expect(await matchOf(matchId!)).toMatchObject({ status: 'IN_PROGRESS' });
    expect(await requestRow(requestId)).toMatchObject({ status: 'MATCHED' });
  });

  it('Admin hide does not change recruitment or Match and does not block member management', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const { postId, requestId } = await createPost(host, { capacity: 3, minPlayers: 2 });
    await joinAndCloseWhenFull(host, requestId, p1);
    const { matchId } = await joinAndCloseWhenFull(host, requestId, p2);
    const before = { request: await requestRow(requestId), match: await matchOf(matchId!) };
    expect((await as(admin.id, 'post', `/api/v1/admin/posts/${postId}/hide`)).status).toBe(200);
    expect(await requestRow(requestId)).toEqual(before.request);
    expect(await matchOf(matchId!)).toEqual(before.match);
    expect((await as(p1, 'get', `/api/v1/posts/${postId}`)).status).toBe(404);
    expect((await as(p1, 'get', `/api/v1/matchmaking-requests/${requestId}`)).status).toBe(200);
    expect((await as(host, 'put', `/api/v1/matchmaking-requests/${requestId}/court`).send(COURT)).status).toBe(200);
    expect((await as(p1, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`)).status).toBe(200);
    expect(await requestRow(requestId)).toMatchObject({ status: 'OPEN' });
    const rows = await db.select().from(matchmakingInvitations).where(and(eq(matchmakingInvitations.requestId, requestId), inArray(matchmakingInvitations.status, ['WITHDRAWN'])));
    expect(rows).toHaveLength(1);
  });
});
