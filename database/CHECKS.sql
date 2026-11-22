-- CareOS post-migration assertion queries.
-- Each query should return zero rows. Run with psql -v ON_ERROR_STOP=1.

-- 1. Duplicate identifiers in core tables.
SELECT 'users' AS table_name, id, COUNT(*) AS occurrences
FROM users GROUP BY id HAVING COUNT(*) > 1
UNION ALL
SELECT 'patients', id, COUNT(*) FROM patients GROUP BY id HAVING COUNT(*) > 1
UNION ALL
SELECT 'appointments', id, COUNT(*) FROM appointments GROUP BY id HAVING COUNT(*) > 1
UNION ALL
SELECT 'agents', id, COUNT(*) FROM agents GROUP BY id HAVING COUNT(*) > 1;

-- 2. Appointments without a patient.
SELECT a.id, a.patient_name
FROM appointments a
LEFT JOIN patients p ON p.id = a.patient_id
WHERE p.id IS NULL;

-- 3. Prescriptions without an appointment or patient.
SELECT pr.id
FROM prescriptions pr
LEFT JOIN appointments a ON a.id = pr.appointment_id
LEFT JOIN patients p ON p.id = pr.patient_id
WHERE a.id IS NULL OR p.id IS NULL;

-- 4. Radiology orders without an appointment.
SELECT r.id
FROM radiology_orders r
LEFT JOIN appointments a ON a.id = r.appointment_id
WHERE a.id IS NULL;

-- 5. Completed radiology orders without a report body.
SELECT r.id, r.patient_name
FROM radiology_orders r
WHERE LOWER(r.status) = 'completed'
  AND (NULLIF(r.report_findings, '') IS NULL OR NULLIF(r.report_impression, '') IS NULL);

-- 6. Bills that do not match the source order amount.
SELECT b.id, b.amount, r.id AS order_id
FROM bills b
JOIN radiology_orders r ON r.id = b.order_id
WHERE b.amount <> 150;

-- 7. Non-positive invoice amounts.
SELECT id, amount FROM bills WHERE amount <= 0;

-- 8. Workflow executions without inter-agent traces.
SELECT we.id, we.workflow_code
FROM workflow_executions we
LEFT JOIN inter_agent_messages iam ON iam.workflow_id = we.id
WHERE iam.id IS NULL;

-- 9. Workflow executions without a voice confirmation.
SELECT id, workflow_code FROM workflow_executions WHERE NULLIF(voice_confirmation, '') IS NULL;

-- 10. Open approvals on completed workflows.
SELECT we.id, we.workflow_code, pa.id AS approval_id
FROM workflow_executions we
JOIN pending_approvals pa ON pa.workflow_id = we.id
WHERE we.status = 'Completed' AND pa.approved = FALSE;

-- 11. Agents with zero assigned task count.
SELECT id, name FROM agents WHERE assigned_tasks <= 0;

-- 12. Departments with occupancy above capacity.
SELECT id, name, occupied_beds, bed_capacity
FROM departments
WHERE occupied_beds > bed_capacity AND bed_capacity > 0;

-- 13. Resources with inconsistent totals.
SELECT id, name, total, available, in_use, maintenance
FROM resources
WHERE total <> (available + in_use + maintenance);

-- 14. Patients linked to a user without a portal username.
SELECT p.id, p.full_name
FROM patients p
JOIN users u ON u.patient_id = p.id
WHERE NULLIF(p.portal_username, '') IS NULL;

-- 15. Audit events with a denied outcome.
SELECT id, actor_email, action, resource
FROM audit_logs
WHERE outcome = 'Denied';

-- 16. Module records with an unsupported module key.
SELECT id, module
FROM module_records
WHERE module NOT IN ('radiology', 'laboratory', 'pharmacy', 'billing', 'insurance', 'inventory', 'sales', 'marketing');

-- 17. Workflows referencing a missing agent.
SELECT w.id, w.agent_id
FROM workflows w
LEFT JOIN agents a ON a.id = w.agent_id
WHERE a.id IS NULL;

-- 18. Platform activity outside the retention window.
SELECT id, timestamp
FROM platform_activity
WHERE timestamp < now() - INTERVAL '90 days';
