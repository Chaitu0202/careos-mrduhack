"""Redaction and access helpers for CareOS analytics exports."""

from __future__ import annotations

import hashlib
import hmac
import re
from typing import Any, Dict, Iterable, Mapping, Optional

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+?\d[\d\s().-]{7,}\d)")
MRN_RE = re.compile(r"\bMRN[- ]?\d{3,}\b", re.IGNORECASE)

SENSITIVE_KEYS = {
    "password",
    "passwordHash",
    "token",
    "authorization",
    "secret",
    "apiKey",
    "geminiApiKey",
}


def redact_text(value: str) -> str:
    value = EMAIL_RE.sub("[email-redacted]", value)
    value = PHONE_RE.sub("[phone-redacted]", value)
    value = MRN_RE.sub("[mrn-redacted]", value)
    return value


def redact_value(key: str, value: Any) -> Any:
    lowered = key.lower()
    if any(fragment in lowered for fragment in {item.lower() for item in SENSITIVE_KEYS}):
        return "[redacted]"
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [redact_value(key, item) for item in value]
    if isinstance(value, dict):
        return redact_mapping(value)
    return value


def redact_mapping(payload: Mapping[str, Any]) -> Dict[str, Any]:
    return {str(key): redact_value(str(key), value) for key, value in payload.items()}


def stable_hash(value: str, salt: str = "careos-analytics") -> str:
    return hashlib.sha256(f"{salt}:{value}".encode("utf-8")).hexdigest()[:16]


def constant_time_equals(left: str, right: str) -> bool:
    return hmac.compare_digest(left.encode("utf-8"), right.encode("utf-8"))


def authorize_api_key(headers: Mapping[str, str], expected: Optional[str]) -> bool:
    """Optional shared-secret guard for the analytics HTTP service."""
    if not expected:
        return True
    supplied = headers.get("x-careos-analytics-key", "") or headers.get("X-CareOS-Analytics-Key", "")
    bearer = headers.get("authorization", "") or headers.get("Authorization", "")
    if bearer.lower().startswith("bearer "):
        supplied = bearer[7:].strip()
    return constant_time_equals(supplied, expected)


def strip_pii_from_records(records: Iterable[Mapping[str, Any]]) -> list[Dict[str, Any]]:
    return [redact_mapping(record) for record in records]
