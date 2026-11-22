"""Unified command-center aggregation for CareOS operational review."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .audit import verify_audit_trail
from .clinical_rules import oversight_findings, triage_queue
from .config import AnalyticsConfig
from .ingest import summarize_snapshot
from .models import Finding, HospitalSnapshot
from .nlp import intent_catalog
from .observability import health_score
from .privacy import assess_privacy
from .quality import QualityEngine
from .scheduling import scheduling_summary


@dataclass
class AttentionItem:
    id: str
    severity: str
    title: str
    detail: str
    target_path: str
    source: str

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "severity": self.severity,
            "title": self.title,
            "detail": self.detail,
            "targetPath": self.target_path,
            "source": self.source,
        }


SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def collect_findings(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> List[Finding]:
    findings: List[Finding] = []
    findings.extend(QualityEngine().evaluate(snapshot))
    findings.extend(oversight_findings(snapshot))
    findings.extend(verify_audit_trail(snapshot, config).findings)
    findings.extend(privacy_findings(snapshot))
    findings.sort(key=lambda item: (SEVERITY_RANK.get(item.severity, 9), item.id))
    return findings


def privacy_findings(snapshot: HospitalSnapshot) -> List[Finding]:
    from .privacy import privacy_gate

    return privacy_gate(assess_privacy(snapshot))


def to_attention_items(findings: Sequence[Finding], limit: int = 12) -> List[AttentionItem]:
    return [
        AttentionItem(
            id=finding.id,
            severity=finding.severity,
            title=finding.title,
            detail=finding.detail,
            target_path=finding.target_path,
            source=finding.category,
        )
        for finding in findings[:limit]
    ]


def hospital_performance(snapshot: HospitalSnapshot) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for hospital in snapshot.hospitals:
        name = str(hospital.get("hospitalName") or hospital.get("name") or "Hospital")
        rows.append(
            {
                "id": hospital.get("id"),
                "hospitalId": hospital.get("hospitalId"),
                "name": name,
                "status": hospital.get("workspaceStatus", "Active"),
                "beds": hospital.get("bedsCount", 0),
                "departments": hospital.get("departmentsCount", 0),
                "activeUsers": hospital.get("activeUsersCount", 0),
                "plan": hospital.get("subscriptionPlan", "Enterprise"),
            }
        )
    if not rows:
        rows.append(
            {
                "id": "demo-hospital",
                "hospitalId": "HSP-00001",
                "name": "CareOS Demo Medical Center",
                "status": "Active",
                "beds": 240,
                "departments": 12,
                "activeUsers": 36,
                "plan": "Enterprise",
            }
        )
    return rows


def live_activity(snapshot: HospitalSnapshot, limit: int = 10) -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for item in snapshot.platform_activity:
        entries.append(
            {
                "id": item.get("id"),
                "message": item.get("message"),
                "category": item.get("category"),
                "timestamp": item.get("timestamp"),
            }
        )
    for execution in snapshot.executions:
        entries.append(
            {
                "id": f"activity-{execution.id}",
                "message": f"{execution.code} completed with status {execution.status}.",
                "category": "workflow",
                "timestamp": execution.executed_at,
            }
        )
    entries.sort(key=lambda item: str(item.get("timestamp") or ""), reverse=True)
    return entries[:limit]


def agent_snapshot_cards(snapshot: HospitalSnapshot) -> List[Dict[str, Any]]:
    cards: List[Dict[str, Any]] = []
    for agent in snapshot.agents:
        cards.append(
            {
                "id": agent.id,
                "name": agent.name,
                "shortName": agent.short_name,
                "status": agent.status,
                "assignedTasks": agent.assigned_tasks,
                "completedTasks": agent.completed_tasks,
                "pendingTasks": agent.pending_tasks,
                "successRate": round(agent.success_rate * 100, 1),
                "recentActivity": agent.activity_count,
            }
        )
    cards.sort(key=lambda row: -row["completedTasks"])
    return cards


def build_command_center(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> Dict[str, Any]:
    findings = collect_findings(snapshot, config)
    attention = to_attention_items(findings)
    return {
        "generatedAt": snapshot.generated_at.isoformat(),
        "summary": summarize_snapshot(snapshot),
        "healthScore": round(health_score(findings), 2),
        "attentionItems": [item.as_dict() for item in attention],
        "findingCounts": {
            "critical": sum(1 for finding in findings if finding.severity == "critical"),
            "high": sum(1 for finding in findings if finding.severity == "high"),
            "medium": sum(1 for finding in findings if finding.severity == "medium"),
            "low": sum(1 for finding in findings if finding.severity == "low"),
        },
        "triage": [result.as_dict() for result in triage_queue(snapshot)[:8]],
        "agents": agent_snapshot_cards(snapshot),
        "scheduling": scheduling_summary(snapshot),
        "hospitals": hospital_performance(snapshot),
        "liveActivity": live_activity(snapshot),
        "intentCatalog": intent_catalog(),
    }


class CommandCenterCache:
    def __init__(self, ttl_seconds: int = 60) -> None:
        self.ttl_seconds = ttl_seconds
        self._payload: Optional[Dict[str, Any]] = None
        self._built_at: Optional[datetime] = None

    def get(self, snapshot: HospitalSnapshot, config: AnalyticsConfig) -> Dict[str, Any]:
        now = datetime.now(timezone.utc)
        if self._payload and self._built_at and (now - self._built_at).total_seconds() < self.ttl_seconds:
            return self._payload
        self._payload = build_command_center(snapshot, config)
        self._built_at = now
        return self._payload

    def invalidate(self) -> None:
        self._payload = None
        self._built_at = None
