ALTER TABLE "tournaments" ADD COLUMN "ranking_rank_sum" integer;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "ranking_player_count" integer;--> statement-breakpoint
-- Earlier draws have no historical level snapshot. Freeze the best available field now
-- for unfinished draws; completed tournaments retain their already-awarded placement points.
WITH players AS (
  SELECT r.tournament_id, r.player_id FROM tournament_registrations r
  WHERE r.status = 'CONFIRMED' AND r.player_id IS NOT NULL
  UNION ALL
  SELECT r.tournament_id, tp.player_id FROM tournament_registrations r
  JOIN tournament_team_players tp ON tp.team_id = r.team_id AND tp.left_at IS NULL
  WHERE r.status = 'CONFIRMED' AND r.team_id IS NOT NULL
), field AS (
  SELECT p.tournament_id, sum(coalesce(sl.rank, 4))::int AS rank_sum, count(*)::int AS player_count
  FROM players p LEFT JOIN player_profiles pp ON pp.user_id = p.player_id
  LEFT JOIN skill_levels sl ON sl.id = pp.skill_level_id
  GROUP BY p.tournament_id
)
UPDATE tournaments t SET ranking_rank_sum = f.rank_sum, ranking_player_count = f.player_count
FROM field f WHERE f.tournament_id = t.id AND t.status IN ('READY', 'IN_PROGRESS');--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_ranking_field" CHECK (("tournaments"."ranking_rank_sum" IS NULL AND "tournaments"."ranking_player_count" IS NULL) OR ("tournaments"."ranking_rank_sum" IS NOT NULL AND "tournaments"."ranking_player_count" IS NOT NULL AND "tournaments"."ranking_rank_sum" > 0 AND "tournaments"."ranking_player_count" > 0));
