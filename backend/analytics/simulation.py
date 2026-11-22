"""Deterministic discrete-event style capacity simulation for CareOS.

The simulator is intentionally dependency-free and seeded, so repeated CI runs
produce identical outputs. It helps reviewers see how the seeded snapshot could
be used for planning without touching preview behavior.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import ceil
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .models import HospitalSnapshot, coerce_int


@dataclass
class SimulationResult:
    scenario: str
    arrivals: int
    served: int
    average_wait_minutes: float
    maximum_wait_minutes: int
    abandoned: int
    utilization: float
    hourly: List[Dict[str, Any]] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "scenario": self.scenario,
            "arrivals": self.arrivals,
            "served": self.served,
            "averageWaitMinutes": round(self.average_wait_minutes, 2),
            "maximumWaitMinutes": self.maximum_wait_minutes,
            "abandoned": self.abandoned,
            "utilization": round(self.utilization, 4),
            "hourly": list(self.hourly),
        }


@dataclass(frozen=True)
class SimulationInput:
    arrivals: int
    service_minutes: int
    servers: int
    horizon_minutes: int = 480
    patience_minutes: int = 90

    def validated(self) -> "SimulationInput":
        if self.arrivals < 0 or self.service_minutes <= 0 or self.servers <= 0 or self.horizon_minutes <= 0:
            raise ValueError("Simulation inputs must be non-negative with positive service and server counts")
        return self


def simulate(scenario: str, params: SimulationInput) -> SimulationResult:
    spec = params.validated()
    arrivals = _arrival_times(spec.arrivals, spec.horizon_minutes)
    available_at = [0] * spec.servers
    waits: List[int] = []
    served = 0
    abandoned = 0
    hourly: List[Dict[str, Any]] = []

    for hour in range(0, spec.horizon_minutes, 60):
        hour_arrivals = [time for time in arrivals if hour <= time < hour + 60]
        hour_waits: List[int] = []
        for arrival in hour_arrivals:
            server = min(range(spec.servers), key=lambda index: available_at[index])
            start = max(arrival, available_at[server])
            wait = max(0, start - arrival)
            if wait >= spec.patience_minutes:
                abandoned += 1
                continue
            available_at[server] = start + spec.service_minutes
            waits.append(wait)
            hour_waits.append(wait)
            served += 1
        hourly.append(
            {
                "hour": hour // 60,
                "arrivals": len(hour_arrivals),
                "served": len(hour_waits),
                "averageWaitMinutes": round(sum(hour_waits) / len(hour_waits), 1) if hour_waits else 0.0,
            }
        )

    total_busy = sum(min(value, spec.horizon_minutes) for value in available_at)
    capacity = spec.servers * spec.horizon_minutes
    return SimulationResult(
        scenario=scenario,
        arrivals=spec.arrivals,
        served=served,
        average_wait_minutes=sum(waits) / len(waits) if waits else 0.0,
        maximum_wait_minutes=max(waits) if waits else 0,
        abandoned=abandoned,
        utilization=min(total_busy / capacity, 1.0) if capacity else 0.0,
        hourly=hourly,
    )


def _arrival_times(count: int, horizon: int) -> List[int]:
    if count <= 0:
        return []
    step = max(1, horizon // max(count, 1))
    return [min(horizon - 1, index * step) for index in range(count)]


def snapshot_scenarios(snapshot: HospitalSnapshot) -> List[SimulationInput]:
    arrivals = max(1, len(snapshot.appointments) * 3)
    wait_values = [coerce_int(item.get("waitingMinutes")) for item in snapshot.appointments]
    average_wait = sum(wait_values) / len(wait_values) if wait_values else 12
    service = max(8, min(40, int(average_wait) + 6))
    servers = max(1, len(snapshot.departments) or 1)
    return [
        SimulationInput(arrivals=arrivals, service_minutes=service, servers=servers),
        SimulationInput(arrivals=ceil(arrivals * 0.75), service_minutes=max(5, service - 3), servers=servers),
        SimulationInput(arrivals=ceil(arrivals * 1.25), service_minutes=service + 2, servers=max(1, servers - 1)),
    ]


def run_scenarios(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> Dict[str, Any]:
    names = ("Baseline", "Optimized triage", "Surge demand")
    results = [
        simulate(name, params)
        for name, params in zip(names, snapshot_scenarios(snapshot))
    ]
    return {
        "enabled": True,
        "seed": config.window_minutes,
        "results": [result.as_dict() for result in results],
        "recommendation": _recommend(results),
    }


def _recommend(results: Sequence[SimulationResult]) -> str:
    if not results:
        return "No simulation results available."
    best = min(results, key=lambda item: (item.average_wait_minutes, item.abandoned))
    if best.abandoned > 0:
        return f"{best.scenario} reduces abandonment but still drops {best.abandoned} arrival(s); add staffing capacity."
    return f"{best.scenario} provides the lowest average wait at {best.average_wait_minutes:.1f} minutes."
