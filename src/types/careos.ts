export type UserRole = 'admin' | 'coordinator' | 'clinician' | 'operator';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  hospitalName: string;
  hospitalType: string;
  hospitalId?: string;
  applicationId?: string;
  contactNumber: string;
  status: 'active' | 'pending' | 'suspended';
  mustChangePassword?: boolean;
  createdAt: string;
}

export type ApplicationStatus = 'Pending' | 'Under Review' | 'Docs Requested' | 'Approved' | 'Rejected';

export interface ApplicationDocument {
  name: string;
  status: 'Uploaded' | 'Requested' | 'Verified';
}

export interface HospitalApplication {
  id: string;
  applicationId: string;
  hospitalName: string;
  hospitalType: string;
  bedsCount: number;
  departmentsCount: number;
  location: string;
  address: string;
  contactPerson: string;
  email: string;
  phone: string;
  submittedAt: string;
  status: ApplicationStatus;
  documents: ApplicationDocument[];
  internalNotes: string;
  requestedMessage?: string;
  applicantUserId?: string;
  reviewedAt?: string;
}

export type SubscriptionPlan = 'Starter' | 'Pro' | 'Enterprise';

export interface ApprovedHospital {
  id: string;
  hospitalId: string;
  applicationId: string;
  hospitalName: string;
  hospitalType: string;
  location: string;
  address: string;
  administratorName: string;
  administratorEmail: string;
  phone: string;
  bedsCount: number;
  departmentsCount: number;
  activeUsersCount: number;
  subscriptionPlan: SubscriptionPlan;
  workspaceStatus: 'Active' | 'Suspended';
  approvedAt: string;
}

export interface SubscriptionRecord {
  id: string;
  hospitalId: string;
  hospitalName: string;
  plan: SubscriptionPlan;
  monthlyPriceUsd: number;
  seatsIncluded: number;
  status: 'Active' | 'Paused';
  startedAt: string;
}

export interface PlatformActivityItem {
  id: string;
  message: string;
  category: 'application' | 'approval' | 'user' | 'system';
  timestamp: string;
}

export interface PatientRecord {
  id: string;
  mrn: string;
  fullName: string;
  age: number;
  gender: 'Female' | 'Male' | 'Other';
  phone: string;
  email: string;
  department: string;
  attendingDoctor: string;
  admissionStatus: 'Outpatient' | 'Admitted' | 'ICU Observation' | 'Discharged' | 'Pre-Admission';
  wardBed: string;
  lastVisit: string;
  medicalSummary: string;
  allergies: string[];
}

export interface AppointmentRecord {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  type: 'Consultation' | 'Follow-up' | 'Diagnostic' | 'Procedure' | 'Telehealth';
  status: 'Scheduled' | 'Checked In' | 'In Progress' | 'Completed' | 'Rescheduled' | 'Cancelled';
  notes: string;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  head: string;
  activePatients: number;
  staffOnDuty: number;
  totalStaff: number;
  bedCapacity: number;
  occupiedBeds: number;
  avgWaitMinutes: number;
  status: 'Nominal' | 'Elevated' | 'High Load';
}

export interface ResourceItem {
  id: string;
  name: string;
  category: 'Beds' | 'Critical Equipment' | 'Diagnostic Suites' | 'Operating Rooms';
  department: string;
  total: number;
  available: number;
  inUse: number;
  maintenance: number;
}

export interface AgentActivityItem {
  id: string;
  timestamp: string;
  summary: string;
  department: string;
  outcome: 'Completed' | 'Awaiting Review' | 'Escalated';
}

export interface AgentProfile {
  id: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  highlights: [string, string, string];
  status: 'Active' | 'Monitoring' | 'Paused';
  assignedTasks: number;
  completedTasks: number;
  pendingTasks: number;
  avgResponseSeconds: number;
  recentActivity: AgentActivityItem[];
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  trigger: string;
  condition: string;
  agentId: string;
  agentName: string;
  action: string;
  requiresApproval: boolean;
  completionOutcome: string;
  active: boolean;
  executionsCount: number;
  lastRunAt: string;
}

export interface IntegrationItem {
  id: string;
  name: string;
  category:
    | 'HIS & Hospital Management'
    | 'EMR & EHR Platforms'
    | 'Telephony Systems'
    | 'WhatsApp & Messaging'
    | 'Calendar & Scheduling'
    | 'APIs & Third-Party Apps';
  availability: 'supported' | 'planned';
  description: string;
  protocol: string;
  connected: boolean;
}

export interface HospitalNotification {
  id: string;
  title: string;
  detail: string;
  department: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
}

export interface OperationalTask {
  id: string;
  title: string;
  department: string;
  assignedAgent: string;
  priority: 'Normal' | 'High' | 'Urgent';
  status: 'Pending' | 'In Progress' | 'Completed';
  dueTime: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resource: string;
  outcome: 'Allowed' | 'Denied';
}

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  department: string;
  shift: string;
  availability: 'On Duty' | 'In Procedure' | 'On Call' | 'Off Shift';
  activeCases: number;
}

export interface SuperAdminOverviewData {
  metrics: {
    totalHospitals: number;
    pendingApplications: number;
    approvedHospitals: number;
    activeWorkspaces: number;
    totalUsers: number;
    activeSubscriptions: number;
  };
  applicationOverview: {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
  };
  monthlyGrowth: Array<{ month: string; count: number }>;
  applications: HospitalApplication[];
  recentHospitals: ApprovedHospital[];
  platformActivity: PlatformActivityItem[];
  agents: AgentProfile[];
  notifications: HospitalNotification[];
  systemHealth: {
    database: 'Healthy';
    backend: 'Healthy';
    aiServices: 'Active' | 'Standby';
    integrations: 'Healthy';
  };
}

export type HospitalModuleKey =
  | 'radiology'
  | 'laboratory'
  | 'pharmacy'
  | 'billing'
  | 'insurance'
  | 'inventory'
  | 'sales'
  | 'marketing';

export interface HospitalModuleRecord {
  id: string;
  module: HospitalModuleKey;
  referenceCode: string;
  title: string;
  subtitle: string;
  status: 'Active' | 'Pending Review' | 'Completed' | 'Flagged';
  amountOrCount?: string;
  createdAt: string;
}

export interface DashboardOverviewData {
  hospitalSettings: {
    hospitalName: string;
    timezone: string;
    humanOversightRequired: boolean;
    sessionTimeoutMinutes: number;
    voiceResponsesEnabled: boolean;
  };
  metrics: {
    totalPatients: number;
    todaysAppointments: number;
    activeAdmissions: number;
    availableBeds: number;
    totalBeds: number;
    pendingTasks: number;
    bedOccupancyRate: number;
    avgWaitMinutes: number;
    totalAgentTasksCompleted: number;
    aiAgentActivities: number;
  };
  departmentIntelligence: {
    patients: number;
    appointments: number;
    admissions: number;
    radiology: number;
    laboratory: number;
    pharmacy: number;
  };
  needsAttentionSummary: {
    pendingInsuranceApproval: number;
    reportsAwaitingReview: number;
    appointmentsConfirmationRequired: number;
  };
  orchestrationNodes: Array<{
    id: string;
    title: string;
    subtitle: string;
    side: 'left' | 'right';
    status: 'Active' | 'Processing' | 'Standby';
    tasksCount: number;
    department: string;
  }>;
  liveActivityFeed: Array<{
    id: string;
    title: string;
    subtitle: string;
    category: 'finance' | 'radiology' | 'operations' | 'insurance' | 'marketing' | 'clinical';
    timestamp: string;
  }>;
  attentionItems: Array<{
    id: string;
    title: string;
    detail: string;
    actionLabel: 'Review' | 'Assign' | 'View';
    targetPath: string;
    severity: 'red' | 'orange' | 'blue';
    timestamp: string;
  }>;
  hospitalPerformance: Array<{
    label: string;
    patients: number;
    admissions: number;
  }>;
  appointmentTrends: Array<{ label: string; scheduled: number; completed: number; walkIn: number }>;
  patientFlowStages: Array<{ stage: string; count: number; avgMinutes: number }>;
  departments: DepartmentRecord[];
  agents: AgentProfile[];
  tasks: OperationalTask[];
  notifications: HospitalNotification[];
  workflowExecutions: WorkflowExecutionRecord[];
  departmentalAlerts: DepartmentAlertItem[];
}

export type OrchestratorAgentKey =
  | 'finance'
  | 'radiology'
  | 'operations'
  | 'insurance'
  | 'sales'
  | 'marketing';

export interface InterAgentMessage {
  id: string;
  step: number;
  fromAgent: string;
  toAgent: string;
  fromKey: OrchestratorAgentKey | 'core';
  toKey: OrchestratorAgentKey | 'core';
  department: string;
  message: string;
  status: 'completed' | 'warning' | 'pending_approval';
  timestamp: string;
}

export interface DepartmentAlertItem {
  id: string;
  workflowId: string;
  workflowCode: string;
  department: string;
  agentName: string;
  summary: string;
  priority: 'Normal' | 'High' | 'Urgent';
  timestamp: string;
  status: 'Delivered (In-App)' | 'Acknowledged' | 'Approved';
  targetPath: string;
  requiresApproval: boolean;
}

export interface PendingApprovalItem {
  id: string;
  title: string;
  department: string;
  description: string;
  actionType: 'clinical' | 'financial' | 'insurance' | 'discharge';
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

export interface ConsolidatedReportSection {
  title: string;
  items: Array<{ label: string; value: string }>;
}

export interface WorkflowExecutionRecord {
  id: string;
  workflowCode: string;
  instruction: string;
  intentSummary: string;
  executedAt: string;
  executionMs: number;
  participatingAgents: OrchestratorAgentKey[];
  status: 'Completed' | 'Awaiting Approval' | 'Issue Detected';
  voiceConfirmation: string;
  executiveBrief: string;
  interAgentMessages: InterAgentMessage[];
  departmentalAlerts: DepartmentAlertItem[];
  pendingApprovals: PendingApprovalItem[];
  reportTitle: string;
  reportSections: ConsolidatedReportSection[];
  errorMessage?: string;
}

export interface HospitalCommandResult {
  id: string;
  prompt: string;
  response: string;
  reportTitle: string;
  generatedAt: string;
  steps: Array<{
    agentName: string;
    detail: string;
    status: 'completed';
  }>;
  summaryLines: Array<{
    label: string;
    value: string;
  }>;
}


