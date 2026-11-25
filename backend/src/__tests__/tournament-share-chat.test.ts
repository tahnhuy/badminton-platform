import crypto from 'crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db, systemConfigs } from '../db';
import { conversationMembers, conversations, userBlocks } from '../db/schema/messaging';
import { tournaments } from '../db/schema/tournaments';
import { messagingConfig } from '../shared/config/messaging-config';
import { socialConfig } from '../shared/config/social-config';
import { tournamentChatService } from '../services/tournaments/TournamentChatService';
import { api, complete, DAY, drawSingles, makePlayer, openTournament, playAll, versionOf } from './tournament-test-kit';

// TRN-16 — profile history, Social result post, tournament group chat.

const CSRF = 'test-csrf-token';
const asUser = (userId: number) => ({ 'x-user-id': String(userId), Cookie: `csrf_token=${CSRF}`, 'X-CSRF-Token': CSRF });
const send = (userId: number, conversationId: number, text = 'Chào cả nhóm') => request(app).post(`/api/v1/conversations/${conversationId}/messages`)
  .set(asUser(userId)).send({ text, clientMessageId: crypto.randomUUID() });

beforeEach(async () => {
  await db.insert(systemConfigs).values({ configKey: 'MESSAGING_ENABLED', configValue: 'true' })
    .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'true' } });
  messagingConfig.clearCache();
});

/** 4-player tournament completed with the lowest registration id winning every match. */
async function completedFour() {
  const organizer = await makePlayer();
  const players = [await makePlayer(), await makePlayer(), await makePlayer(), await makePlayer()];
  const id = await openTournament(organizer);
  const regs = await drawSingles(organizer, id, players);
  await playAll(organizer, id);
  await complete(organizer, id);
  return { organizer, players, id, regs };
}

describe('Profile history and placements', () => {
  it('lists completed tournaments with the placement of each player', async () => {
    const { players, id, regs } = await completedFour();
    const byReg = [...regs.entries()].sort((a, b) => a[1] - b[1]).map(([player]) => player);
    const champion = byReg[0];
    const res = await api(players[1]).get(`/api/v1/players/${champion}/tournaments`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data[0]).toMatchObject({ tournament: { id }, placement: 'CHAMPION', partner: null });
    const placements = await Promise.all(byReg.map(async p => (await api(p).get(`/api/v1/players/${p}/tournaments`)).body.data[0].placement));
    expect(placements.sort()).toEqual(['CHAMPION', 'RUNNER_UP', 'SEMI_FINAL', 'SEMI_FINAL']);
  });
});

describe('Social result post', () => {
  it('lets only the Organizer and the top 4 share once, shows a derived card and accepts reactions', async () => {
    const { organizer, players, id } = await completedFour();
    const outsider = await makePlayer();
    expect((await api(outsider).post(`/api/v1/tournaments/${id}/share`)).body.error.code).toBe('TOURNAMENT_SHARE_NOT_ALLOWED');

    const detail = await api(players[0]).get(`/api/v1/tournaments/${id}`);
    expect(detail.body.data.viewer).toMatchObject({ canShare: true, sharedPostId: null });

    const shared = await api(players[0]).post(`/api/v1/tournaments/${id}/share`, { body: 'Một giải thật vui!' });
    expect(shared.status, JSON.stringify(shared.body)).toBe(201);
    expect((await api(players[0]).post(`/api/v1/tournaments/${id}/share`)).body.error.code).toBe('TOURNAMENT_ALREADY_SHARED');
    expect((await api(players[0]).get(`/api/v1/tournaments/${id}`)).body.data.viewer).toMatchObject({ canShare: false, sharedPostId: shared.body.data.postId });
    expect((await api(organizer).post(`/api/v1/tournaments/${id}/share`)).status).toBe(201);

    const feed = await api(outsider).get('/api/v1/posts?limit=50');
    const card = feed.body.data.find((p: { id: number }) => p.id === shared.body.data.postId);
    expect(card).toMatchObject({ type: 'TOURNAMENT_RESULT', body: 'Một giải thật vui!', tournamentResult: { tournament: { id }, champion: expect.any(String), runnerUp: expect.any(String) } });
    expect(['CHAMPION', 'RUNNER_UP', 'SEMI_FINAL']).toContain(card.tournamentResult.authorPlacement);
    const organizerCard = feed.body.data.find((p: { author: { id: number }; type: string }) => p.author.id === organizer && p.type === 'TOURNAMENT_RESULT');
    expect(organizerCard.tournamentResult.authorPlacement).toBe('ORGANIZER');

    const reacted = await request(app).put(`/api/v1/posts/${shared.body.data.postId}/reaction`).set('x-user-id', String(outsider)).send({ type: 'LIKE' });
    expect(reacted.status, JSON.stringify(reacted.body)).toBe(200);

    // Deleting the post allows sharing again.
    const deleted = await api(players[0]).delete(`/api/v1/posts/${shared.body.data.postId}`);
    expect(deleted.status, JSON.stringify(deleted.body)).toBeLessThan(300);
    expect((await api(players[0]).post(`/api/v1/tournaments/${id}/share`)).status).toBe(201);
  });

  it('rejects sharing while the Social feed is disabled', async () => {
    const { players, id } = await completedFour();
    await db.insert(systemConfigs).values({ configKey: 'SOCIAL_FEED_ENABLED', configValue: 'false' })
      .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'false' } });
    socialConfig.clearCache();
    try {
      expect((await api(players[0]).post(`/api/v1/tournaments/${id}/share`)).body.error.code).toBe('SOCIAL_DISABLED');
    } finally {
      await db.update(systemConfigs).set({ configValue: 'true' }).where(eq(systemConfigs.configKey, 'SOCIAL_FEED_ENABLED'));
      socialConfig.clearCache();
    }
    expect((await api(players[0]).post(`/api/v1/tournaments/${id}/share`)).status).toBe(201);
  });

  it('rejects sharing before completion', async () => {
    const organizer = await makePlayer();
    const id = await openTournament(organizer);
    expect((await api(organizer).post(`/api/v1/tournaments/${id}/share`)).body.error.code).toBe('TOURNAMENT_SHARE_NOT_ALLOWED');
  });
});

describe('Tournament group chat', () => {
  it('drains more than one batch of stale chats without revisiting already locked groups', async () => {
    const organizer = await makePlayer();
    const id = await openTournament(organizer);
    const [template] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    const groups = await db.insert(conversations).values(Array.from({ length: 202 }, (_, i) => ({
      type: 'GROUP', systemKind: 'TOURNAMENT', createdBy: organizer, title: `Chat ${i}`, isLocked: i < 101,
    }))).returning({ id: conversations.id });
    await db.insert(tournaments).values(groups.map(group => ({
      ...template, id: undefined, status: 'COMPLETED', conversationId: group.id,
      completedAt: new Date(Date.now() - 31 * DAY),
    })));
    expect((await tournamentChatService.sweep()).locked).toBe(100);
    expect((await tournamentChatService.sweep()).locked).toBe(1);
    expect((await tournamentChatService.sweep()).locked).toBe(0);
    const remaining = await db.select().from(conversations).where(eq(conversations.isLocked, false));
    expect(remaining).toHaveLength(0);
  });

  it('creates a system chat at close with Organizer + participants minus blocked; users cannot manage it', async () => {
    const organizer = await makePlayer();
    const [a, b, blocked] = [await makePlayer(), await makePlayer(), await makePlayer()];
    await db.insert(userBlocks).values({ blockerId: blocked, blockedId: organizer });
    const id = await openTournament(organizer);
    for (const p of [a, b, blocked]) await api(p).post(`/api/v1/tournaments/${id}/registrations`);
    await api(organizer).post(`/api/v1/tournaments/${id}/close`, { version: await versionOf(id) });

    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(t.conversationId).not.toBeNull();
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, t.conversationId!));
    expect(conv).toMatchObject({ type: 'GROUP', systemKind: 'TOURNAMENT', title: 'Giải kiểm thử', createdBy: organizer });
    const members = await db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, conv.id));
    expect(members.map(m => m.userId).sort()).toEqual([organizer, a, b].sort());

    expect((await api(a).get(`/api/v1/tournaments/${id}`)).body.data.conversationId).toBe(conv.id);
    expect((await api(blocked).get(`/api/v1/tournaments/${id}`)).body.data.conversationId).toBeNull();
    expect((await send(a, conv.id)).status).toBe(201);

    const outsider = await makePlayer();
    const add = await request(app).post(`/api/v1/conversations/${conv.id}/members`).set(asUser(organizer)).send({ memberIds: [outsider] });
    expect(add.body.error.code).toBe('MESSAGING_SYSTEM_GROUP');
    const rename = await request(app).patch(`/api/v1/conversations/${conv.id}`).set(asUser(organizer)).send({ title: 'Đổi tên' });
    expect(rename.body.error.code).toBe('MESSAGING_SYSTEM_GROUP');
    const kick = await request(app).delete(`/api/v1/conversations/${conv.id}/members/${a}`).set(asUser(organizer));
    expect(kick.body.error.code).toBe('MESSAGING_SYSTEM_GROUP');
    const leave = await request(app).post(`/api/v1/conversations/${conv.id}/leave`).set(asUser(a));
    expect(leave.body.error.code).toBe('MESSAGING_SYSTEM_GROUP');
  });

  it('removes a removed participant and locks the chat for everyone on cancel', async () => {
    const organizer = await makePlayer();
    const [a, b, c] = [await makePlayer(), await makePlayer(), await makePlayer()];
    const id = await openTournament(organizer);
    const regs = new Map<number, number>();
    for (const p of [a, b, c]) regs.set(p, (await api(p).post(`/api/v1/tournaments/${id}/registrations`)).body.data.id);
    await api(organizer).post(`/api/v1/tournaments/${id}/close`, { version: await versionOf(id) });
    const conversationId = (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].conversationId!;

    await api(organizer).post(`/api/v1/tournaments/${id}/registrations/${regs.get(c)}/remove`, { reason: 'Không đủ điều kiện' });
    const members = await db.select().from(conversationMembers).where(eq(conversationMembers.conversationId, conversationId));
    expect(members.find(m => m.userId === c)!.state).toBe('LEFT');

    const sent = await send(a, conversationId);
    expect(sent.status, JSON.stringify(sent.body)).toBeLessThan(300);
    const messageId = sent.body.data.id;
    const recall = (userId: number) => request(app).delete(`/api/v1/messages/${messageId}`).set(asUser(userId));
    // The Organizer is not a moderator of the system group: no recalling others' messages.
    expect((await recall(organizer)).body.error.code).toBe('FORBIDDEN');

    await api(organizer).post(`/api/v1/tournaments/${id}/cancel`, { version: await versionOf(id) });
    // Locked = read-only for everyone, recall included.
    expect((await recall(a)).body.error.code).toBe('MESSAGING_GROUP_LOCKED');
    expect((await send(a, conversationId)).body.error.code).toBe('MESSAGING_GROUP_LOCKED');
    expect((await send(organizer, conversationId)).body.error.code).toBe('MESSAGING_GROUP_LOCKED');
    const unlock = await request(app).patch(`/api/v1/conversations/${conversationId}`).set(asUser(organizer)).send({ isLocked: false });
    expect(unlock.body.error.code).toBe('MESSAGING_SYSTEM_GROUP');
  });

  it('retries a missing chat from the job and locks it 30 days after completion', async () => {
    const { organizer, id } = await completedFour();
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(t.conversationId).not.toBeNull();
    // Simulate a Messaging failure at close: the job creates it later.
    await db.update(tournaments).set({ conversationId: null }).where(eq(tournaments.id, id));
    const created = await tournamentChatService.sweep();
    expect(created.created).toBeGreaterThanOrEqual(1);
    const [again] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(again.conversationId).not.toBeNull();
    await db.update(tournaments).set({ completedAt: new Date(Date.now() - 31 * DAY) }).where(eq(tournaments.id, id));
    await tournamentChatService.sweep();
    expect((await send(organizer, again.conversationId!)).body.error.code).toBe('MESSAGING_GROUP_LOCKED');
  });
});
