-- CareOS relational schema (PostgreSQL 15+)
-- This schema is the target normalization of the preview JSON database.
-- The runtime app continues to use the JSON store; migration tooling in this
-- folder can export the JSON records into these tables for relational review.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Platform governance
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS applications (
    id                 TEXT PRIMARY KEY,
    application_id     TEXT UNIQUE NOT NULL,
    hospital_name      TEXT NOT NULL,
    hospital_type      TEXT NOT NULL,
    beds_count         INTEGER NOT NULL DEFAULT 0 CHECK (beds_count >= 0),
    departments_count  INTEGER NOT NULL DEFAULT 0 CHECK (departments_count >= 0),
    location           TEXT,
    address            TEXT,
    contact_person     TEXT NOT NULL,
    email              TEXT NOT NULL,
    phone              TEXT,
    submitted_at       TIMESTAMPTZ NOT NULL,
    status             TEXT NOT NULL CHECK (status IN ('Pending', 'Under Review', 'Docs Requested', 'Approved', 'Rejected')),
    internal_notes     TEXT,
    requested_message  TEXT,
    reviewed_at        TIMESTAMPTZ,
    applicant_user_id  TEXT
);

CREATE TABLE IF NOT EXISTS hospitals (
    id                  TEXT PRIMARY KEY,
    hospital_id         TEXT UNIQUE NOT NULL,
    application_id      TEXT REFERENCES applications(application_id),
    hospital_name       TEXT NOT NULL,
    hospital_type       TEXT NOT NULL,
    location            TEXT,
    address             TEXT,
    administrator_name  TEXT NOT NULL,
    administrator_email TEXT NOT NULL,
    phone               TEXT,
    beds_count          INTEGER NOT NULL DEFAULT 0,
    departments_count   INTEGER NOT NULL DEFAULT 0,
    active_users_count  INTEGER NOT NULL DEFAULT 0,
    subscription_plan   TEXT,
    workspace_status    TEXT NOT NULL DEFAULT 'Active',
    approved_at         TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id               TEXT PRIMARY KEY,
    hospital_id      TEXT NOT NULL REFERENCES hospitals(hospital_id),
    hospital_name    TEXT NOT NULL,
    plan             TEXT NOT NULL,
    monthly_price_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
    seats_included   INTEGER NOT NULL DEFAULT 0,
    status           TEXT NOT NULL CHECK (status IN ('Active', 'Trial', 'Suspended', 'Cancelled')),
    started_at       TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS platform_activity (
    id        TEXT PRIMARY KEY,
    message   TEXT NOT NULL,
    category  TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- Identity and access
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    username            TEXT UNIQUE,
    full_name           TEXT NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    role                TEXT NOT NULL CHECK (role IN ('admin', 'coordinator', 'clinician', 'operator', 'patient')),
    hospital_name       TEXT NOT NULL,
    hospital_type       TEXT,
    hospital_id         TEXT REFERENCES hospitals(hospital_id),
    application_id      TEXT REFERENCES applications(application_id),
    department          TEXT,
    contact_number      TEXT,
    status              TEXT NOT NULL CHECK (status IN ('active', 'pending', 'suspended')),
    demo_switchable     BOOLEAN NOT NULL DEFAULT FALSE,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    patient_id          TEXT,
    password_hash       TEXT NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id           TEXT PRIMARY KEY,
    timestamp    TIMESTAMPTZ NOT NULL,
    actor_email  TEXT NOT NULL,
    actor_role   TEXT NOT NULL,
    action       TEXT NOT NULL,
    resource     TEXT NOT NULL,
    outcome      TEXT NOT NULL CHECK (outcome IN ('Allowed', 'Denied'))
);

-- ---------------------------------------------------------------------------
-- Clinical records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS patients (
    id                TEXT PRIMARY KEY,
    mrn               TEXT UNIQUE NOT NULL,
    full_name         TEXT NOT NULL,
    age               INTEGER CHECK (age BETWEEN 0 AND 130),
    gender            TEXT,
    phone             TEXT,
    email             TEXT,
    department        TEXT NOT NULL,
    attending_doctor  TEXT NOT NULL,
    admission_status  TEXT NOT NULL,
    ward_bed          TEXT,
    last_visit        DATE,
    medical_summary   TEXT,
    allergies         TEXT[] NOT NULL DEFAULT '{}',
    user_id           TEXT REFERENCES users(id),
    portal_username   TEXT,
    portal_email      TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS appointments (
    id                       TEXT PRIMARY KEY,
    patient_id               TEXT NOT NULL REFERENCES patients(id),
    patient_name             TEXT NOT NULL,
    mrn                      TEXT NOT NULL,
    doctor_name              TEXT NOT NULL,
    department               TEXT NOT NULL,
    date                     DATE NOT NULL,
    time                     TEXT NOT NULL,
    type                     TEXT NOT NULL,
    status                   TEXT NOT NULL,
    notes                    TEXT,
    created_at               TIMESTAMPTZ NOT NULL,
    queue_joined_at          TIMESTAMPTZ,
    waiting_minutes          INTEGER NOT NULL DEFAULT 0,
    portal_user_id           TEXT,
    portal_username          TEXT,
    prescription_id          TEXT,
    prescription_uploaded_at TIMESTAMPTZ,
    radiology_order_id       TEXT,
    radiology_report_uploaded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id            TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    patient_id    TEXT NOT NULL REFERENCES patients(id),
    patient_name  TEXT NOT NULL,
    mrn           TEXT NOT NULL,
    doctor_name   TEXT NOT NULL,
    diagnosis     TEXT NOT NULL,
    medications   TEXT NOT NULL,
    instructions  TEXT,
    file_name     TEXT,
    file_data_url TEXT,
    uploaded_by   TEXT,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS radiology_orders (
    id            TEXT PRIMARY KEY,
    appointment_id TEXT NOT NULL REFERENCES appointments(id),
    patient_id    TEXT NOT NULL REFERENCES patients(id),
    patient_name  TEXT NOT NULL,
    mrn           TEXT NOT NULL,
    doctor_name   TEXT NOT NULL,
    department    TEXT NOT NULL,
    exam_type     TEXT NOT NULL,
    reason        TEXT NOT NULL,
    priority      TEXT NOT NULL CHECK (priority IN ('Routine', 'Urgent', 'STAT')),
    status        TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    created_at    TIMESTAMPTZ NOT NULL,
    waiting_minutes INTEGER NOT NULL DEFAULT 0,
    completed_at  TIMESTAMPTZ,
    report_findings TEXT,
    report_impression TEXT,
    report_file_name TEXT,
    report_file_data_url TEXT,
    report_uploaded_by TEXT,
    report_uploaded_at TIMESTAMPTZ,
    bill_id       TEXT
);

CREATE TABLE IF NOT EXISTS bills (
    id           TEXT PRIMARY KEY,
    patient_id   TEXT NOT NULL REFERENCES patients(id),
    patient_name TEXT NOT NULL,
    mrn          TEXT NOT NULL,
    order_id     TEXT REFERENCES radiology_orders(id),
    description  TEXT NOT NULL,
    amount       NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency     TEXT NOT NULL DEFAULT 'USD',
    status       TEXT NOT NULL CHECK (status IN ('Pending', 'Paid', 'Overdue', 'Cancelled')),
    created_at   TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- Operations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS departments (
    id              TEXT PRIMARY KEY,
    name            TEXT UNIQUE NOT NULL,
    head            TEXT,
    active_patients INTEGER NOT NULL DEFAULT 0,
    staff_on_duty   INTEGER NOT NULL DEFAULT 0,
    total_staff     INTEGER NOT NULL DEFAULT 0,
    bed_capacity    INTEGER NOT NULL DEFAULT 0,
    occupied_beds   INTEGER NOT NULL DEFAULT 0,
    avg_wait_minutes INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    role          TEXT NOT NULL,
    department    TEXT NOT NULL,
    shift         TEXT NOT NULL,
    availability  TEXT NOT NULL,
    active_cases  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS resources (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    department  TEXT NOT NULL,
    total       INTEGER NOT NULL DEFAULT 0,
    available   INTEGER NOT NULL DEFAULT 0,
    in_use      INTEGER NOT NULL DEFAULT 0,
    maintenance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS operational_tasks (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    department     TEXT NOT NULL,
    assigned_agent TEXT NOT NULL,
    priority       TEXT NOT NULL CHECK (priority IN ('Normal', 'High', 'Urgent')),
    status         TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Completed')),
    due_time       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    detail      TEXT NOT NULL,
    department  TEXT NOT NULL,
    severity    TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    timestamp   TIMESTAMPTZ NOT NULL,
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    user_id     TEXT,
    patient_id  TEXT REFERENCES patients(id),
    order_id    TEXT REFERENCES radiology_orders(id)
);

CREATE TABLE IF NOT EXISTS module_records (
    id              TEXT PRIMARY KEY,
    module          TEXT NOT NULL CHECK (module IN ('radiology', 'laboratory', 'pharmacy', 'billing', 'insurance', 'inventory', 'sales', 'marketing')),
    reference_code  TEXT NOT NULL,
    title           TEXT NOT NULL,
    subtitle        TEXT,
    status          TEXT NOT NULL CHECK (status IN ('Active', 'Pending Review', 'Completed', 'Flagged')),
    amount_or_count TEXT,
    created_at      TIMESTAMPTZ NOT NULL
);

-- ---------------------------------------------------------------------------
-- AI agents and orchestration
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agents (
    id                   TEXT PRIMARY KEY,
    name                 TEXT NOT NULL,
    short_name           TEXT NOT NULL,
    category             TEXT NOT NULL,
    description          TEXT NOT NULL,
    highlights           TEXT[] NOT NULL,
    status               TEXT NOT NULL,
    assigned_tasks       INTEGER NOT NULL DEFAULT 0,
    completed_tasks      INTEGER NOT NULL DEFAULT 0,
    pending_tasks        INTEGER NOT NULL DEFAULT 0,
    avg_response_seconds NUMERIC(8, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS agent_activity (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    timestamp   TIMESTAMPTZ NOT NULL,
    summary     TEXT NOT NULL,
    department  TEXT NOT NULL,
    outcome     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflows (
    id                TEXT PRIMARY KEY,
    name              TEXT NOT NULL,
    description       TEXT NOT NULL,
    trigger           TEXT NOT NULL,
    condition         TEXT NOT NULL,
    agent_id          TEXT NOT NULL REFERENCES agents(id),
    agent_name        TEXT NOT NULL,
    action            TEXT NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    completion_outcome TEXT NOT NULL,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    executions_count  INTEGER NOT NULL DEFAULT 0,
    last_run_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_executions (
    id                TEXT PRIMARY KEY,
    workflow_code     TEXT UNIQUE NOT NULL,
    instruction       TEXT NOT NULL,
    intent_summary    TEXT NOT NULL,
    executed_at       TIMESTAMPTZ NOT NULL,
    execution_ms      INTEGER NOT NULL,
    participating_agents TEXT[] NOT NULL,
    status            TEXT NOT NULL CHECK (status IN ('Completed', 'Awaiting Approval', 'Issue Detected')),
    voice_confirmation TEXT NOT NULL,
    executive_brief   TEXT NOT NULL,
    report_title      TEXT NOT NULL,
    report_sections_count INTEGER NOT NULL DEFAULT 0,
    error_message     TEXT
);

CREATE TABLE IF NOT EXISTS inter_agent_messages (
    id          TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step        INTEGER NOT NULL,
    from_key    TEXT NOT NULL,
    from_agent  TEXT NOT NULL,
    to_key      TEXT NOT NULL,
    to_agent    TEXT NOT NULL,
    department  TEXT NOT NULL,
    message     TEXT NOT NULL,
    status      TEXT NOT NULL,
    timestamp   TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS departmental_alerts (
    id                TEXT PRIMARY KEY,
    workflow_id       TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    workflow_code     TEXT NOT NULL,
    department        TEXT NOT NULL,
    agent_name        TEXT NOT NULL,
    summary           TEXT NOT NULL,
    priority          TEXT NOT NULL CHECK (priority IN ('Normal', 'High', 'Urgent')),
    timestamp         TIMESTAMPTZ NOT NULL,
    status            TEXT NOT NULL,
    target_path       TEXT NOT NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pending_approvals (
    id           TEXT PRIMARY KEY,
    workflow_id  TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    department   TEXT NOT NULL,
    description  TEXT NOT NULL,
    action_type  TEXT NOT NULL CHECK (action_type IN ('clinical', 'financial', 'insurance', 'discharge')),
    approved     BOOLEAN NOT NULL DEFAULT FALSE,
    approved_at  TIMESTAMPTZ,
    approved_by  TEXT
);

CREATE TABLE IF NOT EXISTS report_sections (
    id           BIGSERIAL PRIMARY KEY,
    workflow_id  TEXT NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    section_order INTEGER NOT NULL,
    title        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_section_items (
    id           BIGSERIAL PRIMARY KEY,
    section_id   BIGINT NOT NULL REFERENCES report_sections(id) ON DELETE CASCADE,
    label        TEXT NOT NULL,
    value        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    category     TEXT NOT NULL,
    availability TEXT NOT NULL CHECK (availability IN ('supported', 'planned')),
    description  TEXT NOT NULL,
    protocol     TEXT NOT NULL,
    connected    BOOLEAN NOT NULL DEFAULT FALSE
);

-- Append-only operational events materialized by backend/analytics/events.py.
CREATE TABLE IF NOT EXISTS analytics_events (
    id           TEXT PRIMARY KEY,
    kind         TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL,
    payload      JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMIT;
