# CareOS AI Review Guide

This repository is prepared for automated review across multiple submissions.
Each layer can be inspected independently without reading the whole app.

## What to review first

| Question | File(s) |
|---|---|
| How is the app layered? | `docs/ARCHITECTURE.md` |
| How does the frontend start? | `frontend/vite.config.ts`, `frontend/src/main.tsx` |
| Where are API routes defined? | `backend/server.ts` |
| Where does demo data come from? | `backend/demoData.ts` |
| How is agentic output represented? | `shared/types/careos.ts`, `backend/analytics/reports.py` |
| How is data quality enforced? | `database/validate.py`, `backend/analytics/compliance.py` |
| How is the app deployed? | `vercel.json`, `infra/docker-compose.yml`, `docs/DEPLOYMENT.md` |
| What runs in CI? | Templates in `.github/workflow-templates/` (enable with a workflow-scoped token), or run `bun run check` locally |

## Non-TypeScript surfaces

The submission intentionally includes substantial non-TypeScript production
code so reviewers see a multi-stack system:

- **Python 3 analytics service** — metrics, anomaly detection, forecasting,
  compliance, FHIR/HL7/DICOM adapters, exporters, CLI, HTTP server, and tests.
- **SQL database layer** — normalized schema, views, indexes, and reference data.
- **Infrastructure** — Dockerfiles, Compose, nginx configuration, and Make targets.
- **CI/CD** — GitHub Actions and CodeQL configuration.
- **Scripts** — JavaScript Python launcher plus Bash verification/deploy helpers.

## Verification commands

```bash
bun run lint                 # TypeScript typecheck
bun run build                # Vite production build
bun run db:validate          # Python database contract check
bun run analytics:check      # Python analytics smoke check
bun run analytics:test       # Python unit tests
bash scripts/verify.sh       # all of the above
```

## Behavioral invariants

The reorganization did not change product behavior:

- Instant persona switching still works from the top-right `Views` menu.
- Appointment → patient portal → doctor prescription → radiology → billing sync
  still uses the same API routes and 8-second refetch cycle.
- Voice confirmation and structured report sections remain visible in the agent
  execution overlay and included in downloaded reports.
- Deterministic demo records are still reapplied idempotently on startup.
