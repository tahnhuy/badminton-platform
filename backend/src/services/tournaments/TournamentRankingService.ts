import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { playerProfiles, skillLevels } from '../../db/schema/users';
import { tournamentRankingPoints, tournamentRegistrations, tournamentTeamPlayers, type tournaments } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';
import { skillRatingConfig } from '../../shared/config/skill-rating-config';
import type { Placement } from './placement/placement';
import { placementsOf } from './TournamentShareService';

/**
 * Achievement ranking (PRD FR-82/83, Decision #27, Tech Design §7.11; TRN-18). Separate from
 * skill levels: points per placement, weighted by field strength and size; a leaderboard sums
 * the best N results inside a rolling window.
 */

type TournamentRow = typeof tournaments.$inferSelect;
type Executor = typeof db | TransactionContext;

const BASE: Record<string, number> = { CHAMPION: 100, RUNNER_UP: 70, SEMI_FINAL: 50, QUARTER_FINAL: 30 };
export const basePoints = (placement: Placement | string) => BASE[placement] ?? 10;

/** points = base(placement) × (mean level rank of the field ÷ 4) × min(1, N/8), 2 decimals. */
export function rankingPoints(placement: Placement | string, meanRank: number, fieldSize: number): number {
  return Math.round(basePoints(placement) * (meanRank / 4) * Math.min(1, fieldSize / 8) * 100) / 100;
}

export interface LeaderboardRow {
  position: number;
  player: { id: number; fullName: string; avatarUrl: string | null; level: { id: number; name: string; rank: number } | null };
  totalPoints: number;
  tournamentsCounted: number;
  bestPoints: number;
}

async function participants(tournamentId: number, tx: Executor) {
  const regs = await tx.select({ id: tournamentRegistrations.id, playerId: tournamentRegistrations.playerId, teamId: tournamentRegistrations.teamId })
    .from(tournamentRegistrations)
    .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), eq(tournamentRegistrations.status, 'CONFIRMED')));
  const teamIds = regs.map(r => r.teamId).filter((id): id is number => id !== null);
  const members = teamIds.length === 0 ? [] : await tx.select({ teamId: tournamentTeamPlayers.teamId, playerId: tournamentTeamPlayers.playerId })
    .from(tournamentTeamPlayers).where(and(inArray(tournamentTeamPlayers.teamId, teamIds), sql`${tournamentTeamPlayers.leftAt} IS NULL`));
  return regs.map(r => ({ id: r.id, players: r.playerId !== null ? [r.playerId] : members.filter(m => m.teamId === r.teamId).map(m => m.playerId) }));
}

export class TournamentRankingService {
  /**
   * Writes one row per participant (both Doubles members). At completion the field strength is
   * the mean level rank before this tournament's level review; a correction keeps that factor.
   */
  async writeForTournament(t: TournamentRow, tx: TransactionContext, mode: 'completion' | 'correction'): Promise<number> {
    const regs = await participants(t.id, tx);
    if (regs.length === 0 || !t.completedAt) return 0;
    const placements = await placementsOf(t.id, tx);
    let meanRank: number;
    const existing = await tx.select().from(tournamentRankingPoints).where(eq(tournamentRankingPoints.tournamentId, t.id)).limit(1);
    if (mode === 'correction' && existing[0]) {
      // Recover the stored factor: points / (base × size factor) × 4.
      const sizeFactor = Math.min(1, regs.length / 8);
      meanRank = (Number(existing[0].points) / (basePoints(existing[0].placement) * sizeFactor)) * 4;
    } else {
      const players = regs.flatMap(r => r.players);
      const ranks = await tx.select({ id: playerProfiles.userId, rank: skillLevels.rank }).from(playerProfiles)
        .innerJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId)).where(inArray(playerProfiles.userId, players));
      // Doubles: the mean over teams of the team's mean member rank.
      const teamRanks = regs.map(r => {
        const values = r.players.map(id => ranks.find(x => x.id === id)?.rank ?? 4);
        return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
      });
      meanRank = teamRanks.reduce((a, b) => a + b, 0) / teamRanks.length;
    }
    await tx.delete(tournamentRankingPoints).where(eq(tournamentRankingPoints.tournamentId, t.id));
    const rows = regs.flatMap(r => {
      const placement = placements.get(r.id);
      if (!placement) return [];
      const points = rankingPoints(placement, meanRank, regs.length);
      return r.players.map(playerId => ({
        playerId, tournamentId: t.id, matchType: t.matchType, placement, points: points.toFixed(2), completedAt: t.completedAt!,
      }));
    });
    if (rows.length > 0) await tx.insert(tournamentRankingPoints).values(rows);
    return rows.length;
  }

  /** GET /tournament-rankings — best N in the window; ties: best single result, then earliest reach. */
  async leaderboard(query: { matchType: 'SINGLES' | 'DOUBLES'; levelId?: number; page: number; limit: number }) {
    const cfg = await skillRatingConfig.get();
    const since = new Date();
    since.setMonth(since.getMonth() - cfg.rankingWindowMonths);
    const levelFilter = query.levelId ? sql`AND pp.skill_level_id = ${query.levelId}` : sql``;
    const base = sql`
      WITH ranked AS (
        SELECT p.player_id, p.points, p.completed_at,
          row_number() OVER (PARTITION BY p.player_id ORDER BY p.points DESC, p.completed_at ASC, p.id ASC) AS rn
        FROM tournament_ranking_points p
        WHERE p.match_type = ${query.matchType} AND p.completed_at >= ${since.toISOString().slice(0, 19).replace('T', ' ')}::timestamp
      ), best AS (
        SELECT player_id, sum(points) AS total, count(*)::int AS counted, max(points) AS top, max(completed_at) AS reached
        FROM ranked WHERE rn <= ${cfg.rankingBestN} GROUP BY player_id
      ), board AS (
        SELECT b.*, row_number() OVER (ORDER BY b.total DESC, b.top DESC, b.reached ASC, b.player_id ASC)::int AS position
        FROM best b JOIN users u ON u.id = b.player_id AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
      )`;
    const result = await db.execute(sql`${base}
      SELECT board.position, board.player_id, board.total, board.counted, board.top,
        pp.full_name, pp.avatar_url, sl.id AS level_id, sl.name AS level_name, sl.rank AS level_rank,
        count(*) OVER ()::int AS total_rows
      FROM board JOIN player_profiles pp ON pp.user_id = board.player_id
      LEFT JOIN skill_levels sl ON sl.id = pp.skill_level_id
      WHERE true ${levelFilter}
      ORDER BY board.position
      LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`);
    const rows = result.rows as Array<Record<string, unknown>>;
    const total = rows.length > 0 ? Number(rows[0].total_rows) : 0;
    const items: LeaderboardRow[] = rows.map(r => ({
      position: Number(r.position),
      player: {
        id: Number(r.player_id), fullName: String(r.full_name), avatarUrl: (r.avatar_url as string | null) ?? null,
        level: r.level_id ? { id: Number(r.level_id), name: String(r.level_name), rank: Number(r.level_rank) } : null,
      },
      totalPoints: Number(r.total), tournamentsCounted: Number(r.counted), bestPoints: Number(r.top),
    }));
    return { items, meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit), bestN: cfg.rankingBestN, windowMonths: cfg.rankingWindowMonths } };
  }

  /** Position of one player in both leaderboards (profile card). */
  async ofPlayer(playerId: number): Promise<Record<'SINGLES' | 'DOUBLES', { position: number; totalPoints: number; tournamentsCounted: number } | null>> {
    const out = { SINGLES: null, DOUBLES: null } as Record<'SINGLES' | 'DOUBLES', { position: number; totalPoints: number; tournamentsCounted: number } | null>;
    for (const matchType of ['SINGLES', 'DOUBLES'] as const) {
      // Small data (Tech Design §7.11): reuse the leaderboard query over all rows.
      const board = await this.leaderboard({ matchType, page: 1, limit: 10_000 });
      const row = board.items.find(i => i.player.id === playerId);
      out[matchType] = row ? { position: row.position, totalPoints: row.totalPoints, tournamentsCounted: row.tournamentsCounted } : null;
    }
    return out;
  }
}

export const tournamentRankingService = new TournamentRankingService();
