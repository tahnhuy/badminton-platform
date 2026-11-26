import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { and, eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { notifications } from '../db/schema/notifications';
import { tournaments } from '../db/schema/tournaments';
import { walletService } from '../services/payments/WalletService';
import { createTestUser } from './test-helpers';
import { api, complete, DAY, drawSingles, HOUR, makePlayer, openTournament, playAll } from './tournament-test-kit';

// TRN-12 — Admin tournaments list and cancel-only moderation.

describe('Admin tournaments', () => {
  it('lists every status including drafts, filters by status and name, and is Admin-only', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const organizer = await makePlayer();
    const tag = `Quản trị ${Date.now()}`;
    const draft = await api(organizer).post('/api/v1/tournaments', {
      name: `${tag} nháp`, matchType: 'SINGLES', entryFee: 0,
      registrationStart: new Date(Date.now() + HOUR).toISOString(), registrationEnd: new Date(Date.now() + DAY).toISOString(),
      tournamentStart: new Date(Date.now() + 2 * DAY).toISOString(), tournamentEnd: new Date(Date.now() + 3 * DAY).toISOString(),
    });
    const open = await openTournament(organizer, { name: `${tag} mở` });
    const asAdmin = (url: string) => request(app).get(url).set('x-user-id', String(admin.id));
    const all = await asAdmin(`/api/v1/admin/tournaments?q=${encodeURIComponent(tag)}`);
    expect(all.status, JSON.stringify(all.body)).toBe(200);
    expect(all.body.data.map((t: { id: number }) => t.id).sort()).toEqual([draft.body.data.id, open].sort());
    // Deep link from notifications / global search: exactly that tournament.
    const one = await asAdmin(`/api/v1/admin/tournaments?id=${open}`);
    expect(one.body.data.map((t: { id: number }) => t.id)).toEqual([open]);
    const drafts = await asAdmin(`/api/v1/admin/tournaments?status=DRAFT&q=${encodeURIComponent(tag)}`);
    expect(drafts.body.data.map((t: { id: number }) => t.id)).toEqual([draft.body.data.id]);
    expect((await api(organizer).get('/api/v1/admin/tournaments')).status).toBe(403);
  });

  it('cancels a running tournament with full refunds and tells the Organizer and players', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const organizer = await makePlayer();
    const players = [await makePlayer({ topUp: 40000 }), await makePlayer({ topUp: 40000 })];
    const id = await openTournament(organizer, { entryFee: 40000 });
    await drawSingles(organizer, id, players);
    const cancel = (reason: string) => request(app).post(`/api/v1/admin/tournaments/${id}/cancel`).set('x-user-id', String(admin.id)).send({ reason });
    expect((await cancel('')).status).toBe(400);
    const res = await cancel('Vi phạm quy định');
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const [t] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(t).toMatchObject({ status: 'CANCELLED', cancelReason: 'Vi phạm quy định', cancelledBy: admin.id });
    for (const p of players) expect(Number((await walletService.getWallet(p)).balance)).toBe(40000);
    expect(await db.select().from(notifications).where(and(eq(notifications.userId, organizer), eq(notifications.type, 'TOURNAMENT_CANCELLED')))).toHaveLength(1);
    expect((await cancel('Lần hai')).body.error.code).toBe('TOURNAMENT_INVALID_STATE');
  });

  it('cannot cancel a completed tournament', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const organizer = await makePlayer();
    const id = await openTournament(organizer);
    await drawSingles(organizer, id, [await makePlayer(), await makePlayer()]);
    await playAll(organizer, id);
    await complete(organizer, id);
    const res = await request(app).post(`/api/v1/admin/tournaments/${id}/cancel`).set('x-user-id', String(admin.id)).send({ reason: 'Muộn' });
    expect(res.body.error.code).toBe('TOURNAMENT_INVALID_STATE');
  });

  it('recalculates skill ratings on demand', async () => {
    const admin = await createTestUser({ role: 'ADMIN' });
    const res = await request(app).post('/api/v1/admin/tournaments/skill-ratings/recalculate').set('x-user-id', String(admin.id));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.data).toHaveProperty('changed');
  });
});
