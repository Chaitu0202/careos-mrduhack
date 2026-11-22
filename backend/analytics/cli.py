"""Command-line interface for the CareOS analytics toolchain."""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Optional, Sequence

from .app import serve
from .audit import audit_chain_export, verify_audit_trail
from .clinical_rules import oversight_findings, triage_queue
from .command_center import build_command_center
from .config import AnalyticsConfig
from .dicom import build_worklist, validate_worklist
from .events import build_event_report
from .export import export_path, export_snapshot
from .fhir import build_bundle, validate_bundle
from .hl7 import build_messages, validate_message
from .ingest import load_snapshot, summarize_snapshot
from .migrations import migrate_payload, migration_catalog
from .nlp import analyze_command, intent_catalog
from .pipeline import run_pipeline
from .privacy import assess_privacy
from .metrics import calculate_all
from .quality import QualityEngine, rule_catalog
from .reliability import build_reliability_report
from .reports import build_report, render_json, render_markdown
from .reports_extra import executive_digest, finding_matrix, render_csv, render_html
from .scheduling import scheduling_summary
from .simulation import run_scenarios
from .storage import StorageError, read_json, write_json_atomic


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="careos-analytics", description="CareOS operational analytics CLI")
    parser.add_argument("--config-json", action="store_true", help="print resolved configuration")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("check", help="validate DB load and produce a compliance summary")

    report = sub.add_parser("report", help="generate an analytics report")
    report.add_argument("--format", choices=["json", "markdown", "html", "csv"], default="markdown")
    report.add_argument("--section", choices=["findings", "metrics", "agents", "blocks"], default="findings")
    report.add_argument("--output", type=Path)

    serve_cmd = sub.add_parser("serve", help="start the analytics HTTP service")
    serve_cmd.add_argument("--host")
    serve_cmd.add_argument("--port", type=int)

    sub.add_parser("summary", help="print the compact snapshot summary")
    sub.add_parser("command-center", help="build the unified operational view")

    adapters = sub.add_parser("adapters", help="validate FHIR, HL7, and DICOM adapters")
    adapters.add_argument("--format", choices=["json", "markdown"], default="json")

    sub.add_parser("simulate", help="run deterministic capacity scenarios")

    pipeline = sub.add_parser("pipeline", help="run the composable ETL pipeline")
    pipeline.add_argument("--persist", action="store_true", help="write reports/pipeline-run.json")

    export = sub.add_parser("export", help="export snapshot adapters and reports")
    export.add_argument("--output", type=Path, default=None)

    sub.add_parser("events", help="materialize the operational event stream")
    sub.add_parser("quality", help="evaluate data-quality rules")

    audit = sub.add_parser("audit", help="verify the audit trail and build a hash chain")
    audit.add_argument("--chain", action="store_true", help="include the SHA-256 hash chain")

    nlp = sub.add_parser("nlp", help="parse a natural-language command")
    nlp.add_argument("text", nargs="?", default="Create an urgent STAT chest X-Ray bill")
    nlp.add_argument("--ground", action="store_true", help="ground entities against the loaded snapshot")

    sub.add_parser("intents", help="list supported command intents")
    sub.add_parser("privacy", help="run minimum-necessary and k-anonymity checks")
    sub.add_parser("scheduling", help="inspect shift coverage and caseload balance")
    sub.add_parser("reliability", help="evaluate error budgets and dependency health")
    sub.add_parser("triage", help="rank the appointment queue")
    sub.add_parser("oversight", help="list findings that require human oversight")
    sub.add_parser("digest", help="print an executive digest of the analytics report")
    sub.add_parser("matrix", help="group report findings by category")

    migrate = sub.add_parser("migrate", help="upgrade the JSON store schema version")
    migrate.add_argument("--persist", action="store_true", help="write the migrated payload back to disk")
    migrate.add_argument("--catalog", action="store_true", help="print the migration catalog only")
    return parser


def _with_overrides(config: AnalyticsConfig, args: argparse.Namespace) -> AnalyticsConfig:
    from dataclasses import replace

    changes = {}
    if getattr(args, "host", None):
        changes["host"] = args.host
    if getattr(args, "port", None):
        changes["port"] = args.port
    return replace(config, **changes) if changes else config


def _print(payload: Any) -> None:
    print(json.dumps(payload, indent=2, ensure_ascii=False))


def run(argv: Optional[Sequence[str]] = None) -> int:
    parser = _parser()
    args = parser.parse_args(argv)
    config = AnalyticsConfig.from_env()

    if args.config_json:
        print(json.dumps(config.public_dict(), indent=2))
        if not args.command:
            return 0

    if not args.command:
        parser.print_help()
        return 0

    config = _with_overrides(config, args)

    try:
        if args.command == "serve":
            serve(config)
            return 0

        snapshot = load_snapshot(config)

        if args.command == "summary":
            _print(summarize_snapshot(snapshot))
            return 0

        if args.command == "command-center":
            _print(build_command_center(snapshot, config))
            return 0

        if args.command == "events":
            _print(build_event_report(snapshot))
            return 0

        if args.command == "quality":
            engine = QualityEngine()
            _print({"catalog": rule_catalog(), "findings": [f.as_dict() for f in engine.evaluate(snapshot)], "summary": engine.summary(snapshot)})
            return 0

        if args.command == "audit":
            verification = verify_audit_trail(snapshot, config)
            payload = verification.as_dict()
            if args.chain:
                payload["chain"] = audit_chain_export(snapshot)
            _print(payload)
            return 0 if verification.ok else 3

        if args.command == "nlp":
            analysis = analyze_command(args.text)
            payload = analysis.as_dict()
            if args.ground:
                from .nlp import ground_command

                payload["grounded"] = ground_command(analysis, snapshot)
            _print(payload)
            return 0

        if args.command == "intents":
            _print(intent_catalog())
            return 0

        if args.command == "privacy":
            report = assess_privacy(snapshot)
            _print(report.as_dict())
            return 0 if report.ok else 3

        if args.command == "scheduling":
            _print(scheduling_summary(snapshot))
            return 0

        if args.command == "reliability":
            metrics = calculate_all(snapshot, config)["core"]
            _print(build_reliability_report(snapshot, config, metrics, dict(os.environ)).as_dict())
            return 0

        if args.command == "triage":
            _print([result.as_dict() for result in triage_queue(snapshot)])
            return 0

        if args.command == "oversight":
            _print([finding.as_dict() for finding in oversight_findings(snapshot)])
            return 0

        if args.command == "migrate":
            if args.catalog:
                _print(migration_catalog())
                return 0
            migrated, result = migrate_payload(read_json(config.db_path))
            if args.persist:
                write_json_atomic(config.db_path, migrated)
            _print(result.as_dict())
            return 0

        if args.command == "adapters":
            bundle = build_bundle(snapshot)
            worklist = build_worklist(snapshot)
            messages = build_messages(snapshot)
            payload = {
                "fhir": {"resources": len(bundle.get("entry", [])), "errors": validate_bundle(bundle)},
                "dicom": validate_worklist(worklist),
                "hl7": {
                    "messages": len(messages),
                    "errors": [
                        f"{identifier}: {error}"
                        for identifier, message in messages.items()
                        for error in validate_message(message)
                    ],
                },
            }
            if args.format == "markdown":
                lines = ["# CareOS Interoperability Adapters", ""]
                for name, result in payload.items():
                    lines.append(f"## {name.upper()}")
                    lines.append(f"- Status: {'ok' if not result.get('errors') else 'issues'}")
                    for error in result.get("errors", []):
                        lines.append(f"- {error}")
                    lines.append("")
                print("\n".join(lines))
            else:
                _print(payload)
            return 0

        if args.command == "simulate":
            _print(run_scenarios(snapshot, config))
            return 0

        if args.command == "pipeline":
            run = run_pipeline(config, persist=args.persist)
            _print(run.as_dict())
            return 0 if run.ok else 3

        if args.command == "export":
            output = args.output or export_path(config)
            written = export_snapshot(snapshot, output, config)
            _print({"output": str(output), "written": written})
            return 0

        report = build_report(snapshot, config)
        if args.command == "check":
            center = build_command_center(snapshot, config)
            _print({
                "status": "ok",
                "dbPath": str(config.db_path),
                "summary": report.summary,
                "findingCounts": report.finding_counts(),
                "healthScore": center["healthScore"],
                "attentionCount": len(center["attentionItems"]),
            })
            return 0

        if args.command == "report":
            if args.format == "markdown":
                rendered = render_markdown(report)
            elif args.format == "html":
                rendered = render_html(report)
            elif args.format == "csv":
                rendered = render_csv(report, args.section)
            else:
                rendered = render_json(report)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(rendered, encoding="utf-8")
                print(f"Wrote report to {args.output}")
            else:
                print(rendered, end="" if rendered.endswith("\n") else "\n")
            return 0

        if args.command == "digest":
            print(executive_digest(report))
            return 0

        if args.command == "matrix":
            _print(finding_matrix(report.findings))
            return 0
    except StorageError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(run())
