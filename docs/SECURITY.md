# CareOS Security Notes

CareOS preview mode is intentionally open for demo switching and seeded data.
Production deployments must apply the controls below.

## Authentication

- Local preview uses in-memory auth state; tokens are not persisted to storage.
- Default seeded passwords (`password`) are for demos only.
- `mustChangePassword` is set on provisioned accounts and enforced by the UI.
- Replace the JSON user store with Postgres and a managed identity provider for
  real deployments.

## Demo controls

| Variable | Default | Production value |
|---|---|---|
| `CAREOS_DEMO_DATA` | `true` | `false` |
| `CAREOS_DEMO_SWITCH` | `true` | `false` |
| `CAREOS_ANALYTICS_KEY` | unset | strong random secret |
| `GEMINI_API_KEY1` | unset | platform secret manager value |

Never expose Gemini credentials to the browser. All live orchestration calls go
through `POST /api/hospital/orchestrate` on the server.

## Data protection

- Analytics exports support redaction through `backend/analytics/security.py`.
- `backend/analytics/privacy.py` checks minimum-necessary patient fields and
  k-anonymity for department/doctor quasi-identifiers.
- Prescription and X-ray attachments are JSON data URLs in preview. Production
  systems should store them in encrypted object storage and persist only
  references in the database.
- The analytics HTTP service blocks every endpoint except `/health` when
  `CAREOS_ANALYTICS_KEY` is set.

## Auditability

Every state-changing API request appends an `auditLogs` record with actor,
timestamp, action, resource, and outcome. The Python audit module can verify
required fields, duplicate IDs, timestamp ordering, and hash chains.

Human approval gates are represented in `pendingApprovals` and surfaced in the
agent execution overlay. Do not auto-approve financial, insurance, or discharge
actions in production.

## CI security

- `.github/workflow-templates/security.yml` runs CodeQL for JavaScript/TypeScript
  and Python on pushes, pull requests, and a weekly schedule.
- `.github/workflow-templates/ci.yml` runs typecheck, build, database validation,
  analytics checks, and Python tests.

The definitions live under `workflow-templates/` because this repository's push
credential lacks GitHub's `workflow` scope. Copy both files into
`.github/workflows/` with a workflow-scoped token to activate them; until then,
run the same checks locally with `bun run check` and `bash scripts/verify.sh`.
- Keep dependencies updated with Dependabot or equivalent automation.
