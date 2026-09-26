ALTER TABLE "matches" ADD COLUMN "court_search_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "confirmation_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "cancellation_reason" varchar;--> statement-breakpoint
CREATE INDEX "match_confirmations_match_status_idx" ON "match_confirmations" USING btree ("match_id","status");--> statement-breakpoint
CREATE INDEX "match_players_player_match_idx" ON "match_players" USING btree ("player_id","match_id");--> statement-breakpoint
CREATE INDEX "matches_status_scheduled_idx" ON "matches" USING btree ("status","scheduled_at");--> statement-breakpoint
CREATE INDEX "matches_status_court_search_idx" ON "matches" USING btree ("status","court_search_expires_at");--> statement-breakpoint
CREATE INDEX "matches_status_confirmation_idx" ON "matches" USING btree ("status","confirmation_expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_matchmaking_open_request" ON "matchmaking_requests" USING btree ("player_id","match_type") WHERE "matchmaking_requests"."status" = 'OPEN';--> statement-breakpoint
CREATE INDEX "matchmaking_requests_match_scan_idx" ON "matchmaking_requests" USING btree ("status","match_type","preferred_date","created_at");--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description") VALUES
  ('MATCHMAKING_ENABLED', 'true', 'Enable/disable matchmaking'),
  ('MATCHMAKING_REQUEST_EXPIRATION_MINUTES', '30', 'Matchmaking request expiration in minutes'),
  ('MATCHMAKING_COURT_SEARCH_TIMEOUT_MINUTES', '15', 'Maximum court-search period in minutes'),
  ('MATCHMAKING_CONFIRMATION_REQUIRED', 'true', 'Require all matched Players to confirm'),
  ('MATCHMAKING_CONFIRMATION_TIMEOUT_MINUTES', '10', 'Match confirmation timeout in minutes'),
  ('MATCHMAKING_MATCH_DURATION_MINUTES', '90', 'Default Match duration in minutes'),
  ('MATCHMAKING_MAX_DISTANCE_KM', '5', 'Maximum matching distance in km')
ON CONFLICT ("config_key") DO NOTHING;