-- MM-21: recruitment/membership schema, preflight and legacy backfill
-- (database-schema.md §13.3, §13.5, §13.6; Matchmaking Tech Design §24.11).
-- One forward migration. Statuses, timestamps and history are preserved; no
-- conversation is created. The same anomaly checks are available read-only in
-- backend/src/db/preflight/mm21-preflight.ts.

-- 1. Preflight: report, and stop on any anomaly. Nothing is written when it stops.
DO $$
DECLARE
  problems text[] := ARRAY[]::text[];
  item text;
BEGIN
  RAISE NOTICE 'MM-21 preflight: requests by status: %', (
    SELECT COALESCE(string_agg(status || '=' || n, ', ' ORDER BY status), 'none')
    FROM (SELECT status, count(*) AS n FROM matchmaking_requests GROUP BY status) s);
  RAISE NOTICE 'MM-21 preflight: matchmaking Matches with booking_id: %', (
    SELECT count(*) FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id WHERE m.booking_id IS NOT NULL);

  FOR item IN
    SELECT format('request %s: unsupported match_type %L', id, match_type)
    FROM matchmaking_requests WHERE match_type NOT IN ('SINGLES', 'DOUBLES')
  LOOP problems := problems || item; END LOOP;

  -- Booking source: copy matchmaking Match bookings to the recruitment; stop on conflict.
  FOR item IN
    SELECT format('request %s: linked to several bookings (%s)', mm.matchmaking_request_id, string_agg(DISTINCT m.booking_id::text, ','))
    FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id
    WHERE m.booking_id IS NOT NULL
    GROUP BY mm.matchmaking_request_id HAVING count(DISTINCT m.booking_id) > 1
  LOOP problems := problems || item; END LOOP;
  FOR item IN
    SELECT format('booking %s: linked to several requests (%s)', m.booking_id, string_agg(DISTINCT mm.matchmaking_request_id::text, ','))
    FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id
    WHERE m.booking_id IS NOT NULL
    GROUP BY m.booking_id HAVING count(DISTINCT mm.matchmaking_request_id) > 1
  LOOP problems := problems || item; END LOOP;

  -- Interval source: confirmed linked booking, otherwise window start + duration snapshot.
  FOR item IN
    WITH confirmed AS (
      SELECT DISTINCT ON (mm.matchmaking_request_id) mm.matchmaking_request_id AS request_id, b.booking_date, b.start_time, b.end_time
      FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id JOIN bookings b ON b.id = m.booking_id
      WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
      ORDER BY mm.matchmaking_request_id, mm.id DESC
    )
    SELECT CASE
      WHEN c.request_id IS NOT NULL AND (EXTRACT(EPOCH FROM (c.end_time - c.start_time)) / 60) NOT BETWEEN 1 AND 1440
        THEN format('request %s: confirmed booking duration outside 1-1440 minutes', r.id)
      WHEN c.request_id IS NULL AND (r.preferred_date IS NULL OR r.preferred_start_time IS NULL OR r.preferred_end_time IS NULL)
        THEN format('request %s: missing preferred window', r.id)
      WHEN c.request_id IS NULL AND (r.match_duration_minutes IS NULL OR r.match_duration_minutes NOT BETWEEN 1 AND 1440)
        THEN format('request %s: invalid duration snapshot %s', r.id, COALESCE(r.match_duration_minutes::text, 'NULL'))
      WHEN c.request_id IS NULL AND r.preferred_end_time - r.preferred_start_time < make_interval(mins => r.match_duration_minutes)
        THEN format('request %s: window shorter than duration snapshot', r.id)
    END
    FROM matchmaking_requests r LEFT JOIN confirmed c ON c.request_id = r.id
  LOOP
    IF item IS NOT NULL THEN problems := problems || item; END IF;
  END LOOP;

  -- New active-row uniqueness and Invite CHECK must hold for existing rows.
  FOR item IN
    SELECT format('request %s / player %s: %s active rows (PENDING/ACCEPTED)', request_id, invitee_id, count(*))
    FROM matchmaking_invitations WHERE status IN ('PENDING', 'ACCEPTED')
    GROUP BY request_id, invitee_id HAVING count(*) > 1
  LOOP problems := problems || item; END LOOP;
  FOR item IN
    SELECT format('invitation %s: inviter equals invitee', id) FROM matchmaking_invitations WHERE invitee_id = inviter_id
  LOOP problems := problems || item; END LOOP;

  FOR item IN
    SELECT format('match_player %s: team_no %s outside (1, 2)', id, team_no) FROM match_players WHERE team_no NOT IN (1, 2)
  LOOP problems := problems || item; END LOOP;

  -- Cancellation jobs become UNIQUE per request.
  FOR item IN
    SELECT format('request %s: %s booking cancellation jobs', mm.matchmaking_request_id, count(*))
    FROM match_booking_cancellation_jobs j JOIN matchmaking_matches mm ON mm.match_id = j.match_id
    GROUP BY mm.matchmaking_request_id HAVING count(*) > 1
  LOOP problems := problems || item; END LOOP;

  IF array_length(problems, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'MM-21 preflight stopped (% anomalies): %', array_length(problems, 1), array_to_string(problems, '; ')
      USING HINT = 'Resolve the reported rows with a human decision; this migration never rewrites them.';
  END IF;
END;
$$;
--> statement-breakpoint

-- 2. Recruitment columns (§13.3).
ALTER TABLE "matchmaking_requests"
  ADD COLUMN "post_id" bigint,
  ADD COLUMN "start_at" timestamp with time zone,
  ADD COLUMN "duration_minutes" integer,
  ADD COLUMN "capacity" smallint,
  ADD COLUMN "min_players" smallint,
  ADD COLUMN "companion_count" smallint DEFAULT 0 NOT NULL,
  ADD COLUMN "cost_note" varchar(200),
  ADD COLUMN "external_court_name" varchar(120),
  ADD COLUMN "external_court_city" varchar,
  ADD COLUMN "external_court_district" varchar,
  ADD COLUMN "external_court_address" varchar(200),
  ADD COLUMN "booking_id" bigint,
  ADD COLUMN "cancellation_reason" varchar,
  ADD COLUMN "closed_early_at" timestamp with time zone,
  ADD COLUMN "court_same_venue_confirmed_at" timestamp with time zone,
  ADD COLUMN "court_same_venue_confirmed_by" bigint;
--> statement-breakpoint

-- 3. Backfill: booking source, interval, capacity and exactly one unpublished post per request.
UPDATE "matchmaking_requests" r SET "booking_id" = src.booking_id
FROM (
  SELECT DISTINCT mm.matchmaking_request_id AS request_id, m.booking_id
  FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id WHERE m.booking_id IS NOT NULL
) src
WHERE src.request_id = r.id;
--> statement-breakpoint
WITH confirmed AS (
  SELECT DISTINCT ON (mm.matchmaking_request_id) mm.matchmaking_request_id AS request_id, b.booking_date, b.start_time, b.end_time
  FROM matchmaking_matches mm JOIN matches m ON m.id = mm.match_id JOIN bookings b ON b.id = m.booking_id
  WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED')
  ORDER BY mm.matchmaking_request_id, mm.id DESC
)
UPDATE "matchmaking_requests" r SET
  "start_at" = CASE WHEN c.request_id IS NOT NULL
    THEN (c.booking_date + c.start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh'
    ELSE (r.preferred_date + r.preferred_start_time) AT TIME ZONE 'Asia/Ho_Chi_Minh' END,
  "duration_minutes" = CASE WHEN c.request_id IS NOT NULL
    THEN (EXTRACT(EPOCH FROM (c.end_time - c.start_time)) / 60)::integer
    ELSE r.match_duration_minutes END,
  "capacity" = CASE r.match_type WHEN 'SINGLES' THEN 2 ELSE 4 END,
  "min_players" = CASE r.match_type WHEN 'SINGLES' THEN 2 ELSE 4 END
FROM matchmaking_requests r0 LEFT JOIN confirmed c ON c.request_id = r0.id
WHERE r0.id = r.id;
--> statement-breakpoint
DO $$
DECLARE
  req record;
  new_post bigint;
BEGIN
  FOR req IN SELECT id, player_id, created_at, updated_at FROM matchmaking_requests ORDER BY id LOOP
    INSERT INTO posts (author_id, type, published_at, created_at, updated_at)
    VALUES (req.player_id, 'MATCH_FINDING', NULL, req.created_at AT TIME ZONE 'UTC', req.updated_at AT TIME ZONE 'UTC')
    RETURNING id INTO new_post;
    UPDATE matchmaking_requests SET post_id = new_post WHERE id = req.id;
  END LOOP;
END;
$$;
--> statement-breakpoint

-- 4. Recruitment constraints; legacy window columns become nullable for new rows.
DROP INDEX "uq_matchmaking_open_request";--> statement-breakpoint
ALTER TABLE "matchmaking_requests"
  ALTER COLUMN "post_id" SET NOT NULL,
  ALTER COLUMN "start_at" SET NOT NULL,
  ALTER COLUMN "duration_minutes" SET NOT NULL,
  ALTER COLUMN "capacity" SET NOT NULL,
  ALTER COLUMN "min_players" SET NOT NULL,
  ALTER COLUMN "preferred_date" DROP NOT NULL,
  ALTER COLUMN "preferred_start_time" DROP NOT NULL,
  ALTER COLUMN "preferred_end_time" DROP NOT NULL,
  ALTER COLUMN "match_duration_minutes" DROP NOT NULL,
  ALTER COLUMN "expires_at" DROP NOT NULL,
  ADD CONSTRAINT "chk_matchmaking_requests_duration" CHECK ("duration_minutes" BETWEEN 1 AND 1440),
  ADD CONSTRAINT "chk_matchmaking_requests_companions" CHECK ("companion_count" >= 0),
  ADD CONSTRAINT "chk_matchmaking_requests_type_shape" CHECK (
    ("match_type" = 'SINGLES' AND "capacity" = 2 AND "min_players" = 2 AND "companion_count" = 0)
    OR ("match_type" = 'DOUBLES' AND "capacity" = 4 AND "min_players" = 4 AND "companion_count" = 0)
    OR ("match_type" = 'GROUP' AND "capacity" BETWEEN 3 AND 20 AND "min_players" BETWEEN 2 AND "capacity" AND 1 + "companion_count" <= "capacity")
  ),
  ADD CONSTRAINT "chk_matchmaking_requests_external_court" CHECK (
    ("external_court_name" IS NULL AND "external_court_city" IS NULL AND "external_court_district" IS NULL AND "external_court_address" IS NULL)
    OR ("external_court_name" IS NOT NULL AND "external_court_city" IS NOT NULL AND "external_court_district" IS NOT NULL AND "external_court_address" IS NOT NULL)
  ),
  ADD CONSTRAINT "chk_matchmaking_requests_court_consistency" CHECK ("booking_id" IS NULL OR "external_court_name" IS NULL OR "court_same_venue_confirmed_at" IS NOT NULL),
  ADD CONSTRAINT "chk_matchmaking_requests_same_venue_pair" CHECK (("court_same_venue_confirmed_at" IS NULL) = ("court_same_venue_confirmed_by" IS NULL)),
  ADD CONSTRAINT "matchmaking_requests_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action,
  ADD CONSTRAINT "matchmaking_requests_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE no action ON UPDATE no action,
  ADD CONSTRAINT "matchmaking_requests_court_same_venue_confirmed_by_users_id_fk" FOREIGN KEY ("court_same_venue_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_matchmaking_requests_post" ON "matchmaking_requests" USING btree ("post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_matchmaking_requests_booking" ON "matchmaking_requests" USING btree ("booking_id");--> statement-breakpoint

-- 5. Membership (§13.5): rename columns, kind/decided_by/close_reason, active-row uniqueness.
ALTER TABLE "matchmaking_invitations" RENAME COLUMN "invitee_id" TO "player_id";--> statement-breakpoint
ALTER TABLE "matchmaking_invitations" RENAME COLUMN "inviter_id" TO "created_by";--> statement-breakpoint
ALTER TABLE "matchmaking_invitations" RENAME CONSTRAINT "matchmaking_invitations_invitee_id_users_id_fk" TO "matchmaking_invitations_player_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "matchmaking_invitations" RENAME CONSTRAINT "matchmaking_invitations_inviter_id_users_id_fk" TO "matchmaking_invitations_created_by_users_id_fk";--> statement-breakpoint
ALTER INDEX "matchmaking_invitations_invitee_idx" RENAME TO "matchmaking_invitations_player_idx";--> statement-breakpoint
ALTER INDEX "matchmaking_invitations_inviter_idx" RENAME TO "matchmaking_invitations_created_by_idx";--> statement-breakpoint
ALTER TABLE "matchmaking_invitations"
  ADD COLUMN "kind" varchar DEFAULT 'INVITE' NOT NULL,
  ADD COLUMN "decided_by" bigint,
  ADD COLUMN "close_reason" varchar;
--> statement-breakpoint
ALTER TABLE "matchmaking_invitations"
  ALTER COLUMN "kind" DROP DEFAULT,
  ADD CONSTRAINT "chk_matchmaking_invitations_kind" CHECK ("kind" IN ('INVITE', 'APPLY')),
  ADD CONSTRAINT "chk_matchmaking_invitations_invite_not_self" CHECK ("player_id" <> "created_by" OR "kind" = 'APPLY'),
  ADD CONSTRAINT "chk_matchmaking_invitations_apply_self" CHECK ("kind" = 'INVITE' OR "created_by" = "player_id"),
  ADD CONSTRAINT "matchmaking_invitations_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
DROP INDEX "uq_matchmaking_invites_pending";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_matchmaking_membership_active" ON "matchmaking_invitations" USING btree ("request_id","player_id") WHERE "matchmaking_invitations"."status" IN ('PENDING', 'ACCEPTED');--> statement-breakpoint

-- 6. Matches (§13.6).
ALTER TABLE "match_players"
  ALTER COLUMN "team_no" DROP NOT NULL,
  ADD CONSTRAINT "chk_match_players_team_no" CHECK ("team_no" IS NULL OR "team_no" IN (1, 2));
--> statement-breakpoint
ALTER TABLE "match_booking_cancellation_jobs"
  ADD COLUMN "request_id" bigint,
  ALTER COLUMN "match_id" DROP NOT NULL,
  ADD CONSTRAINT "match_booking_cancellation_jobs_request_id_unique" UNIQUE ("request_id"),
  ADD CONSTRAINT "match_booking_cancellation_jobs_request_id_matchmaking_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."matchmaking_requests"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
UPDATE "match_booking_cancellation_jobs" j SET "request_id" = mm.matchmaking_request_id
FROM matchmaking_matches mm WHERE mm.match_id = j.match_id;
