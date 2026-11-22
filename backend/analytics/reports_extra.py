"""Extended renderers for CareOS analytics reports."""

from __future__ import annotations

import html
import json
from typing import Any, Dict, Iterable, List, Mapping, Optional, Sequence

from .models import AnalyticsReport, Finding, ReportBlock


def render_html(report: AnalyticsReport) -> str:
    lines: List[str] = [
        "<!doctype html>",
        "<html lang=\"en\">",
        "<head>",
        "<meta charset=\"utf-8\">",
        "<title>CareOS Operational Intelligence Report</title>",
        "<style>",
        "body{font-family:system-ui,sans-serif;max-width:900px;margin:40px auto;color:#162033;line-height:1.5}",
        "h1{color:#0b63ce} h2{margin-top:32px;border-bottom:1px solid #d7e0ec;padding-bottom:6px}",
        "table{border-collapse:collapse;width:100%} td,th{border:1px solid #d7e0ec;padding:8px;text-align:left}",
        ".critical{color:#b42318}.high{color:#c4320a}.medium{color:#9a6700}.low{color:#475467}",
        "</style>",
        "</head>",
        "<body>",
        f"<h1>CareOS Operational Intelligence Report</h1>",
        f"<p><em>Generated {html.escape(report.generated_at.isoformat())}</em></p>",
    ]
    lines.extend(["<h2>Summary</h2>", "<table><tr><th>Metric</th><th>Value</th></tr>"])
    for key, value in report.summary.items():
        lines.append(f"<tr><td>{html.escape(str(key))}</td><td>{html.escape(str(value))}</td></tr>")
    lines.append("</table>")

    for block in report.blocks:
        lines.append(f"<h2>{html.escape(block.title)}</h2>")
        if block.items:
            lines.append("<table><tr><th>Label</th><th>Value</th></tr>")
            for item in block.items:
                lines.append(
                    f"<tr><td>{html.escape(str(item.get('label', '')))}</td>"
                    f"<td>{html.escape(str(item.get('value', '')))}</td></tr>"
                )
            lines.append("</table>")
        for note in block.notes:
            lines.append(f"<blockquote>{html.escape(note)}</blockquote>")

    if report.findings:
        lines.append("<h2>Findings</h2>")
        for finding in report.findings:
            lines.append(f"<h3 class=\"{finding.severity}\">[{finding.severity.upper()}] {html.escape(finding.title)}</h3>")
            lines.append(f"<p>{html.escape(finding.detail)}</p>")
            if finding.recommendation:
                lines.append(f"<p><strong>Recommendation:</strong> {html.escape(finding.recommendation)}</p>")
    lines.extend(["</body>", "</html>", ""])
    return "\n".join(lines)


def render_csv(report: AnalyticsReport, section: str = "findings") -> str:
    if section == "metrics":
        rows: List[Mapping[str, Any]] = [
            {"metric": key, "value": round(value, 4)} for key, value in sorted(report.metrics.items())
        ]
        fields = ("metric", "value")
    elif section == "agents":
        rows = [agent.as_dict() for agent in report.agents]
        fields = ("id", "name", "status", "successRate", "completedTasks", "pendingTasks")
    elif section == "blocks":
        rows = [
            {"block": block.title, "items": len(block.items), "notes": len(block.notes)}
            for block in report.blocks
        ]
        fields = ("block", "items", "notes")
    else:
        rows = [finding.as_dict() for finding in report.findings]
        fields = ("id", "severity", "category", "title", "detail")
    return _to_csv(rows, fields)


def _to_csv(rows: Iterable[Mapping[str, Any]], fields: Sequence[str]) -> str:
    import csv
    import io

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=list(fields), extrasaction="ignore", lineterminator="\n")
    writer.writeheader()
    for row in rows:
        writer.writerow({field: _cell(row.get(field)) for field in fields})
    return buffer.getvalue()


def _cell(value: Any) -> Any:
    if isinstance(value, (list, dict)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return "" if value is None else value


def executive_digest(report: AnalyticsReport) -> str:
    findings = report.findings
    critical = [finding for finding in findings if finding.severity == "critical"]
    high = [finding for finding in findings if finding.severity == "high"]
    metric_line = ", ".join(
        f"{key.replace('_', ' ')} {round(value, 1)}"
        for key, value in list(sorted(report.metrics.items()))[:6]
    )
    parts: List[str] = [
        f"CareOS digest generated {report.generated_at.isoformat()}.",
        f"Key metrics: {metric_line}.",
        f"Compliance score: {report.summary.get('complianceScore', 'n/a')}.",
        f"Findings: {len(findings)} total, {len(critical)} critical, {len(high)} high.",
    ]
    if critical:
        parts.append("Immediate action required for critical findings before release.")
    elif high:
        parts.append("Review high-severity findings during the next operations sync.")
    else:
        parts.append("No critical or high-severity findings detected.")
    return " ".join(parts)


def finding_matrix(findings: Sequence[Finding]) -> Dict[str, List[Dict[str, str]]]:
    matrix: Dict[str, List[Dict[str, str]]] = {}
    for finding in findings:
        matrix.setdefault(finding.category, []).append(
            {
                "id": finding.id,
                "severity": finding.severity,
                "title": finding.title,
                "targetPath": finding.target_path,
            }
        )
    for rows in matrix.values():
        rows.sort(key=lambda row: (row["severity"], row["id"]))
    return matrix


def block_outline(report: AnalyticsReport) -> List[Dict[str, Any]]:
    return [
        {
            "title": block.title,
            "itemCount": len(block.items),
            "noteCount": len(block.notes),
            "labels": [str(item.get("label", "")) for item in block.items],
        }
        for block in report.blocks
    ]
