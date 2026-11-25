import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { matches } from '../db/schema/matchmaking';
import { tournaments, tournamentMatches, tournamentRegistrations } from '../db/schema/tournaments';
import { createTestUser } from './test-helpers';

// TRN-05 — automatic schedule at the draw, manual edits with warnings, re-run (Tech Design §3.4, §7.3, §7.4).

const MINUTE = 60_000;
const DAY = 1440 * MINUTE;
let levelId: number;

beforeEach(async () => {
  levelId = (await db.select().from(skillLevels).where(eq(skillLevels.rank, 4)))[0].id;
});

async function player() {
  const user = await createTestUser({ role: 'PLAYER' });
  await db.insert(playerProfiles).values({ userId: user.id, fullName: `VĐV ${user.id}`, skillLevelId: levelId });
  return user.id;
}

const api = (userId: number | null) => ({
  get: (url: string) => (userId ? request(app).get(url).set('x-user-id', String(userId)) : request(app).get(url)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  patch: (url: string, body: object) => request(app).patch(url).set('x-user-id', String(userId)).send(body),
});

/** 8 confirmed players, closed, starting at 08:00 (Vietnam) two days from now, 2 courts × 45 min, rest 15. */
async function drawnTournament(n = 8) {
  const organizer = await player();
  const day = new Date(Date.now() + 2 * DAY);
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 1, 0)); // 08:00 +07:00
  const [t] = await db.insert(tournaments).values({
    creatorId: organizer, name: 'Giải xếp lịch', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES', participantLimit: 16,
    status: 'REGISTRATION_CLOSED', venueNote: 'Sân A', registrationStart: new Date(Date.now() - 2 * DAY),
    registrationEnd: new Date(Date.now() - DAY), tournamentStart: start, tournamentEnd: new Date(start.getTime() + DAY),
  }).returning();
  for (let i = 0; i < n; i += 1) {
    await db.insert(tournamentRegistrations).values({
      tournamentId: t.id, playerId: await player(), registrationType: 'SINGLES', status: 'CONFIRMED', registeredAt: new Date(),
    });
  }
  const drawn = await api(organizer).post(`/api/v1/tournaments/${t.id}/draw`, { version: t.version });
  expect(drawn.status, JSON.stringify(drawn.body)).toBe(200);
  return { organizer, tournamentId: t.id, start, version: drawn.body.data.version as number };
}

type Item = { id: number; roundIndex: number; courtLabel: string; scheduledAt: string; estimatedEndAt: string; status: string };

describe('schedule', () => {
  it('schedules the draw on virtual courts from the tournament start, respecting feeders and rest', async () => {
    const { organizer, tournamentId, start } = await drawnTournament(8);
    const res = await api(organizer).get(`/api/v1/tournaments/${tournamentId}/schedule`);
    expect(res.body.data.warnings).toEqual([]);
    const items: Item[] = res.body.data.matches;
    expect(items).toHaveLength(7);
    const at = (minutes: number) => new Date(start.getTime() + minutes * MINUTE).toISOString();
    const firstRound = items.filter(m => m.roundIndex === 0);
    expect(firstRound.map(m => [m.scheduledAt, m.courtLabel])).toEqual([
      [at(0), 'Sân 1'], [at(0), 'Sân 2'], [at(45), 'Sân 1'], [at(45), 'Sân 2'],
    ]);
    // Semi 1: feeders end 08:45 (+15 rest = 09:00) but courts are busy until 09:30.
    // Semi 2: feeders end 09:30 + 15 rest = 09:45. Final: semis end 10:15/10:30 + 15 = 10:45.
    expect(items.filter(m => m.roundIndex === 1).map(m => m.scheduledAt)).toEqual([at(90), at(105)]);
    expect(items.find(m => m.roundIndex === 2)!.scheduledAt).toBe(at(165));
    // Visitors see the schedule without the Organizer's warnings.
    const publicView = await api(null).get(`/api/v1/tournaments/${tournamentId}/schedule`);
    expect(publicView.body.data).not.toHaveProperty('warnings');
    expect(publicView.body.data.matches).toHaveLength(7);
  });

  it('saves a manual edit with warnings, forbids other users, and locks started matches', async () => {
    const { organizer, tournamentId } = await drawnTournament(8);
    const items: Item[] = (await api(organizer).get(`/api/v1/tournaments/${tournamentId}/schedule`)).body.data.matches;
    const [a, b] = items.filter(m => m.roundIndex === 0);
    const url = (id: number) => `/api/v1/tournaments/${tournamentId}/matches/${id}/schedule`;
    const edit = await api(organizer).patch(url(b.id), { courtLabel: ' sân 1 ', scheduledAt: a.scheduledAt });
    expect(edit.status, JSON.stringify(edit.body)).toBe(200);
    expect(edit.body.data.match).toMatchObject({ id: b.id, courtLabel: 'sân 1', scheduledAt: a.scheduledAt });
    expect(edit.body.data.warnings).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'COURT_OVERLAP' })]));
    expect((await api(await player()).patch(url(b.id), { courtLabel: 'Sân 3', scheduledAt: a.scheduledAt })).body.error.code).toBe('TOURNAMENT_FORBIDDEN');
    const [row] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, a.id));
    await db.update(matches).set({ status: 'IN_PROGRESS' }).where(eq(matches.id, row.matchId));
    expect((await api(organizer).patch(url(a.id), { courtLabel: 'Sân 4', scheduledAt: a.scheduledAt })).body.error.code).toBe('TOURNAMENT_MATCH_LOCKED');
  });

  it('re-runs scheduling for matches not started, keeping started ones fixed', async () => {
    const { organizer, tournamentId, version } = await drawnTournament(8);
    const items: Item[] = (await api(organizer).get(`/api/v1/tournaments/${tournamentId}/schedule`)).body.data.matches;
    const started = items[0];
    const [row] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.id, started.id));
    await db.update(matches).set({ status: 'IN_PROGRESS' }).where(eq(matches.id, row.matchId));
    const moved = items[1];
    await api(organizer).patch(`/api/v1/tournaments/${tournamentId}/matches/${moved.id}/schedule`, { courtLabel: 'Sân 1', scheduledAt: started.scheduledAt });
    expect((await api(organizer).post(`/api/v1/tournaments/${tournamentId}/schedule/auto`, { version: version - 1 })).body.error.code).toBe('TOURNAMENT_VERSION_CONFLICT');
    // The manual edit bumped the version: the stale one is refused, the fresh one runs.
    expect((await api(organizer).post(`/api/v1/tournaments/${tournamentId}/schedule/auto`, { version })).body.error.code).toBe('TOURNAMENT_VERSION_CONFLICT');
    const fresh = (await db.select().from(tournaments).where(eq(tournaments.id, tournamentId)))[0].version;
    const rerun = await api(organizer).post(`/api/v1/tournaments/${tournamentId}/schedule/auto`, { version: fresh });
    expect(rerun.status, JSON.stringify(rerun.body)).toBe(200);
    expect(rerun.body.data.warnings).toEqual([]);
    const after: Item[] = rerun.body.data.matches;
    expect(after.find(m => m.id === started.id)).toMatchObject({ scheduledAt: started.scheduledAt, courtLabel: started.courtLabel });
    expect(after.find(m => m.id === moved.id)!.courtLabel).toMatch(/^Sân \d$/);
  });

  it('only schedules READY or IN_PROGRESS tournaments', async () => {
    const organizer = await player();
    const [t] = await db.insert(tournaments).values({
      creatorId: organizer, name: 'Đang mở', format: 'SINGLE_ELIMINATION', matchType: 'SINGLES', participantLimit: 8,
      status: 'OPEN_FOR_REGISTRATION', registrationStart: new Date(), registrationEnd: new Date(Date.now() + DAY),
      tournamentStart: new Date(Date.now() + 2 * DAY), tournamentEnd: new Date(Date.now() + 3 * DAY),
    }).returning();
    expect((await api(organizer).post(`/api/v1/tournaments/${t.id}/schedule/auto`, { version: t.version })).body.error.code).toBe('TOURNAMENT_INVALID_STATE');
  });
});
