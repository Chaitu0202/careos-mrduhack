"""Deterministic command understanding and voice-confirmation helpers.

This is a transparent, offline complement to the Gemini-backed orchestrator: it
parses demo commands into intents and entities, and renders the confirmation
language seen in the agent execution overlay.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence, Tuple

from .models import HospitalSnapshot, coerce_float

INTENT_PATTERNS: Sequence[Tuple[str, Tuple[str, ...]]] = (
    ("schedule_appointment", ("book", "schedule", "appointment", "consult")),
    ("prescribe", ("prescription", "prescribe", "medication", "medicine")),
    ("radiology", ("x-ray", "xray", "radiology", "imaging", "scan", "ct", "mri")),
    ("billing", ("bill", "invoice", "payment", "charge", "claim")),
    ("capacity", ("bed", "capacity", "occupancy", "staff", "department load")),
    ("patient_lookup", ("patient", "mrn", "portal", "record")),
    ("compliance", ("audit", "approval", "compliance", "redact", "policy")),
)

ENTITY_PATTERNS: Dict[str, str] = {
    "patient_name": r"(?:patient|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)",
    "department": r"(?:in|for)\s+(emergency|cardiology|radiology|pharmacy|billing|laboratory|inventory|sales|marketing)",
    "priority": r"\b(STAT|urgent|routine)\b",
    "amount": r"\$\s?([0-9]+(?:\.[0-9]{2})?)",
    "date": r"\b(20[0-9]{2}-[0-9]{2}-[0-9]{2})\b",
}


@dataclass
class Intent:
    name: str
    confidence: float
    matched_keywords: List[str] = field(default_factory=list)
    entities: Dict[str, str] = field(default_factory=dict)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "confidence": round(self.confidence, 3),
            "matchedKeywords": list(self.matched_keywords),
            "entities": dict(self.entities),
        }


@dataclass
class CommandAnalysis:
    text: str
    intent: Intent
    summary: str
    voice_confirmation: str
    suggested_agents: List[str] = field(default_factory=list)
    requires_approval: bool = False

    def as_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "intent": self.intent.as_dict(),
            "summary": self.summary,
            "voiceConfirmation": self.voice_confirmation,
            "suggestedAgents": list(self.suggested_agents),
            "requiresApproval": self.requires_approval,
        }


def detect_intent(text: str) -> Intent:
    normalized = text.lower()
    scores: List[Tuple[str, List[str]]] = []
    for name, keywords in INTENT_PATTERNS:
        matches = [keyword for keyword in keywords if keyword in normalized]
        if matches:
            scores.append((name, matches))
    if not scores:
        return Intent("general_query", 0.35, [], extract_entities(text))
    scores.sort(key=lambda item: (-len(item[1]), item[0]))
    name, matches = scores[0]
    confidence = min(0.98, 0.55 + 0.12 * len(matches))
    return Intent(name, confidence, matches, extract_entities(text))


def extract_entities(text: str) -> Dict[str, str]:
    entities: Dict[str, str] = {}
    for name, pattern in ENTITY_PATTERNS.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            entities[name] = match.group(1)
    return entities


AGENTS_FOR_INTENT: Dict[str, List[str]] = {
    "schedule_appointment": ["Operations Agent", "Patient Experience Agent"],
    "prescribe": ["Clinical Intelligence Agent", "Patient Experience Agent"],
    "radiology": ["Radiology Coordination Agent", "Billing Agent"],
    "billing": ["Revenue Cycle Agent", "Compliance Agent"],
    "capacity": ["Operations Agent", "Clinical Intelligence Agent"],
    "patient_lookup": ["Patient Experience Agent", "Clinical Intelligence Agent"],
    "compliance": ["Compliance Agent", "Operations Agent"],
    "general_query": ["Operations Agent"],
}

SUMMARY_TEMPLATES: Dict[str, str] = {
    "schedule_appointment": "Coordinate a new consultation and publish it to the patient portal.",
    "prescribe": "Capture the clinician prescription and notify the patient portal.",
    "radiology": "Create or complete an imaging order and synchronize downstream billing.",
    "billing": "Generate, reconcile, or review an invoice for the referenced encounter.",
    "capacity": "Assess departmental load, staff, and available resources.",
    "patient_lookup": "Retrieve the referenced patient record and portal-visible history.",
    "compliance": "Evaluate approvals, auditability, and minimum-necessary data exposure.",
    "general_query": "Route the request to the most relevant CareOS agent.",
}

VOICE_TEMPLATES: Dict[str, str] = {
    "schedule_appointment": "Okay, I have scheduled the appointment and sent the details to the patient portal.",
    "prescribe": "Prescription captured. The patient portal has been updated.",
    "radiology": "Imaging order coordinated. The report and invoice will appear in the patient portal once filed.",
    "billing": "Invoice record prepared and synchronized with the billing module.",
    "capacity": "Capacity review complete. I have highlighted the departments that need attention.",
    "patient_lookup": "Patient record retrieved. Only the requested portal-visible fields are shown.",
    "compliance": "Compliance checks complete. Any open approvals are listed in the report.",
    "general_query": "I have routed your request and opened the execution report.",
}


def analyze_command(text: str) -> CommandAnalysis:
    intent = detect_intent(text)
    return CommandAnalysis(
        text=text,
        intent=intent,
        summary=SUMMARY_TEMPLATES.get(intent.name, SUMMARY_TEMPLATES["general_query"]),
        voice_confirmation=VOICE_TEMPLATES.get(intent.name, VOICE_TEMPLATES["general_query"]),
        suggested_agents=list(AGENTS_FOR_INTENT.get(intent.name, AGENTS_FOR_INTENT["general_query"])),
        requires_approval=intent.name in {"billing", "compliance"},
    )


def ground_command(analysis: CommandAnalysis, snapshot: HospitalSnapshot) -> Dict[str, Any]:
    entities = analysis.intent.entities
    patient = next(
        (
            row
            for row in snapshot.patients
            if entities.get("patient_name") and str(entities["patient_name"]).lower() in str(row.get("fullName", "")).lower()
        ),
        None,
    )
    department = entities.get("department")
    matching_appointments = [
        row for row in snapshot.appointments
        if (not department or str(row.get("department", "")).lower() == department.lower())
        and (not patient or str(row.get("patientId")) == str(patient.get("id")))
    ]
    return {
        "intent": analysis.intent.name,
        "patient": {"id": patient.get("id"), "name": patient.get("fullName")} if patient else None,
        "department": department,
        "appointmentCount": len(matching_appointments),
        "openBillTotal": round(sum(coerce_float(row.get("amount")) for row in snapshot.bills if str(row.get("status", "")).lower() == "pending"), 2),
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    }


def render_summary(analysis: CommandAnalysis) -> str:
    entities = analysis.intent.entities
    fragments = [analysis.summary]
    if entities.get("patient_name"):
        fragments.append(f"Patient: {entities['patient_name']}.")
    if entities.get("department"):
        fragments.append(f"Department: {entities['department'].title()}.")
    if entities.get("priority"):
        fragments.append(f"Priority: {entities['priority']}.")
    return " ".join(fragments)


def intent_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "name": name,
            "keywords": list(keywords),
            "agents": list(AGENTS_FOR_INTENT.get(name, [])),
            "summary": SUMMARY_TEMPLATES.get(name, SUMMARY_TEMPLATES["general_query"]),
        }
        for name, keywords in INTENT_PATTERNS
    ] + [{
        "name": "general_query",
        "keywords": [],
        "agents": list(AGENTS_FOR_INTENT["general_query"]),
        "summary": SUMMARY_TEMPLATES["general_query"],
    }]
