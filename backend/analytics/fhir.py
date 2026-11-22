"""FHIR R4-shaped resource adapters for CareOS analytics snapshots.

These helpers do not require a FHIR server. They produce deterministic,
reviewable resource dictionaries that can be POSTed to an EHR FHIR endpoint or
used by conformance tests. Field names intentionally mirror HL7 FHIR R4.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional

from .models import HospitalSnapshot, coerce_float

FHIR_SYSTEM = "urn:careos:demo"


def _date(value: Any) -> Optional[str]:
    if not value:
        return None
    text = str(value)
    if "T" in text:
        return text.split("T", 1)[0]
    return text


def _datetime(value: Any) -> Optional[str]:
    if not value:
        return None
    return str(value).replace("Z", "+00:00")


def _identifier(identifier: Any, system: str = FHIR_SYSTEM) -> List[Dict[str, str]]:
    if not identifier:
        return []
    return [{"system": system, "value": str(identifier)}]


def patient_resource(patient: Mapping[str, Any]) -> Dict[str, Any]:
    names: List[Dict[str, Any]] = []
    if patient.get("fullName"):
        parts = str(patient["fullName"]).split()
        names.append(
            {
                "text": str(patient["fullName"]),
                "family": parts[-1] if parts else "",
                "given": parts[:-1] if len(parts) > 1 else [],
            }
        )
    telecom: List[Dict[str, str]] = []
    if patient.get("phone"):
        telecom.append({"system": "phone", "value": str(patient["phone"]), "use": "home"})
    if patient.get("email"):
        telecom.append({"system": "email", "value": str(patient["email"]), "use": "home"})

    resource: Dict[str, Any] = {
        "resourceType": "Patient",
        "id": str(patient.get("id", "unknown")),
        "identifier": _identifier(patient.get("mrn"), "urn:careos:mrn"),
        "name": names,
        "telecom": telecom,
        "gender": _gender(patient.get("gender")),
        "birthDate": _date(patient.get("dateOfBirth") or patient.get("birthDate")),
        "address": [],
    }
    if patient.get("age"):
        resource["extension"] = [
            {
                "url": f"{FHIR_SYSTEM}/age-years",
                "valueInteger": int(patient["age"]),
            }
        ]
    return _compact(resource)


def _gender(value: Any) -> Optional[str]:
    text = str(value or "").lower()
    if text.startswith("m"):
        return "male"
    if text.startswith("f"):
        return "female"
    if text.startswith("o"):
        return "other"
    return "unknown"


def appointment_resource(appointment: Mapping[str, Any]) -> Dict[str, Any]:
    status_map = {
        "Scheduled": "booked",
        "Checked In": "checked-in",
        "In Consultation": "in-progress",
        "Completed": "fulfilled",
        "Cancelled": "cancelled",
    }
    start = appointment.get("queueJoinedAt") or appointment.get("createdAt")
    if appointment.get("date") and appointment.get("time"):
        start = f"{appointment['date']}T{appointment['time']}:00"
    resource = {
        "resourceType": "Appointment",
        "id": str(appointment.get("id", "unknown")),
        "status": status_map.get(str(appointment.get("status")), "entered-in-error"),
        "serviceType": [
            {"text": str(appointment.get("department", "General"))}
        ],
        "description": appointment.get("notes") or appointment.get("type"),
        "start": _datetime(start),
        "participant": [
            {
                "type": [{"text": "patient"}],
                "actor": {"reference": f"Patient/{appointment.get('patientId')}", "display": appointment.get("patientName")},
                "status": "accepted",
            },
            {
                "type": [{"text": "practitioner"}],
                "actor": {"display": appointment.get("doctorName")},
                "status": "accepted",
            },
        ],
    }
    return _compact(resource)


def diagnostic_report_resource(order: Mapping[str, Any]) -> Dict[str, Any]:
    status_map = {"Pending": "preliminary", "In Progress": "preliminary", "Completed": "final"}
    conclusion = []
    if order.get("reportFindings"):
        conclusion.append(str(order["reportFindings"]))
    if order.get("reportImpression"):
        conclusion.append(str(order["reportImpression"]))
    resource = {
        "resourceType": "DiagnosticReport",
        "id": str(order.get("id", "unknown")),
        "identifier": _identifier(order.get("id"), "urn:careos:radiology-order"),
        "basedOn": [{"reference": f"ServiceRequest/{order.get('appointmentId')}"}] if order.get("appointmentId") else [],
        "status": status_map.get(str(order.get("status")), "unknown"),
        "category": [{"text": "Radiology"}],
        "code": {"text": order.get("examType") or "Imaging study"},
        "subject": {"reference": f"Patient/{order.get('patientId')}", "display": order.get("patientName")},
        "effectiveDateTime": _datetime(order.get("completedAt") or order.get("createdAt")),
        "issued": _datetime(order.get("reportUploadedAt")),
        "conclusion": " ".join(conclusion) or None,
    }
    return _compact(resource)


def invoice_resource(bill: Mapping[str, Any]) -> Dict[str, Any]:
    status_map = {"Paid": "paid", "Pending": "issued", "Overdue": "issued", "Cancelled": "cancelled"}
    resource = {
        "resourceType": "Invoice",
        "id": str(bill.get("id", "unknown")),
        "status": status_map.get(str(bill.get("status")), "draft"),
        "subject": {"reference": f"Patient/{bill.get('patientId')}", "display": bill.get("patientName")},
        "issued": _datetime(bill.get("createdAt")),
        "lineItem": [
            {
                "sequence": 1,
                "chargeItem": {"reference": f"ChargeItem/{bill.get('orderId') or bill.get('id')}"},
                "priceComponent": [
                    {
                        "type": "base",
                        "code": {"text": str(bill.get("description", "Service"))},
                        "amount": {
                            "value": coerce_float(bill.get("amount")),
                            "currency": str(bill.get("currency") or "USD").upper(),
                        },
                    }
                ],
            }
        ],
    }
    return _compact(resource)


def observation_resource(appointment: Mapping[str, Any]) -> Dict[str, Any]:
    return _compact(
        {
            "resourceType": "Observation",
            "id": f"wait-{appointment.get('id', 'unknown')}",
            "status": "final",
            "category": [{"text": "Operational"}],
            "code": {"text": "Emergency department waiting time"},
            "subject": {"reference": f"Patient/{appointment.get('patientId')}"},
            "effectiveDateTime": _datetime(appointment.get("queueJoinedAt") or appointment.get("createdAt")),
            "valueQuantity": {
                "value": coerce_float(appointment.get("waitingMinutes")),
                "unit": "min",
                "system": "http://unitsofmeasure.org",
                "code": "min",
            },
        }
    )


def _compact(resource: Dict[str, Any]) -> Dict[str, Any]:
    return {
        key: value
        for key, value in resource.items()
        if value not in (None, "", [], {})
    }


def build_bundle(snapshot: HospitalSnapshot) -> Dict[str, Any]:
    entries: List[Dict[str, Any]] = []
    for patient in snapshot.patients:
        entries.append({"fullUrl": f"Patient/{patient.get('id')}", "resource": patient_resource(patient)})
    for appointment in snapshot.appointments:
        entries.append({"fullUrl": f"Appointment/{appointment.get('id')}", "resource": appointment_resource(appointment)})
        entries.append({"fullUrl": f"Observation/wait-{appointment.get('id')}", "resource": observation_resource(appointment)})
    for order in snapshot.radiology_orders:
        entries.append({"fullUrl": f"DiagnosticReport/{order.get('id')}", "resource": diagnostic_report_resource(order)})
    for bill in snapshot.bills:
        entries.append({"fullUrl": f"Invoice/{bill.get('id')}", "resource": invoice_resource(bill)})
    return {
        "resourceType": "Bundle",
        "id": f"careos-export-{snapshot.generated_at.strftime('%Y%m%d%H%M%S')}",
        "type": "collection",
        "timestamp": snapshot.generated_at.isoformat(),
        "total": len(entries),
        "entry": entries,
    }


def validate_bundle(bundle: Mapping[str, Any]) -> List[str]:
    errors: List[str] = []
    if bundle.get("resourceType") != "Bundle":
        errors.append("resourceType must be Bundle")
    if bundle.get("type") != "collection":
        errors.append("Bundle type must be collection")
    supported = {"Patient", "Appointment", "Observation", "DiagnosticReport", "Invoice"}
    for index, entry in enumerate(bundle.get("entry", []) if isinstance(bundle.get("entry"), list) else []):
        resource = entry.get("resource") if isinstance(entry, Mapping) else None
        if not isinstance(resource, Mapping):
            errors.append(f"entry {index} has no resource")
            continue
        kind = resource.get("resourceType")
        if kind not in supported:
            errors.append(f"entry {index} has unsupported resourceType {kind!r}")
        if not resource.get("id"):
            errors.append(f"entry {index} has no id")
    return errors
