"""Compliance checks for demo data governance and human oversight."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .metrics import parse_timestamp
from .models import Finding, HospitalSnapshot, coerce_float, coerce_int


def check_required_user_fields(snapshot: HospitalSnapshot) -> List[Finding]:
    findings: List[Finding] = []
    for user in snapshot.users:
        identifier = str(user.get("id", "unknown"))
        missing = [
            field
            for field in ("id", "fullName", "email", "role", "status", "contactNumber")
            if not user.get(field)
        ]
        if missing:
            findings.append(
                Finding(
                    f"GOV-USER-{identifier}",
                    "governance",
                    "medium",
                    "Incomplete user account",
                    f"User {identifier} is missing: {', '.join(missing)}.",
                    "/dashboard/manage",
                    "Populate required identity fields before enabling the account.",
                )
            )
    return findings


def check_default_passwords(snapshot: HospitalSnapshot) -> List[Finding]:
    findings: List[Finding] = []
    flagged = [user for user in snapshot.users if user.get("mustChangePassword") is True]
    if flagged:
        findings.append(
            Finding(
                "GOV-PWD-001",
                "security",
                "medium",
                "Temporary passwords still active",
                f"{len(flagged)} account(s) still require a first-login password change.",
                "/dashboard/manage",
                "Ask users to complete the forced password-change flow before production use.",
            )
        )
    return findings


def check_clinical_approvals(snapshot: HospitalSnapshot) -> List[Finding]:
    findings: List[Finding] = []
    for execution in snapshot.executions:
        if execution.open_approval_count > 0:
            findings.append(
                Finding(
                    f"GOV-APPR-{execution.id}",
                    "human_oversight",
                    "high" if execution.open_approval_count > 1 else "medium",
                    "Open human approval gate",
                    f"{execution.code} has {execution.open_approval_count} unapproved action(s).",
                    "/dashboard",
                    "Human administrator must review the orchestration report before execution is finalized.",
                )
            )
        if execution.status == "Completed" and execution.message_count == 0:
            findings.append(
                Finding(
                    f"GOV-TRACE-{execution.id}",
                    "auditability",
                    "medium",
                    "Missing inter-agent trace",
                    f"{execution.code} completed without a recorded coordination log.",
                    "/dashboard/operations?tab=workflows",
                    "Persist every inter-agent message so reviews can reconstruct the decision path.",
                )
            )
        if execution.report_sections == 0:
            findings.append(
                Finding(
                    f"GOV-REPORT-{execution.id}",
                    "auditability",
                    "low",
                    "Execution has no structured report",
                    f"{execution.code} has no reportSections payload.",
                    "/dashboard/operations?tab=workflows",
                    "Attach at least one report section for downstream audit consumption.",
                )
            )
    return findings


def check_audit_trail(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    cutoff = snapshot.generated_at - timedelta(days=config.thresholds.audit_lookback_days)
    recent = [entry for entry in snapshot.audit_logs if (parse_timestamp(entry.get("timestamp")) or cutoff) >= cutoff]
    if not recent:
        findings.append(
            Finding(
                "GOV-AUDIT-001",
                "auditability",
                "medium",
                "No recent audit events",
                f"No audit log entries found within {config.thresholds.audit_lookback_days} days.",
                "/dashboard/audit-logs",
                "Confirm audit logging is enabled for all state-changing endpoints.",
            )
        )
    denied = [entry for entry in recent if str(entry.get("outcome", "")).lower() == "denied"]
    if denied:
        findings.append(
            Finding(
                "GOV-AUDIT-002",
                "security",
                "high",
                "Denied audit events present",
                f"{len(denied)} denied action(s) were recorded in the lookback window.",
                "/dashboard/audit-logs",
                "Investigate each denied action and confirm it was not a privilege escalation attempt.",
            )
        )
    return findings


def check_patient_consent_boundaries(snapshot: HospitalSnapshot) -> List[Finding]:
    findings: List[Finding] = []
    for patient in snapshot.patients:
        if patient.get("userId") and not patient.get("portalUsername"):
            findings.append(
                Finding(
                    f"GOV-PORTAL-{patient.get('id', 'unknown')}",
                    "patient_access",
                    "medium",
                    "Portal link incomplete",
                    f"Patient {patient.get('fullName', 'Unknown')} has a user account but no portal username.",
                    "/dashboard/patients",
                    "Generate the portal credential record before sharing patient-facing access.",
                )
            )
    return findings


def check_demo_switch_policy(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    switchable = [user for user in snapshot.users if user.get("demoSwitchable") is True]
    if not switchable:
        return []
    return [
        Finding(
            "GOV-DEMO-001",
            "deployment",
            "low",
            "Demo switching enabled in dataset",
            f"{len(switchable)} workspace identities are marked demoSwitchable.",
            "/dashboard/settings",
            "Set CAREOS_DEMO_SWITCH=false for production deployments.",
        )
    ]


def check_dataset_idempotency(snapshot: HospitalSnapshot) -> List[Finding]:
    findings: List[Finding] = []
    for collection_name in ("users", "patients", "appointments", "agents", "workflows"):
        counts = Counter(str(item.get("id", "")) for item in snapshot.collection(collection_name))
        duplicates = [identifier for identifier, count in counts.items() if identifier and count > 1]
        if duplicates:
            findings.append(
                Finding(
                    f"GOV-DUP-{collection_name}",
                    "data_quality",
                    "high",
                    "Duplicate identifiers in seeded data",
                    f"Collection {collection_name} repeats IDs: {', '.join(duplicates[:5])}.",
                    "/dashboard/settings",
                    "Ensure demo seeding uses stable unique IDs and addUnique semantics.",
                )
            )
    return findings


def run_compliance(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    findings.extend(check_required_user_fields(snapshot))
    findings.extend(check_default_passwords(snapshot))
    findings.extend(check_clinical_approvals(snapshot))
    findings.extend(check_audit_trail(snapshot, config))
    findings.extend(check_patient_consent_boundaries(snapshot))
    findings.extend(check_demo_switch_policy(snapshot, config))
    findings.extend(check_dataset_idempotency(snapshot))
    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda item: (severity_rank.get(item.severity, 9), item.id))
    return findings


def compliance_score(findings: Sequence[Finding]) -> float:
    weights = {"critical": 25, "high": 10, "medium": 4, "low": 1}
    penalty = sum(weights.get(item.severity, 1) for item in findings)
    return max(0.0, 100.0 - float(penalty))
