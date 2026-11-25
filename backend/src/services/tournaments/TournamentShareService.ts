import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users, playerProfiles } from '../../db/schema/users';
import { posts } from '../../db/schema/social';
import { tournamentMatches, tournamentRankingPoints, tournamentRegistrations, tournamentTeamPlayers, tournamentTeams, tournaments } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { registerTournamentResultCardPort, type TournamentResultCard } from '../../contracts/TournamentResultCardPort';
import { AppError, NotFoundError } from '../../errors/AppError';
import { tournamentRepository } from '../../repositories/tournaments/TournamentRepository';
import { canonicalHash } from '../social/social-common';
import { computePlacements, isTopFour, type Placement } from './placement/placement';
import type { TournamentViewer } from './TournamentService';

/**
 * Placements, profile tournament history and the Social result post
 * (PRD FR-70/71, Tech Design §3.4b, §7.6, §7.7; TRN-16).
 */

type Executor = typeof db | TransactionContext;

export interface HistoryItem {
  tournament: { id: number; name: string; matchType: string; tournamentStart: string; completedAt: string | null };
  placement: Placement | null;
  teamName: string | null;
  partner: { id: number; fullName: string; avatarUrl: string | null } | null;
  rankingPoints: number | null;
}

const err = {
  notFound: () => new NotFoundError('Tournament not found', 'TOURNAMENT_NOT_FOUND'),
  playerNotFound: () => new NotFoundError('Hồ sơ không khả dụng.', 'PLAYER_NOT_FOUND'),
  notAllowed: () => new AppError('TOURNAMENT_SHARE_NOT_ALLOWED', 403, 'Only the Organizer or a top-4 player of a completed tournament can share'),
  alreadyShared: () => new AppError('TOURNAMENT_ALREADY_SHARED', 409, 'You already shared this tournament'),
};

/** registration id → placement for one tournament (computed on read, no table). */
export async function placementsOf(tournamentId: number, executor: Executor = db): Promise<Map<number, Placement>> {
  const rows = await executor.select({
    roundIndex: tournamentMatches.roundIndex, registration1Id: tournamentMatches.registration1Id, registration2Id: tournamentMatches.registration2Id,
    winnerRegistrationId: tournamentMatches.winnerRegistrationId, resolution: tournamentMatches.resolution,
  }).from(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournamentId));
  if (rows.length === 0) return new Map();
  const totalRounds = Math.max(...rows.map(r => r.roundIndex)) + 1;
  return computePlacements(rows, totalRounds);
}

/** registration id → user ids (Singles player or the team members of a registered team). */
async function registrationPlayers(tournamentIds: number[], executor: Executor) {
  if (tournamentIds.length === 0) return [];
  const regs = await executor.select({ id: tournamentRegistrations.id, tournamentId: tournamentRegistrations.tournamentId, playerId: tournamentRegistrations.playerId, teamId: tournamentRegistrations.teamId })
    .from(tournamentRegistrations)
    .where(and(inArray(tournamentRegistrations.tournamentId, tournamentIds), eq(tournamentRegistrations.status, 'CONFIRMED')));
  const teamIds = regs.map(r => r.teamId).filter((id): id is number => id !== null);
  const members = teamIds.length === 0 ? [] : await executor.select({ teamId: tournamentTeamPlayers.teamId, playerId: tournamentTeamPlayers.playerId })
    .from(tournamentTeamPlayers).where(and(inArray(tournamentTeamPlayers.teamId, teamIds), isNull(tournamentTeamPlayers.leftAt)));
  const teams = teamIds.length === 0 ? [] : await executor.select({ id: tournamentTeams.id, name: tournamentTeams.name }).from(tournamentTeams).where(inArray(tournamentTeams.id, teamIds));
  return regs.map(r => ({
    ...r,
    players: r.playerId !== null ? [r.playerId] : members.filter(m => m.teamId === r.teamId).map(m => m.playerId),
    teamName: r.teamId === null ? null : teams.find(t => t.id === r.teamId)?.name ?? null,
  }));
}

async function names(ids: number[], executor: Executor) {
  if (ids.length === 0) return new Map<number, { id: number; fullName: string; avatarUrl: string | null }>();
  const rows = await executor.select({ id: playerProfiles.userId, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl })
    .from(playerProfiles).where(inArray(playerProfiles.userId, [...new Set(ids)]));
  return new Map(rows.map(r => [r.id, r]));
}

export class TournamentShareService {
  /** GET /players/:id/tournaments — completed tournaments with placements (public profile visibility). */
  async history(playerId: number, page: number, limit: number): Promise<{ items: HistoryItem[]; meta: { page: number; limit: number; total: number; totalPages: number } }> {
    const [user] = await db.select({ id: users.id }).from(users)
      .where(and(eq(users.id, playerId), eq(users.role, 'PLAYER'), eq(users.status, 'ACTIVE'), isNull(users.deletedAt))).limit(1);
    if (!user) throw err.playerNotFound();
    const condition = and(eq(tournaments.status, 'COMPLETED'), isNull(tournaments.deletedAt), tournamentRepository.registeredByCondition(playerId));
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(tournaments).where(condition);
    const rows = await db.select().from(tournaments).where(condition)
      .orderBy(desc(tournaments.completedAt), desc(tournaments.id)).limit(limit).offset((page - 1) * limit);
    const regs = await registrationPlayers(rows.map(r => r.id), db);
    const partners = await names(regs.flatMap(r => r.players), db);
    const points = await this.rankingPointsFor(playerId, rows.map(r => r.id));
    const items: HistoryItem[] = [];
    for (const t of rows) {
      const mine = regs.find(r => r.tournamentId === t.id && r.players.includes(playerId));
      const placement = mine ? (await placementsOf(t.id)).get(mine.id) ?? null : null;
      const partnerId = mine?.players.find(id => id !== playerId);
      items.push({
        tournament: { id: t.id, name: t.name, matchType: t.matchType, tournamentStart: t.tournamentStart.toISOString(), completedAt: t.completedAt?.toISOString() ?? null },
        placement, teamName: mine?.teamName ?? null,
        partner: partnerId ? partners.get(partnerId) ?? { id: partnerId, fullName: 'Người chơi', avatarUrl: null } : null,
        rankingPoints: points.get(t.id) ?? null,
      });
    }
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** Achievement points of the player per tournament (TRN-18). */
  private async rankingPointsFor(playerId: number, tournamentIds: number[]): Promise<Map<number, number>> {
    if (tournamentIds.length === 0) return new Map();
    const rows = await db.select({ tournamentId: tournamentRankingPoints.tournamentId, points: tournamentRankingPoints.points })
      .from(tournamentRankingPoints)
      .where(and(eq(tournamentRankingPoints.playerId, playerId), inArray(tournamentRankingPoints.tournamentId, tournamentIds)));
    return new Map(rows.map(r => [r.tournamentId, Number(r.points)]));
  }

  /** Placement of a user in a tournament (both members for Doubles). */
  async placementOfUser(tournamentId: number, userId: number, executor: Executor = db): Promise<Placement | null> {
    const regs = await registrationPlayers([tournamentId], executor);
    const mine = regs.find(r => r.players.includes(userId));
    return mine ? (await placementsOf(tournamentId, executor)).get(mine.id) ?? null : null;
  }

  /** viewer.canShare / viewer.sharedPostId of the detail (Tech Design §3.4b). */
  async viewerShare(tournamentId: number, status: string, creatorId: number, viewerId: number): Promise<{ canShare: boolean; sharedPostId: number | null }> {
    if (status !== 'COMPLETED') return { canShare: false, sharedPostId: null };
    const [post] = await db.select({ id: posts.id }).from(posts)
      .where(and(eq(posts.authorId, viewerId), eq(posts.tournamentId, tournamentId), eq(posts.type, 'TOURNAMENT_RESULT'), isNull(posts.deletedAt))).limit(1);
    const allowed = creatorId === viewerId || isTopFour((await this.placementOfUser(tournamentId, viewerId)) ?? undefined);
    return { canShare: allowed && !post, sharedPostId: post?.id ?? null };
  }

  /** POST /:id/share — one TOURNAMENT_RESULT post per user and tournament (Tech Design §7.7). */
  async share(actor: TournamentViewer, tournamentId: number, body?: string | null): Promise<{ postId: number }> {
    return db.transaction(async tx => {
      const t = await tournamentRepository.findById(tournamentId, tx, { lock: true });
      if (!t || (t.status === 'DRAFT' && t.creatorId !== actor.id)) throw err.notFound();
      if (t.status !== 'COMPLETED') throw err.notAllowed();
      const allowed = t.creatorId === actor.id || isTopFour((await this.placementOfUser(t.id, actor.id, tx)) ?? undefined);
      if (!allowed) throw err.notAllowed();
      const text = body?.trim() ? body.trim() : null;
      const now = new Date();
      try {
        const [row] = await tx.insert(posts).values({
          authorId: actor.id, type: 'TOURNAMENT_RESULT', tournamentId: t.id, body: text, publishedAt: now,
          creationHash: canonicalHash({ v: 1, type: 'TOURNAMENT_RESULT', tournamentId: t.id, authorId: actor.id, body: text, at: now.toISOString() }),
        }).returning({ id: posts.id });
        return { postId: row.id };
      } catch (error) {
        const pg = error as { constraint?: string; cause?: { constraint?: string } };
        if ((pg.constraint ?? pg.cause?.constraint) === 'uq_posts_author_tournament_result') throw err.alreadyShared();
        throw error;
      }
    });
  }

  /** Feed card projection for TOURNAMENT_RESULT posts (Social port). */
  async getCards(rows: ReadonlyArray<{ id: number; authorId: number; tournamentId: number }>, reader: Executor = db): Promise<Map<number, TournamentResultCard>> {
    const result = new Map<number, TournamentResultCard>();
    const ids = [...new Set(rows.map(r => r.tournamentId))];
    if (ids.length === 0) return result;
    const ts = await reader.select().from(tournaments).where(inArray(tournaments.id, ids));
    const regs = await registrationPlayers(ids, reader);
    const people = await names(regs.flatMap(r => r.players), reader);
    const label = (reg?: { players: number[]; teamName: string | null }) =>
      reg ? reg.teamName ?? reg.players.map(id => people.get(id)?.fullName ?? 'Người chơi').join(' / ') : null;
    const byTournament = new Map<number, { champion: string | null; runnerUp: string | null; placements: Map<number, Placement> }>();
    for (const t of ts) {
      const placements = await placementsOf(t.id, reader);
      const find = (p: Placement) => regs.find(r => r.tournamentId === t.id && placements.get(r.id) === p);
      byTournament.set(t.id, { champion: label(find('CHAMPION')), runnerUp: label(find('RUNNER_UP')), placements });
    }
    for (const row of rows) {
      const t = ts.find(x => x.id === row.tournamentId);
      const info = byTournament.get(row.tournamentId);
      if (!t || !info) continue;
      const mine = regs.find(r => r.tournamentId === t.id && r.players.includes(row.authorId));
      result.set(row.id, {
        tournament: { id: t.id, name: t.name, matchType: t.matchType, completedAt: t.completedAt?.toISOString() ?? null, tournamentEnd: t.tournamentEnd.toISOString() },
        champion: info.champion, runnerUp: info.runnerUp,
        authorPlacement: t.creatorId === row.authorId ? 'ORGANIZER' : mine ? info.placements.get(mine.id) ?? null : null,
      });
    }
    return result;
  }
}

export const tournamentShareService = new TournamentShareService();
registerTournamentResultCardPort({ getCards: (rows, reader) => tournamentShareService.getCards(rows, reader ?? db) });
