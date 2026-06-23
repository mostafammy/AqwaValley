-- Audit logs are append-only and cannot be modified or deleted
-- This migration creates triggers to enforce immutability

CREATE OR REPLACE FUNCTION prevent_append_only_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit logs are append-only and cannot be %, operation not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Prevent UPDATE and DELETE on audit_log table
CREATE TRIGGER audit_log_block_mutations
BEFORE UPDATE OR DELETE ON "audit_log"
FOR EACH ROW
EXECUTE FUNCTION prevent_append_only_audit_mutation();

-- Prevent UPDATE and DELETE on report_audit_log table
CREATE TRIGGER report_audit_log_block_mutations
BEFORE UPDATE OR DELETE ON "report_audit_log"
FOR EACH ROW
EXECUTE FUNCTION prevent_append_only_audit_mutation();
