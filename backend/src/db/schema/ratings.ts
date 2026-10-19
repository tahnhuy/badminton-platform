import { pgTable, bigint, timestamp, text, integer, numeric, varchar, unique, check, foreignKey, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, skillLevels } from './users';
import { matches, matchPlayers } from './matchmaking';

export const playerRatings = pgTable('player_ratings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  raterId: bigint('rater_id', { mode: 'number' }).notNull().references(() => users.id),
  ratedPlayerId: bigint('rated_player_id', { mode: 'number' }).notNull().references(() => users.id),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  skillRating: integer('skill_rating').notNull(),
  attitudeRating: integer('attitude_rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqPlayerRating: unique('uq_player_rating').on(t.raterId, t.ratedPlayerId, t.matchId),
  chkSkillRange: check('chk_player_rating_skill_range', sql`${t.skillRating} BETWEEN 1 AND 5`),
  chkAttitudeRange: check('chk_player_rating_attitude_range', sql`${t.attitudeRating} BETWEEN 1 AND 5`),
  chkNoSelf: check('chk_player_rating_no_self', sql`${t.raterId} <> ${t.ratedPlayerId}`),
  matchRaterIdx: index('player_ratings_match_rater_idx').on(t.matchId, t.raterId),
  ratedPlayerIdx: index('player_ratings_rated_player_idx').on(t.ratedPlayerId),
  fkRaterMatch: foreignKey({
    columns: [t.matchId, t.raterId],
    foreignColumns: [matchPlayers.matchId, matchPlayers.playerId],
    name: 'player_ratings_match_id_rater_id_fkey'
  }),
  fkRatedMatch: foreignKey({
    columns: [t.matchId, t.ratedPlayerId],
    foreignColumns: [matchPlayers.matchId, matchPlayers.playerId],
    name: 'player_ratings_match_id_rated_player_id_fkey'
  }),
}));

export const playerSkillAdjustments = pgTable('player_skill_adjustments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  previousSkillLevelId: bigint('previous_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  newSkillLevelId: bigint('new_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  averageSkillRating: numeric('average_skill_rating').notNull(),
  ratingsConsidered: integer('ratings_considered').notNull(),
  source: varchar('source').notNull().default('AUTO_RATING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  chkRatingsConsidered: check('chk_player_skill_adjustment_ratings_considered', sql`${t.ratingsConsidered} > 0`),
  playerCreatedIdx: index('player_skill_adjustments_player_created_idx').on(t.playerId, t.createdAt),
}));
