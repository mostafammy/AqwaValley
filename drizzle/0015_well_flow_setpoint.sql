ALTER TABLE "pg-drizzle_well"
ADD COLUMN IF NOT EXISTS "target_flow_rate_m3_hr" numeric(12, 2);
