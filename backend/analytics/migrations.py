"""Versioned JSON-database migrations for the CareOS preview store."""

from __future__ import annotations

import copy
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from .storage import normalize_database, write_json_atomic

SCHEMA_VERSION_KEY = "version"
CURRENT_VERSION = 4


@dataclass
class Migration:
    version: int
    name: str
    description: str
    apply: Callable[[Dict[str, Any]], Dict[str, Any]]

    def as_dict(self) -> Dict[str, Any]:
        return {"version": self.version, "name": self.name, "description": self.description}


def _v1(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload.setdefault(SCHEMA_VERSION_KEY, 1)
    payload.setdefault("updatedAt", datetime.now(timezone.utc).isoformat())
    return payload


def _v2(payload: Dict[str, Any]) -> Dict[str, Any]:
    for patient in payload.get("patients", []) or []:
        if isinstance(patient, dict) and "portalUsername" not in patient:
            patient["portalUsername"] = ""
    return payload


def _v3(payload: Dict[str, Any]) -> Dict[str, Any]:
    for execution in payload.get("workflowExecutions", []) or []:
        if not isinstance(execution, dict):
            continue
        execution.setdefault("executiveBrief", "")
        execution.setdefault("voiceConfirmation", "")
        execution.setdefault("departmentalAlerts", [])
        execution.setdefault("pendingApprovals", [])
        execution.setdefault("reportSections", [])
    return payload


def _v4(payload: Dict[str, Any]) -> Dict[str, Any]:
    payload.setdefault("integrations", [])
    payload.setdefault("departmentalAlerts", [])
    payload.setdefault("analyticsEvents", [])
    return payload


MIGRATIONS: Sequence[Migration] = (
    Migration(1, "initial", "Add schema version and updatedAt.", _v1),
    Migration(2, "portal_username", "Ensure patient portal linkage field exists.", _v2),
    Migration(3, "agentic_outputs", "Ensure workflow executions carry full agentic output.", _v3),
    Migration(4, "integration_collections", "Ensure integration and analytics collections exist.", _v4),
)


@dataclass
class MigrationResult:
    from_version: int
    to_version: int
    applied: List[str] = field(default_factory=list)
    changed: bool = False

    def as_dict(self) -> Dict[str, Any]:
        return {
            "fromVersion": self.from_version,
            "toVersion": self.to_version,
            "applied": list(self.applied),
            "changed": self.changed,
        }


def current_version(payload: Mapping[str, Any]) -> int:
    value = payload.get(SCHEMA_VERSION_KEY, 0)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        match = re.search(r"\d+", value)
        return int(match.group()) if match else 0
    return 0


def migrate_payload(payload: Mapping[str, Any]) -> Tuple[Dict[str, Any], MigrationResult]:
    working = normalize_database(copy.deepcopy(payload))
    start = current_version(working)
    result = MigrationResult(from_version=start, to_version=start)
    for migration in MIGRATIONS:
        if migration.version <= start:
            continue
        working = migration.apply(working)
        working[SCHEMA_VERSION_KEY] = migration.version
        result.applied.append(migration.name)
        result.to_version = migration.version
        result.changed = True
    working["updatedAt"] = datetime.now(timezone.utc).isoformat()
    return working, result


def migrate_file(path, persist: bool = False) -> Tuple[Dict[str, Any], MigrationResult]:
    from .storage import read_json

    payload, result = migrate_payload(read_json(path))
    if persist and result.changed:
        write_json_atomic(path, payload)
    return payload, result


def migration_catalog() -> List[Dict[str, Any]]:
    return [migration.as_dict() for migration in MIGRATIONS]
