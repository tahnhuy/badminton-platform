import { pgTable, bigint, timestamp, text, integer, unique, foreignKey } from 'drizzle-orm/pg-core';
import { users } from './users';
import { matches, matchPlayers } from './matchmaking';

export const playerRatings = pgTable('player_ratings', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  raterId: bigint('rater_id', { mode: 'number' }).notNull().references(() => users.id),
  ratedPlayerId: bigint('rated_player_id', { mode: 'number' }).notNull().references(() => users.id),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  rating: integer('rating').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqPlayerRating: unique('uq_player_rating').on(t.raterId, t.ratedPlayerId, t.matchId),
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
