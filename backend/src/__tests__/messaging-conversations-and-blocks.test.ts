import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import app from '../app';
import {
  db,
  users,
  playerProfiles,
  skillLevels,
  systemConfigs,
  posts,
  matchmakingRequests,
  matchmakingInvitations,
} from '../db';
import { messagingConfig } from '../shared/config/messaging-config';
import { messagingService } from '../services/messaging/MessagingService';

const CSRF = 'test-csrf-token';

function asUser(userId: number) {
  return {
    'x-user-id': String(userId),
    Cookie: `csrf_token=${CSRF}`,
    'X-CSRF-Token': CSRF,
  };
}

describe('Messaging conversations & blocks API (MSG-02, MSG-08)', () => {
  let skillId: number;
  let p1Id: number;
  let p2Id: number;
  let p3Id: number;
  let ownerId: number;

  beforeEach(async () => {
    process.env.ALLOW_TEST_AUTH = 'true';
    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_ENABLED', configValue: 'true' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: 'true' },
      });
    messagingConfig.clearCache();

    const [skill] = await db.select().from(skillLevels).limit(1);
    skillId = skill.id;

    const inserted = await db
      .insert(users)
      .values([
        { email: 'p1@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'p2@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'p3@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'owner@msg.test', passwordHash: 'h', role: 'COURT_OWNER', status: 'ACTIVE' },
      ])
      .returning();

    p1Id = inserted[0].id;
    p2Id = inserted[1].id;
    p3Id = inserted[2].id;
    ownerId = inserted[3].id;

    await db.insert(playerProfiles).values([
      { userId: p1Id, fullName: 'Nguyễn Minh Quân', skillLevelId: skillId },
      { userId: p2Id, fullName: 'Trần Hoàng Bảo', skillLevelId: skillId },
      { userId: p3Id, fullName: 'Lê Thanh Tùng', skillLevelId: skillId },
    ]);
  });

  it('searches active non-blocked players by name and rejects non-PLAYER role', async () => {
    const forbidden = await request(app).get('/api/v1/players/search').set(asUser(ownerId));
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('AUTH_FORBIDDEN_ROLE');

    const res = await request(app)
      .get('/api/v1/players/search')
      .query({ q: 'Hoàng Bảo' })
      .set(asUser(p1Id));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: p2Id,
      fullName: 'Trần Hoàng Bảo',
    });
  });

  it('creates and reopens direct conversations and hides empty direct chat from counterpart list', async () => {
    const createRes = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p1Id))
      .send({ playerId: p2Id });
    expect(createRes.status).toBe(201);
    const convId = createRes.body.data.id;
    expect(createRes.body.data.type).toBe('DIRECT');

    // Reopening returns 200 with the same conversation ID
    const reopenRes = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p2Id))
      .send({ playerId: p1Id });
    expect(reopenRes.status).toBe(200);
    expect(reopenRes.body.data.id).toBe(convId);

    // Creator (p1) sees the newly opened empty direct conversation in their list, while counterpart (p2) does not until a message is sent
    const p1List = await request(app).get('/api/v1/conversations').set(asUser(p1Id));
    expect(p1List.status).toBe(200);
    expect(p1List.body.data.map((c: any) => c.id)).toContain(convId);

    const p2List = await request(app).get('/api/v1/conversations').set(asUser(p2Id));
    expect(p2List.status).toBe(200);
    expect(p2List.body.data.map((c: any) => c.id)).not.toContain(convId);

    // Non-member (p3) gets 404 MESSAGING_CONVERSATION_NOT_FOUND
    const nonMemberRes = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set(asUser(p3Id));
    expect(nonMemberRes.status).toBe(404);
    expect(nonMemberRes.body.error.code).toBe('MESSAGING_CONVERSATION_NOT_FOUND');
  });

  it('creates standalone group conversations, adds members, leaves group (LEFT), and reactivates LEFT members', async () => {
    const createRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Hội Cầu Lông Quận 10', memberIds: [p2Id] });
    expect(createRes.status).toBe(201);
    const groupId = createRes.body.data.id;
    expect(createRes.body.data.title).toBe('Hội Cầu Lông Quận 10');
    expect(createRes.body.data.members).toHaveLength(2);

    // Non-owner p2 cannot add members to the group (403 FORBIDDEN)
    const nonOwnerAddRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/members`)
      .set(asUser(p2Id))
      .send({ memberIds: [p3Id] });
    expect(nonOwnerAddRes.status).toBe(403);

    // Group owner p1 adds p3 to the group
    const addRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/members`)
      .set(asUser(p1Id))
      .send({ memberIds: [p3Id] });
    expect(addRes.status).toBe(200);
    expect(addRes.body.data.members).toHaveLength(3);

    // p3 leaves the group
    const leaveRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/leave`)
      .set(asUser(p3Id));
    expect(leaveRes.status).toBe(204);

    // LEFT member gets 404 when requesting conversation detail
    const leftDetail = await request(app)
      .get(`/api/v1/conversations/${groupId}`)
      .set(asUser(p3Id));
    expect(leftDetail.status).toBe(404);
    expect(leftDetail.body.error.code).toBe('MESSAGING_CONVERSATION_NOT_FOUND');

    // Active member (p1) re-adds p3 -> restores ACTIVE access
    const reAddRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/members`)
      .set(asUser(p1Id))
      .send({ memberIds: [p3Id] });
    expect(reAddRes.status).toBe(200);
    expect(reAddRes.body.data.members).toHaveLength(3);

    const restoredDetail = await request(app)
      .get(`/api/v1/conversations/${groupId}`)
      .set(asUser(p3Id));
    expect(restoredDetail.status).toBe(200);
  });

  it('blocks/unblocks players, closes pending matchmaking invitations, and keeps shared group memberships', async () => {
    // Shared group with p1 and p2
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Nhóm Chung', memberIds: [p2Id] });
    const groupId = groupRes.body.data.id;

    // Create a pending matchmaking invitation from p2 to p1
    const [postRow] = await db
      .insert(posts)
      .values({
        authorId: p2Id,
        type: 'MATCH_FINDING',
        title: 'Kèo cầu lông đơn',
        body: 'Giao lưu đơn',
        publishedAt: new Date(),
        creationHash: 'b'.repeat(64),
      })
      .returning();

    const startAt = new Date(Date.now() + 86400_000);
    const [reqRow] = await db
      .insert(matchmakingRequests)
      .values({
        postId: postRow.id,
        playerId: p2Id,
        matchType: 'SINGLES',
        minSkillLevelId: skillId,
        maxSkillLevelId: skillId,
        preferredDate: '2026-11-10',
        preferredStartTime: '18:00',
        preferredEndTime: '20:00',
        matchDurationMinutes: 90,
        startAt,
        durationMinutes: 90,
        capacity: 2,
        minPlayers: 2,
        status: 'OPEN',
        expiresAt: new Date(Date.now() + 86400_000),
      })
      .returning();

    const [invRow] = await db
      .insert(matchmakingInvitations)
      .values({
        requestId: reqRow.id,
        createdBy: p2Id,
        playerId: p1Id,
        kind: 'INVITE',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 3600_000),
      })
      .returning();

    // p1 blocks p2
    const blockRes = await request(app)
      .post('/api/v1/blocks')
      .set(asUser(p1Id))
      .send({ playerId: p2Id });
    expect(blockRes.status).toBe(204);
    expect(await messagingService.isBlockedEitherWay(p1Id, p2Id)).toBe(true);
    expect(await messagingService.isBlockedEitherWay(p2Id, p1Id)).toBe(true);

    // Pending invitation is closed via MatchmakingBlockPort (CANCELLED + closeReason = BLOCKED)
    const [updatedInv] = await db
      .select()
      .from(matchmakingInvitations)
      .where(eq(matchmakingInvitations.id, invRow.id));
    expect(updatedInv.status).toBe('CANCELLED');
    expect(updatedInv.closeReason).toBe('BLOCKED');

    // Neither can open a new direct conversation with the other (neutral 409)
    const directBlocked = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p2Id))
      .send({ playerId: p1Id });
    expect(directBlocked.status).toBe(409);
    expect(directBlocked.body.error.code).toBe('MESSAGING_ACTION_NOT_AVAILABLE');

    // Shared group conversation remains accessible to both p1 and p2
    const p2GroupDetail = await request(app)
      .get(`/api/v1/conversations/${groupId}`)
      .set(asUser(p2Id));
    expect(p2GroupDetail.status).toBe(200);
    expect(p2GroupDetail.body.data.canSend).toBe(true);

    // Unblock removes the block without restoring the closed invitation
    const listBlocksRes = await request(app).get('/api/v1/blocks').set(asUser(p1Id));
    expect(listBlocksRes.body.data).toHaveLength(1);

    const unblockRes = await request(app)
      .delete(`/api/v1/blocks/${p2Id}`)
      .set(asUser(p1Id));
    expect(unblockRes.status).toBe(204);
    expect(await messagingService.isBlockedEitherWay(p1Id, p2Id)).toBe(false);
  });

  it('enforces MESSAGING_ENABLED = false gate on mutations while allowing reads, group leave, and blocks', async () => {
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Gate Test Group', memberIds: [p2Id] });
    const groupId = groupRes.body.data.id;

    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_ENABLED', configValue: 'false' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: 'false' },
      });
    messagingConfig.clearCache();

    // Creating direct/group conversations blocked with 409 MESSAGING_DISABLED
    const directRes = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p1Id))
      .send({ playerId: p3Id });
    expect(directRes.status).toBe(409);
    expect(directRes.body.error.code).toBe('MESSAGING_DISABLED');

    // Reading conversation list and leaving group still allowed
    const listRes = await request(app).get('/api/v1/conversations').set(asUser(p2Id));
    expect(listRes.status).toBe(200);

    const leaveRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/leave`)
      .set(asUser(p2Id));
    expect(leaveRes.status).toBe(204);
  });
});
