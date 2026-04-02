CREATE TABLE "irrigation_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"farm_id" uuid NOT NULL,
	"plan_id" uuid,
	"frame_count" integer DEFAULT 0 NOT NULL,
	"liters_pumped" numeric(15, 4) DEFAULT '0' NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"running" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "irrigation_session_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "farm"("id") ON DELETE cascade,
	CONSTRAINT "irrigation_session_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "irrigation_recommendation"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "irrigation_session_farm_plan_idx" ON "irrigation_session" USING btree ("farm_id","plan_id");--> statement-breakpoint
CREATE INDEX "irrigation_session_updated_at_idx" ON "irrigation_session" USING btree ("updated_at");--> statement-breakpoint
