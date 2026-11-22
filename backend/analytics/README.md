# CareOS Analytics Service (Python)

A dependency-free Python 3 service that reads the same CareOS JSON database as the Express API and produces operational metrics, anomaly findings, compliance checks, forecasts, and human-readable reports.

It is intentionally additive: the primary application continues to run on TypeScript/React/Express, while this service provides an independently reviewable Python layer for analytics, governance, and CI checks.

## Run

```bash
python3 -m backend.analytics.cli check
python3 -m backend.analytics.cli summary
python3 -m backend.analytics.cli report --format markdown --output reports/careos-report.md
python3 -m backend.analytics.cli command-center
python3 -m backend.analytics.cli events
python3 -m backend.analytics.cli quality
python3 -m backend.analytics.cli audit --chain
python3 -m backend.analytics.cli nlp "Create an urgent STAT chest X-Ray bill" --ground
python3 -m backend.analytics.cli privacy
python3 -m backend.analytics.cli scheduling
python3 -m backend.analytics.cli reliability
python3 -m backend.analytics.cli migrate --catalog
python3 -m backend.analytics.cli serve --port 8100
```

Or use the root scripts:

```bash
bun run analytics:check
bun run analytics
```

## HTTP endpoints

| Endpoint | Description |
|---|---|
| `GET /health` | Liveness and DB path information |
| `GET /summary` | Compact snapshot counts |
| `GET /snapshot` | Typed normalized snapshot |
| `GET /metrics` | Full analytics report JSON |
| `GET /report` | JSON report |
| `GET /report?format=markdown` | Markdown report |
| `GET /report?format=html` | Self-contained HTML report |
| `GET /report?format=csv&section=metrics` | CSV export of findings, metrics, agents, or blocks |
| `GET /redacted/report` | PII-redacted report |
| `GET /command-center` | Cached unified operational view |
| `GET /events` | Event stream and projection counters |
| `GET /quality` | Data-quality rule catalog and findings |
| `GET /audit?chain=1` | Audit verification and SHA-256 hash chain |
| `GET /privacy` | Minimum-necessary and k-anonymity checks |
| `GET /scheduling` | Shift coverage and caseload balance |
| `GET /reliability` | Error budgets, dependency health, incident triggers |
| `GET /intents` | Supported natural-language command intents |

Set `CAREOS_ANALYTICS_KEY` to require an API key via `x-careos-analytics-key` or bearer token. All non-health endpoints are protected when that variable is set.

## Modules

- `config.py` — environment-driven configuration and thresholds
- `models.py` — dataclasses for snapshots, metrics, findings, and reports
- `storage.py` — atomic JSON reads/writes and collection normalization
- `ingest.py` — raw DB to typed snapshot conversion
- `metrics.py` — operational KPI calculations
- `anomalies.py` — wait-time, capacity, agent, workflow, and data-quality checks
- `forecasting.py` — linear trend and exponential smoothing forecasts
- `compliance.py` — governance, human oversight, and audit checks
- `security.py` — redaction and shared-secret authorization
- `reports.py` — report assembly and markdown rendering
- `reports_extra.py` — HTML/CSV renderers, executive digest, finding matrix
- `fhir.py`, `hl7.py`, `dicom.py` — interoperability adapters
- `backend/integrations/` — retries, idempotency, and signed webhooks
- `pipeline.py` — composable ETL stages
- `simulation.py` — deterministic capacity scenarios
- `export.py` — adapter and report export bundles
- `quality.py` — data-quality rule engine
- `audit.py` — audit verification and tamper-evident hash chains
- `observability.py` — counters, latency, event log, SLO evaluation
- `clinical_rules.py` — triage scoring, care pathways, human oversight
- `nlp.py` — deterministic intent/entity parsing and voice confirmations
- `privacy.py` — minimum-necessary fields and k-anonymity
- `scheduling.py` — shift coverage and caseload balancing
- `events.py` — event sourcing and projections
- `migrations.py` — versioned JSON-store migrations
- `http_client.py` — standard-library HTTP client with circuit breaker
- `command_center.py` — unified aggregation with a TTL cache
- `reliability.py` — error budgets, burn rates, dependency health, incident triggers
- `app.py` — thread-safe HTTP service
- `cli.py` — command-line interface

## Tests

```bash
python3 -m unittest discover -s backend/analytics/tests -t .
```
