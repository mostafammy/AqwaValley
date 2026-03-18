CREATE TYPE "public"."alert_rule_operator" AS ENUM('gt', 'lt', 'gte', 'lte', 'eq');--> statement-breakpoint
CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('threshold_breach', 'anomaly', 'sensor_offline');--> statement-breakpoint
CREATE TYPE "public"."crop_type" AS ENUM('wheat', 'rice', 'corn', 'cotton', 'sugarcane', 'vegetables', 'fruits', 'other');--> statement-breakpoint
CREATE TYPE "public"."farm_status" AS ENUM('active', 'inactive', 'suspended', 'archived');--> statement-breakpoint
CREATE TYPE "public"."growth_stage" AS ENUM('germination', 'vegetative', 'flowering', 'fruiting', 'maturity', 'harvest');--> statement-breakpoint
CREATE TYPE "public"."role_type" AS ENUM('admin', 'district_manager', 'farm_owner', 'farmer', 'auditor');--> statement-breakpoint
CREATE TYPE "public"."sensor_type" AS ENUM('water_level', 'pressure', 'flow_rate', 'temperature', 'humidity');--> statement-breakpoint
CREATE TYPE "public"."sensor_unit" AS ENUM('meters', 'bar', 'celsius', 'm3_per_hour', 'percent');--> statement-breakpoint
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
CREATE TABLE "crop_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"crop_type" "crop_type" NOT NULL,
	"growth_stage" "growth_stage" NOT NULL,
	"target_soil_moisture_pct" numeric(5, 2),
	"planted_date" timestamp with time zone,
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
CREATE TABLE "latest_sensor_state" (
	"sensor_id" uuid PRIMARY KEY NOT NULL,
	"well_id" uuid NOT NULL,
	"value" double precision NOT NULL,
	"unit" "sensor_unit" NOT NULL,
	"type" "sensor_type" NOT NULL,
	"last_updated_at" timestamp with time zone NOT NULL
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
	"timestamp" timestamp with time zone NOT NULL
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
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD CONSTRAINT "alert_rule_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_alert_rule_id_alert_rule_id_fk" FOREIGN KEY ("alert_rule_id") REFERENCES "public"."alert_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_user_id_user_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_history" ADD CONSTRAINT "crop_history_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crop_profile" ADD CONSTRAINT "crop_profile_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm" ADD CONSTRAINT "farm_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm" ADD CONSTRAINT "farm_farmer_user_id_user_id_fk" FOREIGN KEY ("farmer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm" ADD CONSTRAINT "farm_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_well" ADD CONSTRAINT "farm_well_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "farm_well" ADD CONSTRAINT "farm_well_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "latest_sensor_state" ADD CONSTRAINT "latest_sensor_state_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "latest_sensor_state" ADD CONSTRAINT "latest_sensor_state_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_sensor_id_sensors_id_fk" FOREIGN KEY ("sensor_id") REFERENCES "public"."sensors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role_assignment" ADD CONSTRAINT "user_role_assignment_assigned_by_user_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well" ADD CONSTRAINT "well_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_district_id_district_id_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_status_history" ADD CONSTRAINT "well_status_history_well_id_well_id_fk" FOREIGN KEY ("well_id") REFERENCES "public"."well"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "well_status_history" ADD CONSTRAINT "well_status_history_changed_by_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
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
CREATE INDEX "crop_history_farm_idx" ON "crop_history" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "crop_history_recorded_at_idx" ON "crop_history" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "crop_profile_farm_idx" ON "crop_profile" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "crop_profile_crop_type_idx" ON "crop_profile" USING btree ("crop_type");--> statement-breakpoint
CREATE INDEX "crop_type_lookup_type_idx" ON "crop_type_lookup" USING btree ("type");--> statement-breakpoint
CREATE INDEX "district_name_idx" ON "district" USING btree ("name");--> statement-breakpoint
CREATE INDEX "farm_owner_idx" ON "farm" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "farm_farmer_idx" ON "farm" USING btree ("farmer_user_id");--> statement-breakpoint
CREATE INDEX "farm_district_idx" ON "farm" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "farm_status_idx" ON "farm" USING btree ("status");--> statement-breakpoint
CREATE INDEX "farm_well_farm_idx" ON "farm_well" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "farm_well_well_idx" ON "farm_well" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "growth_stage_lookup_stage_idx" ON "growth_stage_lookup" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "latest_sensor_state_well_id_idx" ON "latest_sensor_state" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "latest_sensor_state_type_idx" ON "latest_sensor_state" USING btree ("type");--> statement-breakpoint
CREATE INDEX "role_type_idx" ON "role" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sensor_data_sensor_id_idx" ON "sensor_data" USING btree ("sensor_id");--> statement-breakpoint
CREATE INDEX "sensor_data_timestamp_idx" ON "sensor_data" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "sensor_data_sensor_timestamp_idx" ON "sensor_data" USING btree ("sensor_id","timestamp");--> statement-breakpoint
CREATE INDEX "sensors_well_id_idx" ON "sensors" USING btree ("well_id");--> statement-breakpoint
CREATE INDEX "sensors_type_idx" ON "sensors" USING btree ("type");--> statement-breakpoint
CREATE INDEX "sensors_is_active_idx" ON "sensors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_email_idx" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_username_idx" ON "user" USING btree ("username");--> statement-breakpoint
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
CREATE INDEX "well_status_history_changed_at_idx" ON "well_status_history" USING btree ("changed_at");