# CareOS Data Model

The preview database is a single JSON document stored at `.data/careos-db.json`
locally and in `os.tmpdir()/careos-data` on Vercel. `backend/server.ts` defines
the TypeScript interfaces; `database/schema.sql` is the normalized relational
target.

## Top-level collections

| Collection | Keys | Purpose |
|---|---|---|
| `users` | `id`, `email`, `role`, `hospitalId` | Identity for admin, hospital, clinical, and patient views |
| `applications` | `id`, `applicationId`, `status` | Hospital onboarding requests |
| `hospitals` | `id`, `hospitalId`, `workspaceStatus` | Provisioned workspaces |
| `subscriptions` | `id`, `hospitalId`, `plan` | Commercial subscription ledger |
| `platformActivity` | `id`, `category`, `timestamp` | Super admin feed |
| `patients` | `id`, `mrn`, `department`, `attendingDoctor` | Patient registry and portal linkage |
| `appointments` | `id`, `patientId`, `doctorName`, `status` | Scheduling and consultation queue |
| `prescriptions` | `id`, `appointmentId`, `patientId` | Clinician prescriptions with attachment data URL |
| `radiologyOrders` | `id`, `appointmentId`, `status`, `billId` | Imaging worklist and report |
| `bills` | `id`, `patientId`, `orderId`, `amount` | Patient invoices |
| `departments` | `id`, `name`, `bedCapacity` | Departmental capacity |
| `staff` | `id`, `department`, `shift` | Staffing roster |
| `resources` | `id`, `category`, `total`, `inUse` | Beds, equipment, and rooms |
| `agents` | `id`, `status`, `assignedTasks` | AI agent profiles |
| `workflows` | `id`, `agentId`, `executionsCount` | Workflow definitions |
| `integrations` | `id`, `availability`, `protocol` | Supported external systems |
| `tasks` | `id`, `assignedAgent`, `status` | Operational agent tasks |
| `notifications` | `id`, `patientId`, `read` | Hospital and patient notifications |
| `auditLogs` | `id`, `timestamp`, `outcome` | Governance events |
| `moduleRecords` | `id`, `module`, `status` | Eight hospital module queues |
| `workflowExecutions` | `id`, `workflowCode`, `status` | Full agentic output snapshots |

## Agentic output shape

Every `workflowExecutions` record includes:

- `intentSummary` — natural-language interpretation of the command
- `executiveBrief` — leadership-friendly summary
- `voiceConfirmation` — spoken-style confirmation shown in the overlay
- `interAgentMessages[]` — ordered coordination log between agents
- `departmentalAlerts[]` — department-specific notifications
- `pendingApprovals[]` — human approval gates
- `reportSections[]` — structured downloadable report content

`backend/demoData.ts` seeds at least one complete execution for each workflow so
reviewers never see an empty AI surface.

## Referential flow

```text
appointment
  ├── prescription (uploaded by doctor)
  ├── radiologyOrder
  │     └── bill (generated when X-ray report is uploaded)
  └── patient portal notification stream
```

The patient portal queries by `portalUsername` / `patientId`, so every mutation
in the clinical flow appears without manual refresh after the 8-second refetch.

## Validation and migration

`database/validate.py` checks required collections, duplicate IDs, status
domains, references, and agentic output completeness. Warnings are allowed in
demo mode; errors fail CI.

`database/migrate.py` exports the JSON snapshot to `database/generated/seed.sql`
with `INSERT ... ON CONFLICT DO NOTHING` statements for the normalized tables.
Apply `schema.sql`, `views.sql`, `indexes.sql`, and `seed_reference.sql` first.
