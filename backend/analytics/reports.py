"""Report assembly and markdown rendering for the CareOS analytics service."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Mapping, Optional

from .anomalies import detect_all
from .compliance import compliance_score, run_compliance
from .config import AnalyticsConfig
from .forecasting import forecast_all
from .ingest import summarize_snapshot
from .metrics import build_metric_registry, calculate_all, compute_core_metrics
from .models import AnalyticsReport, Finding, HospitalSnapshot, ReportBlock, Timeseries


def _metric_item(label: str, value: Any, unit: str = "") -> Dict[str, Any]:
    return {"label": label, "value": f"{value}{unit}".strip()}


def build_blocks(snapshot: HospitalSnapshot, config: AnalyticsConfig, metrics: Dict[str, Any]) -> List[ReportBlock]:
    core = metrics["core"]
    finance = metrics["finance"]
    throughput = metrics["throughput"]
    blocks: List[ReportBlock] = [
        ReportBlock(
            title="Operational Pulse",
            items=[
                _metric_item("Patients", len(snapshot.patients)),
                _metric_item("Appointments", len(snapshot.appointments)),
                _metric_item("Average wait", round(core["average_wait_minutes"], 1), " min"),
                _metric_item("P90 wait", round(core["p90_wait_minutes"], 1), " min"),
                _metric_item("Bed occupancy", round(core["bed_occupancy_percent"], 1), "%"),
            ],
            notes=["Values are derived from the deterministic demo dataset at report generation time."],
        ),
        ReportBlock(
            title="Clinical Throughput",
            items=[
                _metric_item("Radiology completion", round(core["radiology_completion_rate"], 1), "%"),
                _metric_item("Prescriptions", len(snapshot.prescriptions)),
                _metric_item("Bills", len(snapshot.bills)),
                _metric_item("Completed in window", throughput["completedInWindow"]),
                _metric_item("Arrivals/hour", throughput["arrivalsPerHour"]),
            ],
        ),
        ReportBlock(
            title="AI Agent Workforce",
            items=[
                _metric_item("Agents", len(snapshot.agents)),
                _metric_item("Completed tasks", sum(agent.completed_tasks for agent in snapshot.agents)),
                _metric_item("Success rate", round(core["agent_success_rate"], 1), "%"),
                _metric_item("Avg response", round(core["agent_avg_response_seconds"], 2), "s"),
                _metric_item("Workflow runs", int(core["workflow_execution_count"])),
            ],
        ),
        ReportBlock(
            title="Revenue Cycle",
            items=[
                _metric_item("Invoiced", round(finance["invoiceTotalUsd"], 2), " USD"),
                _metric_item("Collected", round(core["billing_collected_usd"], 2), " USD"),
                _metric_item("Collection rate", round(core["billing_collection_rate"], 1), "%"),
                _metric_item("MRR", round(finance["monthlyRecurringUsd"], 2), " USD"),
            ],
        ),
        ReportBlock(
            title="Top Department Pressure",
            items=[
                _metric_item(
                    row["department"],
                    f"score {row['loadScore']} · wait {row['averageWaitMinutes']} min",
                )
                for row in metrics["departments"][:5]
            ],
        ),
    ]
    findings: List[Finding] = detect_all(snapshot, config) + run_compliance(snapshot, config)
    if findings:
        blocks.append(
            ReportBlock(
                title="Findings Requiring Review",
                items=[
                    _metric_item(finding.severity.upper(), f"{finding.title} — {finding.id}")
                    for finding in findings[: config.max_report_sections]
                ],
            )
        )
    return blocks


def build_report(snapshot: HospitalSnapshot, config: AnalyticsConfig) -> AnalyticsReport:
    """Assemble the full deterministic analytics report."""
    metrics = calculate_all(snapshot, config)
    registry = build_metric_registry(snapshot)
    findings = detect_all(snapshot, config) + run_compliance(snapshot, config)
    forecast = forecast_all(registry, config)
    core = metrics["core"]
    summary = summarize_snapshot(snapshot)
    summary.update(
        {
            "complianceScore": round(compliance_score(findings), 2),
            "findingCount": len(findings),
            "criticalFindings": sum(1 for finding in findings if finding.severity == "critical"),
        }
    )
    flat_metrics: Dict[str, float] = dict(core)
    flat_metrics["compliance_score"] = float(summary["complianceScore"])
    return AnalyticsReport(
        generated_at=snapshot.generated_at,
        summary=summary,
        metrics=flat_metrics,
        timeseries=list(registry.values()),
        agents=list(snapshot.agents),
        findings=findings,
        forecast=forecast,
        blocks=build_blocks(snapshot, config, metrics),
    )


def render_markdown(report: AnalyticsReport) -> str:
    lines: List[str] = [
        "# CareOS Operational Intelligence Report",
        "",
        f"_Generated {report.generated_at.isoformat()}_",
        "",
        "## Executive Summary",
        "",
    ]
    for key, value in report.summary.items():
        lines.append(f"- **{key.replace('_', ' ').title()}:** {value}")
    lines.extend(["", "## Core Metrics", ""])
    for key, value in sorted(report.metrics.items()):
        lines.append(f"- `{key}`: {round(value, 4)}")
    for block in report.blocks:
        lines.extend(["", f"## {block.title}", ""])
        for item in block.items:
            lines.append(f"- **{item['label']}:** {item['value']}")
        for note in block.notes:
            lines.append(f"> {note}")
    if report.findings:
        lines.extend(["", "## Findings", ""])
        for finding in report.findings:
            lines.append(f"### [{finding.severity.upper()}] {finding.title}")
            lines.append(finding.detail)
            if finding.recommendation:
                lines.append(f"**Recommendation:** {finding.recommendation}")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_json(report: AnalyticsReport) -> str:
    import json

    return json.dumps(report.as_dict(), indent=2, ensure_ascii=False) + "\n"
