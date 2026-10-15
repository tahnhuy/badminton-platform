import { db, playerRatings, playerSkillAdjustments, playerProfiles, skillLevels } from '../../db';
import { count, desc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

type Executor = any;

export interface NewAdjustmentData {
  playerId: number;
  previousSkillLevelId: number;
  newSkillLevelId: number;
  averageSkillRating: string;
  ratingsConsidered: number;
  createdAt: Date;
}

export interface SkillLevelRow {
  id: number;
  code: string;
  name: string;
  rank: number;
}

export class SkillAdjustmentRepository {
  /**
   * Most recent received skill ratings for a Player, newest submission first.
   * Ordering is `created_at DESC, id DESC` (Ratings Tech Design §7.7 item 4).
   */
  async findRecentSkillRatings(
    ratedPlayerId: number,
    limit: number,
    executor: Executor = db
  ): Promise<number[]> {
    const rows = await executor
      .select({ skillRating: playerRatings.skillRating })
      .from(playerRatings)
      .where(eq(playerRatings.ratedPlayerId, ratedPlayerId))
      .orderBy(desc(playerRatings.createdAt), desc(playerRatings.id))
      .limit(limit);
    return rows.map((row: any) => Number(row.skillRating));
  }

  async findLastAdjustment(ratedPlayerId: number, executor: Executor = db) {
    const rows = await executor
      .select({ id: playerSkillAdjustments.id, createdAt: playerSkillAdjustments.createdAt })
      .from(playerSkillAdjustments)
      .where(eq(playerSkillAdjustments.playerId, ratedPlayerId))
      .orderBy(desc(playerSkillAdjustments.createdAt), desc(playerSkillAdjustments.id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPlayerProfileForUpdate(playerId: number, executor: Executor) {
    const rows = await executor
      .select({ userId: playerProfiles.userId, skillLevelId: playerProfiles.skillLevelId })
      .from(playerProfiles)
      .where(eq(playerProfiles.userId, playerId))
      .for('update');
    return rows[0] ?? null;
  }

  async findSkillLevelById(id: number, executor: Executor = db): Promise<SkillLevelRow | null> {
    const rows = await executor
      .select({ id: skillLevels.id, code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank })
      .from(skillLevels)
      .where(eq(skillLevels.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async findSkillLevelByRank(rank: number, executor: Executor = db): Promise<SkillLevelRow | null> {
    const rows = await executor
      .select({ id: skillLevels.id, code: skillLevels.code, name: skillLevels.name, rank: skillLevels.rank })
      .from(skillLevels)
      .where(eq(skillLevels.rank, rank))
      .limit(1);
    return rows[0] ?? null;
  }

  async updatePlayerSkillLevel(playerId: number, skillLevelId: number, executor: Executor): Promise<void> {
    await executor
      .update(playerProfiles)
      .set({ skillLevelId, updatedAt: new Date() })
      .where(eq(playerProfiles.userId, playerId));
  }

  async insertAdjustment(data: NewAdjustmentData, executor: Executor): Promise<{ id: number }> {
    const [row] = await executor
      .insert(playerSkillAdjustments)
      .values({
        playerId: data.playerId,
        previousSkillLevelId: data.previousSkillLevelId,
        newSkillLevelId: data.newSkillLevelId,
        averageSkillRating: data.averageSkillRating,
        ratingsConsidered: data.ratingsConsidered,
        source: 'AUTO_RATING',
        createdAt: data.createdAt,
      })
      .returning({ id: playerSkillAdjustments.id });
    return row;
  }

  /** Paginated, deterministic adjustment history for Admin oversight. */
  async listAdjustments(userId: number, page: number, limit: number, executor: Executor = db) {
    const previousLevel = alias(skillLevels, 'previous_skill_level');
    const newLevel = alias(skillLevels, 'new_skill_level');

    const [countRow] = await executor
      .select({ total: count() })
      .from(playerSkillAdjustments)
      .where(eq(playerSkillAdjustments.playerId, userId));
    const total = Number(countRow?.total ?? 0);

    const rows = await executor
      .select({
        id: playerSkillAdjustments.id,
        playerId: playerSkillAdjustments.playerId,
        previousSkillLevelId: playerSkillAdjustments.previousSkillLevelId,
        previousCode: previousLevel.code,
        previousName: previousLevel.name,
        previousRank: previousLevel.rank,
        newSkillLevelId: playerSkillAdjustments.newSkillLevelId,
        newCode: newLevel.code,
        newName: newLevel.name,
        newRank: newLevel.rank,
        averageSkillRating: playerSkillAdjustments.averageSkillRating,
        ratingsConsidered: playerSkillAdjustments.ratingsConsidered,
        source: playerSkillAdjustments.source,
        createdAt: playerSkillAdjustments.createdAt,
      })
      .from(playerSkillAdjustments)
      .leftJoin(previousLevel, eq(previousLevel.id, playerSkillAdjustments.previousSkillLevelId))
      .leftJoin(newLevel, eq(newLevel.id, playerSkillAdjustments.newSkillLevelId))
      .where(eq(playerSkillAdjustments.playerId, userId))
      .orderBy(desc(playerSkillAdjustments.createdAt), desc(playerSkillAdjustments.id))
      .limit(limit)
      .offset((page - 1) * limit);

    return {
      items: rows.map((row: any) => ({
        id: Number(row.id),
        playerId: Number(row.playerId),
        previousSkillLevel: {
          id: Number(row.previousSkillLevelId),
          code: row.previousCode ?? null,
          name: row.previousName ?? null,
          rank: row.previousRank != null ? Number(row.previousRank) : null,
        },
        newSkillLevel: {
          id: Number(row.newSkillLevelId),
          code: row.newCode ?? null,
          name: row.newName ?? null,
          rank: row.newRank != null ? Number(row.newRank) : null,
        },
        averageSkillRating: Number(row.averageSkillRating),
        ratingsConsidered: Number(row.ratingsConsidered),
        source: row.source,
        createdAt: row.createdAt,
      })),
      total,
    };
  }
}

export const skillAdjustmentRepository = new SkillAdjustmentRepository();
