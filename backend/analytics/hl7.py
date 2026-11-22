"""HL7 v2.x order-message generation from CareOS radiology orders."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import HospitalSnapshot

FIELD_SEPARATOR = "|"
COMPONENT_SEPARATOR = "^"
ESCAPE_SEPARATOR = "\\"
REPETITION_SEPARATOR = "~"
SUBCOMPONENT_SEPARATOR = "&"


def _clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value)
    for source, target in (
        (ESCAPE_SEPARATOR, "\\E\\"),
        (FIELD_SEPARATOR, "\\F\\"),
        (COMPONENT_SEPARATOR, "\\S\\"),
        (REPETITION_SEPARATOR, "\\R\\"),
        (SUBCOMPONENT_SEPARATOR, "\\T\\"),
        ("\r", " "),
        ("\n", " "),
    ):
        text = text.replace(source, target)
    return text


def _ts(value: Any) -> str:
    if not value:
        return ""
    text = str(value).replace("Z", "")
    if "T" in text:
        date_part, time_part = text.split("T", 1)
        return date_part.replace("-", "") + time_part[:6].replace(":", "")
    return text.replace("-", "")


def msh_segment(
    sending_app: str = "CAREOS",
    sending_facility: str = "CAREOS",
    receiving_app: str = "RIS",
    receiving_facility: str = "HOSPITAL",
    control_id: str = "1",
) -> str:
    now = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    fields = [
        "MSH",
        f"{COMPONENT_SEPARATOR}{REPETITION_SEPARATOR}{ESCAPE_SEPARATOR}{SUBCOMPONENT_SEPARATOR}",
        sending_app,
        sending_facility,
        receiving_app,
        receiving_facility,
        now,
        "",
        "ORM^O01",
        control_id,
        "P",
        "2.5.1",
    ]
    return FIELD_SEPARATOR.join(fields)


def pid_segment(order: Mapping[str, Any], sequence: int = 1) -> str:
    identifier = str(order.get("patientId") or order.get("id") or "")
    name = _clean(order.get("patientName") or "UNKNOWN")
    fields = [
        "PID",
        str(sequence),
        "",
        identifier,
        "",
        name,
        "",
        _ts(order.get("createdAt") or datetime.now(timezone.utc).isoformat()),
        _gender_code(order.get("gender")),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
    ]
    return FIELD_SEPARATOR.join(fields)


def _gender_code(value: Any) -> str:
    text = str(value or "").lower()
    if text.startswith("m"):
        return "M"
    if text.startswith("f"):
        return "F"
    if text.startswith("o"):
        return "O"
    return "U"


def orc_segment(order: Mapping[str, Any]) -> str:
    priority = {"STAT": "S", "Urgent": "A", "Routine": "R"}.get(str(order.get("priority")), "R")
    fields = [
        "ORC",
        "NW",
        str(order.get("id") or ""),
        "",
        f"1^{_clean(order.get('doctorName') or 'CAREOS')}",
        str(order.get("status") or "Pending").upper(),
        "",
        priority,
        "",
        _ts(order.get("createdAt")),
        _clean(order.get("doctorName")),
        "",
        "",
    ]
    return FIELD_SEPARATOR.join(fields)


def obr_segment(order: Mapping[str, Any], sequence: int = 1) -> str:
    exam = _clean(order.get("examType") or "IMAGING STUDY")
    fields = [
        "OBR",
        str(sequence),
        str(order.get("id") or ""),
        "",
        f"{exam}^IMAGING",
        "",
        _ts(order.get("createdAt")),
        "",
        "",
        "",
        "",
        "",
        _clean(order.get("reason")),
        _ts(order.get("createdAt")),
        "",
        "",
        _clean(order.get("doctorName")),
        "",
        "",
        "",
        "",
        f"PRIORITY^{_clean(order.get('priority') or 'Routine')}",
    ]
    return FIELD_SEPARATOR.join(fields)


def obx_segment(name: str, value: Any, sequence: int = 1) -> str:
    fields = [
        "OBX",
        str(sequence),
        "ST",
        _clean(name),
        "",
        _clean(value),
    ]
    return FIELD_SEPARATOR.join(fields)


def build_orm_message(order: Mapping[str, Any], control_id: str = "1") -> str:
    segments: List[str] = [
        msh_segment(control_id=control_id),
        pid_segment(order),
        orc_segment(order),
        obr_segment(order),
        obx_segment("Reason for exam", order.get("reason")),
        obx_segment("Priority", order.get("priority"), 2),
    ]
    if order.get("reportFindings"):
        segments.append(obx_segment("Findings", order["reportFindings"], 3))
    if order.get("reportImpression"):
        segments.append(obx_segment("Impression", order["reportImpression"], 4))
    return "\r".join(segments) + "\r"


def build_messages(snapshot: HospitalSnapshot) -> Dict[str, str]:
    messages: Dict[str, str] = {}
    for index, order in enumerate(snapshot.radiology_orders, start=1):
        messages[str(order.get("id", index))] = build_orm_message(order, f"CAR{index:06d}")
    return messages


def validate_message(message: str) -> List[str]:
    errors: List[str] = []
    segments = [segment for segment in message.replace("\r\n", "\r").split("\r") if segment]
    if not segments:
        return ["Message has no segments"]
    if not segments[0].startswith("MSH"):
        errors.append("First segment must be MSH")
    expected = {"MSH", "PID", "ORC", "OBR"}
    present = {segment.split(FIELD_SEPARATOR, 1)[0] for segment in segments}
    for name in expected:
        if name not in present:
            errors.append(f"Missing {name} segment")
    return errors
