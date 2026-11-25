ALTER TABLE "tournament_team_players" DROP CONSTRAINT "uq_tournament_team_player";--> statement-breakpoint
ALTER TABLE "posts" DROP CONSTRAINT "chk_posts_type";--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" DROP CONSTRAINT "chk_wallet_entry_type";--> statement-breakpoint
DROP INDEX "uq_tournament_singles_player";--> statement-breakpoint
DROP INDEX "uq_tournament_doubles_team";--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "court_label" varchar(40);--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD COLUMN "reminder_sent_for" timestamp;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "seed_no" integer;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "paid_amount" numeric(14, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "payer_id" bigint;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "removed_reason" varchar(300);--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "removed_by" bigint;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "refunded_at" timestamp;--> statement-breakpoint
-- TRN-01: add nullable, backfill from the team, then enforce NOT NULL (safe on populated databases).
ALTER TABLE "tournament_team_players" ADD COLUMN "tournament_id" bigint;--> statement-breakpoint
UPDATE "tournament_team_players" tp SET "tournament_id" = t."tournament_id" FROM "tournament_teams" t WHERE t."id" = tp."team_id";--> statement-breakpoint
ALTER TABLE "tournament_team_players" ALTER COLUMN "tournament_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tournament_team_players" ADD COLUMN "left_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD COLUMN "invite_token_hash" char(64);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "competition_type" varchar DEFAULT 'PROFESSIONAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "min_skill_level_id" bigint;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "max_skill_level_id" bigint;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "court_count" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "match_duration_minutes" integer DEFAULT 45 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "min_rest_minutes" integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "daily_start_time" time DEFAULT '08:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "daily_end_time" time DEFAULT '21:00' NOT NULL;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "draw_seed" bigint;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "conversation_id" bigint;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "cancel_reason" varchar(300);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "cancelled_by" bigint;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "completed_by" bigint;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "tournament_id" bigint;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "system_kind" varchar;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_payer_id_users_id_fk" FOREIGN KEY ("payer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "tournament_registrations_removed_by_users_id_fk" FOREIGN KEY ("removed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_team_players" ADD CONSTRAINT "tournament_team_players_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- TRN-01: normalise legacy values (pre-2026-11-25 fixtures/designs) before the new CHECKs.
UPDATE "tournaments" SET "status" = 'OPEN_FOR_REGISTRATION' WHERE "status" = 'OPEN';--> statement-breakpoint
UPDATE "tournaments" SET "status" = 'CANCELLED' WHERE "status" NOT IN ('DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
UPDATE "tournaments" SET "format" = 'SINGLE_ELIMINATION' WHERE "format" <> 'SINGLE_ELIMINATION';--> statement-breakpoint
UPDATE "tournaments" SET "participant_limit" = LEAST(GREATEST("participant_limit", 2), 128) WHERE "participant_limit" NOT BETWEEN 2 AND 128;--> statement-breakpoint
UPDATE "tournament_teams" t SET "status" = CASE WHEN EXISTS (SELECT 1 FROM "tournament_registrations" r WHERE r."team_id" = t."id" AND r."status" = 'CONFIRMED') THEN 'REGISTERED' ELSE 'DISBANDED' END WHERE t."status" NOT IN ('FORMING', 'FULL', 'REGISTERED', 'DISBANDED');--> statement-breakpoint
UPDATE "team_invitations" SET "status" = 'CANCELLED' WHERE "status" NOT IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
UPDATE "tournament_team_players" SET "role" = 'MEMBER' WHERE "role" NOT IN ('CAPTAIN', 'MEMBER');--> statement-breakpoint
UPDATE "tournament_registrations" SET "status" = 'CANCELLED' WHERE "status" NOT IN ('CONFIRMED', 'CANCELLED', 'REMOVED', 'PENDING_PAYMENT', 'EXPIRED');--> statement-breakpoint
UPDATE "tournament_matches" SET "resolution" = 'UNRESOLVED' WHERE "resolution" NOT IN ('UNRESOLVED', 'WINNER_DECLARED', 'RETIRED', 'WALKOVER', 'NONE');--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_min_skill_level_id_skill_levels_id_fk" FOREIGN KEY ("min_skill_level_id") REFERENCES "public"."skill_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_max_skill_level_id_skill_levels_id_fk" FOREIGN KEY ("max_skill_level_id") REFERENCES "public"."skill_levels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_team_invitations_pending_team" ON "team_invitations" USING btree ("team_id") WHERE "team_invitations"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tournament_match_position" ON "tournament_matches" USING btree ("tournament_id","round_index","match_index");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tournament_registration_seed_no" ON "tournament_registrations" USING btree ("tournament_id","seed_no") WHERE "tournament_registrations"."seed_no" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "registrations_tournament_status_idx" ON "tournament_registrations" USING btree ("tournament_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tournament_team_player_active" ON "tournament_team_players" USING btree ("team_id","player_id") WHERE "tournament_team_players"."left_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tournament_team_player_tournament_active" ON "tournament_team_players" USING btree ("tournament_id","player_id") WHERE "tournament_team_players"."left_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tournaments_creator_created_idx" ON "tournaments" USING btree ("creator_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_posts_author_tournament_result" ON "posts" USING btree ("author_id","tournament_id") WHERE "posts"."type" = 'TOURNAMENT_RESULT' AND "posts"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tournament_singles_player" ON "tournament_registrations" USING btree ("tournament_id","player_id") WHERE "tournament_registrations"."registration_type" = 'SINGLES' AND "tournament_registrations"."status" = 'CONFIRMED';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_tournament_doubles_team" ON "tournament_registrations" USING btree ("tournament_id","team_id") WHERE "tournament_registrations"."registration_type" = 'DOUBLES' AND "tournament_registrations"."status" = 'CONFIRMED';--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "uq_tournament_teams_invite_token_hash" UNIQUE("invite_token_hash");--> statement-breakpoint
ALTER TABLE "team_invitations" ADD CONSTRAINT "chk_team_invitation_status" CHECK ("team_invitations"."status" IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'));--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "chk_tournament_match_resolution" CHECK ("tournament_matches"."resolution" IN ('UNRESOLVED', 'WINNER_DECLARED', 'RETIRED', 'WALKOVER', 'NONE'));--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "chk_tournament_match_next_slot" CHECK ("tournament_matches"."next_registration_slot" IS NULL OR "tournament_matches"."next_registration_slot" IN ('registration1', 'registration2'));--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "chk_tournament_registration_status" CHECK ("tournament_registrations"."status" IN ('CONFIRMED', 'CANCELLED', 'REMOVED', 'PENDING_PAYMENT', 'EXPIRED'));--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "chk_tournament_registration_type" CHECK (("tournament_registrations"."registration_type" = 'SINGLES' AND "tournament_registrations"."player_id" IS NOT NULL AND "tournament_registrations"."team_id" IS NULL) OR ("tournament_registrations"."registration_type" = 'DOUBLES' AND "tournament_registrations"."team_id" IS NOT NULL AND "tournament_registrations"."player_id" IS NULL));--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "chk_tournament_registration_paid_amount" CHECK ("tournament_registrations"."paid_amount" >= 0);--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD CONSTRAINT "chk_tournament_registration_seed_no" CHECK ("tournament_registrations"."seed_no" IS NULL OR "tournament_registrations"."seed_no" >= 1);--> statement-breakpoint
ALTER TABLE "tournament_team_players" ADD CONSTRAINT "chk_tournament_team_player_role" CHECK ("tournament_team_players"."role" IN ('CAPTAIN', 'MEMBER'));--> statement-breakpoint
ALTER TABLE "tournament_teams" ADD CONSTRAINT "chk_tournament_team_status" CHECK ("tournament_teams"."status" IN ('FORMING', 'FULL', 'REGISTERED', 'DISBANDED'));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_status" CHECK ("tournaments"."status" IN ('DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_format" CHECK ("tournaments"."format" = 'SINGLE_ELIMINATION');--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_match_type" CHECK ("tournaments"."match_type" IN ('SINGLES', 'DOUBLES'));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_competition_type" CHECK ("tournaments"."competition_type" IN ('PROFESSIONAL', 'CASUAL'));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_participant_limit" CHECK ("tournaments"."participant_limit" BETWEEN 2 AND 128);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_court_count" CHECK ("tournaments"."court_count" BETWEEN 1 AND 20);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_match_duration" CHECK ("tournaments"."match_duration_minutes" BETWEEN 10 AND 180);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_min_rest" CHECK ("tournaments"."min_rest_minutes" BETWEEN 0 AND 240);--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_daily_window" CHECK ("tournaments"."daily_start_time" < "tournaments"."daily_end_time");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "chk_posts_tournament" CHECK (("posts"."type" = 'TOURNAMENT_RESULT') = ("posts"."tournament_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "chk_posts_type" CHECK ("posts"."type" IN ('FREE', 'MATCH_FINDING', 'TOURNAMENT_RESULT'));--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "chk_conversations_system_kind" CHECK ("conversations"."system_kind" IS NULL OR ("conversations"."system_kind" = 'TOURNAMENT' AND "conversations"."type" = 'GROUP'));--> statement-breakpoint
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "chk_wallet_entry_type" CHECK ("wallet_ledger_entries"."entry_type" IN ('TOP_UP', 'PAYMENT', 'REFUND', 'WITHDRAWAL', 'PAYOUT', 'ADMIN_ADJUSTMENT', 'OWNER_EARNING', 'OWNER_EARNING_REVERSAL', 'TOURNAMENT_EARNING'));