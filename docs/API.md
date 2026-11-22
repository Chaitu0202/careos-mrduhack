# CareOS API Guide

The Express API is exported from `backend/server.ts`. Local preview and Vercel
share the same route table. All responses are JSON unless noted.

All `/api/*` routes except the explicitly public ones require a bearer token:

```text
Authorization: Bearer <token>
```

## Authentication

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/auth/admin-status` | Public admin-claim status |
| POST | `/api/auth/login` | Exchange email/username and password for a token |
| POST | `/api/auth/signup` | Create a workspace account |
| POST | `/api/auth/logout` | End the current session |
| GET | `/api/auth/me` | Current user profile |
| POST | `/api/auth/switch-workspace` | Instant persona switching in demo mode |
| POST | `/api/auth/change-default-password` | Complete forced first-login change |
| POST | `/api/auth/forgot-password` | Start password reset flow |
| POST | `/api/public/contact` | Public contact form |
| GET | `/api/applicant/status` | Onboarding application status |
| POST | `/api/applicant/resubmit` | Resubmit an onboarding application |

The client stores the token in React state only. A full page navigation to a
protected route clears it; use the in-app **Views** switcher during review.

## Super Admin

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/super-admin/overview` | Platform counts, hospitals, activity, audit summary |
| GET | `/api/super-admin/applications` | Hospital onboarding queue |
| GET | `/api/super-admin/applications/:id` | One onboarding application |
| PATCH | `/api/super-admin/applications/:id` | Edit application review state |
| POST | `/api/super-admin/applications/:id/approve` | Provision a hospital workspace |
| POST | `/api/super-admin/hospitals/manual` | Create a hospital workspace manually |
| GET | `/api/super-admin/hospitals` | Approved hospitals |
| PATCH | `/api/super-admin/hospitals/:id` | Update a hospital workspace |
| GET | `/api/super-admin/subscriptions` | Subscription ledger |
| POST | `/api/super-admin/change-password` | Change admin password |
| GET | `/api/admin/users` | Platform users |
| PATCH | `/api/admin/users/:id/role` | Change a user role |
| GET | `/api/admin/audit-logs` | Governance audit trail |
| PATCH | `/api/admin/settings` | Platform settings |

## Hospital operations

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/dashboard/overview` | Dashboard KPIs, alerts, and attention items |
| POST | `/api/hospital/command` | Natural-language command dispatch |
| GET | `/api/patients` | Patient registry |
| POST | `/api/patients` | Register a patient |
| PATCH | `/api/patients/:id` | Update a patient record |
| GET | `/api/appointments` | Appointment list |
| POST | `/api/appointments` | Book an appointment and portal credentials |
| PATCH | `/api/appointments/:id` | Update appointment status |
| GET | `/api/doctor/queue` | Consultation queue |
| POST | `/api/appointments/:id/prescription` | Upload a prescription |
| POST | `/api/appointments/:id/refer-radiology` | Create an imaging referral |
| GET | `/api/radiology/orders` | Radiology worklist |
| POST | `/api/radiology/orders/:id/report` | Upload report and generate bill |
| GET | `/api/hospital/modules/:module` | Module records for the eight modules |
| POST | `/api/hospital/modules/:module` | Add a module record |
| GET | `/api/departments` | Departmental capacity |
| GET | `/api/resources` | Beds, equipment, and rooms |
| GET | `/api/hospital/users` | Workspace users |
| GET | `/api/integrations` | Supported integrations |
| GET | `/api/analytics` | Dashboard analytics summary |

## Agent orchestration

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/agents` | Agent profiles and recent activity |
| PATCH | `/api/agents/:id/status` | Change agent status (admin) |
| POST | `/api/agents/:id/dispatch` | Dispatch a task to an agent |
| GET | `/api/workflows` | Workflow definitions and executions |
| PATCH | `/api/workflows/:id` | Update a workflow |
| POST | `/api/workflows/:id/trigger` | Trigger a workflow |
| POST | `/api/hospital/orchestrate` | Run a live multi-agent command |
| POST | `/api/hospital/workflows/:id/approve` | Approve a pending human gate |
| PATCH | `/api/hospital/alerts/:id` | Acknowledge a departmental alert |
| PATCH | `/api/hospital/voice-settings` | Update voice confirmation preferences |

Live orchestration requires a Gemini API key. Without one the endpoint returns
`503`; seeded agentic history remains available.

## Patient portal

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/patient/portal` | Appointments, prescriptions, imaging, bills, notifications |
| PATCH | `/api/notifications/:id/read` | Mark a notification read |

The portal patient is resolved from the authenticated token. Portal identifiers
use `PAT-YYYY-NNNN`; the default seeded password is `password`.

## Python analytics service

Start with `bun run analytics` or `python3 -m backend.analytics.cli serve`.

| Endpoint | Purpose |
|---|---|
| `GET /health` | Liveness and DB path |
| `GET /summary` | Snapshot counts |
| `GET /snapshot` | Typed normalized snapshot |
| `GET /metrics` | Full analytics report |
| `GET /report` | JSON report |
| `GET /report?format=markdown` | Markdown report |
| `GET /report?format=html` | Self-contained HTML report |
| `GET /report?format=csv&section=metrics` | CSV export |
| `GET /redacted/report` | PII-redacted report |
| `GET /command-center` | Cached unified operational view |
| `GET /events` | Event stream and projections |
| `GET /quality` | Data-quality rules and findings |
| `GET /audit?chain=1` | Audit verification and hash chain |
| `GET /privacy` | Privacy checks |
| `GET /scheduling` | Shift coverage and caseload balance |
| `GET /reliability` | Error budgets, dependency health, incident triggers |
| `GET /intents` | Supported command intents |

Set `CAREOS_ANALYTICS_KEY` to protect every endpoint except `/health`.

## CLI commands

```bash
python3 -m backend.analytics.cli check
python3 -m backend.analytics.cli adapters
python3 -m backend.analytics.cli simulate
python3 -m backend.analytics.cli pipeline --persist
python3 -m backend.analytics.cli export
python3 -m backend.analytics.cli command-center
python3 -m backend.analytics.cli events
python3 -m backend.analytics.cli quality
python3 -m backend.analytics.cli audit --chain
python3 -m backend.analytics.cli nlp "Create an urgent STAT chest X-Ray bill" --ground
python3 -m backend.analytics.cli privacy
python3 -m backend.analytics.cli scheduling
python3 -m backend.analytics.cli reliability
python3 -m backend.analytics.cli migrate --catalog
```
