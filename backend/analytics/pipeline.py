"""Composable ETL pipeline over the CareOS analytics snapshot."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence

from .anomalies import detect_all
from .compliance import compliance_score, run_compliance
from .config import AnalyticsConfig
from .dicom import build_worklist, validate_worklist
from .fhir import build_bundle, validate_bundle
from .forecasting import forecast_all
from .hl7 import build_messages, validate_message
from .ingest import load_snapshot, summarize_snapshot
from .metrics import build_metric_registry, calculate_all
from .models import AnalyticsReport, HospitalSnapshot
from .reports import build_report
from .storage import write_json_atomic


@dataclass
class StageResult:
    name: str
    ok: bool
    output: Dict[str, Any] = field(default_factory=dict)
    errors: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {"name": self.name, "ok": self.ok, "errors": list(self.errors), "output": self.output}


@dataclass
class PipelineRun:
    started_at: datetime
    finished_at: datetime
    stages: List[StageResult] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return all(stage.ok for stage in self.stages)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "startedAt": self.started_at.isoformat(),
            "finishedAt": self.finished_at.isoformat(),
            "ok": self.ok,
            "stageCount": len(self.stages),
            "stages": [stage.as_dict() for stage in self.stages],
        }


Stage = Callable[[HospitalSnapshot, AnalyticsConfig], StageResult]


def stage_ingest(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> StageResult:
    summary = summarize_snapshot(snapshot)
    empty = [name for name, count in summary.items() if isinstance(count, int) and count == 0]
    return StageResult(
        name="ingest",
        ok=True,
        output={"summary": summary, "emptyCollections": empty, "dbPath": str(config.db_path)},
    )


def stage_metrics(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> StageResult:
    metrics = calculate_all(snapshot, config)
    registry = build_metric_registry(snapshot)
    return StageResult(
        name="metrics",
        ok=True,
        output={
            "families": sorted(metrics),
            "series": sorted(registry),
            "coreMetricCount": len(metrics["core"]),
            "departmentCount": len(metrics["departments"]),
        },
    )


def stage_governance(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> StageResult:
    anomalies = detect_all(snapshot, config)
    findings = run_compliance(snapshot, config)
    combined = anomalies + findings
    return StageResult(
        name="governance",
        ok=not any(item.severity == "critical" for item in combined),
        output={
            "anomalyCount": len(anomalies),
            "complianceFindingCount": len(findings),
            "complianceScore": round(compliance_score(findings), 2),
            "criticalCount": sum(1 for item in combined if item.severity == "critical"),
        },
        errors=[f"{item.id}: {item.title}" for item in combined if item.severity == "critical"],
    )


def stage_interoperability(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> StageResult:
    errors: List[str] = []
    bundle = build_bundle(snapshot)
    errors.extend(validate_bundle(bundle))
    worklist = build_worklist(snapshot)
    dicom_result = validate_worklist(worklist)
    errors.extend(dicom_result["errors"])
    messages = build_messages(snapshot)
    for identifier, message in messages.items():
        errors.extend(f"HL7 {identifier}: {error}" for error in validate_message(message))
    return StageResult(
        name="interoperability",
        ok=not errors,
        output={
            "fhirResources": len(bundle.get("entry", [])),
            "dicomWorklistItems": len(worklist),
            "hl7Messages": len(messages),
        },
        errors=errors,
    )


def stage_forecast(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> StageResult:
    registry = build_metric_registry(snapshot)
    forecast = forecast_all(registry, config)
    return StageResult(
        name="forecast",
        ok=True,
        output={"enabled": forecast["enabled"], "series": len(forecast.get("series", {}))},
    )


DEFAULT_STAGES: Sequence[Stage] = (
    stage_ingest,
    stage_metrics,
    stage_governance,
    stage_interoperability,
    stage_forecast,
)


def run_pipeline(
    config: AnalyticsConfig,
    stages: Sequence[Stage] = DEFAULT_STAGES,
    persist: bool = False,
) -> PipelineRun:
    started = datetime.now(timezone.utc)
    snapshot = load_snapshot(config)
    results: List[StageResult] = []
    for stage in stages:
        try:
            results.append(stage(snapshot, config))
        except Exception as exc:  # noqa: BLE001 - pipeline records stage failures
            results.append(StageResult(name=stage.__name__, ok=False, errors=[str(exc)]))
    finished = datetime.now(timezone.utc)
    run = PipelineRun(started, finished, results)
    if persist:
        path = config.report_dir / "pipeline-run.json"
        write_json_atomic(path, run.as_dict())
    return run


def report_from_pipeline(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> AnalyticsReport:
    return build_report(snapshot, config)
