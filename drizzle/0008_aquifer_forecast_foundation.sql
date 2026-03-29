DO $$ BEGIN
 CREATE TYPE "forecast_run_status" AS ENUM('queued', 'running', 'completed', 'failed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "forecast_scope_type" AS ENUM('district', 'well');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "forecast_target_type" AS ENUM('aquifer_level', 'extraction_vs_safe_yield');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "forecast_risk_level" AS ENUM('low', 'moderate', 'high', 'critical');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "forecast_model_approval_state" AS ENUM('pending_review', 'approved', 'rejected', 'expired', 'superseded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "forecast_trigger_type" AS ENUM('cron', 'manual', 'system');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 CREATE TYPE "forecast_lineage_usage_type" AS ENUM('train', 'validate', 'calibrate');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "aquifer_forecast_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "run_key" text NOT NULL,
  "trigger_type" "forecast_trigger_type" NOT NULL,
  "triggered_by" text,
  "scope_type" "forecast_scope_type" NOT NULL,
  "scope_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "status" "forecast_run_status" DEFAULT 'queued' NOT NULL,
  "quality_gate_status" text,
  "response_summary" jsonb,
  "error_summary" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "aquifer_forecast_run_run_key_unique" UNIQUE("run_key")
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_forecast_run"
   ADD CONSTRAINT "aquifer_forecast_run_triggered_by_user_fk"
   FOREIGN KEY ("triggered_by") REFERENCES "user"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "aquifer_linear_regression_model" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_type" "forecast_scope_type" NOT NULL,
  "scope_id" uuid NOT NULL,
  "target_type" "forecast_target_type" NOT NULL,
  "slope" numeric(14, 6) NOT NULL,
  "intercept" numeric(14, 6) NOT NULL,
  "r_squared" numeric(8, 6),
  "sample_count" integer NOT NULL,
  "training_window_start" timestamp with time zone NOT NULL,
  "training_window_end" timestamp with time zone NOT NULL,
  "data_completeness_pct" numeric(7, 4),
  "outlier_ratio_pct" numeric(7, 4),
  "approval_state" "forecast_model_approval_state" DEFAULT 'pending_review' NOT NULL,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "approval_expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "aquifer_model_scope_target_unique" UNIQUE("scope_type", "scope_id", "target_type", "training_window_end")
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_linear_regression_model"
   ADD CONSTRAINT "aquifer_linear_regression_model_approved_by_user_fk"
   FOREIGN KEY ("approved_by") REFERENCES "user"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "aquifer_risk_flag" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "scope_type" "forecast_scope_type" NOT NULL,
  "scope_id" uuid NOT NULL,
  "target_type" "forecast_target_type" NOT NULL,
  "flag_type" text NOT NULL,
  "risk_level" "forecast_risk_level" NOT NULL,
  "point_forecast" numeric(14, 6),
  "interval_80" jsonb,
  "interval_95" jsonb,
  "reason_codes" jsonb,
  "plausibility_policy_version" text NOT NULL,
  "model_version_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "computed_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_risk_flag"
   ADD CONSTRAINT "aquifer_risk_flag_model_fk"
   FOREIGN KEY ("model_version_id") REFERENCES "aquifer_linear_regression_model"("id")
   ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_risk_flag"
   ADD CONSTRAINT "aquifer_risk_flag_run_fk"
   FOREIGN KEY ("run_id") REFERENCES "aquifer_forecast_run"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "aquifer_external_reference_observation" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_system" text NOT NULL,
  "station_id" text NOT NULL,
  "district_id" uuid,
  "well_id" uuid,
  "observed_at" timestamp with time zone NOT NULL,
  "metric_type" text NOT NULL,
  "value" numeric(16, 6) NOT NULL,
  "unit" text NOT NULL,
  "mapping_confidence" numeric(7, 4),
  "source_snapshot_id" text NOT NULL,
  "ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_external_reference_observation"
   ADD CONSTRAINT "aquifer_external_reference_observation_district_fk"
   FOREIGN KEY ("district_id") REFERENCES "district"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_external_reference_observation"
   ADD CONSTRAINT "aquifer_external_reference_observation_well_fk"
   FOREIGN KEY ("well_id") REFERENCES "well"("id")
   ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "aquifer_model_reference_observation_link" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_version_id" uuid NOT NULL,
  "observation_id" uuid NOT NULL,
  "usage_type" "forecast_lineage_usage_type" NOT NULL,
  "weight" numeric(10, 6),
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "aquifer_lineage_unique" UNIQUE("model_version_id", "observation_id", "usage_type")
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_model_reference_observation_link"
   ADD CONSTRAINT "aquifer_model_reference_observation_link_model_fk"
   FOREIGN KEY ("model_version_id") REFERENCES "aquifer_linear_regression_model"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "aquifer_model_reference_observation_link"
   ADD CONSTRAINT "aquifer_model_reference_observation_link_observation_fk"
   FOREIGN KEY ("observation_id") REFERENCES "aquifer_external_reference_observation"("id")
   ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "aquifer_forecast_run_status_started_idx" ON "aquifer_forecast_run" USING btree ("status", "started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_forecast_run_scope_started_idx" ON "aquifer_forecast_run" USING btree ("scope_type", "started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_model_scope_target_window_idx" ON "aquifer_linear_regression_model" USING btree ("scope_type", "scope_id", "target_type", "training_window_end");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_model_approval_state_idx" ON "aquifer_linear_regression_model" USING btree ("approval_state");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_risk_scope_flag_computed_idx" ON "aquifer_risk_flag" USING btree ("scope_type", "scope_id", "flag_type", "computed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_risk_model_idx" ON "aquifer_risk_flag" USING btree ("model_version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_ext_ref_observed_idx" ON "aquifer_external_reference_observation" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_ext_ref_district_idx" ON "aquifer_external_reference_observation" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_ext_ref_well_idx" ON "aquifer_external_reference_observation" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_lineage_observation_idx" ON "aquifer_model_reference_observation_link" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "aquifer_lineage_model_idx" ON "aquifer_model_reference_observation_link" USING btree ("model_version_id");--> statement-breakpoint
