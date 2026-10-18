import { pgTable, bigint, varchar, timestamp, integer, date, time, uniqueIndex, unique, index } from 'drizzle-orm/pg-core';
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
  area: varchar('area'),
  matchDurationMinutes: integer('match_duration_minutes').notNull(),
  status: varchar('status').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqMatchmakingOpenRequest: uniqueIndex('uq_matchmaking_open_request')
    .on(t.playerId, t.matchType)
    .where(sql`${t.status} = 'OPEN'`),
  matchmakingRequestsExpiryIdx: index('matchmaking_requests_expiry_idx')
    .on(t.status, t.expiresAt, t.id),
}));

export const matches = pgTable('matches', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchType: varchar('match_type').notNull(),
  courtId: bigint('court_id', { mode: 'number' }).references(() => courts.id),
  bookingId: bigint('booking_id', { mode: 'number' }).unique().references(() => bookings.id),
  scheduledAt: timestamp('scheduled_at').notNull(),
  status: varchar('status').notNull(),
  bookingDeadlineAt: timestamp('booking_deadline_at'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  cancellationReason: varchar('cancellation_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  matchesStatusScheduledIdx: index('matches_status_scheduled_idx').on(t.status, t.scheduledAt),
  matchesStatusBookingDeadlineIdx: index('matches_status_booking_deadline_idx')
    .on(t.status, t.bookingDeadlineAt, t.id),
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
  matchmakingMatchesMatchIdx: index('matchmaking_matches_match_idx').on(t.matchId),
}));

export const matchmakingInvitations = pgTable('matchmaking_invitations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull().references(() => matchmakingRequests.id),
  inviterId: bigint('inviter_id', { mode: 'number' }).notNull().references(() => users.id),
  inviteeId: bigint('invitee_id', { mode: 'number' }).notNull().references(() => users.id),
  status: varchar('status').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqMatchmakingInvitesPending: uniqueIndex('uq_matchmaking_invites_pending')
    .on(t.requestId, t.inviteeId)
    .where(sql`${t.status} = 'PENDING'`),
  matchmakingInvitationsExpiryIdx: index('matchmaking_invitations_expiry_idx')
    .on(t.status, t.expiresAt, t.id),
  matchmakingInvitationsInviteeIdx: index('matchmaking_invitations_invitee_idx')
    .on(t.inviteeId, t.createdAt, t.id),
  matchmakingInvitationsInviterIdx: index('matchmaking_invitations_inviter_idx')
    .on(t.inviterId, t.createdAt, t.id),
  matchmakingInvitationsGroupIdx: index('matchmaking_invitations_group_idx')
    .on(t.requestId, t.status, t.inviteeId),
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

export const matchBookingCancellationJobs = pgTable('match_booking_cancellation_jobs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchId: bigint('match_id', { mode: 'number' }).notNull().unique().references(() => matches.id),
  bookingId: bigint('booking_id', { mode: 'number' }).notNull().references(() => bookings.id),
  status: varchar('status').notNull(),
  attempts: integer('attempts').notNull().default(0),
  nextAttemptAt: timestamp('next_attempt_at'),
  lastErrorCode: varchar('last_error_code'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  matchBookingCancellationJobsStatusIdx: index('match_booking_cancellation_jobs_status_idx')
    .on(t.status, t.nextAttemptAt, t.id),
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
