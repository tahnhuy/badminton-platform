CREATE INDEX "users_role_status_created_idx" ON "users" USING btree ("role","status","created_at");--> statement-breakpoint
CREATE INDEX "courts_facility_status_idx" ON "courts" USING btree ("facility_id","status");--> statement-breakpoint
CREATE INDEX "facilities_status_created_idx" ON "facilities" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "bookings_created_idx" ON "bookings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "bookings_status_date_idx" ON "bookings" USING btree ("status","booking_date");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "registrations_status_registered_idx" ON "tournament_registrations" USING btree ("status","registered_at");--> statement-breakpoint
CREATE INDEX "tournaments_status_created_idx" ON "tournaments" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_status_created_idx" ON "reports" USING btree ("status","created_at");