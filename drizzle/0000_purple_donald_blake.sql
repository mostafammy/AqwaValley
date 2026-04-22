CREATE TYPE "public"."alert_rule_operator" AS ENUM('gt', 'lt', 'gte', 'lte', 'eq');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('threshold_breach', 'anomaly', 'sensor_offline');--> statement-breakpoint
CREATE TYPE "public"."crop_type" AS ENUM('wheat', 'rice', 'corn', 'cotton', 'sugarcane', 'vegetables', 'fruits', 'other');--> statement-breakpoint
CREATE TYPE "public"."email_status" AS ENUM('queued', 'sent', 'delivered', 'bounced', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."email_type" AS ENUM('welcome_invitation', 'password_reset', 'farm_scope_grant', 'password_changed_confirmation');--> statement-breakpoint
CREATE TYPE "public"."farm_status" AS ENUM('active', 'inactive', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."forecast_lineage_usage_type" AS ENUM('train', 'validate', 'calibrate');--> statement-breakpoint
CREATE TYPE "public"."forecast_model_approval_state" AS ENUM('pending_review', 'approved', 'rejected', 'expired', 'superseded');--> statement-breakpoint
CREATE TYPE "public"."forecast_risk_level" AS ENUM('low', 'moderate', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."forecast_run_status" AS ENUM('queued', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."forecast_scope_type" AS ENUM('district', 'well');--> statement-breakpoint
CREATE TYPE "public"."forecast_target_type" AS ENUM('aquifer_level', 'extraction_vs_safe_yield');--> statement-breakpoint
CREATE TYPE "public"."forecast_trigger_type" AS ENUM('cron', 'manual', 'system');--> statement-breakpoint
CREATE TYPE "public"."growth_stage" AS ENUM('germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."irrigation_debit_status" AS ENUM('PENDING', 'APPLIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."irrigation_event_status" AS ENUM('REQUESTED', 'QUEUED', 'RUNNING', 'COMPLETED', 'DEBIT_PENDING', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."irrigation_model_mode" AS ENUM('production', 'demo');--> statement-breakpoint
CREATE TYPE "public"."irrigation_simulation_run_status" AS ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."irrigation_telemetry_source" AS ENUM('REAL', 'SIMULATION');--> statement-breakpoint
CREATE TYPE "public"."irrigation_valve_audit_state" AS ENUM('CLOSED', 'OPENING', 'OPEN', 'CLOSING');--> statement-breakpoint
CREATE TYPE "public"."outbox_event_status" AS ENUM('pending', 'processing', 'done', 'dead');--> statement-breakpoint
CREATE TYPE "public"."quota_breach_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."quota_override_status" AS ENUM('active', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."quota_period_type" AS ENUM('daily', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."quota_scope_type" AS ENUM('farm', 'district');--> statement-breakpoint
CREATE TYPE "public"."quota_state" AS ENUM('ok', 'warning', 'critical', 'exceeded', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."quota_trend_direction" AS ENUM('increase', 'decrease', 'flat');--> statement-breakpoint
CREATE TYPE "public"."recommendation_status" AS ENUM('PENDING', 'ACTIVATED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."report_artifact_status" AS ENUM('ready', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'csv', 'xlsx');--> statement-breakpoint
CREATE TYPE "public"."report_generation_mode" AS ENUM('strict', 'partial');--> statement-breakpoint
CREATE TYPE "public"."report_job_status" AS ENUM('queued', 'processing', 'completed', 'partial_failed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."report_scope_type" AS ENUM('global', 'district', 'farm', 'user');--> statement-breakpoint
CREATE TYPE "public"."report_snapshot_type" AS ENUM('logical', 'physical');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('user_activity', 'district_governance', 'compliance', 'audit_trail', 'monthly_governance_pack');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('admin', 'district_manager', 'farm_owner', 'farmer', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."sensor_type" AS ENUM('water_level', 'pressure', 'flow_rate', 'temperature', 'humidity');--> statement-breakpoint
CREATE TYPE "public"."sensor_unit" AS ENUM('meters', 'bar', 'celsius', 'm3_per_hour', 'percent');--> statement-breakpoint
CREATE TYPE "public"."token_type" AS ENUM('invitation', 'password_reset');--> statement-breakpoint
CREATE TYPE "public"."valve_state" AS ENUM('open', 'closed', 'partially_open', 'auto');--> statement-breakpoint
CREATE TYPE "public"."well_status" AS ENUM('active', 'inactive', 'maintenance', 'offline', 'restricted');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"well_id" uuid NOT NULL,
	"sensor_type" "sensor_type" NOT NULL,
	"operator" "alert_rule_operator" NOT NULL,
	"threshold" double precision NOT NULL,
	"severity" "alert_severity" NOT NULL,
	"suppression_window_minutes" integer DEFAULT 15 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sensor_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"alert_rule_id" uuid,
	"type" "alert_type" NOT NULL,
	"severity" "alert_severity" DEFAULT 'warning' NOT NULL,
	"message" text NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hashed_key" text NOT NULL,
	"name" text NOT NULL,
	"well_id" uuid,
	"created_by_user_id" text NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_key_hashed_key_unique" UNIQUE("hashed_key")
);
--> statement-breakpoint
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
CREATE TABLE "cron_simulation_run" (
	"run_key" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"attempt_token" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"response" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "crop_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"crop_type" "crop_type" NOT NULL,
	"growth_stage" "growth_stage" NOT NULL,
	"target_soil_moisture_pct" numeric(5, 2),
	"planted_date" timestamp with time zone,
	"expected_harvest_date" timestamp with time zone,
	"harvested_date" timestamp with time zone,
	"yield" numeric(10, 2),
	"yield_unit" text DEFAULT 'kg_per_acre',
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crop_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"crop_type" "crop_type" NOT NULL,
	"growth_stage" "growth_stage" NOT NULL,
	"target_soil_moisture_pct" numeric(5, 2),
	"planted_date" timestamp with time zone,
	"expected_harvest_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crop_profile_farm_id_unique" UNIQUE("farm_id")
);
--> statement-breakpoint
CREATE TABLE "crop_type_lookup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "crop_type" NOT NULL,
	"display_name" text NOT NULL,
	"common_name" text,
	"description" text,
	CONSTRAINT "crop_type_lookup_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "district" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"boundary_geojson" jsonb,
	"baseline_depth_m" numeric(10, 2),
	"annual_depletion_rate_m" numeric(10, 4),
	"safe_yield_m3_yr" numeric(15, 2),
	"warning_threshold_pct" numeric(5, 2),
	"critical_threshold_pct" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "district_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "district_period_consumption_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"period_type" "quota_period_type" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"quota_m3" numeric(15, 2) NOT NULL,
	"consumption_m3" numeric(15, 2) DEFAULT '0' NOT NULL,
	"utilization_pct" numeric(7, 2) DEFAULT '0' NOT NULL,
	"baseline_consumption_m3" numeric(15, 2),
	"trend_direction" "quota_trend_direction",
	"trend_delta_pct" numeric(7, 2),
	"raw_state" "quota_state" NOT NULL,
	"effective_state" "quota_state" NOT NULL,
	"data_quality_flag" text,
	"decision_reasons" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "district_snapshot_unique" UNIQUE("district_id","period_type","period_start")
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
CREATE TABLE "farm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"farmer_user_id" text,
	"district_id" uuid NOT NULL,
	"status" "farm_status" DEFAULT 'active' NOT NULL,
	"total_area_acres" numeric(10, 2),
	"monthly_quota_m3" numeric(12, 2),
	"annual_quota_m3" numeric(12, 2),
	"last_profile_updated" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_period_consumption_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"district_id" uuid NOT NULL,
	"period_type" "quota_period_type" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"quota_m3" numeric(15, 2) NOT NULL,
	"consumption_m3" numeric(15, 2) DEFAULT '0' NOT NULL,
	"utilization_pct" numeric(7, 2) DEFAULT '0' NOT NULL,
	"baseline_consumption_m3" numeric(15, 2),
	"trend_direction" "quota_trend_direction",
	"trend_delta_pct" numeric(7, 2),
	"raw_state" "quota_state" NOT NULL,
	"effective_state" "quota_state" NOT NULL,
	"data_quality_flag" text,
	"decision_reasons" jsonb,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_snapshot_unique" UNIQUE("farm_id","period_type","period_start")
);
--> statement-breakpoint
CREATE TABLE "farm_well" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"well_id" uuid NOT NULL,
	"allocation_pct" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "farm_well_unique" UNIQUE("farm_id","well_id")
);
--> statement-breakpoint
CREATE TABLE "growth_stage_lookup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stage" "growth_stage" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"est_duration_days" integer,
	CONSTRAINT "growth_stage_lookup_stage_unique" UNIQUE("stage")
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "irrigation_recommendation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"requested_by" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_message" text NOT NULL,
	"raw_response" text NOT NULL,
	"plan" jsonb NOT NULL,
	"total_litres" integer NOT NULL,
	"model_used" text NOT NULL,
	"fallback" boolean DEFAULT false NOT NULL,
	"status" "recommendation_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activated_at" timestamp with time zone
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
CREATE TABLE "irrigation_simulation_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"irrigation_event_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"queue_job_id" text,
	"run_status" "irrigation_simulation_run_status" DEFAULT 'QUEUED' NOT NULL,
	"engine_version" text NOT NULL,
	"hydrology_model_version" text NOT NULL,
	"model_mode" "irrigation_model_mode" DEFAULT 'production' NOT NULL,
	"rng_seed" text,
	"input_hash" text,
	"input_envelope_json" jsonb,
	"provider_snapshot_hash" text,
	"provider_snapshot_json" jsonb,
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
	"replay_last_status" text,
	"replay_last_output_hash" text,
	"replay_last_checked_at" timestamp with time zone,
	"replay_last_error" text,
	"diff_status" text,
	"diff_base_run_id" uuid,
	"diff_metrics_json" jsonb,
	"diff_computed_at" timestamp with time zone,
	"queue_wait_time_ms" integer,
	"execution_time_ms" integer,
	"run_cost_usd" numeric(15, 6),
	"run_cost_breakdown_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "irrigation_sim_run_queue_job_key" UNIQUE("queue_job_id")
);
--> statement-breakpoint
CREATE TABLE "latest_sensor_state" (
	"sensor_id" uuid PRIMARY KEY NOT NULL,
	"well_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"unit" "sensor_unit" NOT NULL,
	"type" "sensor_type" NOT NULL,
	"last_updated_at" timestamp with time zone NOT NULL
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
CREATE TABLE "quota_breach_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" "quota_scope_type" NOT NULL,
	"farm_id" uuid,
	"district_id" uuid NOT NULL,
	"period_type" "quota_period_type" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"raw_state" "quota_state" NOT NULL,
	"effective_state" "quota_state" NOT NULL,
	"quota_m3" numeric(15, 2) NOT NULL,
	"consumption_m3" numeric(15, 2) NOT NULL,
	"utilization_pct" numeric(7, 2) NOT NULL,
	"delta_m3" numeric(15, 2) NOT NULL,
	"status" "quota_breach_status" DEFAULT 'open' NOT NULL,
	"reason_codes" jsonb,
	"message" text,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quota_override" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope_type" "quota_scope_type" NOT NULL,
	"farm_id" uuid,
	"district_id" uuid NOT NULL,
	"state_override" "quota_state" NOT NULL,
	"reason" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"status" "quota_override_status" DEFAULT 'active' NOT NULL,
	"approved_by_user_id" text NOT NULL,
	"revoked_by_user_id" text,
	"revoked_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	CONSTRAINT "report_artifact_job_format_unique" UNIQUE("report_job_id","format")
);
--> statement-breakpoint
CREATE TABLE "report_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_job_id" uuid,
	"report_artifact_id" uuid,
	"actor_id" text,
	"action_type" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_job_fingerprint_unique" UNIQUE("report_type","normalized_parameters_hash","snapshot_id","template_version","policy_version"),
	CONSTRAINT "report_job_scope_global_check" CHECK ((
        ("report_job"."scope_type" = 'global' and "report_job"."scope_district_id" is null and "report_job"."scope_farm_id" is null and "report_job"."scope_user_id" is null)
        or
        ("report_job"."scope_type" = 'district' and "report_job"."scope_district_id" is not null and "report_job"."scope_farm_id" is null and "report_job"."scope_user_id" is null)
        or
        ("report_job"."scope_type" = 'farm' and "report_job"."scope_farm_id" is not null and "report_job"."scope_district_id" is null and "report_job"."scope_user_id" is null)
        or
        ("report_job"."scope_type" = 'user' and "report_job"."scope_user_id" is not null and "report_job"."scope_district_id" is null and "report_job"."scope_farm_id" is null)
      ))
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "role_type" NOT NULL,
	"display_name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_type_unique" UNIQUE("type")
);
--> statement-breakpoint
CREATE TABLE "sensor_data" (
	"sensor_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	CONSTRAINT "sensor_data_sensor_timestamp_key" UNIQUE("sensor_id","timestamp")
);
--> statement-breakpoint
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
);
--> statement-breakpoint
CREATE TABLE "sensors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"well_id" uuid NOT NULL,
	"type" "sensor_type" NOT NULL,
	"unit" "sensor_unit" NOT NULL,
	"name" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
	"display_username" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username")
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
CREATE TABLE "user_notification_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_opt_out" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"national_id" text NOT NULL,
	"full_name" text NOT NULL,
	"phone_number" text,
	"district_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_profile_national_id_unique" UNIQUE("national_id")
);
--> statement-breakpoint
CREATE TABLE "user_role_assignment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"assigned_by" text,
	CONSTRAINT "user_role_assignment_unique" UNIQUE("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "well" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"district_id" uuid NOT NULL,
	"name" text NOT NULL,
	"depth_m" numeric(10, 2),
	"status" "well_status" DEFAULT 'active' NOT NULL,
	"has_sensor" boolean DEFAULT false NOT NULL,
	"latitude" numeric(10, 8) NOT NULL,
	"longitude" numeric(11, 8) NOT NULL,
	"baseline_flow_rate_m3_hr" numeric(12, 2),
	"target_flow_rate_m3_hr" numeric(12, 2),
	"max_flow_rate_m3_hr" numeric(12, 2),
	"current_level_pct" numeric(5, 2),
	"valve_state" "valve_state" DEFAULT 'closed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "well_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"well_id" uuid NOT NULL,
	"changed_by" text NOT NULL,
	"from_status" "well_status",
	"to_status" "well_status" NOT NULL,
	"reason" text,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "well_valve_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"well_id" uuid NOT NULL,
	"state" "irrigation_valve_audit_state" NOT NULL,
	"irrigation_event_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"transitioned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_alert_rule_id_alert_rule_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_user_id_user_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_external_reference_observation" ADD CONSTRAINT "aquifer_external_reference_observation_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_external_reference_observation" ADD CONSTRAINT "aquifer_external_reference_observation_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_forecast_run" ADD CONSTRAINT "aquifer_forecast_run_triggered_by_user_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_linear_regression_model" ADD CONSTRAINT "aquifer_linear_regression_model_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_model_reference_observation_link" ADD CONSTRAINT "aquifer_model_reference_observation_link_model_version_id_aquifer_linear_regression_model_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."aquifer_linear_regression_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_model_reference_observation_link" ADD CONSTRAINT "aquifer_model_reference_observation_link_observation_id_aquifer_external_reference_observation_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."aquifer_external_reference_observation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_risk_flag" ADD CONSTRAINT "aquifer_risk_flag_model_version_id_aquifer_linear_regression_model_id_fk" FOREIGN KEY ("model_version_id") REFERENCES "public"."aquifer_linear_regression_model"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aquifer_risk_flag" ADD CONSTRAINT "aquifer_risk_flag_run_id_aquifer_forecast_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."aquifer_forecast_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_history" ADD CONSTRAINT "crop_history_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_profile" ADD CONSTRAINT "crop_profile_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "district_period_consumption_snapshot" ADD CONSTRAINT "district_period_consumption_snapshot_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_audit_log" ADD CONSTRAINT "email_audit_log_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm" ADD CONSTRAINT "farm_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm" ADD CONSTRAINT "farm_farmer_user_id_user_id_fk" FOREIGN KEY ("farmer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm" ADD CONSTRAINT "farm_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_period_consumption_snapshot" ADD CONSTRAINT "farm_period_consumption_snapshot_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_period_consumption_snapshot" ADD CONSTRAINT "farm_period_consumption_snapshot_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_well" ADD CONSTRAINT "farm_well_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_well" ADD CONSTRAINT "farm_well_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_event" ADD CONSTRAINT "irrigation_event_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_event" ADD CONSTRAINT "irrigation_event_recommendation_id_irrigation_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."irrigation_recommendation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_event" ADD CONSTRAINT "irrigation_event_triggered_by_user_id_user_id_fk" FOREIGN KEY ("triggered_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_recommendation" ADD CONSTRAINT "irrigation_recommendation_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_recommendation" ADD CONSTRAINT "irrigation_recommendation_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_session" ADD CONSTRAINT "irrigation_session_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_session" ADD CONSTRAINT "irrigation_session_plan_id_irrigation_recommendation_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."irrigation_recommendation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_simulation_run" ADD CONSTRAINT "irrigation_simulation_run_irrigation_event_id_irrigation_event_id_fk" FOREIGN KEY ("irrigation_event_id") REFERENCES "public"."irrigation_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "latest_sensor_state" ADD CONSTRAINT "latest_sensor_state_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "latest_sensor_state" ADD CONSTRAINT "latest_sensor_state_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_breach_event" ADD CONSTRAINT "quota_breach_event_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_breach_event" ADD CONSTRAINT "quota_breach_event_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_breach_event" ADD CONSTRAINT "quota_breach_event_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_artifact" ADD CONSTRAINT "report_artifact_report_job_id_report_job_id_fk" FOREIGN KEY ("report_job_id") REFERENCES "public"."report_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_audit_log" ADD CONSTRAINT "report_audit_log_report_job_id_report_job_id_fk" FOREIGN KEY ("report_job_id") REFERENCES "public"."report_job"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_audit_log" ADD CONSTRAINT "report_audit_log_report_artifact_id_report_artifact_id_fk" FOREIGN KEY ("report_artifact_id") REFERENCES "public"."report_artifact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_audit_log" ADD CONSTRAINT "report_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_district_id_district_id_fk" FOREIGN KEY ("scope_district_id") REFERENCES "public"."district"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_farm_id_farm_id_fk" FOREIGN KEY ("scope_farm_id") REFERENCES "public"."farm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_job" ADD CONSTRAINT "report_job_scope_user_id_user_id_fk" FOREIGN KEY ("scope_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data_simulation" ADD CONSTRAINT "sensor_data_simulation_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data_simulation" ADD CONSTRAINT "sensor_data_simulation_simulation_run_id_irrigation_simulation_run_id_fk" FOREIGN KEY ("simulation_run_id") REFERENCES "public"."irrigation_simulation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data_simulation" ADD CONSTRAINT "sensor_data_simulation_irrigation_event_id_irrigation_event_id_fk" FOREIGN KEY ("irrigation_event_id") REFERENCES "public"."irrigation_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_invitation" ADD CONSTRAINT "user_invitation_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well" ADD CONSTRAINT "well_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_status_history" ADD CONSTRAINT "well_status_history_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_status_history" ADD CONSTRAINT "well_status_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_valve_state" ADD CONSTRAINT "well_valve_state_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_valve_state" ADD CONSTRAINT "well_valve_state_irrigation_event_id_irrigation_event_id_fk" FOREIGN KEY ("irrigation_event_id") REFERENCES "public"."irrigation_event"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alert_rule_well_id_idx" ON "alert_rule" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "alert_rule_sensor_type_idx" ON "alert_rule" USING btree ("sensor_type");--> statement-breakpoint
CREATE INDEX "alert_rule_is_active_idx" ON "alert_rule" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "alerts_sensor_id_idx" ON "alerts" USING btree ("sensor_id");--> statement-breakpoint
CREATE INDEX "alerts_well_id_idx" ON "alerts" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "alerts_type_idx" ON "alerts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "alerts_severity_idx" ON "alerts" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "alerts_acknowledged_at_idx" ON "alerts" USING btree ("acknowledged_at");--> statement-breakpoint
CREATE INDEX "api_key_hashed_key_idx" ON "api_key" USING btree ("hashed_key");--> statement-breakpoint
CREATE INDEX "api_key_well_id_idx" ON "api_key" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "api_key_is_active_idx" ON "api_key" USING btree ("is_active");--> statement-breakpoint
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
CREATE INDEX "cron_simulation_run_status_started_idx" ON "cron_simulation_run" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "cron_simulation_run_started_idx" ON "cron_simulation_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "crop_history_farm_idx" ON "crop_history" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "crop_history_recorded_at_idx" ON "crop_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "crop_profile_farm_idx" ON "crop_profile" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "crop_profile_crop_type_idx" ON "crop_profile" USING btree ("crop_type");--> statement-breakpoint
CREATE INDEX "crop_type_lookup_type_idx" ON "crop_type_lookup" USING btree ("type");--> statement-breakpoint
CREATE INDEX "district_name_idx" ON "district" USING btree ("name");--> statement-breakpoint
CREATE INDEX "district_snapshot_period_start_idx" ON "district_period_consumption_snapshot" USING btree ("district_id","period_start");--> statement-breakpoint
CREATE INDEX "district_snapshot_effective_state_computed_at_idx" ON "district_period_consumption_snapshot" USING btree ("effective_state","computed_at");--> statement-breakpoint
CREATE INDEX "email_audit_log_user_idx" ON "email_audit_log" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX "email_audit_log_type_idx" ON "email_audit_log" USING btree ("email_type");--> statement-breakpoint
CREATE INDEX "email_audit_log_status_idx" ON "email_audit_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_audit_log_provider_message_id_idx" ON "email_audit_log" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "email_audit_log_sent_at_idx" ON "email_audit_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "farm_owner_idx" ON "farm" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "farm_farmer_idx" ON "farm" USING btree ("farmer_user_id");--> statement-breakpoint
CREATE INDEX "farm_district_idx" ON "farm" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "farm_status_idx" ON "farm" USING btree ("status");--> statement-breakpoint
CREATE INDEX "farm_snapshot_farm_period_start_idx" ON "farm_period_consumption_snapshot" USING btree ("farm_id","period_start");--> statement-breakpoint
CREATE INDEX "farm_snapshot_district_period_start_idx" ON "farm_period_consumption_snapshot" USING btree ("district_id","period_start");--> statement-breakpoint
CREATE INDEX "farm_snapshot_effective_state_computed_at_idx" ON "farm_period_consumption_snapshot" USING btree ("effective_state","computed_at");--> statement-breakpoint
CREATE INDEX "farm_well_farm_idx" ON "farm_well" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "farm_well_well_idx" ON "farm_well" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "growth_stage_lookup_stage_idx" ON "growth_stage_lookup" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "irrigation_event_farm_created_idx" ON "irrigation_event" USING btree ("farm_id","created_at");--> statement-breakpoint
CREATE INDEX "irrigation_event_status_idx" ON "irrigation_event" USING btree ("status");--> statement-breakpoint
CREATE INDEX "irrigation_event_triggered_by_idx" ON "irrigation_event" USING btree ("triggered_by_user_id");--> statement-breakpoint
CREATE INDEX "irrigation_rec_farm_created_idx" ON "irrigation_recommendation" USING btree ("farm_id","created_at");--> statement-breakpoint
CREATE INDEX "irrigation_rec_status_idx" ON "irrigation_recommendation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "irrigation_rec_requested_by_idx" ON "irrigation_recommendation" USING btree ("requested_by");--> statement-breakpoint
CREATE INDEX "irrigation_session_farm_plan_idx" ON "irrigation_session" USING btree ("farm_id","plan_id");--> statement-breakpoint
CREATE INDEX "irrigation_session_updated_at_idx" ON "irrigation_session" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_event_idx" ON "irrigation_simulation_run" USING btree ("irrigation_event_id");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_event_primary_idx" ON "irrigation_simulation_run" USING btree ("irrigation_event_id","is_primary");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_status_created_idx" ON "irrigation_simulation_run" USING btree ("run_status","created_at");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_hydrology_version_idx" ON "irrigation_simulation_run" USING btree ("hydrology_model_version");--> statement-breakpoint
CREATE INDEX "irrigation_sim_run_model_mode_idx" ON "irrigation_simulation_run" USING btree ("model_mode");--> statement-breakpoint
CREATE INDEX "latest_sensor_state_well_id_idx" ON "latest_sensor_state" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "latest_sensor_state_type_idx" ON "latest_sensor_state" USING btree ("type");--> statement-breakpoint
CREATE INDEX "outbox_event_status_created_idx" ON "outbox_event" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "outbox_event_next_retry_idx" ON "outbox_event" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "quota_breach_scope_period_start_idx" ON "quota_breach_event" USING btree ("scope_type","period_start","period_type");--> statement-breakpoint
CREATE INDEX "quota_breach_farm_idx" ON "quota_breach_event" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "quota_breach_district_idx" ON "quota_breach_event" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "quota_breach_status_triggered_at_idx" ON "quota_breach_event" USING btree ("status","triggered_at");--> statement-breakpoint
CREATE INDEX "quota_override_scope_status_start_idx" ON "quota_override" USING btree ("scope_type","status","start_at");--> statement-breakpoint
CREATE INDEX "quota_override_farm_idx" ON "quota_override" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "quota_override_district_idx" ON "quota_override" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "quota_override_approved_by_idx" ON "quota_override" USING btree ("approved_by_user_id");--> statement-breakpoint
CREATE INDEX "report_artifact_job_format_idx" ON "report_artifact" USING btree ("report_job_id","format");--> statement-breakpoint
CREATE INDEX "report_artifact_status_idx" ON "report_artifact" USING btree ("status");--> statement-breakpoint
CREATE INDEX "report_artifact_expires_idx" ON "report_artifact" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "report_audit_log_job_idx" ON "report_audit_log" USING btree ("report_job_id");--> statement-breakpoint
CREATE INDEX "report_audit_log_action_idx" ON "report_audit_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX "report_audit_log_actor_idx" ON "report_audit_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "report_audit_log_created_idx" ON "report_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "report_job_status_created_idx" ON "report_job" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "report_job_requested_by_created_idx" ON "report_job" USING btree ("requested_by","created_at");--> statement-breakpoint
CREATE INDEX "report_job_scope_idx" ON "report_job" USING btree ("scope_type","scope_district_id","scope_farm_id");--> statement-breakpoint
CREATE INDEX "role_type_idx" ON "role" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sensor_data_sensor_id_idx" ON "sensor_data" USING btree ("sensor_id");--> statement-breakpoint
CREATE INDEX "sensor_data_timestamp_idx" ON "sensor_data" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "sensor_data_sim_source_sensor_ts_idx" ON "sensor_data_simulation" USING btree ("source","sensor_id","timestamp");--> statement-breakpoint
CREATE INDEX "sensor_data_sim_run_ts_idx" ON "sensor_data_simulation" USING btree ("simulation_run_id","timestamp");--> statement-breakpoint
CREATE INDEX "sensor_data_sim_event_ts_idx" ON "sensor_data_simulation" USING btree ("irrigation_event_id","timestamp");--> statement-breakpoint
CREATE INDEX "sensors_well_id_idx" ON "sensors" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "sensors_type_idx" ON "sensors" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sensors_is_active_idx" ON "sensors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
CREATE INDEX "user_invitation_token_hash_idx" ON "user_invitation" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_invitation_user_id_idx" ON "user_invitation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_invitation_status_idx" ON "user_invitation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_invitation_expires_at_idx" ON "user_invitation" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "user_invitation_type_status_idx" ON "user_invitation" USING btree ("token_type","status");--> statement-breakpoint
CREATE INDEX "user_notification_pref_opt_out_idx" ON "user_notification_preference" USING btree ("email_opt_out");--> statement-breakpoint
CREATE INDEX "user_profile_national_id_idx" ON "user_profile" USING btree ("national_id");--> statement-breakpoint
CREATE INDEX "user_profile_district_id_idx" ON "user_profile" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "user_profile_is_active_idx" ON "user_profile" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_role_assignment_user_idx" ON "user_role_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_role_assignment_role_idx" ON "user_role_assignment" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "well_district_id_idx" ON "well" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "well_status_idx" ON "well" USING btree ("status");--> statement-breakpoint
CREATE INDEX "well_location_idx" ON "well" USING btree ("latitude","longitude");--> statement-breakpoint
CREATE INDEX "well_status_history_well_idx" ON "well_status_history" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "well_status_history_changed_at_idx" ON "well_status_history" USING btree ("changed_at");--> statement-breakpoint
CREATE INDEX "well_valve_state_event_transitioned_idx" ON "well_valve_state" USING btree ("irrigation_event_id","transitioned_at");--> statement-breakpoint
CREATE INDEX "well_valve_state_well_transitioned_idx" ON "well_valve_state" USING btree ("well_id","transitioned_at");