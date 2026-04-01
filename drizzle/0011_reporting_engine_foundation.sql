CREATE TYPE "public"."report_type" AS ENUM('user_activity', 'district_governance', 'compliance', 'audit_trail', 'monthly_governance_pack');--> statement-breakpoint
CREATE TYPE "public"."report_scope_type" AS ENUM('global', 'district', 'farm', 'user');--> statement-breakpoint
CREATE TYPE "public"."report_job_status" AS ENUM('queued', 'processing', 'completed', 'partial_failed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_generation_mode" AS ENUM('strict', 'partial');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'csv', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."report_artifact_status" AS ENUM('ready', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."report_snapshot_type" AS ENUM('logical', 'physical');--> statement-breakpoint

CREATE TABLE "report_job" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_type" "report_type" NOT NULL,
  "status" "report_job_status" DEFAULT 'queued' NOT NULL,
  "generation_mode" "report_generation_mode" DEFAULT 'strict' NOT NULL,
  "requested_by" text NOT NULL,
  "scope_type" "report_scope_type" DEFAULT 'global' NOT NULL,
  "scope_district_id" uuid,
  "scope_farm_id" uuid,
  "scope_user_id" text,
  "time_range_from" timestamp with time zone,
  "time_range_to" timestamp with time zone,
  "granularity" text DEFAULT 'daily' NOT NULL,
  "parameter_schema_version" text DEFAULT 'report-params-v1' NOT NULL,
  "normalized_parameters_hash" text NOT NULL,
  "snapshot_id" text NOT NULL,
  "snapshot_type" "report_snapshot_type" DEFAULT 'logical' NOT NULL,
  "snapshot_metadata" jsonb,
  "template_version" text NOT NULL,
  "policy_version" text NOT NULL,
  "masking_rules_version" text NOT NULL,
  "error_detail" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "report_artifact" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_job_id" uuid NOT NULL,
  "format" "report_format" NOT NULL,
  "status" "report_artifact_status" DEFAULT 'ready' NOT NULL,
  "storage_key" text NOT NULL,
  "content_type" text NOT NULL,
  "file_size_bytes" integer NOT NULL,
  "output_hash" text NOT NULL,
  "metadata" jsonb,
  "ready_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "report_artifact_job_format_unique" UNIQUE("report_job_id", "format")
);--> statement-breakpoint

CREATE TABLE "report_audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_job_id" uuid,
  "report_artifact_id" uuid,
  "actor_id" text,
  "action_type" text NOT NULL,
  "details" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "report_job" ADD CONSTRAINT "report_job_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_district_id_district_id_fk" FOREIGN KEY ("scope_district_id") REFERENCES "public"."district"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_farm_id_farm_id_fk" FOREIGN KEY ("scope_farm_id") REFERENCES "public"."farm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_user_id_user_id_fk" FOREIGN KEY ("scope_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_global_check" CHECK (
  (
    "scope_type" = 'global'
    AND "scope_district_id" IS NULL
    AND "scope_farm_id" IS NULL
    AND "scope_user_id" IS NULL
  )
  OR (
    "scope_type" = 'district'
    AND "scope_district_id" IS NOT NULL
    AND "scope_farm_id" IS NULL
    AND "scope_user_id" IS NULL
  )
  OR (
    "scope_type" = 'farm'
    AND "scope_farm_id" IS NOT NULL
    AND "scope_district_id" IS NULL
    AND "scope_user_id" IS NULL
  )
  OR (
    "scope_type" = 'user'
    AND "scope_user_id" IS NOT NULL
    AND "scope_district_id" IS NULL
    AND "scope_farm_id" IS NULL
  )
);--> statement-breakpoint

ALTER TABLE "report_artifact" ADD CONSTRAINT "report_artifact_report_job_id_report_job_id_fk" FOREIGN KEY ("report_job_id") REFERENCES "public"."report_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "report_audit_log" ADD CONSTRAINT "report_audit_log_report_job_id_report_job_id_fk" FOREIGN KEY ("report_job_id") REFERENCES "public"."report_job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_audit_log" ADD CONSTRAINT "report_audit_log_report_artifact_id_report_artifact_id_fk" FOREIGN KEY ("report_artifact_id") REFERENCES "public"."report_artifact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_audit_log" ADD CONSTRAINT "report_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "report_job_status_created_idx" ON "report_job" USING btree ("status", "created_at");--> statement-breakpoint
CREATE INDEX "report_job_requested_by_created_idx" ON "report_job" USING btree ("requested_by", "created_at");--> statement-breakpoint
CREATE INDEX "report_job_scope_idx" ON "report_job" USING btree ("scope_type", "scope_district_id", "scope_farm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_job_fingerprint_unique" ON "report_job" USING btree ("report_type", "normalized_parameters_hash", "snapshot_id", "template_version", "policy_version");--> statement-breakpoint

CREATE INDEX "report_artifact_job_format_idx" ON "report_artifact" USING btree ("report_job_id", "format");--> statement-breakpoint
CREATE INDEX "report_artifact_status_idx" ON "report_artifact" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_artifact_expires_idx" ON "report_artifact" USING btree ("expires_at");--> statement-breakpoint

CREATE INDEX "report_audit_log_job_idx" ON "report_audit_log" USING btree ("report_job_id");--> statement-breakpoint
CREATE INDEX "report_audit_log_action_idx" ON "report_audit_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "report_audit_log_actor_idx" ON "report_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "report_audit_log_created_idx" ON "report_audit_log" USING btree ("created_at");--> statement-breakpoint
