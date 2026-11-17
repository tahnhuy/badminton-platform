import {
  db,
  matchmakingRequests,
  matchmakingInvitations,
  matchmakingMatches,
  matches,
  matchPlayers,
  matchBookingCancellationJobs,
  users,
  playerProfiles,
  skillLevels,
  bookings,
  courts,
  facilities,
} from '../../db';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';
import { effectiveRecruitmentStatusSql, rosterSufficientSql } from '../../services/matchmaking/recruitment-state';

type Executor = any;

export interface NewRequestData {
  playerId: number;
  postId: number;
  matchType: string;
  minSkillLevelId: number;
  maxSkillLevelId: number;
  preferredDate: string;
  preferredStartTime: string;
  preferredEndTime: string;
  area: string;
  matchDurationMinutes: number;
  expiresAt: Date;
  startAt: Date;
  durationMinutes: number;
  capacity: number;
  minPlayers: number;
}

export interface NewInvitationData {
  requestId: number;
  createdBy: number;
  playerId: number;
  kind: 'INVITE' | 'APPLY';
  expiresAt: Date;
}

/** Membership close reasons (database-schema.md §13.5). */
export type MembershipCloseReason = 'SCHEDULE_CONFLICT' | 'BLOCKED' | 'RECRUITMENT_CLOSED' | 'POST_CANCELLED' | 'POST_STARTED';

/** Recruitment interval [start_at, start_at + duration_minutes) (Tech Design §24.6). */
const intervalEndSql = (alias: string) => sql.raw(`(${alias}.start_at + make_interval(mins => ${alias}.duration_minutes))`);

export interface CandidateFilter {
  ownerId: number;
  groupPlayerIds: number[];
  pendingInviteeIds: number[];
  search?: string;
  includeOutOfRange: boolean;
  minRank: number;
  maxRank: number;
  page: number;
  limit: number;
}

export interface RequestListFilter {
  status?: string;
  page: number;
  limit: number;
}

export interface InvitationListFilter {
  direction: 'RECEIVED' | 'SENT';
  status?: string;
  page: number;
  limit: number;
}

export interface MatchListFilter {
  status?: string;
  timeScope: 'UPCOMING' | 'PAST' | 'ALL';
  page: number;
  limit: number;
}

const requestColumns = {
  id: matchmakingRequests.id,
  playerId: matchmakingRequests.playerId,
  matchType: matchmakingRequests.matchType,
  minSkillLevelId: matchmakingRequests.minSkillLevelId,
  maxSkillLevelId: matchmakingRequests.maxSkillLevelId,
  preferredDate: matchmakingRequests.preferredDate,
  preferredStartTime: matchmakingRequests.preferredStartTime,
  preferredEndTime: matchmakingRequests.preferredEndTime,
  area: matchmakingRequests.area,
  matchDurationMinutes: matchmakingRequests.matchDurationMinutes,
  status: matchmakingRequests.status,
  expiresAt: matchmakingRequests.expiresAt,
  createdAt: matchmakingRequests.createdAt,
  updatedAt: matchmakingRequests.updatedAt,
  postId: matchmakingRequests.postId,
  startAt: matchmakingRequests.startAt,
  durationMinutes: matchmakingRequests.durationMinutes,
  capacity: matchmakingRequests.capacity,
  minPlayers: matchmakingRequests.minPlayers,
  companionCount: matchmakingRequests.companionCount,
  costNote: matchmakingRequests.costNote,
  externalCourtName: matchmakingRequests.externalCourtName,
  externalCourtCity: matchmakingRequests.externalCourtCity,
  externalCourtDistrict: matchmakingRequests.externalCourtDistrict,
  externalCourtAddress: matchmakingRequests.externalCourtAddress,
  bookingId: matchmakingRequests.bookingId,
  cancellationReason: matchmakingRequests.cancellationReason,
  closedEarlyAt: matchmakingRequests.closedEarlyAt,
};

/** Recruitment cancellation reasons (database-schema.md §13.4). */
export type RecruitmentCancellationReason =
  | 'HOST_CANCELLED' | 'HOST_LEFT' | 'COURT_NOT_BOOKED' | 'INSUFFICIENT_PLAYERS' | 'BOOKING_CANCELLED' | 'PLAYER_LEFT' | 'AUTHOR_DELETED';

export interface ExternalCourtFields {
  name: string;
  city: string;
  district: string;
  address: string;
}

function effectiveRequestStatusSql() {
  // MM-27: same outcome as the scheduler start processing (recruitment-state.ts).
  return effectiveRecruitmentStatusSql('matchmaking_requests');
}

/** Recruitment linked to the Match in `matchAlias` (one MATCHED link per request). */
const linkedRecruitment = (matchAlias: string, condition: string) => `EXISTS (
  SELECT 1 FROM matchmaking_matches sx_mm JOIN matchmaking_requests sx_r ON sx_r.id = sx_mm.matchmaking_request_id
  WHERE sx_mm.match_id = ${matchAlias}.id AND sx_mm.status = 'MATCHED' AND ${condition})`;

function effectiveInvitationStatusSql() {
  return sql`(CASE WHEN ${matchmakingInvitations.status} = 'PENDING' AND ${matchmakingInvitations.expiresAt} <= now() THEN 'EXPIRED' ELSE ${matchmakingInvitations.status} END)`;
}

function effectiveMatchStatusSql() {
  return sql<string>`CASE
    WHEN ${matches.status} IN ('CONFIRMED', 'IN_PROGRESS') AND EXISTS (
      SELECT 1 FROM bookings b WHERE b.id = ${matches.bookingId} AND b.status IN ('CANCELLED', 'EXPIRED')
    ) THEN 'CANCELLED'
    WHEN ${matches.status} = 'PENDING_COURT' AND ${matches.bookingDeadlineAt} <= now() THEN 'CANCELLED'
    WHEN ${matches.status} IN ('CONFIRMED', 'IN_PROGRESS') AND EXISTS (
      SELECT 1 FROM bookings b WHERE b.id = ${matches.bookingId}
        AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
        AND ((b.booking_date + b.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh') <= now()
    ) THEN 'COMPLETED'
    WHEN ${matches.status} = 'CONFIRMED' AND ${matches.scheduledAt} <= now() AND EXISTS (
      SELECT 1 FROM bookings b WHERE b.id = ${matches.bookingId} AND b.status IN ('CONFIRMED', 'IN_PROGRESS')
    ) THEN 'IN_PROGRESS'
    ${sql.raw(recruitmentMatchStatusBranches('matches'))}
    ELSE ${matches.status} END`;
}

/**
 * MM-27 (§24.4 Match states) for Matches without a legacy `matches.booking_id`: the court
 * and the fixed time come from the recruitment. Same rules as the scheduler:
 * linked booking cancelled → CANCELLED; CONFIRMED at start without the roster condition
 * (reopened GROUP) → CANCELLED; end `start_at + duration_minutes` → COMPLETED; start → IN_PROGRESS.
 */
function recruitmentMatchStatusBranches(m: string): string {
  const own = `${m}.booking_id IS NULL`;
  const end = `sx_r.start_at + make_interval(mins => sx_r.duration_minutes)`;
  return `
    WHEN ${own} AND ${m}.status IN ('PENDING_COURT', 'CONFIRMED') AND ${linkedRecruitment(m, `sx_r.status IN ('OPEN', 'EXPIRED') AND sx_r.start_at <= now()`)} THEN 'CANCELLED'
    WHEN ${own} AND ${m}.status IN ('CONFIRMED', 'IN_PROGRESS') AND ${linkedRecruitment(m, `EXISTS (
      SELECT 1 FROM bookings sx_rb WHERE sx_rb.id = sx_r.booking_id AND sx_rb.status IN ('CANCELLED', 'EXPIRED'))`)} THEN 'CANCELLED'
    WHEN ${own} AND ${m}.status = 'CONFIRMED' AND ${linkedRecruitment(m, `sx_r.start_at <= now() AND NOT ${rosterSufficientSql('sx_r')}`)} THEN 'CANCELLED'
    WHEN ${own} AND ${m}.status IN ('CONFIRMED', 'IN_PROGRESS') AND ${linkedRecruitment(m, `${end} <= now()`)} THEN 'COMPLETED'
    WHEN ${own} AND ${m}.status = 'CONFIRMED' AND ${linkedRecruitment(m, `sx_r.start_at <= now()`)} THEN 'IN_PROGRESS'`;
}

export class MatchmakingRepository {
  // ----------------------------- Requests -----------------------------

  async insertRequest(data: NewRequestData, executor: Executor = db) {
    const [row] = await executor
      .insert(matchmakingRequests)
      .values({
        playerId: data.playerId,
        postId: data.postId,
        matchType: data.matchType,
        minSkillLevelId: data.minSkillLevelId,
        maxSkillLevelId: data.maxSkillLevelId,
        preferredDate: data.preferredDate,
        preferredStartTime: data.preferredStartTime,
        preferredEndTime: data.preferredEndTime,
        area: data.area,
        matchDurationMinutes: data.matchDurationMinutes,
        status: 'OPEN',
        expiresAt: data.expiresAt,
        startAt: data.startAt,
        durationMinutes: data.durationMinutes,
        capacity: data.capacity,
        minPlayers: data.minPlayers,
      })
      .returning({ id: matchmakingRequests.id, createdAt: matchmakingRequests.createdAt, expiresAt: matchmakingRequests.expiresAt });
    return row;
  }

  async findRequestById(id: number, executor: Executor = db) {
    const rows = await executor.select(requestColumns).from(matchmakingRequests).where(eq(matchmakingRequests.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async lockRequestById(id: number, executor: Executor) {
    const rows = await executor.select(requestColumns).from(matchmakingRequests).where(eq(matchmakingRequests.id, id)).for('update');
    return rows[0] ?? null;
  }

  async findRequestsForPlayer(playerId: number, filter: RequestListFilter) {
    const conditions: any[] = [sql`(${matchmakingRequests.playerId} = ${playerId} OR EXISTS (
      SELECT 1 FROM ${matchmakingInvitations} my_membership
      WHERE my_membership.request_id = ${matchmakingRequests.id}
        AND my_membership.player_id = ${playerId} AND my_membership.status = 'ACCEPTED'
    ))`];
    if (filter.status) {
      conditions.push(sql`${effectiveRequestStatusSql()} = ${filter.status}`);
    }

    const [countRow] = await db
      .select({ total: count() })
      .from(matchmakingRequests)
      .where(and(...conditions));
    const total = Number(countRow?.total || 0);

    const rows = await db
      .select(requestColumns)
      .from(matchmakingRequests)
      .where(and(...conditions))
      .orderBy(desc(matchmakingRequests.createdAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return { items: rows, total };
  }

  async updateRequestStatus(id: number, status: string, executor: Executor = db): Promise<boolean> {
    const rows = await executor
      .update(matchmakingRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(matchmakingRequests.id, id))
      .returning({ id: matchmakingRequests.id });
    return rows.length > 0;
  }

  async findOpenRequestByPlayerAndType(playerId: number, matchType: string, executor: Executor = db) {
    const rows = await executor
      .select({ id: matchmakingRequests.id })
      .from(matchmakingRequests)
      .where(
        and(
          eq(matchmakingRequests.playerId, playerId),
          eq(matchmakingRequests.matchType, matchType),
          eq(matchmakingRequests.status, 'OPEN')
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async expireOverdueOpenRequestsForPlayer(
    playerId: number,
    matchType: string,
    executor: Executor = db
  ): Promise<number[]> {
    const rows = await executor
      .update(matchmakingRequests)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(
        and(
          eq(matchmakingRequests.playerId, playerId),
          eq(matchmakingRequests.matchType, matchType),
          eq(matchmakingRequests.status, 'OPEN'),
          lte(matchmakingRequests.expiresAt, new Date())
        )
      )
      .returning({ id: matchmakingRequests.id });
    return rows.map((row: { id: number }) => row.id);
  }

  /**
   * Atomically claims up to `limit` OPEN requests past their deadline and marks
   * them EXPIRED. Returns the claimed ids so callers can close invitations.
   */
  async claimExpiredRequests(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      UPDATE ${matchmakingRequests}
      SET status = 'EXPIRED', updated_at = now()
      WHERE id IN (
        SELECT id FROM ${matchmakingRequests}
        -- GROUP recruitments are decided at start by processStart (MM-27), never expired here.
        WHERE status = 'OPEN' AND expires_at <= now() AND match_type <> 'GROUP'
        ORDER BY expires_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map((row) => Number(row.id));
  }

  async findRequestsByIds(ids: number[], executor: Executor = db) {
    if (ids.length === 0) return [];
    return executor.select(requestColumns).from(matchmakingRequests).where(inArray(matchmakingRequests.id, ids));
  }

  // ---------------------------- Invitations ---------------------------

  async insertInvitation(data: NewInvitationData, executor: Executor = db) {
    const [row] = await executor
      .insert(matchmakingInvitations)
      .values({
        requestId: data.requestId,
        createdBy: data.createdBy,
        playerId: data.playerId,
        kind: data.kind,
        status: 'PENDING',
        expiresAt: data.expiresAt,
      })
      .returning({ id: matchmakingInvitations.id, expiresAt: matchmakingInvitations.expiresAt });
    return row;
  }

  async findInvitationById(id: number, executor: Executor = db) {
    const rows = await executor.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async lockInvitationById(id: number, executor: Executor) {
    const rows = await executor.select().from(matchmakingInvitations).where(eq(matchmakingInvitations.id, id)).for('update');
    return rows[0] ?? null;
  }

  async findPendingInvitation(requestId: number, playerId: number, executor: Executor = db) {
    const rows = await executor
      .select()
      .from(matchmakingInvitations)
      .where(
        and(
          eq(matchmakingInvitations.requestId, requestId),
          eq(matchmakingInvitations.playerId, playerId),
          eq(matchmakingInvitations.status, 'PENDING'),
          sql`${matchmakingInvitations.expiresAt} > clock_timestamp()`
        )
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async updateInvitationStatus(
    id: number,
    status: string,
    respondedAt: Date | null,
    expectedStatus: string | null = null,
    executor: Executor = db,
    extra: { decidedBy?: number; closeReason?: MembershipCloseReason } = {}
  ): Promise<boolean> {
    const conditions: any[] = [eq(matchmakingInvitations.id, id)];
    if (expectedStatus) conditions.push(eq(matchmakingInvitations.status, expectedStatus));
    const rows = await executor
      .update(matchmakingInvitations)
      .set({
        status,
        respondedAt,
        updatedAt: new Date(),
        ...(extra.decidedBy !== undefined ? { decidedBy: extra.decidedBy } : {}),
        ...(extra.closeReason !== undefined ? { closeReason: extra.closeReason } : {}),
      })
      .where(and(...conditions))
      .returning({ id: matchmakingInvitations.id });
    return rows.length > 0;
  }

  async closePendingInvitationsForRequest(
    requestId: number,
    status: 'CANCELLED' | 'EXPIRED',
    executor: Executor = db,
    closeReason: MembershipCloseReason | null = null
  ): Promise<number> {
    const rows = await executor
      .update(matchmakingInvitations)
      .set({ status, updatedAt: new Date(), ...(closeReason ? { closeReason } : {}) })
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'PENDING')))
      .returning({ id: matchmakingInvitations.id });
    return rows.length;
  }

  /**
   * PENDING rows (both kinds) of other recruitments where the Player is the joiner and
   * whose interval overlaps [start, end) (MM-26). Ascending id.
   */
  async findOverlappingPendingForPlayer(
    playerId: number,
    start: Date,
    end: Date,
    excludeRequestId: number,
    executor: Executor = db
  ): Promise<number[]> {
    const result = (await executor.execute(sql`
      SELECT mi.id FROM ${matchmakingInvitations} mi
      INNER JOIN ${matchmakingRequests} req ON req.id = mi.request_id
      WHERE mi.player_id = ${playerId}
        AND mi.status = 'PENDING'
        AND req.id <> ${excludeRequestId}
        AND req.start_at < ${end}
        AND ${intervalEndSql('req')} > ${start}
      ORDER BY mi.id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map(row => Number(row.id));
  }

  /** Row locks on membership rows in ascending id (rank 40, Tech Design §24.7). */
  async lockMembershipRowsAscending(ids: number[], executor: Executor) {
    if (ids.length === 0) return [];
    const sorted = [...new Set(ids)].sort((a, b) => a - b);
    return executor
      .select()
      .from(matchmakingInvitations)
      .where(inArray(matchmakingInvitations.id, sorted))
      .orderBy(asc(matchmakingInvitations.id))
      .for('update');
  }

  /** Conditional close of still-PENDING rows; returns the ids actually closed. */
  async closePendingRows(ids: number[], reason: MembershipCloseReason, executor: Executor): Promise<number[]> {
    if (ids.length === 0) return [];
    const rows = await executor
      .update(matchmakingInvitations)
      .set({ status: 'CANCELLED', closeReason: reason, updatedAt: new Date() })
      .where(and(inArray(matchmakingInvitations.id, ids), eq(matchmakingInvitations.status, 'PENDING')))
      .returning({ id: matchmakingInvitations.id });
    return rows.map((row: { id: number }) => row.id);
  }

  /**
   * MatchmakingBlockPort support: PENDING Invite/Apply rows between two Players in either
   * direction (host ↔ joiner). Returns request ids (ascending) and row ids (ascending).
   */
  async findPendingBetween(a: number, b: number, executor: Executor) {
    const result = (await executor.execute(sql`
      SELECT mi.id, mi.request_id FROM ${matchmakingInvitations} mi
      INNER JOIN ${matchmakingRequests} req ON req.id = mi.request_id
      WHERE mi.status = 'PENDING'
        AND ((req.player_id = ${a} AND mi.player_id = ${b}) OR (req.player_id = ${b} AND mi.player_id = ${a}))
      ORDER BY mi.id
    `)) as unknown as { rows: { id: number; request_id: number }[] };
    const rows = result.rows ?? [];
    return {
      rowIds: rows.map(row => Number(row.id)),
      requestIds: [...new Set(rows.map(row => Number(row.request_id)))].sort((x, y) => x - y),
    };
  }

  async lockRequestsAscending(ids: number[], executor: Executor): Promise<void> {
    const sorted = [...new Set(ids)].sort((x, y) => x - y);
    for (const id of sorted) {
      await executor.select({ id: matchmakingRequests.id }).from(matchmakingRequests).where(eq(matchmakingRequests.id, id)).for('update');
    }
  }

  async countAcceptedInvitations(requestId: number, executor: Executor = db): Promise<number> {
    const [row] = await executor
      .select({ total: count() })
      .from(matchmakingInvitations)
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'ACCEPTED')));
    return Number(row?.total || 0);
  }

  /** Current members other than the host: ACCEPTED rows of either kind (§13.5). */
  async findAcceptedInvitees(requestId: number, executor: Executor = db) {
    return executor
      .select({ id: matchmakingInvitations.id, playerId: matchmakingInvitations.playerId })
      .from(matchmakingInvitations)
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'ACCEPTED')))
      .orderBy(asc(matchmakingInvitations.id));
  }

  async findPendingInvitees(requestId: number, executor: Executor = db) {
    return executor
      .select({ id: matchmakingInvitations.id, playerId: matchmakingInvitations.playerId })
      .from(matchmakingInvitations)
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'PENDING'), sql`${matchmakingInvitations.expiresAt} > clock_timestamp()`));
  }

  /** Invitation endpoints operate on kind = INVITE rows only (Tech Design §24.9). */
  async findInvitationsForPlayer(playerId: number, filter: InvitationListFilter) {
    const counterpartId = filter.direction === 'RECEIVED' ? matchmakingInvitations.createdBy : matchmakingInvitations.playerId;
    const scope =
      filter.direction === 'RECEIVED'
        ? eq(matchmakingInvitations.playerId, playerId)
        : eq(matchmakingInvitations.createdBy, playerId);

    const conditions: any[] = [scope, eq(matchmakingInvitations.kind, 'INVITE')];
    if (filter.status) {
      conditions.push(sql`${effectiveInvitationStatusSql()} = ${filter.status}`);
    }

    const [countRow] = await db
      .select({ total: count() })
      .from(matchmakingInvitations)
      .where(and(...conditions));
    const total = Number(countRow?.total || 0);

    const rows = await db
      .select({
        id: matchmakingInvitations.id,
        requestId: matchmakingInvitations.requestId,
        createdBy: matchmakingInvitations.createdBy,
        playerId: matchmakingInvitations.playerId,
        status: sql<string>`${effectiveInvitationStatusSql()}`,
        expiresAt: matchmakingInvitations.expiresAt,
        respondedAt: matchmakingInvitations.respondedAt,
        createdAt: matchmakingInvitations.createdAt,
        counterpartId,
        counterpartName: playerProfiles.fullName,
        counterpartSkillLevelId: playerProfiles.skillLevelId,
        counterpartSkillRank: skillLevels.rank,
        counterpartSkillCode: skillLevels.code,
        counterpartSkillName: skillLevels.name,
        requestMatchType: matchmakingRequests.matchType,
        requestPreferredDate: matchmakingRequests.preferredDate,
        requestStartAt: matchmakingRequests.startAt,
        requestDurationMinutes: matchmakingRequests.durationMinutes,
        requestPreferredStartTime: matchmakingRequests.preferredStartTime,
        requestPreferredEndTime: matchmakingRequests.preferredEndTime,
        requestArea: matchmakingRequests.area,
        matchId: sql<number | null>`(SELECT mm.match_id FROM matchmaking_matches mm WHERE mm.matchmaking_request_id = ${matchmakingInvitations.requestId} AND mm.status = 'MATCHED' LIMIT 1)`,
        requestStatus: sql<string>`${effectiveRequestStatusSql()}`,
      })
      .from(matchmakingInvitations)
      .innerJoin(matchmakingRequests, eq(matchmakingInvitations.requestId, matchmakingRequests.id))
      .leftJoin(playerProfiles, eq(counterpartId, playerProfiles.userId))
      .leftJoin(skillLevels, eq(playerProfiles.skillLevelId, skillLevels.id))
      .where(and(...conditions))
      .orderBy(desc(matchmakingInvitations.createdAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return { items: rows, total };
  }

  async expirePendingForRequest(requestId: number, executor: Executor = db) {
    return executor.update(matchmakingInvitations).set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'PENDING'),
        sql`${matchmakingInvitations.expiresAt} <= clock_timestamp()`));
  }

  async claimExpiredInvitations(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      UPDATE ${matchmakingInvitations}
      SET status = 'EXPIRED', updated_at = now()
      WHERE id IN (
        SELECT id FROM ${matchmakingInvitations}
        WHERE status = 'PENDING' AND expires_at <= now()
        ORDER BY expires_at
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map((row) => Number(row.id));
  }

  // ------------------------ Lifecycle (MM-25/27/28) ------------------------

  /** PENDING rows of a request regardless of lazy expiry (lock snapshot and closures). */
  async findPendingRows(requestId: number, executor: Executor = db): Promise<{ id: number; playerId: number; kind: string }[]> {
    return executor
      .select({ id: matchmakingInvitations.id, playerId: matchmakingInvitations.playerId, kind: matchmakingInvitations.kind })
      .from(matchmakingInvitations)
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'PENDING')))
      .orderBy(asc(matchmakingInvitations.id));
  }

  /** Hosts of the given rows' requests where the row is an APPLY (conflict-closure recipients). */
  async findApplyRowHosts(rowIds: number[], executor: Executor = db): Promise<{ rowId: number; hostId: number }[]> {
    if (rowIds.length === 0) return [];
    const rows = await executor
      .select({ rowId: matchmakingInvitations.id, hostId: matchmakingRequests.playerId })
      .from(matchmakingInvitations)
      .innerJoin(matchmakingRequests, eq(matchmakingRequests.id, matchmakingInvitations.requestId))
      .where(and(inArray(matchmakingInvitations.id, rowIds), eq(matchmakingInvitations.kind, 'APPLY')));
    return rows;
  }

  /** Conditional close of every PENDING row of a request; returns the closed rows (rank 40). */
  async closePendingForRequest(
    requestId: number,
    status: 'CANCELLED' | 'EXPIRED',
    closeReason: MembershipCloseReason,
    executor: Executor
  ): Promise<{ id: number; playerId: number; kind: string }[]> {
    return executor
      .update(matchmakingInvitations)
      .set({ status, closeReason, updatedAt: new Date() })
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.status, 'PENDING')))
      .returning({ id: matchmakingInvitations.id, playerId: matchmakingInvitations.playerId, kind: matchmakingInvitations.kind });
  }

  /**
   * ACCEPTED → WITHDRAWN. Decision history (`responded_at`, `decided_by`) is kept: a
   * withdrawal is a later membership change, not a new decision on the row.
   */
  async withdrawMembership(rowId: number, executor: Executor): Promise<boolean> {
    const rows = await executor
      .update(matchmakingInvitations)
      .set({ status: 'WITHDRAWN', updatedAt: new Date() })
      .where(and(eq(matchmakingInvitations.id, rowId), eq(matchmakingInvitations.status, 'ACCEPTED')))
      .returning({ id: matchmakingInvitations.id });
    return rows.length > 0;
  }

  async findRequestIdByPostId(postId: number, executor: Executor = db): Promise<number | null> {
    const [row] = await executor.select({ id: matchmakingRequests.id }).from(matchmakingRequests).where(eq(matchmakingRequests.postId, postId));
    return row?.id ?? null;
  }

  /** The Player's most recent row for a request (active or historical). */
  async findLatestRowForPlayer(requestId: number, playerId: number, executor: Executor = db) {
    const rows = await executor
      .select()
      .from(matchmakingInvitations)
      .where(and(eq(matchmakingInvitations.requestId, requestId), eq(matchmakingInvitations.playerId, playerId)))
      .orderBy(desc(matchmakingInvitations.id))
      .limit(1);
    return rows[0] ?? null;
  }

  async cancelRecruitment(id: number, reason: RecruitmentCancellationReason, executor: Executor): Promise<void> {
    await executor
      .update(matchmakingRequests)
      .set({ status: 'CANCELLED', cancellationReason: reason, updatedAt: new Date() })
      .where(eq(matchmakingRequests.id, id));
  }

  async markRecruitmentMatched(id: number, closedEarlyAt: Date | null, executor: Executor): Promise<void> {
    await executor
      .update(matchmakingRequests)
      .set({ status: 'MATCHED', updatedAt: new Date(), ...(closedEarlyAt ? { closedEarlyAt } : {}) })
      .where(eq(matchmakingRequests.id, id));
  }

  /** GROUP MATCHED → OPEN after a non-host withdrawal (§13.4); the Match link is kept. */
  async reopenRecruitment(id: number, executor: Executor): Promise<void> {
    await executor
      .update(matchmakingRequests)
      .set({ status: 'OPEN', updatedAt: new Date() })
      .where(and(eq(matchmakingRequests.id, id), eq(matchmakingRequests.status, 'MATCHED'), eq(matchmakingRequests.matchType, 'GROUP')));
  }

  async setExternalCourt(id: number, court: ExternalCourtFields, executor: Executor): Promise<void> {
    await executor
      .update(matchmakingRequests)
      .set({
        externalCourtName: court.name,
        externalCourtCity: court.city,
        externalCourtDistrict: court.district,
        externalCourtAddress: court.address,
        updatedAt: new Date(),
      })
      .where(eq(matchmakingRequests.id, id));
  }

  /**
   * MM-19: a booking chosen by the host becomes the recruitment court. When the
   * post also has an external court, the host's explicit selection confirms the
   * same-venue pair required by chk_matchmaking_requests_court_consistency.
   */
  async linkRecruitmentBooking(id: number, bookingId: number, actorId: number, executor: Executor): Promise<void> {
    const [request] = await executor
      .select({ externalCourtName: matchmakingRequests.externalCourtName })
      .from(matchmakingRequests)
      .where(eq(matchmakingRequests.id, id))
      .limit(1);
    await executor
      .update(matchmakingRequests)
      .set({
        bookingId,
        updatedAt: new Date(),
        ...(request?.externalCourtName
          ? { courtSameVenueConfirmedAt: new Date(), courtSameVenueConfirmedBy: actorId }
          : {}),
      })
      .where(eq(matchmakingRequests.id, id));
  }

  /** Court presence per §24.4: external court, or a CONFIRMED linked recruitment booking. */
  async recruitmentHasCourt(request: { externalCourtName: string | null; bookingId: number | null }, executor: Executor = db): Promise<boolean> {
    if (request.externalCourtName) return true;
    if (!request.bookingId) return false;
    const [row] = await executor.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, request.bookingId));
    return Boolean(row && ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'].includes(row.status));
  }

  /** Effective status of one recruitment (same SQL as lists and the Social projection). */
  async findEffectiveStatus(requestId: number, executor: Executor = db): Promise<string | null> {
    const [row] = await executor
      .select({ status: sql<string>`${effectiveRequestStatusSql()}` })
      .from(matchmakingRequests)
      .where(eq(matchmakingRequests.id, requestId));
    return row?.status ?? null;
  }

  /**
   * MM-27 claim (§24.7.1 rule 4): due recruitments still OPEN, or MATCHED whose Match
   * (without a legacy matches.booking_id) is PENDING_COURT/CONFIRMED. Short autocommit
   * statement; rows held by an in-flight host action are skipped until the next tick.
   * Joined tables are excluded from locking with OF r.
   */
  async claimDueRecruitments(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      SELECT r.id FROM ${matchmakingRequests} r
      WHERE r.start_at <= now()
        AND (r.status = 'OPEN' OR (r.status = 'MATCHED' AND EXISTS (
          SELECT 1 FROM ${matchmakingMatches} mm JOIN ${matches} m ON m.id = mm.match_id
          WHERE mm.matchmaking_request_id = r.id AND mm.status = 'MATCHED'
            AND m.booking_id IS NULL AND m.status IN ('PENDING_COURT', 'CONFIRMED'))))
      ORDER BY r.start_at, r.id
      LIMIT ${limit}
      FOR UPDATE OF r SKIP LOCKED
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map(row => Number(row.id));
  }

  /**
   * MM-27 completion for Matches without a legacy matches.booking_id: IN_PROGRESS →
   * COMPLETED at `start_at + duration_minutes` of the recruitment; completed_at is that
   * instant (a longer booking never extends the Match). Stored as UTC wall time, the
   * convention of the timestamp-without-time-zone columns written through Drizzle.
   */
  async completeRecruitmentMatches(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      UPDATE ${matches} SET status = 'COMPLETED', completed_at = due.end_at, updated_at = now()
      FROM (
        SELECT m.id, ((r.start_at + make_interval(mins => r.duration_minutes)) AT TIME ZONE 'UTC') AS end_at
        FROM ${matches} m
        JOIN ${matchmakingMatches} mm ON mm.match_id = m.id AND mm.status = 'MATCHED'
        JOIN ${matchmakingRequests} r ON r.id = mm.matchmaking_request_id
        WHERE m.status = 'IN_PROGRESS' AND m.booking_id IS NULL
          AND r.start_at + make_interval(mins => r.duration_minutes) <= now()
        ORDER BY m.id
        LIMIT ${limit}
        FOR UPDATE OF m SKIP LOCKED
      ) due
      WHERE ${matches}.id = due.id AND ${matches}.status = 'IN_PROGRESS'
      RETURNING ${matches}.id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map(row => Number(row.id));
  }

  // ---------------------------- Candidates ----------------------------

  async findCandidates(filter: CandidateFilter) {
    const excluded = new Set<number>([filter.ownerId, ...filter.groupPlayerIds, ...filter.pendingInviteeIds]);
    const conditions: any[] = [
      eq(users.role, 'PLAYER'),
      sql`${users.deletedAt} IS NULL`,
      isNotNull(playerProfiles.userId),
    ];
    if (excluded.size > 0) {
      conditions.push(sql`${users.id} NOT IN ${sql.raw(`(${[...excluded].join(',')})`)}`);
    }
    if (filter.search) {
      conditions.push(sql`lower(${playerProfiles.fullName}) LIKE ${`%${filter.search.toLowerCase()}%`}`);
    }
    if (!filter.includeOutOfRange) {
      conditions.push(gte(skillLevels.rank, filter.minRank));
      conditions.push(lte(skillLevels.rank, filter.maxRank));
    }

    const [countRow] = await db
      .select({ total: count() })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .innerJoin(skillLevels, eq(playerProfiles.skillLevelId, skillLevels.id))
      .where(and(...conditions));
    const total = Number(countRow?.total || 0);

    const rows = await db
      .select({
        playerId: users.id,
        displayName: playerProfiles.fullName,
        skillLevelId: playerProfiles.skillLevelId,
        skillRank: skillLevels.rank,
        skillCode: skillLevels.code,
        skillName: skillLevels.name,
      })
      .from(users)
      .innerJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .innerJoin(skillLevels, eq(playerProfiles.skillLevelId, skillLevels.id))
      .where(and(...conditions))
      .orderBy(sql`lower(${playerProfiles.fullName}) ASC`, asc(users.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return { items: rows, total };
  }

  // ------------------------- Player scheduling ------------------------

  /**
   * MM-26 (Tech Design §24.6): one interval source, [start_at, start_at + duration_minutes)
   * of every non-terminal recruitment where the Player is the host or a current ACCEPTED
   * member, plus non-terminal Matches through their recruitment. Pending Apply/Invite
   * rows never reserve. Linking a booking never changes the post interval.
   * `excludeRequestId` ignores the recruitment being joined or formed.
   */
  async hasOverlappingCommitment(
    playerId: number,
    start: Date,
    end: Date,
    excludeRequestId: number | null = null,
    executor: Executor = db
  ): Promise<boolean> {
    const result = (await executor.execute(sql`
      SELECT 1 FROM ${matchmakingRequests} req
      WHERE (${excludeRequestId}::bigint IS NULL OR req.id <> ${excludeRequestId}::bigint)
        AND req.start_at < ${end}
        AND ${intervalEndSql('req')} > ${start}
        AND (
          (
            req.status = 'OPEN'
            AND (req.expires_at IS NULL OR req.expires_at > clock_timestamp())
            AND (
              req.player_id = ${playerId}
              OR EXISTS (
                SELECT 1 FROM ${matchmakingInvitations} mi
                WHERE mi.request_id = req.id AND mi.player_id = ${playerId} AND mi.status = 'ACCEPTED'
              )
            )
          )
          OR EXISTS (
            SELECT 1 FROM ${matchmakingMatches} mm
            INNER JOIN ${matches} m ON m.id = mm.match_id
            INNER JOIN ${matchPlayers} mp ON mp.match_id = m.id
            LEFT JOIN ${bookings} b ON b.id = m.booking_id
            WHERE mm.matchmaking_request_id = req.id
              AND mp.player_id = ${playerId}
              AND mp.status = 'ACTIVE'
              AND m.status IN ('PENDING_COURT', 'CONFIRMED', 'IN_PROGRESS')
              AND (m.status <> 'PENDING_COURT' OR m.booking_deadline_at > clock_timestamp())
              AND (m.booking_id IS NULL OR b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED'))
          )
        )
      LIMIT 1
    `)) as unknown as { rows: unknown[] };
    return (result.rows ?? []).length > 0;
  }

  // ---------------------------- Match links ---------------------------

  async insertMatchLink(requestId: number, matchId: number, executor: Executor = db) {
    const [row] = await executor
      .insert(matchmakingMatches)
      .values({ matchmakingRequestId: requestId, matchId, status: 'MATCHED', matchedAt: new Date() })
      .returning({ id: matchmakingMatches.id });
    return row;
  }

  async findMatchLinkByRequestId(requestId: number, executor: Executor = db) {
    const rows = await executor
      .select({ id: matchmakingMatches.id, matchId: matchmakingMatches.matchId })
      .from(matchmakingMatches)
      .where(eq(matchmakingMatches.matchmakingRequestId, requestId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findMatchLinkByMatchId(matchId: number, executor: Executor = db) {
    const rows = await executor
      .select({ id: matchmakingMatches.id, requestId: matchmakingMatches.matchmakingRequestId })
      .from(matchmakingMatches)
      .where(eq(matchmakingMatches.matchId, matchId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ---------------------------- Match reads ---------------------------

  async findMatchesForPlayer(playerId: number, filter: MatchListFilter) {
    const conditions: any[] = [eq(matchPlayers.playerId, playerId)];
    if (filter.status) {
      conditions.push(sql`${effectiveMatchStatusSql()} = ${filter.status}`);
    }
    if (filter.timeScope === 'UPCOMING') {
      conditions.push(gte(matches.scheduledAt, new Date()));
    } else if (filter.timeScope === 'PAST') {
      conditions.push(lt(matches.scheduledAt, new Date()));
    }

    const [countTotal] = await db
      .select({ total: count() })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .innerJoin(matchmakingMatches, eq(matchmakingMatches.matchId, matches.id))
      .where(and(...conditions));

    const rows = await db
      .select({
        id: matches.id,
        matchType: matches.matchType,
        status: effectiveMatchStatusSql(),
        scheduledAt: matches.scheduledAt,
        bookingDeadlineAt: matches.bookingDeadlineAt,
        courtId: matches.courtId,
        courtName: courts.name,
        facilityId: facilities.id,
        facilityName: facilities.name,
        facilityAddress: facilities.address,
        facilityWard: facilities.ward,
        facilityDistrict: facilities.district,
        facilityCity: facilities.city,
      })
      .from(matchPlayers)
      .innerJoin(matches, eq(matchPlayers.matchId, matches.id))
      .innerJoin(matchmakingMatches, eq(matchmakingMatches.matchId, matches.id))
      .leftJoin(courts, eq(matches.courtId, courts.id))
      .leftJoin(facilities, eq(courts.facilityId, facilities.id))
      .where(and(...conditions))
      .orderBy(desc(matches.scheduledAt))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return { items: rows, total: Number(countTotal?.total || 0) };
  }

  async findMatchDetailById(matchId: number, executor: Executor = db) {
    const rows = await executor
      .select({
        id: matches.id,
        matchType: matches.matchType,
        status: effectiveMatchStatusSql(),
        cancellationReason: matches.cancellationReason,
        scheduledAt: matches.scheduledAt,
        bookingDeadlineAt: matches.bookingDeadlineAt,
        courtId: matches.courtId,
        courtName: courts.name,
        facilityId: facilities.id,
        facilityName: facilities.name,
        facilityAddress: facilities.address,
        facilityWard: facilities.ward,
        facilityDistrict: facilities.district,
        facilityCity: facilities.city,
        bookingId: matches.bookingId,
        bookingDate: bookings.bookingDate,
        bookingStartTime: bookings.startTime,
        bookingEndTime: bookings.endTime,
        bookingTotalAmount: bookings.totalAmount,
        bookingPlayerId: bookings.playerId,
        bookingStatus: bookings.status,
      })
      .from(matches)
      .innerJoin(matchmakingMatches, eq(matchmakingMatches.matchId, matches.id))
      .leftJoin(courts, eq(matches.courtId, courts.id))
      .leftJoin(facilities, eq(courts.facilityId, facilities.id))
      .leftJoin(bookings, eq(matches.bookingId, bookings.id))
      .where(eq(matches.id, matchId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findMatchPlayers(matchId: number, executor: Executor = db) {
    return executor
      .select({
        playerId: matchPlayers.playerId,
        teamNo: matchPlayers.teamNo,
        status: matchPlayers.status,
        displayName: playerProfiles.fullName,
        skillLevelId: playerProfiles.skillLevelId,
        skillRank: skillLevels.rank,
        skillCode: skillLevels.code,
        skillName: skillLevels.name,
      })
      .from(matchPlayers)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, matchPlayers.playerId))
      .leftJoin(skillLevels, eq(playerProfiles.skillLevelId, skillLevels.id))
      .where(eq(matchPlayers.matchId, matchId))
      .orderBy(asc(matchPlayers.teamNo), asc(matchPlayers.id));
  }

  async findRequestOwnerId(requestId: number, executor: Executor = db): Promise<number | null> {
    const rows = await executor
      .select({ playerId: matchmakingRequests.playerId })
      .from(matchmakingRequests)
      .where(eq(matchmakingRequests.id, requestId))
      .limit(1);
    return rows[0]?.playerId ?? null;
  }

  async findPlayerProfileSummaries(ids: number[], executor: Executor = db) {
    if (ids.length === 0) return [];
    return executor
      .select({
        playerId: users.id,
        displayName: playerProfiles.fullName,
        skillLevelId: playerProfiles.skillLevelId,
        skillRank: skillLevels.rank,
        skillCode: skillLevels.code,
        skillName: skillLevels.name,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .leftJoin(skillLevels, eq(playerProfiles.skillLevelId, skillLevels.id))
      .where(inArray(users.id, ids));
  }

  async findPlayerProfileSummary(playerId: number, executor: Executor = db) {
    const rows = await this.findPlayerProfileSummaries([playerId], executor);
    return rows[0] ?? null;
  }

  async findSkillLevelsByIds(ids: number[], executor: Executor = db) {
    if (ids.length === 0) return [];
    return executor
      .select({ id: skillLevels.id, code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank })
      .from(skillLevels)
      .where(inArray(skillLevels.id, ids));
  }

  async findInviteeProfile(inviteeId: number, executor: Executor = db) {
    const rows = await executor
      .select({ playerId: users.id, role: users.role, deletedAt: users.deletedAt, displayName: playerProfiles.fullName })
      .from(users)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .where(eq(users.id, inviteeId))
      .limit(1);
    return rows[0] ?? null;
  }

  // ------------------------- Cancellation jobs ------------------------

  async insertCancellationJob(matchId: number, bookingId: number, executor: Executor = db) {
    await executor
      .insert(matchBookingCancellationJobs)
      .values({ matchId, bookingId, status: 'PENDING', attempts: 0, nextAttemptAt: new Date() })
      .onConflictDoNothing();
  }

  /** MM-20: claim a bounded batch of retryable booking-cancellation jobs. */
  async claimCancellationJobs(limit: number): Promise<{ id: number; matchId: number | null; bookingId: number; attempts: number }[]> {
    const result = await db.execute(sql`
      UPDATE match_booking_cancellation_jobs
      SET status = 'PROCESSING', attempts = attempts + 1, updated_at = now()
      WHERE id IN (
        SELECT id FROM match_booking_cancellation_jobs
        WHERE (
          (status IN ('PENDING', 'FAILED') AND (next_attempt_at IS NULL OR next_attempt_at <= now()))
          OR (status = 'PROCESSING' AND updated_at < now() - interval '5 minutes')
        )
          AND attempts < 5
        ORDER BY id
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id, match_id, booking_id, attempts
    `);
    return (result.rows ?? []).map((row: any) => ({
      id: Number(row.id),
      matchId: row.match_id === null ? null : Number(row.match_id),
      bookingId: Number(row.booking_id),
      attempts: Number(row.attempts),
    }));
  }

  async markCancellationJobDone(id: number): Promise<void> {
    await db.update(matchBookingCancellationJobs)
      .set({ status: 'DONE', lastErrorCode: null, updatedAt: new Date() })
      .where(eq(matchBookingCancellationJobs.id, id));
  }

  async markCancellationJobFailed(id: number, errorCode: string): Promise<void> {
    // Terminal outcome: keep FAILED observable but move next_attempt_at beyond the
    // retry window so policy refusals/exhausted jobs are not claimed forever.
    const terminal = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await db.update(matchBookingCancellationJobs)
      .set({ status: 'FAILED', lastErrorCode: errorCode.slice(0, 120), nextAttemptAt: terminal, updatedAt: new Date() })
      .where(eq(matchBookingCancellationJobs.id, id));
  }

  async rescheduleCancellationJob(id: number, errorCode: string, nextAttemptAt: Date): Promise<void> {
    await db.update(matchBookingCancellationJobs)
      .set({ status: 'PENDING', lastErrorCode: errorCode.slice(0, 120), nextAttemptAt, updatedAt: new Date() })
      .where(eq(matchBookingCancellationJobs.id, id));
  }

  // ------------------------- Scheduler support ------------------------

  async cancelOverduePendingCourtMatches(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      UPDATE ${matches}
      SET status = 'CANCELLED', cancellation_reason = 'COURT_NOT_BOOKED', updated_at = now()
      WHERE id IN (
        SELECT m.id FROM ${matches} m
        INNER JOIN ${matchmakingMatches} mm ON mm.match_id = m.id
        WHERE m.status = 'PENDING_COURT'
          AND m.booking_deadline_at IS NOT NULL
          AND m.booking_deadline_at <= now()
        ORDER BY m.booking_deadline_at
        FOR UPDATE OF m SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map((row) => Number(row.id));
  }

  async reconcileCancelledBookings(limit: number): Promise<number[]> {
    const result = await db.execute(sql`
      UPDATE ${matches} SET status = 'CANCELLED', cancellation_reason = 'BOOKING_CANCELLED', updated_at = now()
      WHERE id IN (
        SELECT m.id FROM ${matches} m
        INNER JOIN ${matchmakingMatches} mm ON mm.match_id = m.id
        INNER JOIN ${bookings} b ON b.id = m.booking_id
        WHERE m.status IN ('CONFIRMED', 'IN_PROGRESS') AND b.status IN ('CANCELLED', 'EXPIRED')
        ORDER BY m.id FOR UPDATE OF m SKIP LOCKED LIMIT ${limit}
      ) RETURNING id
    `);
    return result.rows.map((row: any) => Number(row.id));
  }

  async advanceConfirmedToInProgress(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      UPDATE ${matches}
      SET status = 'IN_PROGRESS', started_at = ${matches.scheduledAt}, updated_at = now()
      WHERE id IN (
        SELECT m.id FROM ${matches} m
        INNER JOIN ${matchmakingMatches} mm ON mm.match_id = m.id
        WHERE m.status = 'CONFIRMED'
          AND m.scheduled_at <= now()
          AND EXISTS (SELECT 1 FROM ${bookings} b WHERE b.id = m.booking_id AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED'))
        ORDER BY m.scheduled_at
        FOR UPDATE OF m SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map((row) => Number(row.id));
  }

  async advanceInProgressToCompleted(limit: number): Promise<number[]> {
    const result = (await db.execute(sql`
      UPDATE ${matches}
      SET status = 'COMPLETED',
          completed_at = (
            SELECT (b.booking_date + b.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'
            FROM ${bookings} b WHERE b.id = ${matches.bookingId}
          ),
          updated_at = now()
      WHERE id IN (
        SELECT m.id FROM ${matches} m
        INNER JOIN ${matchmakingMatches} mm ON mm.match_id = m.id
        INNER JOIN ${bookings} b ON b.id = m.booking_id
        WHERE m.status = 'IN_PROGRESS'
          AND m.booking_id IS NOT NULL
          AND b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
          AND ((b.booking_date + b.end_time) AT TIME ZONE 'Asia/Ho_Chi_Minh') <= now()
        ORDER BY b.booking_date, b.end_time
        FOR UPDATE OF m SKIP LOCKED
        LIMIT ${limit}
      )
      RETURNING id
    `)) as unknown as { rows: { id: number }[] };
    return (result.rows ?? []).map((row) => Number(row.id));
  }

  async findPlayerIdsForMatch(matchId: number, executor: Executor = db): Promise<number[]> {
    const rows = await executor
      .select({ playerId: matchPlayers.playerId })
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, matchId));
    return rows.map((row: { playerId: number }) => row.playerId);
  }

  async lockUsersAscending(ids: number[], executor: Executor): Promise<void> {
    if (ids.length === 0) return;
    const sorted = [...new Set(ids)].sort((a, b) => a - b);
    for (const id of sorted) {
      await executor.select({ id: users.id }).from(users).where(eq(users.id, id)).for('update');
    }
  }

  async findBookingsLinkedToOtherMatch(bookingId: number, executor: Executor = db) {
    const rows = await executor
      .select({ id: matches.id })
      .from(matches)
      .where(eq(matches.bookingId, bookingId))
      .limit(1);
    return rows[0] ?? null;
  }
}

export const matchmakingRepository = new MatchmakingRepository();
