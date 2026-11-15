import crypto from 'crypto';
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
  messages,
  conversations,
} from '../db';
import { messagingConfig } from '../shared/config/messaging-config';

const CSRF = 'test-csrf-token';

function asUser(userId: number) {
  return {
    'x-user-id': String(userId),
    Cookie: `csrf_token=${CSRF}`,
    'X-CSRF-Token': CSRF,
  };
}

describe('Messaging v2: Group Owner Administration & Message Reply/Edit/Recall/Hide (MSG-11)', () => {
  let skillId: number;
  let ownerPlayerId: number;
  let memberPlayerId: number;
  let thirdPlayerId: number;

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
        { email: 'owner-v2@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'member-v2@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'third-v2@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
      ])
      .returning();

    ownerPlayerId = inserted[0].id;
    memberPlayerId = inserted[1].id;
    thirdPlayerId = inserted[2].id;

    await db.insert(playerProfiles).values([
      { userId: ownerPlayerId, fullName: 'Chủ Nhóm Cầu Lông', skillLevelId: skillId },
      { userId: memberPlayerId, fullName: 'Thành Viên Nhóm 1', skillLevelId: skillId },
      { userId: thirdPlayerId, fullName: 'Thành Viên Nhóm 2', skillLevelId: skillId },
    ]);
  });

  it('enforces Group Owner permissions for rename, lock/unlock, member removal, owner leave guard, and group dissolution', async () => {
    const createRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(ownerPlayerId))
      .send({
        title: 'Hội Cầu Lông Sáng Chủ Nhật',
        memberIds: [memberPlayerId, thirdPlayerId],
      });
    expect(createRes.status).toBe(201);
    const groupId = createRes.body.data.id;
    expect(createRes.body.data.createdBy).toBe(ownerPlayerId);
    expect(createRes.body.data.isLocked).toBe(false);

    // Non-owner cannot rename or lock group (403 FORBIDDEN)
    const nonOwnerPatch = await request(app)
      .patch(`/api/v1/conversations/${groupId}`)
      .set(asUser(memberPlayerId))
      .send({ title: 'Tên Bị Đổi Trái Phép', isLocked: true });
    expect(nonOwnerPatch.status).toBe(403);

    // Group Owner renames and locks group sending
    const ownerPatch = await request(app)
      .patch(`/api/v1/conversations/${groupId}`)
      .set(asUser(ownerPlayerId))
      .send({ title: 'Hội Cầu Lông Sáng Chủ Nhật (VIP)', isLocked: true });
    expect(ownerPatch.status).toBe(200);
    expect(ownerPatch.body.data.title).toBe('Hội Cầu Lông Sáng Chủ Nhật (VIP)');
    expect(ownerPatch.body.data.isLocked).toBe(true);
    expect(ownerPatch.body.data.canSend).toBe(true); // Owner can still send when locked

    // Member sees canSend = false (MESSAGING_GROUP_LOCKED) and gets 403 when trying to send
    const memberDetail = await request(app)
      .get(`/api/v1/conversations/${groupId}`)
      .set(asUser(memberPlayerId));
    expect(memberDetail.status).toBe(200);
    expect(memberDetail.body.data.canSend).toBe(false);
    expect(memberDetail.body.data.sendDisabledReason).toBe('MESSAGING_GROUP_LOCKED');

    const memberSendLocked = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(memberPlayerId))
      .send({
        text: 'Tin nhắn khi nhóm đang khóa',
        clientMessageId: crypto.randomUUID(),
      });
    expect(memberSendLocked.status).toBe(403);
    expect(memberSendLocked.body.error.code).toBe('MESSAGING_GROUP_LOCKED');

    // Group Owner can still send when group is locked
    const ownerSendLocked = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(ownerPlayerId))
      .send({
        text: 'Thông báo từ Chủ nhóm khi nhóm khóa',
        clientMessageId: crypto.randomUUID(),
      });
    expect(ownerSendLocked.status).toBe(201);

    // Unlock group -> member can send again
    await request(app)
      .patch(`/api/v1/conversations/${groupId}`)
      .set(asUser(ownerPlayerId))
      .send({ isLocked: false })
      .expect(200);

    // Group Owner cannot leave group via /leave (409 MESSAGING_OWNER_CANNOT_LEAVE)
    const ownerLeave = await request(app)
      .post(`/api/v1/conversations/${groupId}/leave`)
      .set(asUser(ownerPlayerId));
    expect(ownerLeave.status).toBe(409);
    expect(ownerLeave.body.error.code).toBe('MESSAGING_OWNER_CANNOT_LEAVE');

    // Group Owner removes thirdPlayerId from group
    const kickRes = await request(app)
      .delete(`/api/v1/conversations/${groupId}/members/${thirdPlayerId}`)
      .set(asUser(ownerPlayerId));
    expect(kickRes.status).toBe(200);
    expect(kickRes.body.data.members.map((m: any) => m.id)).not.toContain(thirdPlayerId);

    // Kicked member immediately gets 404
    const kickedDetail = await request(app)
      .get(`/api/v1/conversations/${groupId}`)
      .set(asUser(thirdPlayerId));
    expect(kickedDetail.status).toBe(404);

    // Dissolve group by Group Owner
    const dissolveRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/dissolve`)
      .set(asUser(ownerPlayerId));
    expect(dissolveRes.status).toBe(204);

    // Dissolved group returns 404 for all members, while row remains in DB with status='DISSOLVED'
    const afterDissolveDetail = await request(app)
      .get(`/api/v1/conversations/${groupId}`)
      .set(asUser(ownerPlayerId));
    expect(afterDissolveDetail.status).toBe(404);

    const [dbConv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, groupId));
    expect(dbConv?.status).toBe('DISSOLVED');
    expect(dbConv?.dissolvedAt).not.toBeNull();
  });

  it('supports quote-reply, message editing, sender & Group Owner recall (blocking media download while retaining DB evidence), and hide-for-me', async () => {
    const createRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(ownerPlayerId))
      .send({
        title: 'Nhóm Test Hành Động Tin Nhắn',
        memberIds: [memberPlayerId],
      });
    const groupId = createRes.body.data.id;

    // 1. Member sends a message with a text attachment file
    const payloadJson = JSON.stringify({
      text: 'Tài liệu lịch thi đấu ban đầu',
      clientMessageId: crypto.randomUUID(),
    });
    const msg1Res = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(memberPlayerId))
      .field('payload', payloadJson)
      .attach('file', Buffer.from('Lich thi dau cau long 2026', 'utf-8'), {
        filename: 'lich-thi-dau.txt',
        contentType: 'text/plain',
      });
    expect(msg1Res.status).toBe(201);
    const msg1Id = msg1Res.body.data.id;
    const mediaId = msg1Res.body.data.attachments[0].mediaId;

    // 2. Owner quote-replies to msg1
    const replyRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(ownerPlayerId))
      .send({
        text: 'Cảm ơn bạn, mình đã nhận lịch nhé!',
        parentId: msg1Id,
        clientMessageId: crypto.randomUUID(),
      });
    expect(replyRes.status).toBe(201);
    const replyMsgId = replyRes.body.data.id;
    expect(replyRes.body.data.parentId).toBe(msg1Id);
    expect(replyRes.body.data.parentMessage).toMatchObject({
      id: msg1Id,
      senderId: memberPlayerId,
      body: 'Tài liệu lịch thi đấu ban đầu',
      hasAttachments: true,
      isRecalled: false,
    });

    // 3. Member edits msg1 text (non-sender gets 403)
    const forbiddenEdit = await request(app)
      .put(`/api/v1/messages/${msg1Id}`)
      .set(asUser(ownerPlayerId))
      .send({ text: 'Chủ nhóm thử sửa tin của thành viên' });
    expect(forbiddenEdit.status).toBe(403);

    const editRes = await request(app)
      .put(`/api/v1/messages/${msg1Id}`)
      .set(asUser(memberPlayerId))
      .send({ text: 'Tài liệu lịch thi đấu (Đã cập nhật giờ)' });
    expect(editRes.status).toBe(200);
    expect(editRes.body.data.body).toBe('Tài liệu lịch thi đấu (Đã cập nhật giờ)');
    expect(editRes.body.data.editedAt).not.toBeNull();

    // 4. Group Owner recalls member's msg1 (admin moderation recall)
    const recallRes = await request(app)
      .delete(`/api/v1/messages/${msg1Id}`)
      .set(asUser(ownerPlayerId));
    expect(recallRes.status).toBe(200);
    expect(recallRes.body.data.deletedAt).not.toBeNull();
    expect(recallRes.body.data.deletedByUserId).toBe(ownerPlayerId);
    expect(recallRes.body.data.body).toBeNull();
    expect(recallRes.body.data.attachments).toEqual([]);

    // Media download for recalled message is immediately rejected with 404
    const mediaAfterRecall = await request(app)
      .get(`/api/v1/media/${mediaId}`)
      .set(asUser(ownerPlayerId));
    expect(mediaAfterRecall.status).toBe(404);

    // Underlying DB row still preserves original text for report evidence
    const [dbMsg1] = await db.select().from(messages).where(eq(messages.id, msg1Id));
    expect(dbMsg1?.body).toBe('Tài liệu lịch thi đấu (Đã cập nhật giờ)');
    expect(dbMsg1?.deletedAt).not.toBeNull();
    expect(dbMsg1?.deletedByUserId).toBe(ownerPlayerId);

    // 5. Member hides replyMsgId for themselves only
    const hideRes = await request(app)
      .post(`/api/v1/messages/${replyMsgId}/hide`)
      .set(asUser(memberPlayerId));
    expect(hideRes.status).toBe(204);

    const memberHistory = await request(app)
      .get(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(memberPlayerId));
    expect(memberHistory.status).toBe(200);
    expect(memberHistory.body.data.map((m: any) => m.id)).not.toContain(replyMsgId);

    // Owner still sees replyMsgId in their history
    const ownerHistory = await request(app)
      .get(`/api/v1/conversations/${groupId}/messages`)
      .set(asUser(ownerPlayerId));
    expect(ownerHistory.status).toBe(200);
    expect(ownerHistory.body.data.map((m: any) => m.id)).toContain(replyMsgId);
  });
});

