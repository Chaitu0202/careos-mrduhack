"""Deterministic CSV/JSONL exporters for CareOS operational snapshots."""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .config import AnalyticsConfig
from .fhir import build_bundle
from .hl7 import build_messages
from .models import HospitalSnapshot
from .reports import build_report, render_json, render_markdown
from .security import redact_mapping


def rows_to_csv(rows: Iterable[Mapping[str, Any]], fields: Optional[Sequence[str]] = None) -> str:
    materialized = [dict(row) for row in rows]
    fieldnames = list(fields or _union_fields(materialized))
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for row in materialized:
        writer.writerow({key: _cell(row.get(key)) for key in fieldnames})
    return buffer.getvalue()


def _union_fields(rows: Iterable[Mapping[str, Any]]) -> List[str]:
    fields: List[str] = []
    for row in rows:
        for key in row:
            if key not in fields:
                fields.append(key)
    return fields


def _cell(value: Any) -> Any:
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if value is None:
        return ""
    return value


def rows_to_jsonl(rows: Iterable[Mapping[str, Any]], redact: bool = False) -> str:
    lines: List[str] = []
    for row in rows:
        payload = redact_mapping(row) if redact else dict(row)
        lines.append(json.dumps(payload, ensure_ascii=False, separators=(",", ":"), default=str))
    return "\n".join(lines) + ("\n" if lines else "")


def export_snapshot(snapshot: HospitalSnapshot, output_dir: Path, config: AnalyticsConfig) -> Dict[str, int]:
    output_dir.mkdir(parents=True, exist_ok=True)
    written: Dict[str, int] = {}

    tabular: Dict[str, List[Mapping[str, Any]]] = {
        "patients": snapshot.patients,
        "appointments": snapshot.appointments,
        "prescriptions": snapshot.prescriptions,
        "radiology_orders": snapshot.radiology_orders,
        "bills": snapshot.bills,
        "departments": snapshot.departments,
        "notifications": snapshot.notifications,
        "audit_logs": snapshot.audit_logs,
        "module_records": snapshot.module_records,
    }
    for name, rows in tabular.items():
        path = output_dir / f"{name}.csv"
        path.write_text(rows_to_csv(rows), encoding="utf-8")
        written[path.name] = len(rows)

    for name, rows in (("patients", snapshot.patients), ("appointments", snapshot.appointments), ("bills", snapshot.bills)):
        path = output_dir / f"{name}.jsonl"
        path.write_text(rows_to_jsonl(rows, redact=config.enable_redaction), encoding="utf-8")
        written[path.name] = len(rows)

    fhir_path = output_dir / "fhir-bundle.json"
    bundle = build_bundle(snapshot)
    fhir_path.write_text(json.dumps(bundle, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    written[fhir_path.name] = len(bundle.get("entry", []))

    hl7_path = output_dir / "hl7-orm-messages.txt"
    messages = build_messages(snapshot)
    hl7_path.write_text("\n\n".join(f"; {key}\n{value}" for key, value in messages.items()), encoding="utf-8")
    written[hl7_path.name] = len(messages)

    report = build_report(snapshot, config)
    (output_dir / "analytics-report.json").write_text(render_json(report), encoding="utf-8")
    (output_dir / "analytics-report.md").write_text(render_markdown(report), encoding="utf-8")
    written["analytics-report.json"] = len(report.findings)
    written["analytics-report.md"] = len(report.blocks)
    return written


def export_path(config: AnalyticsConfig) -> Path:
    return config.report_dir / "exports"
