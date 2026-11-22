"""Clinical decision-support rules used by CareOS analytics review.

These rules never change preview data. They annotate the seeded snapshot with
deterministic triage, pathway, and oversight suggestions for reviewers.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import Finding, HospitalSnapshot, coerce_float, coerce_int


@dataclass(frozen=True)
class TriageResult:
    appointment_id: str
    patient_name: str
    department: str
    score: int
    priority: str
    reasons: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "appointmentId": self.appointment_id,
            "patientName": self.patient_name,
            "department": self.department,
            "score": self.score,
            "priority": self.priority,
            "reasons": list(self.reasons),
        }


def triage_appointment(appointment: Mapping[str, Any]) -> TriageResult:
    score = 0
    reasons: List[str] = []
    wait = coerce_int(appointment.get("waitingMinutes"))
    department = str(appointment.get("department", "General"))
    priority = str(appointment.get("priority", ""))
    appointment_type = str(appointment.get("type", ""))

    if wait >= 45:
        score += 4
        reasons.append(f"wait {wait} minutes")
    elif wait >= 20:
        score += 2
        reasons.append(f"wait {wait} minutes")
    if department.lower() in {"emergency", "critical care", "icu"}:
        score += 3
        reasons.append("high-acuity department")
    if priority.lower() in {"stat", "urgent"}:
        score += 3
        reasons.append(f"priority {priority}")
    if "follow" in appointment_type.lower():
        score -= 1
        reasons.append("follow-up visit")

    if score >= 7:
        level = "Immediate"
    elif score >= 4:
        level = "Urgent"
    elif score >= 2:
        level = "Priority"
    else:
        level = "Routine"

    return TriageResult(
        appointment_id=str(appointment.get("id", "unknown")),
        patient_name=str(appointment.get("patientName", "Unknown")),
        department=department,
        score=score,
        priority=level,
        reasons=reasons,
    )


def triage_queue(snapshot: HospitalSnapshot) -> List[TriageResult]:
    results = [triage_appointment(appointment) for appointment in snapshot.appointments]
    rank = {"Immediate": 0, "Urgent": 1, "Priority": 2, "Routine": 3}
    results.sort(key=lambda item: (rank.get(item.priority, 9), -item.score, item.appointment_id))
    return results


CARE_PATHWAYS: Dict[str, Sequence[str]] = {
    "chest pain": ["Triage", "ECG", "Troponin", "Cardiology review", "Disposition"],
    "shortness of breath": ["Triage", "Vitals", "Chest imaging", "Respiratory review", "Disposition"],
    "headache": ["Triage", "Neurological screen", "Medication review", "Disposition"],
    "abdominal pain": ["Triage", "Vitals", "Lab panel", "Imaging if indicated", "Disposition"],
    "routine checkup": ["Registration", "Vitals", "Clinician consult", "Care plan"],
}


def suggest_pathway(reason: str) -> List[str]:
    normalized = reason.lower()
    for keyword, steps in CARE_PATHWAYS.items():
        if keyword in normalized:
            return list(steps)
    return ["Registration", "Vitals", "Clinician consult", "Investigations if needed", "Care plan"]


def radiology_pathway_report(snapshot: HospitalSnapshot) -> List[Dict[str, Any]]:
    report: List[Dict[str, Any]] = []
    for order in snapshot.radiology_orders:
        report.append(
            {
                "orderId": order.get("id"),
                "patientName": order.get("patientName"),
                "examType": order.get("examType"),
                "priority": order.get("priority"),
                "status": order.get("status"),
                "pathway": suggest_pathway(str(order.get("reason", ""))),
                "reportComplete": bool(order.get("reportFindings") and order.get("reportImpression")),
            }
        )
    return report


def require_human_approval(bill: Mapping[str, Any], threshold: float = 500.0) -> bool:
    return coerce_float(bill.get("amount")) >= threshold or str(bill.get("status", "")).lower() == "overdue"


def oversight_findings(snapshot: HospitalSnapshot) -> List[Finding]:
    findings: List[Finding] = []
    for result in triage_queue(snapshot):
        if result.priority == "Immediate":
            findings.append(
                Finding(
                    id=f"CLIN-TRIAGE-{result.appointment_id}",
                    category="clinical",
                    severity="high",
                    title="Immediate triage priority",
                    detail=f"{result.patient_name} scored {result.score}: {', '.join(result.reasons)}.",
                    target_path="/dashboard/doctor-queue",
                    recommendation="Assign a clinician immediately and document the decision.",
                )
            )
    for order in snapshot.radiology_orders:
        priority = str(order.get("priority", "")).lower()
        status = str(order.get("status", "")).lower()
        if priority == "stat" and status != "completed":
            findings.append(
                Finding(
                    id=f"CLIN-STAT-{order.get('id', 'unknown')}",
                    category="radiology",
                    severity="high",
                    title="STAT radiology order is open",
                    detail=f"Order {order.get('id')} for {order.get('patientName')} remains {status}.",
                    target_path="/dashboard/radiology",
                    recommendation="Notify the radiologist on duty and confirm an acquisition slot.",
                )
            )
    for bill in snapshot.bills:
        if require_human_approval(bill):
            findings.append(
                Finding(
                    id=f"CLIN-BILL-{bill.get('id', 'unknown')}",
                    category="human_oversight",
                    severity="medium",
                    title="Invoice requires human approval",
                    detail=f"Invoice {bill.get('id')} totals {bill.get('amount')} {bill.get('currency', 'USD')}.",
                    target_path="/dashboard/module/billing",
                    recommendation="A finance administrator must review before adjustment.",
                )
            )
    return findings
