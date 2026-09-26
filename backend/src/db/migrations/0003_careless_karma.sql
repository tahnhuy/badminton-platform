ALTER TABLE "bookings" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
CREATE INDEX "court_pricings_court_valid_idx" ON "court_pricings" USING btree ("court_id","valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "bookings_court_date_start_idx" ON "bookings" USING btree ("court_id","booking_date","start_time");--> statement-breakpoint
CREATE INDEX "bookings_player_status_idx" ON "bookings" USING btree ("player_id","status");--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "booking_range" tstzrange GENERATED ALWAYS AS (tstzrange((("bookings"."booking_date" + "bookings"."start_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'), (("bookings"."booking_date" + "bookings"."end_time") AT TIME ZONE 'Asia/Ho_Chi_Minh'), '[)')) STORED;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "ex_bookings_court_no_overlap" EXCLUDE USING gist ("court_id" WITH =, "booking_range" WITH &&) WHERE ("status" IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS'));--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description") VALUES
  ('BOOKING_ENABLED', 'true', 'Enable/disable booking'),
  ('BOOKING_MIN_DURATION_MINUTES', '60', 'Minimum booking duration in minutes'),
  ('BOOKING_MAX_DURATION_MINUTES', '180', 'Maximum booking duration in minutes'),
  ('BOOKING_ADVANCE_WINDOW_DAYS', '7', 'Maximum advance booking window in days'),
  ('BOOKING_ACTIVE_LIMIT_MODE', 'LIMITED', 'Active-booking limit strategy'),
  ('BOOKING_MAX_ACTIVE_PER_PLAYER', '5', 'Maximum active bookings per Player'),
  ('PLAYER_CAN_CANCEL_BOOKING', 'true', 'Whether Player cancellation is enabled'),
  ('PLAYER_CANCELLATION_DEADLINE_MINUTES', '0', 'Player cancellation deadline relative to start'),
  ('OWNER_CAN_CANCEL_BOOKING', 'true', 'Whether Owner cancellation is enabled'),
  ('OWNER_CANCELLATION_DEADLINE_MINUTES', '0', 'Owner cancellation deadline relative to start'),
  ('BOOKING_PAYMENT_TIMEOUT_MINUTES', '10', 'Payment hold timeout in minutes'),
  ('REFUND_ENABLED', 'true', 'Enable refund flow'),
  ('REFUND_PROCESSING_TIMEOUT_MINUTES', '1440', 'Refund processing timeout in minutes')
ON CONFLICT ("config_key") DO NOTHING;