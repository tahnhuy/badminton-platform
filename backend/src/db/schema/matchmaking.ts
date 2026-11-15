import { pgTable, bigint, varchar, timestamp, integer, smallint, date, time, uniqueIndex, unique, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, skillLevels } from './users';
import { courts } from './facilities';
import { bookings } from './bookings';
import { posts } from './social';

// database-schema.md §13.3 (MM-21). Legacy window columns are kept for history and are
// nullable for new rows; the recruitment interval is [start_at, start_at + duration_minutes).
export const matchmakingRequests = pgTable('matchmaking_requests', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  matchType: varchar('match_type').notNull(),
  minSkillLevelId: bigint('min_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  maxSkillLevelId: bigint('max_skill_level_id', { mode: 'number' }).notNull().references(() => skillLevels.id),
  preferredDate: date('preferred_date'),
  preferredStartTime: time('preferred_start_time'),
  preferredEndTime: time('preferred_end_time'),
  area: varchar('area'),
  matchDurationMinutes: integer('match_duration_minutes'),
  status: varchar('status').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  postId: bigint('post_id', { mode: 'number' }).notNull().references(() => posts.id),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  capacity: smallint('capacity').notNull(),
  minPlayers: smallint('min_players').notNull(),
  companionCount: smallint('companion_count').notNull().default(0),
  costNote: varchar('cost_note', { length: 200 }),
  externalCourtName: varchar('external_court_name', { length: 120 }),
  externalCourtCity: varchar('external_court_city'),
  externalCourtDistrict: varchar('external_court_district'),
  externalCourtAddress: varchar('external_court_address', { length: 200 }),
  bookingId: bigint('booking_id', { mode: 'number' }).references(() => bookings.id),
  cancellationReason: varchar('cancellation_reason'),
  closedEarlyAt: timestamp('closed_early_at', { withTimezone: true }),
  courtSameVenueConfirmedAt: timestamp('court_same_venue_confirmed_at', { withTimezone: true }),
  courtSameVenueConfirmedBy: bigint('court_same_venue_confirmed_by', { mode: 'number' }).references(() => users.id),
}, (t) => ({
  matchmakingRequestsExpiryIdx: index('matchmaking_requests_expiry_idx')
    .on(t.status, t.expiresAt, t.id),
  uqPost: uniqueIndex('uq_matchmaking_requests_post').on(t.postId),
  uqBooking: uniqueIndex('uq_matchmaking_requests_booking').on(t.bookingId),
  duration: check('chk_matchmaking_requests_duration', sql`${t.durationMinutes} BETWEEN 1 AND 1440`),
  companions: check('chk_matchmaking_requests_companions', sql`${t.companionCount} >= 0`),
  typeShape: check('chk_matchmaking_requests_type_shape', sql`(
    (${t.matchType} = 'SINGLES' AND ${t.capacity} = 2 AND ${t.minPlayers} = 2 AND ${t.companionCount} = 0)
    OR (${t.matchType} = 'DOUBLES' AND ${t.capacity} = 4 AND ${t.minPlayers} = 4 AND ${t.companionCount} = 0)
    OR (${t.matchType} = 'GROUP' AND ${t.capacity} BETWEEN 3 AND 20 AND ${t.minPlayers} BETWEEN 2 AND ${t.capacity} AND 1 + ${t.companionCount} <= ${t.capacity})
  )`),
  externalCourt: check('chk_matchmaking_requests_external_court', sql`(
    (${t.externalCourtName} IS NULL AND ${t.externalCourtCity} IS NULL AND ${t.externalCourtDistrict} IS NULL AND ${t.externalCourtAddress} IS NULL)
    OR (${t.externalCourtName} IS NOT NULL AND ${t.externalCourtCity} IS NOT NULL AND ${t.externalCourtDistrict} IS NOT NULL AND ${t.externalCourtAddress} IS NOT NULL)
  )`),
  courtConsistency: check('chk_matchmaking_requests_court_consistency', sql`${t.bookingId} IS NULL OR ${t.externalCourtName} IS NULL OR ${t.courtSameVenueConfirmedAt} IS NOT NULL`),
  sameVenuePair: check('chk_matchmaking_requests_same_venue_pair', sql`(${t.courtSameVenueConfirmedAt} IS NULL) = (${t.courtSameVenueConfirmedBy} IS NULL)`),
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

// database-schema.md §13.5 (MM-21): one membership table for Invite and Apply.
// Current membership of a request = host + rows with status ACCEPTED.
export const matchmakingInvitations = pgTable('matchmaking_invitations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  requestId: bigint('request_id', { mode: 'number' }).notNull().references(() => matchmakingRequests.id),
  createdBy: bigint('created_by', { mode: 'number' }).notNull().references(() => users.id),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  kind: varchar('kind').notNull(),
  decidedBy: bigint('decided_by', { mode: 'number' }).references(() => users.id),
  closeReason: varchar('close_reason'),
  status: varchar('status').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqActiveMembership: uniqueIndex('uq_matchmaking_membership_active')
    .on(t.requestId, t.playerId)
    .where(sql`${t.status} IN ('PENDING', 'ACCEPTED')`),
  matchmakingInvitationsExpiryIdx: index('matchmaking_invitations_expiry_idx')
    .on(t.status, t.expiresAt, t.id),
  matchmakingInvitationsPlayerIdx: index('matchmaking_invitations_player_idx')
    .on(t.playerId, t.createdAt, t.id),
  matchmakingInvitationsCreatedByIdx: index('matchmaking_invitations_created_by_idx')
    .on(t.createdBy, t.createdAt, t.id),
  matchmakingInvitationsGroupIdx: index('matchmaking_invitations_group_idx')
    .on(t.requestId, t.status, t.playerId),
  kind: check('chk_matchmaking_invitations_kind', sql`${t.kind} IN ('INVITE', 'APPLY')`),
  inviteNotSelf: check('chk_matchmaking_invitations_invite_not_self', sql`${t.playerId} <> ${t.createdBy} OR ${t.kind} = 'APPLY'`),
  applySelf: check('chk_matchmaking_invitations_apply_self', sql`${t.kind} = 'INVITE' OR ${t.createdBy} = ${t.playerId}`),
}));

export const matchPlayers = pgTable('match_players', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  // §13.6: NULL for GROUP (cross-table rule enforced by MatchModule).
  teamNo: integer('team_no'),
  status: varchar('status').notNull(),
  joinedAt: timestamp('joined_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqMatchPlayer: unique('uq_match_player').on(t.matchId, t.playerId),
  teamNo: check('chk_match_players_team_no', sql`${t.teamNo} IS NULL OR ${t.teamNo} IN (1, 2)`),
  matchPlayersPlayerMatchIdx: index('match_players_player_match_idx').on(t.playerId, t.matchId),
}));

export const matchBookingCancellationJobs = pgTable('match_booking_cancellation_jobs', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  // §13.6 (MM-21): keyed by request; match_id nullable because a booking can be linked
  // before any Match exists (consumed by MM-20).
  matchId: bigint('match_id', { mode: 'number' }).unique().references(() => matches.id),
  requestId: bigint('request_id', { mode: 'number' }).unique().references(() => matchmakingRequests.id),
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
