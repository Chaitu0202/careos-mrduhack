"""Deterministic anomaly detection over CareOS operational snapshots."""

from __future__ import annotations

from datetime import timedelta
from statistics import mean, pstdev
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .metrics import parse_timestamp
from .models import Finding, HospitalSnapshot, Timeseries, coerce_float, coerce_int


def make_finding(
    identifier: str,
    category: str,
    severity: str,
    title: str,
    detail: str,
    target: str = "",
    recommendation: str = "",
) -> Finding:
    return Finding(identifier, category, severity, title, detail, target, recommendation)


def detect_zscore_outliers(series: Timeseries, threshold: float = 2.0) -> List[MetricPoint]:
    values = series.values()
    if len(values) < 3:
        return []
    sigma = pstdev(values)
    if sigma == 0:
        return []
    average = mean(values)
    return [point for point in series.points if abs(point.value - average) / sigma > threshold]


def detect_iqr_outliers(values: Sequence[float]) -> List[float]:
    if len(values) < 4:
        return []
    ordered = sorted(values)
    mid = len(ordered) // 2
    lower_half = ordered[:mid]
    upper_half = ordered[mid:] if len(ordered) % 2 == 0 else ordered[mid + 1 :]
    q1 = lower_half[len(lower_half) // 2]
    q2 = upper_half[len(upper_half) // 2]
    spread = q2 - q1
    if spread <= 0:
        return []
    floor = q1 - 1.5 * spread
    ceiling = q2 + 1.5 * spread
    return [value for value in values if value < floor or value > ceiling]


def detect_wait_time_anomalies(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    waits = [coerce_float(item.get("waitingMinutes")) for item in snapshot.appointments]
    outlier_values = detect_iqr_outliers(waits)
    if outlier_values:
        findings.append(
            make_finding(
                "ANO-WAIT-001",
                "patient_flow",
                "medium",
                "Outlier wait times detected",
                f"{len(outlier_values)} appointments exceed the interquartile range (values: {outlier_values[:5]}).",
                "/dashboard/doctor-queue",
                "Review triage priority and redistribute waiting patients to available clinicians.",
            )
        )

    for appointment in snapshot.appointments:
        wait = coerce_float(appointment.get("waitingMinutes"))
        department = str(appointment.get("department", "Unknown"))
        limit = (
            config.thresholds.emergency_wait_minutes
            if department.lower() == "emergency"
            else config.thresholds.radiology_wait_minutes
            if department.lower() == "radiology"
            else config.thresholds.emergency_wait_minutes + 5
        )
        if wait > limit:
            findings.append(
                make_finding(
                    f"ANO-WAIT-{appointment.get('id', 'unknown')}",
                    "patient_flow",
                    "high" if wait > limit * 1.5 else "medium",
                    f"Long wait in {department}",
                    f"{appointment.get('patientName', 'Patient')} has waited {wait:.0f} minutes (limit {limit}).",
                    "/dashboard/doctor-queue",
                    "Assign an additional clinician or fast-track the patient to imaging.",
                )
            )
    return findings


def detect_capacity_anomalies(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    for resource in snapshot.resources:
        if resource.total <= 0:
            findings.append(
                make_finding(
                    f"ANO-CAP-{resource.id}",
                    "capacity",
                    "high",
                    "Resource has zero capacity",
                    f"{resource.name} reports total=0.",
                    "/dashboard/resources",
                    "Correct the source capacity record before publishing dashboards.",
                )
            )
            continue
        if resource.utilization * 100 >= config.thresholds.bed_occupancy_percent:
            findings.append(
                make_finding(
                    f"ANO-CAP-{resource.id}",
                    "capacity",
                    "high" if resource.available == 0 else "medium",
                    "High resource utilization",
                    f"{resource.name} is {resource.utilization * 100:.1f}% utilized with {resource.available} available.",
                    "/dashboard/resources",
                    "Prepare overflow capacity and review maintenance schedules.",
                )
            )
        if resource.maintenance > max(2, int(resource.total * 0.1)):
            findings.append(
                make_finding(
                    f"ANO-MAINT-{resource.id}",
                    "capacity",
                    "low",
                    "Elevated maintenance count",
                    f"{resource.name} has {resource.maintenance} units under maintenance.",
                    "/dashboard/resources",
                    "Confirm vendor ETA and update the expected return-to-service date.",
                )
            )
    return findings


def detect_agent_anomalies(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    for agent in snapshot.agents:
        if agent.success_rate < config.thresholds.agent_success_rate_min and agent.assigned_tasks > 0:
            findings.append(
                make_finding(
                    f"ANO-AGENT-{agent.id}",
                    "agent_performance",
                    "medium",
                    "Agent success rate below target",
                    f"{agent.name} completed {agent.success_rate * 100:.1f}% of assigned tasks.",
                    "/dashboard/agents",
                    "Inspect failed task logs and rebalance workload across the agent pool.",
                )
            )
        if agent.pending_tasks > config.thresholds.pending_approval_limit:
            findings.append(
                make_finding(
                    f"ANO-AGENT-Q-{agent.id}",
                    "agent_performance",
                    "medium",
                    "Agent queue backlog",
                    f"{agent.name} has {agent.pending_tasks} pending tasks.",
                    "/dashboard/agents",
                    "Increase dispatch concurrency or route low-risk tasks to Operations Agent.",
                )
            )
        if agent.avg_response_seconds > 5:
            findings.append(
                make_finding(
                    f"ANO-AGENT-LAT-{agent.id}",
                    "agent_performance",
                    "low",
                    "Elevated agent latency",
                    f"{agent.name} averages {agent.avg_response_seconds:.2f}s per response.",
                    "/dashboard/agents",
                    "Review tool latency and cache repeated hospital context queries.",
                )
            )
    return findings


def detect_workflow_anomalies(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    durations = [float(execution.execution_ms) for execution in snapshot.executions]
    outliers = detect_iqr_outliers(durations)
    if outliers:
        findings.append(
            make_finding(
                "ANO-WF-DURATION",
                "workflow",
                "medium",
                "Slow workflow executions",
                f"{len(outliers)} executions exceeded the normal duration band.",
                "/dashboard/operations?tab=workflows",
                "Profile the slowest inter-agent step and trim redundant context queries.",
            )
        )
    for execution in snapshot.executions:
        if execution.open_approval_count > 0:
            findings.append(
                make_finding(
                    f"ANO-WF-APPR-{execution.id}",
                    "governance",
                    "high" if execution.open_approval_count > 2 else "medium",
                    "Workflow awaiting human approval",
                    f"{execution.code} has {execution.open_approval_count} open approval(s).",
                    "/dashboard",
                    "Review and approve or reject the pending items from the orchestration report.",
                )
            )
        if execution.status == "Issue Detected":
            findings.append(
                make_finding(
                    f"ANO-WF-ERR-{execution.id}",
                    "workflow",
                    "critical",
                    "Workflow reported an issue",
                    f"{execution.code} ended with Issue Detected.",
                    "/dashboard/operations?tab=workflows",
                    "Inspect the execution log and rerun after correcting the source data.",
                )
            )
    return findings


def detect_data_quality_anomalies(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    for patient in snapshot.patients:
        if not patient.get("mrn") or not patient.get("attendingDoctor"):
            findings.append(
                make_finding(
                    f"ANO-DATA-{patient.get('id', 'unknown')}",
                    "data_quality",
                    "medium",
                    "Incomplete patient record",
                    f"Patient {patient.get('fullName', 'Unknown')} is missing MRN or attending doctor.",
                    "/dashboard/patients",
                    "Complete the registry fields before clinical handoff.",
                )
            )
    for bill in snapshot.bills:
        if coerce_float(bill.get("amount")) <= 0:
            findings.append(
                make_finding(
                    f"ANO-BILL-{bill.get('id', 'unknown')}",
                    "billing",
                    "high",
                    "Non-positive invoice amount",
                    f"Invoice {bill.get('id', 'unknown')} has amount {bill.get('amount')}.",
                    "/dashboard/module/billing",
                    "Void the invoice and regenerate it from the verified encounter.",
                )
            )
    return findings


def detect_all(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    findings.extend(detect_wait_time_anomalies(snapshot, config))
    findings.extend(detect_capacity_anomalies(snapshot, config))
    findings.extend(detect_agent_anomalies(snapshot, config))
    findings.extend(detect_workflow_anomalies(snapshot, config))
    findings.extend(detect_data_quality_anomalies(snapshot, config))
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda item: (severity_order.get(item.severity, 9), item.id))
    return findings
