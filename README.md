# CareOS — Production-Ready Layered Preview

CareOS is an AI-native hospital intelligence operating system. This repository
keeps the working preview and its deterministic demo data intact, while adding
a categorized production structure, a Python analytics service, a relational
database contract, containers, CI, and deployment documentation.

Preview: **http://localhost:3000/**

## Quick start

```bash
bun install
bun run dev
```

> Use Bun. `npm install` can fail with an `esbuild`/`vite` peer-dependency conflict.

Seeded logins:

| View | Username | Password |
|---|---|---|
| Super Admin | `admin@gmail.com` | `password` |
| Hospital Admin | `hospital@gmail.com` | `password` |
| Patient | `PAT-2026-0001` | `password` |
| Patient | `PAT-2026-0002` | `password` |

Use the top-right **Views** menu to switch instantly between Super Admin,
Hospital, Doctor, Patient Portal, and the eight operational modules.

## Repository layout

```text
frontend/   React 19 + Vite + Tailwind CSS UI
backend/    Express API, demo seed, Python analytics service
database/   PostgreSQL schema, views, indexes, validators, migration exporter
shared/     Domain types shared by frontend and backend
api/        Vercel serverless entrypoint
infra/      Docker, Compose, nginx, Makefile
scripts/    Cross-platform developer helpers
docs/       Architecture, deployment, API, and review guides
```

See `docs/ARCHITECTURE.md` for the full request/data flow.

## Technology mix

The product UI remains TypeScript/React, while production support layers use
other stacks so the codebase is not a single-language submission:

- **TypeScript / React / Vite / Tailwind** — frontend and Express API
- **Python 3** — analytics, anomaly detection, compliance, FHIR/HL7/DICOM
  adapters, simulation, ETL pipeline, exporters, HTTP service, and tests
- **SQL / PostgreSQL** — normalized schema, views, indexes, seed exporter
- **YAML / Docker / nginx** — containers, reverse proxy, GitHub Actions, CodeQL
- **JavaScript / Bash** — cross-platform scripts

## Verification

```bash
bun run lint           # TypeScript typecheck
bun run build          # Vite production build
bun run db:validate    # JSON database contract check
bun run analytics:check
bun run analytics:test
bun run check          # all checks in one command
bash scripts/verify.sh # checks plus production build
```

Python can also be run directly:

```bash
python3 -m backend.analytics.cli check
python3 -m backend.analytics.cli adapters
python3 -m backend.analytics.cli simulate
python3 -m backend.analytics.cli export
python3 -m backend.analytics.cli serve --port 8100
```

On Windows, the package scripts use `node scripts/python.mjs`, which finds
`py -3`, `python3`, or `python` automatically.

## Seeded demo data

`backend/demoData.ts` deterministically seeds every dashboard and agentic output
field on startup, including:

- applications, hospitals, subscriptions, users, audit logs, platform activity
- patients, appointments, doctor queue, departments, staff, resources
- prescriptions, radiology orders/reports, bills, patient portal notifications
- all eight hospital module queues
- agents, tasks, recent activity, workflows, workflow executions
- intent summaries, executive briefs, voice confirmations, inter-agent messages,
  departmental alerts, approvals, and structured report sections

Use `CAREOS_DEMO_DATA=false` to disable synthetic records and
`CAREOS_DEMO_SWITCH=false` to disable demo persona switching in real deployments.

## Connected workflow

1. Create/choose an appointment in **Appointments**.
2. Patient portal shows the appointment and credentials.
3. Doctor uploads a prescription and creates a radiology referral.
4. Patient portal reflects both immediately.
5. Radiology uploads an X-ray report; a fixed **150 USD** bill is created.
6. Billing module and patient portal show the same bill.
7. The agent execution overlay shows coordination messages, alerts, approvals,
   executive brief, voice confirmation, and downloadable report sections.

Dashboard clients refetch on an 8-second interval. This is intentional for the
preview; no WebSocket or event bus is required.

## Deployment

- **Vercel:** existing `vercel.json` builds `dist/` and routes `/api/*` to
  `api/index.ts`. Data is seeded automatically on cold starts.
- **Docker:** `make -f infra/Makefile docker-up` starts API, frontend, and
  analytics services.
- **Postgres:** `database/schema.sql`, `views.sql`, `indexes.sql`, and
  `database/migrate.py` provide a migration path for a relational backend.

See `docs/DEPLOYMENT.md` for environment variables and caveats.

## Preview caveats

- Local data persists in `.data/careos-db.json` (git-ignored).
- Vercel uses `os.tmpdir()/careos-data`, which is ephemeral across cold starts;
  the deterministic seed is reapplied automatically.
- Prescription and X-ray attachments are JSON data URLs for preview only, not
  production DICOM/file storage.
- Live AI orchestration requires `GEMINI_API_KEY1` (or `GEMINI_API_KEY`,
  `GOOGLE_API_KEY`, `API_KEY`). Seeded agentic history does not require Gemini.

## Documentation

- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `docs/API.md`
- `docs/DATA_MODEL.md`
- `docs/REVIEW_GUIDE.md`
- `docs/RUNBOOK.md`
- `docs/SECURITY.md`
- `docs/TESTING.md`
- `backend/analytics/README.md`
