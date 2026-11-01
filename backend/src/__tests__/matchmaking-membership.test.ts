import request from 'supertest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import {
  db, playerProfiles, skillLevels, matchmakingRequests, matchmakingInvitations, matches, notifications,
} from '../db';
import { createTestUser } from './test-helpers';
import { testBlockPort } from './test-block-port';
import { registerBlockPort } from '../services/matchmaking/block-port.registry';
import { matchmakingBlockPort } from '../services/matchmaking/MatchmakingBlockPortService';
import { matchmakingRepository } from '../repositories/matchmaking/MatchmakingRepository';
import { matchModule } from '../services/match/match.module';
import { matchmakingConfig } from '../shared/config/matchmaking-config';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

// MM-21/MM-22/MM-26 behavior on the new membership model. Block checks use the TEST-ONLY
// BlockPort double (test-block-port.ts); real-provider integration is pending MSG-08.
const PLAY_DATE = addDaysToDateString(todayInAppTimezone(), 3);

async function player(): Promise<number> {
  const user = await createTestUser({ role: 'PLAYER' });
  const [skill] = await db.select().from(skillLevels).where(eq(skillLevels.code, 'AVERAGE')).limit(1);
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `P ${user.id}`, skillLevelId: skill.id });
  return user.id;
}

const as = (id: number, method: 'get' | 'post' | 'put', url: string) => request(app)[method](url).set('x-user-id', String(id));

async function newRequest(owner: number, overrides: Record<string, unknown> = {}): Promise<number> {
  const res = await as(owner, 'post', '/api/v1/matchmaking-requests').send({
    matchType: 'SINGLES', preferredDate: PLAY_DATE, preferredStartTime: '10:00', preferredEndTime: '12:00',
    minSkillLevelId: 1, maxSkillLevelId: 6, area: 'Q7', ...overrides,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id;
}

async function invite(owner: number, req: number, target: number): Promise<number> {
  const res = await as(owner, 'post', `/api/v1/matchmaking-requests/${req}/invitations`).send({ inviteeId: target });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.data.id;
}

const accept = (target: number, row: number) => as(target, 'put', `/api/v1/matchmaking-invitations/${row}`).send({ decision: 'ACCEPTED' });
const rowOf = async (id: number) => (await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, id)))[0];

describe('Membership model and shared acceptMembership (MM-22)', () => {
  let host: number;
  let x: number;
  let y: number;

  beforeEach(async () => {
    matchmakingConfig.clearCache();
    host = await player();
    x = await player();
    y = await player();
  });

  it('creates the legacy request with its unpublished post, interval and capacity (MM-21 shape)', async () => {
    const req = await newRequest(host);
    const [row] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, req));
    expect(row).toMatchObject({ capacity: 2, minPlayers: 2, companionCount: 0, durationMinutes: 90 });
    expect(row.startAt.toISOString()).toBe(new Date(`${PLAY_DATE}T10:00:00+07:00`).toISOString());
    const invitationId = await invite(host, req, x);
    expect(await rowOf(invitationId)).toMatchObject({ kind: 'INVITE', createdBy: host, playerId: x, status: 'PENDING' });
  });

  it('gives the last slot to exactly one of two concurrent acceptances; the other gets MATCHMAKING_REQUEST_FULL', async () => {
    const req = await newRequest(host);
    const ix = await invite(host, req, x);
    const iy = await invite(host, req, y);
    const results = await Promise.all([accept(x, ix), accept(y, iy)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 409)!.body.error.code).toBe('MATCHMAKING_REQUEST_FULL');
    expect(await db.select().from(matches)).toHaveLength(1);
    const loser = results[0].status === 409 ? ix : iy;
    expect(await rowOf(loser)).toMatchObject({ status: 'CANCELLED', closeReason: 'RECRUITMENT_CLOSED' });
    const winner = results[0].status === 200 ? ix : iy;
    expect(await rowOf(winner)).toMatchObject({ status: 'ACCEPTED', decidedBy: winner === ix ? x : y });
  });

  it('keeps one active row per Player and request across kinds', async () => {
    const req = await newRequest(host, { matchType: 'DOUBLES' });
    await db.insert(matchmakingInvitations).values({ requestId: req, createdBy: x, playerId: x, kind: 'APPLY', status: 'PENDING', expiresAt: new Date(Date.now() + 3_600_000) });
    const res = await as(host, 'post', `/api/v1/matchmaking-requests/${req}/invitations`).send({ inviteeId: x });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCHMAKING_ALREADY_ACTIVE');
    await expect(db.insert(matchmakingInvitations).values({ requestId: req, createdBy: host, playerId: x, kind: 'INVITE', status: 'PENDING', expiresAt: new Date(Date.now() + 3_600_000) }))
      .rejects.toMatchObject({ cause: expect.objectContaining({ constraint: 'uq_matchmaking_membership_active' }) });
  });

  it('rechecks the block between joiner and host (consumer side, test double) and changes nothing', async () => {
    const req = await newRequest(host, { matchType: 'DOUBLES' });
    const ix = await invite(host, req, x);
    testBlockPort.block(x, host);
    const res = await accept(x, ix);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCHMAKING_ACTION_NOT_AVAILABLE');
    expect((await rowOf(ix)).status).toBe('PENDING');
    const blockedInvite = await as(host, 'post', `/api/v1/matchmaking-requests/${req}/invitations`).send({ inviteeId: x });
    expect(blockedInvite.body.error.code).toBe('MATCHMAKING_INVITATION_DUPLICATE');
    const fresh = await as(host, 'post', `/api/v1/matchmaking-requests/${req}/invitations`).send({ inviteeId: y });
    expect(fresh.status).toBe(201);
    testBlockPort.block(host, y);
    const another = await player();
    testBlockPort.block(another, host);
    const denied = await as(host, 'post', `/api/v1/matchmaking-requests/${req}/invitations`).send({ inviteeId: another });
    expect(denied.status).toBe(409);
    expect(denied.body.error.code).toBe('MATCHMAKING_ACTION_NOT_AVAILABLE');
  });

  it('fails closed when no BlockPort provider is registered (no production stub)', async () => {
    const req = await newRequest(host, { matchType: 'DOUBLES' });
    const ix = await invite(host, req, x);
    registerBlockPort(null);
    const res = await accept(x, ix);
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
    expect((await rowOf(ix)).status).toBe('PENDING');
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${req}/invitations`).send({ inviteeId: y })).status).toBe(500);
  });

  it('rolls back the whole acceptance, including conflict closures, when Match creation fails', async () => {
    const other = await player();
    const a = await newRequest(host);
    const b = await newRequest(other);
    const ia = await invite(host, a, x);
    const ib = await invite(other, b, x);
    const spy = vi.spyOn(matchModule, 'createMatchWithPlayers').mockRejectedValueOnce(new Error('match insert failed'));
    try {
      expect((await accept(x, ia)).status).toBe(500);
    } finally {
      spy.mockRestore();
    }
    expect(await rowOf(ia)).toMatchObject({ status: 'PENDING', decidedBy: null });
    expect(await rowOf(ib)).toMatchObject({ status: 'PENDING', closeReason: null });
    expect((await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, a)))[0].status).toBe('OPEN');
    expect(await db.select().from(matches)).toHaveLength(0);
  });
});

describe('Schedule conflicts on post intervals (MM-26)', () => {
  let p: number;
  let hostA: number;
  let hostB: number;

  beforeEach(async () => {
    matchmakingConfig.clearCache();
    p = await player();
    hostA = await player();
    hostB = await player();
  });

  it('closes the joiner\u2019s overlapping pending rows of both kinds on acceptance; later acceptance reports the conflict', async () => {
    const a = await newRequest(hostA, { matchType: 'DOUBLES' });
    const b = await newRequest(hostB, { matchType: 'DOUBLES', preferredStartTime: '11:00', preferredEndTime: '13:00' });
    const hostC = await player();
    const c = await newRequest(hostC, { matchType: 'DOUBLES', preferredStartTime: '14:00', preferredEndTime: '16:00' });
    const ia = await invite(hostA, a, p);
    const ib = await invite(hostB, b, p);
    const ic = await invite(hostC, c, p);
    const [applyB] = await db.insert(matchmakingInvitations).values({ requestId: b, createdBy: p, playerId: p, kind: 'APPLY', status: 'PENDING', expiresAt: new Date(Date.now() + 3_600_000) })
      .returning().catch(() => [null]);
    expect(applyB).toBeNull(); // one active row per Player and request (Invite already pending)
    expect((await accept(p, ia)).status).toBe(200);
    expect(await rowOf(ib)).toMatchObject({ status: 'CANCELLED', closeReason: 'SCHEDULE_CONFLICT' });
    expect(await rowOf(ic)).toMatchObject({ status: 'PENDING', closeReason: null });
    const late = await accept(p, ib);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('MATCHMAKING_SCHEDULE_CONFLICT');
  });

  // Review step 2 finding 2: replay of an ACCEPTED row must not depend on the overlap set.
  it('replays an ACCEPTED acceptance after a new overlapping pending row appears: terminates, no new Match, pending untouched', async () => {
    const a = await newRequest(hostA); // SINGLES: forms the Match on acceptance
    const ia = await invite(hostA, a, p);
    const first = await accept(p, ia);
    expect(first.status).toBe(200);
    const matchesBefore = await db.select().from(matches);
    expect(matchesBefore).toHaveLength(1);
    // A pending row for p overlapping A's interval (direct insert: creation paths would reject it).
    const b = await newRequest(hostB, { matchType: 'DOUBLES', preferredStartTime: '10:30', preferredEndTime: '12:30' });
    const [pendingB] = await db.insert(matchmakingInvitations).values({
      requestId: b, createdBy: hostB, playerId: p, kind: 'INVITE', status: 'PENDING', expiresAt: new Date(Date.now() + 3_600_000),
    }).returning();
    const lockSpy = vi.spyOn(matchmakingRepository, 'lockUsersAscending');
    let replay: request.Response;
    try {
      replay = await Promise.race([
        accept(p, ia),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('acceptance replay did not terminate')), 5_000)),
      ]);
      expect(lockSpy).toHaveBeenCalledTimes(1); // one transaction, no retry
    } finally {
      lockSpy.mockRestore();
    }
    expect(replay.status, JSON.stringify(replay.body)).toBe(200);
    expect(replay.body.data).toMatchObject({ status: 'ACCEPTED', matchId: first.body.data.matchId });
    expect(first.body.data.matchId).toBe(matchesBefore[0].id);
    expect(await db.select().from(matches)).toEqual(matchesBefore);
    expect(await rowOf(pendingB.id)).toMatchObject({ status: 'PENDING', closeReason: null });
    // Authorization still applies to the replay: another Player gets not found.
    const stranger = await accept(hostB, ia);
    expect(stranger.status).toBe(404);
    expect(stranger.body.error.code).toBe('MATCHMAKING_INVITATION_NOT_FOUND');
  });

  // Review step 2 finding 3: the interval used for the lock set is the locked recruitment's.
  it('retries with a fresh snapshot when the recruitment interval changes before the locks; closes only rows overlapping the new interval', async () => {
    const a = await newRequest(hostA, { matchType: 'DOUBLES' }); // 10:00–11:30
    const b = await newRequest(hostB, { matchType: 'DOUBLES', preferredStartTime: '11:00', preferredEndTime: '13:00' }); // 11:00–12:30
    const hostC = await player();
    const c = await newRequest(hostC, { matchType: 'DOUBLES', preferredStartTime: '14:00', preferredEndTime: '16:00' }); // 14:00–15:30
    const ia = await invite(hostA, a, p);
    const ib = await invite(hostB, b, p);
    const ic = await invite(hostC, c, p);
    const original = matchmakingRepository.lockUsersAscending.bind(matchmakingRepository);
    const lockSpy = vi.spyOn(matchmakingRepository, 'lockUsersAscending').mockImplementationOnce(async (ids, tx) => {
      // Between the snapshot and the lock acquisition: A moves to 13:30 for 120 minutes.
      await db.update(matchmakingRequests)
        .set({ startAt: new Date(`${PLAY_DATE}T13:30:00+07:00`), durationMinutes: 120 })
        .where(eq(matchmakingRequests.id, a));
      return original(ids, tx);
    });
    let res: request.Response;
    try {
      res = await accept(p, ia);
      expect(lockSpy).toHaveBeenCalledTimes(2); // stale attempt + fresh snapshot
    } finally {
      lockSpy.mockRestore();
    }
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(await rowOf(ia)).toMatchObject({ status: 'ACCEPTED', decidedBy: p });
    expect(await rowOf(ib)).toMatchObject({ status: 'PENDING', closeReason: null }); // overlapped the old interval only
    expect(await rowOf(ic)).toMatchObject({ status: 'CANCELLED', closeReason: 'SCHEDULE_CONFLICT' });
  });

  it('does not reserve time for pending rows and uses [start_at, start_at + duration) as the interval', async () => {
    const a = await newRequest(hostA, { matchType: 'DOUBLES' });
    await invite(hostA, a, p);
    // Pending Invite does not block P's own overlapping request.
    await newRequest(p, { matchType: 'DOUBLES' });
    // Window 10:00–12:00 with a 90-minute snapshot occupies 10:00–11:30 only.
    await newRequest(hostA, { matchType: 'SINGLES', preferredStartTime: '11:30', preferredEndTime: '13:30' });
    const clash = await as(hostA, 'post', '/api/v1/matchmaking-requests').send({
      matchType: 'SINGLES', preferredDate: PLAY_DATE, preferredStartTime: '11:00', preferredEndTime: '13:00', minSkillLevelId: 1, maxSkillLevelId: 6, area: 'Q7',
    });
    expect(clash.status).toBe(409);
  });
});

describe('MatchmakingBlockPort.closePendingBetween (MM-22 §24.2)', () => {
  let a: number;
  let b: number;
  let third: number;

  beforeEach(async () => {
    matchmakingConfig.clearCache();
    a = await player();
    b = await player();
    third = await player();
  });

  async function blockTransaction(fn?: () => Promise<void>) {
    return db.transaction(async tx => {
      await matchmakingRepository.lockUsersAscending([a, b], tx);
      await matchmakingBlockPort.closePendingBetween(a, b, tx);
      if (fn) await fn();
    });
  }

  it('closes only PENDING Invite/Apply rows between the pair with BLOCKED; ACCEPTED rows, Matches and notifications untouched', async () => {
    const reqA = await newRequest(a, { matchType: 'DOUBLES' });
    const reqB = await newRequest(b, { matchType: 'DOUBLES', preferredStartTime: '14:00', preferredEndTime: '16:00' });
    const reqA2 = await newRequest(a, { matchType: 'SINGLES', preferredStartTime: '18:00', preferredEndTime: '20:00' });
    const inviteAB = await invite(a, reqA, b);
    const [applyAToB] = await db.insert(matchmakingInvitations).values({ requestId: reqB, createdBy: a, playerId: a, kind: 'APPLY', status: 'PENDING', expiresAt: new Date(Date.now() + 3_600_000) }).returning();
    const acceptedRow = await invite(a, reqA2, b);
    const unrelated = await invite(a, reqA, third);
    const reqA2Accept = await accept(b, acceptedRow);
    expect(reqA2Accept.status).toBe(200);
    const matchesBefore = await db.select().from(matches);
    await blockTransaction();
    expect(await rowOf(inviteAB)).toMatchObject({ status: 'CANCELLED', closeReason: 'BLOCKED' });
    expect(await rowOf(applyAToB.id)).toMatchObject({ status: 'CANCELLED', closeReason: 'BLOCKED' });
    expect(await rowOf(acceptedRow)).toMatchObject({ status: 'ACCEPTED' });
    expect(await rowOf(unrelated)).toMatchObject({ status: 'PENDING' });
    expect(await db.select().from(matches)).toEqual(matchesBefore);
    expect(await db.select().from(notifications)).toEqual([]);
  });

  it('is atomic with the caller and refuses the root handle', async () => {
    const reqA = await newRequest(a, { matchType: 'DOUBLES' });
    const row = await invite(a, reqA, b);
    await expect(blockTransaction(async () => { throw new Error('block insert failed'); })).rejects.toThrow('block insert failed');
    expect((await rowOf(row)).status).toBe('PENDING');
    await expect(matchmakingBlockPort.closePendingBetween(a, b, db as never)).rejects.toThrow(/caller block transaction/);
  });

  it('serializes with a concurrent acceptance in global lock order without deadlock', async () => {
    for (let i = 0; i < 5; i += 1) {
      const reqA = await newRequest(a, { matchType: 'DOUBLES', preferredDate: addDaysToDateString(PLAY_DATE, i + 1) });
      const row = await invite(a, reqA, b);
      const [acceptance] = await Promise.all([accept(b, row), blockTransaction()]);
      const final = await rowOf(row);
      if (acceptance.status === 200) expect(final.status).toBe('ACCEPTED');
      else {
        expect(acceptance.status).toBe(409);
        expect(final).toMatchObject({ status: 'CANCELLED', closeReason: 'BLOCKED' });
      }
      await db.update(matchmakingInvitations).set({ status: 'WITHDRAWN' }).where(and(eq(matchmakingInvitations.id, row), eq(matchmakingInvitations.status, 'ACCEPTED')));
      expect((await as(a, 'post', `/api/v1/matchmaking-requests/${reqA}/cancel`)).status).toBe(200);
    }
  });
});
