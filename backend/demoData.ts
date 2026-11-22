import type {
  AgentProfile,
  ApprovedHospital,
  AuditLogEntry,
  AuthUser,
  DepartmentAlertItem,
  DepartmentRecord,
  HospitalApplication,
  HospitalModuleRecord,
  HospitalNotification,
  IntegrationItem,
  InterAgentMessage,
  OperationalTask,
  PatientBillRecord,
  PatientRecord,
  PendingApprovalItem,
  PlatformActivityItem,
  PrescriptionRecord,
  RadiologyOrderRecord,
  ResourceItem,
  StaffMember,
  SubscriptionRecord,
  WorkflowDefinition,
  WorkflowExecutionRecord,
} from '../shared/types/careos.ts';

export interface DemoSeedUser extends AuthUser {
  passwordHash: string;
}

/** Structural subset of the server database needed by the demo seed. */
export interface DemoSeedTarget {
  users: DemoSeedUser[];
  applications: HospitalApplication[];
  hospitals: ApprovedHospital[];
  subscriptions: SubscriptionRecord[];
  platformActivity: PlatformActivityItem[];
  patients: PatientRecord[];
  appointments: import('../shared/types/careos.ts').AppointmentRecord[];
  prescriptions: PrescriptionRecord[];
  radiologyOrders: RadiologyOrderRecord[];
  bills: PatientBillRecord[];
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

export interface DemoSeedOptions {
  /** Hash of the default demo password (`password`). */
  defaultPasswordHash: string;
}

const pad = (value: number) => String(value).padStart(2, '0');

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function atDaysAgo(days: number, hour: number, minute = 0): string {
  return `${dateDaysAgo(days)}T${pad(hour)}:${pad(minute)}:00.000Z`;
}

function atToday(hour: number, minute = 0): string {
  return `${today()}T${pad(hour)}:${pad(minute)}:00.000Z`;
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function addUnique<T extends { id: string }>(target: T[], item: T): void {
  if (!target.some((existing) => existing.id === item.id)) target.push(item);
}

/**
 * Deterministic, synthetic demo dataset used by local preview and serverless cold starts.
 * Safe to run repeatedly: every record has a stable `demo-` ID.
 */
export function applyDemoData(db: DemoSeedTarget, options: DemoSeedOptions): boolean {
  let changed = false;
  const before = JSON.stringify(db);

  /* ---------------------------------- Users --------------------------------- */
  const patientUsers: DemoSeedUser[] = [
    {
      id: 'usr-demo-patient-1',
      username: 'PAT-2026-0001',
      fullName: 'Ananya Rao',
      email: 'ananya.rao@patient.careos.local',
      role: 'patient',
      hospitalName: 'CareOS Test Hospital',
      hospitalType: 'Multi-Specialty',
      hospitalId: 'HSP-00001',
      applicationId: 'APP-TEST-0001',
      patientId: 'pat-demo-1',
      contactNumber: '+91 98480 10001',
      status: 'active',
      demoSwitchable: true,
      mustChangePassword: false,
      createdAt: atDaysAgo(6, 9, 10),
      passwordHash: options.defaultPasswordHash,
    },
    {
      id: 'usr-demo-patient-2',
      username: 'PAT-2026-0002',
      fullName: 'Vikram Shetty',
      email: 'vikram.shetty@patient.careos.local',
      role: 'patient',
      hospitalName: 'CareOS Test Hospital',
      hospitalType: 'Multi-Specialty',
      hospitalId: 'HSP-00001',
      applicationId: 'APP-TEST-0001',
      patientId: 'pat-demo-2',
      contactNumber: '+91 98480 10002',
      status: 'active',
      demoSwitchable: true,
      mustChangePassword: false,
      createdAt: atDaysAgo(4, 11, 25),
      passwordHash: options.defaultPasswordHash,
    },
  ];
  patientUsers.forEach((user) => addUnique(db.users, user));

  const staffUsers: DemoSeedUser[] = [
    {
      id: 'usr-demo-doctor-chen',
      username: 'USR-2026-0101',
      fullName: 'Dr. Marcus Chen',
      email: 'marcus.chen@careostest.example',
      role: 'clinician',
      hospitalName: 'CareOS Test Hospital',
      hospitalType: 'Multi-Specialty',
      hospitalId: 'HSP-00001',
      applicationId: 'APP-TEST-0001',
      department: 'Cardiology',
      contactNumber: 'Ext 2101',
      status: 'active',
      demoSwitchable: true,
      mustChangePassword: false,
      createdAt: atDaysAgo(120, 8, 0),
      passwordHash: options.defaultPasswordHash,
    },
    {
      id: 'usr-demo-doctor-nair',
      username: 'USR-2026-0102',
      fullName: 'Dr. Priya Nair',
      email: 'priya.nair@careostest.example',
      role: 'clinician',
      hospitalName: 'CareOS Test Hospital',
      hospitalType: 'Multi-Specialty',
      hospitalId: 'HSP-00001',
      applicationId: 'APP-TEST-0001',
      department: 'Emergency',
      contactNumber: 'Ext 2204',
      status: 'active',
      demoSwitchable: true,
      mustChangePassword: false,
      createdAt: atDaysAgo(110, 8, 0),
      passwordHash: options.defaultPasswordHash,
    },
  ];
  staffUsers.forEach((user) => addUnique(db.users, user));

  /* ------------------------------- Applications ------------------------------ */
  const applications: HospitalApplication[] = [
    {
      id: 'app-demo-1',
      applicationId: 'APP-DEMO-0001',
      hospitalName: 'Northside Multi-Specialty Hospital',
      hospitalType: 'Multi-Specialty',
      bedsCount: 320,
      departmentsCount: 12,
      location: 'Vijayawada, Andhra Pradesh',
      address: '12 Ring Road, Vijayawada',
      contactPerson: 'Dr. Kavya Reddy',
      email: 'kavya@northside.example',
      phone: '+91 866 220 1101',
      submittedAt: atDaysAgo(240, 10, 15),
      status: 'Approved',
      documents: [
        { name: 'Hospital Registration', status: 'Verified' },
        { name: 'Medical Council License', status: 'Verified' },
        { name: 'Address Proof', status: 'Verified' },
      ],
      internalNotes: 'Enterprise onboarding completed; workspace active.',
      reviewedAt: atDaysAgo(232, 14, 30),
      applicantUserId: 'usr-demo-northside',
    },
    {
      id: 'app-demo-2',
      applicationId: 'APP-DEMO-0002',
      hospitalName: 'Vijayawada Cardiac Centre',
      hospitalType: 'Specialty Cardiology',
      bedsCount: 120,
      departmentsCount: 5,
      location: 'Vijayawada, Andhra Pradesh',
      address: '88 Bandar Road, Vijayawada',
      contactPerson: 'Dr. Ramesh Kulkarni',
      email: 'ramesh@vijaycardiac.example',
      phone: '+91 866 221 4477',
      submittedAt: atDaysAgo(2, 9, 40),
      status: 'Under Review',
      documents: [
        { name: 'Hospital Registration', status: 'Uploaded' },
        { name: 'Cardiology Accreditation', status: 'Requested' },
      ],
      internalNotes: 'Awaiting cardiology accreditation document.',
      requestedMessage: 'Please upload the cardiology accreditation certificate.',
    },
    {
      id: 'app-demo-3',
      applicationId: 'APP-DEMO-0003',
      hospitalName: 'Sunrise Women & Children Hospital',
      hospitalType: 'Maternity & Pediatrics',
      bedsCount: 180,
      departmentsCount: 8,
      location: 'Guntur, Andhra Pradesh',
      address: '5 Lalapet, Guntur',
      contactPerson: 'Dr. Sneha Iyer',
      email: 'sneha@sunrise.example',
      phone: '+91 863 225 7788',
      submittedAt: atDaysAgo(1, 16, 5),
      status: 'Pending',
      documents: [{ name: 'Hospital Registration', status: 'Uploaded' }],
      internalNotes: 'Initial intake queued for Super Admin review.',
    },
    {
      id: 'app-demo-4',
      applicationId: 'APP-DEMO-0004',
      hospitalName: 'Apollo Diagnostics Network',
      hospitalType: 'Diagnostics Chain',
      bedsCount: 40,
      departmentsCount: 4,
      location: 'Hyderabad, Telangana',
      address: '9 Gachibowli, Hyderabad',
      contactPerson: 'Mr. Arjun Malhotra',
      email: 'arjun@apollo-diag.example',
      phone: '+91 40 4455 6677',
      submittedAt: atDaysAgo(5, 12, 20),
      status: 'Docs Requested',
      documents: [
        { name: 'Hospital Registration', status: 'Uploaded' },
        { name: 'Lab NABL Certificate', status: 'Requested' },
      ],
      internalNotes: 'NABL certificate requested before approval.',
      requestedMessage: 'Please attach the current NABL accreditation.',
    },
    {
      id: 'app-demo-5',
      applicationId: 'APP-DEMO-0005',
      hospitalName: 'Green Valley Community Hospital',
      hospitalType: 'Community Hospital',
      bedsCount: 210,
      departmentsCount: 7,
      location: 'Anantapur, Andhra Pradesh',
      address: '21 Gandhi Road, Anantapur',
      contactPerson: 'Dr. Leela Prasad',
      email: 'leela@greenvalley.example',
      phone: '+91 8554 220 991',
      submittedAt: atDaysAgo(150, 11, 0),
      status: 'Approved',
      documents: [
        { name: 'Hospital Registration', status: 'Verified' },
        { name: 'Address Proof', status: 'Verified' },
      ],
      internalNotes: 'Pro workspace provisioned.',
      reviewedAt: atDaysAgo(146, 15, 10),
    },
  ];
  applications.forEach((app) => addUnique(db.applications, app));

  /* -------------------------------- Hospitals -------------------------------- */
  const hospitals: ApprovedHospital[] = [
    {
      id: 'hsp-demo-1',
      hospitalId: 'HSP-00001',
      applicationId: 'APP-TEST-0001',
      hospitalName: 'CareOS Test Hospital',
      hospitalType: 'Multi-Specialty',
      location: 'Vijayawada, Andhra Pradesh',
      address: 'Main Branch, Vijayawada',
      administratorName: 'Hospital Administrator',
      administratorEmail: 'hospital@gmail.com',
      phone: 'Hospital Command Desk',
      bedsCount: 150,
      departmentsCount: 6,
      activeUsersCount: 48,
      subscriptionPlan: 'Pro',
      workspaceStatus: 'Active',
      approvedAt: atDaysAgo(180, 10, 0),
    },
    {
      id: 'hsp-demo-2',
      hospitalId: 'HSP-00002',
      applicationId: 'APP-DEMO-0001',
      hospitalName: 'Northside Multi-Specialty Hospital',
      hospitalType: 'Multi-Specialty',
      location: 'Vijayawada, Andhra Pradesh',
      address: '12 Ring Road, Vijayawada',
      administratorName: 'Dr. Kavya Reddy',
      administratorEmail: 'kavya@northside.example',
      phone: '+91 866 220 1101',
      bedsCount: 320,
      departmentsCount: 12,
      activeUsersCount: 126,
      subscriptionPlan: 'Enterprise',
      workspaceStatus: 'Active',
      approvedAt: atDaysAgo(232, 14, 30),
    },
  ];
  hospitals.forEach((hospital) => addUnique(db.hospitals, hospital));

  /* ------------------------------- Subscriptions ------------------------------ */
  const subscriptions: SubscriptionRecord[] = [
    {
      id: 'sub-demo-1',
      hospitalId: 'HSP-00001',
      hospitalName: 'CareOS Test Hospital',
      plan: 'Pro',
      monthlyPriceUsd: 899,
      seatsIncluded: 60,
      status: 'Active',
      startedAt: atDaysAgo(180, 10, 0),
    },
    {
      id: 'sub-demo-2',
      hospitalId: 'HSP-00002',
      hospitalName: 'Northside Multi-Specialty Hospital',
      plan: 'Enterprise',
      monthlyPriceUsd: 2490,
      seatsIncluded: 200,
      status: 'Active',
      startedAt: atDaysAgo(232, 14, 30),
    },
  ];
  subscriptions.forEach((subscription) => addUnique(db.subscriptions, subscription));

  /* ----------------------------- Platform activity ---------------------------- */
  const platformActivity: PlatformActivityItem[] = [
    { id: 'pa-demo-1', message: 'Sunrise Women & Children Hospital submitted APP-DEMO-0003.', category: 'application', timestamp: atDaysAgo(1, 16, 5) },
    { id: 'pa-demo-2', message: 'Vijayawada Cardiac Centre moved to Under Review.', category: 'application', timestamp: atDaysAgo(2, 9, 40) },
    { id: 'pa-demo-3', message: 'Apollo Diagnostics Network requested additional documents.', category: 'system', timestamp: atDaysAgo(5, 12, 20) },
    { id: 'pa-demo-4', message: 'Northside Multi-Specialty Hospital workspace activated.', category: 'approval', timestamp: atDaysAgo(232, 14, 30) },
    { id: 'pa-demo-5', message: '12 clinician accounts provisioned for Northside Multi-Specialty Hospital.', category: 'user', timestamp: atDaysAgo(231, 9, 15) },
    { id: 'pa-demo-6', message: 'Green Valley Community Hospital approved for Pro workspace.', category: 'approval', timestamp: atDaysAgo(146, 15, 10) },
  ];
  platformActivity.forEach((item) => addUnique(db.platformActivity, item));

  /* --------------------------------- Patients --------------------------------- */
  const patients: PatientRecord[] = [
    {
      id: 'pat-demo-1',
      mrn: 'MRN-10001',
      fullName: 'Ananya Rao',
      age: 34,
      gender: 'Female',
      phone: '+91 98480 10001',
      email: 'ananya.rao@patient.careos.local',
      department: 'Cardiology',
      attendingDoctor: 'Dr. Marcus Chen',
      admissionStatus: 'Outpatient',
      wardBed: 'CARD-Clinic-04',
      lastVisit: today(),
      medicalSummary: 'Palpitations and exertional chest discomfort. Awaiting cardiology review and chest X-ray.',
      allergies: ['Penicillin'],
      userId: 'usr-demo-patient-1',
      portalUsername: 'PAT-2026-0001',
      portalEmail: 'ananya.rao@patient.careos.local',
    },
    {
      id: 'pat-demo-2',
      mrn: 'MRN-10002',
      fullName: 'Vikram Shetty',
      age: 58,
      gender: 'Male',
      phone: '+91 98480 10002',
      email: 'vikram.shetty@patient.careos.local',
      department: 'Emergency',
      attendingDoctor: 'Dr. Priya Nair',
      admissionStatus: 'Admitted',
      wardBed: 'ER-ICU-02',
      lastVisit: today(),
      medicalSummary: 'Acute breathlessness with history of type 2 diabetes. Admitted for observation and imaging.',
      allergies: ['Sulfa drugs'],
      userId: 'usr-demo-patient-2',
      portalUsername: 'PAT-2026-0002',
      portalEmail: 'vikram.shetty@patient.careos.local',
    },
    {
      id: 'pat-demo-3',
      mrn: 'MRN-10003',
      fullName: 'Meera Krishnan',
      age: 46,
      gender: 'Female',
      phone: '+91 98480 10003',
      email: 'meera.krishnan@patient.careos.local',
      department: 'General Medicine',
      attendingDoctor: 'Dr. Arjun Desai',
      admissionStatus: 'ICU Observation',
      wardBed: 'ICU-07',
      lastVisit: today(),
      medicalSummary: 'Post-operative monitoring after abdominal procedure. Vitals stable.',
      allergies: ['Latex'],
    },
    {
      id: 'pat-demo-4',
      mrn: 'MRN-10004',
      fullName: 'Ravi Teja',
      age: 29,
      gender: 'Male',
      phone: '+91 98480 10004',
      email: 'ravi.teja@patient.careos.local',
      department: 'Orthopedics',
      attendingDoctor: 'Dr. Neha Kapoor',
      admissionStatus: 'Discharged',
      wardBed: 'ORTHO-Clinic-11',
      lastVisit: dateDaysAgo(1),
      medicalSummary: 'Right ankle fracture treated and discharged with follow-up advice.',
      allergies: ['None reported'],
    },
    {
      id: 'pat-demo-5',
      mrn: 'MRN-10005',
      fullName: 'Lakshmi Devi',
      age: 67,
      gender: 'Female',
      phone: '+91 98480 10005',
      email: 'lakshmi.devi@patient.careos.local',
      department: 'Cardiology',
      attendingDoctor: 'Dr. Marcus Chen',
      admissionStatus: 'Pre-Admission',
      wardBed: 'CARD-PreAdmit-02',
      lastVisit: dateDaysAgo(2),
      medicalSummary: 'Scheduled for cardiac evaluation and echocardiogram.',
      allergies: ['Aspirin'],
    },
    {
      id: 'pat-demo-6',
      mrn: 'MRN-10006',
      fullName: 'Siddharth Verma',
      age: 41,
      gender: 'Male',
      phone: '+91 98480 10006',
      email: 'siddharth.verma@patient.careos.local',
      department: 'Radiology',
      attendingDoctor: 'Dr. Imran Qureshi',
      admissionStatus: 'Outpatient',
      wardBed: 'RAD-Clinic-01',
      lastVisit: today(),
      medicalSummary: 'Follow-up imaging review for chronic pulmonary condition.',
      allergies: ['None reported'],
    },
    {
      id: 'pat-demo-7',
      mrn: 'MRN-10007',
      fullName: 'Fatima Begum',
      age: 38,
      gender: 'Female',
      phone: '+91 98480 10007',
      email: 'fatima.begum@patient.careos.local',
      department: 'General Medicine',
      attendingDoctor: 'Dr. Arjun Desai',
      admissionStatus: 'Admitted',
      wardBed: 'GEN-Ward-14',
      lastVisit: today(),
      medicalSummary: 'Community-acquired pneumonia under treatment with antibiotics.',
      allergies: ['Amoxicillin'],
    },
    {
      id: 'pat-demo-8',
      mrn: 'MRN-10008',
      fullName: 'Karthik Reddy',
      age: 52,
      gender: 'Male',
      phone: '+91 98480 10008',
      email: 'karthik.reddy@patient.careos.local',
      department: 'Emergency',
      attendingDoctor: 'Dr. Priya Nair',
      admissionStatus: 'Discharged',
      wardBed: 'ER-Obs-09',
      lastVisit: dateDaysAgo(1),
      medicalSummary: 'Minor trauma treated in emergency and discharged after observation.',
      allergies: ['None reported'],
    },
  ];
  patients.forEach((patient) => addUnique(db.patients, patient));

  /* ------------------------------- Appointments ------------------------------- */
  const appointmentSeed: import('../shared/types/careos.ts').AppointmentRecord[] = [
    {
      id: 'apt-demo-1', patientId: 'pat-demo-1', patientName: 'Ananya Rao', mrn: 'MRN-10001',
      doctorName: 'Dr. Marcus Chen', department: 'Cardiology', date: today(), time: '08:30',
      type: 'Consultation', status: 'Checked In', notes: 'Palpitations review. X-ray requested.',
      createdAt: minutesAgo(96), queueJoinedAt: minutesAgo(74), waitingMinutes: 74,
      portalUserId: 'PAT-2026-0001', portalUsername: 'PAT-2026-0001',
      prescriptionId: 'rx-demo-1', prescriptionUploadedAt: minutesAgo(52),
      radiologyOrderId: 'RAD-DEMO-0001', radiologyReportUploadedAt: minutesAgo(18),
    },
    {
      id: 'apt-demo-2', patientId: 'pat-demo-2', patientName: 'Vikram Shetty', mrn: 'MRN-10002',
      doctorName: 'Dr. Priya Nair', department: 'Emergency', date: today(), time: '09:15',
      type: 'Diagnostic', status: 'In Progress', notes: 'Acute breathlessness. Continuous monitoring.',
      createdAt: minutesAgo(61), queueJoinedAt: minutesAgo(48), waitingMinutes: 48,
      portalUserId: 'PAT-2026-0002', portalUsername: 'PAT-2026-0002',
      prescriptionId: 'rx-demo-2', prescriptionUploadedAt: minutesAgo(30),
      radiologyOrderId: 'RAD-DEMO-0002',
    },
    {
      id: 'apt-demo-3', patientId: 'pat-demo-3', patientName: 'Meera Krishnan', mrn: 'MRN-10003',
      doctorName: 'Dr. Arjun Desai', department: 'General Medicine', date: today(), time: '10:00',
      type: 'Follow-up', status: 'Checked In', notes: 'Post-operative review.',
      createdAt: minutesAgo(38), queueJoinedAt: minutesAgo(31), waitingMinutes: 31,
      prescriptionId: 'rx-demo-3', prescriptionUploadedAt: minutesAgo(14),
    },
    {
      id: 'apt-demo-4', patientId: 'pat-demo-5', patientName: 'Lakshmi Devi', mrn: 'MRN-10005',
      doctorName: 'Dr. Marcus Chen', department: 'Cardiology', date: today(), time: '11:30',
      type: 'Diagnostic', status: 'Scheduled', notes: 'Echocardiogram evaluation.',
      createdAt: minutesAgo(24), queueJoinedAt: minutesAgo(9), waitingMinutes: 9,
    },
    {
      id: 'apt-demo-5', patientId: 'pat-demo-6', patientName: 'Siddharth Verma', mrn: 'MRN-10006',
      doctorName: 'Dr. Imran Qureshi', department: 'Radiology', date: today(), time: '14:00',
      type: 'Follow-up', status: 'Scheduled', notes: 'Chest imaging follow-up.',
      createdAt: minutesAgo(18), queueJoinedAt: minutesAgo(6), waitingMinutes: 6,
      radiologyOrderId: 'RAD-DEMO-0003',
    },
    {
      id: 'apt-demo-6', patientId: 'pat-demo-7', patientName: 'Fatima Begum', mrn: 'MRN-10007',
      doctorName: 'Dr. Arjun Desai', department: 'General Medicine', date: today(), time: '15:30',
      type: 'Consultation', status: 'Completed', notes: 'Pneumonia follow-up completed.',
      createdAt: atDaysAgo(1, 15, 30), prescriptionId: 'rx-demo-4',
      prescriptionUploadedAt: atDaysAgo(1, 16, 5),
    },
    {
      id: 'apt-demo-7', patientId: 'pat-demo-4', patientName: 'Ravi Teja', mrn: 'MRN-10004',
      doctorName: 'Dr. Neha Kapoor', department: 'Orthopedics', date: today(), time: '16:15',
      type: 'Follow-up', status: 'Scheduled', notes: 'Ankle fracture follow-up.',
      createdAt: minutesAgo(12), waitingMinutes: 0,
    },
    {
      id: 'apt-demo-8', patientId: 'pat-demo-8', patientName: 'Karthik Reddy', mrn: 'MRN-10008',
      doctorName: 'Dr. Priya Nair', department: 'Emergency', date: today(), time: '16:45',
      type: 'Consultation', status: 'Completed', notes: 'Discharged after observation.',
      createdAt: atDaysAgo(1, 16, 45),
    },
  ];
  appointmentSeed.forEach((appointment) => addUnique(db.appointments, appointment));

  /* ------------------------------- Prescriptions ------------------------------ */
  const prescriptions: PrescriptionRecord[] = [
    {
      id: 'rx-demo-1', appointmentId: 'apt-demo-1', patientId: 'pat-demo-1', patientName: 'Ananya Rao', mrn: 'MRN-10001',
      doctorName: 'Dr. Marcus Chen', diagnosis: 'Palpitations with exertional chest discomfort',
      medications: 'Metoprolol 25 mg twice daily; Aspirin 75 mg once daily',
      instructions: 'Avoid strenuous activity until cardiology review. Report any chest pain immediately.',
      fileName: 'ananya-rao-prescription.txt', uploadedBy: 'Dr. Marcus Chen', createdAt: minutesAgo(52),
    },
    {
      id: 'rx-demo-2', appointmentId: 'apt-demo-2', patientId: 'pat-demo-2', patientName: 'Vikram Shetty', mrn: 'MRN-10002',
      doctorName: 'Dr. Priya Nair', diagnosis: 'Acute breathlessness with type 2 diabetes',
      medications: 'Furosemide 40 mg once daily; Metformin 500 mg twice daily',
      instructions: 'Continuous monitoring, restrict fluids, review blood glucose every 6 hours.',
      fileName: 'vikram-shetty-prescription.txt', uploadedBy: 'Dr. Priya Nair', createdAt: minutesAgo(30),
    },
    {
      id: 'rx-demo-3', appointmentId: 'apt-demo-3', patientId: 'pat-demo-3', patientName: 'Meera Krishnan', mrn: 'MRN-10003',
      doctorName: 'Dr. Arjun Desai', diagnosis: 'Post-operative observation',
      medications: 'Paracetamol 650 mg every 8 hours; Cefuroxime 500 mg twice daily',
      instructions: 'Maintain wound care. Review temperature and pain score every shift.',
      fileName: 'meera-krishnan-prescription.txt', uploadedBy: 'Dr. Arjun Desai', createdAt: minutesAgo(14),
    },
    {
      id: 'rx-demo-4', appointmentId: 'apt-demo-6', patientId: 'pat-demo-7', patientName: 'Fatima Begum', mrn: 'MRN-10007',
      doctorName: 'Dr. Arjun Desai', diagnosis: 'Community-acquired pneumonia',
      medications: 'Azithromycin 500 mg once daily for 5 days',
      instructions: 'Complete antibiotics course and return if fever persists beyond 72 hours.',
      fileName: 'fatima-begum-prescription.txt', uploadedBy: 'Dr. Arjun Desai', createdAt: atDaysAgo(1, 16, 5),
    },
  ];
  prescriptions.forEach((prescription) => addUnique(db.prescriptions, prescription));

  /* ------------------------------ Radiology orders ---------------------------- */
  const radiologyOrders: RadiologyOrderRecord[] = [
    {
      id: 'RAD-DEMO-0001', appointmentId: 'apt-demo-1', patientId: 'pat-demo-1', patientName: 'Ananya Rao', mrn: 'MRN-10001',
      doctorName: 'Dr. Marcus Chen', department: 'Cardiology', examType: 'Chest X-Ray',
      reason: 'Evaluate pulmonary cause for exertional discomfort', priority: 'Urgent',
      status: 'Completed', createdAt: minutesAgo(62), waitingMinutes: 44, completedAt: minutesAgo(18),
      report: {
        findings: 'Lung fields are clear. Normal cardiomediastinal silhouette. No acute infiltrate or effusion.',
        impression: 'No acute cardiopulmonary abnormality.',
        fileName: 'ananya-rao-chest-xray.txt', uploadedBy: 'Hospital Administrator', uploadedAt: minutesAgo(18),
      },
      billId: 'BILL-DEMO-0001',
    },
    {
      id: 'RAD-DEMO-0002', appointmentId: 'apt-demo-2', patientId: 'pat-demo-2', patientName: 'Vikram Shetty', mrn: 'MRN-10002',
      doctorName: 'Dr. Priya Nair', department: 'Emergency', examType: 'Chest X-Ray',
      reason: 'Rule out pulmonary edema and consolidation', priority: 'STAT',
      status: 'In Progress', createdAt: minutesAgo(35), waitingMinutes: 35,
    },
    {
      id: 'RAD-DEMO-0003', appointmentId: 'apt-demo-5', patientId: 'pat-demo-6', patientName: 'Siddharth Verma', mrn: 'MRN-10006',
      doctorName: 'Dr. Imran Qureshi', department: 'Radiology', examType: 'Chest X-Ray',
      reason: 'Chronic pulmonary condition follow-up', priority: 'Routine',
      status: 'Pending', createdAt: minutesAgo(10), waitingMinutes: 10,
    },
  ];
  radiologyOrders.forEach((order) => addUnique(db.radiologyOrders, order));

  /* ---------------------------------- Bills ---------------------------------- */
  const bills: PatientBillRecord[] = [
    {
      id: 'BILL-DEMO-0001', patientId: 'pat-demo-1', patientName: 'Ananya Rao', mrn: 'MRN-10001',
      orderId: 'RAD-DEMO-0001', description: 'X-Ray · Radiology report', amount: 150, currency: 'USD',
      status: 'Pending', createdAt: minutesAgo(18),
    },
    {
      id: 'BILL-DEMO-0002', patientId: 'pat-demo-2', patientName: 'Vikram Shetty', mrn: 'MRN-10002',
      description: 'Emergency consultation', amount: 320, currency: 'USD',
      status: 'Paid', createdAt: atDaysAgo(1, 10, 20),
    },
  ];
  bills.forEach((bill) => addUnique(db.bills, bill));

  /* -------------------------------- Departments ------------------------------- */
  const departments: DepartmentRecord[] = [
    { id: 'dept-demo-cardio', name: 'Cardiology', head: 'Dr. Marcus Chen', activePatients: 18, staffOnDuty: 12, totalStaff: 18, bedCapacity: 34, occupiedBeds: 22, avgWaitMinutes: 14, status: 'Elevated' },
    { id: 'dept-demo-er', name: 'Emergency', head: 'Dr. Priya Nair', activePatients: 24, staffOnDuty: 16, totalStaff: 22, bedCapacity: 28, occupiedBeds: 25, avgWaitMinutes: 21, status: 'High Load' },
    { id: 'dept-demo-gen', name: 'General Medicine', head: 'Dr. Arjun Desai', activePatients: 15, staffOnDuty: 10, totalStaff: 16, bedCapacity: 48, occupiedBeds: 31, avgWaitMinutes: 12, status: 'Nominal' },
    { id: 'dept-demo-radio', name: 'Radiology', head: 'Dr. Imran Qureshi', activePatients: 7, staffOnDuty: 6, totalStaff: 9, bedCapacity: 8, occupiedBeds: 3, avgWaitMinutes: 9, status: 'Nominal' },
    { id: 'dept-demo-ortho', name: 'Orthopedics', head: 'Dr. Neha Kapoor', activePatients: 9, staffOnDuty: 7, totalStaff: 11, bedCapacity: 32, occupiedBeds: 27, avgWaitMinutes: 16, status: 'Elevated' },
  ];
  departments.forEach((department) => addUnique(db.departments, department));

  /* -------------------------------- Resources --------------------------------- */
  const resources: ResourceItem[] = [
    { id: 'res-demo-beds', name: 'Inpatient Ward & ICU Beds', category: 'Beds', department: 'Hospital-Wide', total: 150, available: 37, inUse: 108, maintenance: 5 },
    { id: 'res-demo-ventilators', name: 'Ventilators', category: 'Critical Equipment', department: 'ICU', total: 24, available: 9, inUse: 13, maintenance: 2 },
    { id: 'res-demo-ct', name: 'CT & X-Ray Suites', category: 'Diagnostic Suites', department: 'Radiology', total: 6, available: 2, inUse: 4, maintenance: 0 },
    { id: 'res-demo-ot', name: 'Operating Theatres', category: 'Operating Rooms', department: 'Surgery', total: 8, available: 3, inUse: 5, maintenance: 0 },
  ];
  resources.forEach((resource) => addUnique(db.resources, resource));

  /* ---------------------------------- Staff ----------------------------------- */
  const staff: StaffMember[] = [
    { id: 'stf-demo-1', name: 'Dr. Marcus Chen', role: 'Consultant Cardiologist', department: 'Cardiology', shift: '08:00 - 16:00', availability: 'On Duty', activeCases: 6 },
    { id: 'stf-demo-2', name: 'Dr. Priya Nair', role: 'Emergency Physician', department: 'Emergency', shift: '07:00 - 15:00', availability: 'In Procedure', activeCases: 9 },
    { id: 'stf-demo-3', name: 'Dr. Arjun Desai', role: 'Consultant Physician', department: 'General Medicine', shift: '09:00 - 17:00', availability: 'On Duty', activeCases: 5 },
    { id: 'stf-demo-4', name: 'Dr. Neha Kapoor', role: 'Orthopedic Surgeon', department: 'Orthopedics', shift: '10:00 - 18:00', availability: 'On Call', activeCases: 4 },
    { id: 'stf-demo-5', name: 'Dr. Imran Qureshi', role: 'Radiologist', department: 'Radiology', shift: '08:30 - 16:30', availability: 'On Duty', activeCases: 3 },
    { id: 'stf-demo-6', name: 'Nurse Anitha', role: 'Charge Nurse', department: 'Emergency', shift: '07:00 - 15:00', availability: 'On Duty', activeCases: 11 },
    { id: 'stf-demo-7', name: 'Nurse Grace', role: 'Ward Nurse', department: 'General Medicine', shift: '14:00 - 22:00', availability: 'On Duty', activeCases: 8 },
    { id: 'stf-demo-8', name: 'Nurse Sunil', role: 'ICU Nurse', department: 'Cardiology', shift: '19:00 - 07:00', availability: 'Off Shift', activeCases: 0 },
  ];
  staff.forEach((member) => addUnique(db.staff, member));

  /* ---------------------------------- Agents ---------------------------------- */
  const agentUpdates: AgentProfile[] = [
    {
      id: 'agent-clinical', name: 'Clinical Assistant', shortName: 'Clinical', category: 'Clinical Documentation',
      description: 'Synthesizes authorized patient history and prepares structured pre-consult briefs for clinician sign-off.',
      highlights: ['Medical record summaries', 'Patient history retrieval', 'Clinical documentation assistance'],
      status: 'Active', assignedTasks: 42, completedTasks: 38, pendingTasks: 4, avgResponseSeconds: 1.8,
      recentActivity: [
        { id: 'aa-demo-clin-1', timestamp: minutesAgo(24), summary: 'Prepared pre-consult brief for Ananya Rao', department: 'Cardiology', outcome: 'Awaiting Review' },
        { id: 'aa-demo-clin-2', timestamp: atDaysAgo(1, 10, 15), summary: 'Summarized post-operative history for Meera Krishnan', department: 'General Medicine', outcome: 'Completed' },
      ],
    },
    {
      id: 'agent-operations', name: 'Operations Agent', shortName: 'Operations', category: 'Shift & Task Coordination',
      description: 'Coordinates hospital shift handoffs, operational tasks, and cross-department queue routing.',
      highlights: ['Staff coordination', 'Operational tasks', 'Bottleneck identification'],
      status: 'Active', assignedTasks: 58, completedTasks: 51, pendingTasks: 7, avgResponseSeconds: 2.1,
      recentActivity: [
        { id: 'aa-demo-ops-1', timestamp: minutesAgo(18), summary: 'Routed emergency surge task to charge nurse', department: 'Emergency', outcome: 'Completed' },
        { id: 'aa-demo-ops-2', timestamp: atDaysAgo(1, 17, 40), summary: 'Published shift handoff summary', department: 'Hospital-Wide', outcome: 'Completed' },
      ],
    },
    {
      id: 'agent-analytics', name: 'Analytics Agent', shortName: 'Analytics', category: 'Executive Analytics',
      description: 'Aggregates cross-department operational activity into wait-time and capacity insights.',
      highlights: ['Hospital analytics', 'Performance insights', 'Cross-department intelligence'],
      status: 'Active', assignedTasks: 31, completedTasks: 29, pendingTasks: 2, avgResponseSeconds: 2.4,
      recentActivity: [
        { id: 'aa-demo-anal-1', timestamp: minutesAgo(35), summary: 'Compiled wait-time trend for Cardiology and Emergency', department: 'Analytics', outcome: 'Completed' },
        { id: 'aa-demo-anal-2', timestamp: atDaysAgo(1, 8, 30), summary: 'Generated daily occupancy brief', department: 'Analytics', outcome: 'Completed' },
      ],
    },
    {
      id: 'agent-compliance', name: 'Compliance Agent', shortName: 'Compliance', category: 'Governance & Audit',
      description: 'Verifies onboarding documentation completeness, consent boundaries, and audit trail integrity.',
      highlights: ['Document verification', 'Consent checks', 'Audit log monitoring'],
      status: 'Active', assignedTasks: 26, completedTasks: 24, pendingTasks: 2, avgResponseSeconds: 1.6,
      recentActivity: [
        { id: 'aa-demo-comp-1', timestamp: atDaysAgo(2, 9, 45), summary: 'Flagged missing accreditation document', department: 'Onboarding', outcome: 'Escalated' },
        { id: 'aa-demo-comp-2', timestamp: atDaysAgo(5, 12, 25), summary: 'Verified Green Valley registration packet', department: 'Onboarding', outcome: 'Completed' },
      ],
    },
    {
      id: 'agent-support', name: 'Support Agent', shortName: 'Support', category: 'Onboarding & Intake',
      description: 'Assists new hospital applicants with onboarding requests, document submissions, and scheduling.',
      highlights: ['Hospital onboarding', 'Application intake', 'Workspace guidance'],
      status: 'Active', assignedTasks: 19, completedTasks: 17, pendingTasks: 2, avgResponseSeconds: 1.4,
      recentActivity: [
        { id: 'aa-demo-supp-1', timestamp: minutesAgo(90), summary: 'Acknowledged Sunrise hospital application', department: 'Onboarding', outcome: 'Completed' },
        { id: 'aa-demo-supp-2', timestamp: atDaysAgo(3, 10, 5), summary: 'Sent document request to Apollo Diagnostics', department: 'Onboarding', outcome: 'Completed' },
      ],
    },
    {
      id: 'agent-flow', name: 'Patient Flow Agent', shortName: 'Flow', category: 'Throughput & Beds',
      description: 'Coordinates outpatient queues, inpatient admissions, and bed turnover readiness.',
      highlights: ['Queue coordination', 'Admission workflows', 'Discharge turnover'],
      status: 'Active', assignedTasks: 47, completedTasks: 41, pendingTasks: 6, avgResponseSeconds: 2.0,
      recentActivity: [
        { id: 'aa-demo-flow-1', timestamp: minutesAgo(12), summary: 'Identified 37 available beds for admissions', department: 'Beds & Resources', outcome: 'Completed' },
        { id: 'aa-demo-flow-2', timestamp: atDaysAgo(1, 16, 20), summary: 'Coordinated discharge turnover for ER Observation', department: 'Emergency', outcome: 'Completed' },
      ],
    },
  ];
  agentUpdates.forEach((update) => {
    const existing = db.agents.find((agent) => agent.id === update.id);
    if (!existing) {
      db.agents.push(update);
      return;
    }
    if (existing.assignedTasks === 0 && existing.completedTasks === 0 && existing.recentActivity.length === 0) {
      Object.assign(existing, update);
    }
  });

  /* -------------------------------- Workflows --------------------------------- */
  const workflowUpdates: WorkflowDefinition[] = [
    {
      id: 'wf-onboarding', name: 'Hospital Application Review & Provisioning',
      description: 'Routes incoming hospital applications to Super Admin review, provisions HSP ID, and activates workspace upon approval.',
      trigger: 'Hospital submits onboarding or signup request', condition: 'Organization details and contact email validated',
      agentId: 'agent-compliance', agentName: 'Compliance Agent',
      action: 'Validate registration fields & queue for Super Admin decision',
      requiresApproval: true, completionOutcome: 'Hospital added to Directory & workspace activated',
      active: true, executionsCount: 14, lastRunAt: atDaysAgo(1, 16, 6),
    },
    {
      id: 'wf-discharge', name: 'Inpatient Discharge & Bed Turnover',
      description: 'Coordinates discharge clearance, sanitization, and bed availability updates once patients are admitted.',
      trigger: 'Attending marks patient ready for discharge', condition: 'Medication & lab clearance verified',
      agentId: 'agent-flow', agentName: 'Patient Flow Agent',
      action: 'Notify Environmental Services and update bed capacity',
      requiresApproval: true, completionOutcome: 'Bed marked available for incoming admission',
      active: true, executionsCount: 9, lastRunAt: atDaysAgo(1, 16, 22),
    },
  ];
  const extraWorkflows: WorkflowDefinition[] = [
    {
      id: 'wf-demo-radiology', name: 'Radiology Report & Patient Billing Sync',
      description: 'Routes completed X-ray reports to the patient portal and creates the matching billing record.',
      trigger: 'Radiologist uploads an X-ray report', condition: 'Report findings and impression are present',
      agentId: 'agent-clinical', agentName: 'Clinical Assistant',
      action: 'Publish report to patient portal and raise $150 invoice',
      requiresApproval: false, completionOutcome: 'Patient, doctor, radiology, and billing dashboards synchronized',
      active: true, executionsCount: 6, lastRunAt: minutesAgo(18),
    },
    {
      id: 'wf-demo-revenue', name: 'Revenue Cycle & Claims Review',
      description: 'Coordinates billing discrepancies, TPA claim status, and pending insurance approvals.',
      trigger: 'Insurance or billing record flagged for review', condition: 'Claim value or invoice amount is verified',
      agentId: 'agent-operations', agentName: 'Operations Agent',
      action: 'Notify Finance and Insurance teams with supporting record',
      requiresApproval: true, completionOutcome: 'Approved claim or corrected invoice posted to billing',
      active: true, executionsCount: 11, lastRunAt: minutesAgo(52),
    },
  ];
  workflowUpdates.forEach((update) => {
    const existing = db.workflows.find((workflow) => workflow.id === update.id);
    if (!existing) {
      db.workflows.push(update);
      return;
    }
    if (existing.executionsCount === 0 && existing.lastRunAt === 'No runs yet') {
      Object.assign(existing, update);
    }
  });
  extraWorkflows.forEach((workflow) => addUnique(db.workflows, workflow));

  /* ------------------------------ Integrations -------------------------------- */
  const supported = db.integrations.filter((item) => item.availability === 'supported');
  if (supported.length > 0 && supported.every((item) => !item.connected)) {
    supported.forEach((item) => {
      item.connected = true;
    });
  }

  /* ---------------------------------- Tasks ----------------------------------- */
  const tasks: OperationalTask[] = [
    { id: 'task-demo-1', title: 'Review flagged emergency claim', department: 'Insurance & Claims', assignedAgent: 'Compliance Agent', priority: 'Urgent', status: 'Pending', dueTime: '12:00' },
    { id: 'task-demo-2', title: 'Confirm pending cardiology appointments', department: 'Cardiology', assignedAgent: 'Operations Agent', priority: 'High', status: 'In Progress', dueTime: '13:30' },
    { id: 'task-demo-3', title: 'Review radiology report awaiting sign-off', department: 'Radiology', assignedAgent: 'Clinical Assistant', priority: 'High', status: 'Pending', dueTime: '14:15' },
    { id: 'task-demo-4', title: 'Reconcile billing discrepancy INV-1006', department: 'Finance & Billing', assignedAgent: 'Operations Agent', priority: 'Normal', status: 'Pending', dueTime: '16:00' },
    { id: 'task-demo-5', title: 'Publish preventive care campaign', department: 'Marketing', assignedAgent: 'Analytics Agent', priority: 'Normal', status: 'Completed', dueTime: '11:00' },
  ];
  tasks.forEach((task) => addUnique(db.tasks, task));

  /* --------------------------- ModuleRecords ---------------------------------- */
  const moduleRecords: HospitalModuleRecord[] = [
    { id: 'mod-demo-rad-1', module: 'radiology', referenceCode: 'RAD-1001', title: 'Chest X-Ray report ready', subtitle: 'Ananya Rao · MRN-10001', status: 'Completed', amountOrCount: '$150', createdAt: minutesAgo(18) },
    { id: 'mod-demo-rad-2', module: 'radiology', referenceCode: 'RAD-1002', title: 'STAT chest X-Ray in progress', subtitle: 'Vikram Shetty · MRN-10002', status: 'Pending Review', amountOrCount: 'STAT', createdAt: minutesAgo(35) },
    { id: 'mod-demo-rad-3', module: 'radiology', referenceCode: 'RAD-1003', title: 'Follow-up imaging queued', subtitle: 'Siddharth Verma · MRN-10006', status: 'Active', amountOrCount: 'Routine', createdAt: minutesAgo(10) },
    { id: 'mod-demo-lab-1', module: 'laboratory', referenceCode: 'LAB-1001', title: 'Complete blood count resulted', subtitle: 'Fatima Begum · MRN-10007', status: 'Completed', amountOrCount: '18 min', createdAt: minutesAgo(70) },
    { id: 'mod-demo-lab-2', module: 'laboratory', referenceCode: 'LAB-1002', title: 'HbA1c panel awaiting review', subtitle: 'Vikram Shetty · MRN-10002', status: 'Pending Review', amountOrCount: '34 min', createdAt: minutesAgo(34) },
    { id: 'mod-demo-pharm-1', module: 'pharmacy', referenceCode: 'RX-1001', title: 'Azithromycin dispensed', subtitle: 'Fatima Begum · Ward GEN-14', status: 'Completed', amountOrCount: '5 units', createdAt: minutesAgo(120) },
    { id: 'mod-demo-pharm-2', module: 'pharmacy', referenceCode: 'RX-1002', title: 'Metoprolol stock below threshold', subtitle: 'Cardiology formulary', status: 'Flagged', amountOrCount: '12 units left', createdAt: minutesAgo(85) },
    { id: 'mod-demo-bill-1', module: 'billing', referenceCode: 'INV-1001', title: 'X-Ray consultation invoice', subtitle: 'Ananya Rao · MRN-10001', status: 'Pending Review', amountOrCount: '$150', createdAt: minutesAgo(18) },
    { id: 'mod-demo-bill-2', module: 'billing', referenceCode: 'INV-1002', title: 'Emergency consultation paid', subtitle: 'Vikram Shetty · MRN-10002', status: 'Completed', amountOrCount: '$320', createdAt: atDaysAgo(1, 10, 20) },
    { id: 'mod-demo-bill-3', module: 'billing', referenceCode: 'INV-1003', title: 'Duplicate private-room charge', subtitle: 'Meera Krishnan · MRN-10003', status: 'Flagged', amountOrCount: '$85', createdAt: minutesAgo(52) },
    { id: 'mod-demo-ins-1', module: 'insurance', referenceCode: 'CLM-1001', title: 'TPA pre-authorization required', subtitle: 'Green Valley TPA · Cardiology', status: 'Pending Review', amountOrCount: '$1,240', createdAt: minutesAgo(66) },
    { id: 'mod-demo-ins-2', module: 'insurance', referenceCode: 'CLM-1002', title: 'Discharge claim cleared', subtitle: 'Ravi Teja · MRN-10004', status: 'Completed', amountOrCount: '$2,180', createdAt: atDaysAgo(1, 15, 40) },
    { id: 'mod-demo-ins-3', module: 'insurance', referenceCode: 'CLM-1003', title: 'Claim documents requested', subtitle: 'Apollo TPA · Emergency', status: 'Flagged', amountOrCount: '$640', createdAt: minutesAgo(95) },
    { id: 'mod-demo-inv-1', module: 'inventory', referenceCode: 'SKU-1001', title: 'Surgical gloves restock ordered', subtitle: 'Central Store', status: 'Active', amountOrCount: '400 units', createdAt: minutesAgo(140) },
    { id: 'mod-demo-inv-2', module: 'inventory', referenceCode: 'SKU-1002', title: 'IV fluid inventory verified', subtitle: 'Emergency Store', status: 'Completed', amountOrCount: '180 units', createdAt: atDaysAgo(1, 9, 15) },
    { id: 'mod-demo-sales-1', module: 'sales', referenceCode: 'CRM-1001', title: 'Corporate health partnership', subtitle: 'Tech Park Vijayawada · 400 employees', status: 'Active', amountOrCount: '$18,000', createdAt: atDaysAgo(2, 11, 30) },
    { id: 'mod-demo-sales-2', module: 'sales', referenceCode: 'CRM-1002', title: 'Referral physician meeting', subtitle: 'Dr. Ramesh Kulkarni · Cardiology', status: 'Pending Review', amountOrCount: '$4,500', createdAt: atDaysAgo(1, 14, 0) },
    { id: 'mod-demo-mkt-1', module: 'marketing', referenceCode: 'CMP-1001', title: 'Preventive cardiac camp', subtitle: 'Instagram · Facebook · Local outreach', status: 'Active', amountOrCount: '12,400 reach', createdAt: minutesAgo(180) },
    { id: 'mod-demo-mkt-2', module: 'marketing', referenceCode: 'CMP-1002', title: 'Post-discharge check-in campaign', subtitle: 'SMS · WhatsApp consent list', status: 'Completed', amountOrCount: '2,180 patients', createdAt: atDaysAgo(2, 10, 0) },
  ];
  moduleRecords.forEach((record) => addUnique(db.moduleRecords, record));

  /* ------------------------- Workflow executions / agent output ---------------- */
  const makeMessage = (
    id: string,
    step: number,
    fromKey: InterAgentMessage['fromKey'],
    fromAgent: string,
    toKey: InterAgentMessage['toKey'],
    toAgent: string,
    department: string,
    message: string,
    status: InterAgentMessage['status'] = 'completed'
  ): InterAgentMessage => ({
    id, step, fromKey, fromAgent, toKey, toAgent, department, message, status, timestamp: minutesAgo(60 - step * 6),
  });

  const makeAlert = (
    id: string,
    workflowId: string,
    workflowCode: string,
    department: string,
    agentName: string,
    summary: string,
    priority: DepartmentAlertItem['priority'],
    targetPath: string,
    requiresApproval: boolean,
    status: DepartmentAlertItem['status'] = 'Delivered (In-App)'
  ): DepartmentAlertItem => ({
    id, workflowId, workflowCode, department, agentName, summary, priority,
    timestamp: minutesAgo(45), status, targetPath, requiresApproval,
  });

  const workflowExecutions: WorkflowExecutionRecord[] = [
    {
      id: 'wfe-demo-1',
      workflowCode: 'WF-REV-2026-001',
      instruction: 'Check all pending insurance claims and notify the insurance department.',
      intentSummary: 'Review pending insurance records and route flagged claims to the insurance team with finance oversight.',
      executedAt: minutesAgo(52), executionMs: 2840, participatingAgents: ['insurance', 'finance', 'operations'],
      status: 'Awaiting Approval',
      voiceConfirmation: 'Three claims need review. Insurance and finance teams notified.',
      executiveBrief: 'Three insurance records require attention: CLM-1001 pre-authorization, CLM-1003 missing documents, and CLM-1002 is cleared. Finance flagged one duplicate invoice for correction.',
      interAgentMessages: [
        makeMessage('iam-demo-1-1', 1, 'core', 'CareOS Core', 'insurance', 'Compliance Agent', 'Onboarding', 'Verify pending claim documents before clearance.'),
        makeMessage('iam-demo-1-2', 2, 'insurance', 'Compliance Agent', 'finance', 'Operations Agent', 'Insurance & Claims', 'Two claims need finance reconciliation.', 'warning'),
        makeMessage('iam-demo-1-3', 3, 'finance', 'Operations Agent', 'core', 'CareOS Core', 'Finance & Billing', 'Duplicate invoice requires human approval.', 'pending_approval'),
      ],
      departmentalAlerts: [
        makeAlert('dal-demo-1-1', 'wfe-demo-1', 'WF-REV-2026-001', 'Insurance & Claims', 'Compliance Agent', 'TPA pre-authorization pending for CLM-1001', 'High', '/dashboard/module/insurance', true),
        makeAlert('dal-demo-1-2', 'wfe-demo-1', 'WF-REV-2026-001', 'Finance & Billing', 'Operations Agent', 'Duplicate charge flagged on INV-1003', 'High', '/dashboard/module/billing', true),
      ],
      pendingApprovals: [
        { id: 'apr-demo-1-1', title: 'Approve insurance claim correction', department: 'Insurance & Claims', description: 'Correct CLM-1003 document set before TPA resubmission.', actionType: 'insurance', approved: false },
        { id: 'apr-demo-1-2', title: 'Approve duplicate invoice reversal', department: 'Finance & Billing', description: 'Reverse $85 duplicate private-room charge on INV-1003.', actionType: 'financial', approved: false },
      ],
      reportTitle: 'Insurance & Claims Clearance Brief',
      reportSections: [
        { title: 'Claims Reviewed', items: [{ label: 'Pending authorization', value: 'CLM-1001 · $1,240' }, { label: 'Documents requested', value: 'CLM-1003 · $640' }, { label: 'Cleared', value: 'CLM-1002 · $2,180' }] },
        { title: 'Finance Exceptions', items: [{ label: 'Flagged invoice', value: 'INV-1003 · $85' }, { label: 'Required action', value: 'Human approval before reversal' }] },
      ],
    },
    {
      id: 'wfe-demo-2',
      workflowCode: 'WF-RAD-2026-002',
      instruction: 'Check all pending radiology reports and notify the concerned doctors.',
      intentSummary: 'Identify outstanding X-ray reports and notify ordering clinicians with patient context.',
      executedAt: minutesAgo(30), executionMs: 1960, participatingAgents: ['radiology', 'operations'],
      status: 'Completed',
      voiceConfirmation: 'Two radiology items need attention. Doctors have been notified.',
      executiveBrief: 'RAD-DEMO-0002 is in progress for Vikram Shetty and RAD-DEMO-0003 is pending for Siddharth Verma. Ananya Rao report is complete and billed at $150.',
      interAgentMessages: [
        makeMessage('iam-demo-2-1', 1, 'core', 'CareOS Core', 'radiology', 'Clinical Assistant', 'Radiology', 'List open imaging orders with patient and doctor.'),
        makeMessage('iam-demo-2-2', 2, 'radiology', 'Clinical Assistant', 'operations', 'Operations Agent', 'Radiology', 'Notify ordering doctors about two open reports.'),
        makeMessage('iam-demo-2-3', 3, 'operations', 'Operations Agent', 'core', 'CareOS Core', 'Doctor Queue', 'Notifications delivered to clinicians.'),
      ],
      departmentalAlerts: [
        makeAlert('dal-demo-2-1', 'wfe-demo-2', 'WF-RAD-2026-002', 'Radiology', 'Clinical Assistant', 'STAT X-Ray still in progress for Vikram Shetty', 'Urgent', '/dashboard/radiology', false, 'Acknowledged'),
        makeAlert('dal-demo-2-2', 'wfe-demo-2', 'WF-RAD-2026-002', 'Cardiology', 'Operations Agent', 'Follow-up imaging pending for Siddharth Verma', 'Normal', '/dashboard/doctor-queue', false),
      ],
      pendingApprovals: [],
      reportTitle: 'Radiology Pending Report Brief',
      reportSections: [
        { title: 'Open Orders', items: [{ label: 'STAT', value: 'RAD-DEMO-0002 · Vikram Shetty' }, { label: 'Routine', value: 'RAD-DEMO-0003 · Siddharth Verma' }] },
        { title: 'Completed', items: [{ label: 'Report', value: 'RAD-DEMO-0001 · No acute cardiopulmonary abnormality' }, { label: 'Bill', value: 'BILL-DEMO-0001 · $150 pending' }] },
      ],
    },
    {
      id: 'wfe-demo-3',
      workflowCode: 'WF-OPS-2026-003',
      instruction: "Prepare today's complete hospital operational report.",
      intentSummary: 'Compile patient flow, bed capacity, and department wait-time metrics into an executive brief.',
      executedAt: minutesAgo(12), executionMs: 2210, participatingAgents: ['operations', 'finance', 'marketing'],
      status: 'Completed',
      voiceConfirmation: 'Daily operations brief is ready. 37 beds are available.',
      executiveBrief: 'The hospital has 8 patients in the demo registry, 8 appointments today, and 108 of 150 beds in use. Emergency has the longest average wait at 21 minutes. Marketing reached 12,400 patients this week.',
      interAgentMessages: [
        makeMessage('iam-demo-3-1', 1, 'core', 'CareOS Core', 'operations', 'Operations Agent', 'Patient Operations', 'Aggregate today’s appointments, admissions, and bed capacity.'),
        makeMessage('iam-demo-3-2', 2, 'operations', 'Operations Agent', 'finance', 'Operations Agent', 'Finance & Billing', 'Attach billing and revenue queue status.'),
        makeMessage('iam-demo-3-3', 3, 'finance', 'Operations Agent', 'marketing', 'Analytics Agent', 'Marketing', 'Include outreach attribution for the weekly campaign.'),
      ],
      departmentalAlerts: [
        makeAlert('dal-demo-3-1', 'wfe-demo-3', 'WF-OPS-2026-003', 'Emergency', 'Operations Agent', 'Emergency wait time is 21 minutes, above target', 'High', '/dashboard/departments', false, 'Acknowledged'),
      ],
      pendingApprovals: [],
      reportTitle: "Today's Hospital Operational Report",
      reportSections: [
        { title: 'Patient Flow', items: [{ label: 'Patients', value: '8' }, { label: 'Appointments', value: '8 today' }, { label: 'Active admissions', value: '3' }] },
        { title: 'Capacity', items: [{ label: 'Beds available', value: '37 of 150' }, { label: 'Occupancy', value: '72%' }, { label: 'Longest wait', value: '21 min · Emergency' }] },
        { title: 'Outreach', items: [{ label: 'Campaign reach', value: '12,400' }, { label: 'Check-in list', value: '2,180 patients' }] },
      ],
    },
    {
      id: 'wfe-demo-4',
      workflowCode: 'WF-SALE-2026-004',
      instruction: 'Analyze today’s revenue and identify billing discrepancies.',
      intentSummary: 'Scan billing and sales records for discrepancies and summarize revenue exposure.',
      executedAt: minutesAgo(78), executionMs: 3120, participatingAgents: ['finance', 'sales', 'insurance'],
      status: 'Awaiting Approval',
      voiceConfirmation: 'One billing discrepancy and two follow-ups need approval.',
      executiveBrief: 'INV-1003 is flagged as a duplicate $85 charge. CRM-1002 partnership value is pending review. CLM-1001 authorization is still pending with the TPA.',
      interAgentMessages: [
        makeMessage('iam-demo-4-1', 1, 'core', 'CareOS Core', 'finance', 'Operations Agent', 'Finance & Billing', 'Identify flagged invoices and revenue discrepancies.'),
        makeMessage('iam-demo-4-2', 2, 'finance', 'Operations Agent', 'sales', 'Support Agent', 'Sales & Leads', 'Cross-check partnership values with billing entries.', 'warning'),
        makeMessage('iam-demo-4-3', 3, 'sales', 'Support Agent', 'insurance', 'Compliance Agent', 'Insurance & Claims', 'Confirm TPA authorization status before posting.', 'pending_approval'),
      ],
      departmentalAlerts: [
        makeAlert('dal-demo-4-1', 'wfe-demo-4', 'WF-SALE-2026-004', 'Finance & Billing', 'Operations Agent', 'Duplicate invoice INV-1003 requires approval', 'Urgent', '/dashboard/module/billing', true),
        makeAlert('dal-demo-4-2', 'wfe-demo-4', 'WF-SALE-2026-004', 'Sales & Leads', 'Support Agent', 'CRM-1002 partnership value awaiting review', 'Normal', '/dashboard/module/sales', false),
      ],
      pendingApprovals: [
        { id: 'apr-demo-4-1', title: 'Approve revenue adjustment', department: 'Finance & Billing', description: 'Reverse flagged duplicate charge on INV-1003 before finalizing daily revenue.', actionType: 'financial', approved: false },
      ],
      reportTitle: 'Revenue & Billing Discrepancy Brief',
      reportSections: [
        { title: 'Revenue', items: [{ label: 'Collected today', value: '$470' }, { label: 'Pending invoices', value: '$150' }, { label: 'Flagged amount', value: '$85' }] },
        { title: 'Follow-ups', items: [{ label: 'CRM', value: 'CRM-1002 · $4,500 pending' }, { label: 'TPA', value: 'CLM-1001 · $1,240 pending' }] },
      ],
    },
  ];
  workflowExecutions.forEach((execution) => addUnique(db.workflowExecutions, execution));

  /* ---------------------------- Departmental alerts --------------------------- */
  workflowExecutions.forEach((execution) => {
    execution.departmentalAlerts.forEach((alert) => addUnique(db.departmentalAlerts, alert));
  });

  /* ------------------------------ Notifications ------------------------------- */
  const notifications: HospitalNotification[] = [
    { id: 'not-demo-1', title: 'X-ray report ready', detail: 'Ananya Rao · Chest X-Ray · No acute cardiopulmonary abnormality.', department: 'Radiology', severity: 'info', timestamp: minutesAgo(18), read: false, patientId: 'pat-demo-1' },
    { id: 'not-demo-2', title: 'New patient bill', detail: 'Ananya Rao · X-Ray · $150.00', department: 'Finance & Billing', severity: 'warning', timestamp: minutesAgo(18), read: false, patientId: 'pat-demo-1' },
    { id: 'not-demo-3', title: 'STAT radiology referral', detail: 'Vikram Shetty · Dr. Priya Nair · Chest X-Ray', department: 'Radiology', severity: 'critical', timestamp: minutesAgo(35), read: false, patientId: 'pat-demo-2' },
    { id: 'not-demo-4', title: 'Insurance authorization pending', detail: 'CLM-1001 · Green Valley TPA · $1,240', department: 'Insurance & Claims', severity: 'warning', timestamp: minutesAgo(66), read: false },
    { id: 'not-demo-5', title: 'Billing discrepancy flagged', detail: 'INV-1003 · Duplicate private-room charge · $85', department: 'Finance & Billing', severity: 'critical', timestamp: minutesAgo(52), read: false },
    { id: 'not-demo-6', title: 'Emergency wait time elevated', detail: 'Average wait 21 minutes across 9 active cases.', department: 'Emergency', severity: 'warning', timestamp: minutesAgo(12), read: false },
    { id: 'not-demo-7', title: 'Preventive care campaign live', detail: 'CMP-1001 · 12,400 reach across social channels.', department: 'Marketing', severity: 'info', timestamp: minutesAgo(180), read: true },
    { id: 'not-demo-8', title: 'Corporate partnership lead', detail: 'CRM-1001 · Tech Park Vijayawada · $18,000 estimated value.', department: 'Sales & Leads', severity: 'info', timestamp: atDaysAgo(2, 11, 30), read: false },
  ];
  notifications.forEach((notification) => addUnique(db.notifications, notification));

  /* -------------------------------- Audit logs -------------------------------- */
  const auditLogs: AuditLogEntry[] = [
    { id: 'aud-demo-1', timestamp: minutesAgo(18), actorEmail: 'hospital@gmail.com', actorRole: 'coordinator', action: 'RADIOLOGY_REPORT_PUBLISHED', resource: 'RAD-DEMO-0001', outcome: 'Allowed' },
    { id: 'aud-demo-2', timestamp: minutesAgo(18), actorEmail: 'system', actorRole: 'system', action: 'PATIENT_BILL_CREATED', resource: 'BILL-DEMO-0001', outcome: 'Allowed' },
    { id: 'aud-demo-3', timestamp: minutesAgo(52), actorEmail: 'system', actorRole: 'system', action: 'AGENTIC_ORCHESTRATION_COMPLETED', resource: 'WF-REV-2026-001', outcome: 'Allowed' },
    { id: 'aud-demo-4', timestamp: atDaysAgo(1, 16, 6), actorEmail: 'admin@gmail.com', actorRole: 'admin', action: 'HOSPITAL_APPLICATION_APPROVED', resource: 'APP-DEMO-0001', outcome: 'Allowed' },
  ];
  auditLogs.forEach((entry) => addUnique(db.auditLogs, entry));

  changed = JSON.stringify(db) !== before;
  return changed;
}
