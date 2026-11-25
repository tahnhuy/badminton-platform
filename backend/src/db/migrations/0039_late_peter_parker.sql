ALTER TABLE "facilities" DROP COLUMN "latitude";--> statement-breakpoint
ALTER TABLE "facilities" DROP COLUMN "longitude";--> statement-breakpoint
-- Remove retired fields from existing review snapshots as well as the live schema.
UPDATE "court_owner_reviews"
SET "submitted_values" = "submitted_values" - 'latitude' - 'longitude'
WHERE "submitted_values" ?| ARRAY['latitude', 'longitude'];
