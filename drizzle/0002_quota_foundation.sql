DO $$ BEGIN
 CREATE TYPE "quota_period_type" AS ENUM('daily', 'monthly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "quota_state" AS ENUM('ok', 'warning', 'critical', 'exceeded', 'needs_review');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "quota_trend_direction" AS ENUM('increase', 'decrease', 'flat');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "quota_scope_type" AS ENUM('farm', 'district');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "quota_breach_status" AS ENUM('open', 'resolved');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "quota_override_status" AS ENUM('active', 'revoked', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "cron_simulation_run" ADD COLUMN IF NOT EXISTS "attempt_token" text;
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
	CONSTRAINT "farm_snapshot_unique" UNIQUE("farm_id","period_type","period_start"),
	CONSTRAINT "farm_snapshot_non_negative_check" CHECK ((quota_m3 >= 0) AND (consumption_m3 >= 0) AND (utilization_pct >= 0))
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
	CONSTRAINT "district_snapshot_unique" UNIQUE("district_id","period_type","period_start"),
	CONSTRAINT "district_snapshot_non_negative_check" CHECK ((quota_m3 >= 0) AND (consumption_m3 >= 0) AND (utilization_pct >= 0))
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quota_breach_scope_farm_check" CHECK (((scope_type = 'farm') AND (farm_id IS NOT NULL)) OR ((scope_type = 'district') AND (farm_id IS NULL)))
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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quota_override_scope_farm_check" CHECK (((scope_type = 'farm') AND (farm_id IS NOT NULL)) OR ((scope_type = 'district') AND (farm_id IS NULL))),
	CONSTRAINT "quota_override_window_check" CHECK (end_at > start_at)
);
--> statement-breakpoint
ALTER TABLE "farm_period_consumption_snapshot" ADD CONSTRAINT "farm_snapshot_farm_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "farm_period_consumption_snapshot" ADD CONSTRAINT "farm_snapshot_district_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "district_period_consumption_snapshot" ADD CONSTRAINT "district_snapshot_district_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_breach_event" ADD CONSTRAINT "quota_breach_farm_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_breach_event" ADD CONSTRAINT "quota_breach_district_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_breach_event" ADD CONSTRAINT "quota_breach_resolved_by_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_farm_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_district_fk" FOREIGN KEY ("district_id") REFERENCES "public"."district"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_approved_by_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quota_override" ADD CONSTRAINT "quota_override_revoked_by_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "farm_snapshot_farm_period_start_idx" ON "farm_period_consumption_snapshot" USING btree ("farm_id","period_start");--> statement-breakpoint
CREATE INDEX "farm_snapshot_district_period_start_idx" ON "farm_period_consumption_snapshot" USING btree ("district_id","period_start");--> statement-breakpoint
CREATE INDEX "farm_snapshot_effective_state_computed_at_idx" ON "farm_period_consumption_snapshot" USING btree ("effective_state","computed_at");--> statement-breakpoint
CREATE INDEX "district_snapshot_period_start_idx" ON "district_period_consumption_snapshot" USING btree ("district_id","period_start");--> statement-breakpoint
CREATE INDEX "district_snapshot_effective_state_computed_at_idx" ON "district_period_consumption_snapshot" USING btree ("effective_state","computed_at");--> statement-breakpoint
CREATE INDEX "quota_breach_scope_period_start_idx" ON "quota_breach_event" USING btree ("scope_type","period_start","period_type");--> statement-breakpoint
CREATE INDEX "quota_breach_farm_idx" ON "quota_breach_event" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "quota_breach_district_idx" ON "quota_breach_event" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "quota_breach_status_triggered_at_idx" ON "quota_breach_event" USING btree ("status","triggered_at");--> statement-breakpoint
CREATE INDEX "quota_override_scope_status_start_idx" ON "quota_override" USING btree ("scope_type","status","start_at");--> statement-breakpoint
CREATE INDEX "quota_override_farm_idx" ON "quota_override" USING btree ("farm_id");--> statement-breakpoint
CREATE INDEX "quota_override_district_idx" ON "quota_override" USING btree ("district_id");--> statement-breakpoint
CREATE INDEX "quota_override_approved_by_idx" ON "quota_override" USING btree ("approved_by_user_id");