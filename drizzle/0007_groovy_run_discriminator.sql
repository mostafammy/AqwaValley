ALTER TABLE "irrigation_simulation_run"
ADD COLUMN IF NOT EXISTS "is_primary" boolean NOT NULL DEFAULT true;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "irrigation_sim_run_event_primary_idx"
ON "irrigation_simulation_run" USING btree ("irrigation_event_id", "is_primary");--> statement-breakpoint