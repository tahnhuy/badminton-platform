import { pgTable, bigint, varchar, timestamp, decimal, time, date, integer, uniqueIndex, unique, foreignKey, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, skillLevels } from './users';
import { courts } from './facilities';
import { bookings } from './bookings';

export const matchmakingRequests = pgTable('matchmaking_requests', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  matchType: varchar('match_type').notNull(),
  minSkillLevelId: bigint('min_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  maxSkillLevelId: bigint('max_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  preferredDate: date('preferred_date').notNull(),
  preferredStartTime: time('preferred_start_time').notNull(),
  preferredEndTime: time('preferred_end_time').notNull(),
  latitude: decimal('latitude').notNull(),
  longitude: decimal('longitude').notNull(),
  maxDistanceKm: decimal('max_distance_km').notNull(),
  status: varchar('status').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqMatchmakingOpenRequest: uniqueIndex('uq_matchmaking_open_request')
    .on(t.playerId, t.matchType)
    .where(sql`${t.status} = 'OPEN'`),
  matchmakingRequestsMatchScanIdx: index('matchmaking_requests_match_scan_idx')
    .on(t.status, t.matchType, t.preferredDate, t.createdAt),
}));

export const matches = pgTable('matches', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchType: varchar('match_type').notNull(),
  courtId: bigint('court_id', { mode: 'number' }).references(() => courts.id),
  bookingId: bigint('booking_id', { mode: 'number' }).unique().references(() => bookings.id),
  scheduledAt: timestamp('scheduled_at').notNull(),
  status: varchar('status').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  courtSearchExpiresAt: timestamp('court_search_expires_at'),
  confirmationExpiresAt: timestamp('confirmation_expires_at'),
  cancellationReason: varchar('cancellation_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  matchesStatusScheduledIdx: index('matches_status_scheduled_idx').on(t.status, t.scheduledAt),
  matchesStatusCourtSearchIdx: index('matches_status_court_search_idx').on(t.status, t.courtSearchExpiresAt),
  matchesStatusConfirmationIdx: index('matches_status_confirmation_idx').on(t.status, t.confirmationExpiresAt),
}));

export const matchmakingMatches = pgTable('matchmaking_matches', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchmakingRequestId: bigint('matchmaking_request_id', { mode: 'number' }).notNull().references(() => matchmakingRequests.id),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  status: varchar('status').notNull(),
  matchedAt: timestamp('matched_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqMatchmakingMatchesSuccess: uniqueIndex('uq_matchmaking_matches_success')
    .on(t.matchmakingRequestId)
    .where(sql`${t.status} = 'MATCHED'`),
}));

export const matchPlayers = pgTable('match_players', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  teamNo: integer('team_no').notNull(),
  status: varchar('status').notNull(),
  joinedAt: timestamp('joined_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqMatchPlayer: unique('uq_match_player').on(t.matchId, t.playerId),
  matchPlayersPlayerMatchIdx: index('match_players_player_match_idx').on(t.playerId, t.matchId),
}));

export const matchConfirmations = pgTable('match_confirmations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchId: bigint('match_id', { mode: 'number' }).notNull(),
  playerId: bigint('player_id', { mode: 'number' }).notNull(),
  status: varchar('status').notNull(),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqMatchConfirmation: unique('uq_match_confirmation').on(t.matchId, t.playerId),
  matchConfirmationsMatchStatusIdx: index('match_confirmations_match_status_idx').on(t.matchId, t.status),
  fkMatchPlayer: foreignKey({
    columns: [t.matchId, t.playerId],
    foreignColumns: [matchPlayers.matchId, matchPlayers.playerId],
    name: 'match_confirmations_match_id_player_id_fkey'
  }),
}));

export const matchGames = pgTable('match_games', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  gameNo: integer('game_no').notNull(),
  team1Score: integer('team1_score').notNull(),
  team2Score: integer('team2_score').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});
