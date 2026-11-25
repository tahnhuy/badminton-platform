import { describe, it, expect, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { notifications } from '../db/schema/notifications';
import { playerProfiles, skillLevels } from '../db/schema/users';
import { skillLevelChanges, skillRatingEvents } from '../db/schema/skill-rating';
import { tournamentMatches, tournamentRankingPoints, tournaments } from '../db/schema/tournaments';
import { tournamentRepository } from '../repositories/tournaments/TournamentRepository';
import { skillRatingService } from '../services/tournaments/SkillRatingService';
import { rankingPoints } from '../services/tournaments/TournamentRankingService';
import { api, complete, drawSingles, makePlayer, openTournament, playAll } from './tournament-test-kit';

// TRN-14 skill rating (replay, hysteresis, correction) and TRN-18 ranking points / leaderboards.

const profile = async (id: number) => (await db.select().from(playerProfiles).where(eq(playerProfiles.userId, id)))[0];
const rankOf = async (id: number) => {
  const p = await profile(id);
  return (await db.select().from(skillLevels).where(eq(skillLevels.id, p.skillLevelId)))[0].rank;
};

/** A 2-player tournament (final only) where `winner` beats `loser`. */
async function duel(organizer: number, winner: number, loser: number, options: { walkover?: boolean } = {}) {
  const id = await openTournament(organizer);
  const regs = await drawSingles(organizer, id, [winner, loser]);
  const winReg = regs.get(winner)!;
  await playAll(organizer, id, () => winReg, slot => options.walkover
    ? { type: 'WALKOVER', winnerSlot: slot }
    : { type: 'SETS', sets: slot === 1 ? [{ team1Score: 21, team2Score: 5 }, { team1Score: 21, team2Score: 6 }] : [{ team1Score: 5, team2Score: 21 }, { team1Score: 6, team2Score: 21 }] });
  await complete(organizer, id);
  return { id, regs };
}

describe('Skill rating from professional tournaments', () => {
  it('demotes an over-rated player after repeated heavy losses, notifies them and keeps R private', async () => {
    const organizer = await makePlayer();
    const strong = await makePlayer({ rank: 6 }); // Khá, no survey → R0 = 75
    const weak = await makePlayer({ rank: 2 });   // Yếu, R0 = 22.5
    await duel(organizer, weak, strong);
    let me = await profile(strong);
    expect(Number(me.skillRating)).toBeCloseTo(69, 1);
    expect(me.ratedMatchCount).toBe(1);
    expect(await rankOf(strong)).toBe(6); // 69 ≥ 70 − 3: hysteresis keeps Khá

    const { id: second } = await duel(organizer, weak, strong);
    me = await profile(strong);
    expect(Number(me.skillRating)).toBeCloseTo(63, 1);
    expect(await rankOf(strong)).toBe(5);
    expect(me.isSkillTentative).toBe(true);
    const [change] = await db.select().from(skillLevelChanges).where(eq(skillLevelChanges.playerId, strong));
    expect(change).toMatchObject({ reason: 'TOURNAMENT_RESULT', tournamentId: second });
    const levelNotices = await db.select().from(notifications).where(and(eq(notifications.userId, strong), eq(notifications.type, 'SKILL_LEVEL_CHANGED')));
    expect(levelNotices).toHaveLength(1);
    // The notice opens the owner's profile (skill rating card), not the tournament (flow audit).
    expect(levelNotices[0]).toMatchObject({ resourceType: 'SKILL_RATING', resourceId: strong });
    const { notificationResourceResolver } = await import('../services/notifications/NotificationResourceResolver');
    expect(await notificationResourceResolver.resolve({ id: strong, role: 'PLAYER' }, 'SKILL_RATING', strong)).toBe('/profile');
    expect(await notificationResourceResolver.resolve({ id: weak, role: 'PLAYER' }, 'SKILL_RATING', strong)).toBeNull();

    const own = await api(strong).get('/api/v1/players/me/skill-rating');
    expect(own.status, JSON.stringify(own.body)).toBe(200);
    expect(own.body.data).toMatchObject({ ratedMatchCount: 2, tentative: true, level: { rank: 5 } });
    expect(own.body.data.rating).toBeCloseTo(63, 1);
    expect(own.body.data.events).toHaveLength(2);
    expect(own.body.data.changes[0]).toMatchObject({ reason: 'TOURNAMENT_RESULT', tournament: { id: second } });
    const pub = await api(weak).get(`/api/v1/players/${strong}`);
    expect(JSON.stringify(pub.body)).not.toContain('skillRating');
    expect(JSON.stringify(pub.body)).not.toContain('63');
  });

  it('ignores walkovers', async () => {
    const organizer = await makePlayer();
    const [a, b] = [await makePlayer(), await makePlayer()];
    await duel(organizer, a, b, { walkover: true });
    expect((await profile(a)).ratedMatchCount).toBe(0);
    expect(await db.select().from(skillRatingEvents).where(eq(skillRatingEvents.playerId, a))).toHaveLength(0);
  });

  it('a correction within 48 h replays and writes a RECALCULATION change when the level flips back', async () => {
    const organizer = await makePlayer();
    const strong = await makePlayer({ rank: 6 });
    const weak = await makePlayer({ rank: 2 });
    await duel(organizer, weak, strong);
    const { id, regs } = await duel(organizer, weak, strong);
    expect(await rankOf(strong)).toBe(5);
    const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const strongIsSlot1 = final.registration1Id === regs.get(strong);
    const sets = strongIsSlot1 ? [{ team1Score: 21, team2Score: 10 }, { team1Score: 21, team2Score: 12 }] : [{ team1Score: 10, team2Score: 21 }, { team1Score: 12, team2Score: 21 }];
    const corrected = await api(organizer).put(`/api/v1/tournaments/${id}/matches/${final.id}/result`, { type: 'SETS', sets });
    expect(corrected.status, JSON.stringify(corrected.body)).toBe(200);
    expect(await rankOf(strong)).toBe(6);
    const changes = await db.select().from(skillLevelChanges).where(eq(skillLevelChanges.playerId, strong));
    expect(changes.map(c => c.reason)).toEqual(['TOURNAMENT_RESULT', 'RECALCULATION']);
    // Replaying again is idempotent: no new change.
    await api(organizer).put(`/api/v1/tournaments/${id}/matches/${final.id}/result`, { type: 'SETS', sets });
    expect(await db.select().from(skillLevelChanges).where(eq(skillLevelChanges.playerId, strong))).toHaveLength(2);
  });
});

describe('Achievement ranking', () => {
  it('computes points from placement, field strength and size', () => {
    expect(rankingPoints('CHAMPION', 4, 8)).toBe(100);
    expect(rankingPoints('RUNNER_UP', 4, 2)).toBe(17.5);
    expect(rankingPoints('SEMI_FINAL', 6, 16)).toBe(75);
    expect(rankingPoints('ROUND_OF_16', 4, 16)).toBe(10);
  });

  it('writes points at completion and ranks the best results', async () => {
    const organizer = await makePlayer();
    const players = await Promise.all(Array.from({ length: 8 }, () => makePlayer({ rank: 4 })));
    const id = await openTournament(organizer);
    const regs = await drawSingles(organizer, id, players);
    await playAll(organizer, id);
    await complete(organizer, id);
    const rows = await db.select().from(tournamentRankingPoints).where(eq(tournamentRankingPoints.tournamentId, id));
    expect(rows.map(r => Number(r.points)).sort((a, b) => b - a)).toEqual([100, 70, 50, 50, 30, 30, 30, 30]);
    const champion = [...regs.entries()].sort((a, b) => a[1] - b[1])[0][0];
    expect(rows.find(r => r.playerId === champion)).toMatchObject({ placement: 'CHAMPION', matchType: 'SINGLES' });

    const board = await api(players[0]).get('/api/v1/tournament-rankings?matchType=SINGLES&limit=50');
    expect(board.status, JSON.stringify(board.body)).toBe(200);
    const mine = board.body.data.filter((r: { player: { id: number } }) => players.includes(r.player.id));
    expect(mine[0]).toMatchObject({ player: { id: champion }, totalPoints: 100, tournamentsCounted: 1 });
    const positions = mine.map((r: { position: number }) => r.position);
    expect([...positions].sort((a: number, b: number) => a - b)).toEqual(positions);
    const history = await api(players[0]).get(`/api/v1/players/${champion}/tournaments`);
    expect(history.body.data[0].rankingPoints).toBe(100);
    const card = await api(players[0]).get(`/api/v1/tournament-rankings/players/${champion}`);
    expect(card.body.data.SINGLES).toMatchObject({ totalPoints: 100 });
    expect(card.body.data.DOUBLES).toBeNull();
  });

  it('sums only the best N inside the window', async () => {
    const organizer = await makePlayer();
    const hero = await makePlayer({ rank: 4 });
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) ids.push((await duel(organizer, hero, await makePlayer({ rank: 4 }))).id);
    const read = async () => (await api(hero).get(`/api/v1/tournament-rankings/players/${hero}`)).body.data.SINGLES;
    expect(await read()).toMatchObject({ totalPoints: 100, tournamentsCounted: 4 });
    // Older than 12 months: no longer counted.
    const old = new Date();
    old.setMonth(old.getMonth() - 13);
    await db.update(tournamentRankingPoints).set({ completedAt: old }).where(and(eq(tournamentRankingPoints.playerId, hero), eq(tournamentRankingPoints.tournamentId, ids[0])));
    await db.update(tournamentRankingPoints).set({ completedAt: old }).where(and(eq(tournamentRankingPoints.playerId, hero), eq(tournamentRankingPoints.tournamentId, ids[1])));
    expect(await read()).toMatchObject({ totalPoints: 75, tournamentsCounted: 3 });
  });
});

describe('Review regressions (TRN-14/18)', () => {
  it('freezes field strength at draw even when players change level before completion', async () => {
    const organizer = await makePlayer();
    const players = [await makePlayer({ rank: 4 }), await makePlayer({ rank: 4 })];
    const id = await openTournament(organizer);
    await drawSingles(organizer, id, players);
    const [drawn] = await db.select().from(tournaments).where(eq(tournaments.id, id));
    expect(drawn).toMatchObject({ rankingRankSum: 8, rankingPlayerCount: 2 });
    const [higher] = await db.select().from(skillLevels).where(eq(skillLevels.rank, 7));
    for (const playerId of players) await db.update(playerProfiles).set({ skillLevelId: higher.id }).where(eq(playerProfiles.userId, playerId));
    await playAll(organizer, id);
    await complete(organizer, id);
    const points = await db.select().from(tournamentRankingPoints).where(eq(tournamentRankingPoints.tournamentId, id));
    expect(points.find(p => p.placement === 'CHAMPION')!.points).toBe('25.00');
    expect(points.find(p => p.placement === 'RUNNER_UP')!.points).toBe('17.50');
  });

  it('keeps rounded placement points on repeated corrections and legacy winner changes', async () => {
    const organizer = await makePlayer();
    const winner = await makePlayer({ rank: 1 });
    const loser = await makePlayer({ rank: 2 });
    const { id, regs } = await duel(organizer, winner, loser, { walkover: true });
    const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const originalSlot = final.registration1Id === regs.get(winner) ? 1 : 2;
    const read = async () => (await db.select().from(tournamentRankingPoints).where(eq(tournamentRankingPoints.tournamentId, id)))
      .map(p => ({ playerId: p.playerId, placement: p.placement, points: p.points })).sort((a, b) => a.playerId - b.playerId);
    const before = await read();
    expect(before.find(p => p.playerId === loser)!.points).toBe('6.56');
    // No historical snapshot on tournaments completed before migration 0035.
    await db.update(tournaments).set({ rankingRankSum: null, rankingPlayerCount: null }).where(eq(tournaments.id, id));
    for (let i = 0; i < 3; i++) {
      const res = await api(organizer).put(`/api/v1/tournaments/${id}/matches/${final.id}/result`, { type: 'WALKOVER', winnerSlot: originalSlot });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(await read()).toEqual(before);
    }
    const swapped = await api(organizer).put(`/api/v1/tournaments/${id}/matches/${final.id}/result`, { type: 'WALKOVER', winnerSlot: originalSlot === 1 ? 2 : 1 });
    expect(swapped.status, JSON.stringify(swapped.body)).toBe(200);
    expect(await read()).toEqual(expect.arrayContaining([
      { playerId: loser, placement: 'CHAMPION', points: '9.38' },
      { playerId: winner, placement: 'RUNNER_UP', points: '6.56' },
    ]));
  });

  it('retries with the replay lock first when completion commits between peek and row lock', async () => {
    const organizer = await makePlayer();
    const id = await openTournament(organizer);
    await drawSingles(organizer, id, [await makePlayer(), await makePlayer()]);
    await playAll(organizer, id);
    const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const winnerSlot = final.winnerRegistrationId === final.registration1Id ? 1 : 2;
    const find = tournamentRepository.findById.bind(tournamentRepository);
    const acquire = skillRatingService.acquireReplayLock.bind(skillRatingService);
    const replay = skillRatingService.replayInTransaction.bind(skillRatingService);
    const held = new Set<unknown>();
    try {
      vi.spyOn(skillRatingService, 'acquireReplayLock').mockImplementation(async tx => { await acquire(tx); held.add(tx); });
      vi.spyOn(skillRatingService, 'replayInTransaction').mockImplementation(async (tx, trigger, cfg) => {
        expect(held.has(tx)).toBe(true);
        expect(cfg).toBeDefined();
        return replay(tx, trigger, cfg);
      });
      vi.spyOn(tournamentRepository, 'findById').mockImplementationOnce(async (...args) => {
        await complete(organizer, id);
        return find(...args);
      });
      const res = await api(organizer).put(`/api/v1/tournaments/${id}/matches/${final.id}/result`, { type: 'WALKOVER', winnerSlot });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
      expect(skillRatingService.replayInTransaction).toHaveBeenCalledTimes(2);
    } finally { vi.restoreAllMocks(); }
  });

  it('resets a player whose only rated match is corrected to a walkover', async () => {
    const organizer = await makePlayer();
    const strong = await makePlayer({ rank: 6 });
    const weak = await makePlayer({ rank: 2 });
    await duel(organizer, weak, strong);
    const { id, regs } = await duel(organizer, weak, strong);
    expect(await rankOf(strong)).toBe(5);
    // Correct both finals to walkovers (same winner): no rated match remains.
    for (const tid of [id]) {
      const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tid));
      const winnerSlot = final.winnerRegistrationId === final.registration1Id ? 1 : 2;
      const res = await api(organizer).put(`/api/v1/tournaments/${tid}/matches/${final.id}/result`, { type: 'WALKOVER', winnerSlot });
      expect(res.status, JSON.stringify(res.body)).toBe(200);
    }
    void regs;
    const me = await profile(strong);
    expect(me.ratedMatchCount).toBe(1);
    expect(await rankOf(strong)).toBe(6);
  });

  it('clears the cached rating when no rated match remains', async () => {
    const organizer = await makePlayer();
    const [a, b] = [await makePlayer(), await makePlayer()];
    const { id } = await duel(organizer, a, b);
    expect((await profile(b)).ratedMatchCount).toBe(1);
    const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, id));
    const winnerSlot = final.winnerRegistrationId === final.registration1Id ? 1 : 2;
    await api(organizer).put(`/api/v1/tournaments/${id}/matches/${final.id}/result`, { type: 'WALKOVER', winnerSlot });
    const me = await profile(b);
    expect(me).toMatchObject({ ratedMatchCount: 0, skillRating: null });
  });

  it('a completion and a correction on another tournament do not deadlock', async () => {
    const organizer = await makePlayer();
    const [a, b, c, d] = [await makePlayer(), await makePlayer(), await makePlayer(), await makePlayer()];
    const { id: done } = await duel(organizer, a, b);
    const open = await openTournament(organizer);
    await drawSingles(organizer, open, [c, d]);
    await playAll(organizer, open);
    const [final] = await db.select().from(tournamentMatches).where(eq(tournamentMatches.tournamentId, done));
    const slot = final.winnerRegistrationId === final.registration1Id ? 1 : 2;
    const sets = slot === 1 ? [{ team1Score: 21, team2Score: 3 }, { team1Score: 21, team2Score: 4 }] : [{ team1Score: 3, team2Score: 21 }, { team1Score: 4, team2Score: 21 }];
    const { versionOf } = await import('./tournament-test-kit');
    const [completed, corrected] = await Promise.all([
      api(organizer).post(`/api/v1/tournaments/${open}/complete`, { version: await versionOf(open) }),
      api(organizer).put(`/api/v1/tournaments/${done}/matches/${final.id}/result`, { type: 'SETS', sets }),
    ]);
    expect(completed.status, JSON.stringify(completed.body)).toBe(200);
    expect(corrected.status, JSON.stringify(corrected.body)).toBe(200);
  });

  it('numbers leaderboard positions inside a level filter', async () => {
    const organizer = await makePlayer();
    const [x, y] = [await makePlayer({ rank: 7 }), await makePlayer({ rank: 7 })];
    await duel(organizer, x, y);
    const [level] = await db.select().from(skillLevels).where(eq(skillLevels.rank, 7));
    const board = await api(x).get(`/api/v1/tournament-rankings?matchType=SINGLES&level=${level.id}&limit=50`);
    const ranks = (board.body.data as Array<{ position: number; player: { id: number } }>);
    expect(ranks[0].position).toBe(1);
    expect(ranks.map(r => r.position)).toEqual(ranks.map((_, i) => i + 1));
  });
});
