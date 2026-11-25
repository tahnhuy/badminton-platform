import http from 'http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { WebSocket } from 'ws';
import { eq } from 'drizzle-orm';
import app from '../app';
import { db, playerProfiles, skillLevels, systemConfigs } from '../db';
import { tournamentMatches, tournaments } from '../db/schema/tournaments';
import { messagingConfig } from '../shared/config/messaging-config';
import { messagingWsHub } from '../services/messaging/MessagingWsHub';
import { createTestUser } from './test-helpers';

// TRN-15 — tournament.watch / tournament.updated over the Messaging WebSocket hub.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
interface Envelope { type: string; data: { tournamentId: number; scope: string; tournamentMatchId?: number; version: number } }

let server: http.Server;
let port: number;
const sockets: WebSocket[] = [];

beforeEach(async () => {
  await db.insert(systemConfigs).values({ configKey: 'MESSAGING_ENABLED', configValue: 'true' })
    .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'true' } });
  messagingConfig.clearCache();
  server = http.createServer(app);
  messagingWsHub.attach(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', () => {
    const addr = server.address();
    port = typeof addr === 'object' && addr ? addr.port : 0;
    resolve();
  }));
});

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function player() {
  const user = await createTestUser({ role: 'PLAYER' });
  const [level] = await db.select().from(skillLevels).where(eq(skillLevels.rank, 4));
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `Người xem ${user.id}`, skillLevelId: level.id });
  return user.id;
}

function connect(userId: number): Promise<{ ws: WebSocket; messages: Envelope[] }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/api/v1/ws/messaging`, { headers: { 'x-user-id': String(userId) } });
    sockets.push(ws);
    const messages: Envelope[] = [];
    ws.on('message', raw => messages.push(JSON.parse(raw.toString())));
    ws.once('open', () => resolve({ ws, messages }));
    ws.once('error', reject);
  });
}

const api = (userId: number) => ({
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  put: (url: string, body: object = {}) => request(app).put(url).set('x-user-id', String(userId)).send(body),
});
const settle = (ms = 150) => new Promise(resolve => setTimeout(resolve, ms));
const waitFor = async (check: () => boolean, ms = 1000) => {
  const until = Date.now() + ms;
  while (Date.now() < until) { if (check()) return true; await settle(20); }
  return check();
};

async function liveTournament(organizer: number) {
  const now = Date.now();
  const created = await api(organizer).post('/api/v1/tournaments', {
    name: 'Giải realtime', matchType: 'SINGLES', entryFee: 0, venueNote: 'Sân D',
    registrationStart: new Date(now - HOUR).toISOString(), registrationEnd: new Date(now + DAY).toISOString(),
    tournamentStart: new Date(now + 2 * DAY).toISOString(), tournamentEnd: new Date(now + 3 * DAY).toISOString(),
  });
  const id = created.body.data.id as number;
  await api(organizer).post(`/api/v1/tournaments/${id}/open`, { version: 1 });
  const players = [await player(), await player()];
  for (const p of players) await api(p).post(`/api/v1/tournaments/${id}/registrations`);
  const version = async () => (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].version;
  await api(organizer).post(`/api/v1/tournaments/${id}/close`, { version: await version() });
  await api(organizer).post(`/api/v1/tournaments/${id}/draw`, { version: await version() });
  const [tm] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
  return { id, tm, players };
}

describe('Tournament realtime', () => {
  it('delivers tournament.updated to watchers within 1 s of a result and nothing to others', async () => {
    const organizer = await player();
    const { id, tm } = await liveTournament(organizer);
    const watcher = await connect(await player());
    const bystander = await connect(await player());
    watcher.ws.send(JSON.stringify({ type: 'tournament.watch', tournamentId: id }));
    await settle();

    await api(organizer).post(`/api/v1/tournaments/${id}/matches/${tm.id}/start`);
    const started = Date.now();
    await api(organizer).put(`/api/v1/tournaments/${id}/matches/${tm.id}/result`, { type: 'SETS', sets: [{ team1Score: 21, team2Score: 9 }, { team1Score: 21, team2Score: 8 }] });
    expect(await waitFor(() => watcher.messages.some(m => m.data.scope === 'MATCH' && m.type === 'tournament.updated' && m.data.tournamentMatchId === tm.id && Date.now() - started < 1000))).toBe(true);
    const event = watcher.messages.find(m => m.type === 'tournament.updated')!;
    expect(Object.keys(event.data).sort()).toEqual(['scope', 'tournamentId', 'tournamentMatchId', 'version']);
    expect(bystander.messages.filter(m => m.type === 'tournament.updated')).toHaveLength(0);

    watcher.ws.send(JSON.stringify({ type: 'tournament.unwatch', tournamentId: id }));
    await settle();
    const before = watcher.messages.length;
    await api(organizer).post(`/api/v1/tournaments/${id}/schedule/auto`, { version: (await db.select().from(tournaments).where(eq(tournaments.id, id)))[0].version });
    await settle(300);
    expect(watcher.messages.length).toBe(before);
  });

  it('rejects watching a DRAFT for anyone but its Organizer', async () => {
    const organizer = await player();
    const created = await api(organizer).post('/api/v1/tournaments', {
      name: 'Giải nháp realtime', matchType: 'SINGLES', entryFee: 0,
      registrationStart: new Date(Date.now() + HOUR).toISOString(), registrationEnd: new Date(Date.now() + DAY).toISOString(),
      tournamentStart: new Date(Date.now() + 2 * DAY).toISOString(), tournamentEnd: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    const id = created.body.data.id as number;
    const stranger = await connect(await player());
    const owner = await connect(organizer);
    for (const c of [stranger, owner]) c.ws.send(JSON.stringify({ type: 'tournament.watch', tournamentId: id }));
    await settle();
    await request(app).patch(`/api/v1/tournaments/${id}`).set('x-user-id', String(organizer)).send({ version: 1, name: 'Giải nháp đổi tên' });
    expect(await waitFor(() => owner.messages.some(m => m.type === 'tournament.updated'))).toBe(true);
    expect(stranger.messages.filter(m => m.type === 'tournament.updated')).toHaveLength(0);
  });

  it('keeps at most 5 watches per connection and ignores malformed frames', async () => {
    const organizer = await player();
    const ids: number[] = [];
    for (let i = 0; i < 6; i++) {
      const created = await api(organizer).post('/api/v1/tournaments', {
        name: `Giải số ${i + 1}`, matchType: 'SINGLES', entryFee: 0, venueNote: 'Sân',
        registrationStart: new Date(Date.now() - HOUR).toISOString(), registrationEnd: new Date(Date.now() + DAY).toISOString(),
        tournamentStart: new Date(Date.now() + 2 * DAY).toISOString(), tournamentEnd: new Date(Date.now() + 3 * DAY).toISOString(),
      });
      ids.push(created.body.data.id);
      await api(organizer).post(`/api/v1/tournaments/${created.body.data.id}/open`, { version: 1 });
    }
    const viewer = await connect(await player());
    viewer.ws.send('not json');
    for (const id of ids) viewer.ws.send(JSON.stringify({ type: 'tournament.watch', tournamentId: id }));
    await settle(300);
    for (const id of ids) {
      const [row] = await db.select().from(tournaments).where(eq(tournaments.id, id));
      await request(app).patch(`/api/v1/tournaments/${id}`).set('x-user-id', String(organizer)).send({ version: row.version, description: 'Cập nhật' });
    }
    await settle(300);
    const watched = new Set(viewer.messages.filter(m => m.type === 'tournament.updated').map(m => m.data.tournamentId));
    expect(watched.size).toBe(5);
  });
});
