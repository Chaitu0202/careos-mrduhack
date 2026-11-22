"""Staff and resource scheduling helpers for CareOS capacity planning."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import HospitalSnapshot, coerce_int

SHIFTS: Sequence[str] = ("Morning", "Evening", "Night")


@dataclass
class StaffMember:
    id: str
    name: str
    role: str
    department: str
    shift: str
    availability: str = "Available"
    active_cases: int = 0

    @classmethod
    def from_record(cls, record: Mapping[str, Any]) -> "StaffMember":
        return cls(
            id=str(record.get("id", "unknown")),
            name=str(record.get("name", "Unknown")),
            role=str(record.get("role", "Staff")),
            department=str(record.get("department", "Hospital-Wide")),
            shift=str(record.get("shift", "Morning")),
            availability=str(record.get("availability", "Available")),
            active_cases=coerce_int(record.get("activeCases")),
        )

    def as_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "department": self.department,
            "shift": self.shift,
            "availability": self.availability,
            "activeCases": self.active_cases,
        }


@dataclass
class ShiftPlan:
    department: str
    shift: str
    staff: List[StaffMember] = field(default_factory=list)
    required: int = 0

    @property
    def covered(self) -> bool:
        return len(self.staff) >= self.required

    @property
    def gap(self) -> int:
        return max(0, self.required - len(self.staff))

    def as_dict(self) -> Dict[str, Any]:
        return {
            "department": self.department,
            "shift": self.shift,
            "required": self.required,
            "assigned": len(self.staff),
            "covered": self.covered,
            "gap": self.gap,
            "staff": [member.as_dict() for member in self.staff],
        }


def normalize_staff(snapshot: HospitalSnapshot) -> List[StaffMember]:
    return [StaffMember.from_record(record) for record in snapshot.staff]


def required_staff_for_department(snapshot: HospitalSnapshot, department: str) -> int:
    record = next((row for row in snapshot.departments if str(row.get("name")) == department), None)
    if not record:
        return 1
    active = coerce_int(record.get("activePatients"))
    return max(1, (active + 5) // 6)


def build_shift_plans(snapshot: HospitalSnapshot) -> List[ShiftPlan]:
    staff = normalize_staff(snapshot)
    departments = sorted({member.department for member in staff} | {str(row.get("name")) for row in snapshot.departments})
    plans: List[ShiftPlan] = []
    for department in departments:
        required = required_staff_for_department(snapshot, department)
        for shift in SHIFTS:
            plan = ShiftPlan(department=department, shift=shift, required=required)
            plan.staff = [
                member
                for member in staff
                if member.department == department
                and member.shift.lower().startswith(shift[:3].lower())
                and member.availability.lower() in {"available", "on duty"}
            ]
            plans.append(plan)
    return plans


def coverage_gaps(plans: Sequence[ShiftPlan]) -> List[Dict[str, Any]]:
    return [plan.as_dict() for plan in plans if not plan.covered]


def balance_load(members: Sequence[StaffMember], target_per_member: int = 3) -> List[Dict[str, Any]]:
    suggestions: List[Dict[str, Any]] = []
    overloaded = [member for member in members if member.active_cases > target_per_member]
    underloaded = [member for member in members if member.active_cases < target_per_member]
    overloaded.sort(key=lambda member: -member.active_cases)
    underloaded.sort(key=lambda member: member.active_cases)
    for source, destination in zip(overloaded, underloaded):
        movable = min(source.active_cases - target_per_member, target_per_member - destination.active_cases)
        if movable <= 0:
            continue
        suggestions.append(
            {
                "from": source.name,
                "to": destination.name,
                "department": source.department,
                "cases": movable,
                "reason": "Balance active caseload across available staff.",
            }
        )
    return suggestions


def scheduling_summary(snapshot: HospitalSnapshot) -> Dict[str, Any]:
    plans = build_shift_plans(snapshot)
    members = normalize_staff(snapshot)
    gaps = coverage_gaps(plans)
    return {
        "staffCount": len(members),
        "planCount": len(plans),
        "coveredPlans": sum(1 for plan in plans if plan.covered),
        "gapCount": len(gaps),
        "gaps": gaps[:10],
        "rebalanceSuggestions": balance_load(members),
    }
