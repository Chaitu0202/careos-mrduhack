import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import type {
  AgentProfile,
  ApplicationStatus,
  AppointmentRecord,
  ApprovedHospital,
  AuditLogEntry,
  AuthUser,
  DepartmentAlertItem,
  DepartmentRecord,
  HospitalApplication,
  HospitalModuleKey,
  HospitalModuleRecord,
  HospitalNotification,
  IntegrationItem,
  InterAgentMessage,
  OperationalTask,
  OrchestratorAgentKey,
  PatientRecord,
  PendingApprovalItem,
  PlatformActivityItem,
  ResourceItem,
  StaffMember,
  SubscriptionPlan,
  SubscriptionRecord,
  UserRole,
  WorkflowDefinition,
  WorkflowExecutionRecord,
} from './src/types/careos.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
}

interface CareOSDatabase {
  users: StoredUser[];
  applications: HospitalApplication[];
  hospitals: ApprovedHospital[];
  subscriptions: SubscriptionRecord[];
  platformActivity: PlatformActivityItem[];
  hospitalSettings: {
    hospitalName: string;
    timezone: string;
    humanOversightRequired: boolean;
    sessionTimeoutMinutes: number;
    voiceResponsesEnabled: boolean;
  };
  patients: PatientRecord[];
  appointments: AppointmentRecord[];
  departments: DepartmentRecord[];
  resources: ResourceItem[];
  agents: AgentProfile[];
  workflows: WorkflowDefinition[];
  integrations: IntegrationItem[];
  tasks: OperationalTask[];
  notifications: HospitalNotification[];
  staff: StaffMember[];
  auditLogs: AuditLogEntry[];
  moduleRecords: HospitalModuleRecord[];
  workflowExecutions: WorkflowExecutionRecord[];
  departmentalAlerts: DepartmentAlertItem[];
}

interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  hospitalName: string;
  jti: string;
  iat: number;
  exp: number;
}

interface AuthenticatedRequest extends Request {
  authUser?: TokenPayload;
}

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'careos-db.json');

// Precomputed one-way scrypt hash for initial admin bootstrap when ADMIN_PASSWORD env var is unset
const INITIAL_ADMIN_EMAIL = 'admin@careos.com';
const INITIAL_ADMIN_SCRYPT_HASH =
  'd19dc48f2f60f7f316bb08a96a8c171a:3449fa810320dd8124dbc92df0f5bf6f0a1b0fcee48214736409da5be88d2ab2fcabe90240a496472de4e4c5affec5a83bc90dec0b9a307abec29b1fb3333116';

// Precomputed one-way scrypt hash for newly onboarded hospitals' temporary first-login password and starting test hospital
const INITIAL_TEST_HOSPITAL_EMAIL = 'hospital@gmail.com';
const INITIAL_HOSPITAL_DEFAULT_SCRYPT_HASH =
  '6fa016150dd327a4c6251ab5e7fe301c:2a131148d03256cea67cd1dce1b97d8ceb531eb3867fe5d82675b37d1cf15237b93ef06f58d0e170c8acbb9d49b40f0cb5f798647abcfba69d4d595c2e7ce01b';

const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const revokedTokens = new Map<string, number>();

function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return new Promise((resolve) => {
    const parts = storedHash.split(':');
    if (parts.length !== 2) {
      resolve(false);
      return;
    }
    const [salt, keyHex] = parts;
    const keyBuf = Buffer.from(keyHex, 'hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err || derivedKey.length !== keyBuf.length) {
        resolve(false);
        return;
      }
      resolve(crypto.timingSafeEqual(derivedKey, keyBuf));
    });
  });
}

function signToken(payload: Omit<TokenPayload, 'jti' | 'iat' | 'exp'>, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const fullPayload: TokenPayload = {
    ...payload,
    jti: crypto.randomUUID(),
    iat: now,
    exp: now + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
    const now = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp < now) return null;
    if (revokedTokens.has(payload.jti)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

// Clean zero-mock-data initial database
function createInitialDatabase(): CareOSDatabase {
  const seededAdmin: StoredUser = {
    id: 'usr-super-admin',
    fullName: 'Super Admin',
    email: INITIAL_ADMIN_EMAIL,
    role: 'admin',
    hospitalName: 'CareOS Platform',
    hospitalType: 'Platform Governance',
    contactNumber: 'Platform Admin',
    status: 'active',
    createdAt: new Date().toISOString(),
    passwordHash: INITIAL_ADMIN_SCRYPT_HASH,
  };

  const seededTestHospital: StoredUser = {
    id: 'usr-test-hospital',
    fullName: 'Hospital Administrator',
    email: INITIAL_TEST_HOSPITAL_EMAIL,
    role: 'coordinator',
    hospitalName: 'CareOS Test Hospital',
    hospitalType: 'Multi-Specialty',
    hospitalId: 'HSP-00001',
    applicationId: 'APP-TEST-0001',
    contactNumber: 'Hospital Command Desk',
    status: 'active',
    mustChangePassword: false,
    createdAt: new Date().toISOString(),
    passwordHash: INITIAL_HOSPITAL_DEFAULT_SCRYPT_HASH,
  };

  return {
    users: [seededAdmin, seededTestHospital],
    applications: [],
    hospitals: [],
    subscriptions: [],
    platformActivity: [],
    hospitalSettings: {
      hospitalName: 'CareOS Platform',
      timezone: 'America/Los_Angeles',
      humanOversightRequired: true,
      sessionTimeoutMinutes: 480,
      voiceResponsesEnabled: true,
    },
    patients: [],
    appointments: [],
    departments: [],
    resources: [],
    agents: [
      {
        id: 'agent-clinical',
        name: 'Clinical Assistant',
        shortName: 'Clinical',
        category: 'Clinical Documentation',
        description: 'Synthesizes authorized patient history and prepares structured pre-consult briefs for clinician sign-off.',
        highlights: ['Medical record summaries', 'Patient history retrieval', 'Clinical documentation assistance'],
        status: 'Active',
        assignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        avgResponseSeconds: 0,
        recentActivity: [],
      },
      {
        id: 'agent-operations',
        name: 'Operations Agent',
        shortName: 'Operations',
        category: 'Shift & Task Coordination',
        description: 'Coordinates hospital shift handoffs, operational tasks, and cross-department queue routing.',
        highlights: ['Staff coordination', 'Operational tasks', 'Bottleneck identification'],
        status: 'Active',
        assignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        avgResponseSeconds: 0,
        recentActivity: [],
      },
      {
        id: 'agent-analytics',
        name: 'Analytics Agent',
        shortName: 'Analytics',
        category: 'Executive Analytics',
        description: 'Aggregates cross-department operational activity into wait-time and capacity insights.',
        highlights: ['Hospital analytics', 'Performance insights', 'Cross-department intelligence'],
        status: 'Active',
        assignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        avgResponseSeconds: 0,
        recentActivity: [],
      },
      {
        id: 'agent-compliance',
        name: 'Compliance Agent',
        shortName: 'Compliance',
        category: 'Governance & Audit',
        description: 'Verifies onboarding documentation completeness, consent boundaries, and audit trail integrity.',
        highlights: ['Document verification', 'Consent checks', 'Audit log monitoring'],
        status: 'Active',
        assignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        avgResponseSeconds: 0,
        recentActivity: [],
      },
      {
        id: 'agent-support',
        name: 'Support Agent',
        shortName: 'Support',
        category: 'Onboarding & Intake',
        description: 'Assists new hospital applicants with onboarding requests, document submissions, and scheduling.',
        highlights: ['Hospital onboarding', 'Application intake', 'Workspace guidance'],
        status: 'Active',
        assignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        avgResponseSeconds: 0,
        recentActivity: [],
      },
      {
        id: 'agent-flow',
        name: 'Patient Flow Agent',
        shortName: 'Flow',
        category: 'Throughput & Beds',
        description: 'Coordinates outpatient queues, inpatient admissions, and bed turnover readiness.',
        highlights: ['Queue coordination', 'Admission workflows', 'Discharge turnover'],
        status: 'Active',
        assignedTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        avgResponseSeconds: 0,
        recentActivity: [],
      },
    ],
    workflows: [
      {
        id: 'wf-onboarding',
        name: 'Hospital Application Review & Provisioning',
        description: 'Routes incoming hospital applications to Super Admin review, provisions HSP ID, and activates workspace upon approval.',
        trigger: 'Hospital submits onboarding or signup request',
        condition: 'Organization details and contact email validated',
        agentId: 'agent-compliance',
        agentName: 'Compliance Agent',
        action: 'Validate registration fields & queue for Super Admin decision',
        requiresApproval: true,
        completionOutcome: 'Hospital added to Directory & workspace activated',
        active: true,
        executionsCount: 0,
        lastRunAt: 'No runs yet',
      },
      {
        id: 'wf-discharge',
        name: 'Inpatient Discharge & Bed Turnover',
        description: 'Coordinates discharge clearance, sanitization, and bed availability updates once patients are admitted.',
        trigger: 'Attending marks patient ready for discharge',
        condition: 'Medication & lab clearance verified',
        agentId: 'agent-flow',
        agentName: 'Patient Flow Agent',
        action: 'Notify Environmental Services and update bed capacity',
        requiresApproval: true,
        completionOutcome: 'Bed marked available for incoming admission',
        active: true,
        executionsCount: 0,
        lastRunAt: 'No runs yet',
      },
    ],
    integrations: [
      {
        id: 'int-rest',
        name: 'CareOS REST & Webhook API',
        category: 'APIs & Third-Party Apps',
        availability: 'supported',
        description: 'Authenticated JSON REST endpoints and event webhooks for hospital systems.',
        protocol: 'HTTPS / JSON / Bearer Auth',
        connected: false,
      },
      {
        id: 'int-fhir',
        name: 'HL7 FHIR R4 Data Adapter',
        category: 'EMR & EHR Platforms',
        availability: 'supported',
        description: 'Standards-based FHIR R4 schema mapper for patient demographics and appointments.',
        protocol: 'FHIR R4 REST',
        connected: false,
      },
      {
        id: 'int-calendar',
        name: 'Clinician Calendar Sync (iCal / CalDAV)',
        category: 'Calendar & Scheduling',
        availability: 'supported',
        description: 'Two-way shift and outpatient appointment schedule synchronization.',
        protocol: 'CalDAV / iCalendar',
        connected: false,
      },
      {
        id: 'int-his',
        name: 'Enterprise HIS Connectors',
        category: 'HIS & Hospital Management',
        availability: 'planned',
        description: 'Direct bi-directional hospital billing, ADT, and ward management bridge.',
        protocol: 'HL7 v2 / MLLP',
        connected: false,
      },
      {
        id: 'int-epic',
        name: 'Epic & Cerner SMART Launch',
        category: 'EMR & EHR Platforms',
        availability: 'planned',
        description: 'Certified SMART on FHIR embedded launch inside enterprise inpatient EHRs.',
        protocol: 'SMART on FHIR',
        connected: false,
      },
      {
        id: 'int-telephony',
        name: 'Hospital PBX & SIP Voice Gateway',
        category: 'Telephony Systems',
        availability: 'planned',
        description: 'Direct SIP trunk routing for automated patient triage and scheduling calls.',
        protocol: 'SIP / WebRTC',
        connected: false,
      },
      {
        id: 'int-whatsapp',
        name: 'WhatsApp Business & SMS Channel',
        category: 'WhatsApp & Messaging',
        availability: 'planned',
        description: 'Opt-in patient appointment reminders and post-discharge check-in messaging.',
        protocol: 'WhatsApp Cloud API',
        connected: false,
      },
    ],
    tasks: [],
    notifications: [],
    staff: [],
    auditLogs: [],
    moduleRecords: [],
    workflowExecutions: [],
    departmentalAlerts: [],
  };
}

function loadDatabase(): CareOSDatabase {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const initial = createInitialDatabase();
    saveDatabase(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as CareOSDatabase;
    // Ensure seeded admin, starting test hospital, and normalized arrays exist
    let modified = false;
    if (!parsed.users.some((u) => u.role === 'admin')) {
      parsed.users.unshift(createInitialDatabase().users[0]);
      modified = true;
    }
    if (!parsed.users.some((u) => u.email.toLowerCase() === INITIAL_TEST_HOSPITAL_EMAIL)) {
      parsed.users.push(createInitialDatabase().users[1]);
      modified = true;
    }
    if (modified) {
      saveDatabase(parsed);
    }
    if (!Array.isArray(parsed.moduleRecords)) {
      parsed.moduleRecords = [];
    }
    if (!Array.isArray(parsed.workflowExecutions)) {
      parsed.workflowExecutions = [];
    }
    if (!Array.isArray(parsed.departmentalAlerts)) {
      parsed.departmentalAlerts = [];
    }
    if (typeof parsed.hospitalSettings?.voiceResponsesEnabled !== 'boolean') {
      parsed.hospitalSettings = {
        ...parsed.hospitalSettings,
        voiceResponsesEnabled: true,
      };
    }
    return parsed;
  } catch {
    const initial = createInitialDatabase();
    saveDatabase(initial);
    return initial;
  }
}

function saveDatabase(db: CareOSDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

let db = loadDatabase();

function appendAudit(
  actorEmail: string,
  actorRole: string,
  action: string,
  resource: string,
  outcome: 'Allowed' | 'Denied' = 'Allowed'
) {
  db.auditLogs.unshift({
    id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    actorEmail,
    actorRole,
    action,
    resource,
    outcome,
  });
  if (db.auditLogs.length > 300) {
    db.auditLogs = db.auditLogs.slice(0, 300);
  }
}

function appendPlatformActivity(message: string, category: PlatformActivityItem['category']) {
  db.platformActivity.unshift({
    id: `act-${crypto.randomUUID().slice(0, 8)}`,
    message,
    category,
    timestamp: new Date().toISOString(),
  });
  if (db.platformActivity.length > 100) {
    db.platformActivity = db.platformActivity.slice(0, 100);
  }
}

function appendNotification(title: string, detail: string, department: string, severity: 'info' | 'warning' | 'critical' = 'info') {
  db.notifications.unshift({
    id: `not-${crypto.randomUUID().slice(0, 8)}`,
    title,
    detail,
    department,
    severity,
    timestamp: new Date().toISOString(),
    read: false,
  });
  if (db.notifications.length > 50) {
    db.notifications = db.notifications.slice(0, 50);
  }
}

function getEnvAdminCredentials(): { email: string; password: string } | null {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return null;
  return { email, password };
}

function planDetails(plan: SubscriptionPlan): { monthlyPriceUsd: number; seatsIncluded: number } {
  if (plan === 'Enterprise') return { monthlyPriceUsd: 2400, seatsIncluded: 250 };
  if (plan === 'Pro') return { monthlyPriceUsd: 950, seatsIncluded: 75 };
  return { monthlyPriceUsd: 350, seatsIncluded: 25 };
}

function createHospitalApplicationRecord(input: {
  hospitalName: string;
  hospitalType: string;
  bedsCount?: number;
  departmentsCount?: number;
  location?: string;
  address?: string;
  contactPerson: string;
  email: string;
  phone: string;
  applicantUserId?: string;
  notes?: string;
}): HospitalApplication {
  const seq = 1001 + db.applications.length;
  const year = new Date().getFullYear();
  const appRecord: HospitalApplication = {
    id: `app-${crypto.randomUUID().slice(0, 8)}`,
    applicationId: `APP-${year}-${seq}`,
    hospitalName: input.hospitalName.trim(),
    hospitalType: input.hospitalType.trim() || 'Multi-Specialty',
    bedsCount: Number(input.bedsCount) || 100,
    departmentsCount: Number(input.departmentsCount) || 8,
    location: (input.location || 'Not specified').trim(),
    address: (input.address || input.location || 'Address pending verification').trim(),
    contactPerson: input.contactPerson.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    submittedAt: new Date().toISOString(),
    status: 'Pending',
    documents: [
      { name: 'Hospital Registration Request.pdf', status: 'Uploaded' },
      { name: 'Hospital License.pdf', status: 'Requested' },
    ],
    internalNotes: input.notes ? input.notes.trim() : '',
    applicantUserId: input.applicantUserId,
  };
  db.applications.unshift(appRecord);

  // Update Support & Compliance Agents dynamically
  const supportAgent = db.agents.find((a) => a.id === 'agent-support');
  if (supportAgent) {
    supportAgent.assignedTasks += 1;
    supportAgent.completedTasks += 1;
    supportAgent.avgResponseSeconds = 1.4;
    supportAgent.recentActivity.unshift({
      id: `agact-${crypto.randomUUID().slice(0, 6)}`,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      summary: `Logged application ${appRecord.applicationId} for ${appRecord.hospitalName}`,
      department: 'Onboarding',
      outcome: 'Awaiting Review',
    });
  }
  const onboardingWf = db.workflows.find((w) => w.id === 'wf-onboarding');
  if (onboardingWf) {
    onboardingWf.executionsCount += 1;
    onboardingWf.lastRunAt = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }

  appendPlatformActivity(`New hospital application received: ${appRecord.hospitalName}`, 'application');
  appendNotification(
    `New onboarding request: ${appRecord.hospitalName}`,
    `${appRecord.contactPerson} submitted ${appRecord.applicationId} for review.`,
    'Onboarding',
    'info'
  );
  return appRecord;
}

function computeSuperAdminOverview() {
  const totalHospitals = db.applications.length;
  const pendingApplications = db.applications.filter(
    (a) => a.status === 'Pending' || a.status === 'Under Review' || a.status === 'Docs Requested'
  ).length;
  const approvedHospitals = db.hospitals.length;
  const activeWorkspaces = db.hospitals.filter((h) => h.workspaceStatus === 'Active').length;
  const totalUsers = db.users.filter((u) => u.role !== 'admin' && u.id !== 'usr-test-hospital').length;
  const activeSubscriptions = db.subscriptions.filter((s) => s.status === 'Active').length;

  const pendingCount = db.applications.filter((a) => a.status === 'Pending' || a.status === 'Docs Requested').length;
  const underReviewCount = db.applications.filter((a) => a.status === 'Under Review').length;
  const approvedCount = db.applications.filter((a) => a.status === 'Approved').length;

  // Build 12-month growth series dynamically from real application dates (all 0 when no apps)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const monthlyGrowth: Array<{ month: string; count: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = monthNames[d.getMonth()];
    const count = db.applications.filter((app) => {
      const ad = new Date(app.submittedAt);
      return ad.getFullYear() === d.getFullYear() && ad.getMonth() === d.getMonth();
    }).length;
    monthlyGrowth.push({ month: label, count });
  }

  return {
    metrics: {
      totalHospitals,
      pendingApplications,
      approvedHospitals,
      activeWorkspaces,
      totalUsers,
      activeSubscriptions,
    },
    applicationOverview: {
      total: db.applications.length,
      pending: pendingCount,
      underReview: underReviewCount,
      approved: approvedCount,
    },
    monthlyGrowth,
    applications: db.applications,
    recentHospitals: db.hospitals.slice(0, 6),
    platformActivity: db.platformActivity.slice(0, 12),
    agents: db.agents,
    notifications: db.notifications,
    systemHealth: {
      database: 'Healthy' as const,
      backend: 'Healthy' as const,
      aiServices: process.env.GEMINI_API_KEY ? ('Active' as const) : ('Standby' as const),
      integrations: 'Healthy' as const,
    },
  };
}

function provisionHospitalWorkspaceDefaults(appRecord: HospitalApplication, hospitalId: string): { createdDefaultAccount: boolean } {
  let createdDefaultAccount = false;

  const existingLinked = db.users.filter(
    (u) => u.id === appRecord.applicantUserId || u.email.toLowerCase() === appRecord.email.toLowerCase()
  );

  if (existingLinked.length > 0) {
    existingLinked.forEach((u) => {
      u.status = 'active';
      u.hospitalId = hospitalId;
      u.applicationId = appRecord.applicationId;
      u.hospitalName = appRecord.hospitalName;
    });
  } else {
    const newHospitalAdmin: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      fullName: appRecord.contactPerson,
      email: appRecord.email.toLowerCase(),
      role: 'coordinator',
      hospitalName: appRecord.hospitalName,
      hospitalType: appRecord.hospitalType,
      hospitalId,
      applicationId: appRecord.applicationId,
      contactNumber: appRecord.phone,
      status: 'active',
      mustChangePassword: true,
      createdAt: new Date().toISOString(),
      passwordHash: INITIAL_HOSPITAL_DEFAULT_SCRYPT_HASH,
    };
    db.users.push(newHospitalAdmin);
    createdDefaultAccount = true;
  }

  if (db.departments.length === 0) {
    db.departments = [
      { id: 'dept-cardio', name: 'Cardiology', head: appRecord.contactPerson, activePatients: 0, staffOnDuty: 0, totalStaff: 0, bedCapacity: Math.max(10, Math.round(appRecord.bedsCount * 0.2)), occupiedBeds: 0, avgWaitMinutes: 0, status: 'Nominal' },
      { id: 'dept-er', name: 'Emergency', head: appRecord.contactPerson, activePatients: 0, staffOnDuty: 0, totalStaff: 0, bedCapacity: Math.max(10, Math.round(appRecord.bedsCount * 0.15)), occupiedBeds: 0, avgWaitMinutes: 0, status: 'Nominal' },
      { id: 'dept-gen', name: 'General Medicine', head: appRecord.contactPerson, activePatients: 0, staffOnDuty: 0, totalStaff: 0, bedCapacity: Math.max(20, Math.round(appRecord.bedsCount * 0.4)), occupiedBeds: 0, avgWaitMinutes: 0, status: 'Nominal' },
    ];
  }

  if (db.resources.length === 0) {
    db.resources = [
      {
        id: 'res-beds-main',
        name: 'Inpatient Ward & ICU Beds',
        category: 'Beds',
        department: 'Hospital-Wide',
        total: appRecord.bedsCount || 150,
        available: appRecord.bedsCount || 150,
        inUse: 0,
        maintenance: 0,
      },
    ];
  }

  return { createdDefaultAccount };
}

function computeHospitalOverview(range: string, hospitalName: string) {
  const totalPatients = db.patients.length;
  const today = getTodayDateString();
  const todaysAppointments = db.appointments.filter((a) => a.date === today || range !== 'today').length;
  const activeAdmissions = db.patients.filter(
    (p) => p.admissionStatus === 'Admitted' || p.admissionStatus === 'ICU Observation'
  ).length;
  const bedResources = db.resources.filter((r) => r.category === 'Beds');
  const totalBeds = bedResources.reduce((acc, r) => acc + r.total, 0);
  const availableBeds = bedResources.reduce((acc, r) => acc + r.available, 0);
  const occupiedBeds = bedResources.reduce((acc, r) => acc + r.inUse, 0);
  const bedOccupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const pendingTasks = db.tasks.filter((t) => t.status !== 'Completed').length;
  const avgWaitMinutes =
    db.departments.length > 0
      ? Math.round(db.departments.reduce((acc, d) => acc + d.avgWaitMinutes, 0) / db.departments.length)
      : 0;
  const totalAgentTasksCompleted = db.agents.reduce((acc, a) => acc + a.completedTasks, 0);
  const aiAgentActivities = db.agents.reduce((acc, a) => acc + a.assignedTasks, 0);

  const radiologyCount = db.moduleRecords.filter((r) => r.module === 'radiology').length;
  const laboratoryCount = db.moduleRecords.filter((r) => r.module === 'laboratory').length;
  const pharmacyCount = db.moduleRecords.filter((r) => r.module === 'pharmacy').length;
  const billingCount = db.moduleRecords.filter((r) => r.module === 'billing').length;
  const insuranceCount = db.moduleRecords.filter((r) => r.module === 'insurance').length;
  const salesCount = db.moduleRecords.filter((r) => r.module === 'sales').length;
  const marketingCount = db.moduleRecords.filter((r) => r.module === 'marketing').length;

  const orchestrationNodes = [
    {
      id: 'agent-operations',
      title: 'Finance & Billing',
      subtitle: 'Billing · Payments · Revenue',
      side: 'left' as const,
      status: (billingCount > 0 ? 'Active' : 'Standby') as 'Active' | 'Processing' | 'Standby',
      tasksCount: billingCount,
      department: 'Finance & Billing',
    },
    {
      id: 'agent-clinical',
      title: 'Radiology',
      subtitle: 'RIS · PACS · DICOM',
      side: 'left' as const,
      status: (radiologyCount > 0 ? 'Active' : 'Standby') as 'Active' | 'Processing' | 'Standby',
      tasksCount: radiologyCount,
      department: 'Radiology',
    },
    {
      id: 'agent-flow',
      title: 'Appointments & Patient Operations',
      subtitle: 'HIS · EMR · Messaging',
      side: 'left' as const,
      status: (todaysAppointments > 0 || totalPatients > 0 ? 'Processing' : 'Active') as 'Active' | 'Processing' | 'Standby',
      tasksCount: todaysAppointments + totalPatients,
      department: 'Patient Operations',
    },
    {
      id: 'agent-compliance',
      title: 'Insurance & Discharge',
      subtitle: 'TPA · Claims · Records',
      side: 'right' as const,
      status: (insuranceCount > 0 || activeAdmissions > 0 ? 'Active' : 'Standby') as 'Active' | 'Processing' | 'Standby',
      tasksCount: insuranceCount,
      department: 'Insurance & Claims',
    },
    {
      id: 'agent-support',
      title: 'Sales & Business Development',
      subtitle: 'CRM · Leads · Partnerships',
      side: 'right' as const,
      status: (salesCount > 0 ? 'Processing' : 'Standby') as 'Active' | 'Processing' | 'Standby',
      tasksCount: salesCount,
      department: 'Sales & Leads',
    },
    {
      id: 'agent-analytics',
      title: 'Marketing Intelligence',
      subtitle: 'Campaigns · Analytics',
      side: 'right' as const,
      status: (marketingCount > 0 ? 'Active' : 'Standby') as 'Active' | 'Processing' | 'Standby',
      tasksCount: marketingCount,
      department: 'Marketing',
    },
  ];

  // Build real live activity feed from module records + notifications (starts empty at 0)
  const liveActivityFeed = [
    ...db.moduleRecords.slice(0, 8).map((rec) => ({
      id: `feed-${rec.id}`,
      title: `${rec.module.charAt(0).toUpperCase() + rec.module.slice(1)} record: ${rec.title}`,
      subtitle: `${rec.referenceCode}${rec.subtitle ? ` · ${rec.subtitle}` : ''}`,
      category: (rec.module === 'billing'
        ? 'finance'
        : rec.module === 'radiology'
        ? 'radiology'
        : rec.module === 'insurance'
        ? 'insurance'
        : rec.module === 'marketing' || rec.module === 'sales'
        ? 'marketing'
        : 'clinical') as 'finance' | 'radiology' | 'operations' | 'insurance' | 'marketing' | 'clinical',
      timestamp: rec.createdAt,
    })),
    ...db.notifications.slice(0, 6).map((n) => ({
      id: `notif-${n.id}`,
      title: n.title,
      subtitle: n.detail,
      category: 'operations' as const,
      timestamp: n.timestamp,
    })),
  ]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 6);

  // Build Needs Your Attention dynamically from pending/flagged module records + pending tasks
  const attentionItems = [
    ...db.moduleRecords
      .filter((r) => r.status === 'Pending Review' || r.status === 'Flagged')
      .map((r) => ({
        id: `att-${r.id}`,
        title: `${r.title} (${r.status})`,
        detail: `${r.referenceCode} · ${r.module}`,
        actionLabel: 'Review' as const,
        targetPath: `/dashboard/module/${r.module}`,
        severity: (r.status === 'Flagged' ? 'red' : 'orange') as 'red' | 'orange' | 'blue',
        timestamp: r.createdAt,
      })),
    ...db.tasks
      .filter((t) => t.status !== 'Completed')
      .map((t) => ({
        id: `att-${t.id}`,
        title: t.title,
        detail: `${t.department} · ${t.assignedAgent}`,
        actionLabel: 'View' as const,
        targetPath: '/dashboard/operations?tab=workflows',
        severity: (t.priority === 'Urgent' ? 'red' : 'blue') as 'red' | 'orange' | 'blue',
        timestamp: new Date().toISOString(),
      })),
  ].slice(0, 6);

  // 5-day Hospital Performance chart (starts at 0 and maps actual patient/admission counts)
  const dayLabels: string[] = [];
  const hospitalPerformance: Array<{ label: string; patients: number; admissions: number }> = [];
  const daysBack = range === '7d' ? 7 : range === '90d' ? 30 : 5;
  const step = range === '90d' ? 6 : 1;
  for (let i = 4; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i * step);
    const isoDay = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    dayLabels.push(label);
    const pCount = db.patients.filter((p) => p.lastVisit === isoDay || (i === 0 && !p.lastVisit)).length;
    const aCount = db.patients.filter(
      (p) =>
        (p.admissionStatus === 'Admitted' || p.admissionStatus === 'ICU Observation') &&
        (p.lastVisit === isoDay || i === 0)
    ).length;
    hospitalPerformance.push({
      label: daysBack > 0 ? label : label,
      patients: pCount,
      admissions: aCount,
    });
  }

  const slots = ['08:00', '10:00', '12:00', '14:00', '16:00'];
  const appointmentTrends = slots.map((slot) => {
    const matching = db.appointments.filter((a) => a.time.startsWith(slot.slice(0, 2)));
    return {
      label: slot,
      scheduled: matching.length,
      completed: matching.filter((a) => a.status === 'Completed').length,
      walkIn: 0,
    };
  });

  const patientFlowStages = [
    { stage: 'Intake & Check-in', count: db.appointments.filter((a) => a.status === 'Checked In').length, avgMinutes: 0 },
    { stage: 'Triage & Pre-Consult', count: db.appointments.filter((a) => a.status === 'In Progress').length, avgMinutes: 0 },
    { stage: 'Active Care / Ward', count: activeAdmissions, avgMinutes: 0 },
    { stage: 'Discharge Readiness', count: db.patients.filter((p) => p.admissionStatus === 'Discharged').length, avgMinutes: 0 },
  ];

  return {
    hospitalSettings: { ...db.hospitalSettings, hospitalName: hospitalName || db.hospitalSettings.hospitalName },
    metrics: {
      totalPatients,
      todaysAppointments,
      activeAdmissions,
      availableBeds,
      totalBeds,
      pendingTasks,
      bedOccupancyRate,
      avgWaitMinutes,
      totalAgentTasksCompleted,
      aiAgentActivities,
    },
    departmentIntelligence: {
      patients: totalPatients,
      appointments: todaysAppointments,
      admissions: activeAdmissions,
      radiology: radiologyCount,
      laboratory: laboratoryCount,
      pharmacy: pharmacyCount,
    },
    needsAttentionSummary: {
      pendingInsuranceApproval: db.moduleRecords.filter(
        (r) => r.module === 'insurance' && (r.status === 'Pending Review' || r.status === 'Flagged')
      ).length,
      reportsAwaitingReview: db.moduleRecords.filter(
        (r) =>
          (r.module === 'radiology' || r.module === 'laboratory') &&
          (r.status === 'Pending Review' || r.status === 'Flagged')
      ).length,
      appointmentsConfirmationRequired: db.appointments.filter((a) => a.status === 'Scheduled').length,
    },
    orchestrationNodes,
    liveActivityFeed,
    attentionItems,
    hospitalPerformance,
    appointmentTrends,
    patientFlowStages,
    departments: db.departments,
    agents: db.agents,
    tasks: db.tasks,
    notifications: db.notifications,
    workflowExecutions: db.workflowExecutions.slice(0, 20),
    departmentalAlerts: db.departmentalAlerts.slice(0, 30),
  };
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }
  req.authUser = payload;
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.authUser) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  if (req.authUser.role !== 'admin') {
    appendAudit(req.authUser.email, req.authUser.role, 'ADMIN_ENDPOINT_ACCESS_ATTEMPT', req.path, 'Denied');
    saveDatabase(db);
    res.status(403).json({ error: 'Super Administrator privileges are required for this action.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/auth/admin-status', (_req, res) => {
    res.json({
      adminClaimed: true,
      configuredByEnv: Boolean(getEnvAdminCredentials()),
    });
  });

  // Login (supports Work Email OR Hospital Application ID e.g. APP-2026-1001)
  app.post('/api/auth/login', async (req, res) => {
    const { email, password, rememberMe } = req.body ?? {};
    const cleanIdentifier = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!cleanIdentifier || !rawPassword) {
      res.status(400).json({ error: 'Work email or Application ID and password are required.' });
      return;
    }

    const ttlSeconds = rememberMe ? 7 * 24 * 3600 : 8 * 3600;
    const envAdmin = getEnvAdminCredentials();

    if (envAdmin && cleanIdentifier === envAdmin.email) {
      const a = Buffer.from(rawPassword);
      const b = Buffer.from(envAdmin.password);
      const match = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!match) {
        appendAudit(cleanIdentifier, 'unknown', 'LOGIN_FAILED', 'auth/login', 'Denied');
        saveDatabase(db);
        res.status(401).json({ error: 'Invalid credentials.' });
        return;
      }

      const token = signToken(
        {
          sub: 'env-admin',
          email: envAdmin.email,
          name: 'Super Admin',
          role: 'admin',
          hospitalName: 'CareOS Platform',
        },
        ttlSeconds
      );
      appendAudit(envAdmin.email, 'admin', 'LOGIN_SUCCESS', 'auth/login', 'Allowed');
      saveDatabase(db);
      res.json({
        token,
        user: {
          id: 'env-admin',
          fullName: 'Super Admin',
          email: envAdmin.email,
          role: 'admin',
          hospitalName: 'CareOS Platform',
          hospitalType: 'Platform Governance',
          contactNumber: 'Platform Admin',
          status: 'active',
          createdAt: new Date().toISOString(),
        },
      });
      return;
    }

    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === cleanIdentifier ||
        (u.applicationId && u.applicationId.toLowerCase() === cleanIdentifier) ||
        (u.hospitalId && u.hospitalId.toLowerCase() === cleanIdentifier)
    );
    if (!user) {
      appendAudit(cleanIdentifier, 'unknown', 'LOGIN_FAILED', 'auth/login', 'Denied');
      saveDatabase(db);
      res.status(401).json({ error: 'Invalid email / Application ID or password.' });
      return;
    }

    const valid = await verifyPassword(rawPassword, user.passwordHash);
    if (!valid) {
      appendAudit(user.email, user.role, 'LOGIN_FAILED', 'auth/login', 'Denied');
      saveDatabase(db);
      res.status(401).json({ error: 'Invalid email / Application ID or password.' });
      return;
    }

    if (user.status === 'suspended') {
      appendAudit(user.email, user.role, 'LOGIN_SUSPENDED_BLOCKED', 'auth/login', 'Denied');
      saveDatabase(db);
      res.status(403).json({ error: 'This workspace is currently suspended. Contact CareOS platform governance.' });
      return;
    }

    const token = signToken(
      {
        sub: user.id,
        email: user.email,
        name: user.fullName,
        role: user.role,
        hospitalName: user.hospitalName,
      },
      ttlSeconds
    );
    appendAudit(user.email, user.role, 'LOGIN_SUCCESS', 'auth/login', 'Allowed');
    saveDatabase(db);
    const { passwordHash: _omitted, ...safeUser } = user;
    res.json({ token, user: safeUser });
  });

  // First-login default password change for newly onboarded hospitals
  app.post('/api/auth/change-default-password', requireAuth, async (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
      res.status(400).json({ error: 'Current password and new password are required.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }
    if (newPassword === currentPassword) {
      res.status(400).json({ error: 'New password must be different from your default onboarding password.' });
      return;
    }
    const dbUser = db.users.find((u) => u.id === req.authUser!.sub || u.email.toLowerCase() === req.authUser!.email.toLowerCase());
    if (!dbUser) {
      res.status(404).json({ error: 'Account record not found.' });
      return;
    }
    const ok = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Current default password is incorrect.' });
      return;
    }
    dbUser.passwordHash = await hashPassword(newPassword);
    dbUser.mustChangePassword = false;
    appendAudit(dbUser.email, dbUser.role, 'FIRST_LOGIN_PASSWORD_CHANGED', dbUser.applicationId || dbUser.email, 'Allowed');
    saveDatabase(db);
    const { passwordHash: _omitted, ...safeUser } = dbUser;
    res.json({ ok: true, user: safeUser });
  });

  // Signup: creates coordinator user ('pending' onboarding) + real Hospital Application for Super Admin review!
  app.post('/api/auth/signup', async (req, res) => {
    const {
      fullName,
      workEmail,
      password,
      hospitalName,
      hospitalType,
      location,
      address,
      bedsCount,
      departmentsCount,
      contactNumber,
      agreedToTerms,
    } = req.body ?? {};
    const cleanEmail = typeof workEmail === 'string' ? workEmail.trim().toLowerCase() : '';
    const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
    const cleanHospital = typeof hospitalName === 'string' ? hospitalName.trim() : '';
    const cleanType = typeof hospitalType === 'string' ? hospitalType.trim() : 'Multi-Specialty';
    const cleanPhone = typeof contactNumber === 'string' ? contactNumber.trim() : '';

    if (!cleanName || !cleanEmail || !cleanHospital || !cleanPhone) {
      res.status(400).json({ error: 'Full name, work email, hospital name, and contact number are required.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid work email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }
    if (!agreedToTerms) {
      res.status(400).json({ error: 'You must accept the Terms of Service and Privacy Policy.' });
      return;
    }
    const envAdmin = getEnvAdminCredentials();
    if ((envAdmin && envAdmin.email === cleanEmail) || db.users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      res.status(409).json({ error: 'An account with this work email already exists.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const userId = `usr-${crypto.randomUUID().slice(0, 8)}`;

    const appRecord = createHospitalApplicationRecord({
      hospitalName: cleanHospital,
      hospitalType: cleanType,
      bedsCount: Number(bedsCount) || 120,
      departmentsCount: Number(departmentsCount) || 10,
      location: typeof location === 'string' && location.trim() ? location : 'Pending Location',
      address: typeof address === 'string' && address.trim() ? address : 'Submitted via CareOS Signup',
      contactPerson: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      applicantUserId: userId,
    });

    const newUser: StoredUser = {
      id: userId,
      fullName: cleanName,
      email: cleanEmail,
      role: 'coordinator', // Regular signups never receive admin privileges
      hospitalName: cleanHospital,
      hospitalType: cleanType,
      applicationId: appRecord.applicationId,
      contactNumber: cleanPhone,
      status: 'pending',
      createdAt: new Date().toISOString(),
      passwordHash,
    };
    db.users.push(newUser);
    appendPlatformActivity(`New user registered: ${cleanName}`, 'user');
    appendAudit(cleanEmail, 'coordinator', 'HOSPITAL_ONBOARDING_REQUESTED', appRecord.applicationId, 'Allowed');
    saveDatabase(db);

    const token = signToken(
      {
        sub: newUser.id,
        email: newUser.email,
        name: newUser.fullName,
        role: newUser.role,
        hospitalName: newUser.hospitalName,
      },
      8 * 3600
    );
    const { passwordHash: _omitted, ...safeUser } = newUser;
    res.status(201).json({ token, user: safeUser, application: appRecord });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    if (req.authUser) {
      revokedTokens.set(req.authUser.jti, req.authUser.exp);
      appendAudit(req.authUser.email, req.authUser.role, 'LOGOUT', 'auth/session', 'Allowed');
      saveDatabase(db);
    }
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = req.authUser!;
    const dbUser = db.users.find((item) => item.id === u.sub || item.email === u.email);
    if (dbUser) {
      const { passwordHash: _omitted, ...safeUser } = dbUser;
      res.json({ user: safeUser });
      return;
    }
    res.json({
      user: {
        id: u.sub,
        fullName: u.name,
        email: u.email,
        role: u.role,
        hospitalName: u.hospitalName,
        hospitalType: 'Platform Governance',
        contactNumber: 'Platform Admin',
        status: 'active',
        createdAt: new Date(u.iat * 1000).toISOString(),
      },
    });
  });

  app.post('/api/auth/forgot-password', (req, res) => {
    const { email } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid work email address.' });
      return;
    }
    res.json({
      message: 'If an active CareOS account matches that address, password recovery instructions have been queued for platform governance.',
    });
  });

  // Public Demo / Onboarding Request -> Directly creates a real Hospital Application in Admin Dashboard!
  app.post('/api/public/contact', (req, res) => {
    const { name, email, organization, roleOrType, location, bedsCount, departmentsCount, phone, message } = req.body ?? {};
    if (!name || !email || !organization || !message) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const appRecord = createHospitalApplicationRecord({
      hospitalName: String(organization),
      hospitalType: String(roleOrType || 'Multi-Specialty'),
      bedsCount: Number(bedsCount) || 150,
      departmentsCount: Number(departmentsCount) || 12,
      location: String(location || 'Location pending'),
      contactPerson: String(name),
      email: String(email),
      phone: String(phone || 'Not provided'),
      notes: String(message),
    });

    appendAudit(String(email).trim().toLowerCase(), 'public', 'ONBOARDING_DEMO_SUBMITTED', appRecord.applicationId, 'Allowed');
    saveDatabase(db);
    res.status(201).json({ ok: true, inquiryId: appRecord.applicationId, application: appRecord });
  });

  // Applicant Onboarding Tracker (for signed-in hospital users awaiting approval)
  app.get('/api/applicant/status', requireAuth, (req: AuthenticatedRequest, res) => {
    const u = db.users.find((item) => item.id === req.authUser!.sub || item.email === req.authUser!.email);
    const appRecord = db.applications.find(
      (a) => a.applicantUserId === req.authUser!.sub || a.email === req.authUser!.email
    );
    const hospital = db.hospitals.find(
      (h) => h.hospitalId === u?.hospitalId || h.administratorEmail === req.authUser!.email
    );
    res.json({
      userStatus: u?.status || 'pending',
      application: appRecord || null,
      hospital: hospital || null,
    });
  });

  app.post('/api/applicant/resubmit', requireAuth, (req: AuthenticatedRequest, res) => {
    const appRecord = db.applications.find(
      (a) => a.applicantUserId === req.authUser!.sub || a.email === req.authUser!.email
    );
    if (!appRecord) {
      res.status(404).json({ error: 'No onboarding application found for your account.' });
      return;
    }
    const { documentName, note } = req.body ?? {};
    if (documentName && String(documentName).trim()) {
      appRecord.documents.push({ name: String(documentName).trim(), status: 'Uploaded' });
    }
    if (note && String(note).trim()) {
      appRecord.internalNotes = `${appRecord.internalNotes ? appRecord.internalNotes + '\n' : ''}Applicant response: ${String(note).trim()}`;
    }
    appRecord.status = 'Under Review';
    appendPlatformActivity(`Updated documents submitted for ${appRecord.hospitalName}`, 'application');
    appendNotification(
      `Documents submitted: ${appRecord.hospitalName}`,
      `${appRecord.contactPerson} responded to your document request.`,
      'Onboarding',
      'info'
    );
    appendAudit(req.authUser!.email, req.authUser!.role, 'APPLICANT_DOCS_SUBMITTED', appRecord.applicationId, 'Allowed');
    saveDatabase(db);
    res.json({ application: appRecord });
  });

  // ==========================================================
  // SUPER ADMIN PLATFORM COMMAND CENTER ENDPOINTS
  // ==========================================================
  app.get('/api/super-admin/overview', requireAuth, requireAdmin, (_req, res) => {
    res.json(computeSuperAdminOverview());
  });

  app.get('/api/super-admin/applications', requireAuth, requireAdmin, (_req, res) => {
    res.json({ applications: db.applications });
  });

  app.get('/api/super-admin/applications/:id', requireAuth, requireAdmin, (req, res) => {
    const appRecord = db.applications.find((a) => a.id === req.params.id || a.applicationId === req.params.id);
    if (!appRecord) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }
    res.json({ application: appRecord });
  });

  app.patch('/api/super-admin/applications/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const appRecord = db.applications.find((a) => a.id === req.params.id || a.applicationId === req.params.id);
    if (!appRecord) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }
    const { status, internalNotes, requestedMessage } = req.body ?? {};
    if (typeof internalNotes === 'string') {
      appRecord.internalNotes = internalNotes;
    }
    if (typeof requestedMessage === 'string') {
      appRecord.requestedMessage = requestedMessage;
    }
    if (status && ['Pending', 'Under Review', 'Docs Requested', 'Rejected'].includes(status)) {
      appRecord.status = status as ApplicationStatus;
      appRecord.reviewedAt = new Date().toISOString();
      if (status === 'Docs Requested') {
        appRecord.documents.push({ name: 'Additional Verification Required', status: 'Requested' });
        appendPlatformActivity(`Documents requested: ${appRecord.hospitalName}`, 'application');
      } else if (status === 'Rejected') {
        appendPlatformActivity(`Application rejected: ${appRecord.hospitalName}`, 'application');
      } else if (status === 'Under Review') {
        appendPlatformActivity(`Application under review: ${appRecord.hospitalName}`, 'application');
      }
      appendAudit(req.authUser!.email, 'admin', `APPLICATION_${String(status).toUpperCase().replace(/\s+/g, '_')}`, appRecord.applicationId, 'Allowed');
    } else {
      appendAudit(req.authUser!.email, 'admin', 'APPLICATION_NOTES_SAVED', appRecord.applicationId, 'Allowed');
    }
    saveDatabase(db);
    res.json({ application: appRecord });
  });

  app.post('/api/super-admin/applications/:id/approve', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const appRecord = db.applications.find((a) => a.id === req.params.id || a.applicationId === req.params.id);
    if (!appRecord) {
      res.status(404).json({ error: 'Application not found.' });
      return;
    }
    if (appRecord.status === 'Approved') {
      res.status(400).json({ error: 'Hospital is already approved.' });
      return;
    }

    const plan: SubscriptionPlan =
      req.body?.plan === 'Starter' || req.body?.plan === 'Pro' || req.body?.plan === 'Enterprise'
        ? req.body.plan
        : appRecord.bedsCount >= 200
        ? 'Enterprise'
        : appRecord.bedsCount >= 80
        ? 'Pro'
        : 'Starter';

    appRecord.status = 'Approved';
    appRecord.reviewedAt = new Date().toISOString();
    appRecord.documents = appRecord.documents.map((d) => ({ ...d, status: 'Verified' }));

    const hspSeq = String(1 + db.hospitals.length).padStart(5, '0');
    const hospitalId = `HSP-${hspSeq}`;

    const { createdDefaultAccount } = provisionHospitalWorkspaceDefaults(appRecord, hospitalId);

    const approvedHospital: ApprovedHospital = {
      id: `hsp-${crypto.randomUUID().slice(0, 8)}`,
      hospitalId,
      applicationId: appRecord.applicationId,
      hospitalName: appRecord.hospitalName,
      hospitalType: appRecord.hospitalType,
      location: appRecord.location,
      address: appRecord.address,
      administratorName: appRecord.contactPerson,
      administratorEmail: appRecord.email,
      phone: appRecord.phone,
      bedsCount: appRecord.bedsCount,
      departmentsCount: appRecord.departmentsCount,
      activeUsersCount: 1,
      subscriptionPlan: plan,
      workspaceStatus: 'Active',
      approvedAt: new Date().toISOString(),
    };
    db.hospitals.unshift(approvedHospital);

    const { monthlyPriceUsd, seatsIncluded } = planDetails(plan);
    const sub: SubscriptionRecord = {
      id: `sub-${crypto.randomUUID().slice(0, 8)}`,
      hospitalId,
      hospitalName: appRecord.hospitalName,
      plan,
      monthlyPriceUsd,
      seatsIncluded,
      status: 'Active',
      startedAt: new Date().toISOString(),
    };
    db.subscriptions.unshift(sub);

    const complianceAgent = db.agents.find((a) => a.id === 'agent-compliance');
    if (complianceAgent) {
      complianceAgent.assignedTasks += 1;
      complianceAgent.completedTasks += 1;
      complianceAgent.avgResponseSeconds = 1.2;
      complianceAgent.recentActivity.unshift({
        id: `agact-${crypto.randomUUID().slice(0, 6)}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        summary: `Approved ${appRecord.hospitalName} (${hospitalId}) on ${plan} plan`,
        department: 'Governance',
        outcome: 'Completed',
      });
    }

    appendPlatformActivity(`Hospital approved: ${appRecord.hospitalName}`, 'approval');
    appendNotification(
      `Hospital approved: ${appRecord.hospitalName}`,
      `${hospitalId} workspace provisioned on ${plan} plan.`,
      'Governance',
      'info'
    );
    appendAudit(req.authUser!.email, 'admin', 'HOSPITAL_APPROVED', `${hospitalId} (${appRecord.hospitalName})`, 'Allowed');
    saveDatabase(db);

    res.json({
      application: appRecord,
      hospital: approvedHospital,
      subscription: sub,
      provisionedLogin: {
        username: appRecord.applicationId,
        usesDefaultPassword: createdDefaultAccount,
      },
    });
  });

  // Direct Admin Onboarding of a Hospital
  app.post('/api/super-admin/hospitals/manual', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const { hospitalName, hospitalType, location, address, contactPerson, email, phone, bedsCount, departmentsCount, plan } = req.body ?? {};
    if (!hospitalName || !contactPerson || !email) {
      res.status(400).json({ error: 'Hospital name, administrator name, and email are required.' });
      return;
    }
    const appRecord = createHospitalApplicationRecord({
      hospitalName: String(hospitalName),
      hospitalType: String(hospitalType || 'Multi-Specialty'),
      bedsCount: Number(bedsCount) || 150,
      departmentsCount: Number(departmentsCount) || 10,
      location: String(location || 'United States'),
      address: String(address || 'Configured by Super Admin'),
      contactPerson: String(contactPerson),
      email: String(email),
      phone: String(phone || 'Not provided'),
    });
    // Immediately approve if requested
    if (req.body?.autoApprove) {
      appRecord.status = 'Approved';
      appRecord.reviewedAt = new Date().toISOString();
      appRecord.documents = appRecord.documents.map((d) => ({ ...d, status: 'Verified' }));
      const chosenPlan: SubscriptionPlan = plan === 'Starter' || plan === 'Pro' ? plan : 'Enterprise';
      const hospitalId = `HSP-${String(1 + db.hospitals.length).padStart(5, '0')}`;
      const { createdDefaultAccount } = provisionHospitalWorkspaceDefaults(appRecord, hospitalId);
      const hsp: ApprovedHospital = {
        id: `hsp-${crypto.randomUUID().slice(0, 8)}`,
        hospitalId,
        applicationId: appRecord.applicationId,
        hospitalName: appRecord.hospitalName,
        hospitalType: appRecord.hospitalType,
        location: appRecord.location,
        address: appRecord.address,
        administratorName: appRecord.contactPerson,
        administratorEmail: appRecord.email,
        phone: appRecord.phone,
        bedsCount: appRecord.bedsCount,
        departmentsCount: appRecord.departmentsCount,
        activeUsersCount: 1,
        subscriptionPlan: chosenPlan,
        workspaceStatus: 'Active',
        approvedAt: new Date().toISOString(),
      };
      db.hospitals.unshift(hsp);
      const { monthlyPriceUsd, seatsIncluded } = planDetails(chosenPlan);
      db.subscriptions.unshift({
        id: `sub-${crypto.randomUUID().slice(0, 8)}`,
        hospitalId,
        hospitalName: appRecord.hospitalName,
        plan: chosenPlan,
        monthlyPriceUsd,
        seatsIncluded,
        status: 'Active',
        startedAt: new Date().toISOString(),
      });
      appendPlatformActivity(`Hospital onboarded directly: ${hsp.hospitalName}`, 'approval');
      appendAudit(req.authUser!.email, 'admin', 'HOSPITAL_DIRECT_ONBOARD', hospitalId, 'Allowed');
      saveDatabase(db);
      res.status(201).json({
        application: appRecord,
        hospital: hsp,
        provisionedLogin: {
          username: appRecord.applicationId,
          usesDefaultPassword: createdDefaultAccount,
        },
      });
      return;
    }
    appendAudit(req.authUser!.email, 'admin', 'HOSPITAL_APPLICATION_CREATED', appRecord.applicationId, 'Allowed');
    saveDatabase(db);
    res.status(201).json({ application: appRecord });
  });

  app.get('/api/super-admin/hospitals', requireAuth, requireAdmin, (_req, res) => {
    res.json({ hospitals: db.hospitals });
  });

  app.patch('/api/super-admin/hospitals/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const hsp = db.hospitals.find((h) => h.id === req.params.id || h.hospitalId === req.params.id);
    if (!hsp) {
      res.status(404).json({ error: 'Hospital not found.' });
      return;
    }
    const { subscriptionPlan, workspaceStatus } = req.body ?? {};
    if (subscriptionPlan && ['Starter', 'Pro', 'Enterprise'].includes(subscriptionPlan)) {
      hsp.subscriptionPlan = subscriptionPlan as SubscriptionPlan;
      const sub = db.subscriptions.find((s) => s.hospitalId === hsp.hospitalId);
      if (sub) {
        sub.plan = hsp.subscriptionPlan;
        const details = planDetails(hsp.subscriptionPlan);
        sub.monthlyPriceUsd = details.monthlyPriceUsd;
        sub.seatsIncluded = details.seatsIncluded;
      }
      appendPlatformActivity(`Subscription updated for ${hsp.hospitalName} (${hsp.subscriptionPlan})`, 'system');
    }
    if (workspaceStatus && ['Active', 'Suspended'].includes(workspaceStatus)) {
      hsp.workspaceStatus = workspaceStatus;
      const sub = db.subscriptions.find((s) => s.hospitalId === hsp.hospitalId);
      if (sub) sub.status = workspaceStatus === 'Active' ? 'Active' : 'Paused';
      db.users.forEach((u) => {
        if (u.hospitalId === hsp.hospitalId && u.role !== 'admin') {
          u.status = workspaceStatus === 'Active' ? 'active' : 'suspended';
        }
      });
      appendPlatformActivity(`Workspace ${workspaceStatus.toLowerCase()}: ${hsp.hospitalName}`, 'system');
    }
    appendAudit(req.authUser!.email, 'admin', 'HOSPITAL_UPDATED', hsp.hospitalId, 'Allowed');
    saveDatabase(db);
    res.json({ hospital: hsp });
  });

  app.get('/api/super-admin/subscriptions', requireAuth, requireAdmin, (_req, res) => {
    res.json({ subscriptions: db.subscriptions });
  });

  app.post('/api/super-admin/change-password', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }
    const adminUser = db.users.find((u) => u.email.toLowerCase() === req.authUser!.email.toLowerCase() && u.role === 'admin');
    if (!adminUser) {
      res.status(400).json({ error: 'Environment-managed admin passwords must be updated in Settings -> Secrets.' });
      return;
    }
    const ok = await verifyPassword(String(currentPassword || ''), adminUser.passwordHash);
    if (!ok) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }
    adminUser.passwordHash = await hashPassword(newPassword);
    appendAudit(adminUser.email, 'admin', 'ADMIN_PASSWORD_ROTATED', 'auth/admin', 'Allowed');
    saveDatabase(db);
    res.json({ ok: true });
  });

  // ==========================================================
  // HOSPITAL WORKSPACE & SHARED OPERATIONS ENDPOINTS
  // ==========================================================
  app.get('/api/dashboard/overview', requireAuth, (req: AuthenticatedRequest, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : 'today';
    res.json(computeHospitalOverview(range, req.authUser!.hospitalName));
  });

  app.post('/api/hospital/command', requireAuth, (req: AuthenticatedRequest, res) => {
    const rawPrompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : '';
    const prompt = rawPrompt || "Prepare today's hospital operational report.";
    const overview = computeHospitalOverview('today', req.authUser!.hospitalName);

    const billingPending = db.moduleRecords.filter(
      (r) => r.module === 'billing' && (r.status === 'Pending Review' || r.status === 'Flagged')
    ).length;
    const billingTotal = db.moduleRecords.filter((r) => r.module === 'billing').length;
    const labCount = overview.departmentIntelligence.laboratory;
    const radCount = overview.departmentIntelligence.radiology;

    const steps = [
      {
        agentName: 'Hospital Intelligence Agent',
        detail: `Synced ${overview.metrics.totalPatients} patients & ${overview.metrics.availableBeds}/${overview.metrics.totalBeds} beds.`,
        status: 'completed' as const,
      },
      {
        agentName: 'Finance Agent',
        detail: `Reviewed ${billingTotal} billing entries (${billingPending} pending review).`,
        status: 'completed' as const,
      },
      {
        agentName: 'Patient Operations Agent',
        detail: `Checked ${overview.metrics.todaysAppointments} appointments & ${overview.metrics.activeAdmissions} admissions.`,
        status: 'completed' as const,
      },
      {
        agentName: 'Radiology Agent',
        detail: `Audited ${radCount} radiology & ${labCount} lab orders (${overview.needsAttentionSummary.reportsAwaitingReview} awaiting review).`,
        status: 'completed' as const,
      },
    ];

    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    for (const agent of db.agents.slice(0, 4)) {
      agent.assignedTasks += 1;
      agent.completedTasks += 1;
      agent.recentActivity.unshift({
        id: `act-${crypto.randomUUID().slice(0, 6)}`,
        timestamp: nowTime,
        summary: `Command: ${prompt}`,
        department: agent.category,
        outcome: 'Completed',
      });
      if (agent.recentActivity.length > 10) agent.recentActivity = agent.recentActivity.slice(0, 10);
    }

    appendNotification(
      'Operational report compiled',
      `${prompt} · ${overview.metrics.todaysAppointments} appointments, ${overview.needsAttentionSummary.reportsAwaitingReview} pending reports`,
      'Intelligence Core',
      'info'
    );
    appendAudit(req.authUser!.email, req.authUser!.role, 'HOSPITAL_COMMAND_EXECUTED', prompt, 'Allowed');
    saveDatabase(db);

    const lower = prompt.toLowerCase();
    const reportTitle = lower.includes('insurance')
      ? 'Insurance & Claims Clearance Brief'
      : lower.includes('appointment')
      ? 'Appointments Confirmation Brief'
      : lower.includes('department')
      ? 'Department Capacity & Performance Brief'
      : "Today's Hospital Operational Report";

    res.json({
      result: {
        id: `cmd-${crypto.randomUUID().slice(0, 8)}`,
        prompt,
        response: "On it. I've coordinated the relevant departments.",
        reportTitle,
        generatedAt: new Date().toISOString(),
        steps,
        summaryLines: [
          { label: 'Hospital Workspace', value: overview.hospitalSettings.hospitalName },
          { label: 'Total Patients Registered', value: String(overview.metrics.totalPatients) },
          { label: "Today's Appointments", value: String(overview.metrics.todaysAppointments) },
          { label: 'Active Inpatient Admissions', value: String(overview.metrics.activeAdmissions) },
          { label: 'Available Beds', value: `${overview.metrics.availableBeds} / ${overview.metrics.totalBeds}` },
          { label: 'Pending Insurance Approvals', value: String(overview.needsAttentionSummary.pendingInsuranceApproval) },
          { label: 'Reports Awaiting Clinician Review', value: String(overview.needsAttentionSummary.reportsAwaitingReview) },
          { label: 'Appointments Confirmation Required', value: String(overview.needsAttentionSummary.appointmentsConfirmationRequired) },
        ],
      },
    });
  });

  // ==========================================================
  // GEMINI MULTI-AGENT ORCHESTRATION ENGINE
  // ==========================================================
  app.post('/api/hospital/orchestrate', requireAuth, async (req: AuthenticatedRequest, res) => {
    const rawInstruction = typeof req.body?.instruction === 'string' ? req.body.instruction.trim() : '';
    if (!rawInstruction) {
      res.status(400).json({ error: 'Please enter or speak an instruction for CareOS.' });
      return;
    }

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.API_KEY ||
      ''
    ).trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'Gemini API key is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets to enable AI orchestration.',
      });
      return;
    }

    const startedAt = Date.now();
    const overview = computeHospitalOverview('today', req.authUser!.hospitalName);

    const snapshot = {
      hospitalName: overview.hospitalSettings.hospitalName,
      humanOversightRequired: overview.hospitalSettings.humanOversightRequired,
      metrics: overview.metrics,
      needsAttentionSummary: overview.needsAttentionSummary,
      patientsSample: db.patients.slice(0, 15).map((p) => ({
        mrn: p.mrn,
        fullName: p.fullName,
        department: p.department,
        admissionStatus: p.admissionStatus,
        wardBed: p.wardBed,
      })),
      appointmentsSample: db.appointments.slice(0, 15).map((a) => ({
        patientName: a.patientName,
        department: a.department,
        doctorName: a.doctorName,
        date: a.date,
        time: a.time,
        status: a.status,
      })),
      departments: db.departments.map((d) => ({
        name: d.name,
        occupiedBeds: d.occupiedBeds,
        bedCapacity: d.bedCapacity,
        status: d.status,
      })),
      moduleRecordsByType: {
        billing: db.moduleRecords.filter((r) => r.module === 'billing').slice(0, 10),
        radiology: db.moduleRecords.filter((r) => r.module === 'radiology').slice(0, 10),
        laboratory: db.moduleRecords.filter((r) => r.module === 'laboratory').slice(0, 10),
        pharmacy: db.moduleRecords.filter((r) => r.module === 'pharmacy').slice(0, 10),
        insurance: db.moduleRecords.filter((r) => r.module === 'insurance').slice(0, 10),
        inventory: db.moduleRecords.filter((r) => r.module === 'inventory').slice(0, 10),
        sales: db.moduleRecords.filter((r) => r.module === 'sales').slice(0, 10),
        marketing: db.moduleRecords.filter((r) => r.module === 'marketing').slice(0, 10),
      },
      connectedExternalSystems: db.integrations.filter((i) => i.connected).map((i) => i.name),
    };

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: JSON.stringify({
          administratorInstruction: rawInstruction,
          liveHospitalSnapshot: snapshot,
        }),
        config: {
          systemInstruction:
            'You are CareOS Intelligence, the central orchestrator of an AI-native Hospital Intelligence Operating System. ' +
            'Analyze the administratorInstruction against the liveHospitalSnapshot and coordinate ONLY the relevant specialized departmental agents from: ' +
            '"finance", "radiology", "operations", "insurance", "sales", "marketing". ' +
            'Never activate all 6 agents unless the instruction genuinely requires every department. ' +
            'Rules: ' +
            '1) Ground every finding strictly in liveHospitalSnapshot. If a module or patient count is 0, accurately state 0—never fabricate patient names, dollar amounts, or clinical facts not in the snapshot. ' +
            '2) Generate an ordered chain of interAgentMessages showing agents passing context to each other (using keys "core", "finance", "radiology", "operations", "insurance", "sales", "marketing"). ' +
            '3) Never claim an external system (HIS/EMR/insurer) was modified if connectedExternalSystems is empty; label internal CareOS coordination clearly and mark sensitive clinical/financial/discharge actions in pendingApprovals for human administrator approval. ' +
            '4) Keep inter-agent messages concise (under 18 words each) and voiceConfirmation under 20 words.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              intentSummary: { type: Type.STRING },
              selectedAgents: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              voiceConfirmation: { type: Type.STRING },
              executiveBrief: { type: Type.STRING },
              reportTitle: { type: Type.STRING },
              interAgentMessages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    fromKey: { type: Type.STRING },
                    toKey: { type: Type.STRING },
                    fromAgent: { type: Type.STRING },
                    toAgent: { type: Type.STRING },
                    department: { type: Type.STRING },
                    message: { type: Type.STRING },
                    status: { type: Type.STRING },
                  },
                },
              },
              departmentalAlerts: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    department: { type: Type.STRING },
                    agentName: { type: Type.STRING },
                    summary: { type: Type.STRING },
                    priority: { type: Type.STRING },
                    requiresApproval: { type: Type.BOOLEAN },
                  },
                },
              },
              pendingApprovals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    department: { type: Type.STRING },
                    description: { type: Type.STRING },
                    actionType: { type: Type.STRING },
                  },
                },
              },
              reportSections: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          label: { type: Type.STRING },
                          value: { type: Type.STRING },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim()) as {
        intentSummary?: string;
        selectedAgents?: string[];
        voiceConfirmation?: string;
        executiveBrief?: string;
        reportTitle?: string;
        interAgentMessages?: Array<{
          fromKey?: string;
          toKey?: string;
          fromAgent?: string;
          toAgent?: string;
          department?: string;
          message?: string;
          status?: string;
        }>;
        departmentalAlerts?: Array<{
          department?: string;
          agentName?: string;
          summary?: string;
          priority?: string;
          requiresApproval?: boolean;
        }>;
        pendingApprovals?: Array<{
          title?: string;
          department?: string;
          description?: string;
          actionType?: string;
        }>;
        reportSections?: Array<{
          title?: string;
          items?: Array<{ label?: string; value?: string }>;
        }>;
      };

      const validKeys: OrchestratorAgentKey[] = ['finance', 'radiology', 'operations', 'insurance', 'sales', 'marketing'];
      const selectedAgents = (parsed.selectedAgents ?? [])
        .map((k) => k.toLowerCase().trim() as OrchestratorAgentKey)
        .filter((k): k is OrchestratorAgentKey => validKeys.includes(k));
      const uniqueAgents: OrchestratorAgentKey[] =
        selectedAgents.length > 0 ? Array.from(new Set(selectedAgents)) : ['operations', 'finance'];

      const workflowId = `wf-${crypto.randomUUID().slice(0, 8)}`;
      const workflowCode = `WF-${new Date().getFullYear()}-${1001 + db.workflowExecutions.length}`;
      const nowIso = new Date().toISOString();

      const deptRouteMap = (dept: string): string => {
        const d = dept.toLowerCase();
        if (d.includes('insur') || d.includes('discharge')) return '/dashboard/module/insurance';
        if (d.includes('rad') || d.includes('imag')) return '/dashboard/module/radiology';
        if (d.includes('fin') || d.includes('bill')) return '/dashboard/module/billing';
        if (d.includes('pharm')) return '/dashboard/module/pharmacy';
        if (d.includes('lab')) return '/dashboard/module/laboratory';
        if (d.includes('sale')) return '/dashboard/module/sales';
        if (d.includes('market')) return '/dashboard/module/marketing';
        if (d.includes('bed') || d.includes('resour')) return '/dashboard/resources';
        if (d.includes('appoint')) return '/dashboard/appointments';
        return '/dashboard/patients';
      };

      const interAgentMessages: InterAgentMessage[] = (parsed.interAgentMessages ?? []).map((m, idx) => {
        const fk = (m.fromKey || 'core').toLowerCase() as OrchestratorAgentKey | 'core';
        const tk = (m.toKey || 'core').toLowerCase() as OrchestratorAgentKey | 'core';
        return {
          id: `msg-${crypto.randomUUID().slice(0, 6)}`,
          step: idx + 1,
          fromAgent: m.fromAgent || 'CareOS Intelligence',
          toAgent: m.toAgent || 'Department Agent',
          fromKey: fk === 'core' || validKeys.includes(fk) ? fk : 'core',
          toKey: tk === 'core' || validKeys.includes(tk) ? tk : 'core',
          department: m.department || 'Operations',
          message: m.message || 'Coordinating operational check.',
          status:
            m.status === 'warning' || m.status === 'pending_approval' ? m.status : 'completed',
          timestamp: nowIso,
        };
      });

      const departmentalAlerts: DepartmentAlertItem[] = (parsed.departmentalAlerts ?? []).map((al) => ({
        id: `alt-${crypto.randomUUID().slice(0, 8)}`,
        workflowId,
        workflowCode,
        department: al.department || 'Hospital Operations',
        agentName: al.agentName || 'CareOS Agent',
        summary: al.summary || 'Action requested from CareOS orchestration.',
        priority: al.priority === 'Urgent' || al.priority === 'High' ? al.priority : 'Normal',
        timestamp: nowIso,
        status: 'Delivered (In-App)',
        targetPath: deptRouteMap(al.department || ''),
        requiresApproval: Boolean(al.requiresApproval),
      }));

      const pendingApprovals: PendingApprovalItem[] = (parsed.pendingApprovals ?? []).map((pa) => ({
        id: `apr-${crypto.randomUUID().slice(0, 8)}`,
        title: pa.title || 'Administrator Sign-off',
        department: pa.department || 'Hospital Governance',
        description: pa.description || 'Review CareOS recommendation before finalizing.',
        actionType:
          pa.actionType === 'clinical' ||
          pa.actionType === 'financial' ||
          pa.actionType === 'insurance' ||
          pa.actionType === 'discharge'
            ? pa.actionType
            : 'clinical',
        approved: false,
      }));

      const reportSections = (parsed.reportSections ?? []).map((sec) => ({
        title: sec.title || 'Operational Summary',
        items: (sec.items ?? []).map((it) => ({
          label: it.label || 'Metric',
          value: it.value || '0',
        })),
      }));

      const execution: WorkflowExecutionRecord = {
        id: workflowId,
        workflowCode,
        instruction: rawInstruction,
        intentSummary: parsed.intentSummary || rawInstruction,
        executedAt: nowIso,
        executionMs: Date.now() - startedAt,
        participatingAgents: uniqueAgents,
        status: pendingApprovals.length > 0 ? 'Awaiting Approval' : 'Completed',
        voiceConfirmation:
          parsed.voiceConfirmation ||
          `CareOS coordinated ${uniqueAgents.length} departments and compiled your operational report.`,
        executiveBrief:
          parsed.executiveBrief || 'CareOS Intelligence coordinated the selected departmental agents.',
        interAgentMessages,
        departmentalAlerts,
        pendingApprovals,
        reportTitle: parsed.reportTitle || 'CareOS Consolidated Operational Brief',
        reportSections,
      };

      db.workflowExecutions.unshift(execution);
      if (db.workflowExecutions.length > 50) db.workflowExecutions = db.workflowExecutions.slice(0, 50);

      for (const alert of departmentalAlerts) {
        db.departmentalAlerts.unshift(alert);
        appendNotification(
          `${alert.department} Alert`,
          `${alert.workflowCode}: ${alert.summary}`,
          alert.department,
          alert.priority === 'Urgent' ? 'critical' : alert.priority === 'High' ? 'warning' : 'info'
        );
      }
      if (db.departmentalAlerts.length > 80) db.departmentalAlerts = db.departmentalAlerts.slice(0, 80);

      const agentMap: Record<OrchestratorAgentKey, string> = {
        finance: 'agent-operations',
        radiology: 'agent-clinical',
        operations: 'agent-operations',
        insurance: 'agent-compliance',
        sales: 'agent-support',
        marketing: 'agent-analytics',
      };
      const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const touchedAgentIds = new Set(uniqueAgents.map((k) => agentMap[k]));
      for (const ag of db.agents) {
        if (touchedAgentIds.has(ag.id)) {
          ag.assignedTasks += 1;
          ag.completedTasks += 1;
          ag.avgResponseSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
          ag.recentActivity.unshift({
            id: `act-${crypto.randomUUID().slice(0, 6)}`,
            timestamp: nowTime,
            summary: `${workflowCode}: ${rawInstruction}`,
            department: ag.category,
            outcome: pendingApprovals.length > 0 ? 'Awaiting Review' : 'Completed',
          });
          if (ag.recentActivity.length > 10) ag.recentActivity = ag.recentActivity.slice(0, 10);
        }
      }

      appendAudit(req.authUser!.email, req.authUser!.role, 'AGENTIC_ORCHESTRATION_EXECUTED', `${workflowCode}: ${rawInstruction}`, 'Allowed');
      saveDatabase(db);
      res.json({ execution });
    } catch (err) {
      let msg = err instanceof Error ? err.message : 'CareOS orchestration failed while calling Gemini.';
      let upstreamCode: number | undefined;
      try {
        const parsedErr = JSON.parse(msg) as { error?: { code?: number; message?: string; status?: string } };
        if (parsedErr?.error?.message) {
          msg = parsedErr.error.message;
          upstreamCode = parsedErr.error.code;
        }
      } catch {
        // Leave original error message as-is
      }
      if (upstreamCode === 403 || msg.includes('PERMISSION_DENIED') || msg.includes('free tier')) {
        msg = `${msg} Please select or attach a billing-enabled Gemini API key in Settings > Secrets.`;
      } else if (upstreamCode === 429 || msg.includes('RESOURCE_EXHAUSTED')) {
        msg = `${msg} Quota exceeded — check your Gemini API tier in Settings > Secrets.`;
      }
      appendAudit(req.authUser!.email, req.authUser!.role, 'AGENTIC_ORCHESTRATION_FAILED', rawInstruction, 'Denied');
      saveDatabase(db);
      res.status(upstreamCode === 429 ? 429 : 502).json({
        error: msg,
        upstreamStatus: upstreamCode ?? 502,
      });
    }
  });

  app.post('/api/hospital/workflows/:id/approve', requireAuth, (req: AuthenticatedRequest, res) => {
    const wf = db.workflowExecutions.find((w) => w.id === req.params.id);
    if (!wf) {
      res.status(404).json({ error: 'Workflow execution not found.' });
      return;
    }
    const { approvalId } = req.body ?? {};
    const target = wf.pendingApprovals.find((p) => p.id === approvalId);
    if (!target) {
      res.status(404).json({ error: 'Approval item not found.' });
      return;
    }
    target.approved = true;
    target.approvedAt = new Date().toISOString();
    target.approvedBy = req.authUser!.name;
    if (wf.pendingApprovals.every((p) => p.approved)) {
      wf.status = 'Completed';
    }
    appendAudit(req.authUser!.email, req.authUser!.role, 'WORKFLOW_ITEM_APPROVED', `${wf.workflowCode} · ${target.title}`, 'Allowed');
    saveDatabase(db);
    res.json({ execution: wf });
  });

  app.patch('/api/hospital/alerts/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const alert = db.departmentalAlerts.find((a) => a.id === req.params.id);
    if (!alert) {
      res.status(404).json({ error: 'Department alert not found.' });
      return;
    }
    const nextStatus = req.body?.status;
    if (nextStatus === 'Acknowledged' || nextStatus === 'Approved') {
      alert.status = nextStatus;
      appendAudit(req.authUser!.email, req.authUser!.role, `ALERT_${nextStatus.toUpperCase()}`, `${alert.workflowCode} · ${alert.department}`, 'Allowed');
      saveDatabase(db);
    }
    res.json({ alert });
  });

  app.patch('/api/hospital/voice-settings', requireAuth, (req: AuthenticatedRequest, res) => {
    if (typeof req.body?.voiceResponsesEnabled === 'boolean') {
      db.hospitalSettings.voiceResponsesEnabled = req.body.voiceResponsesEnabled;
      appendAudit(
        req.authUser!.email,
        req.authUser!.role,
        'VOICE_PREFERENCE_UPDATED',
        String(db.hospitalSettings.voiceResponsesEnabled),
        'Allowed'
      );
      saveDatabase(db);
    }
    res.json({ voiceResponsesEnabled: db.hospitalSettings.voiceResponsesEnabled });
  });

  app.get('/api/hospital/modules/:module', requireAuth, (req, res) => {
    const mod = req.params.module as HospitalModuleKey;
    const validModules: HospitalModuleKey[] = [
      'radiology',
      'laboratory',
      'pharmacy',
      'billing',
      'insurance',
      'inventory',
      'sales',
      'marketing',
    ];
    if (!validModules.includes(mod)) {
      res.status(400).json({ error: 'Unknown hospital module.' });
      return;
    }
    res.json({ records: db.moduleRecords.filter((r) => r.module === mod) });
  });

  app.post('/api/hospital/modules/:module', requireAuth, (req: AuthenticatedRequest, res) => {
    const mod = req.params.module as HospitalModuleKey;
    const { title, subtitle, status, amountOrCount } = req.body ?? {};
    if (!title || !String(title).trim()) {
      res.status(400).json({ error: 'Title is required.' });
      return;
    }
    const prefixMap: Record<HospitalModuleKey, string> = {
      radiology: 'RAD',
      laboratory: 'LAB',
      pharmacy: 'RX',
      billing: 'INV',
      insurance: 'CLM',
      inventory: 'SKU',
      sales: 'CRM',
      marketing: 'CMP',
    };
    const rec: HospitalModuleRecord = {
      id: `mod-${crypto.randomUUID().slice(0, 8)}`,
      module: mod,
      referenceCode: `${prefixMap[mod] || 'REC'}-${1001 + db.moduleRecords.length}`,
      title: String(title).trim(),
      subtitle: String(subtitle || '').trim(),
      status:
        status === 'Pending Review' || status === 'Completed' || status === 'Flagged' ? status : 'Active',
      amountOrCount: amountOrCount ? String(amountOrCount).trim() : undefined,
      createdAt: new Date().toISOString(),
    };
    db.moduleRecords.unshift(rec);
    appendNotification(
      `${mod.charAt(0).toUpperCase() + mod.slice(1)} entry created`,
      `${rec.referenceCode} · ${rec.title}`,
      mod,
      rec.status === 'Flagged' ? 'warning' : 'info'
    );
    appendAudit(req.authUser!.email, req.authUser!.role, `MODULE_${mod.toUpperCase()}_CREATED`, rec.referenceCode, 'Allowed');
    saveDatabase(db);
    res.status(201).json({ record: rec });
  });

  app.patch('/api/hospital/modules/:module/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const rec = db.moduleRecords.find((r) => r.id === req.params.id && r.module === req.params.module);
    if (!rec) {
      res.status(404).json({ error: 'Record not found.' });
      return;
    }
    const nextStatus = req.body?.status;
    if (nextStatus && ['Active', 'Pending Review', 'Completed', 'Flagged'].includes(nextStatus)) {
      rec.status = nextStatus;
      appendAudit(req.authUser!.email, req.authUser!.role, 'MODULE_RECORD_UPDATED', rec.referenceCode, 'Allowed');
      saveDatabase(db);
    }
    res.json({ record: rec });
  });

  app.get('/api/patients', requireAuth, (_req, res) => {
    res.json({ patients: db.patients });
  });

  app.post('/api/patients', requireAuth, (req: AuthenticatedRequest, res) => {
    const { fullName, age, gender, phone, email, department, attendingDoctor, admissionStatus, wardBed, medicalSummary, allergies } = req.body ?? {};
    if (!fullName || !department || !attendingDoctor) {
      res.status(400).json({ error: 'Patient name, department, and attending physician are required.' });
      return;
    }
    const newPatient: PatientRecord = {
      id: `pat-${crypto.randomUUID().slice(0, 6)}`,
      mrn: `MRN-${10001 + db.patients.length}`,
      fullName: String(fullName).trim(),
      age: Number(age) || 40,
      gender: gender === 'Female' || gender === 'Male' ? gender : 'Other',
      phone: String(phone || 'Not provided').trim(),
      email: String(email || 'Not provided').trim(),
      department: String(department).trim(),
      attendingDoctor: String(attendingDoctor).trim(),
      admissionStatus: admissionStatus || 'Outpatient',
      wardBed: String(wardBed || `${String(department).slice(0, 5)}-Clinic`).trim(),
      lastVisit: getTodayDateString(),
      medicalSummary: String(medicalSummary || 'Registered in CareOS workspace.').trim(),
      allergies: Array.isArray(allergies) ? allergies : ['None reported'],
    };
    db.patients.unshift(newPatient);
    appendAudit(req.authUser!.email, req.authUser!.role, 'PATIENT_REGISTERED', newPatient.mrn, 'Allowed');
    saveDatabase(db);
    res.status(201).json({ patient: newPatient });
  });

  app.patch('/api/patients/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const idx = db.patients.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Patient record not found.' });
      return;
    }
    const { admissionStatus, wardBed, medicalSummary } = req.body ?? {};
    if (admissionStatus) db.patients[idx].admissionStatus = admissionStatus;
    if (wardBed) db.patients[idx].wardBed = String(wardBed);
    if (medicalSummary) db.patients[idx].medicalSummary = String(medicalSummary);
    appendAudit(req.authUser!.email, req.authUser!.role, 'PATIENT_UPDATED', db.patients[idx].mrn, 'Allowed');
    saveDatabase(db);
    res.json({ patient: db.patients[idx] });
  });

  app.get('/api/appointments', requireAuth, (_req, res) => {
    res.json({ appointments: db.appointments });
  });

  app.post('/api/appointments', requireAuth, (req: AuthenticatedRequest, res) => {
    const { patientId, patientName, mrn, doctorName, department, date, time, type, notes } = req.body ?? {};
    if (!patientName || !doctorName || !department || !date || !time) {
      res.status(400).json({ error: 'Patient, doctor, department, date, and time are required.' });
      return;
    }
    const newApt: AppointmentRecord = {
      id: `apt-${crypto.randomUUID().slice(0, 6)}`,
      patientId: String(patientId || 'pat-new'),
      patientName: String(patientName).trim(),
      mrn: String(mrn || 'MRN-NEW').trim(),
      doctorName: String(doctorName).trim(),
      department: String(department).trim(),
      date: String(date).trim(),
      time: String(time).trim(),
      type: type || 'Consultation',
      status: 'Scheduled',
      notes: String(notes || '').trim(),
    };
    db.appointments.unshift(newApt);
    appendAudit(req.authUser!.email, req.authUser!.role, 'APPOINTMENT_BOOKED', newApt.id, 'Allowed');
    saveDatabase(db);
    res.status(201).json({ appointment: newApt });
  });

  app.patch('/api/appointments/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const idx = db.appointments.findIndex((a) => a.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }
    const { status, date, time, notes } = req.body ?? {};
    if (status) db.appointments[idx].status = status;
    if (date) db.appointments[idx].date = String(date);
    if (time) db.appointments[idx].time = String(time);
    if (typeof notes === 'string') db.appointments[idx].notes = notes;
    appendAudit(req.authUser!.email, req.authUser!.role, `APPOINTMENT_${String(status || 'UPDATED').toUpperCase()}`, db.appointments[idx].id, 'Allowed');
    saveDatabase(db);
    res.json({ appointment: db.appointments[idx] });
  });

  app.get('/api/agents', requireAuth, (_req, res) => {
    res.json({ agents: db.agents });
  });

  app.patch('/api/agents/:id/status', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found.' });
      return;
    }
    const nextStatus = req.body?.status;
    if (nextStatus === 'Active' || nextStatus === 'Monitoring' || nextStatus === 'Paused') {
      agent.status = nextStatus;
      appendAudit(req.authUser!.email, 'admin', `AGENT_STATUS_${nextStatus.toUpperCase()}`, agent.name, 'Allowed');
      saveDatabase(db);
    }
    res.json({ agent });
  });

  app.post('/api/agents/:id/dispatch', requireAuth, (req: AuthenticatedRequest, res) => {
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found.' });
      return;
    }
    const { taskSummary, department } = req.body ?? {};
    const summary =
      typeof taskSummary === 'string' && taskSummary.trim()
        ? taskSummary.trim()
        : `Executed coordinated check across ${department || 'Platform Operations'}`;
    const dept = typeof department === 'string' && department.trim() ? department.trim() : 'Operations';

    agent.assignedTasks += 1;
    agent.completedTasks += 1;
    agent.avgResponseSeconds = 1.6;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    agent.recentActivity.unshift({
      id: `act-${crypto.randomUUID().slice(0, 6)}`,
      timestamp: nowTime,
      summary,
      department: dept,
      outcome: agent.id === 'agent-clinical' ? 'Awaiting Review' : 'Completed',
    });
    if (agent.recentActivity.length > 10) agent.recentActivity = agent.recentActivity.slice(0, 10);

    appendNotification(`${agent.name} completed task`, summary, dept, 'info');
    appendPlatformActivity(`${agent.name} dispatched: ${summary}`, 'system');
    appendAudit(req.authUser!.email, req.authUser!.role, 'AGENT_TASK_DISPATCHED', `${agent.id} (${dept})`, 'Allowed');
    saveDatabase(db);
    res.json({ agent });
  });

  app.get('/api/workflows', requireAuth, (_req, res) => {
    res.json({ workflows: db.workflows });
  });

  app.patch('/api/workflows/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const wf = db.workflows.find((w) => w.id === req.params.id);
    if (!wf) {
      res.status(404).json({ error: 'Workflow not found.' });
      return;
    }
    if (typeof req.body?.active === 'boolean') wf.active = req.body.active;
    if (typeof req.body?.requiresApproval === 'boolean') wf.requiresApproval = req.body.requiresApproval;
    appendAudit(req.authUser!.email, req.authUser!.role, 'WORKFLOW_UPDATED', wf.id, 'Allowed');
    saveDatabase(db);
    res.json({ workflow: wf });
  });

  app.post('/api/workflows/:id/trigger', requireAuth, (req: AuthenticatedRequest, res) => {
    const wf = db.workflows.find((w) => w.id === req.params.id);
    if (!wf) {
      res.status(404).json({ error: 'Workflow not found.' });
      return;
    }
    wf.executionsCount += 1;
    wf.lastRunAt = `Today, ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
    const linkedAgent = db.agents.find((a) => a.id === wf.agentId);
    if (linkedAgent) {
      linkedAgent.assignedTasks += 1;
      linkedAgent.completedTasks += 1;
      linkedAgent.recentActivity.unshift({
        id: `act-${crypto.randomUUID().slice(0, 6)}`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        summary: `Workflow run: ${wf.name}`,
        department: 'Automation',
        outcome: wf.requiresApproval ? 'Awaiting Review' : 'Completed',
      });
    }
    appendAudit(req.authUser!.email, req.authUser!.role, 'WORKFLOW_TRIGGERED', wf.name, 'Allowed');
    saveDatabase(db);
    res.json({ workflow: wf });
  });

  app.get('/api/departments', requireAuth, (_req, res) => {
    res.json({ departments: db.departments, staff: db.staff });
  });

  app.get('/api/resources', requireAuth, (_req, res) => {
    res.json({ resources: db.resources });
  });

  app.patch('/api/resources/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const item = db.resources.find((r) => r.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Resource pool not found.' });
      return;
    }
    const delta = Number(req.body?.allocateDelta || 0);
    if (delta !== 0) {
      const nextInUse = Math.max(0, Math.min(item.total - item.maintenance, item.inUse + delta));
      item.inUse = nextInUse;
      item.available = item.total - item.maintenance - item.inUse;
      appendAudit(req.authUser!.email, req.authUser!.role, 'RESOURCE_ALLOCATION_UPDATED', item.name, 'Allowed');
      saveDatabase(db);
    }
    res.json({ resource: item });
  });

  app.patch('/api/tasks/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const task = db.tasks.find((t) => t.id === req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (req.body?.status) task.status = req.body.status;
    appendAudit(req.authUser!.email, req.authUser!.role, 'TASK_STATUS_UPDATED', task.id, 'Allowed');
    saveDatabase(db);
    res.json({ task });
  });

  app.patch('/api/notifications/:id/read', requireAuth, (req, res) => {
    const notif = db.notifications.find((n) => n.id === req.params.id);
    if (notif) {
      notif.read = true;
      saveDatabase(db);
    }
    res.json({ ok: true });
  });

  app.get('/api/integrations', requireAuth, (_req, res) => {
    res.json({ integrations: db.integrations });
  });

  app.patch('/api/integrations/:id', requireAuth, (req: AuthenticatedRequest, res) => {
    const item = db.integrations.find((i) => i.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Integration not found.' });
      return;
    }
    if (item.availability === 'planned') {
      res.status(400).json({ error: `${item.name} is a planned ecosystem connector and cannot be activated yet.` });
      return;
    }
    item.connected = Boolean(req.body?.connected);
    appendAudit(req.authUser!.email, req.authUser!.role, item.connected ? 'INTEGRATION_CONNECTED' : 'INTEGRATION_DISCONNECTED', item.name, 'Allowed');
    saveDatabase(db);
    res.json({ integration: item });
  });

  app.get('/api/analytics', requireAuth, (_req, res) => {
    const sa = computeSuperAdminOverview();
    const totalBedsProvisioned = db.hospitals.reduce((sum, h) => sum + h.bedsCount, 0);
    const totalDeptsProvisioned = db.hospitals.reduce((sum, h) => sum + h.departmentsCount, 0);
    const mrrUsd = db.subscriptions.filter((s) => s.status === 'Active').reduce((sum, s) => sum + s.monthlyPriceUsd, 0);

    res.json({
      metrics: sa.metrics,
      totalBedsProvisioned,
      totalDeptsProvisioned,
      mrrUsd,
      monthlyGrowth: sa.monthlyGrowth,
      applicationOverview: sa.applicationOverview,
      hospitals: db.hospitals,
      agentPerformance: db.agents.map((a) => ({
        id: a.id,
        name: a.shortName,
        completed: a.completedTasks,
        pending: a.pendingTasks,
        completionRate: a.assignedTasks > 0 ? Math.round((a.completedTasks / a.assignedTasks) * 100) : 0,
        avgResponseSeconds: a.avgResponseSeconds,
      })),
    });
  });

  // Administrator-only Users, Audit Logs, Settings
  app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
    const safeUsers = db.users
      .filter((u) => u.role !== 'admin')
      .map(({ passwordHash: _omitted, ...u }) => u);
    res.json({ users: safeUsers });
  });

  app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { role, status } = req.body ?? {};
    if (role && ['admin', 'coordinator', 'clinician', 'operator'].includes(role)) {
      target.role = role as UserRole;
      appendAudit(req.authUser!.email, 'admin', `USER_ROLE_CHANGED_TO_${String(role).toUpperCase()}`, target.email, 'Allowed');
    }
    if (status && ['active', 'pending', 'suspended'].includes(status)) {
      target.status = status;
      appendAudit(req.authUser!.email, 'admin', `USER_STATUS_CHANGED_TO_${String(status).toUpperCase()}`, target.email, 'Allowed');
    }
    saveDatabase(db);
    const { passwordHash: _omitted, ...safeUser } = target;
    res.json({ user: safeUser });
  });

  app.get('/api/admin/audit-logs', requireAuth, requireAdmin, (_req, res) => {
    res.json({ logs: db.auditLogs });
  });

  app.patch('/api/admin/settings', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const { hospitalName, timezone, humanOversightRequired, sessionTimeoutMinutes } = req.body ?? {};
    if (typeof hospitalName === 'string' && hospitalName.trim()) {
      db.hospitalSettings.hospitalName = hospitalName.trim();
    }
    if (typeof timezone === 'string' && timezone.trim()) {
      db.hospitalSettings.timezone = timezone.trim();
    }
    if (typeof humanOversightRequired === 'boolean') {
      db.hospitalSettings.humanOversightRequired = humanOversightRequired;
    }
    if (typeof sessionTimeoutMinutes === 'number' && sessionTimeoutMinutes >= 15) {
      db.hospitalSettings.sessionTimeoutMinutes = sessionTimeoutMinutes;
    }
    appendAudit(req.authUser!.email, 'admin', 'PLATFORM_SETTINGS_UPDATED', 'system-settings', 'Allowed');
    saveDatabase(db);
    res.json({ hospitalSettings: db.hospitalSettings });
  });

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CareOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
