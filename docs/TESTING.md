# CareOS Testing Guide

## Test layers

| Layer | Command | What it verifies |
|---|---|---|
| TypeScript | `bun run lint` | Types across frontend, backend, and shared types |
| Frontend build | `bun run build` | Vite can produce a production bundle |
| Database contract | `bun run db:validate` | Collections, IDs, statuses, references, agentic outputs |
| Analytics smoke | `bun run analytics:check` | DB load, report generation, compliance summary |
| Python units | `bun run analytics:test` | Metrics, compliance, adapters, pipeline, integrations |
| Full check | `bun run check` | All of the above except the Vite bundle |

## Python test inventory

- `test_metrics.py` — KPI math, registry, station families
- `test_compliance.py` — governance findings, redaction, stable hashes
- `test_reports.py` — report shape, markdown/JSON rendering, forecasting
- `test_interop.py` — FHIR, HL7, DICOM, export, simulation
- `test_pipeline.py` — composable ETL stages and persistence
- `test_review_layers.py` — quality, audit, clinical, observability, integrations
- `test_operation_modules.py` — NLP, privacy, scheduling, HTTP client, migrations
- `test_events.py` — event streams, projections, snapshot event extraction

## Manual preview smoke test

1. Start `bun run dev`.
2. Open `http://localhost:3000/`.
3. Login as `admin@gmail.com` / `password`.
4. Use **Views** to switch to Hospital Admin.
5. Confirm Command Center shows non-zero agents, tasks, and alerts.
6. Open Appointments and choose an existing patient appointment.
7. Switch to Doctor Queue, upload a prescription, and create a radiology order.
8. Switch to Patient Portal with `PAT-2026-0001` and confirm the new records.
9. Switch to Radiology and upload an X-ray report.
10. Confirm a bill appears in Billing and in the patient portal.
11. Open the workflow overlay and confirm voice confirmation and report sections.

## API smoke test

```bash
curl -s http://localhost:3000/api/auth/admin-status
curl -s http://127.0.0.1:3000/ | head -c 200
curl -s http://localhost:8100/health
```

Protected routes need `Authorization: Bearer <token>`. Obtain a token with
`POST /api/auth/login` and then call `/api/dashboard/overview` or
`/api/patient/portal`.

## Failure signals

- `ERESOLVE` during install — use Bun instead of npm.
- `503` from orchestration — Gemini key missing; seeded outputs still work.
- Empty patient portal — demo data disabled or wrong identifier.
- Validation warnings about `APP-TEST-0001` — legacy preview references; safe in
  demo mode, but resolve before a real migration.
