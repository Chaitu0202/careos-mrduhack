export interface MarketingAgent {
  id: string;
  name: string;
  role: string;
  description: string;
  highlights: [string, string, string];
  samplePrompt: string;
  sampleOutcome: string;
}

export const MARKETING_AGENTS: MarketingAgent[] = [
  {
    id: 'agent-patient',
    name: 'Patient Intelligence Agent',
    role: 'Onboarding & Communication',
    description:
      'Streamlines patient intake, pre-visit verification, appointment scheduling, and responsive chat or voice interactions.',
    highlights: ['Patient onboarding', 'Appointment coordination', 'Voice and chat interactions'],
    samplePrompt: 'Verify pre-visit cardiac intake packet and confirm 13:00 consultation slot.',
    sampleOutcome: 'Intake packet validated, allergy flags surfaced, and confirmation sent via patient-preferred channel.',
  },
  {
    id: 'agent-clinical',
    name: 'Clinical Intelligence Agent',
    role: 'Clinical Context & Prep',
    description:
      'Retrieves longitudinal patient history, synthesizes prior encounters, and drafts structured documentation for clinician sign-off.',
    highlights: ['Medical record summaries', 'Patient history retrieval', 'Clinical documentation assistance'],
    samplePrompt: 'Compile 12-month cardiology medication and lab summary ahead of ward round.',
    sampleOutcome: 'One-page pre-consult brief structured with recent vitals and flagged contraindications for physician review.',
  },
  {
    id: 'agent-flow',
    name: 'Patient Flow Agent',
    role: 'Throughput & Coordination',
    description:
      'Balances outpatient queues, synchronizes admission approvals, and coordinates discharge steps across wards.',
    highlights: ['Queue coordination', 'Admission and discharge workflows', 'Patient journey coordination'],
    samplePrompt: 'Prepare Cardiology Ward 3B Bed 12 discharge turnover and align incoming ED transfer.',
    sampleOutcome: 'Environmental Services dispatched, pharmacy sign-off verified, and transfer queue updated.',
  },
  {
    id: 'agent-operations',
    name: 'Operations Intelligence Agent',
    role: 'Staff & Bottleneck Orchestration',
    description:
      'Aligns clinical shift handoffs, assigns cross-department operational tasks, and flags emerging service bottlenecks early.',
    highlights: ['Staff coordination', 'Operational tasks', 'Bottleneck identification'],
    samplePrompt: 'Analyze afternoon Emergency Department load and propose nursing float allocation.',
    sampleOutcome: 'Detected 84% bay utilization; prepared staffing rebalance proposal for nursing supervisor approval.',
  },
  {
    id: 'agent-resource',
    name: 'Resource Intelligence Agent',
    role: 'Beds & Critical Assets',
    description:
      'Maintains real-time visibility into bed readiness, critical equipment tracking, and diagnostic suite utilization.',
    highlights: ['Bed availability', 'Equipment tracking', 'Resource utilization'],
    samplePrompt: 'Locate available portable ultrasound unit and reserve Radiology Suite 2 for 14:00.',
    sampleOutcome: 'Unit #4 assigned to Cardiology Diagnostics; sterilization status confirmed nominal.',
  },
  {
    id: 'agent-hospital',
    name: 'Hospital Intelligence Agent',
    role: 'Cross-Department Telemetry',
    description:
      'Transforms daily clinical and operational activity into department wait-time insights and hospital-wide forecasts.',
    highlights: ['Hospital analytics', 'Performance insights', 'Cross-department intelligence'],
    samplePrompt: 'Generate weekly department throughput and bed turnover latency report.',
    sampleOutcome: 'Identified peak Tuesday morning intake window and 14-minute reduction in discharge turnaround.',
  },
];

export const PLATFORM_MODULES = [
  {
    id: 'command-center',
    name: 'Hospital Command Center',
    summary: 'Single-pane operational visibility across admissions, appointments, capacity, and urgent notifications.',
  },
  {
    id: 'patient-management',
    name: 'Patient Management',
    summary: 'Unified patient profiles combining demographics, admission status, allergies, and visit history.',
  },
  {
    id: 'appointment-intelligence',
    name: 'Appointment Intelligence',
    summary: 'Smart doctor availability schedules, conflict prevention, rescheduling, and intake readiness.',
  },
  {
    id: 'department-coordination',
    name: 'Department Coordination',
    summary: 'Shared workload awareness connecting Emergency, Cardiology, Surgery, Radiology, and inpatient wards.',
  },
  {
    id: 'medical-records',
    name: 'Medical Records',
    summary: 'Role-authorized access to longitudinal patient summaries, clinical notes, and diagnostic history.',
  },
  {
    id: 'resource-management',
    name: 'Resource Management',
    summary: 'Live tracking of ICU beds, general ward capacity, ventilators, imaging suites, and operating rooms.',
  },
  {
    id: 'communication-hub',
    name: 'Communication Hub',
    summary: 'Coordinated internal staff escalations alongside consent-aware patient notifications and reminders.',
  },
  {
    id: 'workflow-automation',
    name: 'Workflow Automation',
    summary: 'Trigger-to-completion clinical and operational pipelines with configurable human approval checkpoints.',
  },
  {
    id: 'hospital-analytics',
    name: 'Hospital Analytics',
    summary: 'Calculated metrics across patient volume, wait times, occupancy trends, and agent task execution.',
  },
];

export const CONNECTED_LAYER_NODES = [
  {
    id: 'patients',
    label: 'Patients',
    detail: 'Digital onboarding, pre-visit verification, and coordinated appointment journeys from arrival through discharge.',
  },
  {
    id: 'clinical-teams',
    label: 'Clinical Teams',
    detail: 'Physicians and nurses receive concise pre-consult context and clear handoffs with human sign-off controls.',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    detail: 'Real-time provider availability, automated reminders, and rapid rescheduling across outpatient clinics.',
  },
  {
    id: 'operations',
    label: 'Hospital Operations',
    detail: 'Shift coordination, bottleneck detection, and task routing across support and clinical teams.',
  },
  {
    id: 'resources',
    label: 'Resources',
    detail: 'Live bed turnover status, equipment readiness, and operating suite utilization tracking.',
  },
  {
    id: 'departments',
    label: 'Departments',
    detail: 'Shared operational state connecting Emergency, Inpatient Wards, Labs, Radiology, and Pharmacy.',
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Understand',
    subtitle: 'Capture patient and hospital information',
    detail:
      'CareOS ingests intake updates, scheduling changes, ward status, and authorized clinical context into a unified operational model.',
  },
  {
    step: '02',
    title: 'Coordinate',
    subtitle: 'Connect the right department and agent',
    detail:
      'The intelligence layer routes context across Patient, Clinical, Flow, Operations, and Resource agents aligned to hospital rules.',
  },
  {
    step: '03',
    title: 'Execute',
    subtitle: 'Perform authorized tasks and workflows',
    detail:
      'Agents prepare briefs, queue bed cleaning, notify care teams, and pause for clinician or supervisor approval whenever required.',
  },
  {
    step: '04',
    title: 'Monitor',
    subtitle: 'Track completion and operational status',
    detail:
      'Hospital leaders monitor queue velocity, active escalations, and completion state with complete audit visibility.',
  },
  {
    step: '05',
    title: 'Improve',
    subtitle: 'Generate insights from hospital-wide activity',
    detail:
      'Calculated throughput analytics reveal recurring bottlenecks so leadership can refine staffing, scheduling, and bed turnover.',
  },
];
