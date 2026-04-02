CREATE OR REPLACE FUNCTION prevent_append_only_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit logs are append-only and cannot be %', TG_OP
    USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_block_mutations ON "audit_log";
CREATE TRIGGER audit_log_block_mutations
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_append_only_audit_mutation();

DROP TRIGGER IF EXISTS report_audit_log_block_mutations ON "report_audit_log";
CREATE TRIGGER report_audit_log_block_mutations
  BEFORE UPDATE OR DELETE ON "report_audit_log"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_append_only_audit_mutation();
