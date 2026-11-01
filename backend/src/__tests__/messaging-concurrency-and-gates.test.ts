import http from 'http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import sharp from 'sharp';
import { eq } from 'drizzle-orm';
import app from '../app';
import {
  db,
  users,
  playerProfiles,
  skillLevels,
  systemConfigs,
  messages,
} from '../db';
import { messagingConfig } from '../shared/config/messaging-config';
import { messagingWsHub } from '../services/messaging/MessagingWsHub';

const CSRF = 'stage6-csrf-token';

function asUser(userId: number) {
  return {
    'x-user-id': String(userId),
    Cookie: `csrf_token=${CSRF}`,
    'X-CSRF-Token': CSRF,
  };
}

async function setConfig(configKey: string, configValue: string) {
  await db
    .insert(systemConfigs)
    .values({ configKey, configValue })
    .onConflictDoUpdate({
      target: systemConfigs.configKey,
      set: { configValue },
    });
  messagingConfig.clearCache();
}

describe('Messaging Concurrency, Access-Loss & Gate Verification (MSG-10 / §20)', () => {
  let server: http.Server;
  let port: number;
  let skillId: number;

  beforeAll(async () => {
    process.env.ALLOW_TEST_AUTH = 'true';
    server = http.createServer(app);
    messagingWsHub.attach(server);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await setConfig('MESSAGING_ENABLED', 'true');
    await setConfig('MESSAGING_MESSAGES_PER_MINUTE', '30');
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(async () => {
    process.env.ALLOW_TEST_AUTH = 'true';
    await setConfig('MESSAGING_ENABLED', 'true');
    await setConfig('MESSAGING_MESSAGES_PER_MINUTE', '30');

    const [skill] = await db.select().from(skillLevels).limit(1);
    if (skill) {
      skillId = skill.id;
    } else {
      const [s] = await db
        .insert(skillLevels)
        .values({ code: 'AVERAGE', name: 'Trung bình', rank: 3 })
        .returning({ id: skillLevels.id });
      skillId = s.id;
    }
  });

  async function createPlayer(name: string): Promise<number> {
    const [u] = await db
      .insert(users)
      .values({
        email: `msg10-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`,
        passwordHash: 'hash',
        role: 'PLAYER',
        status: 'ACTIVE',
      })
      .returning({ id: users.id });
    await db.insert(playerProfiles).values({
      userId: u.id,
      fullName: name,
      skillLevelId: skillId,
    });
    return u.id;
  }

  it('handles 10 concurrent identical clientMessageId retries with a single stored message and prevents replay after leaving a group (LEFT)', async () => {
    const p1Id = await createPlayer('Player Retry 1');
    const p2Id = await createPlayer('Player Retry 2');

    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Idempotency Group', memberIds: [p2Id] });
    expect(groupRes.status).toBe(201);
    const convId = groupRes.body.data.id;

    const sharedClientId = '88888888-8888-4888-8888-888888888888';

    // 10 concurrent retries with identical clientMessageId and content
    const retryResults = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app)
          .post(`/api/v1/conversations/${convId}/messages`)
          .set(asUser(p2Id))
          .send({
            clientMessageId: sharedClientId,
            text: 'Idempotent parallel send',
          }),
      ),
    );

    for (const res of retryResults) {
      expect([200, 201]).toContain(res.status);
      expect(res.body.data.seq).toBe(1);
    }

    const storedRows = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId));
    expect(storedRows).toHaveLength(1);
    expect(storedRows[0].body).toBe('Idempotent parallel send');

    // Now p2 leaves the group (LEFT) and attempts to replay the same clientMessageId
    const leaveRes = await request(app)
      .post(`/api/v1/conversations/${convId}/leave`)
      .set(asUser(p2Id));
    expect(leaveRes.status).toBe(204);

    const replayAfterLeave = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set(asUser(p2Id))
      .send({
        clientMessageId: sharedClientId,
        text: 'Idempotent parallel send',
      });
    expect(replayAfterLeave.status).toBe(404);
    expect(replayAfterLeave.body.error.code).toBe('MESSAGING_CONVERSATION_NOT_FOUND');
  });

  it('revokes conversation, history, and media attachment access immediately upon leaving a group (LEFT) until re-added', async () => {
    const p1Id = await createPlayer('Player Media 1');
    const p2Id = await createPlayer('Player Media 2');

    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Attachment Access Group', memberIds: [p2Id] });
    const convId = groupRes.body.data.id;

    const pngBuf = await sharp({
      create: {
        width: 48,
        height: 48,
        channels: 3,
        background: { r: 20, g: 160, b: 90 },
      },
    })
      .png()
      .toBuffer();

    const sendRes = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set(asUser(p1Id))
      .field(
        'payload',
        JSON.stringify({
          clientMessageId: '99999999-9999-4999-8999-999999999991',
          text: 'Group attachment',
        }),
      )
      .attach('images', pngBuf, { filename: 'court.png', contentType: 'image/png' });
    expect(sendRes.status).toBe(201);
    const mediaId = sendRes.body.data.attachments[0].mediaId;

    // While ACTIVE, p2 can download the attachment
    const beforeLeaveDl = await request(app)
      .get(`/api/v1/media/${mediaId}`)
      .set(asUser(p2Id));
    expect(beforeLeaveDl.status).toBe(200);

    // p2 leaves the group (LEFT)
    const leaveRes = await request(app)
      .post(`/api/v1/conversations/${convId}/leave`)
      .set(asUser(p2Id));
    expect(leaveRes.status).toBe(204);

    // Access to conversation detail, message history, and previously visible attachment must all return 404
    const detailAfterLeave = await request(app)
      .get(`/api/v1/conversations/${convId}`)
      .set(asUser(p2Id));
    expect(detailAfterLeave.status).toBe(404);

    const historyAfterLeave = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set(asUser(p2Id));
    expect(historyAfterLeave.status).toBe(404);

    const mediaAfterLeave = await request(app)
      .get(`/api/v1/media/${mediaId}`)
      .set(asUser(p2Id));
    expect(mediaAfterLeave.status).toBe(404);

    // p1 re-adds p2 -> access is restored
    const reAddRes = await request(app)
      .post(`/api/v1/conversations/${convId}/members`)
      .set(asUser(p1Id))
      .send({ memberIds: [p2Id] });
    expect(reAddRes.status).toBe(200);

    const mediaAfterReAdd = await request(app)
      .get(`/api/v1/media/${mediaId}`)
      .set(asUser(p2Id));
    expect(mediaAfterReAdd.status).toBe(200);
  });

  it('paginates >100 queued messages in sync with hasMore=true while preserving reaction changes via sinceVersion and conversation-first lock ordering', async () => {
    const p1Id = await createPlayer('Player Sync 1');
    const p2Id = await createPlayer('Player Sync 2');
    const p3Id = await createPlayer('Player Sync 3');
    const p4Id = await createPlayer('Player Sync 4');

    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Backlog Sync Group', memberIds: [p2Id, p3Id, p4Id] });
    expect(groupRes.status).toBe(201);
    const convId = groupRes.body.data.id;

    // 4 members x 27 messages = 108 messages (each member sends 27 <= 30/min limit)
    const senders = [p1Id, p2Id, p3Id, p4Id];
    const messageIds: number[] = [];
    for (let round = 0; round < 27; round++) {
      const batchRes = await Promise.all(
        senders.map((senderId, idx) => {
          const n = round * 4 + idx + 1;
          const hex = n.toString(16).padStart(12, '0');
          return request(app)
            .post(`/api/v1/conversations/${convId}/messages`)
            .set(asUser(senderId))
            .send({
              clientMessageId: `77777777-7777-4777-8777-${hex}`,
              text: `Backlog msg #${n}`,
            });
        }),
      );
      for (const r of batchRes) {
        expect(r.status).toBe(201);
        messageIds.push(r.body.data.id);
      }
    }

    // Perform concurrent reactions + read marker updates to exercise conversation-first lock order
    const targetMsgId1 = messageIds[0];
    const targetMsgId50 = messageIds[49];
    const concurrentOps = await Promise.all([
      request(app)
        .put(`/api/v1/messages/${targetMsgId1}/reaction`)
        .set(asUser(p1Id))
        .send({ type: 'LIKE' }),
      request(app)
        .put(`/api/v1/messages/${targetMsgId50}/reaction`)
        .set(asUser(p2Id))
        .send({ type: 'LOVE' }),
      request(app)
        .post(`/api/v1/conversations/${convId}/read`)
        .set(asUser(p1Id))
        .send({ seq: 40 }),
    ]);
    expect(concurrentOps[0].status).toBe(200);
    expect(concurrentOps[1].status).toBe(200);
    expect(concurrentOps[2].status).toBe(200);

    // First sync page from afterSeq=0, sinceVersion=0 -> returns 100 messages and hasMore=true
    const page1 = await request(app)
      .get(`/api/v1/conversations/${convId}/sync?afterSeq=0&sinceVersion=0&minLoadedSeq=1`)
      .set(asUser(p1Id));
    expect(page1.status).toBe(200);
    expect(page1.body.data.messages).toHaveLength(100);
    expect(page1.body.data.hasMore).toBe(true);
    expect(page1.body.data.nextAfterSeq).toBe(100);

    // Follow-up sync page preserving sinceVersion=0 until hasMore=false
    const page2 = await request(app)
      .get(
        `/api/v1/conversations/${convId}/sync?afterSeq=${page1.body.data.nextAfterSeq}&sinceVersion=0&minLoadedSeq=1`,
      )
      .set(asUser(p1Id));
    expect(page2.status).toBe(200);
    expect(page2.body.data.messages).toHaveLength(8);
    expect(page2.body.data.hasMore).toBe(false);
    expect(page2.body.data.nextAfterSeq).toBe(108);

    const allSeqs = [
      ...page1.body.data.messages.map((m: { seq: number }) => m.seq),
      ...page2.body.data.messages.map((m: { seq: number }) => m.seq),
    ];
    expect(allSeqs).toEqual(Array.from({ length: 108 }, (_, i) => i + 1));

    // Verify changedReactions contains both reacted messages
    const changedIds = page2.body.data.changedReactions.map((r: { messageId: number }) => r.messageId);
    expect(changedIds).toContain(targetMsgId1);
    expect(changedIds).toContain(targetMsgId50);
  });

  it('enforces MESSAGING_ENABLED=false gate end-to-end: allows reads and mark-read while rejecting sends, conversation creation, reactions, typing, heartbeat, and WS', async () => {
    const p1Id = await createPlayer('Player Gate 1');
    const p2Id = await createPlayer('Player Gate 2');
    const p3Id = await createPlayer('Player Gate 3');

    // Create a conversation and send 1 message while MESSAGING_ENABLED=true
    const directRes = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p1Id))
      .send({ playerId: p2Id });
    expect(directRes.status).toBe(201);
    const convId = directRes.body.data.id;

    const msgRes = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set(asUser(p1Id))
      .send({
        clientMessageId: '66666666-6666-4666-8666-666666666661',
        text: 'Message before gate disabled',
      });
    expect(msgRes.status).toBe(201);
    const msgId = msgRes.body.data.id;

    // Flip MESSAGING_ENABLED = false
    await setConfig('MESSAGING_ENABLED', 'false');

    // Allowed when disabled: list conversations, detail, history, sync, mark read
    const listRes = await request(app).get('/api/v1/conversations').set(asUser(p2Id));
    expect(listRes.status).toBe(200);

    const historyRes = await request(app)
      .get(`/api/v1/conversations/${convId}/messages`)
      .set(asUser(p2Id));
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data).toHaveLength(1);

    const readRes = await request(app)
      .post(`/api/v1/conversations/${convId}/read`)
      .set(asUser(p2Id))
      .send({ seq: 1 });
    expect(readRes.status).toBe(200);
    expect(readRes.body.data.lastReadSeq).toBe(1);

    // Rejected when disabled (409 MESSAGING_DISABLED):
    const newDirectRes = await request(app)
      .post('/api/v1/conversations/direct')
      .set(asUser(p1Id))
      .send({ playerId: p3Id });
    expect(newDirectRes.status).toBe(409);
    expect(newDirectRes.body.error.code).toBe('MESSAGING_DISABLED');

    const newGroupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Blocked Group', memberIds: [p2Id] });
    expect(newGroupRes.status).toBe(409);
    expect(newGroupRes.body.error.code).toBe('MESSAGING_DISABLED');

    const sendDisabled = await request(app)
      .post(`/api/v1/conversations/${convId}/messages`)
      .set(asUser(p1Id))
      .send({
        clientMessageId: '66666666-6666-4666-8666-666666666662',
        text: 'Blocked send',
      });
    expect(sendDisabled.status).toBe(409);
    expect(sendDisabled.body.error.code).toBe('MESSAGING_DISABLED');

    const reactDisabled = await request(app)
      .put(`/api/v1/messages/${msgId}/reaction`)
      .set(asUser(p2Id))
      .send({ type: 'LOVE' });
    expect(reactDisabled.status).toBe(409);
    expect(reactDisabled.body.error.code).toBe('MESSAGING_DISABLED');

    const typingDisabled = await request(app)
      .post(`/api/v1/conversations/${convId}/typing`)
      .set(asUser(p1Id))
      .send({ isTyping: true });
    expect(typingDisabled.status).toBe(409);

    const hbDisabled = await request(app)
      .post('/api/v1/presence/heartbeat')
      .set(asUser(p1Id))
      .send({});
    expect(hbDisabled.status).toBe(409);

    // WebSocket upgrade when disabled is rejected with HTTP 409
    const wsStatus = await new Promise<number>((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/ws/messaging`, {
        headers: { 'x-user-id': String(p1Id) },
      });
      ws.once('unexpected-response', (_req, res) => {
        ws.terminate();
        resolve(res.statusCode ?? 0);
      });
      ws.once('error', (err) => reject(err));
    });
    expect(wsStatus).toBe(409);
  });
});
