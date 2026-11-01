import http from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import app from '../app';
import {
  db,
  users,
  playerProfiles,
  skillLevels,
  systemConfigs,
  authSessions,
} from '../db';
import { authRepository } from '../repositories/auth/AuthRepository';
import { authService } from '../services/auth/AuthService';
import { adminUserService } from '../services/admin/AdminUserService';
import { messagingConfig } from '../shared/config/messaging-config';
import { messagingRepository } from '../repositories/messaging/MessagingRepository';
import { messagingWsHub, type MessagingWsEnvelope } from '../services/messaging/MessagingWsHub';

const CSRF = 'test-csrf-token';

function asUser(userId: number) {
  return {
    'x-user-id': String(userId),
    Cookie: `csrf_token=${CSRF}`,
    'X-CSRF-Token': CSRF,
  };
}

function connectWs(
  port: number,
  options: { sid?: string; userId?: number } = {}
): Promise<{
  ws: WebSocket;
  messages: MessagingWsEnvelope[];
  waitForClose: () => Promise<{ code: number; reason: string }>;
  waitForMessage: (predicate?: (msg: MessagingWsEnvelope) => boolean, timeoutMs?: number) => Promise<MessagingWsEnvelope>;
}> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {};
    if (options.sid) {
      headers.Cookie = `sid=${options.sid}`;
    } else if (options.userId) {
      headers['x-user-id'] = String(options.userId);
    }

    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/ws/messaging`, { headers });
    const messages: MessagingWsEnvelope[] = [];
    const messageListeners = new Set<(msg: MessagingWsEnvelope) => void>();
    let closeInfo: { code: number; reason: string } | null = null;
    const closeListeners = new Set<(info: { code: number; reason: string }) => void>();

    ws.on('message', (raw) => {
      const parsed = JSON.parse(raw.toString()) as MessagingWsEnvelope;
      messages.push(parsed);
      for (const listener of Array.from(messageListeners)) {
        listener(parsed);
      }
    });

    ws.on('close', (code, reason) => {
      closeInfo = { code, reason: reason.toString() };
      for (const listener of Array.from(closeListeners)) {
        listener(closeInfo);
      }
    });

    const waitForClose = () =>
      new Promise<{ code: number; reason: string }>((resClose, rejClose) => {
        if (closeInfo) {
          return resClose(closeInfo);
        }
        const timer = setTimeout(() => rejClose(new Error('Timeout waiting for WS close')), 3000);
        closeListeners.add((info) => {
          clearTimeout(timer);
          resClose(info);
        });
      });

    const waitForMessage = (
      predicate: (msg: MessagingWsEnvelope) => boolean = () => true,
      timeoutMs = 3000
    ) =>
      new Promise<MessagingWsEnvelope>((resMsg, rejMsg) => {
        const existing = messages.find(predicate);
        if (existing) {
          return resMsg(existing);
        }
        const timer = setTimeout(() => rejMsg(new Error('Timeout waiting for WS message')), timeoutMs);
        const handler = (msg: MessagingWsEnvelope) => {
          if (predicate(msg)) {
            clearTimeout(timer);
            messageListeners.delete(handler);
            resMsg(msg);
          }
        };
        messageListeners.add(handler);
      });

    ws.once('open', () => {
      resolve({ ws, messages, waitForClose, waitForMessage });
    });

    ws.once('unexpected-response', (_req, res) => {
      ws.terminate();
      reject(new Error(`Unexpected HTTP ${res.statusCode}`));
    });

    ws.once('error', (err) => {
      reject(err);
    });
  });
}

describe('Messaging WebSocket hub, session revocation, presence & typing (MSG-03, MSG-07)', () => {
  let server: http.Server;
  let port: number;
  let p1Id: number;
  let p2Id: number;
  let p3Id: number;
  let ownerId: number;
  let adminId: number;
  const openSockets: WebSocket[] = [];

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
    const inserted = await db
      .insert(users)
      .values([
        { email: 'ws1@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'ws2@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'ws3@msg.test', passwordHash: 'h', role: 'PLAYER', status: 'ACTIVE' },
        { email: 'wsowner@msg.test', passwordHash: 'h', role: 'COURT_OWNER', status: 'ACTIVE' },
        { email: 'wsadmin@msg.test', passwordHash: 'h', role: 'ADMIN', status: 'ACTIVE' },
      ])
      .returning();

    p1Id = inserted[0].id;
    p2Id = inserted[1].id;
    p3Id = inserted[2].id;
    ownerId = inserted[3].id;
    adminId = inserted[4].id;

    await db.insert(playerProfiles).values([
      { userId: p1Id, fullName: 'Player WS 1', skillLevelId: skill.id },
      { userId: p2Id, fullName: 'Player WS 2', skillLevelId: skill.id },
      { userId: p3Id, fullName: 'Player WS 3', skillLevelId: skill.id },
    ]);

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

  afterEach(async () => {
    for (const s of openSockets.splice(0)) {
      try {
        s.terminate();
      } catch {
        // ignore
      }
    }
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('rejects unauthenticated, non-Player, and disabled-gate WebSocket upgrades', async () => {
    // 1. Unauthenticated -> HTTP 401
    await expect(connectWs(port)).rejects.toThrow('Unexpected HTTP 401');

    // 2. Non-Player (COURT_OWNER) -> HTTP 403
    const ownerSession = await authRepository.createSession(ownerId, 'COURT_OWNER');
    await expect(connectWs(port, { sid: ownerSession.rawToken })).rejects.toThrow(
      'Unexpected HTTP 403'
    );

    // 3. MESSAGING_ENABLED = false -> HTTP 409
    await db
      .insert(systemConfigs)
      .values({ configKey: 'MESSAGING_ENABLED', configValue: 'false' })
      .onConflictDoUpdate({
        target: systemConfigs.configKey,
        set: { configValue: 'false' },
      });
    messagingConfig.clearCache();

    const p1Session = await authRepository.createSession(p1Id, 'PLAYER');
    await expect(connectWs(port, { sid: p1Session.rawToken })).rejects.toThrow(
      'Unexpected HTTP 409'
    );
  });

  it('immediately closes open WebSocket with 1008 on sign-out, session expiry, or Admin suspension', async () => {
    // 1. Sign-out revokes session and closes socket immediately
    const s1 = await authRepository.createSession(p1Id, 'PLAYER');
    const c1 = await connectWs(port, { sid: s1.rawToken });
    openSockets.push(c1.ws);

    const closePromise1 = c1.waitForClose();
    await authService.logout(s1.rawToken);
    const closed1 = await closePromise1;
    expect(closed1.code).toBe(1008);

    // 2. Session expiry closes socket on heartbeat/push re-validation and prevents event delivery
    const s2 = await authRepository.createSession(p2Id, 'PLAYER');
    const c2 = await connectWs(port, { sid: s2.rawToken });
    openSockets.push(c2.ws);

    await db
      .update(authSessions)
      .set({ expiresAt: new Date(Date.now() - 10_000) })
      .where(eq(authSessions.id, s2.session.id));

    const closePromise2 = c2.waitForClose();
    await messagingWsHub.runHeartbeatCheck();
    const closed2 = await closePromise2;
    expect(closed2.code).toBe(1008);

    // 3. Admin suspension closes socket immediately with 1008
    const s3 = await authRepository.createSession(p3Id, 'PLAYER');
    const c3 = await connectWs(port, { sid: s3.rawToken });
    openSockets.push(c3.ws);

    const closePromise3 = c3.waitForClose();
    await adminUserService.updateUserStatus(p3Id, 'SUSPENDED', adminId);
    const closed3 = await closePromise3;
    expect(closed3.code).toBe(1008);
  });

  it('delivers group events to blocked co-members while suppressing direct events and direct presence, and never delivers to LEFT members', async () => {
    const s1 = await authRepository.createSession(p1Id, 'PLAYER');
    const s2 = await authRepository.createSession(p2Id, 'PLAYER');
    const s3 = await authRepository.createSession(p3Id, 'PLAYER');

    const c1 = await connectWs(port, { sid: s1.rawToken });
    const c2 = await connectWs(port, { sid: s2.rawToken });
    const c3 = await connectWs(port, { sid: s3.rawToken });
    openSockets.push(c1.ws, c2.ws, c3.ws);

    // Create a group conversation with p1, p2, p3
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Group Block & Leave WS Test', memberIds: [p2Id, p3Id] });
    const groupId = groupRes.body.data.id;

    // p1 blocks p2 AFTER group creation
    await request(app).post('/api/v1/blocks').set(asUser(p1Id)).send({ playerId: p2Id });

    // p1 types in the GROUP conversation -> BOTH p2 (even though blocked!) and p3 receive typing.updated
    const p2GroupTyping = c2.waitForMessage((m) => m.type === 'typing.updated');
    const p3GroupTyping = c3.waitForMessage((m) => m.type === 'typing.updated');

    const typingRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/typing`)
      .set(asUser(p1Id));
    expect(typingRes.status).toBe(200);
    expect(typingRes.body.data.updated).toBe(true);

    const [ev2, ev3] = await Promise.all([p2GroupTyping, p3GroupTyping]);
    expect((ev2.data as any).conversationId).toBe(groupId);
    expect((ev3.data as any).conversationId).toBe(groupId);

    // p1 sends heartbeat -> p3 receives presence.updated, but p2 (blocked) does NOT!
    c2.messages.length = 0;
    c3.messages.length = 0;
    const p3Presence = c3.waitForMessage((m) => m.type === 'presence.updated');

    const hbRes = await request(app).post('/api/v1/presence/heartbeat').set(asUser(p1Id));
    expect(hbRes.status).toBe(200);
    expect(hbRes.body.data.updated).toBe(true);

    await p3Presence;
    expect(c2.messages.some((m) => m.type === 'presence.updated')).toBe(false);

    // p3 leaves the group -> p3 no longer receives subsequent group events
    await request(app).post(`/api/v1/conversations/${groupId}/leave`).set(asUser(p3Id));
    c2.messages.length = 0;
    c3.messages.length = 0;

    await messagingWsHub.broadcastConversationEvent(
      groupId,
      'message.created',
      { conversationId: groupId, seq: 1 },
      p1Id
    );

    const p2Msg = await c2.waitForMessage((m) => m.type === 'message.created');
    expect((p2Msg.data as any).seq).toBe(1);
    expect(c3.messages.some((m) => m.type === 'message.created')).toBe(false);
  });

  it('throttles heartbeat within 15s, throttles typing within 3s, and scopes presence visibility', async () => {
    const groupRes = await request(app)
      .post('/api/v1/conversations/group')
      .set(asUser(p1Id))
      .send({ title: 'Presence Scope Group', memberIds: [p2Id, p3Id] });
    const groupId = groupRes.body.data.id;

    // 1. Heartbeat throttle: first writes, second within 15s does not write
    const hb1 = await request(app).post('/api/v1/presence/heartbeat').set(asUser(p1Id));
    expect(hb1.status).toBe(200);
    expect(hb1.body.data.updated).toBe(true);

    const hb2 = await request(app).post('/api/v1/presence/heartbeat').set(asUser(p1Id));
    expect(hb2.status).toBe(200);
    expect(hb2.body.data.updated).toBe(false);

    // 2. Typing throttle: first writes, second within 3s does not write
    const typ1 = await request(app)
      .post(`/api/v1/conversations/${groupId}/typing`)
      .set(asUser(p1Id));
    expect(typ1.status).toBe(200);
    expect(typ1.body.data.updated).toBe(true);

    const typ2 = await request(app)
      .post(`/api/v1/conversations/${groupId}/typing`)
      .set(asUser(p1Id));
    expect(typ2.status).toBe(200);
    expect(typ2.body.data.updated).toBe(false);

    // 3. Visibility-scoped presence: p2 sees p1 online; after p1 blocks p2, p2 sees no presence for p1
    const snapBeforeBlock = await messagingRepository.getConversationPresenceAndTyping(
      p2Id,
      groupId,
      'GROUP',
      [p1Id, p2Id, p3Id]
    );
    expect(snapBeforeBlock.presence.some((p) => p.userId === p1Id && p.isOnline)).toBe(true);

    await request(app).post('/api/v1/blocks').set(asUser(p1Id)).send({ playerId: p2Id });
    const snapAfterBlock = await messagingRepository.getConversationPresenceAndTyping(
      p2Id,
      groupId,
      'GROUP',
      [p1Id, p2Id, p3Id]
    );
    expect(snapAfterBlock.presence.some((p) => p.userId === p1Id)).toBe(false);

    // 4. LEFT member neither sees nor exposes presence through that group
    await request(app).post(`/api/v1/conversations/${groupId}/leave`).set(asUser(p3Id));
    const leaveTypingRes = await request(app)
      .post(`/api/v1/conversations/${groupId}/typing`)
      .set(asUser(p3Id));
    expect(leaveTypingRes.status).toBe(404);
  });
});
