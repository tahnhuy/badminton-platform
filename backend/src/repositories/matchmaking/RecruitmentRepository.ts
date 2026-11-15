import { and, eq, inArray, sql, type AnyColumn, type SQL } from 'drizzle-orm';
import {
  db,
  matchmakingRequests,
  matchmakingInvitations,
  playerProfiles,
  skillLevels,
  users,
} from '../../db';
import type { NormalizedExternalCourt, RecruitmentFeedFilter } from '../../contracts/RecruitmentPort';
import { effectiveRecruitmentStatusSql } from '../../services/matchmaking/recruitment-state';

// MM-23 recruitment persistence (database-schema.md §13.3; Matchmaking Tech Design §24.4,
// §24.14). Reads/writes matchmaking tables only; Social tables are reached through
// PostContentPort, never from here.

type Executor = any;

const TZ = 'Asia/Ho_Chi_Minh';

export interface NewRecruitmentRow {
  playerId: number;
  postId: number;
  matchType: string;
  startAt: Date;
  durationMinutes: number;
  capacity: number;
  minPlayers: number;
  companionCount: number;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  costNote: string | null;
}

export type RecruitmentFieldUpdate = Partial<Omit<NewRecruitmentRow, 'playerId' | 'postId'>>;

/** Effective-OPEN predicate (lazy expiry, Tech Design §24.4 "Effective status on read"). */
const effectiveOpenSql = (alias: string) =>
  sql.raw(`(${alias}.status = 'OPEN' AND (${alias}.expires_at IS NULL OR ${alias}.expires_at > now()))`);

const acceptedCountSql = (alias: string) =>
  sql.raw(`(SELECT count(*)::int FROM matchmaking_invitations mi WHERE mi.request_id = ${alias}.id AND mi.status = 'ACCEPTED')`);

const activeMatchExistsSql = (alias: string) => sql.raw(`EXISTS (
  SELECT 1 FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id
  WHERE mm.matchmaking_request_id = ${alias}.id AND mm.status = 'MATCHED'
    AND m.status IN ('PENDING_COURT', 'CONFIRMED', 'IN_PROGRESS'))`);

export class RecruitmentRepository {
  async insertRecruitment(input: NewRecruitmentRow & { externalCourt?: NormalizedExternalCourt | null }, tx: Executor) {
    const { externalCourt, ...row } = input;
    const [inserted] = await tx
      .insert(matchmakingRequests)
      .values({
        ...row,
        // MM-28: optional external court at creation (all four fields or none, §13.3).
        externalCourtName: externalCourt?.name ?? null,
        externalCourtCity: externalCourt?.city ?? null,
        externalCourtDistrict: externalCourt?.district ?? null,
        externalCourtAddress: externalCourt?.address ?? null,
        status: 'OPEN',
        // §13.3: new rows set expires_at = start_at; legacy window columns stay NULL.
        expiresAt: row.startAt,
      })
      .returning({ id: matchmakingRequests.id });
    return inserted.id as number;
  }

  async updateRecruitmentFields(requestId: number, update: RecruitmentFieldUpdate, tx: Executor): Promise<void> {
    const values: Record<string, unknown> = { ...update, updatedAt: new Date() };
    if (update.startAt) values.expiresAt = update.startAt;
    await tx.update(matchmakingRequests).set(values).where(eq(matchmakingRequests.id, requestId));
  }

  /**
   * §24.14: hosted recruitments that have not ended — effective OPEN (unpublished or
   * published), or MATCHED whose Match is PENDING_COURT/CONFIRMED/IN_PROGRESS.
   */
  async countOpenPostsForHost(hostId: number, tx: Executor): Promise<number> {
    const result = await tx.execute(sql`
      SELECT count(*)::int AS n FROM matchmaking_requests r
      WHERE r.player_id = ${hostId}
        AND (${effectiveOpenSql('r')} OR (r.status = 'MATCHED' AND ${activeMatchExistsSql('r')}))
    `);
    return Number(result.rows[0]?.n ?? 0);
  }

  async findRecruitmentByPostId(postId: number, executor: Executor = db) {
    const rows = await executor.select().from(matchmakingRequests).where(eq(matchmakingRequests.postId, postId)).limit(1);
    return rows[0] ?? null;
  }

  /** Field locks survive withdrawal: the first acceptance is historical, not current membership. */
  async hasAcceptanceHistory(requestId: number, executor: Executor): Promise<boolean> {
    const [row] = await executor.select({ id: matchmakingInvitations.id })
      .from(matchmakingInvitations)
      .where(and(eq(matchmakingInvitations.requestId, requestId),
        inArray(matchmakingInvitations.status, ['ACCEPTED', 'WITHDRAWN'])))
      .limit(1);
    return Boolean(row);
  }

  async findSkillLevels(ids: number[], executor: Executor = db) {
    if (ids.length === 0) return [];
    return executor
      .select({ id: skillLevels.id, name: skillLevels.name, rank: skillLevels.rank })
      .from(skillLevels)
      .where(inArray(skillLevels.id, ids));
  }

  /** One row per post with effective status, counts, ended flag and skill names (batched). */
  async findCardRows(postIds: readonly number[], executor: Executor = db) {
    if (postIds.length === 0) return [];
    const ids = sql.join(postIds.map(id => sql`${id}`), sql`, `);
    const result = await executor.execute(sql`
      SELECT r.id, r.post_id, r.player_id, r.match_type, r.status, r.expires_at, r.start_at,
        r.duration_minutes, r.capacity, r.min_players, r.companion_count, r.cost_note,
        r.external_court_name, r.external_court_city, r.external_court_district, r.external_court_address,
        r.min_skill_level_id, smin.name AS min_skill_name, r.max_skill_level_id, smax.name AS max_skill_name,
        ${acceptedCountSql('r')} AS accepted_count,
        ${effectiveRecruitmentStatusSql('r')} AS effective_status,
        ${effectiveOpenSql('r')} AS effective_open,
        ${this.ended('r')} AS ended
      FROM matchmaking_requests r
      LEFT JOIN skill_levels smin ON smin.id = r.min_skill_level_id
      LEFT JOIN skill_levels smax ON smax.id = r.max_skill_level_id
      WHERE r.post_id IN (${ids})
    `);
    return result.rows as any[];
  }

  /** Accepted members (name, avatar) of the given requests, visible to any Player (§8.3). */
  async findAcceptedMembers(requestIds: readonly number[], executor: Executor = db) {
    if (requestIds.length === 0) return [];
    return executor
      .select({
        requestId: matchmakingInvitations.requestId,
        playerId: matchmakingInvitations.playerId,
        displayName: playerProfiles.fullName,
        avatarUrl: playerProfiles.avatarUrl,
      })
      .from(matchmakingInvitations)
      .innerJoin(users, eq(users.id, matchmakingInvitations.playerId))
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(and(inArray(matchmakingInvitations.requestId, [...requestIds]), eq(matchmakingInvitations.status, 'ACCEPTED')))
      .orderBy(matchmakingInvitations.respondedAt, matchmakingInvitations.id);
  }

  /** Viewer's active membership rows: ACCEPTED, or PENDING not yet expired. */
  async findViewerMemberships(requestIds: readonly number[], viewerId: number, executor: Executor = db) {
    if (requestIds.length === 0) return [];
    const ids = sql.join(requestIds.map(id => sql`${id}`), sql`, `);
    const result = await executor.execute(sql`
      SELECT mi.request_id, mi.status FROM matchmaking_invitations mi
      WHERE mi.request_id IN (${ids}) AND mi.player_id = ${viewerId}
        AND (mi.status = 'ACCEPTED' OR (mi.status = 'PENDING' AND mi.expires_at > now()))
    `);
    return result.rows as { request_id: number | string; status: 'ACCEPTED' | 'PENDING' }[];
  }

  /** Ended: terminal, effectively expired, past start, or MATCHED whose Match is terminal. */
  ended(alias: string): SQL {
    return sql.raw(`(
      ${alias}.status IN ('CANCELLED', 'EXPIRED')
      OR (${alias}.status = 'OPEN' AND ${alias}.expires_at IS NOT NULL AND ${alias}.expires_at <= now())
      OR ${alias}.start_at <= now()
      OR (${alias}.status = 'MATCHED' AND NOT EXISTS (
        SELECT 1 FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id
        WHERE mm.matchmaking_request_id = ${alias}.id AND mm.status = 'MATCHED'
          AND m.status IN ('PENDING_COURT', 'CONFIRMED', 'IN_PROGRESS')))
    )`);
  }

  /** EXISTS condition over `postId` for the feed (Social Tech Design §7.6). */
  feedFilter(postId: AnyColumn | SQL, filter: RecruitmentFeedFilter): SQL {
    // A sealed roster leaves the feed. Reopening the recruitment restores it naturally.
    const conditions: SQL[] = [sql`fr.post_id = ${postId}`, sql`fr.status <> 'MATCHED'`];
    if (filter.matchType) conditions.push(sql`fr.match_type = ${filter.matchType}`);
    if (filter.date) conditions.push(sql`(fr.start_at AT TIME ZONE ${TZ})::date = ${filter.date}::date`);
    if (filter.timeFrom) conditions.push(sql`(fr.start_at AT TIME ZONE ${TZ})::time >= ${filter.timeFrom}::time`);
    if (filter.timeTo) conditions.push(sql`(fr.start_at AT TIME ZONE ${TZ})::time <= ${filter.timeTo}::time`);
    if (filter.city) conditions.push(sql`fr.external_court_city = ${filter.city}`);
    if (filter.district) conditions.push(sql`fr.external_court_district = ${filter.district}`);
    if (filter.skillLevelId !== undefined) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM skill_levels target, skill_levels smin, skill_levels smax
        WHERE target.id = ${filter.skillLevelId} AND smin.id = fr.min_skill_level_id AND smax.id = fr.max_skill_level_id
          AND target.rank BETWEEN smin.rank AND smax.rank)`);
    }
    if (filter.hasOpenSlots) {
      conditions.push(sql`${effectiveOpenSql('fr')} AND 1 + fr.companion_count + ${acceptedCountSql('fr')} < fr.capacity`);
    }
    if (!filter.includeEnded) conditions.push(sql`NOT ${this.ended('fr')}`);
    return sql`EXISTS (SELECT 1 FROM matchmaking_requests fr WHERE ${sql.join(conditions, sql` AND `)})`;
  }
}

export const recruitmentRepository = new RecruitmentRepository();
