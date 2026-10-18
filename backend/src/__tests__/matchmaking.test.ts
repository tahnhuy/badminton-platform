import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../app';
import {
  db,
  facilities, courts, bookings,
  playerProfiles,
  skillLevels,
  matchmakingRequests,
  matchmakingInvitations,
  matchmakingMatches,
  matches,
  matchPlayers,
  matchBookingCancellationJobs,
} from '../db';
import { createTestUser } from './test-helpers';
import { matchmakingExpiryService } from '../services/matchmaking/MatchmakingExpiryService';
import { matchmakingConfig } from '../shared/config/matchmaking-config';
import { matchModule } from '../services/match/match.module';
import { matchmakingRepository } from '../repositories/matchmaking/MatchmakingRepository';
import { eq } from 'drizzle-orm';
import { addDaysToDateString, todayInAppTimezone } from '../services/booking/availability.service';

const TODAY = todayInAppTimezone();
const PLAY_DATE = addDaysToDateString(TODAY, 3);

async function skillId(code: string): Promise<number> {
  const [row] = await db.select().from(skillLevels).where(eq(skillLevels.code, code)).limit(1);
  return row.id;
}

async function createPlayer(skillCode = 'AVERAGE') {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({
    userId: user.id,
    fullName: `Player ${user.id}`,
    skillLevelId: await skillId(skillCode),
  });
  return user;
}

const as = (id: number, method: 'get' | 'post' | 'put', url: string) =>
  request(app)[method](url).set('x-user-id', String(id));

const baseRequest = (overrides: Record<string, unknown> = {}) => ({
  matchType: 'SINGLES',
  preferredDate: PLAY_DATE,
  preferredStartTime: '10:00',
  preferredEndTime: '12:00',
  minSkillLevelId: 1,
  maxSkillLevelId: 6,
  area: 'Quận 7, TP. Hồ Chí Minh',
  ...overrides,
});

describe('Matchmaking (invitation-only)', () => {
  let ownerId: number;
  let inviteeId: number;
  let strangesId: number;

  beforeEach(async () => {
    await db.delete(matchBookingCancellationJobs);
    await db.delete(matchmakingInvitations);
    await db.delete(matchmakingMatches);
    await db.delete(matchPlayers);
    await db.delete(matches);
    await db.delete(matchmakingRequests);
    await matchmakingConfig.clearCache();

    ownerId = (await createPlayer()).id;
    inviteeId = (await createPlayer()).id;
    strangesId = (await createPlayer()).id;
  });

  it('creates an OPEN request with a snapshotted expiry', async () => {
    const res = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.matchType).toBe('SINGLES');
    expect(res.body.data.matchDurationMinutes).toBe(90);
    expect(res.body.data.requiredPlayers).toBe(2);
    expect(res.body.data.expiresAt).toBeTruthy();
    expect(res.body.data.isOwner).toBe(true);
  });

  it('rejects a second OPEN request for the same match type', async () => {
    await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const res = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('MATCHMAKING_ACTIVE_REQUEST_LIMIT');
  });

  it('rejects an invalid skill range', async () => {
    const res = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(
      baseRequest({ minSkillLevelId: 6, maxSkillLevelId: 1 })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATCHMAKING_INVALID_SKILL_RANGE');
  });

  it('rejects a start within the minimum lead time', async () => {
    const res = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(
      baseRequest({ preferredDate: TODAY, preferredStartTime: '00:00', preferredEndTime: '02:00' })
    );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('MATCHMAKING_START_TOO_SOON');
  });

  it('browses candidates excluding the caller', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const res = await as(ownerId, 'get', `/api/v1/matchmaking-requests/${created.body.data.id}/candidates`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((candidate: { playerId: number }) => candidate.playerId);
    expect(ids).not.toContain(ownerId);
    expect(ids).toContain(inviteeId);
  });

  it('sends a direct invitation and rejects duplicates', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const requestId = created.body.data.id;

    const first = await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({
      inviteeId,
    });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe('PENDING');

    const dup = await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({
      inviteeId,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('MATCHMAKING_INVITATION_DUPLICATE');
  });

  it('forms exactly one Match when the group fills', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const requestId = created.body.data.id;

    const invitation = await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({
      inviteeId,
    });
    const invitationId = invitation.body.data.id;

    const accept = await as(inviteeId, 'put', `/api/v1/matchmaking-invitations/${invitationId}`).send({
      decision: 'ACCEPTED',
    });
    expect(accept.status).toBe(200);
    expect(accept.body.data.matchId).toBeTruthy();

    const [requestRow] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, requestId));
    expect(requestRow.status).toBe('MATCHED');

    const matchRows = await db.select().from(matches).where(eq(matches.id, accept.body.data.matchId));
    expect(matchRows).toHaveLength(1);
    expect(matchRows[0].status).toBe('PENDING_COURT');

    const players = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchRows[0].id));
    expect(players).toHaveLength(2);
  });

  it('hides a match from non-participants and cancels it on leave', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const requestId = created.body.data.id;
    const invitation = await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({
      inviteeId,
    });
    const accept = await as(inviteeId, 'put', `/api/v1/matchmaking-invitations/${invitation.body.data.id}`).send({
      decision: 'ACCEPTED',
    });
    const matchId = accept.body.data.matchId;

    const stranger = await as(strangesId, 'get', `/api/v1/matches/${matchId}`);
    expect(stranger.status).toBe(404);
    expect(stranger.body.error.code).toBe('MATCH_NOT_FOUND');

    const detail = await as(ownerId, 'get', `/api/v1/matches/${matchId}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.players).toHaveLength(2);
    const inbox = await as(inviteeId, 'get', '/api/v1/matchmaking-invitations?direction=RECEIVED');
    expect(inbox.body.data[0].matchId).toBe(matchId);
    expect(detail.body.data.isOwner).toBe(true);

    const leave = await as(ownerId, 'post', `/api/v1/matches/${matchId}/leave`).send({});
    expect(leave.status).toBe(200);
    expect(leave.body.data.status).toBe('CANCELLED');
    expect(leave.body.data.cancellationReason).toBe('INSUFFICIENT_PLAYERS');

    const [playerRow] = await db
      .select()
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId));
    expect(playerRow.status).toBe('LEFT');
  });

  it('expires an overdue request and closes its pending invitations', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const requestId = created.body.data.id;
    await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId });

    await db
      .update(matchmakingRequests)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(matchmakingRequests.id, requestId));

    const result = await matchmakingExpiryService.runOnce();
    expect(result.requestsExpired).toBeGreaterThanOrEqual(1);

    const [requestRow] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, requestId));
    expect(requestRow.status).toBe('EXPIRED');

    const invitations = await db
      .select()
      .from(matchmakingInvitations)
      .where(eq(matchmakingInvitations.requestId, requestId));
    expect(invitations.every((row) => row.status === 'EXPIRED')).toBe(true);
  });

  it('cancels an overdue PENDING_COURT match with COURT_NOT_BOOKED', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const requestId = created.body.data.id;
    const invitation = await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({
      inviteeId,
    });
    const accept = await as(inviteeId, 'put', `/api/v1/matchmaking-invitations/${invitation.body.data.id}`).send({
      decision: 'ACCEPTED',
    });
    const matchId = accept.body.data.matchId;

    await db
      .update(matches)
      .set({ bookingDeadlineAt: new Date(Date.now() - 60_000) })
      .where(eq(matches.id, matchId));

    const result = await matchmakingExpiryService.runOnce();
    expect(result.matchesCancelled).toBeGreaterThanOrEqual(1);

    const [matchRow] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(matchRow.status).toBe('CANCELLED');
    expect(matchRow.cancellationReason).toBe('COURT_NOT_BOOKED');
  });

  it('lists the caller requests and invitations scoped to the caller', async () => {
    const created = await as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest());
    const requestId = created.body.data.id;
    await as(ownerId, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId });

    const requests = await as(ownerId, 'get', '/api/v1/matchmaking-requests');
    expect(requests.status).toBe(200);
    expect(requests.body.data).toHaveLength(1);

    const received = await as(inviteeId, 'get', '/api/v1/matchmaking-invitations?direction=RECEIVED');
    expect(received.status).toBe(200);
    expect(received.body.data).toHaveLength(1);
    expect(received.body.data[0].status).toBe('PENDING');

    const others = await as(strangesId, 'get', '/api/v1/matchmaking-invitations?direction=RECEIVED');
    expect(others.body.data).toHaveLength(0);
  });
  async function newRequest(owner: number, overrides: Record<string, unknown> = {}) {
    const response = await as(owner, 'post', '/api/v1/matchmaking-requests').send(baseRequest(overrides));
    expect(response.status).toBe(201);
    return response.body.data.id as number;
  }

  async function invite(owner: number, requestId: number, player: number) {
    const response = await as(owner, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: player });
    expect(response.status).toBe(201);
    return response.body.data.id as number;
  }

  const acceptInvite = (player: number, invitation: number) =>
    as(player, 'put', `/api/v1/matchmaking-invitations/${invitation}`).send({ decision: 'ACCEPTED' });

  it('serializes cross-request acceptances for the same Player', async () => {
    const a = await newRequest(ownerId, { matchType: 'DOUBLES' });
    const b = await newRequest(strangesId, { matchType: 'DOUBLES' });
    const ia = await invite(ownerId, a, inviteeId);
    const ib = await invite(strangesId, b, inviteeId);
    const results = await Promise.all([acceptInvite(inviteeId, ia), acceptInvite(inviteeId, ib)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(results.find(r => r.status === 409)?.body.error.code).toBe('MATCHMAKING_SCHEDULE_CONFLICT');
  });

  it('serializes simultaneous owner requests across match types', async () => {
    const results = await Promise.all([
      as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest()),
      as(ownerId, 'post', '/api/v1/matchmaking-requests').send(baseRequest({ matchType: 'DOUBLES' })),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
  });

  it('fills an oversubscribed group concurrently without deadlock', async () => {
    const fourth = (await createPlayer()).id;
    const req = await newRequest(ownerId, { matchType: 'DOUBLES' });
    const first = await invite(ownerId, req, inviteeId);
    const second = await invite(ownerId, req, strangesId);
    const third = await invite(ownerId, req, fourth);
    expect((await acceptInvite(inviteeId, first)).status).toBe(200);
    const results = await Promise.all([acceptInvite(strangesId, second), acceptInvite(fourth, third)]);
    expect(results.every(r => r.status === 200)).toBe(true);
    expect((await db.select().from(matches))).toHaveLength(1);
    expect((await db.select().from(matchPlayers))).toHaveLength(4);
  });

  it('serializes accept and request cancellation', async () => {
    const req = await newRequest(ownerId, { matchType: 'DOUBLES' });
    const invitation = await invite(ownerId, req, inviteeId);
    const results = await Promise.all([
      acceptInvite(inviteeId, invitation),
      as(ownerId, 'post', `/api/v1/matchmaking-requests/${req}/cancel`),
    ]);
    expect(results[0].status).toBeOneOf([200, 409]);
    expect(results[1].status).toBe(200);
    const [row] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, req));
    expect(row.status).toBe('CANCELLED');
  });

  it('serializes withdrawal against the final acceptance', async () => {
    const fourth = (await createPlayer()).id;
    const req = await newRequest(ownerId, { matchType: 'DOUBLES' });
    const ia = await invite(ownerId, req, inviteeId);
    const ib = await invite(ownerId, req, strangesId);
    const ic = await invite(ownerId, req, fourth);
    await acceptInvite(inviteeId, ia);
    await acceptInvite(strangesId, ib);
    const [withdraw, accept] = await Promise.all([
      as(inviteeId, 'post', `/api/v1/matchmaking-invitations/${ia}/withdraw`),
      acceptInvite(fourth, ic),
    ]);
    expect(accept.status).toBe(200);
    const [row] = await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, ia));
    if (withdraw.status === 200) {
      expect(row.status).toBe('WITHDRAWN');
      expect(await db.select().from(matches)).toHaveLength(0);
    } else {
      expect(withdraw.status).toBe(409);
      expect(row.status).toBe('ACCEPTED');
      expect(await db.select().from(matchPlayers)).toHaveLength(4);
    }
  });

  it.each(['CANCELLED', 'EXPIRED'])('revokes partial-group access when request is %s', async (status) => {
    const req = await newRequest(ownerId, { matchType: 'DOUBLES' });
    const invitation = await invite(ownerId, req, inviteeId);
    await acceptInvite(inviteeId, invitation);
    const memberDetail = await as(inviteeId, 'get', `/api/v1/matchmaking-requests/${req}`);
    expect(memberDetail.status).toBe(200);
    expect(memberDetail.body.data.invitationId).toBe(invitation);
    await db.update(matchmakingRequests).set({ status }).where(eq(matchmakingRequests.id, req));
    expect((await as(inviteeId, 'get', `/api/v1/matchmaking-requests/${req}`)).status).toBe(404);
  });

  it('ignores expired reservations before the scheduler runs', async () => {
    const req = await newRequest(ownerId, { matchType: 'DOUBLES' });
    await acceptInvite(inviteeId, await invite(ownerId, req, inviteeId));
    await db.update(matchmakingRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(matchmakingRequests.id, req));
    await newRequest(inviteeId);
    await newRequest(ownerId); // other match type must not be blocked by expired owner request
  });

  it('allows reinvitation after timeout without a scheduler tick', async () => {
    const req = await newRequest(ownerId);
    const old = await invite(ownerId, req, inviteeId);
    await db.update(matchmakingInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(matchmakingInvitations.id, old));
    const next = await invite(ownerId, req, inviteeId);
    expect(next).not.toBe(old);
    const [row] = await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, old));
    expect(row.status).toBe('EXPIRED');
  });

  it('withdrawal is idempotent', async () => {
    const req = await newRequest(ownerId, { matchType: 'DOUBLES' });
    const invitation = await invite(ownerId, req, inviteeId);
    await acceptInvite(inviteeId, invitation);
    for (let i = 0; i < 2; i++) {
      const response = await as(inviteeId, 'post', `/api/v1/matchmaking-invitations/${invitation}/withdraw`);
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('WITHDRAWN');
    }
  });

  it('rechecks invitation expiry after waiting for Player locks and persists expiry', async () => {
    const req = await newRequest(ownerId);
    const invitation = await invite(ownerId, req, inviteeId);
    let release!: () => void;
    let locked!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const ready = new Promise<void>(resolve => { locked = resolve; });
    const holding = db.transaction(async tx => {
      await matchmakingRepository.lockUsersAscending([ownerId, inviteeId], tx);
      locked();
      await gate;
    });
    await ready;
    const original = matchmakingRepository.lockUsersAscending.bind(matchmakingRepository);
    let attempted!: () => void;
    const attempt = new Promise<void>(resolve => { attempted = resolve; });
    const spy = vi.spyOn(matchmakingRepository, 'lockUsersAscending').mockImplementation(async (ids, tx) => {
      attempted();
      return original(ids, tx);
    });
    const responding = acceptInvite(inviteeId, invitation).then(r => r);
    try {
      await attempt;
      await db.update(matchmakingInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(matchmakingInvitations.id, invitation));
    } finally {
      release();
      await holding;
      spy.mockRestore();
    }
    const response = await responding;
    expect(response.status).toBe(409);
    const [row] = await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, invitation));
    expect(row.status).toBe('EXPIRED');
  });

  it('list/detail/filter/leave agree on an overdue pending-court Match', async () => {
    const req = await newRequest(ownerId);
    const formed = await acceptInvite(inviteeId, await invite(ownerId, req, inviteeId));
    const matchId = formed.body.data.matchId;
    await db.update(matches).set({ bookingDeadlineAt: new Date(Date.now() - 1000) }).where(eq(matches.id, matchId));
    expect((await as(ownerId, 'get', `/api/v1/matches/${matchId}`)).body.data.status).toBe('CANCELLED');
    const list = await as(ownerId, 'get', '/api/v1/matches?status=CANCELLED');
    expect(list.body.meta.total).toBe(1);
    expect(list.body.data[0].status).toBe('CANCELLED');
    expect((await as(ownerId, 'get', '/api/v1/matches?status=PENDING_COURT')).body.meta.total).toBe(0);
    await as(inviteeId, 'post', `/api/v1/matches/${matchId}/leave`);
    const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(row.status).toBe('CANCELLED');
  });

  it('rolls back standalone Match core creation if participant insertion fails', async () => {
    await expect(matchModule.createMatchWithPlayers({
      matchType: 'SINGLES', scheduledAt: new Date(),
      players: [{ playerId: ownerId, teamNo: 1 }, { playerId: -1, teamNo: 2 }],
    })).rejects.toThrow();
    expect(await db.select().from(matches)).toHaveLength(0);
  });

  it.each(['CONFIRMED', 'IN_PROGRESS'])('cancels a %s Match with a cancelled booking before advancement', async (status) => {
    const courtOwner = await createTestUser({ role: 'COURT_OWNER' });
    const [facility] = await db.insert(facilities).values({ ownerId: courtOwner.id, name: 'Test', phone: '0123456789', status: 'ACTIVE',
      address: 'Test', ward: 'Test', district: 'Test', city: 'Test', latitude: '10', longitude: '106', openingTime: '00:00', closingTime: '23:59' }).returning();
    const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Test', status: 'ACTIVE' }).returning();
    const req = await newRequest(ownerId);
    const formed = await acceptInvite(inviteeId, await invite(ownerId, req, inviteeId));
    const matchId = formed.body.data.matchId;
    const [booking] = await db.insert(bookings).values({ playerId: ownerId, courtId: court.id, bookingDate: TODAY,
      startTime: '00:00', endTime: '00:01', unitPrice: '100', totalAmount: '100', status: 'CANCELLED', bookingCode: `TEST-${matchId}` }).returning();
    await db.update(matches).set({ status, bookingId: booking.id, scheduledAt: new Date(Date.now() - 10000) }).where(eq(matches.id, matchId));
    expect((await as(ownerId, 'get', `/api/v1/matches/${matchId}`)).body.data.status).toBe('CANCELLED');
    await matchmakingExpiryService.runOnce();
    const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(row.status).toBe('CANCELLED');
    expect(row.cancellationReason).toBe('BOOKING_CANCELLED');
    expect(row.completedAt).toBeNull();
  });

  it('advances a valid booked Match and preserves scheduled timestamps during catch-up', async () => {
    const owner = await createTestUser({ role: 'COURT_OWNER' });
    const [facility] = await db.insert(facilities).values({ ownerId: owner.id, name: 'Test', phone: '0123456789', status: 'ACTIVE',
      address: 'Test', ward: 'Test', district: 'Test', city: 'Test', latitude: '10', longitude: '106', openingTime: '00:00', closingTime: '23:59' }).returning();
    const [court] = await db.insert(courts).values({ facilityId: facility.id, name: 'Test', status: 'ACTIVE' }).returning();
    const req = await newRequest(ownerId);
    const formed = await acceptInvite(inviteeId, await invite(ownerId, req, inviteeId));
    const matchId = formed.body.data.matchId;
    const pastDate = addDaysToDateString(TODAY, -1);
    const scheduledAt = new Date(`${pastDate}T10:00:00+07:00`);
    const endAt = new Date(`${pastDate}T11:30:00+07:00`);
    const [booking] = await db.insert(bookings).values({ playerId: ownerId, courtId: court.id, bookingDate: pastDate,
      startTime: '10:00', endTime: '11:30', unitPrice: '100', totalAmount: '100', status: 'COMPLETED', bookingCode: `VALID-${matchId}` }).returning();
    await db.update(matches).set({ status: 'CONFIRMED', bookingId: booking.id, scheduledAt }).where(eq(matches.id, matchId));
    const detail = await as(ownerId, 'get', `/api/v1/matches/${matchId}`);
    expect(detail.body.data.status).toBe('COMPLETED');
    expect(detail.body.data.scheduledEndAt).toBe(endAt.toISOString());
    const memberDetail = await as(inviteeId, 'get', `/api/v1/matches/${matchId}`);
    expect(memberDetail.body.data.price).toBe(100);
    expect(memberDetail.body.data.booking).toBeNull();
    const result = await matchmakingExpiryService.runOnce();
    expect(result.matchesStarted).toBe(1);
    expect(result.matchesCompleted).toBe(1);
    const [row] = await db.select().from(matches).where(eq(matches.id, matchId));
    expect(row.status).toBe('COMPLETED');
    expect(row.startedAt).toEqual(scheduledAt);
    expect(row.completedAt).toEqual(endAt);
  });

});
