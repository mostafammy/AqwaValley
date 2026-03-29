CREATE TYPE "public"."irrigation_event_status" AS ENUM('REQUESTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'DEBIT_PENDING', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."irrigation_debit_status" AS ENUM('PENDING', 'APPLIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."irrigation_simulation_run_status" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."irrigation_model_mode" AS ENUM('production', 'demo');--> statement-breakpoint
CREATE TYPE "public"."irrigation_telemetry_source" AS ENUM('REAL', 'SIMULATION');--> statement-breakpoint
CREATE TYPE "public"."irrigation_valve_audit_state" AS ENUM('CLOSED', 'OPENING', 'OPEN', 'CLOSING');--> statement-breakpoint

CREATE TABLE "irrigation_event" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "farm_id" uuid NOT NULL,
  "recommendation_id" uuid,
  "triggered_by_user_id" text NOT NULL,
  "well_ids" uuid[] NOT NULL,
  "status" "irrigation_event_status" DEFAULT 'REQUESTED' NOT NULL,
  "plan_source" text NOT NULL,
  "duration_minutes" integer NOT NULL,
  "started_at" timestamp with time zone,
  "ended_at" timestamp with time zone,
  "actual_consumption_m3" numeric(15, 4),
  "quota_debit_m3" numeric(15, 4),
  "quota_debit_status" "irrigation_debit_status" DEFAULT 'PENDING' NOT NULL,
  "quota_debit_attempts" integer DEFAULT 0 NOT NULL,
  "quota_debit_last_error" text,
  "failure_code" text,
  "failure_message" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "well_valve_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "well_id" uuid NOT NULL,
  "state" "irrigation_valve_audit_state" NOT NULL,
  "irrigation_event_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "transitioned_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "irrigation_simulation_run" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "irrigation_event_id" uuid NOT NULL,
  "queue_job_id" text,
  "run_status" "irrigation_simulation_run_status" DEFAULT 'QUEUED' NOT NULL,
  "engine_version" text NOT NULL,
  "hydrology_model_version" text NOT NULL,
  "model_mode" "irrigation_model_mode" DEFAULT 'production' NOT NULL,
  "rng_seed" text,
  "input_hash" text,
  "provider_snapshot_hash" text,
  "pricing_snapshot_version" text,
  "adapter_unit_version" text,
  "start_timestamp" timestamp with time zone NOT NULL,
  "timezone" text DEFAULT 'UTC' NOT NULL,
  "integration_step_count" integer DEFAULT 0 NOT NULL,
  "phase_step_counts_json" jsonb,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "dt_min_observed_s" numeric(12, 4),
  "dt_max_observed_s" numeric(12, 4),
  "error_norm_max" double precision,
  "error_norm_p95" double precision,
  "numerical_divergence_count" integer DEFAULT 0 NOT NULL,
  "mass_debt_peak_m3" numeric(15, 4),
  "debt_event_count" integer DEFAULT 0 NOT NULL,
  "quality_state_counts_json" jsonb,
  "anomaly_code_counts_json" jsonb,
  "trajectory_hash" text,
  "summary_hash" text,
  "queue_wait_time_ms" integer,
  "execution_time_ms" integer,
  "run_cost_usd" numeric(15, 6),
  "run_cost_breakdown_json" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint

CREATE TABLE "sensor_data_simulation" (
  "sensor_id" uuid NOT NULL,
  "simulation_run_id" uuid NOT NULL,
  "irrigation_event_id" uuid NOT NULL,
  "source" "irrigation_telemetry_source" DEFAULT 'SIMULATION' NOT NULL,
  "value" double precision NOT NULL,
  "timestamp" timestamp with time zone NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "generator_version" text NOT NULL,
  CONSTRAINT "sensor_data_sim_run_sensor_ts_key" UNIQUE("simulation_run_id","sensor_id","timestamp")
);--> statement-breakpoint

ALTER TABLE "irrigation_event" ADD CONSTRAINT "irrigation_event_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_event" ADD CONSTRAINT "irrigation_event_recommendation_id_irrigation_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."irrigation_recommendation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_event" ADD CONSTRAINT "irrigation_event_triggered_by_user_id_user_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "well_valve_state" ADD CONSTRAINT "well_valve_state_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_valve_state" ADD CONSTRAINT "well_valve_state_irrigation_event_id_irrigation_event_id_fk" FOREIGN KEY ("irrigation_event_id") REFERENCES "public"."irrigation_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "irrigation_simulation_run" ADD CONSTRAINT "irrigation_simulation_run_irrigation_event_id_irrigation_event_id_fk" FOREIGN KEY ("irrigation_event_id") REFERENCES "public"."irrigation_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "sensor_data_simulation" ADD CONSTRAINT "sensor_data_simulation_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data_simulation" ADD CONSTRAINT "sensor_data_simulation_simulation_run_id_irrigation_simulation_run_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."irrigation_simulation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data_simulation" ADD CONSTRAINT "sensor_data_simulation_irrigation_event_id_irrigation_event_id_fk" FOREIGN KEY ("irrigation_event_id") REFERENCES "public"."irrigation_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "irrigation_event_farm_created_idx" ON "irrigation_event" USING btree ("farm_id","created_at");--> statement-breakpoint
CREATE INDEX "irrigation_event_status_idx" ON "irrigation_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "irrigation_event_triggered_by_idx" ON "irrigation_event" USING btree ("triggered_by_user_id");--> statement-breakpoint

CREATE INDEX "well_valve_state_event_transitioned_idx" ON "well_valve_state" USING btree ("irrigation_event_id","transitioned_at");--> statement-breakpoint
CREATE INDEX "well_valve_state_well_transitioned_idx" ON "well_valve_state" USING btree ("well_id","transitioned_at");--> statement-breakpoint

CREATE INDEX "irrigation_sim_run_event_idx" ON "irrigation_simulation_run" USING btree ("irrigation_event_id");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_status_created_idx" ON "irrigation_simulation_run" USING btree ("run_status","created_at");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_hydrology_version_idx" ON "irrigation_simulation_run" USING btree ("hydrology_model_version");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_model_mode_idx" ON "irrigation_simulation_run" USING btree ("model_mode");--> statement-breakpoint
CREATE UNIQUE INDEX "irrigation_sim_run_queue_job_key" ON "irrigation_simulation_run" USING btree ("queue_job_id");--> statement-breakpoint

CREATE INDEX "sensor_data_sim_source_sensor_ts_idx" ON "sensor_data_simulation" USING btree ("source","sensor_id","timestamp");--> statement-breakpoint
CREATE INDEX "sensor_data_sim_run_ts_idx" ON "sensor_data_simulation" USING btree ("simulation_run_id","timestamp");--> statement-breakpoint
CREATE INDEX "sensor_data_sim_event_ts_idx" ON "sensor_data_simulation" USING btree ("irrigation_event_id","timestamp");