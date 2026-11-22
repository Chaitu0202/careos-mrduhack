"""Reliability scoring, error budgets, and dependency health for CareOS.

All calculations are deterministic and derive from the loaded snapshot so the
same demo data always produces the same review output. No network calls are
made; dependency checks model the integrations declared in the database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .models import Finding, HospitalSnapshot, coerce_float
from .observability import DEFAULT_SLOS, SLO

BURN_RATE_THRESHOLDS = (1.0, 2.0, 6.0, 14.4)
SEVERITY_BY_BURN = {14.4: "critical", 6.0: "high", 2.0: "medium", 1.0: "low"}


@dataclass
class ErrorBudget:
    slo: str
    metric: str
    target: float
    observed: float
    comparator: str
    window_days: int = 30

    @property
    def compliant(self) -> bool:
        value = self.observed
        return (
            value <= self.target if self.comparator == "<="
            else value < self.target if self.comparator == "<"
            else value >= self.target if self.comparator == ">="
            else value > self.target if self.comparator == ">"
            else value == self.target
        )

    @property
    def consumed_ratio(self) -> float:
        """Fraction of the error budget already spent, clamped to [0, 2]."""
        if self.compliant:
            denominator = abs(self.target) if self.target else 1.0
            delta = abs(self.observed - self.target) if self.target else 0.0
            return min(1.0, delta / denominator)
        denominator = abs(self.target) if self.target else 1.0
        return min(2.0, 1.0 + (abs(self.observed - self.target) / denominator))

    @property
    def remaining_ratio(self) -> float:
        return max(0.0, 1.0 - self.consumed_ratio)

    @property
    def burn_rate(self) -> float:
        return round(1.0 + self.consumed_ratio, 3)

    @property
    def status(self) -> str:
        if self.compliant and self.consumed_ratio < 0.5:
            return "healthy"
        if self.compliant:
            return "watch"
        if self.burn_rate >= 14.4:
            return "exhausted"
        if self.burn_rate >= 6.0:
            return "critical"
        return "breached"

    def as_dict(self) -> Dict[str, Any]:
        return {
            "slo": self.slo,
            "metric": self.metric,
            "target": self.target,
            "observed": round(self.observed, 4),
            "comparator": self.comparator,
            "windowDays": self.window_days,
            "compliant": self.compliant,
            "consumedRatio": round(self.consumed_ratio, 4),
            "remainingRatio": round(self.remaining_ratio, 4),
            "burnRate": self.burn_rate,
            "status": self.status,
        }


def build_error_budgets(metrics: Mapping[str, float], slos: Sequence[SLO] = DEFAULT_SLOS) -> List[ErrorBudget]:
    budgets: List[ErrorBudget] = []
    for slo in slos:
        budgets.append(
            ErrorBudget(
                slo=slo.name,
                metric=slo.metric,
                target=slo.threshold,
                observed=coerce_float(metrics.get(slo.metric)),
                comparator=slo.comparator,
                window_days=max(1, slo.window_minutes // (24 * 60) or 30),
            )
        )
    return budgets


def burn_rate_findings(budgets: Sequence[ErrorBudget]) -> List[Finding]:
    findings: List[Finding] = []
    for budget in budgets:
        if budget.compliant and budget.consumed_ratio < 0.75:
            continue
        threshold = next(
            (value for value in reversed(BURN_RATE_THRESHOLDS) if budget.burn_rate >= value),
            1.0,
        )
        severity = SEVERITY_BY_BURN[threshold]
        findings.append(
            Finding(
                id=f"REL-BURN-{budget.slo}",
                category="reliability",
                severity=severity,
                title=f"Error budget pressure: {budget.slo}",
                detail=(
                    f"Observed {budget.observed:.2f} against target "
                    f"{budget.comparator} {budget.target:.2f}; burn rate {budget.burn_rate}."
                ),
                target_path="/dashboard/analytics",
                recommendation="Freeze risky releases and prioritize the underlying operational metric.",
            )
        )
    return findings


@dataclass
class DependencyStatus:
    name: str
    category: str
    required: bool
    configured: bool
    detail: str

    @property
    def healthy(self) -> bool:
        return self.configured or not self.required

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "category": self.category,
            "required": self.required,
            "configured": self.configured,
            "healthy": self.healthy,
            "detail": self.detail,
        }


REQUIRED_INTEGRATIONS = {
    "Electronic Health Record": True,
    "Radiology Information System": True,
    "Pharmacy Management": False,
    "Insurance Claims Gateway": False,
}


def assess_dependencies(snapshot: HospitalSnapshot, environment: Mapping[str, str]) -> List[DependencyStatus]:
    rows: List[DependencyStatus] = []
    for integration in snapshot.integrations:
        name = str(integration.get("name", "Unknown"))
        connected = bool(integration.get("connected"))
        rows.append(
            DependencyStatus(
                name=name,
                category=str(integration.get("category", "clinical")),
                required=REQUIRED_INTEGRATIONS.get(name, False),
                configured=connected,
                detail=f"Protocol {integration.get('protocol', 'n/a')}; availability {integration.get('availability', 'unknown')}.",
            )
        )
    gemini_key = any(environment.get(key) for key in ("GEMINI_API_KEY1", "GEMINI_API_KEY", "GOOGLE_API_KEY", "API_KEY"))
    rows.append(DependencyStatus("Gemini Orchestration", "ai", False, gemini_key, "Live orchestration is optional; seeded history works without it."))
    postgres = bool(environment.get("DATABASE_URL"))
    rows.append(DependencyStatus("PostgreSQL", "database", False, postgres, "Relational target is optional while the JSON preview store is active."))
    analytics_key = bool(environment.get("CAREOS_ANALYTICS_KEY"))
    rows.append(DependencyStatus("Analytics API Key", "security", False, analytics_key, "Protects analytics endpoints when configured."))
    return rows


def dependency_findings(rows: Sequence[DependencyStatus]) -> List[Finding]:
    findings: List[Finding] = []
    for row in rows:
        if row.healthy:
            continue
        findings.append(
            Finding(
                id=f"REL-DEP-{row.name.lower().replace(' ', '-')}",
                category="dependency",
                severity="high",
                title=f"Required dependency unavailable: {row.name}",
                detail=row.detail,
                target_path="/dashboard/operations?tab=integrations",
                recommendation="Configure the integration before enabling the dependent workflow.",
            )
        )
    return findings


def reliability_score(budgets: Sequence[ErrorBudget], dependencies: Sequence[DependencyStatus]) -> float:
    penalties = {"exhausted": 20, "critical": 12, "breached": 8, "watch": 3}
    score = 100.0
    for budget in budgets:
        score -= penalties.get(budget.status, 0)
    score -= 10 * sum(1 for row in dependencies if not row.healthy)
    return max(0.0, round(score, 2))


def incident_triggers(budgets: Sequence[ErrorBudget], dependencies: Sequence[DependencyStatus]) -> List[Dict[str, str]]:
    triggers: List[Dict[str, str]] = []
    for budget in budgets:
        if budget.status in {"critical", "exhausted"}:
            triggers.append(
                {
                    "id": f"INC-{budget.slo}",
                    "severity": "high" if budget.status == "critical" else "critical",
                    "title": f"Open incident for {budget.slo}",
                    "action": "Page the owning service team and freeze non-essential deploys.",
                }
            )
    for row in dependencies:
        if not row.healthy:
            triggers.append(
                {
                    "id": f"INC-DEP-{row.name.lower().replace(' ', '-')}",
                    "severity": "high",
                    "title": f"Restore {row.name}",
                    "action": "Verify credentials and connectivity, then replay queued events.",
                }
            )
    return triggers


@dataclass
class ReliabilityReport:
    generated_at: datetime
    score: float
    budgets: List[ErrorBudget] = field(default_factory=list)
    dependencies: List[DependencyStatus] = field(default_factory=list)
    findings: List[Finding] = field(default_factory=list)
    triggers: List[Dict[str, str]] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "generatedAt": self.generated_at.isoformat(),
            "score": self.score,
            "budgets": [budget.as_dict() for budget in self.budgets],
            "dependencies": [row.as_dict() for row in self.dependencies],
            "findings": [finding.as_dict() for finding in self.findings],
            "triggers": self.triggers,
        }


def build_reliability_report(
    snapshot: HospitalSnapshot,
    config: AnalyticsConfig,
    metrics: Mapping[str, float],
    environment: Optional[Mapping[str, str]] = None,
) -> ReliabilityReport:
    budgets = build_error_budgets(metrics)
    dependencies = assess_dependencies(snapshot, environment or {})
    findings = burn_rate_findings(budgets) + dependency_findings(dependencies)
    return ReliabilityReport(
        generated_at=snapshot.generated_at,
        score=reliability_score(budgets, dependencies),
        budgets=budgets,
        dependencies=dependencies,
        findings=findings,
        triggers=incident_triggers(budgets, dependencies),
    )
