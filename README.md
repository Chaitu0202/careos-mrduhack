<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/images/share-ais-513315318.png" />
</div>

# CareOS — The Operating System for Intelligent Healthcare

CareOS is a connected hospital operations preview with a subtle instant-switch workspace menu, appointment-to-patient-portal provisioning, doctor queues, radiology reporting, patient billing, AI agent orchestration, and super-admin onboarding.

## Run locally

**Use Bun** (npm currently has an `esbuild`/`vite` peer-dependency conflict in this project):

```bash
bun install
bun run dev
```

Open **http://localhost:3000/**.

### Seeded logins

| Workspace | Username | Password |
|---|---|---|
| Super Admin | `admin@gmail.com` | `password` |
| Hospital Coordinator | `hospital@gmail.com` | `password` |
| Demo patient portal | `PAT-2026-0001` | `password` |
| Demo patient portal | `PAT-2026-0002` | `password` |

## Synthetic demo dataset

The app ships with a deterministic, synthetic dataset applied on startup (and on Vercel cold starts) so every dashboard has populated metrics, queues, records, alerts, and agent outputs. It includes:

- Super-admin applications, hospitals, subscriptions, growth trend, and activity
- Patient registry, appointments, check-in/wait times, prescriptions, X-ray reports, and bills
- Doctor Queue, Radiology Workspace, and patient portal synchronized records
- Departments, staff roster, beds/equipment/OT resources
- Billing, insurance, pharmacy, laboratory, radiology, inventory, sales, and marketing module records
- Agent profiles with completed/pending tasks and recent activity
- Workflow definitions and full execution records with inter-agent messages, department alerts, pending approvals, executive briefs, and report sections
- Notifications and audit logs

Demo records use stable `demo-` IDs and are applied idempotently, so restarts do not duplicate them.

To disable demo seeding for a real deployment:

```bash
CAREOS_DEMO_DATA=false bun run dev
```

## Instant workspace switching

The top-right **Views** menu switches between Super Admin, hospital operations, clinicians, and patient portals without re-login. For production, disable it with:

```bash
CAREOS_DEMO_SWITCH=false
```

## AI orchestration

`POST /api/hospital/orchestrate` uses Gemini when `GEMINI_API_KEY` (or `GEMINI_API_KEY1` / `GOOGLE_API_KEY` / `API_KEY`) is configured. Without a key, all dashboards and agent outputs still show the synthetic execution history above.

## Preview-only storage

- Local preview persists to `.data/careos-db.json` (git-ignored).
- Vercel uses a temporary directory, so data resets between cold starts; the demo seed is reapplied automatically.
- Prescription and X-ray attachments are stored as JSON data URLs for this preview, not production DICOM/file storage.
