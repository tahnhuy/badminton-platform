import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { tournamentRankingPoints, tournamentRegistrations, tournaments } from '../db/schema/tournaments';
import { makePlayer, openTournament } from './tournament-test-kit';

it('backfills unfinished legacy fields and preserves completed points and nullable snapshot constraints', async () => {
  const organizer = await makePlayer();
  const players = [await makePlayer({ rank: 2 }), await makePlayer({ rank: 5 })];
  const templateId = await openTournament(organizer);
  const [template] = await db.select().from(tournaments).where(eq(tournaments.id, templateId));
  const legacy = await db.insert(tournaments).values(['READY', 'IN_PROGRESS', 'COMPLETED'].map(status => ({
    ...template, id: undefined, status, completedAt: status === 'COMPLETED' ? new Date() : null,
  }))).returning({ id: tournaments.id });
  await db.insert(tournamentRegistrations).values(legacy.flatMap(t => players.map(playerId => ({
    tournamentId: t.id, playerId, registrationType: 'SINGLES', status: 'CONFIRMED', registeredAt: new Date(),
  }))));
  await db.insert(tournamentRankingPoints).values({
    tournamentId: legacy[2].id, playerId: players[0], matchType: 'SINGLES', placement: 'CHAMPION', points: '12.34', completedAt: new Date(),
  });
  // Execute the actual data migration against populated rows (global setup applies its DDL).
  const migration = readFileSync(join(__dirname, '../db/migrations/0042_tournament_ranking_field.sql'), 'utf8');
  const backfill = migration.split('--> statement-breakpoint')[2];
  expect(backfill).toContain('WITH players AS');
  await db.execute(sql.raw(backfill));
  const rows = await db.select().from(tournaments).where(inArray(tournaments.id, legacy.map(t => t.id))).orderBy(asc(tournaments.id));
  expect(rows.map(t => [t.rankingRankSum, t.rankingPlayerCount])).toEqual([[7, 2], [7, 2], [null, null]]);
  const [awarded] = await db.select().from(tournamentRankingPoints).where(eq(tournamentRankingPoints.tournamentId, legacy[2].id));
  expect(awarded.points).toBe('12.34');
  await expect(db.update(tournaments).set({ rankingPlayerCount: null }).where(eq(tournaments.id, legacy[0].id))).rejects.toThrow();
  await expect(db.update(tournaments).set({ rankingRankSum: 0, rankingPlayerCount: 2 }).where(eq(tournaments.id, legacy[0].id))).rejects.toThrow();
});
