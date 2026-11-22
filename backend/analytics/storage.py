"""Safe JSON storage helpers for the analytics toolchain."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Optional

DEFAULT_COLLECTIONS: tuple[str, ...] = (
    "users",
    "applications",
    "hospitals",
    "subscriptions",
    "platformActivity",
    "patients",
    "appointments",
    "prescriptions",
    "radiologyOrders",
    "bills",
    "departments",
    "resources",
    "agents",
    "workflows",
    "integrations",
    "tasks",
    "notifications",
    "staff",
    "auditLogs",
    "moduleRecords",
    "workflowExecutions",
    "departmentalAlerts",
)


class StorageError(RuntimeError):
    """Raised when the CareOS database cannot be read or normalized."""


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def read_json(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise StorageError(f"Database file not found: {path}")
    try:
        with path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise StorageError(f"Unable to read database file {path}: {exc}") from exc
    if not isinstance(payload, dict):
        raise StorageError("CareOS database root must be a JSON object")
    return payload


def write_json_atomic(path: Path, payload: Mapping[str, Any]) -> None:
    """Write JSON via a temporary file so readers never observe a partial DB."""
    ensure_parent(path)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def normalize_database(raw: Mapping[str, Any]) -> Dict[str, Any]:
    """Fill missing collections with empty lists and drop non-list values."""
    normalized: Dict[str, Any] = {}
    for key in DEFAULT_COLLECTIONS:
        value = raw.get(key, [])
        normalized[key] = list(value) if isinstance(value, list) else []
    for key, value in raw.items():
        if key not in normalized and isinstance(value, list):
            normalized[key] = list(value)
    for key in ("hospitalSettings", "settings", "version", "updatedAt"):
        if key in raw:
            normalized[key] = raw[key]
    return normalized


def collection_size(payload: Mapping[str, Any], name: str) -> int:
    value = payload.get(name, [])
    return len(value) if isinstance(value, list) else 0


def duplicate_ids(payload: Mapping[str, Any], name: str) -> Iterable[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for item in payload.get(name, []) or []:
        if not isinstance(item, dict):
            continue
        identifier = str(item.get("id", ""))
        if not identifier:
            continue
        if identifier in seen:
            duplicates.add(identifier)
        seen.add(identifier)
    return sorted(duplicates)


def find_records(payload: Mapping[str, Any], name: str, predicate) -> list[Dict[str, Any]]:
    return [item for item in (payload.get(name, []) or []) if isinstance(item, dict) and predicate(item)]


def safe_excerpt(value: Optional[str], limit: int = 160) -> str:
    if not value:
        return ""
    text = " ".join(str(value).split())
    return text if len(text) <= limit else text[: limit - 1] + "…"
