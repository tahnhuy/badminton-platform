ALTER TABLE "bookings" ADD COLUMN "booking_code" varchar;--> statement-breakpoint
UPDATE "bookings" SET "booking_code" = 'BK-LEGACY-' || LPAD("id"::text, 6, '0') WHERE "booking_code" IS NULL;--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "booking_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "uq_bookings_booking_code" UNIQUE ("booking_code");--> statement-breakpoint
