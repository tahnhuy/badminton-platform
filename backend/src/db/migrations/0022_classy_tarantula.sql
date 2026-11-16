CREATE TABLE "report_evidence" (
	"report_id" bigint PRIMARY KEY NOT NULL,
	"content_text" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_evidence_media" (
	"report_id" bigint NOT NULL,
	"media_id" bigint NOT NULL,
	CONSTRAINT "report_evidence_media_report_id_media_id_pk" PRIMARY KEY("report_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "reports" DROP CONSTRAINT "chk_report_target";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reported_post_id" bigint;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reported_comment_id" bigint;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reported_message_id" bigint;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "reported_attachment_id" bigint;--> statement-breakpoint
ALTER TABLE "report_evidence" ADD CONSTRAINT "report_evidence_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_evidence_media" ADD CONSTRAINT "report_evidence_media_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."reports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_evidence_media" ADD CONSTRAINT "report_evidence_media_media_id_media_files_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media_files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_post_id_posts_id_fk" FOREIGN KEY ("reported_post_id") REFERENCES "public"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_comment_id_post_comments_id_fk" FOREIGN KEY ("reported_comment_id") REFERENCES "public"."post_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_message_id_messages_id_fk" FOREIGN KEY ("reported_message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reported_attachment_id_message_attachments_id_fk" FOREIGN KEY ("reported_attachment_id") REFERENCES "public"."message_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "chk_report_attachment_requires_message" CHECK ("reports"."reported_attachment_id" IS NULL OR "reports"."reported_message_id" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "chk_report_target" CHECK ((
      (CASE WHEN "reports"."reported_player_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "reports"."reported_facility_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "reports"."reported_tournament_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "reports"."reported_post_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "reports"."reported_comment_id" IS NOT NULL THEN 1 ELSE 0 END) +
      (CASE WHEN "reports"."reported_message_id" IS NOT NULL THEN 1 ELSE 0 END)
    ) = 1);--> statement-breakpoint
INSERT INTO "system_configs" ("config_key", "config_value", "description") VALUES
  ('REPORT_ENABLED', 'true', 'Enable/disable reporting')
ON CONFLICT ("config_key") DO NOTHING;
