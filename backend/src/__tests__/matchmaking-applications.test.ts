import { describe, it, expect, beforeEach, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db, matchmakingInvitations, matchmakingRequests, matchmakingMatches, notifications, playerProfiles, posts } from '../db';
import { as, matchFindingPost, player, setConfig, skillIds } from './social-fixture';
import { testBlockPort } from './test-block-port';
import { registerBlockPort } from '../services/matchmaking/block-port.registry';
import { createTestUser } from './test-helpers';
import { matchmakingNotifications } from '../services/matchmaking/matchmaking-notifications';

const apply = (actor: number, requestId: number) => as(actor, 'post', `/api/v1/matchmaking-requests/${requestId}/applications`).send({});
const decide = (host: number, id: number, decision = 'ACCEPTED') => as(host, 'put', `/api/v1/matchmaking-applications/${id}`).send({ decision });
const cancel = (actor: number, id: number) => as(actor, 'post', `/api/v1/matchmaking-applications/${id}/cancel`);
async function fixture(draft = {}) {
  const host = await player('Host'); const applicant = await player('Applicant');
  return { host, applicant, ...(await matchFindingPost(host, draft, true)) };
}
beforeEach(async () => {
  await setConfig('MATCHMAKING_ENABLED', 'true'); await setConfig('SOCIAL_FEED_ENABLED', 'true');
  await setConfig('MATCHMAKING_APPLICATION_TIMEOUT_MINUTES', '1440');
});

describe('MM-24 Apply API', () => {
  it('creates a warning-only out-of-range application, scoped lists and one received notification; pending reserves no interval', async () => {
    const { host, applicant, requestId } = await fixture(); const levels = await skillIds();
    await db.update(playerProfiles).set({ skillLevelId: levels.min }).where(eq(playerProfiles.userId, applicant));
    await db.update(matchmakingRequests).set({ minSkillLevelId: levels.mid, maxSkillLevelId: levels.max }).where(eq(matchmakingRequests.id, requestId));
    const result = await apply(applicant, requestId); expect(result.status).toBe(201);
    expect(result.body.data).toMatchObject({ playerId: applicant, status: 'PENDING', applicant: { skillMismatch: true } });
    const id = result.body.data.id;
    const mine = await as(applicant, 'get', `/api/v1/matchmaking-applications?requestId=${requestId}&status=PENDING`);
    expect(mine.body.data.map((row: any) => row.id)).toEqual([id]); expect(mine.body.meta.total).toBe(1);
    expect((await as(host, 'get', `/api/v1/matchmaking-requests/${requestId}/applications`)).body.data).toHaveLength(1);
    expect((await as(host, 'get', '/api/v1/matchmaking-applications')).body.data).toHaveLength(0);
    const otherHost = await player(); const overlapping = await matchFindingPost(otherHost, {}, true);
    expect((await apply(applicant, overlapping.requestId)).status).toBe(201);
    const events = await db.select().from(notifications).where(and(eq(notifications.type, 'MM_APPLICATION_RECEIVED'), eq(notifications.resourceId, requestId)));
    expect(events).toHaveLength(1); expect(events[0].userId).toBe(host);
    expect(result.body.data.request).not.toHaveProperty('body'); expect(result.body.data.request).not.toHaveProperty('members');
  });

  it('rejects unpublished, hidden, self and non-Player requests without creating membership', async () => {
    const host = await player(); const applicant = await player(); const hidden = await matchFindingPost(host, {}, true); const unpublished = await matchFindingPost(host, { startAt: new Date(Date.now() + 72 * 3600000).toISOString() });
    expect((await apply(applicant, unpublished.requestId)).body.error.code).toBe('MATCHMAKING_POST_NOT_PUBLISHED');
    await db.update(posts).set({ hiddenAt: new Date(), hiddenBy: host }).where(eq(posts.id, hidden.postId));
    expect((await apply(applicant, hidden.requestId)).status).toBe(404);
    expect((await apply(host, unpublished.requestId)).body.error.code).toBe('MATCHMAKING_ACTION_NOT_AVAILABLE');
    const owner = await createTestUser({ role: 'COURT_OWNER' }); expect((await apply(owner.id, unpublished.requestId)).status).toBe(403);
    expect(await db.select().from(matchmakingInvitations)).toHaveLength(0);
  });

  it('enforces a neutral block and fails closed when the real provider is absent', async () => {
    const { host, applicant, requestId } = await fixture(); testBlockPort.block(host, applicant);
    const blocked = await apply(applicant, requestId); expect(blocked.status).toBe(409); expect(blocked.body.error.code).toBe('MATCHMAKING_ACTION_NOT_AVAILABLE');
    registerBlockPort(null);
    const unavailable = await apply(applicant, requestId);
    expect(unavailable.status).toBe(409); expect(unavailable.body.error.code).toBe('MATCHMAKING_ACTION_NOT_AVAILABLE');
    expect(unavailable.body.error.message).toContain('chưa sẵn sàng');
    expect(JSON.stringify(unavailable.body)).not.toMatch(/BlockPort|MSG-08/);
    expect(await db.select().from(matchmakingInvitations)).toHaveLength(0);
  });

  it('caps timeout at start and rejects active duplicates across Invite and Apply', async () => {
    const { host, applicant, requestId } = await fixture({ startAt: new Date(Date.now() + 3 * 3600000).toISOString() });
    const created = await apply(applicant, requestId); expect(created.status).toBe(201);
    const [request] = await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, requestId));
    expect(new Date(created.body.data.expiresAt).getTime()).toBe(request.startAt.getTime());
    expect((await apply(applicant, requestId)).body.error.code).toBe('MATCHMAKING_ALREADY_ACTIVE');
    expect((await as(applicant, 'get', `/api/v1/matchmaking-requests/${requestId}`)).body.data.invitationId).toBeUndefined();
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: applicant })).body.error.code).toBe('MATCHMAKING_ALREADY_ACTIVE');
    const other = await player(); expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: other })).status).toBe(201);
    expect((await apply(other, requestId)).body.error.code).toBe('MATCHMAKING_ALREADY_ACTIVE');
  });

  it('serializes simultaneous Apply and Invite for the same player', async () => {
    const { host, applicant, requestId } = await fixture();
    const results = await Promise.all([apply(applicant, requestId), as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: applicant })]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.requestId, requestId))).toHaveLength(1);
  });

  it('allows applicant cancel replay, then a new Apply; a stranger or host cannot cancel it', async () => {
    const { host, applicant, requestId } = await fixture(); const stranger = await player(); const id = (await apply(applicant, requestId)).body.data.id;
    expect((await cancel(host, id)).status).toBe(404); expect((await cancel(stranger, id)).status).toBe(404);
    expect((await cancel(applicant, id)).body.data.status).toBe('CANCELLED'); expect((await cancel(applicant, id)).status).toBe(200);
    expect((await apply(applicant, requestId)).status).toBe(201);
  });

  it('host decline is authorized, idempotent and emits exactly one decision notification', async () => {
    const { host, applicant, requestId } = await fixture(); const id = (await apply(applicant, requestId)).body.data.id;
    expect((await decide(applicant, id, 'DECLINED')).status).toBe(404);
    expect((await as(applicant, 'get', `/api/v1/matchmaking-requests/${requestId}/applications`)).status).toBe(404);
    expect((await decide(host, id, 'DECLINED')).body.data.status).toBe('DECLINED'); expect((await decide(host, id, 'DECLINED')).status).toBe(200);
    const events = await db.select().from(notifications).where(eq(notifications.dedupKey, `mm-app-decided:${id}`)); expect(events).toHaveLength(1); expect(events[0].type).toBe('MM_APPLICATION_DECLINED');
  });

  it('approval reserves the last Singles seat and host confirmation creates one Match', async () => {
    const { host, applicant, requestId } = await fixture({ matchType: 'SINGLES' }); const id = (await apply(applicant, requestId)).body.data.id;
    const first = await decide(host, id); expect(first.status).toBe(200); expect(first.body.data.status).toBe('ACCEPTED'); expect(first.body.data.matchId).toBeNull();
    expect((await decide(host, id)).body.data).toEqual(first.body.data);
    expect(await db.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, requestId))).toHaveLength(0);
    expect((await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/close`)).status).toBe(200);
    expect(await db.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, requestId))).toHaveLength(1);
    const events = await db.select().from(notifications).where(eq(notifications.dedupKey, `mm-app-decided:${id}`)); expect(events).toHaveLength(1); expect(events[0].type).toBe('MM_APPLICATION_ACCEPTED');
    expect((await cancel(applicant, id)).body.error.code).toBe('MATCHMAKING_APPLICATION_NOT_PENDING');
  });

  it('only one simultaneous approval wins the last slot', async () => {
    const { host, applicant, requestId } = await fixture({ matchType: 'SINGLES' }); const second = await player();
    const ids = [(await apply(applicant, requestId)).body.data.id, (await apply(second, requestId)).body.data.id];
    const results = await Promise.all(ids.map(id => decide(host, id))); expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    expect(await db.select().from(matchmakingInvitations).where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'ACCEPTED')))).toHaveLength(1);
    expect(await db.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, requestId))).toHaveLength(0);
  });

  it('rechecks block and schedule at approval, and rejects a schedule conflict at send', async () => {
    const { host, applicant, requestId } = await fixture(); const id = (await apply(applicant, requestId)).body.data.id;
    testBlockPort.block(host, applicant); expect((await decide(host, id)).body.error.code).toBe('MATCHMAKING_ACTION_NOT_AVAILABLE'); testBlockPort.clear();
    await matchFindingPost(applicant, {}, true);
    expect((await decide(host, id)).body.error.code).toBe('MATCHMAKING_SCHEDULE_CONFLICT');
    expect((await apply(applicant, requestId)).body.error.code).toBe('MATCHMAKING_ALREADY_ACTIVE');
    await cancel(applicant, id); expect((await apply(applicant, requestId)).body.error.code).toBe('MATCHMAKING_SCHEDULE_CONFLICT');
  });

  it('expired pending rows list effectively and close durably with application-specific errors', async () => {
    const { host, applicant, requestId } = await fixture(); const id = (await apply(applicant, requestId)).body.data.id;
    await db.update(matchmakingInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(matchmakingInvitations.id, id));
    const list = await as(applicant, 'get', '/api/v1/matchmaking-applications?status=EXPIRED'); expect(list.body.data[0].status).toBe('EXPIRED');
    expect((await decide(host, id)).body.error.code).toBe('MATCHMAKING_APPLICATION_EXPIRED');
    expect((await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, id)))[0].status).toBe('EXPIRED');
    expect((await apply(applicant, requestId)).status).toBe(201);
  });

  it('Apply endpoints cannot mutate Invite rows and invitation endpoints cannot decide Apply', async () => {
    const { host, applicant, requestId } = await fixture(); const id = (await apply(applicant, requestId)).body.data.id;
    expect((await as(applicant, 'put', `/api/v1/matchmaking-invitations/${id}`).send({ decision: 'ACCEPTED' })).status).toBe(404);
    await cancel(applicant, id); const invitation = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: applicant }); const inviteId = invitation.body.data.id;
    expect((await decide(host, inviteId)).status).toBe(404); expect((await cancel(applicant, inviteId)).status).toBe(404);
  });

  it('Matchmaking gate blocks only new Apply; existing decisions/cancellation work when gates are off', async () => {
    const { host, applicant, requestId } = await fixture(); await setConfig('SOCIAL_FEED_ENABLED', 'false');
    const id = (await apply(applicant, requestId)).body.data.id; expect(id).toBeGreaterThan(0);
    await setConfig('MATCHMAKING_ENABLED', 'false'); const other = await player(); expect((await apply(other, requestId)).body.error.code).toBe('MATCHMAKING_DISABLED');
    expect((await decide(host, id)).status).toBe(200);
  });

  it('rejects unsupported payload fields and invalid pagination', async () => {
    const { applicant, requestId } = await fixture();
    expect((await as(applicant, 'post', `/api/v1/matchmaking-requests/${requestId}/applications`).send({ message: 'Not approved' })).status).toBe(400);
    expect((await as(applicant, 'get', '/api/v1/matchmaking-applications?page=0')).status).toBe(400);
  });

  it('rolls back acceptance when notification persistence fails', async () => {
    const { host, applicant, requestId } = await fixture({ matchType: 'SINGLES' }); const id = (await apply(applicant, requestId)).body.data.id;
    const spy = vi.spyOn(matchmakingNotifications, 'applicationDecided').mockRejectedValueOnce(new Error('Notification storage unavailable'));
    try { expect((await decide(host, id)).status).toBe(500); } finally { spy.mockRestore(); }
    expect((await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, id)))[0].status).toBe('PENDING');
    expect((await db.select().from(matchmakingRequests).where(eq(matchmakingRequests.id, requestId)))[0].status).toBe('OPEN');
    expect(await db.select().from(matchmakingMatches).where(eq(matchmakingMatches.matchmakingRequestId, requestId))).toHaveLength(0);
  });

  it('own history never reveals BLOCKED as the reason for closure', async () => {
    const { applicant, requestId } = await fixture(); const id = (await apply(applicant, requestId)).body.data.id;
    await db.update(matchmakingInvitations).set({ status: 'CANCELLED', closeReason: 'BLOCKED' }).where(eq(matchmakingInvitations.id, id));
    const result = await as(applicant, 'get', '/api/v1/matchmaking-applications'); expect(result.status).toBe(200); expect(result.body.data[0].closeReason).toBeNull();
  });
});
