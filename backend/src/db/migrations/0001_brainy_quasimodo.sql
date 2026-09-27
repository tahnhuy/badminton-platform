CREATE INDEX "users_role_status_id_idx" ON "users" USING btree ("role","status","id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");