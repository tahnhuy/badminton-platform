import { sql } from 'drizzle-orm';
import { bigint, check, index, numeric, pgTable, smallint, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { skillLevels, users } from './users';
import { tournamentMatches, tournaments } from './tournaments';

/**
 * Skill rating from professional tournaments (Tournament Tech Design §7.10, TRN-14).
 * `skill_level_changes` is append-only (audit); `skill_rating_events` is a rebuildable cache.
 */
export const skillLevelChanges = pgTable('skill_level_changes', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  fromLevelId: bigint('from_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  toLevelId: bigint('to_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  skillRating: numeric('skill_rating', { precision: 6, scale: 2 }).notNull(),
  tournamentId: bigint('tournament_id', { mode: 'number' }).references(() => tournaments.id),
  reason: varchar('reason').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  chkReason: check('chk_skill_level_changes_reason', sql`${t.reason} IN ('TOURNAMENT_RESULT', 'RECALCULATION')`),
  idxPlayerCreated: index('skill_level_changes_player_created_idx').on(t.playerId, t.createdAt),
}));

export const skillRatingEvents = pgTable('skill_rating_events', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  tournamentMatchId: bigint('tournament_match_id', { mode: 'number' }).notNull().references(() => tournamentMatches.id),
  ratingBefore: numeric('rating_before', { precision: 6, scale: 2 }).notNull(),
  ratingAfter: numeric('rating_after', { precision: 6, scale: 2 }).notNull(),
  opponentRating: numeric('opponent_rating', { precision: 6, scale: 2 }).notNull(),
  expected: numeric('expected', { precision: 6, scale: 4 }).notNull(),
  kFactor: numeric('k_factor', { precision: 5, scale: 2 }).notNull(),
  outcome: smallint('outcome').notNull(),
  sequence: bigint('sequence', { mode: 'number' }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  chkOutcome: check('chk_skill_rating_events_outcome', sql`${t.outcome} IN (0, 1)`),
  uqPlayerMatch: uniqueIndex('uq_skill_rating_events_player_match').on(t.playerId, t.tournamentMatchId),
  idxPlayerSequence: index('skill_rating_events_player_sequence_idx').on(t.playerId, t.sequence),
}));
