#!/usr/bin/env python3
"""Export the CareOS JSON preview database into PostgreSQL seed SQL.

The Express API remains the source of truth for the running preview. This
exporter produces a reviewable relational snapshot for CI, schema design, and
future migration to a managed Postgres backend. It uses only the standard
library and never connects to a database on its own.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.analytics.storage import normalize_database, read_json  # noqa: E402


def default_db_path() -> Path:
    override = os.environ.get("CAREOS_DATA_DIR")
    base = Path(override) if override else REPO_ROOT / ".data"
    return base / os.environ.get("CAREOS_DB_FILE_NAME", "careos-db.json")


def sql_literal(value: Any) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (list, tuple, set)):
        items = ", ".join(sql_literal(str(item)) for item in value)
        return f"ARRAY[{items}]::text[]"
    if isinstance(value, Mapping):
        return sql_literal(json.dumps(value, ensure_ascii=False, separators=(",", ":")))
    text = str(value).replace("'", "''")
    return f"'{text}'"


def timestamp_or_null(value: Any) -> Any:
    if value in (None, ""):
        return None
    return str(value)


def insert_statement(
    table: str,
    columns: Sequence[str],
    rows: Iterable[Mapping[str, Any]],
) -> str:
    rendered: List[str] = []
    for row in rows:
        values = ", ".join(sql_literal(row.get(column)) for column in columns)
        rendered.append(f"    ({values})")
    if not rendered:
        return f"-- No rows exported for {table}."
    column_list = ", ".join(columns)
    return (
        f"INSERT INTO {table} ({column_list})\nVALUES\n"
        + ",\n".join(rendered)
        + "\nON CONFLICT (id) DO NOTHING;"
    )


def pick(row: Mapping[str, Any], mapping: Sequence[Tuple[str, str]], transform: Optional[Dict[str, Callable[[Any], Any]]] = None) -> Dict[str, Any]:
    result: Dict[str, Any] = {}
    transforms = transform or {}
    for source, target in mapping:
        value = row.get(source)
        fn = transforms.get(target)
        result[target] = fn(value) if fn else value
    return result


APPLICATION_COLUMNS = [
    "id", "application_id", "hospital_name", "hospital_type", "beds_count",
    "departments_count", "location", "address", "contact_person", "email",
    "phone", "submitted_at", "status", "internal_notes", "requested_message",
    "reviewed_at", "applicant_user_id",
]

HOSPITAL_COLUMNS = [
    "id", "hospital_id", "application_id", "hospital_name", "hospital_type",
    "location", "address", "administrator_name", "administrator_email", "phone",
    "beds_count", "departments_count", "active_users_count", "subscription_plan",
    "workspace_status", "approved_at",
]

SUBSCRIPTION_COLUMNS = [
    "id", "hospital_id", "hospital_name", "plan", "monthly_price_usd",
    "seats_included", "status", "started_at",
]

USER_COLUMNS = [
    "id", "username", "full_name", "email", "role", "hospital_name",
    "hospital_type", "hospital_id", "application_id", "department",
    "contact_number", "status", "demo_switchable", "must_change_password",
    "patient_id", "password_hash", "created_at",
]

PATIENT_COLUMNS = [
    "id", "mrn", "full_name", "age", "gender", "phone", "email", "department",
    "attending_doctor", "admission_status", "ward_bed", "last_visit",
    "medical_summary", "allergies", "user_id", "portal_username", "portal_email",
]

DEPARTMENT_COLUMNS = [
    "id", "name", "head", "active_patients", "staff_on_duty", "total_staff",
    "bed_capacity", "occupied_beds", "avg_wait_minutes", "status",
]

RESOURCE_COLUMNS = ["id", "name", "category", "department", "total", "available", "in_use", "maintenance"]

AGENT_COLUMNS = [
    "id", "name", "short_name", "category", "description", "highlights",
    "status", "assigned_tasks", "completed_tasks", "pending_tasks", "avg_response_seconds",
]

WORKFLOW_COLUMNS = [
    "id", "name", "description", "trigger", "condition", "agent_id", "agent_name",
    "action", "requires_approval", "completion_outcome", "active",
    "executions_count", "last_run_at",
]

INTEGRATION_COLUMNS = ["id", "name", "category", "availability", "description", "protocol", "connected"]

MODULE_COLUMNS = [
    "id", "module", "reference_code", "title", "subtitle", "status",
    "amount_or_count", "created_at",
]

AUDIT_COLUMNS = ["id", "timestamp", "actor_email", "actor_role", "action", "resource", "outcome"]


def build_sections(payload: Mapping[str, Any]) -> List[Tuple[str, str, List[str], List[Mapping[str, Any]], Sequence[str]]]:
    """Return (title, table, columns, rows, source-field mapping) sections."""
    sections: List[Tuple[str, str, List[str], List[Mapping[str, Any]], Sequence[str]]] = []

    def add(title: str, table: str, columns: Sequence[str], rows: Iterable[Mapping[str, Any]]) -> None:
        materialized = [row for row in rows if isinstance(row, Mapping)]
        sections.append((title, table, list(columns), materialized, columns))

    add("Applications", "applications", APPLICATION_COLUMNS, payload.get("applications", []))
    add("Hospitals", "hospitals", HOSPITAL_COLUMNS, payload.get("hospitals", []))
    add("Subscriptions", "subscriptions", SUBSCRIPTION_COLUMNS, payload.get("subscriptions", []))

    user_rows = [
        {
            **pick(
                user,
                [
                    ("id", "id"), ("username", "username"), ("fullName", "full_name"),
                    ("email", "email"), ("role", "role"), ("hospitalName", "hospital_name"),
                    ("hospitalType", "hospital_type"), ("hospitalId", "hospital_id"),
                    ("applicationId", "application_id"), ("department", "department"),
                    ("contactNumber", "contact_number"), ("status", "status"),
                    ("demoSwitchable", "demo_switchable"), ("mustChangePassword", "must_change_password"),
                    ("patientId", "patient_id"), ("passwordHash", "password_hash"),
                    ("createdAt", "created_at"),
                ],
            )
        }
        for user in payload.get("users", [])
    ]
    add("Users", "users", USER_COLUMNS, user_rows)

    patient_rows = [
        {
            **pick(
                patient,
                [
                    ("id", "id"), ("mrn", "mrn"), ("fullName", "full_name"), ("age", "age"),
                    ("gender", "gender"), ("phone", "phone"), ("email", "email"),
                    ("department", "department"), ("attendingDoctor", "attending_doctor"),
                    ("admissionStatus", "admission_status"), ("wardBed", "ward_bed"),
                    ("lastVisit", "last_visit"), ("medicalSummary", "medical_summary"),
                    ("allergies", "allergies"), ("userId", "user_id"),
                    ("portalUsername", "portal_username"), ("portalEmail", "portal_email"),
                ],
            )
        }
        for patient in payload.get("patients", [])
    ]
    add("Patients", "patients", PATIENT_COLUMNS, patient_rows)
    add("Departments", "departments", DEPARTMENT_COLUMNS, payload.get("departments", []))
    add("Resources", "resources", RESOURCE_COLUMNS, payload.get("resources", []))

    agent_rows = [
        {
            **pick(
                agent,
                [
                    ("id", "id"), ("name", "name"), ("shortName", "short_name"),
                    ("category", "category"), ("description", "description"),
                    ("highlights", "highlights"), ("status", "status"),
                    ("assignedTasks", "assigned_tasks"), ("completedTasks", "completed_tasks"),
                    ("pendingTasks", "pending_tasks"), ("avgResponseSeconds", "avg_response_seconds"),
                ],
            )
        }
        for agent in payload.get("agents", [])
    ]
    add("Agents", "agents", AGENT_COLUMNS, agent_rows)

    workflow_rows = [
        {
            **pick(
                workflow,
                [
                    ("id", "id"), ("name", "name"), ("description", "description"),
                    ("trigger", "trigger"), ("condition", "condition"), ("agentId", "agent_id"),
                    ("agentName", "agent_name"), ("action", "action"),
                    ("requiresApproval", "requires_approval"), ("completionOutcome", "completion_outcome"),
                    ("active", "active"), ("executionsCount", "executions_count"),
                    ("lastRunAt", "last_run_at"),
                ],
            )
        }
        for workflow in payload.get("workflows", [])
    ]
    add("Workflows", "workflows", WORKFLOW_COLUMNS, workflow_rows)
    add("Integrations", "integrations", INTEGRATION_COLUMNS, payload.get("integrations", []))

    module_rows = [
        {
            **pick(
                record,
                [
                    ("id", "id"), ("module", "module"), ("referenceCode", "reference_code"),
                    ("title", "title"), ("subtitle", "subtitle"), ("status", "status"),
                    ("amountOrCount", "amount_or_count"), ("createdAt", "created_at"),
                ],
            )
        }
        for record in payload.get("moduleRecords", [])
    ]
    add("Module Records", "module_records", MODULE_COLUMNS, module_rows)
    add("Audit Logs", "audit_logs", AUDIT_COLUMNS, payload.get("auditLogs", []))
    return sections


def render_sql(payload: Mapping[str, Any]) -> Tuple[str, Dict[str, int]]:
    generated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    lines: List[str] = [
        "-- CareOS generated relational seed",
        f"-- Generated: {generated_at}",
        "-- Source: .data/careos-db.json (preview database)",
        "-- Do not edit by hand. Regenerate with: bun run db:migrate",
        "",
        "\\set ON_ERROR_STOP on",
        "BEGIN;",
        "",
    ]
    counts: Dict[str, int] = {}
    for title, table, columns, rows, _fields in build_sections(payload):
        counts[table] = len(rows)
        lines.extend([
            f"-- {title} ({len(rows)} rows)",
            insert_statement(table, columns, rows),
            "",
        ])
    lines.extend(["COMMIT;", ""])
    return "\n".join(lines), counts


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export CareOS JSON data to PostgreSQL seed SQL")
    parser.add_argument("--db", type=Path, default=default_db_path(), help="Path to careos-db.json")
    parser.add_argument("--output", type=Path, default=REPO_ROOT / "database" / "generated" / "seed.sql")
    parser.add_argument("--stdout", action="store_true", help="Write SQL to stdout instead of a file")
    args = parser.parse_args(argv)

    payload = normalize_database(read_json(args.db))
    sql, counts = render_sql(payload)

    if args.stdout:
        print(sql, end="")
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(sql, encoding="utf-8")
        print(f"Wrote {args.output.relative_to(REPO_ROOT)}")
    print(json.dumps({"rowsExported": counts, "total": sum(counts.values())}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
