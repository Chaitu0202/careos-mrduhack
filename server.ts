import 'dotenv/config';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import type {
  AgentProfile,
  AppointmentRecord,
  AuditLogEntry,
  AuthUser,
  DepartmentRecord,
  HospitalNotification,
  IntegrationItem,
  OperationalTask,
  PatientRecord,
  ResourceItem,
  StaffMember,
  UserRole,
  WorkflowDefinition,
} from './src/types/careos.ts';

interface StoredUser extends AuthUser {
  passwordHash: string;
}

interface InquiryRecord {
  id: string;
  type: 'demo' | 'contact';
  name: string;
  email: string;
  organization: string;
  roleOrType: string;
  message: string;
  createdAt: string;
}

interface CareOSDatabase {
  users: StoredUser[];
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
  inquiries: InquiryRecord[];
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

// Session signing key from environment or ephemeral 256-bit secret in memory
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

function createInitialDatabase(): CareOSDatabase {
  const today = getTodayDateString();
  return {
    users: [],
    hospitalSettings: {
      hospitalName: 'Meridian General Medical Center (Sample)',
      timezone: 'America/Los_Angeles',
      humanOversightRequired: true,
      sessionTimeoutMinutes: 480,
    },
    patients: [
      {
        id: 'pat-101',
        mrn: 'MRN-40821',
        fullName: 'Eleanor Vance',
        age: 64,
        gender: 'Female',
        phone: '+1 (415) 555-0142',
        email: 'e.vance@sample-patient.org',
        department: 'Cardiology',
        attendingDoctor: 'Dr. Marcus Chen',
        admissionStatus: 'Admitted',
        wardBed: 'Cardio-3B · Bed 12',
        lastVisit: today,
        medicalSummary: 'Post-angioplasty telemetry observation; stable sinus rhythm, BP 124/78 mmHg.',
        allergies: ['Penicillin'],
        isSample: true,
      },
      {
        id: 'pat-102',
        mrn: 'MRN-40822',
        fullName: 'David Morales',
        age: 41,
        gender: 'Male',
        phone: '+1 (415) 555-0189',
        email: 'd.morales@sample-patient.org',
        department: 'Orthopedics',
        attendingDoctor: 'Dr. Hannah Patel',
        admissionStatus: 'Outpatient',
        wardBed: 'Clinic Wing A',
        lastVisit: today,
        medicalSummary: 'ACL reconstruction 6-week follow-up; mobility progressing on schedule.',
        allergies: ['None reported'],
        isSample: true,
      },
      {
        id: 'pat-103',
        mrn: 'MRN-40823',
        fullName: 'Amina Al-Mansoor',
        age: 29,
        gender: 'Female',
        phone: '+1 (415) 555-0194',
        email: 'a.mansoor@sample-patient.org',
        department: 'Emergency',
        attendingDoctor: 'Dr. Liam O’Connor',
        admissionStatus: 'ICU Observation',
        wardBed: 'ICU-North · Bay 04',
        lastVisit: today,
        medicalSummary: 'Acute respiratory distress stabilized; SpO2 97% on room air, awaiting pulmonology consult.',
        allergies: ['Sulfa drugs'],
        isSample: true,
      },
      {
        id: 'pat-104',
        mrn: 'MRN-40824',
        fullName: 'Robert Takahashi',
        age: 72,
        gender: 'Male',
        phone: '+1 (415) 555-0117',
        email: 'r.takahashi@sample-patient.org',
        department: 'Neurology',
        attendingDoctor: 'Dr. Sarah Jenkins',
        admissionStatus: 'Admitted',
        wardBed: 'Neuro-2A · Bed 07',
        lastVisit: today,
        medicalSummary: 'Transient ischemic attack workup; MRI completed, antiplatelet regimen initiated.',
        allergies: ['Latex'],
        isSample: true,
      },
      {
        id: 'pat-105',
        mrn: 'MRN-40825',
        fullName: 'Clara Lindqvist',
        age: 8,
        gender: 'Female',
        phone: '+1 (415) 555-0165',
        email: 'parent.lindqvist@sample-patient.org',
        department: 'Pediatrics',
        attendingDoctor: 'Dr. Priya Nair',
        admissionStatus: 'Pre-Admission',
        wardBed: 'Peds-Day Unit 02',
        lastVisit: today,
        medicalSummary: 'Scheduled pediatric tonsillectomy pre-operative clearance completed.',
        allergies: ['None reported'],
        isSample: true,
      },
      {
        id: 'pat-106',
        mrn: 'MRN-40826',
        fullName: 'Samuel Okafor',
        age: 55,
        gender: 'Male',
        phone: '+1 (415) 555-0133',
        email: 's.okafor@sample-patient.org',
        department: 'General Medicine',
        attendingDoctor: 'Dr. Elena Rostova',
        admissionStatus: 'Discharged',
        wardBed: 'Discharged · Home Care',
        lastVisit: today,
        medicalSummary: 'Type 2 diabetes glycemic stabilization completed; outpatient follow-up booked in 14 days.',
        allergies: ['Aspirin'],
        isSample: true,
      },
      {
        id: 'pat-107',
        mrn: 'MRN-40827',
        fullName: 'Mei-Ling Zhou',
        age: 48,
        gender: 'Female',
        phone: '+1 (415) 555-0171',
        email: 'm.zhou@sample-patient.org',
        department: 'Cardiology',
        attendingDoctor: 'Dr. Marcus Chen',
        admissionStatus: 'Outpatient',
        wardBed: 'Cardio Diagnostics',
        lastVisit: today,
        medicalSummary: 'Echocardiogram and stress test evaluation for intermittent palpitations.',
        allergies: ['Iodine contrast'],
        isSample: true,
      },
      {
        id: 'pat-108',
        mrn: 'MRN-40828',
        fullName: 'Thomas Gallagher',
        age: 61,
        gender: 'Male',
        phone: '+1 (415) 555-0158',
        email: 't.gallagher@sample-patient.org',
        department: 'Orthopedics',
        attendingDoctor: 'Dr. Hannah Patel',
        admissionStatus: 'Admitted',
        wardBed: 'Ortho-4C · Bed 09',
        lastVisit: today,
        medicalSummary: 'Day 2 post-total knee arthroplasty; physical therapy milestone achieved.',
        allergies: ['Codeine'],
        isSample: true,
      },
    ],
    appointments: [
      {
        id: 'apt-201',
        patientId: 'pat-107',
        patientName: 'Mei-Ling Zhou',
        mrn: 'MRN-40827',
        doctorName: 'Dr. Marcus Chen',
        department: 'Cardiology',
        date: today,
        time: '09:00',
        type: 'Diagnostic',
        status: 'Completed',
        notes: 'Transthoracic echocardiogram completed and summarized.',
        isSample: true,
      },
      {
        id: 'apt-202',
        patientId: 'pat-102',
        patientName: 'David Morales',
        mrn: 'MRN-40822',
        doctorName: 'Dr. Hannah Patel',
        department: 'Orthopedics',
        date: today,
        time: '10:30',
        type: 'Follow-up',
        status: 'In Progress',
        notes: 'Range-of-motion assessment and physiotherapy progression.',
        isSample: true,
      },
      {
        id: 'apt-203',
        patientId: 'pat-105',
        patientName: 'Clara Lindqvist',
        mrn: 'MRN-40825',
        doctorName: 'Dr. Priya Nair',
        department: 'Pediatrics',
        date: today,
        time: '11:15',
        type: 'Procedure',
        status: 'Checked In',
        notes: 'Pre-op anesthesia verification complete.',
        isSample: true,
      },
      {
        id: 'apt-204',
        patientId: 'pat-101',
        patientName: 'Eleanor Vance',
        mrn: 'MRN-40821',
        doctorName: 'Dr. Marcus Chen',
        department: 'Cardiology',
        date: today,
        time: '13:00',
        type: 'Consultation',
        status: 'Scheduled',
        notes: 'Afternoon ward round and telemetry discharge evaluation.',
        isSample: true,
      },
      {
        id: 'apt-205',
        patientId: 'pat-104',
        patientName: 'Robert Takahashi',
        mrn: 'MRN-40824',
        doctorName: 'Dr. Sarah Jenkins',
        department: 'Neurology',
        date: today,
        time: '14:30',
        type: 'Follow-up',
        status: 'Scheduled',
        notes: 'Review brain MRI perfusion report with neurology team.',
        isSample: true,
      },
      {
        id: 'apt-206',
        patientId: 'pat-106',
        patientName: 'Samuel Okafor',
        mrn: 'MRN-40826',
        doctorName: 'Dr. Elena Rostova',
        department: 'General Medicine',
        date: today,
        time: '16:00',
        type: 'Telehealth',
        status: 'Scheduled',
        notes: 'Remote post-discharge glucose log check-in.',
        isSample: true,
      },
    ],
    departments: [
      {
        id: 'dept-cardio',
        name: 'Cardiology',
        head: 'Dr. Marcus Chen',
        activePatients: 34,
        staffOnDuty: 18,
        totalStaff: 22,
        bedCapacity: 40,
        occupiedBeds: 31,
        avgWaitMinutes: 11,
        status: 'Nominal',
      },
      {
        id: 'dept-er',
        name: 'Emergency',
        head: 'Dr. Liam O’Connor',
        activePatients: 29,
        staffOnDuty: 24,
        totalStaff: 26,
        bedCapacity: 32,
        occupiedBeds: 27,
        avgWaitMinutes: 16,
        status: 'Elevated',
      },
      {
        id: 'dept-neuro',
        name: 'Neurology',
        head: 'Dr. Sarah Jenkins',
        activePatients: 21,
        staffOnDuty: 14,
        totalStaff: 16,
        bedCapacity: 28,
        occupiedBeds: 19,
        avgWaitMinutes: 9,
        status: 'Nominal',
      },
      {
        id: 'dept-ortho',
        name: 'Orthopedics',
        head: 'Dr. Hannah Patel',
        activePatients: 26,
        staffOnDuty: 15,
        totalStaff: 18,
        bedCapacity: 30,
        occupiedBeds: 22,
        avgWaitMinutes: 13,
        status: 'Nominal',
      },
      {
        id: 'dept-peds',
        name: 'Pediatrics',
        head: 'Dr. Priya Nair',
        activePatients: 18,
        staffOnDuty: 16,
        totalStaff: 19,
        bedCapacity: 26,
        occupiedBeds: 14,
        avgWaitMinutes: 8,
        status: 'Nominal',
      },
      {
        id: 'dept-genmed',
        name: 'General Medicine',
        head: 'Dr. Elena Rostova',
        activePatients: 42,
        staffOnDuty: 21,
        totalStaff: 25,
        bedCapacity: 54,
        occupiedBeds: 43,
        avgWaitMinutes: 14,
        status: 'Elevated',
      },
    ],
    resources: [
      { id: 'res-1', name: 'ICU Critical Care Beds', category: 'Beds', department: 'Emergency & ICU', total: 36, available: 6, inUse: 28, maintenance: 2 },
      { id: 'res-2', name: 'General Inpatient Beds', category: 'Beds', department: 'General Medicine', total: 120, available: 28, inUse: 88, maintenance: 4 },
      { id: 'res-3', name: 'Telemetry Monitored Beds', category: 'Beds', department: 'Cardiology', total: 54, available: 14, inUse: 38, maintenance: 2 },
      { id: 'res-4', name: 'Mechanical Ventilators', category: 'Critical Equipment', department: 'Respiratory / ICU', total: 28, available: 11, inUse: 16, maintenance: 1 },
      { id: 'res-5', name: 'Portable Ultrasound Units', category: 'Critical Equipment', department: 'Emergency', total: 14, available: 5, inUse: 9, maintenance: 0 },
      { id: 'res-6', name: 'MRI & CT Imaging Suites', category: 'Diagnostic Suites', department: 'Radiology', total: 6, available: 2, inUse: 4, maintenance: 0 },
      { id: 'res-7', name: 'Surgical Operating Suites', category: 'Operating Rooms', department: 'Surgery', total: 12, available: 4, inUse: 7, maintenance: 1 },
    ],
    agents: [
      {
        id: 'agent-patient',
        name: 'Patient Intelligence Agent',
        shortName: 'Patient Intel',
        category: 'Front-Door & Intake',
        description: 'Coordinates patient onboarding, pre-visit intake, appointment confirmations, and multilingual chat or voice inquiries.',
        highlights: ['Patient onboarding', 'Appointment coordination', 'Voice and chat interactions'],
        status: 'Active',
        assignedTasks: 148,
        completedTasks: 139,
        pendingTasks: 9,
        avgResponseSeconds: 1.8,
        recentActivity: [
          { id: 'act-1', timestamp: '10:42 AM', summary: 'Verified pre-admission intake questionnaire for Clara Lindqvist', department: 'Pediatrics', outcome: 'Completed' },
          { id: 'act-2', timestamp: '10:19 AM', summary: 'Confirmed afternoon telehealth slot with Samuel Okafor', department: 'General Medicine', outcome: 'Completed' },
        ],
      },
      {
        id: 'agent-clinical',
        name: 'Clinical Intelligence Agent',
        shortName: 'Clinical Intel',
        category: 'Clinical Documentation',
        description: 'Synthesizes longitudinal medical records, retrieves relevant history before consults, and drafts structured clinical notes for clinician sign-off.',
        highlights: ['Medical record summaries', 'Patient history retrieval', 'Clinical documentation assistance'],
        status: 'Active',
        assignedTasks: 96,
        completedTasks: 91,
        pendingTasks: 5,
        avgResponseSeconds: 2.4,
        recentActivity: [
          { id: 'act-3', timestamp: '10:35 AM', summary: 'Compiled 12-month cardiac telemetry summary for Dr. Marcus Chen', department: 'Cardiology', outcome: 'Awaiting Review' },
          { id: 'act-4', timestamp: '09:50 AM', summary: 'Structured MRI perfusion pre-read brief for neurology consult', department: 'Neurology', outcome: 'Completed' },
        ],
      },
      {
        id: 'agent-flow',
        name: 'Patient Flow Agent',
        shortName: 'Patient Flow',
        category: 'Throughput & Routing',
        description: 'Coordinates outpatient queues, triage handoffs, inpatient admissions, and discharge readiness across clinical wards.',
        highlights: ['Queue coordination', 'Admission and discharge workflows', 'Patient journey coordination'],
        status: 'Active',
        assignedTasks: 112,
        completedTasks: 104,
        pendingTasks: 8,
        avgResponseSeconds: 1.5,
        recentActivity: [
          { id: 'act-5', timestamp: '10:48 AM', summary: 'Triggered discharge clearance checklist for Ward 3B Bed 12', department: 'Cardiology', outcome: 'Awaiting Review' },
          { id: 'act-6', timestamp: '10:05 AM', summary: 'Rebalanced Emergency triage queue to Fast-Track Bay 2', department: 'Emergency', outcome: 'Completed' },
        ],
      },
      {
        id: 'agent-operations',
        name: 'Operations Intelligence Agent',
        shortName: 'Operations Intel',
        category: 'Shift & Task Coordination',
        description: 'Orchestrates inter-department operational tasks, shift handoff rosters, and early detection of clinical bottlenecks.',
        highlights: ['Staff coordination', 'Operational tasks', 'Bottleneck identification'],
        status: 'Active',
        assignedTasks: 84,
        completedTasks: 77,
        pendingTasks: 7,
        avgResponseSeconds: 2.1,
        recentActivity: [
          { id: 'act-7', timestamp: '10:30 AM', summary: 'Flagged elevated Radiology transport queue and dispatched porter shift', department: 'Emergency', outcome: 'Completed' },
          { id: 'act-8', timestamp: '09:40 AM', summary: 'Synchronized morning nursing shift handoff across 6 departments', department: 'General Medicine', outcome: 'Completed' },
        ],
      },
      {
        id: 'agent-resource',
        name: 'Resource Intelligence Agent',
        shortName: 'Resource Intel',
        category: 'Capacity & Assets',
        description: 'Tracks real-time bed turnover, critical equipment readiness, operating room utilization, and sterilization schedules.',
        highlights: ['Bed availability', 'Equipment tracking', 'Resource utilization'],
        status: 'Active',
        assignedTasks: 73,
        completedTasks: 69,
        pendingTasks: 4,
        avgResponseSeconds: 1.9,
        recentActivity: [
          { id: 'act-9', timestamp: '10:44 AM', summary: 'Marked ICU-North Bay 02 sanitized and ready for incoming transfer', department: 'Emergency', outcome: 'Completed' },
          { id: 'act-10', timestamp: '09:58 AM', summary: 'Assigned portable ultrasound unit #4 to Cardiology Diagnostics', department: 'Cardiology', outcome: 'Completed' },
        ],
      },
      {
        id: 'agent-hospital',
        name: 'Hospital Intelligence Agent',
        shortName: 'Hospital Intel',
        category: 'Executive Analytics',
        description: 'Aggregates cross-department operational patterns into executive forecasts, wait-time insights, and capacity recommendations.',
        highlights: ['Hospital analytics', 'Performance insights', 'Cross-department intelligence'],
        status: 'Monitoring',
        assignedTasks: 45,
        completedTasks: 43,
        pendingTasks: 2,
        avgResponseSeconds: 3.1,
        recentActivity: [
          { id: 'act-11', timestamp: '10:15 AM', summary: 'Published morning hospital occupancy & throughput digest', department: 'Executive', outcome: 'Completed' },
          { id: 'act-12', timestamp: '08:30 AM', summary: 'Identified 18% reduction in Cardiology clinic turnaround time', department: 'Cardiology', outcome: 'Completed' },
        ],
      },
    ],
    workflows: [
      {
        id: 'wf-1',
        name: 'Automated Inpatient Discharge & Bed Turnover',
        description: 'Coordinates clinician discharge sign-off, pharmacy reconciliation, environmental services cleaning, and bed availability updates.',
        trigger: 'Attending marks patient ready for discharge',
        condition: 'Lab & medication reconciliation verified',
        agentId: 'agent-flow',
        agentName: 'Patient Flow Agent',
        action: 'Notify Environmental Services & reserve bed for ED boarding queue',
        requiresApproval: true,
        completionOutcome: 'Bed status updated to Available and incoming admission routed',
        active: true,
        executionsCount: 38,
        lastRunAt: 'Today, 10:18 AM',
      },
      {
        id: 'wf-2',
        name: 'Pre-Consultation Clinical Brief Generation',
        description: 'Compiles recent labs, imaging reports, and allergy alerts 30 minutes prior to specialist consultation.',
        trigger: 'Patient checks in for specialist appointment',
        condition: 'Prior records or external labs exist in profile',
        agentId: 'agent-clinical',
        agentName: 'Clinical Intelligence Agent',
        action: 'Assemble structured 1-page pre-consult clinical summary',
        requiresApproval: true,
        completionOutcome: 'Brief attached to attending physician schedule for review',
        active: true,
        executionsCount: 64,
        lastRunAt: 'Today, 10:35 AM',
      },
      {
        id: 'wf-3',
        name: 'Emergency Surge Staffing & Equipment Rebalance',
        description: 'Monitors ED bay occupancy and notifies nursing supervisor and transport pool when threshold exceeds 82%.',
        trigger: 'Emergency occupancy exceeds 82% for 15 minutes',
        condition: 'Adjacent general wards have >= 4 open beds',
        agentId: 'agent-operations',
        agentName: 'Operations Intelligence Agent',
        action: 'Propose float nurse reallocation and prioritize telemetry transport',
        requiresApproval: true,
        completionOutcome: 'Supervisor approves shift rebalance and transport queue clears',
        active: true,
        executionsCount: 11,
        lastRunAt: 'Today, 09:42 AM',
      },
      {
        id: 'wf-4',
        name: 'Outpatient Intake & Pre-Visit Reminder Sequence',
        description: 'Collects digital intake forms and confirms attendance 24 hours before scheduled diagnostic or clinic visits.',
        trigger: '24 hours prior to scheduled appointment',
        condition: 'Intake packet incomplete or unconfirmed',
        agentId: 'agent-patient',
        agentName: 'Patient Intelligence Agent',
        action: 'Send consent-aware reminder and intake link via preferred channel',
        requiresApproval: false,
        completionOutcome: 'Appointment confirmed and pre-visit questionnaire synced',
        active: true,
        executionsCount: 142,
        lastRunAt: 'Today, 08:00 AM',
      },
    ],
    integrations: [
      {
        id: 'int-rest',
        name: 'CareOS REST & Webhook API',
        category: 'APIs & Third-Party Apps',
        availability: 'supported',
        description: 'Authenticated JSON REST endpoints and event webhooks for hospital systems and custom extensions.',
        protocol: 'HTTPS / JSON / Bearer Auth',
        connected: true,
      },
      {
        id: 'int-fhir',
        name: 'HL7 FHIR R4 Data Adapter',
        category: 'EMR & EHR Platforms',
        availability: 'supported',
        description: 'Standards-based FHIR R4 schema mapper for patient demographics, appointments, and encounter synchronization.',
        protocol: 'FHIR R4 REST',
        connected: true,
      },
      {
        id: 'int-calendar',
        name: 'Clinician Calendar Sync (iCal / CalDAV)',
        category: 'Calendar & Scheduling',
        availability: 'supported',
        description: 'Two-way shift and outpatient appointment schedule synchronization with institutional calendars.',
        protocol: 'CalDAV / iCalendar',
        connected: true,
      },
      {
        id: 'int-his',
        name: 'Enterprise HIS Connectors (SAP / Oracle Health)',
        category: 'HIS & Hospital Management',
        availability: 'planned',
        description: 'Direct bi-directional hospital billing, ADT, and ward management bridge for legacy HIS deployments.',
        protocol: 'HL7 v2 / MLLP',
        connected: false,
      },
      {
        id: 'int-epic',
        name: 'Epic & Cerner App Orchard Connectors',
        category: 'EMR & EHR Platforms',
        availability: 'planned',
        description: 'Certified SMART on FHIR embedded launch inside enterprise inpatient EHR workspaces.',
        protocol: 'SMART on FHIR',
        connected: false,
      },
      {
        id: 'int-telephony',
        name: 'Hospital PBX & SIP Voice Gateway',
        category: 'Telephony Systems',
        availability: 'planned',
        description: 'Direct SIP trunk routing for automated patient triage and appointment rescheduling calls.',
        protocol: 'SIP / WebRTC',
        connected: false,
      },
      {
        id: 'int-whatsapp',
        name: 'WhatsApp Business & SMS Care Channel',
        category: 'WhatsApp & Messaging',
        availability: 'planned',
        description: 'Opt-in patient appointment reminders and post-discharge check-in messaging.',
        protocol: 'WhatsApp Cloud API',
        connected: false,
      },
    ],
    tasks: [
      {
        id: 'tsk-1',
        title: 'Approve Cardiology Ward 3B Bed 12 discharge turnover',
        department: 'Cardiology',
        assignedAgent: 'Patient Flow Agent',
        priority: 'High',
        status: 'Pending',
        dueTime: '11:30 AM',
      },
      {
        id: 'tsk-2',
        title: 'Review AI-drafted cardiac telemetry summary for MRN-40821',
        department: 'Cardiology',
        assignedAgent: 'Clinical Intelligence Agent',
        priority: 'Normal',
        status: 'In Progress',
        dueTime: '12:15 PM',
      },
      {
        id: 'tsk-3',
        title: 'Confirm float RN assignment for Emergency afternoon surge',
        department: 'Emergency',
        assignedAgent: 'Operations Intelligence Agent',
        priority: 'Urgent',
        status: 'Pending',
        dueTime: '11:45 AM',
      },
      {
        id: 'tsk-4',
        title: 'Verify pediatric pre-op consent packet for Clara Lindqvist',
        department: 'Pediatrics',
        assignedAgent: 'Patient Intelligence Agent',
        priority: 'Normal',
        status: 'Completed',
        dueTime: '10:30 AM',
      },
    ],
    notifications: [
      {
        id: 'not-1',
        title: 'Emergency Department capacity at 84%',
        detail: 'Operations Intelligence Agent prepared a float staffing recommendation for supervisor review.',
        department: 'Emergency',
        severity: 'warning',
        timestamp: '12 mins ago',
        read: false,
      },
      {
        id: 'not-2',
        title: 'Clinical brief ready for review',
        detail: 'Pre-consult summary for Eleanor Vance (MRN-40821) is awaiting attending clinician sign-off.',
        department: 'Cardiology',
        severity: 'info',
        timestamp: '28 mins ago',
        read: false,
      },
      {
        id: 'not-3',
        title: 'ICU-North Bay 02 cleared for transfer',
        detail: 'Environmental Services completed terminal sanitization; bed marked available.',
        department: 'Emergency',
        severity: 'info',
        timestamp: '54 mins ago',
        read: true,
      },
    ],
    staff: [
      { id: 'stf-1', name: 'Dr. Marcus Chen', role: 'Chief of Cardiology', department: 'Cardiology', shift: '07:00 – 19:00', availability: 'On Duty', activeCases: 8 },
      { id: 'stf-2', name: 'Dr. Liam O’Connor', role: 'Emergency Attending', department: 'Emergency', shift: '08:00 – 20:00', availability: 'On Duty', activeCases: 11 },
      { id: 'stf-3', name: 'Dr. Sarah Jenkins', role: 'Senior Neurologist', department: 'Neurology', shift: '08:00 – 17:00', availability: 'In Procedure', activeCases: 6 },
      { id: 'stf-4', name: 'Dr. Hannah Patel', role: 'Orthopedic Surgeon', department: 'Orthopedics', shift: '07:30 – 18:30', availability: 'On Duty', activeCases: 7 },
      { id: 'stf-5', name: 'Dr. Priya Nair', role: 'Pediatric Specialist', department: 'Pediatrics', shift: '08:00 – 16:30', availability: 'On Duty', activeCases: 5 },
      { id: 'stf-6', name: 'Dr. Elena Rostova', role: 'Internal Medicine Lead', department: 'General Medicine', shift: '09:00 – 19:00', availability: 'On Call', activeCases: 9 },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        timestamp: new Date(Date.now() - 3600_000).toISOString(),
        actorEmail: 'system@careos.internal',
        actorRole: 'system',
        action: 'SAMPLE_DATASET_INITIALIZED',
        resource: 'careos-hospital-sample',
        outcome: 'Allowed',
      },
      {
        id: 'aud-2',
        timestamp: new Date(Date.now() - 1800_000).toISOString(),
        actorEmail: 'agent-clinical@careos.internal',
        actorRole: 'agent',
        action: 'CLINICAL_BRIEF_DRAFTED_FOR_HUMAN_REVIEW',
        resource: 'MRN-40821',
        outcome: 'Allowed',
      },
    ],
    inquiries: [],
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
    return JSON.parse(raw) as CareOSDatabase;
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

function appendAudit(actorEmail: string, actorRole: string, action: string, resource: string, outcome: 'Allowed' | 'Denied' = 'Allowed') {
  db.auditLogs.unshift({
    id: `aud-${crypto.randomUUID().slice(0, 8)}`,
    timestamp: new Date().toISOString(),
    actorEmail,
    actorRole,
    action,
    resource,
    outcome,
  });
  if (db.auditLogs.length > 200) {
    db.auditLogs = db.auditLogs.slice(0, 200);
  }
}

function getEnvAdminCredentials(): { email: string; password: string } | null {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || !password) return null;
  return { email, password };
}

function isAdminClaimed(): boolean {
  return Boolean(getEnvAdminCredentials()) || db.users.some((u) => u.role === 'admin');
}

function computeOverview(range: string) {
  const totalPatients = db.patients.length;
  const today = getTodayDateString();
  const todaysAppointments = db.appointments.filter((a) => a.date === today || range !== 'today').length;
  const activeAdmissions = db.patients.filter((p) => p.admissionStatus === 'Admitted' || p.admissionStatus === 'ICU Observation').length;
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

  const multiplier = range === '30d' ? 4 : range === '7d' ? 2 : 1;
  const appointmentTrends = [
    { label: '08:00', scheduled: 14 * multiplier, completed: 14 * multiplier, walkIn: 3 * multiplier },
    { label: '10:00', scheduled: 22 * multiplier, completed: 19 * multiplier, walkIn: 5 * multiplier },
    { label: '12:00', scheduled: 18 * multiplier, completed: 14 * multiplier, walkIn: 4 * multiplier },
    { label: '14:00', scheduled: 24 * multiplier, completed: 11 * multiplier, walkIn: 6 * multiplier },
    { label: '16:00', scheduled: 16 * multiplier, completed: 4 * multiplier, walkIn: 2 * multiplier },
  ];

  const patientFlowStages = [
    { stage: 'Intake & Check-in', count: db.appointments.filter((a) => a.status === 'Checked In').length + 12, avgMinutes: 6 },
    { stage: 'Triage & Pre-Consult', count: db.appointments.filter((a) => a.status === 'In Progress').length + 9, avgMinutes: 11 },
    { stage: 'Active Care / Ward', count: activeAdmissions + 18, avgMinutes: 42 },
    { stage: 'Discharge Readiness', count: db.patients.filter((p) => p.admissionStatus === 'Discharged').length + 6, avgMinutes: 19 },
  ];

  return {
    isSampleDataset: true as const,
    hospitalSettings: db.hospitalSettings,
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
    res.status(403).json({ error: 'Administrator privileges are required for this action.' });
    return;
  }
  next();
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Public Auth Status
  app.get('/api/auth/admin-status', (_req, res) => {
    const envAdmin = getEnvAdminCredentials();
    res.json({
      adminClaimed: isAdminClaimed(),
      configuredByEnv: Boolean(envAdmin),
    });
  });

  // One-time Admin Claim (only when ADMIN_PASSWORD env var is unset and no admin exists yet)
  app.post('/api/auth/claim-admin', async (req, res) => {
    if (isAdminClaimed()) {
      res.status(409).json({ error: 'An administrator account has already been configured.' });
      return;
    }
    const { fullName, email, password, hospitalName } = req.body ?? {};
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanName = typeof fullName === 'string' ? fullName.trim() : 'CareOS Administrator';
    const cleanHospital = typeof hospitalName === 'string' && hospitalName.trim() ? hospitalName.trim() : db.hospitalSettings.hospitalName;

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      res.status(400).json({ error: 'Please provide a valid administrator email address.' });
      return;
    }
    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'Administrator password must be at least 8 characters long.' });
      return;
    }

    const passwordHash = await hashPassword(password);
    const adminUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      fullName: cleanName,
      email: cleanEmail,
      role: 'admin',
      hospitalName: cleanHospital,
      hospitalType: 'Multi-Specialty Hospital',
      contactNumber: 'Configured',
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordHash,
    };
    db.users.push(adminUser);
    db.hospitalSettings.hospitalName = cleanHospital;
    appendAudit(cleanEmail, 'admin', 'INITIAL_ADMIN_CLAIMED', 'platform-admin', 'Allowed');
    saveDatabase(db);

    const token = signToken(
      {
        sub: adminUser.id,
        email: adminUser.email,
        name: adminUser.fullName,
        role: adminUser.role,
        hospitalName: adminUser.hospitalName,
      },
      8 * 3600
    );

    const { passwordHash: _omitted, ...safeUser } = adminUser;
    res.status(201).json({ token, user: safeUser });
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

    // Environment-configured admin takes precedence
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
          name: 'Platform Administrator',
          role: 'admin',
          hospitalName: db.hospitalSettings.hospitalName,
        },
        ttlSeconds
      );
      appendAudit(envAdmin.email, 'admin', 'LOGIN_SUCCESS', 'auth/login', 'Allowed');
      saveDatabase(db);
      res.json({
        token,
        user: {
          id: 'env-admin',
          fullName: 'Platform Administrator',
          email: envAdmin.email,
          role: 'admin',
          hospitalName: db.hospitalSettings.hospitalName,
          hospitalType: 'Enterprise Health System',
          contactNumber: 'Configured',
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

  // Signup (Regular users strictly receive 'coordinator' role, never 'admin')
  app.post('/api/auth/signup', async (req, res) => {
    const { fullName, workEmail, password, hospitalName, hospitalType, contactNumber, agreedToTerms } = req.body ?? {};
    const cleanEmail = typeof workEmail === 'string' ? workEmail.trim().toLowerCase() : '';
    const cleanName = typeof fullName === 'string' ? fullName.trim() : '';
    const cleanHospital = typeof hospitalName === 'string' ? hospitalName.trim() : '';
    const cleanType = typeof hospitalType === 'string' ? hospitalType.trim() : '';
    const cleanPhone = typeof contactNumber === 'string' ? contactNumber.trim() : '';

    if (!cleanName || !cleanEmail || !cleanHospital || !cleanType || !cleanPhone) {
      res.status(400).json({ error: 'All organization and contact fields are required.' });
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
    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      fullName: cleanName,
      email: cleanEmail,
      role: 'coordinator', // Regular signups never receive admin privileges
      hospitalName: cleanHospital,
      hospitalType: cleanType,
      contactNumber: cleanPhone,
      status: 'active',
      createdAt: new Date().toISOString(),
      passwordHash,
    };
    db.users.push(newUser);
    appendAudit(cleanEmail, 'coordinator', 'ORGANIZATION_ACCOUNT_CREATED', cleanHospital, 'Allowed');
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
    res.status(201).json({ token, user: safeUser });
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
    const dbUser = db.users.find((item) => item.id === u.sub);
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
        hospitalType: 'Enterprise Health System',
        contactNumber: 'Configured',
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
      message: 'If an active CareOS account matches that address, password recovery instructions have been queued for your hospital IT administrator.',
    });
  });

  // Public contact & demo forms
  app.post('/api/public/contact', (req, res) => {
    const { type, name, email, organization, roleOrType, message } = req.body ?? {};
    if (!name || !email || !organization || !message) {
      res.status(400).json({ error: 'Please complete all required fields.' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    const record: InquiryRecord = {
      id: `inq-${crypto.randomUUID().slice(0, 8)}`,
      type: type === 'demo' ? 'demo' : 'contact',
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      organization: String(organization).trim(),
      roleOrType: String(roleOrType || 'Hospital Leadership').trim(),
      message: String(message).trim(),
      createdAt: new Date().toISOString(),
    };
    db.inquiries.unshift(record);
    saveDatabase(db);
    res.status(201).json({ ok: true, inquiryId: record.id });
  });

  // Protected Dashboard Routes
  app.get('/api/dashboard/overview', requireAuth, (req, res) => {
    const range = typeof req.query.range === 'string' ? req.query.range : 'today';
    res.json(computeOverview(range));
  });

  app.get('/api/patients', requireAuth, (_req, res) => {
    res.json({ patients: db.patients, isSampleDataset: true });
  });

  app.post('/api/patients', requireAuth, (req: AuthenticatedRequest, res) => {
    const { fullName, age, gender, phone, email, department, attendingDoctor, admissionStatus, wardBed, medicalSummary, allergies } = req.body ?? {};
    if (!fullName || !department || !attendingDoctor) {
      res.status(400).json({ error: 'Patient name, department, and attending physician are required.' });
      return;
    }
    const newPatient: PatientRecord = {
      id: `pat-${crypto.randomUUID().slice(0, 6)}`,
      mrn: `MRN-${Math.floor(41000 + Math.random() * 8999)}`,
      fullName: String(fullName).trim(),
      age: Number(age) || 40,
      gender: gender === 'Female' || gender === 'Male' ? gender : 'Other',
      phone: String(phone || '+1 (415) 555-0100').trim(),
      email: String(email || 'patient@sample-patient.org').trim(),
      department: String(department).trim(),
      attendingDoctor: String(attendingDoctor).trim(),
      admissionStatus: admissionStatus || 'Outpatient',
      wardBed: String(wardBed || `${String(department).slice(0, 5)}-Clinic`).trim(),
      lastVisit: getTodayDateString(),
      medicalSummary: String(medicalSummary || 'Registered in CareOS sample patient registry.').trim(),
      allergies: Array.isArray(allergies) ? allergies : ['None reported'],
      isSample: true,
    };
    db.patients.unshift(newPatient);
    appendAudit(req.authUser!.email, req.authUser!.role, 'PATIENT_REGISTERED_SAMPLE', newPatient.mrn, 'Allowed');
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
    appendAudit(req.authUser!.email, req.authUser!.role, 'PATIENT_RECORD_UPDATED', db.patients[idx].mrn, 'Allowed');
    saveDatabase(db);
    res.json({ patient: db.patients[idx] });
  });

  app.get('/api/appointments', requireAuth, (_req, res) => {
    res.json({ appointments: db.appointments, isSampleDataset: true });
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
      mrn: String(mrn || 'MRN-SAMPLE').trim(),
      doctorName: String(doctorName).trim(),
      department: String(department).trim(),
      date: String(date).trim(),
      time: String(time).trim(),
      type: type || 'Consultation',
      status: 'Scheduled',
      notes: String(notes || '').trim(),
      isSample: true,
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

  app.post('/api/agents/:id/dispatch', requireAuth, (req: AuthenticatedRequest, res) => {
    const agent = db.agents.find((a) => a.id === req.params.id);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found.' });
      return;
    }
    const { taskSummary, department } = req.body ?? {};
    const summary = typeof taskSummary === 'string' && taskSummary.trim()
      ? taskSummary.trim()
      : `Executed coordinated operational check across ${department || 'Hospital Operations'}`;
    const dept = typeof department === 'string' && department.trim() ? department.trim() : 'Operations';

    agent.assignedTasks += 1;
    agent.completedTasks += 1;
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    agent.recentActivity.unshift({
      id: `act-${crypto.randomUUID().slice(0, 6)}`,
      timestamp: nowTime,
      summary,
      department: dept,
      outcome: agent.id === 'agent-clinical' ? 'Awaiting Review' : 'Completed',
    });
    if (agent.recentActivity.length > 8) agent.recentActivity = agent.recentActivity.slice(0, 8);

    db.notifications.unshift({
      id: `not-${crypto.randomUUID().slice(0, 6)}`,
      title: `${agent.name} completed task`,
      detail: summary,
      department: dept,
      severity: 'info',
      timestamp: 'Just now',
      read: false,
    });
    if (db.notifications.length > 15) db.notifications = db.notifications.slice(0, 15);

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
      res.status(400).json({ error: `${item.name} is a planned ecosystem connector and cannot be activated in this environment yet.` });
      return;
    }
    item.connected = Boolean(req.body?.connected);
    appendAudit(req.authUser!.email, req.authUser!.role, item.connected ? 'INTEGRATION_CONNECTED' : 'INTEGRATION_DISCONNECTED', item.name, 'Allowed');
    saveDatabase(db);
    res.json({ integration: item });
  });

  app.get('/api/analytics', requireAuth, (_req, res) => {
    const overview = computeOverview('7d');
    const deptBreakdown = db.departments.map((d) => ({
      name: d.name,
      activePatients: d.activePatients,
      bedUtilization: d.bedCapacity > 0 ? Math.round((d.occupiedBeds / d.bedCapacity) * 100) : 0,
      avgWaitMinutes: d.avgWaitMinutes,
      staffUtilization: d.totalStaff > 0 ? Math.round((d.staffOnDuty / d.totalStaff) * 100) : 0,
    }));
    const agentPerformance = db.agents.map((a) => ({
      id: a.id,
      name: a.shortName,
      completed: a.completedTasks,
      pending: a.pendingTasks,
      completionRate: a.assignedTasks > 0 ? Math.round((a.completedTasks / a.assignedTasks) * 100) : 100,
      avgResponseSeconds: a.avgResponseSeconds,
    }));
    res.json({
      isSampleDataset: true,
      summary: overview.metrics,
      deptBreakdown,
      agentPerformance,
      appointmentTrends: overview.appointmentTrends,
    });
  });

  // Administrator-only endpoints
  app.get('/api/admin/users', requireAuth, requireAdmin, (_req, res) => {
    const safeUsers = db.users.map(({ passwordHash: _omitted, ...u }) => u);
    res.json({ users: safeUsers });
  });

  app.patch('/api/admin/users/:id/role', requireAuth, requireAdmin, (req: AuthenticatedRequest, res) => {
    const target = db.users.find((u) => u.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const nextRole = req.body?.role as UserRole;
    if (!['admin', 'coordinator', 'clinician', 'operator'].includes(nextRole)) {
      res.status(400).json({ error: 'Invalid role specified.' });
      return;
    }
    target.role = nextRole;
    appendAudit(req.authUser!.email, req.authUser!.role, `USER_ROLE_CHANGED_TO_${nextRole.toUpperCase()}`, target.email, 'Allowed');
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
    appendAudit(req.authUser!.email, req.authUser!.role, 'HOSPITAL_SETTINGS_UPDATED', 'system-settings', 'Allowed');
    saveDatabase(db);
    res.json({ hospitalSettings: db.hospitalSettings });
  });

  // Vite dev middleware or production static assets
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
