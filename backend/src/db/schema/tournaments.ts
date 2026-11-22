import { pgTable, bigint, varchar, text, timestamp, integer, numeric, uniqueIndex, unique, check, index, AnyPgColumn } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { matches } from './matchmaking';
import { facilities } from './facilities';

export const tournaments = pgTable('tournaments', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  creatorId: bigint('creator_id', { mode: 'number' }).notNull().references(() => users.id),
  name: varchar('name').notNull(),
  description: text('description'),
  format: varchar('format').notNull(),
  matchType: varchar('match_type').notNull(),
  facilityId: bigint('facility_id', { mode: 'number' }).references(() => facilities.id),
  venueNote: text('venue_note'),
  participantLimit: integer('participant_limit').notNull(),
  entryFee: numeric('entry_fee').notNull().default('0'),
  status: varchar('status').notNull(),
  registrationStart: timestamp('registration_start').notNull(),
  registrationEnd: timestamp('registration_end').notNull(),
  tournamentStart: timestamp('tournament_start').notNull(),
  tournamentEnd: timestamp('tournament_end').notNull(),
  version: integer('version').notNull().default(1),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  chkTournamentEntryFee: check('chk_tournament_entry_fee', sql`${t.entryFee} >= 0`),
  idxTournamentsStatusCreated: index('tournaments_status_created_idx').on(t.status, t.createdAt),
}));

export const tournamentTeams = pgTable('tournament_teams', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  name: varchar('name').notNull(),
  captainId: bigint('captain_id', { mode: 'number' }).notNull().references(() => users.id),
  status: varchar('status').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

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
});

export const tournamentTeamPlayers = pgTable('tournament_team_players', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  teamId: bigint('team_id', { mode: 'number' }).notNull().references(() => tournamentTeams.id),
  playerId: bigint('player_id', { mode: 'number' }).notNull().references(() => users.id),
  role: varchar('role').notNull(),
  joinedAt: timestamp('joined_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqTeamPlayer: unique('uq_tournament_team_player').on(t.teamId, t.playerId),
}));

export const tournamentRegistrations = pgTable('tournament_registrations', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  tournamentId: bigint('tournament_id', { mode: 'number' }).notNull().references(() => tournaments.id),
  playerId: bigint('player_id', { mode: 'number' }).references(() => users.id),
  teamId: bigint('team_id', { mode: 'number' }).references(() => tournamentTeams.id),
  registrationType: varchar('registration_type').notNull(),
  status: varchar('status').notNull(),
  registeredAt: timestamp('registered_at').notNull(),
  expiresAt: timestamp('expires_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  uqTournamentSinglesPlayer: uniqueIndex('uq_tournament_singles_player')
    .on(t.tournamentId, t.playerId)
    .where(sql`${t.registrationType} = 'SINGLES'`),
  uqTournamentDoublesTeam: uniqueIndex('uq_tournament_doubles_team')
    .on(t.tournamentId, t.teamId)
    .where(sql`${t.registrationType} = 'DOUBLES'`),
  idxRegistrationsStatusRegistered: index('registrations_status_registered_idx').on(t.status, t.registeredAt),
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
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  unqTournamentMatch: unique('uq_tournament_match').on(t.tournamentId, t.matchId),
}));
