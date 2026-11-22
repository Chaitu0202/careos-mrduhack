-- CareOS row-level security policies for PostgreSQL.
-- Apply after schema.sql. Preview mode does not set the session GUCs below, so
-- policies only take effect when an application role sets them per request.
--
--   SET LOCAL careos.actor_role = 'admin';       -- or hospital/clinician/patient
--   SET LOCAL careos.hospital_id = 'HSP-00001';
--   SET LOCAL careos.actor_email = 'user@example.com';
--
-- The Express API should wrap each request in a transaction and set these via
-- a parameterized SET LOCAL, never by string concatenation.

BEGIN;

CREATE OR REPLACE FUNCTION careos_current_role()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('careos.actor_role', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION careos_current_hospital()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('careos.hospital_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION careos_is_platform_admin()
RETURNS BOOLEAN AS $$
  SELECT careos_current_role() IN ('admin', 'super_admin', 'compliance');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION careos_can_view_patient(target_patient_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT careos_is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.patient_id = target_patient_id
        AND u.hospital_id = careos_current_hospital()
    )
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.email = NULLIF(current_setting('careos.actor_email', true), '')
        AND u.hospital_id = careos_current_hospital()
        AND u.role IN ('coordinator', 'clinician', 'operator')
    );
$$ LANGUAGE sql STABLE;

ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hospitals_tenant_isolation ON hospitals;
CREATE POLICY hospitals_tenant_isolation ON hospitals
FOR SELECT USING (
  careos_is_platform_admin() OR hospital_id = careos_current_hospital()
);

DROP POLICY IF EXISTS patients_tenant_isolation ON patients;
CREATE POLICY patients_tenant_isolation ON patients
FOR SELECT USING (careos_can_view_patient(id));

DROP POLICY IF EXISTS patients_write_admin ON patients;
CREATE POLICY patients_write_admin ON patients
FOR ALL USING (careos_is_platform_admin())
WITH CHECK (careos_is_platform_admin());

DROP POLICY IF EXISTS appointments_tenant_isolation ON appointments;
CREATE POLICY appointments_tenant_isolation ON appointments
FOR SELECT USING (careos_can_view_patient(patient_id));

DROP POLICY IF EXISTS prescriptions_tenant_isolation ON prescriptions;
CREATE POLICY prescriptions_tenant_isolation ON prescriptions
FOR SELECT USING (careos_can_view_patient(patient_id));

DROP POLICY IF EXISTS radiology_orders_tenant_isolation ON radiology_orders;
CREATE POLICY radiology_orders_tenant_isolation ON radiology_orders
FOR SELECT USING (careos_can_view_patient(patient_id));

DROP POLICY IF EXISTS bills_tenant_isolation ON bills;
CREATE POLICY bills_tenant_isolation ON bills
FOR SELECT USING (careos_can_view_patient(patient_id));

DROP POLICY IF EXISTS audit_logs_governance_only ON audit_logs;
CREATE POLICY audit_logs_governance_only ON audit_logs
FOR SELECT USING (
  careos_current_role() IN ('admin', 'super_admin', 'compliance')
);

DROP POLICY IF EXISTS workflow_executions_governance_only ON workflow_executions;
CREATE POLICY workflow_executions_governance_only ON workflow_executions
FOR SELECT USING (
  careos_current_role() IN ('admin', 'super_admin', 'compliance', 'operator')
);

-- Service-role writes bypass RLS by connecting as the table owner or by
-- setting BYPASSRLS on the dedicated migration role. Application writes use
-- the WITH CHECK policies above.

COMMIT;
