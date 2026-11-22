"""Typed value objects shared by the CareOS analytics pipeline."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Sequence


def _timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


@dataclass(frozen=True)
class MetricPoint:
    """A single timestamped metric observation."""

    name: str
    value: float
    timestamp: datetime
    labels: Dict[str, str] = field(default_factory=dict)

    def with_value(self, value: float) -> "MetricPoint":
        return MetricPoint(self.name, value, self.timestamp, dict(self.labels))

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "value": self.value,
            "timestamp": self.timestamp.isoformat(),
            "labels": dict(self.labels),
        }


@dataclass
class Timeseries:
    """Ordered metric points plus small statistical helpers."""

    name: str
    points: List[MetricPoint] = field(default_factory=list)

    def add(self, point: MetricPoint) -> None:
        self.points.append(point)
        self.points.sort(key=lambda item: item.timestamp)

    def values(self) -> List[float]:
        return [point.value for point in self.points]

    def latest(self) -> Optional[MetricPoint]:
        return self.points[-1] if self.points else None

    def mean(self) -> float:
        values = self.values()
        return sum(values) / len(values) if values else 0.0

    def minimum(self) -> float:
        return min(self.values()) if self.points else 0.0

    def maximum(self) -> float:
        return max(self.values()) if self.points else 0.0

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "count": len(self.points),
            "mean": round(self.mean(), 3),
            "min": round(self.minimum(), 3),
            "max": round(self.maximum(), 3),
            "points": [point.as_dict() for point in self.points],
        }


@dataclass
class AgentSnapshot:
    """Normalized agent performance record."""

    id: str
    name: str
    short_name: str
    status: str
    assigned_tasks: int = 0
    completed_tasks: int = 0
    pending_tasks: int = 0
    avg_response_seconds: float = 0.0
    activity_count: int = 0
    outcomes: Dict[str, int] = field(default_factory=dict)

    @property
    def success_rate(self) -> float:
        if self.assigned_tasks <= 0:
            return 0.0
        return self.completed_tasks / self.assigned_tasks

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "shortName": self.short_name,
            "status": self.status,
            "assignedTasks": self.assigned_tasks,
            "completedTasks": self.completed_tasks,
            "pendingTasks": self.pending_tasks,
            "avgResponseSeconds": self.avg_response_seconds,
            "activityCount": self.activity_count,
            "successRate": round(self.success_rate, 4),
            "outcomes": dict(self.outcomes),
        }


@dataclass
class WorkflowSnapshot:
    """Normalized workflow execution record."""

    id: str
    code: str
    instruction: str
    status: str
    executed_at: Optional[str]
    execution_ms: int
    agents: List[str] = field(default_factory=list)
    message_count: int = 0
    alert_count: int = 0
    approval_count: int = 0
    open_approval_count: int = 0
    report_sections: int = 0

    @property
    def is_complete(self) -> bool:
        return self.status == "Completed"

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "code": self.code,
            "instruction": self.instruction,
            "status": self.status,
            "executedAt": self.executed_at,
            "executionMs": self.execution_ms,
            "agents": list(self.agents),
            "messageCount": self.message_count,
            "alertCount": self.alert_count,
            "approvalCount": self.approval_count,
            "openApprovalCount": self.open_approval_count,
            "reportSections": self.report_sections,
        }


@dataclass
class ResourceSnapshot:
    """Capacity view for beds, equipment, and rooms."""

    id: str
    name: str
    category: str
    department: str
    total: int = 0
    available: int = 0
    in_use: int = 0
    maintenance: int = 0

    @property
    def utilization(self) -> float:
        if self.total <= 0:
            return 0.0
        return self.in_use / self.total

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "department": self.department,
            "total": self.total,
            "available": self.available,
            "inUse": self.in_use,
            "maintenance": self.maintenance,
            "utilization": round(self.utilization, 4),
        }


@dataclass
class Finding:
    """A compliance or anomaly finding with a deterministic severity."""

    id: str
    category: str
    severity: str
    title: str
    detail: str
    target_path: str = ""
    recommendation: str = ""

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "category": self.category,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "targetPath": self.target_path,
            "recommendation": self.recommendation,
        }


@dataclass
class ReportBlock:
    """A section rendered into markdown and JSON report outputs."""

    title: str
    items: List[Dict[str, Any]] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "items": [dict(item) for item in self.items],
            "notes": list(self.notes),
        }


@dataclass
class HospitalSnapshot:
    """Point-in-time view of the entire CareOS demo database."""

    generated_at: datetime
    users: List[Dict[str, Any]] = field(default_factory=list)
    applications: List[Dict[str, Any]] = field(default_factory=list)
    hospitals: List[Dict[str, Any]] = field(default_factory=list)
    subscriptions: List[Dict[str, Any]] = field(default_factory=list)
    patients: List[Dict[str, Any]] = field(default_factory=list)
    appointments: List[Dict[str, Any]] = field(default_factory=list)
    prescriptions: List[Dict[str, Any]] = field(default_factory=list)
    radiology_orders: List[Dict[str, Any]] = field(default_factory=list)
    bills: List[Dict[str, Any]] = field(default_factory=list)
    departments: List[Dict[str, Any]] = field(default_factory=list)
    resources: List[ResourceSnapshot] = field(default_factory=list)
    agents: List[AgentSnapshot] = field(default_factory=list)
    workflows: List[Dict[str, Any]] = field(default_factory=list)
    executions: List[WorkflowSnapshot] = field(default_factory=list)
    notifications: List[Dict[str, Any]] = field(default_factory=list)
    tasks: List[Dict[str, Any]] = field(default_factory=list)
    staff: List[Dict[str, Any]] = field(default_factory=list)
    integrations: List[Dict[str, Any]] = field(default_factory=list)
    module_records: List[Dict[str, Any]] = field(default_factory=list)
    audit_logs: List[Dict[str, Any]] = field(default_factory=list)
    platform_activity: List[Dict[str, Any]] = field(default_factory=list)

    def collection(self, name: str) -> Sequence[Dict[str, Any]]:
        mapping: Dict[str, List[Dict[str, Any]]] = {
            "users": self.users,
            "applications": self.applications,
            "hospitals": self.hospitals,
            "subscriptions": self.subscriptions,
            "patients": self.patients,
            "appointments": self.appointments,
            "prescriptions": self.prescriptions,
            "radiologyOrders": self.radiology_orders,
            "bills": self.bills,
            "departments": self.departments,
            "workflows": self.workflows,
            "notifications": self.notifications,
            "tasks": self.tasks,
            "integrations": self.integrations,
            "moduleRecords": self.module_records,
            "auditLogs": self.audit_logs,
            "platformActivity": self.platform_activity,
        }
        return mapping.get(name, [])

    def parse_time(self, value: Optional[str]) -> Optional[datetime]:
        return _timestamp(value)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "generatedAt": self.generated_at.isoformat(),
            "counts": {
                "users": len(self.users),
                "applications": len(self.applications),
                "hospitals": len(self.hospitals),
                "patients": len(self.patients),
                "appointments": len(self.appointments),
                "prescriptions": len(self.prescriptions),
                "radiologyOrders": len(self.radiology_orders),
                "bills": len(self.bills),
                "departments": len(self.departments),
                "resources": len(self.resources),
                "agents": len(self.agents),
                "workflows": len(self.workflows),
                "executions": len(self.executions),
                "notifications": len(self.notifications),
                "tasks": len(self.tasks),
                "integrations": len(self.integrations),
                "moduleRecords": len(self.module_records),
                "auditLogs": len(self.audit_logs),
            },
            "agents": [agent.as_dict() for agent in self.agents],
            "resources": [resource.as_dict() for resource in self.resources],
            "executions": [execution.as_dict() for execution in self.executions],
        }


@dataclass
class AnalyticsReport:
    """Complete analytics output consumed by the CLI and HTTP service."""

    generated_at: datetime
    summary: Dict[str, Any]
    metrics: Dict[str, float]
    timeseries: List[Timeseries] = field(default_factory=list)
    agents: List[AgentSnapshot] = field(default_factory=list)
    findings: List[Finding] = field(default_factory=list)
    forecast: Dict[str, Any] = field(default_factory=dict)
    blocks: List[ReportBlock] = field(default_factory=list)

    def finding_counts(self) -> Dict[str, int]:
        counts: Dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for finding in self.findings:
            counts[finding.severity] = counts.get(finding.severity, 0) + 1
        return counts

    def as_dict(self) -> Dict[str, Any]:
        return {
            "generatedAt": self.generated_at.isoformat(),
            "summary": dict(self.summary),
            "metrics": {key: round(value, 4) for key, value in self.metrics.items()},
            "timeseries": [series.as_dict() for series in self.timeseries],
            "agents": [agent.as_dict() for agent in self.agents],
            "findings": [finding.as_dict() for finding in self.findings],
            "findingCounts": self.finding_counts(),
            "forecast": dict(self.forecast),
            "blocks": [block.as_dict() for block in self.blocks],
        }


def outcome_counts(items: Iterable[Dict[str, Any]], key: str = "outcome") -> Dict[str, int]:
    counts: Dict[str, int] = {}
    for item in items:
        value = str(item.get(key, "unknown"))
        counts[value] = counts.get(value, 0) + 1
    return counts


def coerce_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value))
        except ValueError:
            return default
    return default


def coerce_float(value: Any, default: float = 0.0) -> float:
    if isinstance(value, bool):
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return default
    return default
