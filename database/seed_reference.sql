-- CareOS reference data for relational review environments.
-- These rows are stable and independent of the preview JSON snapshot.

BEGIN;

INSERT INTO integrations (id, name, category, availability, description, protocol, connected)
VALUES
    ('int-ehr', 'Electronic Health Record', 'clinical', 'supported', 'Bidirectionally sync encounters and clinical notes.', 'FHIR R4', FALSE),
    ('int-ris', 'Radiology Information System', 'clinical', 'supported', 'Send imaging orders and receive structured reports.', 'HL7 v2 / DICOM MWL', FALSE),
    ('int-pacs', 'Picture Archiving System', 'clinical', 'supported', 'Retrieve imaging studies and thumbnails.', 'DICOMweb', FALSE),
    ('int-lis', 'Laboratory Information System', 'clinical', 'supported', 'Receive lab results and critical value flags.', 'HL7 v2', FALSE),
    ('int-pharmacy', 'Pharmacy Management', 'clinical', 'supported', 'Reconcile medication orders and dispensing.', 'FHIR R4', FALSE),
    ('int-claim', 'Insurance Claims Gateway', 'financial', 'supported', 'Submit eligibility checks and claims.', 'X12 837/835', FALSE),
    ('int-payment', 'Payment Processor', 'financial', 'planned', 'Collect patient copays and post payments.', 'REST', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO departments (id, name, head, active_patients, staff_on_duty, total_staff, bed_capacity, occupied_beds, avg_wait_minutes, status)
VALUES
    ('ref-dept-emergency', 'Emergency', 'Dr. Anita Rao', 24, 12, 18, 30, 24, 18, 'High Load'),
    ('ref-dept-cardiology', 'Cardiology', 'Dr. Vikram Shah', 12, 8, 14, 20, 11, 12, 'Nominal'),
    ('ref-dept-radiology', 'Radiology', 'Dr. Meera Iyer', 6, 7, 10, 0, 0, 26, 'Elevated'),
    ('ref-dept-pharmacy', 'Pharmacy', 'Mr. Arjun Nair', 0, 5, 8, 0, 0, 6, 'Nominal'),
    ('ref-dept-billing', 'Billing', 'Ms. Kavita Menon', 0, 6, 9, 0, 0, 4, 'Nominal')
ON CONFLICT (id) DO NOTHING;

INSERT INTO agents (id, name, short_name, category, description, highlights, status, assigned_tasks, completed_tasks, pending_tasks, avg_response_seconds)
VALUES
    ('ref-agent-clinical', 'Clinical Intelligence Agent', 'Clinical', 'clinical', 'Triages patients and drafts clinical summaries.', ARRAY['Triage', 'Summaries', 'Pathways'], 'Active', 120, 108, 12, 1.2),
    ('ref-agent-radiology', 'Radiology Coordination Agent', 'Radiology', 'diagnostics', 'Coordinates imaging orders and report turnaround.', ARRAY['Orders', 'Wait times', 'Reports'], 'Active', 80, 72, 8, 1.6),
    ('ref-agent-billing', 'Revenue Cycle Agent', 'Billing', 'financial', 'Creates invoices and tracks collections.', ARRAY['Invoices', 'Claims', 'Collections'], 'Active', 95, 88, 7, 1.4),
    ('ref-agent-operations', 'Operations Agent', 'Ops', 'operations', 'Balances staff, beds, and departmental load.', ARRAY['Capacity', 'Staffing', 'Escalation'], 'Active', 110, 101, 9, 1.1),
    ('ref-agent-patient', 'Patient Experience Agent', 'Patient', 'engagement', 'Answers patient queries and sends portal notifications.', ARRAY['Portal', 'Reminders', 'Voice'], 'Active', 140, 132, 8, 0.9),
    ('ref-agent-compliance', 'Compliance Agent', 'Compliance', 'governance', 'Checks approvals, audit trails, and data quality.', ARRAY['Audit', 'Approvals', 'Redaction'], 'Active', 60, 57, 3, 1.8)
ON CONFLICT (id) DO NOTHING;

INSERT INTO platform_activity (id, message, category, timestamp)
VALUES
    ('ref-activity-1', 'CareOS analytics service connected to the preview database.', 'system', '2026-01-01T06:00:00Z'),
    ('ref-activity-2', 'Deterministic demo seed reapplied on startup.', 'system', '2026-01-01T06:01:00Z'),
    ('ref-activity-3', 'Clinical Intelligence Agent completed triage batch.', 'agent', '2026-01-01T06:05:00Z'),
    ('ref-activity-4', 'Radiology queue synchronized with patient portal.', 'workflow', '2026-01-01T06:07:00Z'),
    ('ref-activity-5', 'Billing module generated invoice from radiology report.', 'financial', '2026-01-01T06:10:00Z'),
    ('ref-activity-6', 'Compliance Agent flagged three open approvals.', 'governance', '2026-01-01T06:12:00Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;
