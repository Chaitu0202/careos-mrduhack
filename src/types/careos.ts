export type UserRole = 'admin' | 'coordinator' | 'clinician' | 'operator';

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  hospitalName: string;
  hospitalType: string;
  contactNumber: string;
  status: 'active' | 'pending';
  createdAt: string;
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
  isSample: true;
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
  isSample: true;
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

export interface DashboardOverviewData {
  isSampleDataset: true;
  hospitalSettings: {
    hospitalName: string;
    timezone: string;
    humanOversightRequired: boolean;
    sessionTimeoutMinutes: number;
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
  };
  appointmentTrends: Array<{ label: string; scheduled: number; completed: number; walkIn: number }>;
  patientFlowStages: Array<{ stage: string; count: number; avgMinutes: number }>;
  departments: DepartmentRecord[];
  agents: AgentProfile[];
  tasks: OperationalTask[];
  notifications: HospitalNotification[];
}
