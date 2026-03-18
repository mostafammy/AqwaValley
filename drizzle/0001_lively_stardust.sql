CREATE TABLE "cron_simulation_run" (
	"run_key" text PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"response" jsonb,
	"error" text
);
--> statement-breakpoint
CREATE INDEX "cron_simulation_run_status_started_idx" ON "cron_simulation_run" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "cron_simulation_run_started_idx" ON "cron_simulation_run" USING btree ("started_at");