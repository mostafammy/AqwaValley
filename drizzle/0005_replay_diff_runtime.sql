ALTER TABLE "irrigation_simulation_run"
ADD COLUMN IF NOT EXISTS "input_envelope_json" jsonb,
ADD COLUMN IF NOT EXISTS "provider_snapshot_json" jsonb,
ADD COLUMN IF NOT EXISTS "replay_last_status" text,
ADD COLUMN IF NOT EXISTS "replay_last_output_hash" text,
ADD COLUMN IF NOT EXISTS "replay_last_checked_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "replay_last_error" text,
ADD COLUMN IF NOT EXISTS "diff_status" text,
ADD COLUMN IF NOT EXISTS "diff_base_run_id" uuid,
ADD COLUMN IF NOT EXISTS "diff_metrics_json" jsonb,
ADD COLUMN IF NOT EXISTS "diff_computed_at" timestamp with time zone;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'irrigation_simulation_run_diff_base_run_id_irrigation_simulation_run_id_fk'
  ) THEN
    ALTER TABLE "irrigation_simulation_run"
      ADD CONSTRAINT "irrigation_simulation_run_diff_base_run_id_irrigation_simulation_run_id_fk"
      FOREIGN KEY ("diff_base_run_id")
      REFERENCES "public"."irrigation_simulation_run"("id")
      ON DELETE set null;
  END IF;
END $$;--> statement-breakpoint
