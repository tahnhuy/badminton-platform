ALTER TABLE "conversations"
  ADD COLUMN IF NOT EXISTS "is_locked" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "status" varchar NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "dissolved_at" timestamp with time zone;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_conversations_status'
  ) THEN
    ALTER TABLE "conversations"
      ADD CONSTRAINT "chk_conversations_status"
      CHECK ("status" IN ('ACTIVE', 'DISSOLVED'));
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "messages"
  ADD COLUMN IF NOT EXISTS "parent_id" bigint REFERENCES "messages"("id"),
  ADD COLUMN IF NOT EXISTS "edited_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "deleted_by_user_id" bigint REFERENCES "users"("id");
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_messages_deleted_by'
  ) THEN
    ALTER TABLE "messages"
      ADD CONSTRAINT "chk_messages_deleted_by"
      CHECK (("deleted_at" IS NULL) = ("deleted_by_user_id" IS NULL));
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_hides" (
  "message_id" bigint NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE,
  "user_id" bigint NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "message_hides_message_id_user_id_pk" PRIMARY KEY ("message_id", "user_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_hides_user_idx" ON "message_hides" USING btree ("user_id");

