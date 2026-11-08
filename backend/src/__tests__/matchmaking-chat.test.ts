import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, conversations, conversationMembers, matchmakingRequestConversations } from '../db';
import { as, matchFindingPost, player, setConfig } from './social-fixture';
import { messagingConfig } from '../shared/config/messaging-config';
import { messagingService } from '../services/messaging/MessagingService';
import { recruitmentChatPort } from '../services/messaging/RecruitmentChatService';
import { matchmakingNotifications } from '../services/matchmaking/matchmaking-notifications';
import { matchmakingInvitations, messages } from '../db';
import { randomUUID } from 'crypto';
import http from 'http';
import { WebSocket } from 'ws';
import { app } from '../app';
import { messagingWsHub } from '../services/messaging/MessagingWsHub';

const chat = (actor: number, requestId: number) => as(actor, 'post', `/api/v1/matchmaking-requests/${requestId}/chat`);
const close = (actor: number, requestId: number) => as(actor, 'post', `/api/v1/matchmaking-requests/${requestId}/close`);

async function fixture(sealed = true, viaInvite = false) {
  const host = await player('Host');
  const member = await player('Member');
  const outsider = await player('Outsider');
  const { requestId } = await matchFindingPost(host, { matchType: 'SINGLES' }, true);
  const applied = viaInvite
    ? await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: member })
    : await as(member, 'post', `/api/v1/matchmaking-requests/${requestId}/applications`).send({});
  expect(applied.status, JSON.stringify(applied.body)).toBe(201);
  const approved = viaInvite
    ? await as(member, 'put', `/api/v1/matchmaking-invitations/${applied.body.data.id}`).send({ decision: 'ACCEPTED' })
    : await as(host, 'put', `/api/v1/matchmaking-applications/${applied.body.data.id}`).send({ decision: 'ACCEPTED' });
  expect(approved.status).toBe(200);
  if (sealed) expect((await close(host, requestId)).status).toBe(200);
  return { host, member, outsider, requestId };
}

beforeEach(async () => {
  await setConfig('MESSAGING_ENABLED', 'true');
  messagingConfig.clearCache();
  await setConfig('MATCHMAKING_ENABLED', 'true');
  await setConfig('SOCIAL_FEED_ENABLED', 'true');
});

describe('Chat from a confirmed recruitment', () => {
  it('revokes membership both when a GROUP reopens and when another member leaves the reopened roster', async () => {
    const host = await player(); const first = await player(); const second = await player();
    const { requestId } = await matchFindingPost(host, { matchType: 'GROUP', capacity: 4, minPlayers: 2 }, true);
    for (const member of [first, second]) {
      const invite = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: member });
      expect((await as(member, 'put', `/api/v1/matchmaking-invitations/${invite.body.data.id}`).send({ decision: 'ACCEPTED' })).status).toBe(200);
    }
    expect((await close(host, requestId)).status).toBe(200);
    const id = (await chat(host, requestId)).body.data.conversationId;
    expect((await as(first, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`)).status).toBe(200);
    expect((await as(host, 'get', `/api/v1/matchmaking-requests/${requestId}`)).body.data.status).toBe('OPEN');
    expect((await as(second, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`)).status).toBe(200);
    for (const member of [first, second]) expect((await as(member, 'get', `/api/v1/conversations/${id}`)).status).toBe(404);
    expect((await as(host, 'get', `/api/v1/conversations/${id}`)).status).toBe(200);
  });

  it('excludes a removed member from in-flight and future WebSocket fanout while other chats still work', async () => {
    const { host, member, requestId } = await fixture();
    const id = (await chat(host, requestId)).body.data.conversationId;
    const independent = await messagingService.createGroupConversation(host, 'Independent', [member]);
    const server = http.createServer(app);
    messagingWsHub.attach(server);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/ws/messaging`, { headers: { 'x-user-id': String(member) } });
    const frames: { data: { marker?: string } }[] = [];
    ws.on('message', raw => frames.push(JSON.parse(raw.toString())));
    const hub = messagingWsHub as unknown as { validateConnection: (...args: unknown[]) => Promise<boolean> };
    const original = hub.validateConnection.bind(hub);
    let release!: () => void; let reached!: () => void;
    const paused = new Promise<void>(resolve => { reached = resolve; });
    const resume = new Promise<void>(resolve => { release = resolve; });
    let spy: ReturnType<typeof vi.spyOn> | undefined;
    let inFlight: Promise<void> | undefined;
    try {
      await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
      spy = vi.spyOn(hub, 'validateConnection').mockImplementationOnce(async (...args) => {
        reached(); await resume; return original(...args);
      });
      inFlight = messagingWsHub.broadcastConversationEvent(id, 'message.created', { marker: 'stale' }, host);
      await paused;
      expect((await as(host, 'delete', `/api/v1/matchmaking-requests/${requestId}/members/${member}`)).status).toBe(200);
      release(); await inFlight;
      await messagingWsHub.broadcastConversationEvent(id, 'message.created', { marker: 'future' }, host);
      const received = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Independent chat event was not delivered')), 3000);
        ws.on('message', raw => { if (JSON.parse(raw.toString()).data.marker === 'independent') { clearTimeout(timer); resolve(); } });
      });
      await messagingWsHub.broadcastConversationEvent(independent.id, 'message.created', { marker: 'independent' }, host);
      await received;
      expect(frames.some(frame => ['stale', 'future'].includes(frame.data.marker ?? ''))).toBe(false);
    } finally {
      release(); await inFlight; spy?.mockRestore(); ws.terminate();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it.each(['withdraw', 'remove', 'invitation-alias', 'match-alias'])('revokes chat access on %s but preserves independent groups and history', async action => {
    const { host, member, requestId } = await fixture(true, action === 'invitation-alias');
    const id = (await chat(host, requestId)).body.data.conversationId;
    const independent = await messagingService.createGroupConversation(host, 'Independent', [member]);
    await messagingService.sendMessage(host, id, { clientMessageId: randomUUID(), text: 'Old message', images: [], files: [] });
    const detail = (await as(host, 'get', `/api/v1/matchmaking-requests/${requestId}`)).body.data;
    const [membership] = await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.requestId, requestId));
    // A cleanup must still work if Messaging is temporarily disabled.
    if (action === 'remove') { await setConfig('MESSAGING_ENABLED', 'false'); messagingConfig.clearCache(); }
    const response = action === 'remove'
      ? await as(host, 'delete', `/api/v1/matchmaking-requests/${requestId}/members/${member}`)
      : action === 'match-alias' ? await as(member, 'post', `/api/v1/matches/${detail.matchId}/leave`)
      : action === 'invitation-alias' ? await as(member, 'post', `/api/v1/matchmaking-invitations/${membership.id}/withdraw`)
      : await as(member, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`);
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    await setConfig('MESSAGING_ENABLED', 'true'); messagingConfig.clearCache();
    expect((await as(member, 'get', `/api/v1/conversations/${id}`)).status).toBe(404);
    expect((await as(member, 'get', `/api/v1/conversations/${id}/messages`)).status).toBe(404);
    await expect(messagingService.sendMessage(member, id, { clientMessageId: randomUUID(), text: 'Forbidden', images: [], files: [] }))
      .rejects.toMatchObject({ code: 'MESSAGING_CONVERSATION_NOT_FOUND' });
    expect((await as(member, 'get', `/api/v1/conversations/${independent.id}`)).status).toBe(200);
    expect(await db.select().from(messages).where(eq(messages.conversationId, id))).toHaveLength(1);
  });

  it('rolls back roster and chat revocation together without publishing a removal', async () => {
    const { host, member, requestId } = await fixture();
    const id = (await chat(host, requestId)).body.data.conversationId;
    const publish = vi.spyOn(recruitmentChatPort, 'publishRemoval');
    const notify = vi.spyOn(matchmakingNotifications, 'memberRemoved').mockRejectedValueOnce(new Error('Rollback'));
    try {
      expect((await as(host, 'delete', `/api/v1/matchmaking-requests/${requestId}/members/${member}`)).status).toBe(500);
      expect((await as(member, 'get', `/api/v1/conversations/${id}`)).status).toBe(200);
      const [membership] = await db.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.requestId, requestId));
      expect(membership.status).toBe('ACCEPTED');
      expect(publish).not.toHaveBeenCalled();
    } finally { notify.mockRestore(); publish.mockRestore(); }
  });

  it('creates one group with the confirmed roster and reuses it on concurrent requests', async () => {
    const { host, member, outsider, requestId } = await fixture();
    const results = await Promise.all([chat(host, requestId), chat(host, requestId)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 201]);
    const id = results[0].body.data.conversationId;
    expect(results[1].body.data.conversationId).toBe(id);
    const rows = await db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, id));
    expect(rows.map(row => row.userId).sort()).toEqual([host, member].sort());
    expect(rows.every(row => row.state === 'ACTIVE')).toBe(true);
    const [group] = await db.select().from(conversations).where(eq(conversations.id, id));
    expect(group).toMatchObject({ type: 'GROUP', createdBy: host });
    expect((await as(host, 'get', `/api/v1/matchmaking-requests/${requestId}`)).body.data.conversationId).toBe(id);
    expect((await as(member, 'get', `/api/v1/conversations/${id}`)).status).toBe(200);
    expect((await as(outsider, 'get', `/api/v1/conversations/${id}`)).status).toBe(404);
  });

  it('requires host permission and a sealed roster even when all seats are filled', async () => {
    const { host, member, outsider, requestId } = await fixture(false);
    expect((await chat(member, requestId)).status).toBe(404);
    expect((await chat(outsider, requestId)).status).toBe(404);
    const result = await chat(host, requestId);
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('MATCHMAKING_CHAT_NOT_READY');
    expect(await db.select().from(conversations)).toHaveLength(0);
  });

  it('includes companions only through registered members, not pending or withdrawn players', async () => {
    const host = await player(); const member = await player(); const withdrawn = await player(); const pending = await player();
    const { requestId } = await matchFindingPost(host, { matchType: 'GROUP', capacity: 6, minPlayers: 3, companionCount: 1 }, true);
    for (const target of [member, withdrawn, pending]) {
      const invited = await as(host, 'post', `/api/v1/matchmaking-requests/${requestId}/invitations`).send({ inviteeId: target });
      expect(invited.status).toBe(201);
      if (target !== pending) expect((await as(target, 'put', `/api/v1/matchmaking-invitations/${invited.body.data.id}`).send({ decision: 'ACCEPTED' })).status).toBe(200);
    }
    expect((await as(withdrawn, 'post', `/api/v1/matchmaking-requests/${requestId}/withdraw`)).status).toBe(200);
    expect((await close(host, requestId)).status).toBe(200);
    const result = await chat(host, requestId);
    expect(result.status, JSON.stringify(result.body)).toBe(201);
    const members = await db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, result.body.data.conversationId));
    expect(members.map(row => row.userId).sort()).toEqual([host, member].sort());
  });

  it('honors the Messaging gate and rolls back without saving a chat link', async () => {
    const { host, requestId } = await fixture();
    await setConfig('MESSAGING_ENABLED', 'false');
    messagingConfig.clearCache();
    expect((await chat(host, requestId)).status).toBe(409);
    expect(await db.select().from(matchmakingRequestConversations)).toHaveLength(0);
    expect(await db.select().from(conversations)).toHaveLength(0);
  });

  it('rolls back group creation if transaction persistence fails', async () => {
    const { host, requestId } = await fixture();
    const original = messagingService.createGroupConversationInTransaction.bind(messagingService);
    const spy = vi.spyOn(messagingService, 'createGroupConversationInTransaction').mockImplementationOnce(async (...args) => {
      await original(...args);
      throw new Error('Simulated failure after creating group');
    });
    try { expect((await chat(host, requestId)).status).toBe(500); } finally { spy.mockRestore(); }
    expect(await db.select().from(matchmakingRequestConversations)).toHaveLength(0);
    expect(await db.select().from(conversations)).toHaveLength(0);
    expect((await chat(host, requestId)).status).toBe(201);
  });

  it('does not create another chat after the linked group is dissolved', async () => {
    const { host, requestId } = await fixture();
    const result = await chat(host, requestId);
    const id = result.body.data.conversationId;
    expect((await as(host, 'post', `/api/v1/conversations/${id}/dissolve`)).status).toBe(204);
    expect((await chat(host, requestId)).body.error.code).toBe('MATCHMAKING_CHAT_UNAVAILABLE');
    expect(await db.select().from(conversations)).toHaveLength(1);
  });
});
