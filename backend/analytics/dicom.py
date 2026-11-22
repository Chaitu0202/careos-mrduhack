"""DICOM Modality Worklist adapters for CareOS radiology orders.

The preview stores attachments as JSON data URLs. These helpers map the order
metadata into DICOM Worklist-shaped dictionaries and validate the identifiers a
RIS/PACS requires. No DICOM library is needed for review or CI.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional

from .models import HospitalSnapshot

REQUIRED_TAGS = (
    "AccessionNumber",
    "PatientID",
    "PatientName",
    "RequestedProcedureDescription",
    "Modality",
    "ScheduledProcedureStepStartDate",
)


def modality_for_exam(exam_type: Any) -> str:
    text = str(exam_type or "").lower()
    if "ct" in text or "computed" in text:
        return "CT"
    if "mri" in text or "magnetic" in text:
        return "MR"
    if "ultrasound" in text or "usg" in text:
        return "US"
    if "x-ray" in text or "xray" in text or "radiograph" in text:
        return "DX"
    if "mammo" in text:
        return "MG"
    return "OT"


def scheduled_date(order: Mapping[str, Any]) -> str:
    value = order.get("scheduledAt") or order.get("createdAt")
    if not value:
        return datetime.now(timezone.utc).strftime("%Y%m%d")
    text = str(value)
    if "T" in text:
        text = text.split("T", 1)[0]
    return text.replace("-", "")


def worklist_item(order: Mapping[str, Any]) -> Dict[str, Any]:
    accession = str(order.get("id") or "UNKNOWN")
    return {
        "AccessionNumber": accession,
        "PatientID": str(order.get("patientId") or order.get("mrn") or ""),
        "PatientName": str(order.get("patientName") or "UNKNOWN^PATIENT").replace(" ", "^", 1),
        "PatientBirthDate": str(order.get("patientBirthDate") or ""),
        "PatientSex": str(order.get("gender") or "O")[:1].upper(),
        "ReferringPhysicianName": str(order.get("doctorName") or "").replace(" ", "^", 1),
        "RequestingPhysician": str(order.get("doctorName") or ""),
        "RequestedProcedureID": accession,
        "RequestedProcedureDescription": str(order.get("examType") or "Imaging study"),
        "RequestedProcedurePriority": str(order.get("priority") or "ROUTINE").upper(),
        "ReasonForRequestedProcedure": str(order.get("reason") or ""),
        "Modality": modality_for_exam(order.get("examType")),
        "ScheduledProcedureStepStartDate": scheduled_date(order),
        "ScheduledProcedureStepStartTime": "080000",
        "ScheduledProcedureStepID": f"SPPS-{accession}",
        "ScheduledStationAETitle": "CAREOS_RIS",
        "SchedulingPhysicianName": str(order.get("doctorName") or "").replace(" ", "^", 1),
        "StudyInstanceUID": f"1.2.826.0.1.3680043.10.1000.{_numeric_suffix(accession)}",
    }


def _numeric_suffix(value: str) -> int:
    digits = "".join(character for character in value if character.isdigit())
    return int(digits[-9:]) if digits else abs(hash(value)) % 1_000_000_000


def validate_item(item: Mapping[str, Any]) -> List[str]:
    errors: List[str] = []
    for tag in REQUIRED_TAGS:
        value = item.get(tag)
        if value in (None, ""):
            errors.append(f"Missing required DICOM tag {tag}")
    priority = str(item.get("RequestedProcedurePriority", ""))
    if priority not in {"ROUTINE", "URGENT", "STAT"}:
        errors.append(f"Unsupported priority {priority!r}")
    study_uid = str(item.get("StudyInstanceUID", ""))
    if not study_uid.startswith("1.2."):
        errors.append("StudyInstanceUID must be a UID root")
    return errors


def build_worklist(snapshot: HospitalSnapshot) -> List[Dict[str, Any]]:
    return [worklist_item(order) for order in snapshot.radiology_orders]


def validate_worklist(items: Iterable[Mapping[str, Any]]) -> Dict[str, Any]:
    errors: List[str] = []
    accession_numbers: List[str] = []
    for index, item in enumerate(items):
        errors.extend(f"item[{index}]: {error}" for error in validate_item(item))
        accession_numbers.append(str(item.get("AccessionNumber", "")))
    duplicates = sorted({value for value in accession_numbers if accession_numbers.count(value) > 1 and value})
    errors.extend(f"Duplicate AccessionNumber {value!r}" for value in duplicates)
    return {"ok": not errors, "itemCount": len(accession_numbers), "errors": errors}
