ALTER TABLE "notifications" ADD COLUMN "resource_type" varchar;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "resource_id" bigint;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "dedup_key" varchar;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_notifications_user_dedup_key" ON "notifications" USING btree ("user_id","dedup_key") WHERE "notifications"."dedup_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notifications_user_read_created_idx" ON "notifications" USING btree ("user_id","is_read","created_at","id");