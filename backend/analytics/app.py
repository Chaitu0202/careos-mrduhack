"""Dependency-free HTTP service exposing CareOS analytics endpoints."""

from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Mapping, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from .audit import audit_chain_export, verify_audit_trail
from .command_center import CommandCenterCache
from .config import AnalyticsConfig
from .events import build_event_report
from .ingest import load_snapshot, summarize_snapshot
from .metrics import calculate_all
from .nlp import intent_catalog
from .privacy import assess_privacy
from .quality import QualityEngine
from .reliability import build_reliability_report
from .reports import build_report, render_json, render_markdown
from .reports_extra import render_csv, render_html
from .scheduling import scheduling_summary
from .security import authorize_api_key, redact_mapping


class AnalyticsHTTPError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


class CareOSAnalyticsHandler(BaseHTTPRequestHandler):
    server_version = "CareOSAnalytics/1.1"
    protocol_version = "HTTP/1.1"

    @property
    def app_config(self) -> AnalyticsConfig:
        return self.server.app_config  # type: ignore[attr-defined]

    @property
    def center_cache(self) -> CommandCenterCache:
        return self.server.center_cache  # type: ignore[attr-defined]

    def log_message(self, fmt: str, *args: Any) -> None:
        if os.environ.get("CAREOS_ANALYTICS_QUIET") == "1":
            return
        super().log_message(fmt, *args)

    def _send(self, status: HTTPStatus, payload: Any, content_type: str = "application/json") -> None:
        body = payload.encode("utf-8") if isinstance(payload, str) else json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Access-Control-Allow-Origin", os.environ.get("CAREOS_ANALYTICS_ORIGIN", "*"))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        expected = os.environ.get("CAREOS_ANALYTICS_KEY")
        return authorize_api_key(self.headers, expected)

    def _require_auth(self) -> None:
        if not self._authorized():
            raise AnalyticsHTTPError(401, "Invalid or missing analytics API key")

    def _route(self) -> Tuple[HTTPStatus, Any, str]:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"
        query = parse_qs(parsed.query)

        if path == "/health":
            config = self.app_config
            return HTTPStatus.OK, {
                "status": "ok",
                "service": "careos-analytics",
                "dbPath": str(config.db_path),
                "dbExists": config.db_path.exists(),
            }, "application/json"

        self._require_auth()
        if path == "/config":
            return HTTPStatus.OK, self.app_config.public_dict(), "application/json"

        if path == "/snapshot":
            snapshot = load_snapshot(self.app_config)
            return HTTPStatus.OK, snapshot.as_dict(), "application/json"

        if path == "/summary":
            snapshot = load_snapshot(self.app_config)
            return HTTPStatus.OK, summarize_snapshot(snapshot), "application/json"

        if path == "/command-center":
            snapshot = load_snapshot(self.app_config)
            return HTTPStatus.OK, self.center_cache.get(snapshot, self.app_config), "application/json"

        if path == "/events":
            snapshot = load_snapshot(self.app_config)
            return HTTPStatus.OK, build_event_report(snapshot), "application/json"

        if path == "/quality":
            snapshot = load_snapshot(self.app_config)
            engine = QualityEngine()
            return HTTPStatus.OK, {
                "catalog": [rule.as_dict() for rule in engine.rules],
                "summary": engine.summary(snapshot),
                "findings": [finding.as_dict() for finding in engine.evaluate(snapshot)],
            }, "application/json"

        if path == "/audit":
            snapshot = load_snapshot(self.app_config)
            verification = verify_audit_trail(snapshot, self.app_config)
            payload = verification.as_dict()
            if "chain" in query:
                payload["chain"] = audit_chain_export(snapshot)
            return HTTPStatus.OK, payload, "application/json"

        if path == "/privacy":
            snapshot = load_snapshot(self.app_config)
            return HTTPStatus.OK, assess_privacy(snapshot).as_dict(), "application/json"

        if path == "/scheduling":
            snapshot = load_snapshot(self.app_config)
            return HTTPStatus.OK, scheduling_summary(snapshot), "application/json"

        if path == "/intents":
            return HTTPStatus.OK, intent_catalog(), "application/json"

        if path == "/reliability":
            snapshot = load_snapshot(self.app_config)
            metrics = calculate_all(snapshot, self.app_config)["core"]
            return HTTPStatus.OK, build_reliability_report(
                snapshot, self.app_config, metrics, dict(os.environ)
            ).as_dict(), "application/json"

        if path == "/metrics":
            snapshot = load_snapshot(self.app_config)
            report = build_report(snapshot, self.app_config)
            return HTTPStatus.OK, report.as_dict(), "application/json"

        if path == "/report":
            snapshot = load_snapshot(self.app_config)
            report = build_report(snapshot, self.app_config)
            fmt = query.get("format", ["json"])[0].lower()
            if fmt in {"md", "markdown", "text"}:
                return HTTPStatus.OK, render_markdown(report), "text/markdown"
            if fmt == "html":
                return HTTPStatus.OK, render_html(report), "text/html"
            if fmt == "csv":
                return HTTPStatus.OK, render_csv(report, query.get("section", ["findings"])[0]), "text/csv"
            return HTTPStatus.OK, render_json(report), "application/json"

        if path == "/redacted/report":
            snapshot = load_snapshot(self.app_config)
            report = build_report(snapshot, self.app_config)
            return HTTPStatus.OK, redact_mapping(report.as_dict()), "application/json"

        raise AnalyticsHTTPError(404, "Unknown analytics endpoint")

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        try:
            status, payload, content_type = self._route()
            self._send(status, payload, content_type)
        except AnalyticsHTTPError as exc:
            self._send(HTTPStatus(exc.status), {"error": exc.message})
        except Exception as exc:  # pragma: no cover - defensive boundary
            self._send(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(exc)})

    def do_HEAD(self) -> None:  # noqa: N802
        self.do_GET()


class AnalyticsServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: Tuple[str, int], config: AnalyticsConfig) -> None:
        self.app_config = config
        self.center_cache = CommandCenterCache(ttl_seconds=60)
        super().__init__(address, CareOSAnalyticsHandler)


def create_server(config: Optional[AnalyticsConfig] = None) -> AnalyticsServer:
    resolved = config or AnalyticsConfig.from_env()
    return AnalyticsServer((resolved.host, resolved.port), resolved)


def serve(config: Optional[AnalyticsConfig] = None) -> None:
    server = create_server(config)
    host, port = server.server_address[:2]
    print(f"CareOS analytics listening on http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    serve()
