CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'delivered', 'bounced', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."email_type" AS ENUM('welcome_invitation', 'password_reset', 'farm_scope_grant', 'password_changed_confirmation');--> statement-breakpoint
CREATE TYPE "public"."forecast_lineage_usage_type" AS ENUM('train', 'validate', 'calibrate');--> statement-breakpoint
CREATE TYPE "public"."forecast_model_approval_state" AS ENUM('pending_review', 'approved', 'rejected', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."forecast_risk_level" AS ENUM('low', 'moderate', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."forecast_run_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."forecast_scope_type" AS ENUM('district', 'well');--> statement-breakpoint
CREATE TYPE "public"."forecast_target_type" AS ENUM('aquifer_level', 'extraction_vs_safe_yield');--> statement-breakpoint
CREATE TYPE "public"."forecast_trigger_type" AS ENUM('cron', 'manual', 'system');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('pending', 'processing', 'done', 'dead');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('invitation', 'password_reset');--> statement-breakpoint
CREATE TABLE "aquifer_external_reference_observation" (
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
);
--> statement-breakpoint
CREATE TABLE "aquifer_forecast_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_key" text NOT NULL,
	"trigger_type" "forecast_trigger_type" NOT NULL,
	"triggered_by" text,
	"scope_type" "forecast_scope_type" NOT NULL,
	"scope_ids" text[] DEFAULT '{}' NOT NULL,
	"status" "forecast_run_status" DEFAULT 'queued' NOT NULL,
	"quality_gate_status" text,
	"response_summary" jsonb,
	"error_summary" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aquifer_forecast_run_run_key_unique" UNIQUE("run_key")
);
--> statement-breakpoint
CREATE TABLE "aquifer_linear_regression_model" (
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
	CONSTRAINT "aquifer_model_scope_target_unique" UNIQUE("scope_type","scope_id","target_type","training_window_end")
);
--> statement-breakpoint
CREATE TABLE "aquifer_model_reference_observation_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_version_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"usage_type" "forecast_lineage_usage_type" NOT NULL,
	"weight" numeric(10, 6),
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aquifer_lineage_unique" UNIQUE("model_version_id","observation_id","usage_type")
);
--> statement-breakpoint
CREATE TABLE "aquifer_risk_flag" (
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
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"actor_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" text,
	"recipient_email" text NOT NULL,
	"email_type" "email_type" NOT NULL,
	"status" "email_status" DEFAULT 'queued' NOT NULL,
	"provider_message_id" text,
	"ip_requested_from" text,
	"delivered_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"error_detail" text,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "irrigation_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"plan_id" uuid,
	"frame_count" integer DEFAULT 0 NOT NULL,
	"liters_pumped" numeric(15, 4) DEFAULT '0' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"running" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "outbox_event_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_type" "token_type" NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" text NOT NULL,
	"invited_by" text,
	"farm_id" uuid,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"ip_requested_from" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_invitation_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "crop_history" ADD COLUMN "expected_harvest_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "irrigation_simulation_run" ADD COLUMN "is_primary" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "aquifer_external_reference_observation" ADD CONSTRAINT "aquifer_external_reference_observation_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_external_reference_observation" ADD CONSTRAINT "aquifer_external_reference_observation_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_forecast_run" ADD CONSTRAINT "aquifer_forecast_run_triggered_by_user_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_linear_regression_model" ADD CONSTRAINT "aquifer_linear_regression_model_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_model_reference_observation_link" ADD CONSTRAINT "aquifer_model_reference_observation_link_model_version_id_aquifer_linear_regression_model_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."aquifer_linear_regression_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_model_reference_observation_link" ADD CONSTRAINT "aquifer_model_reference_observation_link_observation_id_aquifer_external_reference_observation_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."aquifer_external_reference_observation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_risk_flag" ADD CONSTRAINT "aquifer_risk_flag_model_version_id_aquifer_linear_regression_model_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."aquifer_linear_regression_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_risk_flag" ADD CONSTRAINT "aquifer_risk_flag_run_id_aquifer_forecast_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."aquifer_forecast_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_audit_log" ADD CONSTRAINT "email_audit_log_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_session" ADD CONSTRAINT "irrigation_session_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_session" ADD CONSTRAINT "irrigation_session_plan_id_irrigation_recommendation_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."irrigation_recommendation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "aquifer_ext_ref_observed_idx" ON "aquifer_external_reference_observation" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "aquifer_ext_ref_district_idx" ON "aquifer_external_reference_observation" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "aquifer_ext_ref_well_idx" ON "aquifer_external_reference_observation" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "aquifer_forecast_run_status_started_idx" ON "aquifer_forecast_run" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "aquifer_forecast_run_scope_started_idx" ON "aquifer_forecast_run" USING btree ("scope_type","started_at");--> statement-breakpoint
CREATE INDEX "aquifer_model_scope_target_window_idx" ON "aquifer_linear_regression_model" USING btree ("scope_type","scope_id","target_type","training_window_end");--> statement-breakpoint
CREATE INDEX "aquifer_model_approval_state_idx" ON "aquifer_linear_regression_model" USING btree ("approval_state");--> statement-breakpoint
CREATE INDEX "aquifer_lineage_observation_idx" ON "aquifer_model_reference_observation_link" USING btree ("observation_id");--> statement-breakpoint
CREATE INDEX "aquifer_lineage_model_idx" ON "aquifer_model_reference_observation_link" USING btree ("model_version_id");--> statement-breakpoint
CREATE INDEX "aquifer_risk_scope_flag_computed_idx" ON "aquifer_risk_flag" USING btree ("scope_type","scope_id","flag_type","computed_at");--> statement-breakpoint
CREATE INDEX "aquifer_risk_model_idx" ON "aquifer_risk_flag" USING btree ("model_version_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_type_id_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_id_idx" ON "audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "email_audit_log_user_idx" ON "email_audit_log" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "email_audit_log_type_idx" ON "email_audit_log" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "email_audit_log_status_idx" ON "email_audit_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_audit_log_provider_message_id_idx" ON "email_audit_log" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "email_audit_log_sent_at_idx" ON "email_audit_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "irrigation_session_farm_plan_idx" ON "irrigation_session" USING btree ("farm_id","plan_id");--> statement-breakpoint
CREATE INDEX "irrigation_session_updated_at_idx" ON "irrigation_session" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "outbox_event_status_created_idx" ON "outbox_event" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "outbox_event_next_retry_idx" ON "outbox_event" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "user_invitation_token_hash_idx" ON "user_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_invitation_user_id_idx" ON "user_invitation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_invitation_status_idx" ON "user_invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_invitation_expires_at_idx" ON "user_invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_invitation_type_status_idx" ON "user_invitation" USING btree ("token_type","status");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_event_primary_idx" ON "irrigation_simulation_run" USING btree ("irrigation_event_id","is_primary");