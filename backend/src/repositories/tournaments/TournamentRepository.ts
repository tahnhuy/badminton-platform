import { and, asc, eq, gte, inArray, isNull, lte, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { playerProfiles, skillLevels } from '../../db/schema/users';
import { tournaments, tournamentRegistrations, tournamentMatches } from '../../db/schema/tournaments';
import type { TransactionContext } from '../../contracts/TransactionContext';

type Executor = typeof db | TransactionContext;

export type TournamentRow = typeof tournaments.$inferSelect;
export type NewTournamentRow = typeof tournaments.$inferInsert;

export interface SkillLevelRef { id: number; code: string; name: string; rank: number }

export interface TournamentListFilter {
  statuses?: string[];
  creatorId?: number;
  ids?: SQL;
  matchType?: string;
  free?: boolean;
  eligibleRank?: number;
  from?: Date;
  to?: Date;
  q?: string;
  page: number;
  limit: number;
}

export const tournamentRepository = {
  async insert(values: NewTournamentRow, executor: Executor = db): Promise<TournamentRow> {
    const [row] = await executor.insert(tournaments).values(values).returning();
    return row;
  },

  async findById(id: number, executor: Executor = db, options: { lock?: boolean } = {}): Promise<TournamentRow | null> {
    const base = executor.select().from(tournaments).where(and(eq(tournaments.id, id), isNull(tournaments.deletedAt))).limit(1);
    const [row] = options.lock ? await base.for('update') : await base;
    return row ?? null;
  },

  async update(id: number, patch: Partial<NewTournamentRow>, executor: Executor): Promise<TournamentRow> {
    const [row] = await executor.update(tournaments)
      .set({ ...patch, version: sql`${tournaments.version} + 1`, updatedAt: new Date() })
      .where(eq(tournaments.id, id))
      .returning();
    return row;
  },

  async countConfirmed(tournamentId: number, executor: Executor = db): Promise<number> {
    const [row] = await executor.select({ n: sql<number>`count(*)::int` }).from(tournamentRegistrations)
      .where(and(eq(tournamentRegistrations.tournamentId, tournamentId), eq(tournamentRegistrations.status, 'CONFIRMED')));
    return row.n;
  },

  async listSkillLevels(executor: Executor = db): Promise<SkillLevelRef[]> {
    return executor.select({ id: skillLevels.id, code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank })
      .from(skillLevels).orderBy(asc(skillLevels.rank));
  },

  async findPlayerRank(userId: number, executor: Executor = db): Promise<number | null> {
    const [row] = await executor.select({ rank: skillLevels.rank }).from(playerProfiles)
      .innerJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(eq(playerProfiles.userId, userId)).limit(1);
    return row?.rank ?? null;
  },

  async findOrganizers(userIds: number[]): Promise<Map<number, { id: number; fullName: string; avatarUrl: string | null }>> {
    if (userIds.length === 0) return new Map();
    const rows = await db.select({ id: playerProfiles.userId, fullName: playerProfiles.fullName, avatarUrl: playerProfiles.avatarUrl })
      .from(playerProfiles).where(inArray(playerProfiles.userId, [...new Set(userIds)]));
    return new Map(rows.map(row => [row.id, row]));
  },

  async confirmedCounts(tournamentIds: number[]): Promise<Map<number, number>> {
    if (tournamentIds.length === 0) return new Map();
    const rows = await db.select({ id: tournamentRegistrations.tournamentId, n: sql<number>`count(*)::int` })
      .from(tournamentRegistrations)
      .where(and(inArray(tournamentRegistrations.tournamentId, tournamentIds), eq(tournamentRegistrations.status, 'CONFIRMED')))
      .groupBy(tournamentRegistrations.tournamentId);
    return new Map(rows.map(row => [row.id, row.n]));
  },

  /** The viewer's CONFIRMED registration (Singles: own; Doubles: through an active team membership). */
  async findViewerRegistration(tournamentId: number, userId: number, executor: Executor = db): Promise<{ id: number; teamId: number | null } | null> {
    const [row] = await executor.select({ id: tournamentRegistrations.id, teamId: tournamentRegistrations.teamId })
      .from(tournamentRegistrations)
      .where(and(
        eq(tournamentRegistrations.tournamentId, tournamentId),
        eq(tournamentRegistrations.status, 'CONFIRMED'),
        sql`(${tournamentRegistrations.playerId} = ${userId} OR ${tournamentRegistrations.teamId} IN (
          SELECT tp.team_id FROM tournament_team_players tp
          WHERE tp.tournament_id = ${tournamentId} AND tp.player_id = ${userId} AND tp.left_at IS NULL))`,
      ))
      .limit(1);
    return row ?? null;
  },

  async list(filter: TournamentListFilter): Promise<{ rows: TournamentRow[]; total: number }> {
    const conditions: SQL[] = [isNull(tournaments.deletedAt)];
    if (filter.creatorId !== undefined) conditions.push(eq(tournaments.creatorId, filter.creatorId));
    else conditions.push(sql`${tournaments.status} <> 'DRAFT'`);
    if (filter.ids) conditions.push(filter.ids);
    if (filter.statuses?.length) conditions.push(inArray(tournaments.status, filter.statuses));
    if (filter.matchType) conditions.push(eq(tournaments.matchType, filter.matchType));
    if (filter.free === true) conditions.push(sql`${tournaments.entryFee} = 0`);
    if (filter.free === false) conditions.push(sql`${tournaments.entryFee} > 0`);
    // Column operators map the Date like the column (raw params would shift by the server offset).
    if (filter.from) conditions.push(gte(tournaments.tournamentStart, filter.from));
    if (filter.to) conditions.push(lte(tournaments.tournamentStart, filter.to));
    if (filter.q) conditions.push(sql`${tournaments.name} ILIKE ${'%' + filter.q.replace(/[\\%_]/g, c => '\\' + c) + '%'}`);
    if (filter.eligibleRank !== undefined) {
      conditions.push(sql`(${tournaments.minSkillLevelId} IS NULL OR (SELECT rank FROM skill_levels WHERE id = ${tournaments.minSkillLevelId}) <= ${filter.eligibleRank})`);
      conditions.push(sql`(${tournaments.maxSkillLevelId} IS NULL OR (SELECT rank FROM skill_levels WHERE id = ${tournaments.maxSkillLevelId}) >= ${filter.eligibleRank})`);
    }
    const where = and(...conditions);
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(tournaments).where(where);
    // Discovery order: open for registration first, then live, upcoming, finished.
    const rows = await db.select().from(tournaments).where(where)
      .orderBy(
        sql`CASE ${tournaments.status} WHEN 'OPEN_FOR_REGISTRATION' THEN 0 WHEN 'IN_PROGRESS' THEN 1 WHEN 'READY' THEN 2
          WHEN 'REGISTRATION_CLOSED' THEN 2 WHEN 'DRAFT' THEN 3 WHEN 'COMPLETED' THEN 4 ELSE 5 END`,
        sql`CASE WHEN ${tournaments.status} IN ('COMPLETED', 'CANCELLED') THEN NULL ELSE ${tournaments.tournamentStart} END ASC NULLS LAST`,
        sql`${tournaments.tournamentStart} DESC`,
        sql`${tournaments.id} DESC`,
      )
      .limit(filter.limit).offset((filter.page - 1) * filter.limit);
    return { rows, total };
  },

  /** Tournaments where the user holds a CONFIRMED registration (directly or via a team). */
  registeredByCondition(userId: number): SQL {
    return sql`${tournaments.id} IN (
      SELECT r.tournament_id FROM tournament_registrations r
      WHERE r.status = 'CONFIRMED' AND (r.player_id = ${userId} OR r.team_id IN (
        SELECT tp.team_id FROM tournament_team_players tp WHERE tp.player_id = ${userId} AND tp.left_at IS NULL)))`;
  },

  /** Tournaments where the user has a PENDING team invitation. */
  invitedCondition(userId: number): SQL {
    return sql`${tournaments.id} IN (
      SELECT t.tournament_id FROM team_invitations i JOIN tournament_teams t ON t.id = i.team_id
      WHERE i.invitee_id = ${userId} AND i.status = 'PENDING')`;
  },

  /** Final match of the bracket (highest round), or null before the draw. */
  async findFinalMatch(tournamentId: number, executor: Executor = db) {
    const [row] = await executor.select().from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, tournamentId))
      .orderBy(sql`${tournamentMatches.roundIndex} DESC`, asc(tournamentMatches.matchIndex))
      .limit(1);
    return row ?? null;
  },
};
