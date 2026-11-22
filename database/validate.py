#!/usr/bin/env python3
"""Validate the CareOS JSON database before migrations, demos, or deployment.

The runtime application intentionally uses a portable JSON store for the local
preview and Vercel function. This checker gives the relational migration path a
deterministic quality gate: required collections, unique identifiers, and the
foreign-key relationships used by the clinical workflow are all verified here.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Sequence, Set, Tuple

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.analytics.storage import (  # noqa: E402
    DEFAULT_COLLECTIONS,
    duplicate_ids,
    normalize_database,
    read_json,
)

REQUIRED_COLLECTIONS: Tuple[str, ...] = (
    "users",
    "applications",
    "hospitals",
    "subscriptions",
    "patients",
    "appointments",
    "prescriptions",
    "radiologyOrders",
    "bills",
    "departments",
    "resources",
    "agents",
    "workflows",
    "integrations",
    "tasks",
    "notifications",
    "staff",
    "auditLogs",
    "moduleRecords",
    "workflowExecutions",
)

RELATIONSHIPS: Tuple[Tuple[str, str, str, bool], ...] = (
    ("users", "hospitalId", "hospitals", False),
    ("users", "applicationId", "applications", False),
    ("users", "patientId", "patients", False),
    ("appointments", "patientId", "patients", True),
    ("prescriptions", "patientId", "patients", True),
    ("prescriptions", "appointmentId", "appointments", True),
    ("radiologyOrders", "patientId", "patients", True),
    ("radiologyOrders", "appointmentId", "appointments", True),
    ("bills", "patientId", "patients", True),
    ("bills", "orderId", "radiologyOrders", False),
    ("notifications", "patientId", "patients", False),
    ("notifications", "orderId", "radiologyOrders", False),
    ("moduleRecords", "appointmentId", "appointments", False),
    ("moduleRecords", "patientId", "patients", False),
)

STATUS_DOMAINS: Dict[str, Set[str]] = {
    "applications": {"Pending", "Under Review", "Docs Requested", "Approved", "Rejected"},
    "users": {"active", "pending", "suspended"},
    "appointments": {"Scheduled", "Checked In", "In Consultation", "In Progress", "Completed", "Cancelled"},
    "radiologyOrders": {"Pending", "In Progress", "Completed"},
    "bills": {"Pending", "Paid", "Overdue", "Cancelled"},
    "workflowExecutions": {"Completed", "Awaiting Approval", "Issue Detected"},
}


def default_db_path() -> Path:
    override = os.environ.get("CAREOS_DATA_DIR")
    base = Path(override) if override else REPO_ROOT / ".data"
    return base / os.environ.get("CAREOS_DB_FILE_NAME", "careos-db.json")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate the CareOS JSON database")
    parser.add_argument("--db", type=Path, default=default_db_path(), help="Path to careos-db.json")
    parser.add_argument("--strict", action="store_true", help="Treat warnings as failures")
    parser.add_argument("--quiet", action="store_true", help="Only print the final JSON report")
    return parser.parse_args(argv)


IDENTITY_FIELDS = ("id", "hospitalId", "applicationId", "patientId", "mrn", "username", "email", "portalUsername")


def _ids(rows: Iterable[Mapping[str, Any]]) -> Set[str]:
    values: Set[str] = set()
    for row in rows:
        if not isinstance(row, Mapping):
            continue
        for field in IDENTITY_FIELDS:
            value = row.get(field)
            if value not in (None, ""):
                values.add(str(value))
    return values


def check_required(payload: Mapping[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    for name in REQUIRED_COLLECTIONS:
        value = payload.get(name)
        if not isinstance(value, list):
            issues.append({"level": "error", "code": "MISSING_COLLECTION", "collection": name, "detail": "Collection is missing or not an array."})
        elif not value:
            issues.append({"level": "warning", "code": "EMPTY_COLLECTION", "collection": name, "detail": "Collection is empty; dashboard coverage may be reduced."})
    return issues


def check_duplicates(payload: Mapping[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    for name in list(REQUIRED_COLLECTIONS) + list(DEFAULT_COLLECTIONS):
        if name in issues:
            continue
        for identifier in duplicate_ids(payload, name):
            issues.append({
                "level": "error",
                "code": "DUPLICATE_ID",
                "collection": name,
                "detail": f"Identifier {identifier!r} appears more than once.",
            })
    return issues


def check_relationships(payload: Mapping[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    id_cache: Dict[str, Set[str]] = {}
    for source, field, target, required in RELATIONSHIPS:
        rows = payload.get(source) or []
        if not isinstance(rows, list):
            continue
        if target not in id_cache:
            id_cache[target] = _ids(payload.get(target) or [])
        valid = id_cache[target]
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            value = row.get(field)
            if value in (None, ""):
                if required:
                    issues.append({
                        "level": "error",
                        "code": "REQUIRED_REFERENCE_MISSING",
                        "collection": source,
                        "detail": f"Record {row.get('id', '?')!r} has no {field}.",
                    })
                continue
            if str(value) not in valid:
                issues.append({
                    "level": "warning",
                    "code": "DANGLING_REFERENCE",
                    "collection": source,
                    "detail": f"Record {row.get('id', '?')!r} references missing {target} {value!r} via {field}.",
                })
    return issues


def check_statuses(payload: Mapping[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    for collection, allowed in STATUS_DOMAINS.items():
        rows = payload.get(collection) or []
        if not isinstance(rows, list):
            continue
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            status = row.get("status")
            if status and str(status) not in allowed:
                issues.append({
                    "level": "warning",
                    "code": "UNKNOWN_STATUS",
                    "collection": collection,
                    "detail": f"Record {row.get('id', '?')!r} uses status {status!r}.",
                })
    return issues


def check_workflow_payloads(payload: Mapping[str, Any]) -> List[Dict[str, str]]:
    issues: List[Dict[str, str]] = []
    executions = payload.get("workflowExecutions") or []
    for execution in executions if isinstance(executions, list) else []:
        if not isinstance(execution, Mapping):
            continue
        identifier = str(execution.get("id", "?"))
        for field in ("intentSummary", "executiveBrief", "voiceConfirmation", "reportTitle"):
            if not execution.get(field):
                issues.append({
                    "level": "warning",
                    "code": "MISSING_AGENTIC_OUTPUT",
                    "collection": "workflowExecutions",
                    "detail": f"Execution {identifier!r} has no {field}.",
                })
        for field in ("interAgentMessages", "departmentalAlerts", "reportSections"):
            value = execution.get(field)
            if not isinstance(value, list) or not value:
                issues.append({
                    "level": "warning",
                    "code": "EMPTY_AGENTIC_OUTPUT",
                    "collection": "workflowExecutions",
                    "detail": f"Execution {identifier!r} has no {field} entries.",
                })
    return issues


def build_report(payload: Mapping[str, Any], strict: bool) -> Dict[str, Any]:
    issues: List[Dict[str, str]] = []
    issues.extend(check_required(payload))
    issues.extend(check_duplicates(payload))
    issues.extend(check_relationships(payload))
    issues.extend(check_statuses(payload))
    issues.extend(check_workflow_payloads(payload))

    errors = [issue for issue in issues if issue["level"] == "error"]
    warnings = [issue for issue in issues if issue["level"] == "warning"]
    ok = not errors and (not strict or not warnings)
    return {
        "ok": ok,
        "strict": strict,
        "counts": {name: len(payload.get(name) or []) for name in REQUIRED_COLLECTIONS},
        "errorCount": len(errors),
        "warningCount": len(warnings),
        "errors": errors,
        "warnings": warnings,
    }


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    payload = normalize_database(read_json(args.db))
    report = build_report(payload, args.strict)
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
