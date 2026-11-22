-- CareOS relational triggers for timestamps and audit-friendliness.
-- Apply after schema.sql.

CREATE OR REPLACE FUNCTION careos_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tables that carry an updated_at column in extended deployments.
DO $$
DECLARE
  target TEXT;
BEGIN
  FOREACH target IN ARRAY ARRAY['hospitals', 'users', 'patients', 'appointments', 'radiology_orders', 'bills', 'workflows']
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = target AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I; CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION careos_set_updated_at()',
        target, target, target, target
      );
    END IF;
  END LOOP;
END;
$$;

-- Prevent negative resource counts.
CREATE OR REPLACE FUNCTION careos_check_resource_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.total < 0 OR NEW.available < 0 OR NEW.in_use < 0 OR NEW.maintenance < 0 THEN
    RAISE EXCEPTION 'Resource counts cannot be negative';
  END IF;
  IF NEW.available + NEW.in_use + NEW.maintenance > NEW.total THEN
    RAISE EXCEPTION 'Resource allocation exceeds total capacity for %', NEW.name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_resources_counts ON resources;
CREATE TRIGGER trg_resources_counts
BEFORE INSERT OR UPDATE ON resources
FOR EACH ROW EXECUTE FUNCTION careos_check_resource_counts();

-- Audit helper used by state-change triggers.
CREATE OR REPLACE FUNCTION careos_append_audit(actor TEXT, resource_table TEXT, resource_id TEXT, action_name TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO audit_logs (id, timestamp, actor_email, actor_role, action, resource, outcome)
  VALUES (
    'audit-' || gen_random_uuid()::text,
    now(),
    COALESCE(NULLIF(actor, ''), 'system@careos.local'),
    'system',
    action_name,
    resource_table || ':' || resource_id,
    'Allowed'
  );
END;
$$ LANGUAGE plpgsql;

-- Automatically append an audit event for state changes.
CREATE OR REPLACE FUNCTION careos_audit_state_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM careos_append_audit(current_setting('careos.actor_email', true), TG_TABLE_NAME, OLD.id::text, 'DELETE');
    RETURN OLD;
  END IF;
  PERFORM careos_append_audit(current_setting('careos.actor_email', true), TG_TABLE_NAME, NEW.id::text, TG_OP);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Keep the denormalized report-section counter accurate.
CREATE OR REPLACE FUNCTION careos_refresh_report_section_count()
RETURNS TRIGGER AS $$
DECLARE
  target_id TEXT;
BEGIN
  target_id := COALESCE(NEW.workflow_id, OLD.workflow_id);
  UPDATE workflow_executions
  SET report_sections_count = (
    SELECT COUNT(*) FROM report_sections WHERE workflow_id = target_id
  )
  WHERE id = target_id;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_report_sections_count ON report_sections;
CREATE TRIGGER trg_report_sections_count
AFTER INSERT OR UPDATE OR DELETE ON report_sections
FOR EACH ROW EXECUTE FUNCTION careos_refresh_report_section_count();

-- Audit financially and clinically significant state changes.
DROP TRIGGER IF EXISTS trg_bills_audit ON bills;
CREATE TRIGGER trg_bills_audit
AFTER INSERT OR UPDATE OR DELETE ON bills
FOR EACH ROW EXECUTE FUNCTION careos_audit_state_change();

DROP TRIGGER IF EXISTS trg_radiology_orders_audit ON radiology_orders;
CREATE TRIGGER trg_radiology_orders_audit
AFTER INSERT OR UPDATE OR DELETE ON radiology_orders
FOR EACH ROW EXECUTE FUNCTION careos_audit_state_change();

DROP TRIGGER IF EXISTS trg_workflow_executions_audit ON workflow_executions;
CREATE TRIGGER trg_workflow_executions_audit
AFTER INSERT OR UPDATE OR DELETE ON workflow_executions
FOR EACH ROW EXECUTE FUNCTION careos_audit_state_change();

