import { and, count, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { reports } from '../../db/schema/reports';
import { posts, postComments } from '../../db/schema/social';
import { courtOwnerProfiles, playerProfiles, skillLevels, users } from '../../db/schema/users';
import { facilities } from '../../db/schema/facilities';
import { tournaments } from '../../db/schema/tournaments';
import type { ReportTargetType } from '../reports/ReportRepository';

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_REPORT_LIMIT = 5;
const RECENT_CONTENT_LIMIT = 5;

const targetColumn = {
  PLAYER: reports.reportedPlayerId,
  FACILITY: reports.reportedFacilityId,
  TOURNAMENT: reports.reportedTournamentId,
  POST: reports.reportedPostId,
  COMMENT: reports.reportedCommentId,
  MESSAGE: reports.reportedMessageId,
} as const;

export interface ReportTargetHistoryRecord {
  total: number;
  open: number;
  last30Days: number;
  distinctReporters: number;
  byReason: Array<{ reasonCode: string; count: number }>;
  recent: Array<{
    id: number;
    reporterId: number;
    reasonCode: string;
    status: string;
    createdAt: Date;
  }>;
}

export const adminReportTargetRepository = {
  async reportHistory(type: ReportTargetType, targetId: number): Promise<ReportTargetHistoryRecord> {
    const column = targetColumn[type];
    const since = new Date(Date.now() - 30 * DAY_MS);
    const [summary] = await db
      .select({
        total: count(),
        open: count(sql`CASE WHEN ${reports.status} = 'OPEN' THEN 1 END`),
        last30Days: count(sql`CASE WHEN ${reports.createdAt} >= ${since} THEN 1 END`),
        distinctReporters: sql<number>`count(distinct ${reports.reporterId})`,
      })
      .from(reports)
      .where(eq(column, targetId));
    const byReason = await db
      .select({ reasonCode: reports.reasonCode, value: count() })
      .from(reports)
      .where(eq(column, targetId))
      .groupBy(reports.reasonCode)
      .orderBy(sql`count(*) desc`);
    const recent = await db
      .select({
        id: reports.id,
        reporterId: reports.reporterId,
        reasonCode: reports.reasonCode,
        status: reports.status,
        createdAt: reports.createdAt,
      })
      .from(reports)
      .where(eq(column, targetId))
      .orderBy(desc(reports.createdAt), desc(reports.id))
      .limit(RECENT_REPORT_LIMIT);

    return {
      total: Number(summary?.total ?? 0),
      open: Number(summary?.open ?? 0),
      last30Days: Number(summary?.last30Days ?? 0),
      distinctReporters: Number(summary?.distinctReporters ?? 0),
      byReason: byReason.map(row => ({ reasonCode: row.reasonCode, count: Number(row.value) })),
      recent,
    };
  },

  async findPlayer(userId: number) {
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
        joinedAt: users.createdAt,
        displayName: playerProfiles.fullName,
        phone: playerProfiles.phone,
        avatarUrl: playerProfiles.avatarUrl,
        skillLevelId: playerProfiles.skillLevelId,
        skillLevelName: skillLevels.name,
      })
      .from(users)
      .leftJoin(playerProfiles, eq(users.id, playerProfiles.userId))
      .leftJoin(skillLevels, eq(skillLevels.id, playerProfiles.skillLevelId))
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  },

  async recentPostsByAuthor(authorId: number) {
    return db
      .select({
        id: posts.id,
        type: posts.type,
        title: posts.title,
        body: posts.body,
        createdAt: posts.createdAt,
        hiddenAt: posts.hiddenAt,
        deletedAt: posts.deletedAt,
      })
      .from(posts)
      .where(eq(posts.authorId, authorId))
      .orderBy(desc(posts.createdAt), desc(posts.id))
      .limit(RECENT_CONTENT_LIMIT);
  },

  async recentCommentsByAuthor(authorId: number) {
    return db
      .select({
        id: postComments.id,
        postId: postComments.postId,
        body: postComments.body,
        createdAt: postComments.createdAt,
        hiddenAt: postComments.hiddenAt,
        deletedAt: postComments.deletedAt,
      })
      .from(postComments)
      .where(eq(postComments.authorId, authorId))
      .orderBy(desc(postComments.createdAt), desc(postComments.id))
      .limit(RECENT_CONTENT_LIMIT);
  },

  async hiddenContentCounts(authorId: number) {
    const [hiddenPosts] = await db
      .select({ value: count() })
      .from(posts)
      .where(and(eq(posts.authorId, authorId), isNotNull(posts.hiddenAt)));
    const [hiddenComments] = await db
      .select({ value: count() })
      .from(postComments)
      .where(and(eq(postComments.authorId, authorId), isNotNull(postComments.hiddenAt)));
    return {
      hiddenPostCount: Number(hiddenPosts?.value ?? 0),
      hiddenCommentCount: Number(hiddenComments?.value ?? 0),
    };
  },

  async findTournament(id: number) {
    const [row] = await db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        description: tournaments.description,
        format: tournaments.format,
        matchType: tournaments.matchType,
        status: tournaments.status,
        participantLimit: tournaments.participantLimit,
        entryFee: tournaments.entryFee,
        registrationStart: tournaments.registrationStart,
        registrationEnd: tournaments.registrationEnd,
        tournamentStart: tournaments.tournamentStart,
        tournamentEnd: tournaments.tournamentEnd,
        deletedAt: tournaments.deletedAt,
        creatorId: tournaments.creatorId,
        creatorDisplayName: playerProfiles.fullName,
        creatorBusinessName: courtOwnerProfiles.businessName,
        creatorEmail: users.email,
        creatorStatus: users.status,
        facilityId: facilities.id,
        facilityName: facilities.name,
      })
      .from(tournaments)
      .leftJoin(users, eq(users.id, tournaments.creatorId))
      .leftJoin(playerProfiles, eq(playerProfiles.userId, users.id))
      .leftJoin(courtOwnerProfiles, eq(courtOwnerProfiles.userId, users.id))
      .leftJoin(facilities, eq(facilities.id, tournaments.facilityId))
      .where(eq(tournaments.id, id))
      .limit(1);
    return row ?? null;
  },
};
