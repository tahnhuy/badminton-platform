import { sql } from 'drizzle-orm';
import type { ProfileReader, ProfileStats } from '../../contracts/PlayerProfileRead';

/** Aggregate in SQL; EXISTS avoids multiplication from duplicate domain links. */
export function profileStatisticsQuery(userId: number) {
  return sql`
    WITH roster AS (
      SELECT m.id, m.status, mp.team_no FROM matches m
      JOIN match_players mp ON mp.match_id = m.id
      WHERE mp.player_id = ${userId} AND mp.status = 'ACTIVE'
    ), outcomes AS (
      SELECT DISTINCT r.id,
        CASE WHEN tm.winner_registration_id = tm.registration1_id THEN 1 ELSE 2 END AS winner_side,
        r.team_no,
        (tm.winner_registration_id NOT IN (tm.registration1_id, tm.registration2_id)
          OR r.team_no NOT IN (1, 2) OR tm.registration1_id = tm.registration2_id
          OR reg1.tournament_id <> tm.tournament_id OR reg2.tournament_id <> tm.tournament_id
          OR reg1.registration_type <> m.match_type OR reg2.registration_type <> m.match_type
          OR (m.match_type = 'SINGLES' AND
            (CASE r.team_no WHEN 1 THEN reg1.player_id ELSE reg2.player_id END IS DISTINCT FROM ${userId}))) AS invalid
      FROM roster r JOIN matches m ON m.id = r.id
      JOIN tournament_matches tm ON tm.match_id = r.id
      JOIN tournament_registrations reg1 ON reg1.id = tm.registration1_id
      JOIN tournament_registrations reg2 ON reg2.id = tm.registration2_id
      WHERE tm.winner_registration_id IS NOT NULL
        AND (tm.resolution = 'WALKOVER' OR (tm.resolution = 'WINNER_DECLARED' AND r.status = 'COMPLETED'))
    ), qualifying AS (
      SELECT id FROM roster r WHERE r.status = 'COMPLETED'
        AND EXISTS (SELECT 1 FROM matchmaking_matches mm WHERE mm.match_id = r.id)
        AND NOT EXISTS (SELECT 1 FROM tournament_matches tm WHERE tm.match_id = r.id)
      UNION SELECT id FROM outcomes WHERE NOT invalid
    )
    SELECT (SELECT count(*) FROM qualifying)::int AS "matchesPlayed",
      count(DISTINCT id) FILTER (WHERE NOT invalid AND team_no = winner_side)::int AS wins,
      count(DISTINCT id) FILTER (WHERE NOT invalid AND team_no <> winner_side)::int AS losses,
      count(*) FILTER (WHERE invalid)::int AS invalid
    FROM outcomes
  `;
}

export async function readProfileStatistics(reader: ProfileReader, userId: number): Promise<ProfileStats> {
  const result = await reader.execute(profileStatisticsQuery(userId));
  const row = result.rows[0] as { matchesPlayed: number; wins: number; losses: number; invalid: number };
  if (row.invalid) throw new Error('Invalid Tournament result/participant mapping');
  return { matchesPlayed: row.matchesPlayed, wins: row.wins, losses: row.losses,
    resultsAvailable: row.wins + row.losses > 0 };
}
