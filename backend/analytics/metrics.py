"""Operational metric calculations for CareOS snapshots."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from statistics import mean, median, pstdev
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .models import (
    HospitalSnapshot,
    MetricPoint,
    Timeseries,
    coerce_float,
    coerce_int,
)


def safe_divide(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator else 0.0


def parse_timestamp(value: Any) -> Optional[datetime]:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def percentile(values: Sequence[float], ratio: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = max(0.0, min(1.0, ratio)) * (len(ordered) - 1)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def build_metric_registry(snapshot: HospitalSnapshot) -> Dict[str, Timeseries]:
    """Create timeseries for every metric the Python service tracks."""
    registry: Dict[str, Timeseries] = {name: Timeseries(name) for name in (
        "appointments",
        "waiting_patients",
        "average_wait_minutes",
        "bed_occupancy",
        "radiology_queue",
        "open_approvals",
        "agent_completed_tasks",
        "agent_success_rate",
        "workflow_execution_ms",
        "module_flagged_records",
    )}

    base = snapshot.generated_at
    appointments_by_hour: Dict[int, int] = {}
    for appointment in snapshot.appointments:
        stamp = parse_timestamp(appointment.get("createdAt") or appointment.get("queueJoinedAt"))
        bucket = stamp.hour if stamp else base.hour
        appointments_by_hour[bucket] = appointments_by_hour.get(bucket, 0) + 1
    for hour in sorted(appointments_by_hour):
        registry["appointments"].add(MetricPoint("appointments", float(appointments_by_hour[hour]), base.replace(hour=hour)))

    waits: Dict[int, List[float]] = {}
    for appointment in snapshot.appointments:
        stamp = parse_timestamp(appointment.get("queueJoinedAt"))
        bucket = stamp.hour if stamp else base.hour
        waits.setdefault(bucket, []).append(coerce_float(appointment.get("waitingMinutes")))
    for hour in sorted(waits):
        values = waits[hour]
        registry["waiting_patients"].add(MetricPoint("waiting_patients", float(len(values)), base.replace(hour=hour)))
        registry["average_wait_minutes"].add(MetricPoint("average_wait_minutes", mean(values), base.replace(hour=hour)))

    for index, resource in enumerate(snapshot.resources):
        stamp = base - timedelta(minutes=10 * index)
        registry["bed_occupancy"].add(MetricPoint("bed_occupancy", resource.utilization * 100, stamp, {"resource": resource.id}))

    open_orders = [order for order in snapshot.radiology_orders if str(order.get("status", "")).lower() != "completed"]
    registry["radiology_queue"].add(MetricPoint("radiology_queue", float(len(open_orders)), base))

    approvals = sum(execution.open_approval_count for execution in snapshot.executions)
    registry["open_approvals"].add(MetricPoint("open_approvals", float(approvals), base))

    for agent in snapshot.agents:
        stamp = base - timedelta(minutes=15)
        registry["agent_completed_tasks"].add(
            MetricPoint("agent_completed_tasks", float(agent.completed_tasks), stamp, {"agent": agent.id})
        )
        registry["agent_success_rate"].add(
            MetricPoint("agent_success_rate", agent.success_rate, stamp, {"agent": agent.id})
        )

    for execution in snapshot.executions:
        registry["workflow_execution_ms"].add(
            MetricPoint("workflow_execution_ms", float(execution.execution_ms), parse_timestamp(execution.executed_at) or base)
        )

    flagged = sum(1 for record in snapshot.module_records if str(record.get("status", "")).lower() == "flagged")
    registry["module_flagged_records"].add(MetricPoint("module_flagged_records", float(flagged), base))
    return registry


def compute_core_metrics(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> Dict[str, float]:
    appointments = snapshot.appointments
    waits = [coerce_float(item.get("waitingMinutes")) for item in appointments]
    total_beds = sum(resource.total for resource in snapshot.resources if "bed" in resource.name.lower())
    used_beds = sum(resource.in_use for resource in snapshot.resources if "bed" in resource.name.lower())
    if total_beds == 0:
        total_beds = sum(resource.total for resource in snapshot.resources)
        used_beds = sum(resource.in_use for resource in snapshot.resources)

    bills = snapshot.bills
    billed_total = sum(coerce_float(bill.get("amount")) for bill in bills)
    paid_total = sum(coerce_float(bill.get("amount")) for bill in bills if str(bill.get("status", "")).lower() == "paid")

    completed_radiology = sum(1 for order in snapshot.radiology_orders if str(order.get("status", "")).lower() == "completed")
    assigned = sum(agent.assigned_tasks for agent in snapshot.agents)
    completed = sum(agent.completed_tasks for agent in snapshot.agents)
    execution_times = [float(execution.execution_ms) for execution in snapshot.executions]

    return {
        "patient_count": float(len(snapshot.patients)),
        "appointment_count": float(len(appointments)),
        "average_wait_minutes": mean(waits) if waits else 0.0,
        "median_wait_minutes": median(waits) if waits else 0.0,
        "p90_wait_minutes": percentile(waits, 0.9),
        "bed_occupancy_percent": safe_divide(used_beds * 100.0, float(total_beds)),
        "available_beds": float(sum(resource.available for resource in snapshot.resources if "bed" in resource.name.lower())),
        "radiology_completion_rate": safe_divide(completed_radiology * 100.0, float(len(snapshot.radiology_orders))),
        "billing_total_usd": billed_total,
        "billing_collected_usd": paid_total,
        "billing_collection_rate": safe_divide(paid_total * 100.0, billed_total),
        "agent_success_rate": safe_divide(completed * 100.0, float(assigned)),
        "agent_avg_response_seconds": mean([agent.avg_response_seconds for agent in snapshot.agents]) if snapshot.agents else 0.0,
        "workflow_execution_count": float(len(snapshot.executions)),
        "workflow_avg_execution_ms": mean(execution_times) if execution_times else 0.0,
        "workflow_p95_execution_ms": percentile(execution_times, 0.95),
        "open_approval_count": float(sum(execution.open_approval_count for execution in snapshot.executions)),
        "flagged_module_records": float(sum(1 for record in snapshot.module_records if str(record.get("status", "")).lower() == "flagged")),
        "audit_event_count": float(len(snapshot.audit_logs)),
        "sample_stddev_wait": pstdev(waits) if len(waits) > 1 else 0.0,
        "analytics_window_minutes": float(config.window_minutes),
    }


def compute_agent_leaderboard(snapshot: HospitalSnapshot) -> List[Dict[str, Any]]:
    leaderboard: List[Dict[str, Any]] = []
    for agent in snapshot.agents:
        leaderboard.append(
            {
                "id": agent.id,
                "name": agent.name,
                "status": agent.status,
                "completedTasks": agent.completed_tasks,
                "pendingTasks": agent.pending_tasks,
                "successRate": round(agent.success_rate * 100.0, 2),
                "avgResponseSeconds": round(agent.avg_response_seconds, 2),
                "activityCount": agent.activity_count,
            }
        )
    leaderboard.sort(key=lambda row: (-row["completedTasks"], row["name"]))
    return leaderboard


def compute_department_pressure(snapshot: HospitalSnapshot) -> List[Dict[str, Any]]:
    pressure: List[Dict[str, Any]] = []
    for department in snapshot.departments:
        name = str(department.get("name", "Unknown"))
        appointments = sum(1 for item in snapshot.appointments if str(item.get("department", "")) == name)
        waits = [
            coerce_float(item.get("waitingMinutes"))
            for item in snapshot.appointments
            if str(item.get("department", "")) == name
        ]
        pressure.append(
            {
                "department": name,
                "head": department.get("head", ""),
                "status": department.get("status", "Nominal"),
                "activePatients": coerce_int(department.get("activePatients")),
                "occupiedBeds": coerce_int(department.get("occupiedBeds")),
                "bedCapacity": coerce_int(department.get("bedCapacity")),
                "appointments": appointments,
                "averageWaitMinutes": round(mean(waits), 2) if waits else 0.0,
                "loadScore": round(
                    coerce_int(department.get("activePatients")) * 0.5
                    + coerce_int(department.get("occupiedBeds")) * 0.3
                    + (mean(waits) if waits else 0.0) * 0.2,
                    2,
                ),
            }
        )
    pressure.sort(key=lambda row: -row["loadScore"])
    return pressure


def compute_module_health(snapshot: HospitalSnapshot) -> Dict[str, Dict[str, Any]]:
    health: Dict[str, Dict[str, Any]] = {}
    for record in snapshot.module_records:
        module = str(record.get("module", "unknown"))
        bucket = health.setdefault(module, {"total": 0, "completed": 0, "flagged": 0, "pending": 0})
        bucket["total"] += 1
        status = str(record.get("status", "")).lower()
        if status == "completed":
            bucket["completed"] += 1
        elif status == "flagged":
            bucket["flagged"] += 1
        elif status in {"pending review", "active"}:
            bucket["pending"] += 1
    for bucket in health.values():
        bucket["completionRate"] = round(safe_divide(bucket["completed"] * 100.0, bucket["total"]), 2)
    return health


def compute_financial_summary(snapshot: HospitalSnapshot) -> Dict[str, Any]:
    by_status: Dict[str, float] = {}
    for bill in snapshot.bills:
        status = str(bill.get("status", "unknown"))
        by_status[status] = by_status.get(status, 0.0) + coerce_float(bill.get("amount"))
    subscriptions = sum(coerce_float(item.get("monthlyPriceUsd")) for item in snapshot.subscriptions)
    return {
        "invoiceTotalUsd": round(sum(by_status.values()), 2),
        "byStatusUsd": {key: round(value, 2) for key, value in by_status.items()},
        "monthlyRecurringUsd": round(subscriptions, 2),
        "averageInvoiceUsd": round(mean([coerce_float(b.get("amount")) for b in snapshot.bills]) if snapshot.bills else 0.0, 2),
    }


def compute_throughput(snapshot: HospitalSnapshot, window_hours: int = 24) -> Dict[str, Any]:
    cutoff = snapshot.generated_at - timedelta(hours=window_hours)
    recent = [item for item in snapshot.appointments if (parse_timestamp(item.get("createdAt")) or cutoff) >= cutoff]
    completed = [item for item in recent if str(item.get("status", "")).lower() == "completed"]
    return {
        "windowHours": window_hours,
        "appointmentsInWindow": len(recent),
        "completedInWindow": len(completed),
        "completionRate": round(safe_divide(len(completed) * 100.0, len(recent)), 2),
        "arrivalsPerHour": round(safe_divide(len(recent), float(window_hours)), 3),
    }


def calculate_all(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> Dict[str, Any]:
    """Return every derived metric family in one deterministic mapping."""
    return {
        "core": compute_core_metrics(snapshot, config),
        "agents": compute_agent_leaderboard(snapshot),
        "departments": compute_department_pressure(snapshot),
        "modules": compute_module_health(snapshot),
        "finance": compute_financial_summary(snapshot),
        "throughput": compute_throughput(snapshot),
    }
