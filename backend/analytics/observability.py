"""Lightweight observability primitives for the CareOS analytics service."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Deque, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .models import Finding, HospitalSnapshot, coerce_float


@dataclass
class SLO:
    name: str
    metric: str
    threshold: float
    comparator: str = "<="
    window_minutes: int = 60

    def evaluate(self, value: float) -> bool:
        if self.comparator == "<=":
            return value <= self.threshold
        if self.comparator == "<":
            return value < self.threshold
        if self.comparator == ">=":
            return value >= self.threshold
        if self.comparator == ">":
            return value > self.threshold
        return value == self.threshold

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "metric": self.metric,
            "threshold": self.threshold,
            "comparator": self.comparator,
            "windowMinutes": self.window_minutes,
        }


DEFAULT_SLOS: Sequence[SLO] = (
    SLO("patient-wait-p90", "p90_wait_minutes", 45),
    SLO("agent-success", "agent_success_rate", 80, ">="),
    SLO("radiology-completion", "radiology_completion_rate", 60, ">="),
    SLO("approval-backlog", "open_approval_count", 5),
    SLO("billing-collection", "billing_collection_rate", 50, ">="),
)


class CounterRegistry:
    def __init__(self) -> None:
        self._values: Dict[str, float] = defaultdict(float)
        self._labels: Dict[str, Dict[str, str]] = defaultdict(dict)

    def increment(self, name: str, amount: float = 1.0, **labels: str) -> None:
        self._values[name] += amount
        if labels:
            self._labels[name].update(labels)

    def value(self, name: str) -> float:
        return self._values.get(name, 0.0)

    def as_dict(self) -> Dict[str, Any]:
        return {
            name: {"value": round(value, 4), "labels": dict(self._labels.get(name, {}))}
            for name, value in sorted(self._values.items())
        }


class LatencyRecorder:
    def __init__(self, capacity: int = 500) -> None:
        self._samples: Deque[float] = deque(maxlen=capacity)

    def record_ms(self, value: float) -> None:
        self._samples.append(max(0.0, float(value)))

    def record_since(self, started: float) -> None:
        self.record_ms((time.perf_counter() - started) * 1000)

    def percentile(self, ratio: float) -> float:
        if not self._samples:
            return 0.0
        values = sorted(self._samples)
        index = max(0, min(len(values) - 1, int(round(ratio * (len(values) - 1)))))
        return values[index]

    def as_dict(self) -> Dict[str, Any]:
        return {
            "count": len(self._samples),
            "meanMs": round(sum(self._samples) / len(self._samples), 3) if self._samples else 0.0,
            "p50Ms": round(self.percentile(0.5), 3),
            "p95Ms": round(self.percentile(0.95), 3),
            "maxMs": round(max(self._samples), 3) if self._samples else 0.0,
        }


class EventLog:
    def __init__(self, capacity: int = 500) -> None:
        self._events: Deque[Dict[str, Any]] = deque(maxlen=capacity)

    def emit(self, level: str, message: str, **context: Any) -> None:
        self._events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": level,
            "message": message,
            "context": context,
        })

    def recent(self, count: int = 50) -> List[Dict[str, Any]]:
        return list(self._events)[-count:]

    def as_dict(self) -> Dict[str, Any]:
        return {"count": len(self._events), "events": self.recent()}


def evaluate_slos(metrics: Mapping[str, float], slos: Sequence[SLO] = DEFAULT_SLOS) -> List[Finding]:
    findings: List[Finding] = []
    for slo in slos:
        value = coerce_float(metrics.get(slo.metric))
        if slo.evaluate(value):
            continue
        findings.append(
            Finding(
                id=f"SLO-{slo.name}",
                category="reliability",
                severity="medium",
                title=f"SLO breached: {slo.name}",
                detail=f"Observed {value:.2f}; target {slo.comparator} {slo.threshold:.2f}.",
                target_path="/dashboard/analytics",
                recommendation="Review the underlying operational metric and restore the target before release.",
            )
        )
    return findings


def health_score(findings: Sequence[Finding]) -> float:
    penalties = {"critical": 25, "high": 10, "medium": 4, "low": 1}
    return max(0.0, 100.0 - sum(penalties.get(item.severity, 1) for item in findings))


def build_observability_report(
    snapshot: HospitalSnapshot,
    config: AnalyticsConfig,
    metrics: Mapping[str, float],
    counters: Optional[CounterRegistry] = None,
    latency: Optional[LatencyRecorder] = None,
    events: Optional[EventLog] = None,
) -> Dict[str, Any]:
    findings = evaluate_slos(metrics)
    return {
        "generatedAt": snapshot.generated_at.isoformat(),
        "windowMinutes": config.window_minutes,
        "healthScore": round(health_score(findings), 2),
        "slos": [slo.as_dict() for slo in DEFAULT_SLOS],
        "findings": [finding.as_dict() for finding in findings],
        "counters": counters.as_dict() if counters else {},
        "latency": latency.as_dict() if latency else {},
        "events": events.as_dict() if events else {"count": 0, "events": []},
    }
