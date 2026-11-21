import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  AgentProfile,
  ApplicationStatus,
  AppointmentRecord,
  ApprovedHospital,
  AuditLogEntry,
  AuthUser,
  DepartmentRecord,
  HospitalApplication,
  HospitalNotification,
  IntegrationItem,
  OperationalTask,
  PatientRecord,
  PlatformActivityItem,
  ResourceItem,
  StaffMember,
  SubscriptionPlan,
  SubscriptionRecord,
  UserRole,
  WorkflowDefinition,
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

  return {
    users: [seededAdmin],
    applications: [],
    hospitals: [],
    subscriptions: [],
    platformActivity: [],
    hospitalSettings: {
      hospitalName: 'CareOS Platform',
      timezone: 'America/Los_Angeles',
      humanOversightRequired: true,
      sessionTimeoutMinutes: 480,
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
    // Ensure seeded admin exists if file was empty/legacy
    if (!parsed.users.some((u) => u.role === 'admin')) {
      parsed.users.unshift(createInitialDatabase().users[0]);
      saveDatabase(parsed);
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
  const totalUsers = db.users.filter((u) => u.role !== 'admin').length;
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
    },
    appointmentTrends,
    patientFlowStages,
    departments: db.departments,
    agents: db.agents,
    tasks: db.tasks,
    notifications: db.notifications,
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

  // Login
  app.post('/api/auth/login', async (req, res) => {
    const { email, password, rememberMe } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!cleanEmail || !rawPassword) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const ttlSeconds = rememberMe ? 7 * 24 * 3600 : 8 * 3600;
    const envAdmin = getEnvAdminCredentials();

    if (envAdmin && cleanEmail === envAdmin.email) {
      const a = Buffer.from(rawPassword);
      const b = Buffer.from(envAdmin.password);
      const match = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!match) {
        appendAudit(cleanEmail, 'unknown', 'LOGIN_FAILED', 'auth/login', 'Denied');
        saveDatabase(db);
        res.status(401).json({ error: 'Invalid email or password.' });
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

    const user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
    if (!user) {
      appendAudit(cleanEmail, 'unknown', 'LOGIN_FAILED', 'auth/login', 'Denied');
      saveDatabase(db);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const valid = await verifyPassword(rawPassword, user.passwordHash);
    if (!valid) {
      appendAudit(cleanEmail, user.role, 'LOGIN_FAILED', 'auth/login', 'Denied');
      saveDatabase(db);
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    if (user.status === 'suspended') {
      appendAudit(cleanEmail, user.role, 'LOGIN_SUSPENDED_BLOCKED', 'auth/login', 'Denied');
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

    // Activate any linked applicant user
    const linkedUsers = db.users.filter(
      (u) => u.id === appRecord.applicantUserId || u.email.toLowerCase() === appRecord.email.toLowerCase()
    );
    linkedUsers.forEach((u) => {
      u.status = 'active';
      u.hospitalId = hospitalId;
    });

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
      activeUsersCount: Math.max(linkedUsers.length, 1),
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

    // Provision default departments & beds for the hospital ecosystem if empty
    if (db.departments.length === 0) {
      db.departments = [
        { id: 'dept-cardio', name: 'Cardiology', head: appRecord.contactPerson, activePatients: 0, staffOnDuty: 0, totalStaff: 0, bedCapacity: Math.max(10, Math.round(appRecord.bedsCount * 0.2)), occupiedBeds: 0, avgWaitMinutes: 0, status: 'Nominal' },
        { id: 'dept-er', name: 'Emergency', head: appRecord.contactPerson, activePatients: 0, staffOnDuty: 0, totalStaff: 0, bedCapacity: Math.max(10, Math.round(appRecord.bedsCount * 0.15)), occupiedBeds: 0, avgWaitMinutes: 0, status: 'Nominal' },
        { id: 'dept-gen', name: 'General Medicine', head: appRecord.contactPerson, activePatients: 0, staffOnDuty: 0, totalStaff: 0, bedCapacity: Math.max(20, Math.round(appRecord.bedsCount * 0.4)), occupiedBeds: 0, avgWaitMinutes: 0, status: 'Nominal' },
      ];
    }

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

    res.json({ application: appRecord, hospital: approvedHospital, subscription: sub });
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
      const chosenPlan: SubscriptionPlan = plan === 'Starter' || plan === 'Pro' ? plan : 'Enterprise';
      const hospitalId = `HSP-${String(1 + db.hospitals.length).padStart(5, '0')}`;
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
      res.status(201).json({ application: appRecord, hospital: hsp });
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
