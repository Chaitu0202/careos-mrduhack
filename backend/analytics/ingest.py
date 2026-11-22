"""Convert the raw CareOS JSON database into typed analytics snapshots."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional

from .config import AnalyticsConfig
from .models import (
    AgentSnapshot,
    HospitalSnapshot,
    ResourceSnapshot,
    WorkflowSnapshot,
    coerce_float,
    coerce_int,
    outcome_counts,
)
from .storage import normalize_database, read_json


def _as_dict_list(value: Any) -> List[Dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def _text(item: Mapping[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return default


def build_agent_snapshots(items: Iterable[Mapping[str, Any]]) -> List[AgentSnapshot]:
    snapshots: List[AgentSnapshot] = []
    for item in items:
        activity = _as_dict_list(item.get("recentActivity"))
        outcomes: Dict[str, int] = {}
        for entry in activity:
            key = str(entry.get("outcome", "unknown"))
            outcomes[key] = outcomes.get(key, 0) + 1
        if not outcomes:
            outcomes = outcome_counts(activity)
        snapshots.append(
            AgentSnapshot(
                id=_text(item, "id", default="agent-unknown"),
                name=_text(item, "name", default="Unnamed Agent"),
                short_name=_text(item, "shortName", default="Agent"),
                status=_text(item, "status", default="Active"),
                assigned_tasks=coerce_int(item.get("assignedTasks")),
                completed_tasks=coerce_int(item.get("completedTasks")),
                pending_tasks=coerce_int(item.get("pendingTasks")),
                avg_response_seconds=coerce_float(item.get("avgResponseSeconds")),
                activity_count=len(activity),
                outcomes=outcomes,
            )
        )
    return snapshots


def build_resource_snapshots(items: Iterable[Mapping[str, Any]]) -> List[ResourceSnapshot]:
    snapshots: List[ResourceSnapshot] = []
    for item in items:
        snapshots.append(
            ResourceSnapshot(
                id=_text(item, "id", default="resource-unknown"),
                name=_text(item, "name", default="Unnamed Resource"),
                category=_text(item, "category", default="Other"),
                department=_text(item, "department", default="Hospital-Wide"),
                total=coerce_int(item.get("total")),
                available=coerce_int(item.get("available")),
                in_use=coerce_int(item.get("inUse")),
                maintenance=coerce_int(item.get("maintenance")),
            )
        )
    return snapshots


def build_workflow_snapshots(items: Iterable[Mapping[str, Any]]) -> List[WorkflowSnapshot]:
    snapshots: List[WorkflowSnapshot] = []
    for item in items:
        approvals = _as_dict_list(item.get("pendingApprovals"))
        snapshots.append(
            WorkflowSnapshot(
                id=_text(item, "id", default="wfe-unknown"),
                code=_text(item, "workflowCode", default="WF-UNKNOWN"),
                instruction=_text(item, "instruction", default=""),
                status=_text(item, "status", default="Completed"),
                executed_at=item.get("executedAt") if isinstance(item.get("executedAt"), str) else None,
                execution_ms=coerce_int(item.get("executionMs")),
                agents=[str(value) for value in item.get("participatingAgents", []) if isinstance(value, str)],
                message_count=len(_as_dict_list(item.get("interAgentMessages"))),
                alert_count=len(_as_dict_list(item.get("departmentalAlerts"))),
                approval_count=len(approvals),
                open_approval_count=sum(1 for approval in approvals if not approval.get("approved", False)),
                report_sections=len(_as_dict_list(item.get("reportSections"))),
            )
        )
    return snapshots


def build_snapshot(raw: Mapping[str, Any], generated_at: Optional[datetime] = None) -> HospitalSnapshot:
    """Build a HospitalSnapshot from a normalized raw database mapping."""
    payload = normalize_database(raw)
    return HospitalSnapshot(
        generated_at=generated_at or datetime.now(timezone.utc),
        users=_as_dict_list(payload.get("users")),
        applications=_as_dict_list(payload.get("applications")),
        hospitals=_as_dict_list(payload.get("hospitals")),
        subscriptions=_as_dict_list(payload.get("subscriptions")),
        patients=_as_dict_list(payload.get("patients")),
        appointments=_as_dict_list(payload.get("appointments")),
        prescriptions=_as_dict_list(payload.get("prescriptions")),
        radiology_orders=_as_dict_list(payload.get("radiologyOrders")),
        bills=_as_dict_list(payload.get("bills")),
        departments=_as_dict_list(payload.get("departments")),
        resources=build_resource_snapshots(payload.get("resources", [])),
        agents=build_agent_snapshots(payload.get("agents", [])),
        workflows=_as_dict_list(payload.get("workflows")),
        executions=build_workflow_snapshots(payload.get("workflowExecutions", [])),
        notifications=_as_dict_list(payload.get("notifications")),
        tasks=_as_dict_list(payload.get("tasks")),
        staff=_as_dict_list(payload.get("staff")),
        integrations=_as_dict_list(payload.get("integrations")),
        module_records=_as_dict_list(payload.get("moduleRecords")),
        audit_logs=_as_dict_list(payload.get("auditLogs")),
        platform_activity=_as_dict_list(payload.get("platformActivity")),
    )


def load_snapshot(config: AnalyticsConfig) -> HospitalSnapshot:
    """Load the configured CareOS database and return a typed snapshot."""
    return build_snapshot(read_json(config.db_path))


def snapshot_from_path(path: Path, generated_at: Optional[datetime] = None) -> HospitalSnapshot:
    return build_snapshot(read_json(path), generated_at)


def summarize_snapshot(snapshot: HospitalSnapshot) -> Dict[str, Any]:
    """Small, stable summary used by CLI and HTTP endpoints."""
    admitted = sum(
        1
        for patient in snapshot.patients
        if str(patient.get("admissionStatus", "")).lower() not in {"discharged", "outpatient", ""}
    )
    open_approvals = sum(execution.open_approval_count for execution in snapshot.executions)
    unread = sum(1 for notification in snapshot.notifications if not notification.get("read", False))
    completed_agents = sum(agent.completed_tasks for agent in snapshot.agents)
    return {
        "patients": len(snapshot.patients),
        "appointments": len(snapshot.appointments),
        "radiologyOrders": len(snapshot.radiology_orders),
        "prescriptions": len(snapshot.prescriptions),
        "bills": len(snapshot.bills),
        "activeAdmissions": admitted,
        "agents": len(snapshot.agents),
        "agentTasksCompleted": completed_agents,
        "workflowDefinitions": len(snapshot.workflows),
        "workflowExecutions": len(snapshot.executions),
        "departmentalAlerts": sum(execution.alert_count for execution in snapshot.executions),
        "openApprovals": open_approvals,
        "unreadNotifications": unread,
        "moduleRecords": len(snapshot.module_records),
        "auditLogs": len(snapshot.audit_logs),
    }
