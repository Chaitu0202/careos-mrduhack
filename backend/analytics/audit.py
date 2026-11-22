"""Audit trail verification for CareOS records.

The Express API appends audit entries for state-changing requests. This module
verifies those entries and can compute a hash chain for tamper-evident exports.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .metrics import parse_timestamp
from .models import Finding, HospitalSnapshot

GENESIS = "0" * 64


@dataclass
class AuditVerification:
    total: int
    valid: int
    denied: int
    missing_fields: List[str] = field(default_factory=list)
    out_of_order: List[str] = field(default_factory=list)
    duplicate_ids: List[str] = field(default_factory=list)
    findings: List[Finding] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.findings

    def as_dict(self) -> Dict[str, Any]:
        return {
            "total": self.total,
            "valid": self.valid,
            "denied": self.denied,
            "missingFields": list(self.missing_fields),
            "outOfOrder": list(self.out_of_order),
            "duplicateIds": list(self.duplicate_ids),
            "findings": [finding.as_dict() for finding in self.findings],
            "ok": self.ok,
        }


def canonical_bytes(entry: Mapping[str, Any]) -> bytes:
    ordered = {
        "id": entry.get("id"),
        "timestamp": entry.get("timestamp"),
        "actorEmail": entry.get("actorEmail"),
        "actorRole": entry.get("actorRole"),
        "action": entry.get("action"),
        "resource": entry.get("resource"),
        "outcome": entry.get("outcome"),
    }
    return json.dumps(ordered, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def entry_hash(entry: Mapping[str, Any], previous: str = GENESIS) -> str:
    payload = previous.encode("ascii") + b":" + canonical_bytes(entry)
    return hashlib.sha256(payload).hexdigest()


def build_hash_chain(entries: Sequence[Mapping[str, Any]]) -> List[Dict[str, Any]]:
    previous = GENESIS
    chain: List[Dict[str, Any]] = []
    for entry in entries:
        digest = entry_hash(entry, previous)
        chain.append({"id": entry.get("id"), "hash": digest, "previous": previous})
        previous = digest
    return chain


def required_fields_present(entry: Mapping[str, Any]) -> bool:
    return all(entry.get(field) not in (None, "") for field in (
        "id", "timestamp", "actorEmail", "actorRole", "action", "resource", "outcome"
    ))


def verify_audit_trail(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> AuditVerification:
    entries: List[Mapping[str, Any]] = [entry for entry in snapshot.audit_logs if isinstance(entry, Mapping)]
    missing = [str(entry.get("id", index)) for index, entry in enumerate(entries) if not required_fields_present(entry)]
    seen: set[str] = set()
    duplicate_ids: List[str] = []
    for entry in entries:
        identifier = str(entry.get("id", ""))
        if identifier in seen:
            duplicate_ids.append(identifier)
        seen.add(identifier)

    parsed = [(parse_timestamp(entry.get("timestamp")), entry) for entry in entries]
    out_of_order: List[str] = []
    previous_time: Optional[datetime] = None
    for stamp, entry in parsed:
        if stamp is None:
            continue
        if previous_time and stamp < previous_time:
            out_of_order.append(str(entry.get("id", "unknown")))
        previous_time = stamp

    cutoff = snapshot.generated_at - timedelta(days=config.thresholds.audit_lookback_days)
    recent = [entry for stamp, entry in parsed if stamp and stamp >= cutoff]
    denied = [entry for entry in recent if str(entry.get("outcome", "")).lower() == "denied"]

    findings: List[Finding] = []
    if missing:
        findings.append(Finding("AUD-MISSING", "auditability", "high", "Audit entries missing required fields", f"Missing fields in {len(missing)} entr(ies).", "/dashboard/audit-logs", "Populate all audit fields before export."))
    if duplicate_ids:
        findings.append(Finding("AUD-DUPLICATE", "auditability", "medium", "Duplicate audit identifiers", f"Repeated IDs: {', '.join(duplicate_ids[:5])}.", "/dashboard/audit-logs", "Use globally unique audit event identifiers."))
    if out_of_order:
        findings.append(Finding("AUD-ORDER", "auditability", "low", "Audit timestamps out of order", f"Out-of-order entries: {', '.join(out_of_order[:5])}.", "/dashboard/audit-logs", "Sort audit events by timestamp before export."))
    if not recent:
        findings.append(Finding("AUD-EMPTY", "auditability", "medium", "No recent audit events", f"No entries within {config.thresholds.audit_lookback_days} days.", "/dashboard/audit-logs", "Confirm audit logging is enabled for state-changing endpoints."))

    return AuditVerification(
        total=len(entries),
        valid=len(entries) - len(missing),
        denied=len(denied),
        missing_fields=missing,
        out_of_order=out_of_order,
        duplicate_ids=duplicate_ids,
        findings=findings,
    )


def audit_chain_export(snapshot: HospitalSnapshot) -> Dict[str, Any]:
    entries = sorted(
        [entry for entry in snapshot.audit_logs if isinstance(entry, Mapping)],
        key=lambda item: str(item.get("timestamp") or ""),
    )
    return {"algorithm": "sha256", "genesis": GENESIS, "entries": build_hash_chain(entries)}
