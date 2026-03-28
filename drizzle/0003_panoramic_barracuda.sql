CREATE TYPE "public"."recommendation_status" AS ENUM('PENDING', 'ACTIVATED', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
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
ALTER TABLE "irrigation_recommendation" ADD CONSTRAINT "irrigation_recommendation_farm_id_farm_id_fk" FOREIGN KEY ("farm_id") REFERENCES "public"."farm"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "irrigation_recommendation" ADD CONSTRAINT "irrigation_recommendation_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "irrigation_rec_farm_created_idx" ON "irrigation_recommendation" USING btree ("farm_id","created_at");--> statement-breakpoint
CREATE INDEX "irrigation_rec_status_idx" ON "irrigation_recommendation" USING btree ("status");--> statement-breakpoint
CREATE INDEX "irrigation_rec_requested_by_idx" ON "irrigation_recommendation" USING btree ("requested_by");