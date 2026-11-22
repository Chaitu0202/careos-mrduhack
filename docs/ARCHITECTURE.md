# CareOS Architecture

CareOS is organized as a layered monorepo. The preview behavior is unchanged from
the original single-folder app; only the physical layout and supporting tooling
were introduced.

```text
careos/
├── frontend/          React 19 + Vite + Tailwind CSS UI
│   ├── src/pages      Public, patient, and dashboard screens
│   ├── src/components Shared UI, charts, agent overlay, layout
│   ├── src/context    Authentication state
│   ├── public/        Static marketing assets
│   └── vite.config.ts Frontend build config
├── backend/
│   ├── server.ts      Express API, auth, orchestration, JSON persistence
│   ├── demoData.ts    Deterministic cross-dashboard seed dataset
│   └── analytics/     Python 3 operational intelligence service
├── database/
│   ├── schema.sql     PostgreSQL 15+ target schema
│   ├── validate.py    JSON database contract checker
│   ├── migrate.py     JSON -> PostgreSQL seed exporter
│   └── *.sql          Views, indexes, and reference data
├── shared/types/      Domain types shared by frontend and backend
├── api/               Vercel serverless entrypoint
├── infra/             Docker, Compose, nginx, Makefile
├── scripts/           Cross-platform developer scripts
├── .github/           CI and security workflows
└── docs/              Architecture, deployment, review, and API docs
```

## Runtime paths

### Local preview
`bun run dev` executes `tsx backend/server.ts`. The server starts Vite in
middleware mode using `frontend/vite.config.ts`, mounts the Express API under
`/api`, and persists the demo database to `.data/careos-db.json`.

### Vercel
`vercel.json` builds the frontend with `bun run build` into `dist/`. Requests to
`/api/*` are rewritten to `api/index.ts`, which forwards them to the exported
Express `app` from `backend/server.ts`. Because the filesystem is ephemeral,
`applyDemoData()` reapplies the deterministic seed on cold starts.

### Containers
`infra/docker-compose.yml` starts three independently reviewable services:
- `api` — Express/Bun backend on port 3000
- `frontend` — built static bundle served by nginx on port 8080
- `analytics` — Python analytics HTTP service on port 8100

The API and analytics service share a named volume for the JSON database.

## Data flow

1. User actions call the Express API.
2. The API mutates the JSON database and appends audit entries.
3. Dashboard clients refetch on an 8-second interval, keeping appointment,
   patient portal, doctor, radiology, and billing views synchronized.
4. The Python analytics service reads the same JSON database and derives
   metrics, anomalies, compliance findings, forecasts, and reports.
5. The database tooling validates referential integrity and can export a
   relational seed for Postgres review.

## Technology mix

The application keeps its React/TypeScript product surface, while production
supporting layers deliberately use other stacks:

| Layer | Technology | Language |
|---|---|---|
| UI | React 19, Vite, Tailwind CSS 4 | TypeScript, CSS |
| API | Express 4 on Bun/Node | TypeScript |
| Analytics | Standard-library HTTP service | Python 3 |
| Database tooling | Schema, views, migration exporter | SQL, Python |
| Containers | Docker, Compose, nginx | YAML, Dockerfile, nginx config |
| CI/CD | GitHub Actions, CodeQL | YAML |
| Scripts | Cross-platform launchers | JavaScript, Bash |
