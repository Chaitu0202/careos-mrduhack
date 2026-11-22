"""Event sourcing helpers for CareOS operational state changes."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import HospitalSnapshot, coerce_float, coerce_int

SUPPORTED_KINDS = (
    "appointment.created",
    "appointment.checked_in",
    "prescription.uploaded",
    "radiology.ordered",
    "radiology.reported",
    "bill.created",
    "bill.paid",
    "agent.dispatched",
    "workflow.completed",
)


@dataclass(frozen=True)
class DomainEvent:
    event_id: str
    kind: str
    aggregate_id: str
    timestamp: datetime
    payload: Dict[str, Any] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "eventId": self.event_id,
            "kind": self.kind,
            "aggregateId": self.aggregate_id,
            "timestamp": self.timestamp.isoformat(),
            "payload": dict(self.payload),
        }

    def to_jsonl(self) -> str:
        return json.dumps(self.as_dict(), sort_keys=True, separators=(",", ":")) + "\n"


@dataclass
class EventStream:
    name: str
    events: List[DomainEvent] = field(default_factory=list)

    def append(self, event: DomainEvent) -> None:
        if event.kind not in SUPPORTED_KINDS:
            raise ValueError(f"Unsupported event kind {event.kind!r}")
        self.events.append(event)
        self.events.sort(key=lambda item: (item.timestamp, item.event_id))

    def since(self, timestamp: datetime) -> List[DomainEvent]:
        return [event for event in self.events if event.timestamp >= timestamp]

    def by_kind(self, kind: str) -> List[DomainEvent]:
        return [event for event in self.events if event.kind == kind]

    def as_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "count": len(self.events), "events": [event.as_dict() for event in self.events]}


@dataclass
class Projection:
    name: str
    state: Dict[str, Any] = field(default_factory=dict)

    def apply(self, event: DomainEvent) -> None:
        counter_key = f"{event.kind}_count"
        self.state[counter_key] = coerce_int(self.state.get(counter_key)) + 1
        self.state["last_event_id"] = event.event_id
        self.state["last_timestamp"] = event.timestamp.isoformat()

    def as_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "state": dict(self.state)}


class ProjectionEngine:
    def __init__(self, name: str = "operational") -> None:
        self.name = name
        self.projections: Dict[str, Projection] = {}

    def register(self, name: str) -> Projection:
        projection = Projection(name)
        self.projections[name] = projection
        return projection

    def project(self, events: Iterable[DomainEvent]) -> Dict[str, Projection]:
        for event in events:
            for projection in self.projections.values():
                projection.apply(event)
        return self.projections

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "projections": {name: projection.as_dict() for name, projection in self.projections.items()},
        }


def _parse_time(value: Any) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def events_from_snapshot(snapshot: HospitalSnapshot) -> EventStream:
    stream = EventStream(name="careos-demo")
    for appointment in snapshot.appointments:
        stamp = _parse_time(appointment.get("createdAt")) or snapshot.generated_at
        stream.append(
            DomainEvent(
                event_id=f"evt-apt-{appointment.get('id', 'unknown')}",
                kind="appointment.created",
                aggregate_id=str(appointment.get("id", "unknown")),
                timestamp=stamp,
                payload={"patientId": appointment.get("patientId"), "department": appointment.get("department")},
            )
        )
    for prescription in snapshot.prescriptions:
        stamp = _parse_time(prescription.get("createdAt")) or snapshot.generated_at
        stream.append(
            DomainEvent(
                event_id=f"evt-rx-{prescription.get('id', 'unknown')}",
                kind="prescription.uploaded",
                aggregate_id=str(prescription.get("id", "unknown")),
                timestamp=stamp,
                payload={"patientId": prescription.get("patientId"), "fileName": prescription.get("fileName")},
            )
        )
    for order in snapshot.radiology_orders:
        stamp = _parse_time(order.get("createdAt")) or snapshot.generated_at
        stream.append(
            DomainEvent(
                event_id=f"evt-rad-{order.get('id', 'unknown')}",
                kind="radiology.ordered",
                aggregate_id=str(order.get("id", "unknown")),
                timestamp=stamp,
                payload={"patientId": order.get("patientId"), "examType": order.get("examType")},
            )
        )
        if order.get("reportFindings"):
            stream.append(
                DomainEvent(
                    event_id=f"evt-rad-report-{order.get('id', 'unknown')}",
                    kind="radiology.reported",
                    aggregate_id=str(order.get("id", "unknown")),
                    timestamp=_parse_time(order.get("reportUploadedAt")) or snapshot.generated_at,
                    payload={"billId": order.get("billId")},
                )
            )
    for bill in snapshot.bills:
        stamp = _parse_time(bill.get("createdAt")) or snapshot.generated_at
        kind = "bill.paid" if str(bill.get("status", "")).lower() == "paid" else "bill.created"
        stream.append(
            DomainEvent(
                event_id=f"evt-bill-{bill.get('id', 'unknown')}",
                kind=kind,
                aggregate_id=str(bill.get("id", "unknown")),
                timestamp=stamp,
                payload={"amount": coerce_float(bill.get("amount")), "patientId": bill.get("patientId")},
            )
        )
    for execution in snapshot.executions:
        stamp = _parse_time(execution.executed_at) or snapshot.generated_at
        stream.append(
            DomainEvent(
                event_id=f"evt-wf-{execution.id}",
                kind="workflow.completed",
                aggregate_id=execution.id,
                timestamp=stamp,
                payload={"code": execution.code, "status": execution.status},
            )
        )
    return stream


def build_event_report(snapshot: HospitalSnapshot) -> Dict[str, Any]:
    stream = events_from_snapshot(snapshot)
    engine = ProjectionEngine()
    engine.register("throughput")
    engine.register("revenue")
    engine.project(stream.events)
    return {
        "stream": stream.as_dict(),
        "projections": engine.as_dict(),
        "kinds": sorted({event.kind for event in stream.events}),
    }
