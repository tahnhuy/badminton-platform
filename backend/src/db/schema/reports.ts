import { pgTable, bigint, varchar, timestamp, text, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { facilities } from './facilities';
import { tournaments } from './tournaments';

export const reports = pgTable('reports', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedByDefaultAsIdentity(),
  reporterId: bigint('reporter_id', { mode: 'number' }).notNull().references(() => users.id),
  reportedPlayerId: bigint('reported_player_id', { mode: 'number' }).references(() => users.id),
  reportedFacilityId: bigint('reported_facility_id', { mode: 'number' }).references(() => facilities.id),
  reportedTournamentId: bigint('reported_tournament_id', { mode: 'number' }).references(() => tournaments.id),
  reasonCode: varchar('reason_code').notNull(),
  description: text('description'),
  status: varchar('status').notNull(),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  checkReportTarget: check(
    'chk_report_target',
    sql`(
      (CASE WHEN ${t.reportedPlayerId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedFacilityId} IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN ${t.reportedTournamentId} IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1`
  ),
  checkNotSelfReport: check(
    'chk_not_self_report',
    sql`${t.reporterId} != ${t.reportedPlayerId} OR ${t.reportedPlayerId} IS NULL`
  )
}));
