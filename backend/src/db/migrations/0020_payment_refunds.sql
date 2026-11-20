CREATE TABLE "payment_refunds" (
	"payment_id" bigint PRIMARY KEY NOT NULL,
	"status" varchar NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"reason" varchar(200),
	"claimed_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payment_refund_status" CHECK ("payment_refunds"."status" IN ('PENDING', 'PROCESSING', 'REFUNDED', 'FAILED'))
);
--> statement-breakpoint
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_refunds_status_idx" ON "payment_refunds" USING btree ("status");