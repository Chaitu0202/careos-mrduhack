# CareOS Operations Runbook

This runbook covers the checks an operator or reviewer should run before a demo,
a deployment, or a schema migration.

## 1. Pre-demo check (2 minutes)

```bash
bun run lint
bun run db:validate
bun run analytics:check
bun run dev
```

Open `http://localhost:3000/` and confirm:

1. The top-right **Views** menu lists Super Admin, Hospital, clinical views,
   patient portal, and the eight modules.
2. The Command Center shows non-zero agent task counts and recent activity.
3. The doctor queue contains at least six patients.
4. The radiology workspace shows three orders with one completed report.
5. The billing module shows generated invoices.
6. Patient login `PAT-2026-0001` / `password` opens the portal with synchronized
   prescription, imaging, and billing records.

## 2. Full verification (5 minutes)

```bash
bash scripts/verify.sh
```

This runs TypeScript typecheck, Vite production build, database validation,
analytics smoke checks, and all Python unit tests.

Expected output markers:

- `✓ built in ...` from Vite
- `"ok": true` from `database/validate.py`
- `"status": "ok"` from `backend.analytics.cli check`
- `OK` from `unittest`

## 3. Analytics service check

```bash
bun run analytics
curl http://127.0.0.1:8100/health
curl http://127.0.0.1:8100/summary
```

If `CAREOS_ANALYTICS_KEY` is set, send it as `x-careos-analytics-key` or a bearer
token. Without the key, only `/health` is public.

Useful offline commands:

```bash
python3 -m backend.analytics.cli adapters
python3 -m backend.analytics.cli simulate
python3 -m backend.analytics.cli pipeline --persist
python3 -m backend.analytics.cli export
```

## 4. Migration check

```bash
bun run db:migrate
psql "$DATABASE_URL" -f database/schema.sql
psql "$DATABASE_URL" -f database/views.sql
psql "$DATABASE_URL" -f database/indexes.sql
psql "$DATABASE_URL" -f database/seed_reference.sql
psql "$DATABASE_URL" -f database/generated/seed.sql
psql "$DATABASE_URL" -f database/CHECKS.sql
```

`CHECKS.sql` should return zero rows for every assertion. If a check fails,
inspect the equivalent collection in `.data/careos-db.json` and re-run
`database/validate.py`.

## 5. Incident_playbook

| Symptom | Likely cause | Action |
|---|---|---|
| Preview returns 500 on start | Stale `.data/careos-db.json` | Stop server, delete `.data/careos-db.json`, restart |
| Patient portal empty | Wrong identifier or `CAREOS_DEMO_DATA=false` | Use `PAT-2026-0001` and confirm demo data enabled |
| Orchestration returns 503 | No Gemini key configured | Set `GEMINI_API_KEY1`; seeded history still works |
| Vercel writes lost | Ephemeral `/tmp` database | Expected; seed re-applies on cold start |
| Analytics 401 | `CAREOS_ANALYTICS_KEY` required | Send the key header |
| Duplicate-ID validation error | Seed or migration ran twice | Confirm stable `demo-` IDs and idempotent seeding |

## 6. Production hardening checklist

- Set `CAREOS_DEMO_DATA=false` for real data.
- Set `CAREOS_DEMO_SWITCH=false` to disable persona switching.
- Replace the JSON store with Postgres using `database/schema.sql`.
- Store prescription and imaging files in object storage, not data URLs.
- Configure Gemini credentials through the platform secret manager.
- Set `CAREOS_ANALYTICS_KEY` and restrict analytics network access.
- Enable CodeQL and dependency alerts in GitHub.
- Review `docs/REVIEW_GUIDE.md` before each AI submission.
