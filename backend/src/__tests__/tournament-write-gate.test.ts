import { expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, systemConfigs } from '../db';
import { tournamentConfig } from '../shared/config/tournament-config';
import { api, makePlayer, openTournament } from './tournament-test-kit';
import { createTestUser } from './test-helpers';

it('blocks every interactive write while disabled, preserving authenticated reads and role checks', async () => {
  const organizer = await makePlayer();
  const admin = await createTestUser({ role: 'ADMIN' });
  const id = await openTournament(organizer);
  const base = `/api/v1/tournaments/${id}`;
  const writes: Array<readonly ['post' | 'put' | 'patch' | 'delete', string]> = [
    ['post', '/api/v1/tournaments'], ['patch', base],
    ...['open', 'close', 'cancel', 'complete', 'draw', 'share', 'schedule/auto', 'teams',
      'teams/1/invitations', 'teams/1/invite-link', 'teams/1/leave', 'registrations',
      'registrations/1/remove', 'matches/1/start'].map(path => ['post', `${base}/${path}`] as const),
    ['delete', `${base}/registrations/1`], ['delete', `${base}/teams/1/members/1`],
    ['put', `${base}/seeds`], ['put', `${base}/matches/1/result`], ['patch', `${base}/matches/1/schedule`],
    ...['accept', 'decline', 'cancel'].map(action => ['post', `/api/v1/tournaments/invitations/1/${action}`] as const),
    ['post', '/api/v1/tournaments/teams/join/abcdefghijklmnop'],
  ];
  await db.insert(systemConfigs).values({ configKey: 'TOURNAMENT_ENABLED', configValue: 'false' })
    .onConflictDoUpdate({ target: systemConfigs.configKey, set: { configValue: 'false' } });
  tournamentConfig.clearCache();
  try {
    for (const [method, path] of writes) {
      const response = await api(organizer)[method](path);
      expect(response.status, `${method} ${path}: ${JSON.stringify(response.body)}`).toBe(409);
      expect(response.body.error.code, `${method} ${path}`).toBe('TOURNAMENT_DISABLED');
    }
    const recalc = '/api/v1/admin/tournaments/skill-ratings/recalculate';
    expect((await api(admin.id).post(recalc)).body.error.code).toBe('TOURNAMENT_DISABLED');
    for (const path of [`/api/v1/admin/tournaments/${id}/cancel`, recalc]) expect((await api(organizer).post(path)).status).toBe(403);
    for (const path of ['/api/v1/tournaments', '/api/v1/tournaments/mine', base]) expect((await api(organizer).get(path)).status).toBe(200);
    expect((await api(admin.id).get('/api/v1/admin/tournaments')).status).toBe(200);
    // Admin cancel (with refunds) stays available while disabled.
    const cancelled = await api(admin.id).post(`/api/v1/admin/tournaments/${id}/cancel`, { reason: 'Sự cố hệ thống' });
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.data.status).toBe('CANCELLED');
  } finally {
    await db.update(systemConfigs).set({ configValue: 'true' }).where(eq(systemConfigs.configKey, 'TOURNAMENT_ENABLED'));
    tournamentConfig.clearCache();
  }
});
