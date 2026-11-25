import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import { app } from '../app';
import { db } from '../db';
import { playerProfiles, skillLevels } from '../db/schema';
import { userBlocks } from '../db/schema/messaging';
import { matchPlayers } from '../db/schema/matchmaking';
import { teamInvitations, tournamentMatches, tournamentTeams, tournaments } from '../db/schema/tournaments';
import { walletService } from '../services/payments/WalletService';
import { tournamentTeamService } from '../services/tournaments/TournamentTeamService';
import { createTestUser } from './test-helpers';

// TRN-09 — Doubles teams, invitations, invite links, team registration.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
let levelIdByRank: Map<number, number>;
let seq = 0;

beforeEach(async () => {
  const levels = await db.select().from(skillLevels);
  levelIdByRank = new Map(levels.map(level => [level.rank, level.id]));
});

async function player(rank = 4, topUp = 0, name?: string) {
  const user = await createTestUser({ role: 'PLAYER' });
  seq += 1;
  await db.insert(playerProfiles).values({ userId: user.id, fullName: name ?? `Đồng đội ${seq} ${user.id}`, skillLevelId: levelIdByRank.get(rank)! });
  if (topUp > 0) await walletService.credit({ userId: user.id, amount: String(topUp), entryType: 'TOP_UP', idempotencyKey: `test-topup:${user.id}` });
  return user.id;
}

const api = (userId: number) => ({
  get: (url: string) => request(app).get(url).set('x-user-id', String(userId)),
  post: (url: string, body: object = {}) => request(app).post(url).set('x-user-id', String(userId)).send(body),
  delete: (url: string) => request(app).delete(url).set('x-user-id', String(userId)),
});

async function openDoubles(organizer: number, overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  const created = await api(organizer).post('/api/v1/tournaments', {
    name: 'Giải đôi test', matchType: 'DOUBLES', participantLimit: 8, entryFee: 0, venueNote: 'Sân B',
    registrationStart: new Date(now - HOUR).toISOString(), registrationEnd: new Date(now + DAY).toISOString(),
    tournamentStart: new Date(now + 2 * DAY).toISOString(), tournamentEnd: new Date(now + 3 * DAY).toISOString(),
    ...overrides,
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const opened = await api(organizer).post(`/api/v1/tournaments/${created.body.data.id}/open`, { version: 1 });
  expect(opened.status, JSON.stringify(opened.body)).toBe(200);
  return opened.body.data as { id: number; version: number };
}

const createTeam = (userId: number, tournamentId: number, name = 'Đội Sấm Sét') => api(userId).post(`/api/v1/tournaments/${tournamentId}/teams`, { name });
const invite = (captain: number, tournamentId: number, teamId: number, inviteeId: number) =>
  api(captain).post(`/api/v1/tournaments/${tournamentId}/teams/${teamId}/invitations`, { inviteeId });

async function fullTeam(tournamentId: number, captain: number, partner: number, name = 'Đội') {
  const team = await createTeam(captain, tournamentId, name);
  expect(team.status, JSON.stringify(team.body)).toBe(201);
  const inv = await invite(captain, tournamentId, team.body.data.id, partner);
  expect(inv.status, JSON.stringify(inv.body)).toBe(201);
  const accepted = await api(partner).post(`/api/v1/tournaments/invitations/${inv.body.data.id}/accept`);
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
  return team.body.data.id as number;
}

describe('Teams and invitations', () => {
  it('creates a team, invites, accepts and becomes FULL', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const captain = await player();
    const partner = await player();
    const team = await createTeam(captain, t.id);
    expect(team.status, JSON.stringify(team.body)).toBe(201);
    expect(team.body.data).toMatchObject({ status: 'FORMING', captainId: captain, members: [{ id: captain, role: 'CAPTAIN' }] });

    const inv = await invite(captain, t.id, team.body.data.id, partner);
    expect(inv.status, JSON.stringify(inv.body)).toBe(201);
    // Only one pending invitation per team.
    const second = await invite(captain, t.id, team.body.data.id, await player());
    expect(second.body.error.code).toBe('TOURNAMENT_TEAM_INVITATION_PENDING');

    const partnerView = await api(partner).get(`/api/v1/tournaments/${t.id}/teams/mine`);
    expect(partnerView.body.data.team).toBeNull();
    expect(partnerView.body.data.invitations).toHaveLength(1);

    const accepted = await api(partner).post(`/api/v1/tournaments/invitations/${inv.body.data.id}/accept`);
    expect(accepted.status, JSON.stringify(accepted.body)).toBe(200);
    expect(accepted.body.data.status).toBe('FULL');
    expect(accepted.body.data.members.map((m: { id: number }) => m.id)).toEqual([captain, partner]);
  });

  it('rejects a second team for the same Player and Singles tournaments', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const captain = await player();
    expect((await createTeam(captain, t.id)).status).toBe(201);
    expect((await createTeam(captain, t.id, 'Đội hai')).body.error.code).toBe('TOURNAMENT_TEAM_ALREADY_IN_TEAM');
    expect((await createTeam(organizer, t.id)).body.error.code).toBe('TOURNAMENT_ORGANIZER_CANNOT_PLAY');
    const singles = await openDoubles(organizer, { matchType: 'SINGLES' });
    expect((await createTeam(captain, singles.id)).body.error.code).toBe('TOURNAMENT_TEAM_NOT_ALLOWED');
  });

  it('lets only one of two teams win concurrent accepts by the same Player', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const [c1, c2, shared] = [await player(), await player(), await player()];
    const team1 = (await createTeam(c1, t.id, 'Đội A')).body.data.id;
    const team2 = (await createTeam(c2, t.id, 'Đội B')).body.data.id;
    const inv1 = (await invite(c1, t.id, team1, shared)).body.data.id;
    const inv2 = (await invite(c2, t.id, team2, shared)).body.data.id;
    const results = await Promise.all([
      api(shared).post(`/api/v1/tournaments/invitations/${inv1}/accept`),
      api(shared).post(`/api/v1/tournaments/invitations/${inv2}/accept`),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([200, 409]);
    const teams = await db.select().from(tournamentTeams).where(eq(tournamentTeams.tournamentId, t.id));
    expect(teams.filter(x => x.status === 'FULL')).toHaveLength(1);
  });

  it('lets only one Player join a team by link when two try at once', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const captain = await player();
    const team = (await createTeam(captain, t.id)).body.data.id;
    const link = await api(captain).post(`/api/v1/tournaments/${t.id}/teams/${team}/invite-link`);
    expect(link.status, JSON.stringify(link.body)).toBe(200);
    const token = link.body.data.token as string;
    expect(link.body.data.path).toBe(`/tournaments/join/${token}`);
    const [a, b] = [await player(), await player()];
    const preview = await api(a).get(`/api/v1/tournaments/teams/join/${token}`);
    expect(preview.body.data).toMatchObject({ canJoin: true, reason: null, team: { id: team, captain: { id: captain } } });
    const results = await Promise.all([a, b].map(u => api(u).post(`/api/v1/tournaments/teams/join/${token}`)));
    expect(results.map(r => r.status).sort()).toEqual([200, 404]);
    const after = await api(b).get(`/api/v1/tournaments/teams/join/${token}`);
    expect(after.body.data.canJoin).toBe(false);
  });

  it('invalidates the old link when the captain regenerates it', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const captain = await player();
    const team = (await createTeam(captain, t.id)).body.data.id;
    const first = (await api(captain).post(`/api/v1/tournaments/${t.id}/teams/${team}/invite-link`)).body.data.token;
    const second = (await api(captain).post(`/api/v1/tournaments/${t.id}/teams/${team}/invite-link`)).body.data.token;
    expect(first).not.toBe(second);
    const joiner = await player();
    expect((await api(joiner).post(`/api/v1/tournaments/teams/join/${first}`)).body.error.code).toBe('TOURNAMENT_TEAM_INVITE_INVALID');
    expect((await api(joiner).post(`/api/v1/tournaments/teams/join/${second}`)).status).toBe(200);
  });

  it('searches invitable Players without ineligible, blocked, teamed or contact data', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer, { minSkillLevelId: levelIdByRank.get(3), maxSkillLevelId: levelIdByRank.get(5) });
    const tag = `Zq${Date.now()}`;
    const captain = await player(4, 0, `${tag} Đội trưởng`);
    const ok = await player(4, 0, `${tag} Hợp lệ`);
    const tooStrong = await player(1, 0, `${tag} Quá mạnh`);
    const blocked = await player(4, 0, `${tag} Bị chặn`);
    const teamed = await player(4, 0, `${tag} Có đội`);
    await db.insert(userBlocks).values({ blockerId: blocked, blockedId: captain });
    await createTeam(teamed, t.id, 'Đội khác');
    await createTeam(captain, t.id);
    const found = await api(captain).get(`/api/v1/tournaments/${t.id}/invitable-players?q=${encodeURIComponent(tag)}`);
    expect(found.status, JSON.stringify(found.body)).toBe(200);
    expect(found.body.data.map((p: { id: number }) => p.id)).toEqual([ok]);
    expect(Object.keys(found.body.data[0]).sort()).toEqual(['avatarUrl', 'fullName', 'id', 'skillLevel']);
    expect(found.body.data.some((p: { id: number }) => [tooStrong, blocked, teamed, captain].includes(p.id))).toBe(false);
    expect((await api(captain).get(`/api/v1/tournaments/${t.id}/invitable-players?q=a`)).status).toBe(400);
  });

  it('lets the member leave, the captain remove, and disbands when the captain leaves', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const [captain, partner] = [await player(), await player()];
    const team = await fullTeam(t.id, captain, partner);
    const left = await api(partner).post(`/api/v1/tournaments/${t.id}/teams/${team}/leave`);
    expect(left.body.data).toEqual({ disbanded: false });
    expect((await api(captain).get(`/api/v1/tournaments/${t.id}/teams/mine`)).body.data.team.status).toBe('FORMING');

    const again = await invite(captain, t.id, team, partner);
    await api(partner).post(`/api/v1/tournaments/invitations/${again.body.data.id}/accept`);
    const removed = await api(captain).delete(`/api/v1/tournaments/${t.id}/teams/${team}/members/${partner}`);
    expect(removed.status, JSON.stringify(removed.body)).toBe(200);
    expect(removed.body.data.members).toHaveLength(1);

    const pending = await invite(captain, t.id, team, partner);
    expect((await api(captain).post(`/api/v1/tournaments/${t.id}/teams/${team}/leave`)).body.data).toEqual({ disbanded: true });
    const [inv] = await db.select().from(teamInvitations).where(eq(teamInvitations.id, pending.body.data.id));
    expect(inv.status).toBe('CANCELLED');
    // Both are free again.
    expect((await createTeam(partner, t.id, 'Đội mới')).status).toBe(201);
  });

  it('declines and cancels invitations; expired ones cannot be accepted', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const [captain, x] = [await player(), await player()];
    const team = (await createTeam(captain, t.id)).body.data.id;
    const a = await invite(captain, t.id, team, x);
    expect((await api(captain).post(`/api/v1/tournaments/invitations/${a.body.data.id}/decline`)).status).toBe(404);
    expect((await api(x).post(`/api/v1/tournaments/invitations/${a.body.data.id}/decline`)).body.data.status).toBe('DECLINED');
    const b = await invite(captain, t.id, team, x);
    expect((await api(captain).post(`/api/v1/tournaments/invitations/${b.body.data.id}/cancel`)).body.data.status).toBe('CANCELLED');
    const c = await invite(captain, t.id, team, x);
    await db.update(teamInvitations).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(teamInvitations.id, c.body.data.id));
    expect((await api(x).post(`/api/v1/tournaments/invitations/${c.body.data.id}/accept`)).body.error.code).toBe('TOURNAMENT_TEAM_INVITATION_NOT_PENDING');
    const expired = await tournamentTeamService.expireInvitations();
    expect(expired.map(r => r.id)).toContain(c.body.data.id);
  });
});

describe('Team registration', () => {
  it('registers a full team, charges the captain, locks membership and withdraws by captain', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer, { entryFee: 100000 });
    const [captain, partner] = [await player(4, 300000), await player()];
    const teamId = await fullTeam(t.id, captain, partner);
    expect((await api(partner).post(`/api/v1/tournaments/${t.id}/registrations`, { teamId })).body.error.code).toBe('TOURNAMENT_FORBIDDEN');
    const reg = await api(captain).post(`/api/v1/tournaments/${t.id}/registrations`, { teamId });
    expect(reg.status, JSON.stringify(reg.body)).toBe(201);
    expect(reg.body.data).toMatchObject({ registrationType: 'DOUBLES', paidAmount: 100000 });
    expect(Number((await walletService.getWallet(captain)).balance)).toBe(200000);
    expect((await api(captain).post(`/api/v1/tournaments/${t.id}/registrations`, { teamId })).body.error.code).toBe('TOURNAMENT_ALREADY_REGISTERED');
    expect((await api(partner).post(`/api/v1/tournaments/${t.id}/teams/${teamId}/leave`)).body.error.code).toBe('TOURNAMENT_TEAM_LOCKED');

    const detail = await api(partner).get(`/api/v1/tournaments/${t.id}`);
    expect(detail.body.data.viewer.registrationId).toBe(reg.body.data.id);
    const people = await api(partner).get(`/api/v1/tournaments/${t.id}/registrations`);
    expect(people.body.data[0].teamName).toBe('Đội');
    expect(people.body.data[0].players.map((p: { id: number }) => p.id)).toEqual([captain, partner]);

    expect((await api(partner).delete(`/api/v1/tournaments/${t.id}/registrations/${reg.body.data.id}`)).status).toBe(403);
    const withdrawn = await api(captain).delete(`/api/v1/tournaments/${t.id}/registrations/${reg.body.data.id}`);
    expect(withdrawn.status, JSON.stringify(withdrawn.body)).toBe(200);
    expect(Number((await walletService.getWallet(captain)).balance)).toBe(300000);
    const [team] = await db.select().from(tournamentTeams).where(eq(tournamentTeams.id, teamId));
    expect(team.status).toBe('DISBANDED');
  });

  it('rejects a forming team and an ineligible partner', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer, { maxSkillLevelId: levelIdByRank.get(4) });
    const captain = await player(4);
    const teamId = (await createTeam(captain, t.id)).body.data.id;
    expect((await api(captain).post(`/api/v1/tournaments/${t.id}/registrations`, { teamId })).body.error.code).toBe('TOURNAMENT_TEAM_NOT_FULL');
    const weak = await player(5);
    expect((await invite(captain, t.id, teamId, weak)).body.error.code).toBe('TOURNAMENT_TEAM_INVITEE_INVALID');
    expect((await api(captain).post(`/api/v1/tournaments/${t.id}/registrations`)).body.error.code).toBe('TOURNAMENT_TEAM_REQUIRED');
  });

  it('cancels pending invitations at close and draws a Doubles bracket with full rosters', async () => {
    const organizer = await player();
    const t = await openDoubles(organizer);
    const members = await Promise.all(Array.from({ length: 4 }, () => player()));
    const teamA = await fullTeam(t.id, members[0], members[1], 'Đội A');
    const teamB = await fullTeam(t.id, members[2], members[3], 'Đội B');
    for (const [captain, teamId] of [[members[0], teamA], [members[2], teamB]]) {
      const reg = await api(captain).post(`/api/v1/tournaments/${t.id}/registrations`, { teamId });
      expect(reg.status, JSON.stringify(reg.body)).toBe(201);
    }
    const loneCaptain = await player();
    const lone = (await createTeam(loneCaptain, t.id, 'Đội lẻ')).body.data.id;
    const pending = await invite(loneCaptain, t.id, lone, await player());

    const [row] = await db.select().from(tournaments).where(eq(tournaments.id, t.id));
    const closed = await api(organizer).post(`/api/v1/tournaments/${t.id}/close`, { version: row.version });
    expect(closed.status, JSON.stringify(closed.body)).toBe(200);
    const [inv] = await db.select().from(teamInvitations).where(eq(teamInvitations.id, pending.body.data.id));
    expect(inv.status).toBe('CANCELLED');

    const drawn = await api(organizer).post(`/api/v1/tournaments/${t.id}/draw`, { version: closed.body.data.version });
    expect(drawn.status, JSON.stringify(drawn.body)).toBe(200);
    const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, t.id));
    const roster = await db.select().from(matchPlayers).where(eq(matchPlayers.matchId, final.matchId));
    expect(roster.map(r => r.playerId).sort()).toEqual([...members].sort());
    const bracket = await api(members[1]).get(`/api/v1/tournaments/${t.id}/bracket`);
    const match = bracket.body.data.rounds[0].matches[0];
    expect([match.slot1.teamName, match.slot2.teamName].sort()).toEqual(['Đội A', 'Đội B']);
    expect(match.slot1.players).toHaveLength(2);
  });
});

