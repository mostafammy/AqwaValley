CREATE OR REPLACE VIEW "aquifer_eligible_model" AS
SELECT
  m.*
FROM "aquifer_linear_regression_model" m
WHERE m."approval_state" = 'approved'
  AND (m."approval_expires_at" IS NULL OR m."approval_expires_at" > now());--> statement-breakpoint
