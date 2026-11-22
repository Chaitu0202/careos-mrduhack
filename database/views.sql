-- CareOS analytical views for dashboards and compliance review.
-- Apply after schema.sql.

CREATE OR REPLACE VIEW vw_patient_flow AS
SELECT
    a.id AS appointment_id,
    a.patient_name,
    a.mrn,
    a.department,
    a.doctor_name,
    a.date,
    a.time,
    a.status,
    a.waiting_minutes,
    CASE
        WHEN a.waiting_minutes >= 45 THEN 'Critical'
        WHEN a.waiting_minutes >= 25 THEN 'High'
        WHEN a.waiting_minutes >= 10 THEN 'Moderate'
        ELSE 'Normal'
    END AS wait_band,
    p.admission_status,
    p.attending_doctor,
    r.id AS radiology_order_id,
    r.status AS radiology_status,
    b.id AS bill_id,
    b.status AS bill_status,
    b.amount AS bill_amount
FROM appointments a
JOIN patients p ON p.id = a.patient_id
LEFT JOIN radiology_orders r ON r.appointment_id = a.id
LEFT JOIN bills b ON b.patient_id = a.patient_id
WHERE a.status <> 'Cancelled';

CREATE OR REPLACE VIEW vw_department_load AS
SELECT
    d.id,
    d.name,
    d.head,
    d.status,
    d.active_patients,
    d.staff_on_duty,
    d.total_staff,
    d.bed_capacity,
    d.occupied_beds,
    CASE WHEN d.bed_capacity = 0 THEN 0
         ELSE ROUND((d.occupied_beds::numeric / d.bed_capacity) * 100, 2)
    END AS occupancy_percent,
    d.avg_wait_minutes,
    COUNT(DISTINCT a.id) AS scheduled_appointments,
    COUNT(DISTINCT o.id) AS open_radiology_orders
FROM departments d
LEFT JOIN appointments a ON a.department = d.name AND a.status <> 'Cancelled'
LEFT JOIN radiology_orders o ON o.department = d.name AND o.status <> 'Completed'
GROUP BY d.id, d.name, d.head, d.status, d.active_patients, d.staff_on_duty,
         d.total_staff, d.bed_capacity, d.occupied_beds, d.avg_wait_minutes;

CREATE OR REPLACE VIEW vw_agent_workforce AS
SELECT
    ag.id,
    ag.name,
    ag.short_name,
    ag.category,
    ag.status,
    ag.assigned_tasks,
    ag.completed_tasks,
    ag.pending_tasks,
    ag.avg_response_seconds,
    CASE WHEN ag.assigned_tasks = 0 THEN 0
         ELSE ROUND((ag.completed_tasks::numeric / ag.assigned_tasks) * 100, 2)
    END AS success_rate,
    COUNT(aa.id) AS activity_entries
FROM agents ag
LEFT JOIN agent_activity aa ON aa.agent_id = ag.id
GROUP BY ag.id, ag.name, ag.short_name, ag.category, ag.status,
         ag.assigned_tasks, ag.completed_tasks, ag.pending_tasks, ag.avg_response_seconds;

CREATE OR REPLACE VIEW vw_workflow_audit AS
SELECT
    we.id,
    we.workflow_code,
    we.instruction,
    we.status,
    we.executed_at,
    we.execution_ms,
    we.voice_confirmation,
    we.executive_brief,
    COUNT(DISTINCT iam.id) AS inter_agent_messages,
    COUNT(DISTINCT da.id) AS departmental_alerts,
    COUNT(DISTINCT pa.id) AS pending_approvals,
    COUNT(DISTINCT pa.id) FILTER (WHERE pa.approved = FALSE) AS open_approvals,
    COUNT(DISTINCT rs.id) AS report_sections
FROM workflow_executions we
LEFT JOIN inter_agent_messages iam ON iam.workflow_id = we.id
LEFT JOIN departmental_alerts da ON da.workflow_id = we.id
LEFT JOIN pending_approvals pa ON pa.workflow_id = we.id
LEFT JOIN report_sections rs ON rs.workflow_id = we.id
GROUP BY we.id, we.workflow_code, we.instruction, we.status, we.executed_at,
         we.execution_ms, we.voice_confirmation, we.executive_brief;

CREATE OR REPLACE VIEW vw_revenue_cycle AS
SELECT
    b.id AS bill_id,
    b.patient_name,
    b.mrn,
    b.description,
    b.amount,
    b.currency,
    b.status,
    b.created_at,
    r.exam_type,
    r.department AS radiology_department,
    CASE WHEN LOWER(b.status) = 'paid' THEN b.amount ELSE 0 END AS collected_amount,
    CASE WHEN LOWER(b.status) IN ('pending', 'overdue') THEN b.amount ELSE 0 END AS outstanding_amount
FROM bills b
LEFT JOIN radiology_orders r ON r.id = b.order_id;

CREATE OR REPLACE VIEW vw_module_operations AS
SELECT
    module,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE LOWER(status) = 'completed') AS completed,
    COUNT(*) FILTER (WHERE LOWER(status) = 'flagged') AS flagged,
    COUNT(*) FILTER (WHERE LOWER(status) IN ('pending review', 'active')) AS active_or_pending,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE LOWER(status) = 'completed') / NULLIF(COUNT(*), 0),
        2
    ) AS completion_rate
FROM module_records
GROUP BY module
ORDER BY module;

CREATE OR REPLACE VIEW vw_platform_health AS
SELECT
    (SELECT COUNT(*) FROM hospitals WHERE workspace_status = 'Active') AS active_hospitals,
    (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_users,
    (SELECT COUNT(*) FROM patients) AS total_patients,
    (SELECT COUNT(*) FROM appointments WHERE status <> 'Cancelled') AS active_appointments,
    (SELECT COALESCE(SUM(amount), 0) FROM bills) AS billed_total,
    (SELECT COALESCE(SUM(amount), 0) FROM bills WHERE LOWER(status) = 'paid') AS collected_total,
    (SELECT COUNT(*) FROM workflow_executions WHERE status = 'Awaiting Approval') AS workflows_awaiting_approval,
    (SELECT COUNT(*) FROM audit_logs WHERE outcome = 'Denied') AS denied_events;
