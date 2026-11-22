"""Configuration for the CareOS analytics service."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Mapping


def _repo_root() -> Path:
    """Return the repository root even when imported from another folder."""
    return Path(__file__).resolve().parents[2]


def _int_env(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _float_env(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Thresholds:
    """Operational thresholds used by anomaly detection and compliance checks."""

    emergency_wait_minutes: int = 20
    radiology_wait_minutes: int = 30
    bed_occupancy_percent: float = 85.0
    pending_approval_limit: int = 5
    unread_notification_limit: int = 10
    agent_success_rate_min: float = 0.80
    audit_lookback_days: int = 7

    @classmethod
    def from_env(cls) -> "Thresholds":
        return cls(
            emergency_wait_minutes=_int_env("CAREOS_EMERGENCY_WAIT_LIMIT", 20),
            radiology_wait_minutes=_int_env("CAREOS_RADIOLOGY_WAIT_LIMIT", 30),
            bed_occupancy_percent=_float_env("CAREOS_BED_OCCUPANCY_LIMIT", 85.0),
            pending_approval_limit=_int_env("CAREOS_APPROVAL_LIMIT", 5),
            unread_notification_limit=_int_env("CAREOS_UNREAD_NOTIFICATION_LIMIT", 10),
            agent_success_rate_min=_float_env("CAREOS_AGENT_SUCCESS_MIN", 0.80),
            audit_lookback_days=_int_env("CAREOS_AUDIT_LOOKBACK_DAYS", 7),
        )

    def as_dict(self) -> Dict[str, object]:
        return {
            "emergency_wait_minutes": self.emergency_wait_minutes,
            "radiology_wait_minutes": self.radiology_wait_minutes,
            "bed_occupancy_percent": self.bed_occupancy_percent,
            "pending_approval_limit": self.pending_approval_limit,
            "unread_notification_limit": self.unread_notification_limit,
            "agent_success_rate_min": self.agent_success_rate_min,
            "audit_lookback_days": self.audit_lookback_days,
        }


@dataclass(frozen=True)
class AnalyticsConfig:
    """Runtime configuration resolved from environment variables."""

    repo_root: Path = field(default_factory=_repo_root)
    data_dir_name: str = ".data"
    db_file_name: str = "careos-db.json"
    reports_dir_name: str = "reports"
    host: str = "127.0.0.1"
    port: int = 8100
    window_minutes: int = 60
    max_report_sections: int = 8
    enable_forecasts: bool = True
    enable_redaction: bool = True
    thresholds: Thresholds = field(default_factory=Thresholds.from_env)

    @classmethod
    def from_env(cls) -> "AnalyticsConfig":
        return cls(
            data_dir_name=os.environ.get("CAREOS_DATA_DIR_NAME", ".data"),
            db_file_name=os.environ.get("CAREOS_DB_FILE_NAME", "careos-db.json"),
            host=os.environ.get("CAREOS_ANALYTICS_HOST", "127.0.0.1"),
            port=_int_env("CAREOS_ANALYTICS_PORT", 8100),
            window_minutes=_int_env("CAREOS_ANALYTICS_WINDOW", 60),
            max_report_sections=_int_env("CAREOS_MAX_REPORT_SECTIONS", 8),
            enable_forecasts=_bool_env("CAREOS_ENABLE_FORECASTS", True),
            enable_redaction=_bool_env("CAREOS_ENABLE_REDACTION", True),
            thresholds=Thresholds.from_env(),
        )

    @property
    def data_dir(self) -> Path:
        override = os.environ.get("CAREOS_DATA_DIR")
        if override:
            return Path(override)
        return self.repo_root / self.data_dir_name

    @property
    def db_path(self) -> Path:
        return self.data_dir / self.db_file_name

    @property
    def report_dir(self) -> Path:
        override = os.environ.get("CAREOS_REPORT_DIR")
        if override:
            return Path(override)
        return self.repo_root / self.reports_dir_name

    def public_dict(self) -> Dict[str, object]:
        return {
            "db_path": str(self.db_path),
            "host": self.host,
            "port": self.port,
            "window_minutes": self.window_minutes,
            "max_report_sections": self.max_report_sections,
            "enable_forecasts": self.enable_forecasts,
            "enable_redaction": self.enable_redaction,
            "thresholds": self.thresholds.as_dict(),
        }
