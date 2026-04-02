CREATE TABLE IF NOT EXISTS "user_notification_preference" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "email_opt_out" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_notification_pref_opt_out_idx"
  ON "user_notification_preference" ("email_opt_out");
