# CareOS Deployment Guide

## Local preview

```bash
bun install
bun run dev
# http://localhost:3000
```

Seeded logins:

| View | Username | Password |
|---|---|---|
| Super Admin | `admin@gmail.com` | `password` |
| Hospital Admin | `hospital@gmail.com` | `password` |
| Patient | `PAT-2026-0001` | `password` |

## Full verification

```bash
bun run check
bun run build
bash scripts/verify.sh
```

## Vercel

The existing `vercel.json` is preserved:

- Build command: `bun run build`
- Output directory: `dist`
- API function: `api/index.ts`
- SPA fallback rewrites remain unchanged

Required runtime variables for live AI orchestration:

```text
GEMINI_API_KEY1=...
# or GEMINI_API_KEY / GOOGLE_API_KEY / API_KEY
```

Optional deployment guards:

```text
CAREOS_DEMO_DATA=false     # disable synthetic seed data
CAREOS_DEMO_SWITCH=false   # disable instant persona switching
```

For demo submissions, keep both variables at their default `true` values.

## Docker

```bash
make -f infra/Makefile docker-up
```

Services:

| Service | URL | Purpose |
|---|---|---|
| `frontend` | http://localhost:8080 | React UI behind nginx |
| `api` | http://localhost:3000 | Express JSON API |
| `analytics` | http://localhost:8100/health | Python analytics service |

Set `CAREOS_ANALYTICS_KEY` before exposing analytics publicly. All endpoints
except `/health` require it when set.

## Database migration path

The preview uses a JSON file for deterministic, zero-setup demos. To review the
relational target:

```bash
bun run db:validate
bun run db:migrate
# writes database/generated/seed.sql
```

Apply the schema and generated seed to PostgreSQL 15+:

```bash
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/views.sql
psql "$DATABASE_URL" -f database/indexes.sql
psql "$DATABASE_URL" -f database/TRIGGERS.sql
psql "$DATABASE_URL" -f database/RLS.sql
psql "$DATABASE_URL" -f database/seed_reference.sql
psql "$DATABASE_URL" -f database/generated/seed.sql
psql "$DATABASE_URL" -f database/CHECKS.sql
```

`CHECKS.sql` must return zero rows for every assertion. `RLS.sql` activates
tenant isolation only when the API sets `careos.actor_role`,
`careos.hospital_id`, and `careos.actor_email` per request with `SET LOCAL`.

## Storage caveat

On Vercel, the JSON path resolves to `os.tmpdir()/careos-data`. It is ephemeral
and not shared across instances. This is acceptable for the seeded demo because
`applyDemoData()` is idempotent and reapplied on cold start. A production
deployment should replace the JSON adapter with Postgres using `database/schema.sql`.
