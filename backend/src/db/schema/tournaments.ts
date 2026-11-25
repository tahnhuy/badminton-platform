import { pgTable, bigint, varchar, text, timestamp, integer, numeric, time, char, uniqueIndex, unique, check, index, AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users, skillLevels } from './users';
import { matches } from './matchmaking';
import { facilities } from './facilities';
import { conversations } from './messaging';

// Tournament Tech Design §4 (rewritten 2026-11-25, TRN-01).

export const tournaments = pgTable('tournaments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  creatorId: bigint('creator_id', { mode: 'number' }).notNull().references(() => users.id),
  name: varchar('name').notNull(),
  description: text('description'),
  format: varchar('format').notNull(),
  matchType: varchar('match_type').notNull(),
  competitionType: varchar('competition_type').notNull().default('PROFESSIONAL'),
  // No longer used by the API (Tech Design §4.1): venue is the free-text `venue_note`.
  facilityId: bigint('facility_id', { mode: 'number' }).references(() => facilities.id),
  venueNote: text('venue_note'),
  participantLimit: integer('participant_limit').notNull(),
  entryFee: numeric('entry_fee').notNull().default('0'),
  minSkillLevelId: bigint('min_skill_level_id', { mode: 'number' }).references(() => skillLevels.id),
  maxSkillLevelId: bigint('max_skill_level_id', { mode: 'number' }).references(() => skillLevels.id),
  courtCount: integer('court_count').notNull().default(2),
  matchDurationMinutes: integer('match_duration_minutes').notNull().default(45),
  minRestMinutes: integer('min_rest_minutes').notNull().default(15),
  dailyStartTime: time('daily_start_time').notNull().default('08:00'),
  dailyEndTime: time('daily_end_time').notNull().default('21:00'),
  status: varchar('status').notNull(),
  registrationStart: timestamp('registration_start').notNull(),
  registrationEnd: timestamp('registration_end').notNull(),
  tournamentStart: timestamp('tournament_start').notNull(),
  tournamentEnd: timestamp('tournament_end').notNull(),
  drawSeed: bigint('draw_seed', { mode: 'number' }),
  // Exact field-strength snapshot at draw time, without rounding.
  rankingRankSum: integer('ranking_rank_sum'),
  rankingPlayerCount: integer('ranking_player_count'),
  conversationId: bigint('conversation_id', { mode: 'number' }).references(() => conversations.id),
  cancelReason: varchar('cancel_reason', { length: 300 }),
  cancelledBy: bigint('cancelled_by', { mode: 'number' }).references(() => users.id),
  cancelledAt: timestamp('cancelled_at'),
  completedAt: timestamp('completed_at'),
  // NULL with `completed_at` set = completed automatically by the tournament job (PRD Decision #23).
  completedBy: bigint('completed_by', { mode: 'number' }).references(() => users.id),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkTournamentEntryFee: check('chk_tournament_entry_fee', sql`${t.entryFee} >= 0`),
  chkTournamentStatus: check('chk_tournament_status', sql`${t.status} IN ('DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')`),
  chkTournamentFormat: check('chk_tournament_format', sql`${t.format} = 'SINGLE_ELIMINATION'`),
  chkTournamentMatchType: check('chk_tournament_match_type', sql`${t.matchType} IN ('SINGLES', 'DOUBLES')`),
  chkTournamentCompetitionType: check('chk_tournament_competition_type', sql`${t.competitionType} IN ('PROFESSIONAL', 'CASUAL')`),
  chkTournamentParticipantLimit: check('chk_tournament_participant_limit', sql`${t.participantLimit} BETWEEN 2 AND 128`),
  chkTournamentCourtCount: check('chk_tournament_court_count', sql`${t.courtCount} BETWEEN 1 AND 20`),
  chkTournamentMatchDuration: check('chk_tournament_match_duration', sql`${t.matchDurationMinutes} BETWEEN 10 AND 180`),
  chkTournamentMinRest: check('chk_tournament_min_rest', sql`${t.minRestMinutes} BETWEEN 0 AND 240`),
  chkTournamentDailyWindow: check('chk_tournament_daily_window', sql`${t.dailyStartTime} < ${t.dailyEndTime}`),
  chkTournamentRankingField: check('chk_tournament_ranking_field', sql`(${t.rankingRankSum} IS NULL AND ${t.rankingPlayerCount} IS NULL) OR (${t.rankingRankSum} IS NOT NULL AND ${t.rankingPlayerCount} IS NOT NULL AND ${t.rankingRankSum} > 0 AND ${t.rankingPlayerCount} > 0)`),
  idxTournamentsStatusCreated: index('tournaments_status_created_idx').on(t.status, t.createdAt),
  idxTournamentsCreator: index('tournaments_creator_created_idx').on(t.creatorId, t.createdAt),
}));

export const tournamentTeams = pgTable('tournament_teams', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  name: varchar('name').notNull(),
  captainId: bigint('captain_id', { mode: 'number' }).notNull().references(() => users.id),
  status: varchar('status').notNull(),
  // sha256 of the invite-link token (Tech Design §3.2); the raw token is never stored.
  inviteTokenHash: char('invite_token_hash', { length: 64 }).unique('uq_tournament_teams_invite_token_hash'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkTournamentTeamStatus: check('chk_tournament_team_status', sql`${t.status} IN ('FORMING', 'FULL', 'REGISTERED', 'DISBANDED')`),
}));

export const teamInvitations = pgTable('team_invitations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  teamId: bigint('team_id', { mode: 'number' }).notNull().references(() => tournamentTeams.id),
  inviterId: bigint('inviter_id', { mode: 'number' }).notNull().references(() => users.id),
  inviteeId: bigint('invitee_id', { mode: 'number' }).notNull().references(() => users.id),
  status: varchar('status').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  respondedAt: timestamp('responded_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkTeamInvitationStatus: check('chk_team_invitation_status', sql`${t.status} IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')`),
  // The captain has at most one pending invitation per team (Tech Design §4.2).
  uqTeamInvitationPending: uniqueIndex('uq_team_invitations_pending_team')
    .on(t.teamId)
    .where(sql`${t.status} = 'PENDING'`),
}));

export const tournamentTeamPlayers = pgTable('tournament_team_players', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  teamId: bigint('team_id', { mode: 'number' }).notNull().references(() => tournamentTeams.id),
  // Denormalised from the team so one Player cannot be in two teams of a tournament (Tech Design §4.2).
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  role: varchar('role').notNull(),
  joinedAt: timestamp('joined_at').notNull(),
  // Set when the member leaves, is removed, or the team is disbanded; such rows are inactive.
  leftAt: timestamp('left_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkTeamPlayerRole: check('chk_tournament_team_player_role', sql`${t.role} IN ('CAPTAIN', 'MEMBER')`),
  uqActiveTeamPlayer: uniqueIndex('uq_tournament_team_player_active')
    .on(t.teamId, t.playerId)
    .where(sql`${t.leftAt} IS NULL`),
  uqActiveTournamentPlayer: uniqueIndex('uq_tournament_team_player_tournament_active')
    .on(t.tournamentId, t.playerId)
    .where(sql`${t.leftAt} IS NULL`),
}));

export const tournamentRegistrations = pgTable('tournament_registrations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  playerId: bigint('player_id', { mode: 'number' }).references(() => users.id),
  teamId: bigint('team_id', { mode: 'number' }).references(() => tournamentTeams.id),
  registrationType: varchar('registration_type').notNull(),
  status: varchar('status').notNull(),
  seedNo: integer('seed_no'),
  paidAmount: numeric('paid_amount', { precision: 14, scale: 2 }).notNull().default('0'),
  // Player (Singles) or captain (Doubles) whose wallet paid the fee and receives refunds.
  payerId: bigint('payer_id', { mode: 'number' }).references(() => users.id),
  removedReason: varchar('removed_reason', { length: 300 }),
  removedBy: bigint('removed_by', { mode: 'number' }).references(() => users.id),
  cancelledAt: timestamp('cancelled_at'),
  refundedAt: timestamp('refunded_at'),
  registeredAt: timestamp('registered_at').notNull(),
  // Legacy (gateway payment timeout); no longer written (PRD Decision #11).
  expiresAt: timestamp('expires_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkRegistrationStatus: check('chk_tournament_registration_status', sql`${t.status} IN ('CONFIRMED', 'CANCELLED', 'REMOVED', 'PENDING_PAYMENT', 'EXPIRED')`),
  chkRegistrationType: check('chk_tournament_registration_type', sql`(${t.registrationType} = 'SINGLES' AND ${t.playerId} IS NOT NULL AND ${t.teamId} IS NULL) OR (${t.registrationType} = 'DOUBLES' AND ${t.teamId} IS NOT NULL AND ${t.playerId} IS NULL)`),
  chkRegistrationPaidAmount: check('chk_tournament_registration_paid_amount', sql`${t.paidAmount} >= 0`),
  chkRegistrationSeedNo: check('chk_tournament_registration_seed_no', sql`${t.seedNo} IS NULL OR ${t.seedNo} >= 1`),
  uqTournamentSinglesPlayer: uniqueIndex('uq_tournament_singles_player')
    .on(t.tournamentId, t.playerId)
    .where(sql`${t.registrationType} = 'SINGLES' AND ${t.status} = 'CONFIRMED'`),
  uqTournamentDoublesTeam: uniqueIndex('uq_tournament_doubles_team')
    .on(t.tournamentId, t.teamId)
    .where(sql`${t.registrationType} = 'DOUBLES' AND ${t.status} = 'CONFIRMED'`),
  uqTournamentSeedNo: uniqueIndex('uq_tournament_registration_seed_no')
    .on(t.tournamentId, t.seedNo)
    .where(sql`${t.seedNo} IS NOT NULL`),
  idxRegistrationsStatusRegistered: index('registrations_status_registered_idx').on(t.status, t.registeredAt),
  idxRegistrationsTournamentStatus: index('registrations_tournament_status_idx').on(t.tournamentId, t.status),
}));

export const tournamentMatches = pgTable('tournament_matches', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  matchId: bigint('match_id', { mode: 'number' }).notNull().references(() => matches.id),
  registration1Id: bigint('registration1_id', { mode: 'number' }).references(() => tournamentRegistrations.id),
  registration2Id: bigint('registration2_id', { mode: 'number' }).references(() => tournamentRegistrations.id),
  winnerRegistrationId: bigint('winner_registration_id', { mode: 'number' }).references(() => tournamentRegistrations.id),
  nextMatchId: bigint('next_match_id', { mode: 'number' }).references((): AnyPgColumn => tournamentMatches.id),
  nextRegistrationSlot: varchar('next_registration_slot'),
  roundIndex: integer('round_index').notNull(),
  matchIndex: integer('match_index').notNull(),
  resolution: varchar('resolution').notNull(),
  // Free-text court label on the Organizer's virtual courts (PRD Decision #8).
  courtLabel: varchar('court_label', { length: 40 }),
  // The `matches.scheduled_at` value a 30-minute reminder was sent for (re-armed by a reschedule).
  reminderSentFor: timestamp('reminder_sent_for'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqTournamentMatch: unique('uq_tournament_match').on(t.tournamentId, t.matchId),
  chkTournamentMatchResolution: check('chk_tournament_match_resolution', sql`${t.resolution} IN ('UNRESOLVED', 'WINNER_DECLARED', 'RETIRED', 'WALKOVER', 'NONE')`),
  chkTournamentMatchNextSlot: check('chk_tournament_match_next_slot', sql`${t.nextRegistrationSlot} IS NULL OR ${t.nextRegistrationSlot} IN ('registration1', 'registration2')`),
  uqTournamentMatchPosition: uniqueIndex('uq_tournament_match_position').on(t.tournamentId, t.roundIndex, t.matchIndex),
}));

/** Achievement ranking points per participant (Tech Design §7.11, TRN-18); rewritten on correction. */
export const tournamentRankingPoints = pgTable('tournament_ranking_points', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  matchType: varchar('match_type').notNull(),
  placement: varchar('placement', { length: 20 }).notNull(),
  points: numeric('points', { precision: 8, scale: 2 }).notNull(),
  completedAt: timestamp('completed_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  chkMatchType: check('chk_tournament_ranking_points_match_type', sql`${t.matchType} IN ('SINGLES', 'DOUBLES')`),
  chkPoints: check('chk_tournament_ranking_points_points', sql`${t.points} >= 0`),
  uqPlayerTournament: uniqueIndex('uq_tournament_ranking_points_player_tournament').on(t.playerId, t.tournamentId),
  idxTypeCompleted: index('tournament_ranking_points_type_completed_idx').on(t.matchType, t.completedAt),
}));
