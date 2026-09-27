ALTER TABLE "payments" ALTER COLUMN "booking_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ALTER COLUMN "court_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "registration_id" bigint;--> statement-breakpoint
ALTER TABLE "tournament_registrations" ADD COLUMN "expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "facility_id" bigint;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "venue_note" text;--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN "entry_fee" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_registration_id_tournament_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."tournament_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_facility_id_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_registration_id_idx" ON "payments" USING btree ("registration_id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "chk_payment_target" CHECK (("payments"."booking_id" IS NOT NULL) <> ("payments"."registration_id" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "chk_tournament_entry_fee" CHECK ("tournaments"."entry_fee" >= 0);--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description")
VALUES ('TOURNAMENT_REGISTRATION_PAYMENT_TIMEOUT_MINUTES', '10', 'Registration payment hold timeout in minutes')
ON CONFLICT ("config_key") DO NOTHING;