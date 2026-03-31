CREATE INDEX IF NOT EXISTS "email_audit_log_provider_message_id_idx" ON "email_audit_log" USING btree ("provider_message_id");--> statement-breakpoint
