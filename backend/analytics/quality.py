"""Rule engine for CareOS data-quality review.

Rules are deterministic, dependency-free, and return typed findings that can be
serialized into the analytics report or evaluated in CI.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import Finding, HospitalSnapshot, coerce_float, coerce_int


@dataclass(frozen=True)
class QualityRule:
    code: str
    category: str
    severity: str
    title: str
    description: str
    recommendation: str
    target_path: str = ""
    predicate: Optional[Callable[[HospitalSnapshot], List[Mapping[str, Any]]]] = field(default=None, compare=False)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "code": self.code,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "description": self.description,
            "recommendation": self.recommendation,
            "targetPath": self.target_path,
        }

    def evaluate(self, snapshot: HospitalSnapshot) -> List[Finding]:
        if self.predicate is None:
            return []
        findings: List[Finding] = []
        for record in self.predicate(snapshot):
            identifier = str(record.get("id", "unknown"))
            findings.append(
                Finding(
                    id=f"{self.code}-{identifier}",
                    category=self.category,
                    severity=self.severity,
                    title=self.title,
                    detail=f"{self.description} Record: {identifier}.",
                    target_path=self.target_path,
                    recommendation=self.recommendation,
                )
            )
        return findings


def patients_missing_required(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    required = ("mrn", "fullName", "department", "attendingDoctor")
    return [row for row in snapshot.patients if any(not row.get(field) for field in required)]


def appointments_with_excessive_waits(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    return [row for row in snapshot.appointments if coerce_int(row.get("waitingMinutes")) > 60]


def radiology_orders_without_reason(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    return [row for row in snapshot.radiology_orders if not row.get("reason")]


def bills_without_patient(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    return [row for row in snapshot.bills if not row.get("patientId") and not row.get("patientName")]


def agents_without_activity(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    inactive = [agent for agent in snapshot.agents if not agent.activity_count]
    return [agent.as_dict() for agent in inactive]


def workflows_without_agents(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    return [row for row in snapshot.workflows if not row.get("agentId") and not row.get("agentName")]


def module_records_with_invalid_amount(snapshot: HospitalSnapshot) -> List[Mapping[str, Any]]:
    flagged: List[Mapping[str, Any]] = []
    for row in snapshot.module_records:
        value = row.get("amountOrCount")
        if value in (None, ""):
            continue
        if coerce_float(value, default=-1) < 0:
            flagged.append(row)
    return flagged


DEFAULT_RULES: Sequence[QualityRule] = (
    QualityRule(
        code="DQ-PAT-001",
        category="data_quality",
        severity="high",
        title="Patient record is incomplete",
        description="A patient is missing MRN, name, department, or attending doctor.",
        recommendation="Complete the patient registry before clinical handoff.",
        target_path="/dashboard/patients",
        predicate=patients_missing_required,
    ),
    QualityRule(
        code="DQ-APT-001",
        category="patient_flow",
        severity="medium",
        title="Appointment wait exceeds one hour",
        description="An appointment has waited longer than 60 minutes.",
        recommendation="Escalate triage and reassign the patient to an available clinician.",
        target_path="/dashboard/doctor-queue",
        predicate=appointments_with_excessive_waits,
    ),
    QualityRule(
        code="DQ-RAD-001",
        category="clinical",
        severity="medium",
        title="Radiology order has no clinical reason",
        description="A radiology order was created without a reason for exam.",
        recommendation="Add the referring indication before the study is performed.",
        target_path="/dashboard/radiology",
        predicate=radiology_orders_without_reason,
    ),
    QualityRule(
        code="DQ-BIL-001",
        category="billing",
        severity="high",
        title="Invoice has no patient linkage",
        description="A bill has neither a patient identifier nor a patient name.",
        recommendation="Void and regenerate the invoice from the verified encounter.",
        target_path="/dashboard/module/billing",
        predicate=bills_without_patient,
    ),
    QualityRule(
        code="DQ-AGT-001",
        category="agent_performance",
        severity="low",
        title="Agent has no recent activity",
        description="An agent has no recorded recentActivity entries.",
        recommendation="Persist agent activity after every orchestration step.",
        target_path="/dashboard/agents",
        predicate=agents_without_activity,
    ),
    QualityRule(
        code="DQ-WF-001",
        category="workflow",
        severity="medium",
        title="Workflow has no owning agent",
        description="A workflow definition has no agentId or agentName.",
        recommendation="Assign an accountable agent before enabling the workflow.",
        target_path="/dashboard/operations?tab=workflows",
        predicate=workflows_without_agents,
    ),
    QualityRule(
        code="DQ-MOD-001",
        category="module_operations",
        severity="low",
        title="Module record has a negative value",
        description="A module record amountOrCount parsed to a negative number.",
        recommendation="Correct the source record and re-run the export.",
        target_path="/dashboard/operations",
        predicate=module_records_with_invalid_amount,
    ),
)


class QualityEngine:
    def __init__(self, rules: Sequence[QualityRule] = DEFAULT_RULES) -> None:
        self.rules = list(rules)

    def evaluate(self, snapshot: HospitalSnapshot) -> List[Finding]:
        findings: List[Finding] = []
        for rule in self.rules:
            findings.extend(rule.evaluate(snapshot))
        severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        findings.sort(key=lambda item: (severity_rank.get(item.severity, 9), item.id))
        return findings

    def summary(self, snapshot: HospitalSnapshot) -> Dict[str, Any]:
        findings = self.evaluate(snapshot)
        counts: Dict[str, int] = {}
        for finding in findings:
            counts[finding.severity] = counts.get(finding.severity, 0) + 1
        return {
            "ruleCount": len(self.rules),
            "findingCount": len(findings),
            "counts": counts,
            "clean": not findings,
        }


def rule_catalog() -> List[Dict[str, str]]:
    return [
        {
            "code": rule.code,
            "category": rule.category,
            "severity": rule.severity,
            "title": rule.title,
            "description": rule.description,
        }
        for rule in DEFAULT_RULES
    ]
