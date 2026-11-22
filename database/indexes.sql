-- CareOS performance indexes. Apply after schema.sql and views.sql.

CREATE INDEX IF NOT EXISTS idx_users_hospital_id ON users (hospital_id);
CREATE INDEX IF NOT EXISTS idx_users_role_status ON users (role, status);
CREATE INDEX IF NOT EXISTS idx_users_patient_id ON users (patient_id);

CREATE INDEX IF NOT EXISTS idx_patients_department ON patients (department);
CREATE INDEX IF NOT EXISTS idx_patients_attending ON patients (attending_doctor);
CREATE INDEX IF NOT EXISTS idx_patients_admission ON patients (admission_status);
CREATE INDEX IF NOT EXISTS idx_patients_portal_username ON patients (portal_username);

CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments (patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments (date DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_department_status ON appointments (department, status);
CREATE INDEX IF NOT EXISTS idx_appointments_waiting ON appointments (waiting_minutes DESC);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments (doctor_name);

CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON prescriptions (appointment_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions (patient_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_created ON prescriptions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_radiology_appointment ON radiology_orders (appointment_id);
CREATE INDEX IF NOT EXISTS idx_radiology_patient ON radiology_orders (patient_id);
CREATE INDEX IF NOT EXISTS idx_radiology_status_priority ON radiology_orders (status, priority);
CREATE INDEX IF NOT EXISTS idx_radiology_created ON radiology_orders (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bills_patient ON bills (patient_id);
CREATE INDEX IF NOT EXISTS idx_bills_order ON bills (order_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills (status);
CREATE INDEX IF NOT EXISTS idx_bills_created ON bills (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_patient ON notifications (patient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_outcome ON audit_logs (outcome);

CREATE INDEX IF NOT EXISTS idx_agent_activity_agent ON agent_activity (agent_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_activity_outcome ON agent_activity (outcome);
CREATE INDEX IF NOT EXISTS idx_workflows_active ON workflows (active);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_time ON workflow_executions (executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions (status);

CREATE INDEX IF NOT EXISTS idx_inter_agent_messages_workflow ON inter_agent_messages (workflow_id, step);
CREATE INDEX IF NOT EXISTS idx_departmental_alerts_workflow ON departmental_alerts (workflow_id);
CREATE INDEX IF NOT EXISTS idx_departmental_alerts_department ON departmental_alerts (department);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_open ON pending_approvals (workflow_id, approved);
CREATE INDEX IF NOT EXISTS idx_report_sections_workflow ON report_sections (workflow_id, section_order);
CREATE INDEX IF NOT EXISTS idx_report_section_items_section ON report_section_items (section_id);

CREATE INDEX IF NOT EXISTS idx_module_records_module_status ON module_records (module, status);
CREATE INDEX IF NOT EXISTS idx_platform_activity_time ON platform_activity (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_resources_department ON resources (department);

ANALYZE users;
ANALYZE patients;
ANALYZE appointments;
ANALYZE radiology_orders;
ANALYZE bills;
ANALYZE workflow_executions;
ANALYZE module_records;
