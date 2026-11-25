import {
  db,
  playerRatings,
  matches,
  matchPlayers,
  matchmakingMatches,
  matchmakingRequests,
  tournamentMatches,
  users,
  playerProfiles,
} from '../../db';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type Executor = any;

export interface NewRatingData {
  raterId: number;
  ratedPlayerId: number;
  matchId: number;
  skillRating: number;
  attitudeRating: number;
  comment: string | null;
}

export interface RatingRow {
  id: number;
  raterId: number;
  ratedPlayerId: number;
  matchId: number;
  skillRating: number;
  attitudeRating: number;
  comment: string | null;
  createdAt: Date;
}

export interface ParticipantRow {
  playerId: number;
  teamNo: number;
  status: string;
  fullName: string | null;
}

export interface RatingListFilter {
  userId: number;
  direction: 'given' | 'received';
  page: number;
  limit: number;
}

export interface RatingListRow {
  id: number;
  matchId: number;
  raterId: number;
  raterFullName: string | null;
  ratedPlayerId: number;
  ratedPlayerFullName: string | null;
  skillRating: number;
  attitudeRating: number;
  comment: string | null;
  createdAt: Date;
  matchType: string | null;
  scheduledAt: Date | null;
  hostName: string | null;
  durationMinutes: number | null;
}

export interface Aggregates {
  totalRatings: number;
  sumSkill: number;
  sumAttitude: number;
  skillCounts: number[];
  attitudeCounts: number[];
}

function mapRating(row: any): RatingRow {
  return {
    id: Number(row.id),
    raterId: Number(row.raterId),
    ratedPlayerId: Number(row.ratedPlayerId),
    matchId: Number(row.matchId),
    skillRating: Number(row.skillRating),
    attitudeRating: Number(row.attitudeRating),
    comment: row.comment ?? null,
    createdAt: row.createdAt,
  };
}

export class RatingRepository {
  async findMatchById(matchId: number, executor: Executor = db) {
    const rows = await executor
      .select({
        id: matches.id,
        matchType: matches.matchType,
        status: matches.status,
        completedAt: matches.completedAt,
      })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findTournamentMatchByMatchId(matchId: number, executor: Executor = db) {
    const rows = await executor
      .select({ matchId: tournamentMatches.matchId, resolution: tournamentMatches.resolution })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.matchId, matchId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findParticipants(matchId: number, executor: Executor = db): Promise<ParticipantRow[]> {
    const rows = await executor
      .select({
        playerId: matchPlayers.playerId,
        teamNo: matchPlayers.teamNo,
        status: matchPlayers.status,
        fullName: playerProfiles.fullName,
      })
      .from(matchPlayers)
      .leftJoin(playerProfiles, eq(playerProfiles.userId, matchPlayers.playerId))
      .where(eq(matchPlayers.matchId, matchId))
      .orderBy(asc(matchPlayers.teamNo), asc(matchPlayers.id));
    return rows.map((row: any) => ({
      playerId: Number(row.playerId),
      teamNo: Number(row.teamNo),
      status: row.status,
      fullName: row.fullName ?? null,
    }));
  }

  async findRatingsForRaterInMatch(
    raterId: number,
    matchId: number,
    executor: Executor = db
  ): Promise<RatingRow[]> {
    const rows = await executor
      .select()
      .from(playerRatings)
      .where(and(eq(playerRatings.raterId, raterId), eq(playerRatings.matchId, matchId)));
    return rows.map(mapRating);
  }

  /** Caller's submissions in a Match joined with the rated player's display name. */
  async findRaterRatingsWithNames(raterId: number, matchId: number, executor: Executor = db) {
    const ratedProfile = alias(playerProfiles, 'rated_profile');
    const rows = await executor
      .select({
        id: playerRatings.id,
        ratedPlayerId: playerRatings.ratedPlayerId,
        fullName: ratedProfile.fullName,
        skillRating: playerRatings.skillRating,
        attitudeRating: playerRatings.attitudeRating,
        comment: playerRatings.comment,
        createdAt: playerRatings.createdAt,
      })
      .from(playerRatings)
      .leftJoin(ratedProfile, eq(ratedProfile.userId, playerRatings.ratedPlayerId))
      .where(and(eq(playerRatings.raterId, raterId), eq(playerRatings.matchId, matchId)));
    return rows;
  }

  async insertRatings(rows: NewRatingData[], executor: Executor = db): Promise<RatingRow[]> {
    if (rows.length === 0) return [];
    const inserted = await executor
      .insert(playerRatings)
      .values(
        rows.map((row) => ({
          raterId: row.raterId,
          ratedPlayerId: row.ratedPlayerId,
          matchId: row.matchId,
          skillRating: row.skillRating,
          attitudeRating: row.attitudeRating,
          comment: row.comment,
          // PostgreSQL now() is transaction-start time and may predate a lock wait.
          createdAt: sql`clock_timestamp()`,
          updatedAt: sql`clock_timestamp()`,
        }))
      )
      .onConflictDoNothing({
        target: [playerRatings.raterId, playerRatings.ratedPlayerId, playerRatings.matchId],
      })
      .returning();
    return inserted.map(mapRating);
  }

  async findUserById(userId: number, executor: Executor = db) {
    const rows = await executor
      .select({
        id: users.id,
        role: users.role,
        status: users.status,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Global lock order rank 10: users before player_profiles (rank 20). */
  async lockUsersAscending(userIds: number[], executor: Executor): Promise<void> {
    if (userIds.length === 0) return;
    const sorted = [...new Set(userIds)].sort((a, b) => a - b);
    for (const userId of sorted) {
      await executor
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .for('update');
    }
  }

  async lockPlayerProfilesAscending(playerIds: number[], executor: Executor): Promise<void> {
    if (playerIds.length === 0) return;
    const sorted = [...new Set(playerIds)].sort((a, b) => a - b);
    for (const playerId of sorted) {
      await executor
        .select({ userId: playerProfiles.userId })
        .from(playerProfiles)
        .where(eq(playerProfiles.userId, playerId))
        .for('update');
    }
  }

  /** Reads the received-rating aggregate for a Player with a single grouped query. */
  async getAggregates(ratedPlayerId: number, executor: Executor = db): Promise<Aggregates> {
    const [row] = await executor
      .select({
        total: count(),
        sumSkill: sql<number>`coalesce(sum(${playerRatings.skillRating}), 0)`,
        sumAttitude: sql<number>`coalesce(sum(${playerRatings.attitudeRating}), 0)`,
        s1: sql<number>`count(*) FILTER (WHERE ${playerRatings.skillRating} = 1)`,
        s2: sql<number>`count(*) FILTER (WHERE ${playerRatings.skillRating} = 2)`,
        s3: sql<number>`count(*) FILTER (WHERE ${playerRatings.skillRating} = 3)`,
        s4: sql<number>`count(*) FILTER (WHERE ${playerRatings.skillRating} = 4)`,
        s5: sql<number>`count(*) FILTER (WHERE ${playerRatings.skillRating} = 5)`,
        a1: sql<number>`count(*) FILTER (WHERE ${playerRatings.attitudeRating} = 1)`,
        a2: sql<number>`count(*) FILTER (WHERE ${playerRatings.attitudeRating} = 2)`,
        a3: sql<number>`count(*) FILTER (WHERE ${playerRatings.attitudeRating} = 3)`,
        a4: sql<number>`count(*) FILTER (WHERE ${playerRatings.attitudeRating} = 4)`,
        a5: sql<number>`count(*) FILTER (WHERE ${playerRatings.attitudeRating} = 5)`,
      })
      .from(playerRatings)
      .where(eq(playerRatings.ratedPlayerId, ratedPlayerId));

    return {
      totalRatings: Number(row?.total ?? 0),
      sumSkill: Number(row?.sumSkill ?? 0),
      sumAttitude: Number(row?.sumAttitude ?? 0),
      skillCounts: [1, 2, 3, 4, 5].map((v) => Number((row as any)?.[`s${v}`] ?? 0)),
      attitudeCounts: [1, 2, 3, 4, 5].map((v) => Number((row as any)?.[`a${v}`] ?? 0)),
    };
  }

  async listRatings(filter: RatingListFilter, executor: Executor = db) {
    const raterProfile = alias(playerProfiles, 'rater_profile');
    const ratedProfile = alias(playerProfiles, 'rated_profile');
    const matchHost = alias(playerProfiles, 'rating_match_host');
    const scope =
      filter.direction === 'given'
        ? eq(playerRatings.raterId, filter.userId)
        : eq(playerRatings.ratedPlayerId, filter.userId);

    const [countRow] = await executor
      .select({ total: count() })
      .from(playerRatings)
      .where(scope);
    const total = Number(countRow?.total ?? 0);

    const rows: RatingListRow[] = await executor
      .select({
        id: playerRatings.id,
        matchId: playerRatings.matchId,
        raterId: playerRatings.raterId,
        raterFullName: raterProfile.fullName,
        ratedPlayerId: playerRatings.ratedPlayerId,
        ratedPlayerFullName: ratedProfile.fullName,
        skillRating: playerRatings.skillRating,
        attitudeRating: playerRatings.attitudeRating,
        comment: playerRatings.comment,
        createdAt: playerRatings.createdAt,
        matchType: matches.matchType,
        scheduledAt: matches.scheduledAt,
        hostName: matchHost.fullName,
        durationMinutes: matchmakingRequests.durationMinutes,
      })
      .from(playerRatings)
      .leftJoin(raterProfile, eq(raterProfile.userId, playerRatings.raterId))
      .leftJoin(ratedProfile, eq(ratedProfile.userId, playerRatings.ratedPlayerId))
      .leftJoin(matches, eq(matches.id, playerRatings.matchId))
      .leftJoin(matchmakingMatches, eq(matchmakingMatches.matchId, playerRatings.matchId))
      .leftJoin(matchmakingRequests, eq(matchmakingRequests.id, matchmakingMatches.matchmakingRequestId))
      .leftJoin(matchHost, eq(matchHost.userId, matchmakingRequests.playerId))
      .where(scope)
      .orderBy(desc(playerRatings.createdAt), desc(playerRatings.id))
      .limit(filter.limit)
      .offset((filter.page - 1) * filter.limit);

    return {
      items: rows.map((row: any) => ({
        id: Number(row.id),
        matchId: Number(row.matchId),
        raterId: Number(row.raterId),
        raterFullName: row.raterFullName ?? null,
        ratedPlayerId: Number(row.ratedPlayerId),
        ratedPlayerFullName: row.ratedPlayerFullName ?? null,
        skillRating: Number(row.skillRating),
        attitudeRating: Number(row.attitudeRating),
        comment: row.comment ?? null,
        createdAt: row.createdAt,
        matchType: row.matchType ?? null,
        scheduledAt: row.scheduledAt ?? null,
        hostName: row.hostName ?? null,
        durationMinutes: row.durationMinutes == null ? null : Number(row.durationMinutes),
      })),
      total,
    };
  }
}

export const ratingRepository = new RatingRepository();
