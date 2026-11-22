"""Privacy and minimum-necessary helpers for CareOS analytics exports."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Set, Tuple

from .models import Finding, HospitalSnapshot

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
NAME_KEYS = {"fullName", "patientName", "doctorName", "contactPerson", "administratorName", "head", "name"}


@dataclass
class PrivacyFinding:
    code: str
    severity: str
    field: str
    record_id: str
    detail: str

    def as_dict(self) -> Dict[str, str]:
        return {"code": self.code, "severity": self.severity, "field": self.field, "recordId": self.record_id, "detail": self.detail}


@dataclass
class PrivacyReport:
    findings: List[PrivacyFinding] = field(default_factory=list)
    redacted_fields: int = 0
    records_scanned: int = 0

    @property
    def ok(self) -> bool:
        return not any(finding.severity in {"high", "critical"} for finding in self.findings)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "recordsScanned": self.records_scanned,
            "redactedFields": self.redacted_fields,
            "findings": [finding.as_dict() for finding in self.findings],
        }


def minimum_necessary(record: Mapping[str, Any], allowed: Sequence[str]) -> Dict[str, Any]:
    return {key: record[key] for key in allowed if key in record}


def k_anonymity(records: Iterable[Mapping[str, Any]], quasi_identifiers: Sequence[str]) -> int:
    combos = Counter(
        tuple(str(record.get(field, "")) for field in quasi_identifiers)
        for record in records
    )
    return min(combos.values()) if combos else 0


def pseudonymize(value: Any, prefix: str = "anon", salt: str = "careos") -> str:
    import hashlib

    digest = hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()[:12]
    return f"{prefix}-{digest}"


def scan_for_free_text_pii(value: Any, path: str, identifier: str) -> List[PrivacyFinding]:
    findings: List[PrivacyFinding] = []
    if not isinstance(value, str):
        return findings
    if EMAIL_RE.search(value):
        findings.append(PrivacyFinding("PRIV-EMAIL", "medium", path, identifier, "Free-text email address"))
    if PHONE_RE.search(value):
        findings.append(PrivacyFinding("PRIV-PHONE", "medium", path, identifier, "Free-text phone number"))
    return findings


def scan_audit_notes(snapshot: HospitalSnapshot) -> List[PrivacyFinding]:
    findings: List[PrivacyFinding] = []
    for record in snapshot.audit_logs:
        for key in ("action", "resource", "actorEmail"):
            findings.extend(scan_for_free_text_pii(record.get(key), f"auditLogs.{key}", str(record.get("id", "unknown"))))
    for record in snapshot.module_records:
        for key in ("title", "subtitle", "status"):
            findings.extend(scan_for_free_text_pii(record.get(key), f"moduleRecords.{key}", str(record.get("id", "unknown"))))
    return findings


def assess_privacy(snapshot: HospitalSnapshot, allowed_patient_fields: Sequence[str] = ("id", "mrn", "department", "attendingDoctor")) -> PrivacyReport:
    report = PrivacyReport()
    report.findings.extend(scan_audit_notes(snapshot))
    for patient in snapshot.patients:
        report.records_scanned += 1
        shared = set(patient) - set(allowed_patient_fields)
        exposed_names = shared & NAME_KEYS
        if exposed_names:
            report.findings.append(
                PrivacyFinding(
                    "PRIV-MINIMUM",
                    "low",
                    ", ".join(sorted(exposed_names)),
                    str(patient.get("id", "unknown")),
                    "Patient fields exceed the minimum-necessary export set.",
                )
            )
    k = k_anonymity(snapshot.patients, ("department", "attendingDoctor"))
    if 0 < k < 3:
        report.findings.append(
            PrivacyFinding("PRIV-K-ANON", "medium", "department,attendingDoctor", "patients", f"k-anonymity is {k}, below the target of 3.")
        )
    report.redacted_fields = sum(1 for finding in report.findings if finding.code.startswith("PRIV-EMAIL") or finding.code.startswith("PRIV-PHONE"))
    return report


def privacy_gate(report: PrivacyReport) -> List[Finding]:
    findings: List[Finding] = []
    if not report.ok:
        findings.append(
            Finding(
                id="PRIV-GATE-001",
                category="privacy",
                severity="high",
                title="Privacy gate blocked export",
                detail=f"{len(report.findings)} privacy finding(s) detected.",
                target_path="/dashboard/settings",
                recommendation="Apply redaction before publishing the analytics export.",
            )
        )
    return findings
