import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  BedDouble,
  Bell,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  HeartPulse,
  Info,
  KeyRound,
  LayoutGrid,
  Megaphone,
  Network,
  Paperclip,
  RefreshCw,
  Scan,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type {
  ApprovedHospital,
  DashboardOverviewData,
  HospitalApplication,
  OrchestratorAgentKey,
  WorkflowExecutionRecord,
} from '../../types/careos';
import { SuperAdminCommandCenter } from './SuperAdminPages';
import { cn, formatTimeAgo } from '../../lib/utils';
import clinicianAvatar from '../../assets/images/careos_clinician_avatar_1795255997737.jpg';
import {
  VoiceControlButton,
  VoiceSynthesisStatusBadge,
  VoiceWaveform,
  speakCareOSConfirmation,
  useVoiceAssistant,
} from '../../components/careos/VoiceAssistant';
import { AgentExecutionOverlay, type ExecutionPhase } from '../../components/careos/AgentExecutionOverlay';
import { AgentNetwork, type NodeVisualStatus } from '../../components/careos/AgentNetwork';
import { AGENT_CONNECTED_TOOLS, ConnectedToolsRow } from '../../components/careos/ConnectedTools';

const CLINICIAN_AVATAR_PATH = clinicianAvatar;

// =========================================================================
// FIRST-LOGIN MANDATORY PASSWORD CHANGE MODAL
// =========================================================================
function FirstLoginChangePasswordModal() {
  const { user, changeDefaultPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Please choose a new password different from the default password.');
      return;
    }
    setSubmitting(true);
    try {
      await changeDefaultPassword(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-password-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3.5 border-b border-[#E3EDF6] pb-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 id="force-password-title" className="font-display text-lg font-bold text-[#102653]">
              Change Your Default Password
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#71839C]">
              Welcome to <span className="font-semibold text-[#102653]">{user?.hospitalName}</span>. For workspace
              security, please verify your default password and set a private password before continuing.
            </p>
          </div>
        </div>

        {user?.applicationId && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] px-3.5 py-2.5 text-xs">
            <span className="text-[#71839C]">Hospital Username (App ID)</span>
            <span className="font-mono font-bold text-[#3299F5]">{user.applicationId}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label htmlFor="default-pass-input" className="block text-xs font-semibold text-[#102653]">
              Default / Current Password
            </label>
            <div className="relative mt-1">
              <input
                id="default-pass-input"
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter default onboarding password"
                className="h-10 w-full rounded-xl border border-[#E3EDF6] px-3.5 pr-10 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                aria-label="Toggle default password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71839C] hover:text-[#102653]"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="new-pass-input" className="block text-xs font-semibold text-[#102653]">
              New Password (min. 8 characters)
            </label>
            <div className="relative mt-1">
              <input
                id="new-pass-input"
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong password"
                className="h-10 w-full rounded-xl border border-[#E3EDF6] px-3.5 pr-10 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                aria-label="Toggle new password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71839C] hover:text-[#102653]"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-pass-input" className="block text-xs font-semibold text-[#102653]">
              Confirm New Password
            </label>
            <input
              id="confirm-pass-input"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3.5 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3299F5] text-xs font-semibold text-white transition-colors hover:bg-[#2383db] disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? 'Updating Password...' : 'Update Password & Unlock Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// PENDING APPLICANT VIEW (SELF-SIGNUP AWAITING SUPER ADMIN APPROVAL)
// =========================================================================
function ApplicantOnboardingStatusView() {
  const { user, apiFetch, refreshMe } = useAuth();
  const [application, setApplication] = useState<HospitalApplication | null>(null);
  const [hospital, setHospital] = useState<ApprovedHospital | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const [documentName, setDocumentName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        userStatus: string;
        application: HospitalApplication | null;
        hospital: ApprovedHospital | null;
      }>('/api/applicant/status');
      setApplication(res.application);
      setHospital(res.hospital);
      if (res.userStatus === 'active') {
        await refreshMe();
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, refreshMe]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await loadStatus();
      await refreshMe();
    } finally {
      setChecking(false);
    }
  };

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentName.trim() && !note.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      await apiFetch('/api/applicant/resubmit', {
        method: 'POST',
        body: JSON.stringify({ documentName: documentName.trim(), note: note.trim() }),
      });
      setDocumentName('');
      setNote('');
      setFeedback('Your documents and note have been submitted to CareOS Platform Governance.');
      await loadStatus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashboardLayout
      title="Hospital Onboarding Status"
      breadcrumb="Onboarding"
      subtitle={`Track verification progress for ${user?.hospitalName || 'your organization'}.`}
      actions={
        <button
          type="button"
          onClick={handleRefresh}
          disabled={checking}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E3EDF6] bg-white px-4 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-[#3299F5]', checking && 'animate-spin')} />
          {checking ? 'Checking...' : 'Check Approval Status'}
        </button>
      }
    >
      {loading ? (
        <div className="h-64 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
      ) : !application ? (
        <div className="rounded-2xl border border-[#E3EDF6] bg-white p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-[#3299F5]" />
          <h2 className="mt-3 font-display text-lg font-bold text-[#102653]">Workspace Provisioning Pending</h2>
          <p className="mt-1 text-sm text-[#71839C]">Your account is awaiting CareOS Super Admin verification.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {application.status === 'Docs Requested' && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <div>
                <div className="font-semibold">Additional Verification Requested</div>
                <p className="mt-1 text-xs text-amber-800">
                  {application.requestedMessage || 'Please submit your Hospital License or Registration Certificate below.'}
                </p>
              </div>
            </div>
          )}

          {application.status === 'Rejected' && (
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <div className="font-semibold">Application Not Approved</div>
                <p className="mt-1 text-xs text-red-700">
                  Contact CareOS platform governance or submit updated accreditation documents below for re-evaluation.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3EDF6] pb-4">
                <div>
                  <div className="font-mono text-xs text-[#3299F5] font-semibold">{application.applicationId}</div>
                  <h2 className="mt-1 font-display text-xl font-bold text-[#102653]">{application.hospitalName}</h2>
                </div>
                <span className="rounded-lg border border-[#3299F5]/25 bg-[#EAF5FF] px-3 py-1 text-xs font-semibold text-[#3299F5]">
                  {application.status}
                </span>
              </div>

              <div className="mt-7 grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[#3299F5] text-white">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[#102653]">Submitted</div>
                  <div className="text-[11px] text-[#71839C]">
                    {new Date(application.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                <div>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#3299F5] bg-[#EAF5FF] text-[#3299F5]">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[#102653]">Super Admin Review</div>
                  <div className="text-[11px] text-[#71839C]">{application.status}</div>
                </div>
                <div>
                  <div
                    className={cn(
                      'mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2',
                      hospital
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                        : 'border-[#E3EDF6] bg-[#F7FAFF] text-[#71839C]'
                    )}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="mt-2 text-xs font-semibold text-[#102653]">Workspace Ready</div>
                  <div className="text-[11px] text-[#71839C]">{hospital ? hospital.hospitalId : 'Pending'}</div>
                </div>
              </div>

              <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-[#E3EDF6] pt-5 text-xs">
                <div>
                  <dt className="text-[#71839C]">Hospital Type</dt>
                  <dd className="mt-0.5 font-semibold text-[#102653]">{application.hospitalType}</dd>
                </div>
                <div>
                  <dt className="text-[#71839C]">Location</dt>
                  <dd className="mt-0.5 font-semibold text-[#102653]">{application.location}</dd>
                </div>
                <div>
                  <dt className="text-[#71839C]">Capacity</dt>
                  <dd className="mt-0.5 font-mono text-[#102653]">
                    {application.bedsCount} beds · {application.departmentsCount} depts
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71839C]">Primary Contact</dt>
                  <dd className="mt-0.5 font-medium text-[#172B4D]">{application.contactPerson}</dd>
                </div>
              </dl>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-white p-6">
              <h3 className="font-display text-base font-bold text-[#102653]">Verification Documents</h3>
              <ul className="mt-3 space-y-2 text-xs">
                {application.documents.map((doc, i) => (
                  <li key={i} className="flex items-center justify-between rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 font-medium text-[#102653]">
                      <FileText className="h-3.5 w-3.5 text-[#3299F5]" />
                      {doc.name}
                    </span>
                    <span className="text-[#3299F5] font-semibold">{doc.status}</span>
                  </li>
                ))}
              </ul>

              {feedback && (
                <div className="mt-4 rounded-xl border border-[#3299F5]/30 bg-[#EAF5FF] px-3 py-2 text-xs text-[#102653]">
                  {feedback}
                </div>
              )}

              <form onSubmit={handleResubmit} className="mt-5 space-y-3 border-t border-[#E3EDF6] pt-4">
                <div className="text-xs font-semibold text-[#102653]">Submit Additional Document or Note</div>
                <input
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Document title (e.g., Clinical_Facility_License.pdf)"
                  className="h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-xs text-[#172B4D]"
                />
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Message for Super Admin review team..."
                  className="w-full rounded-xl border border-[#E3EDF6] p-3 text-xs text-[#172B4D]"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3299F5] text-xs font-semibold text-white hover:bg-[#2383db] disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitting ? 'Submitting...' : 'Submit Verification Update'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// =========================================================================
// MAIN EXPORT
// =========================================================================
export function CommandCenterPage() {
  const { user } = useAuth();

  if (user?.role === 'admin') {
    return <SuperAdminCommandCenter />;
  }

  if (user?.status !== 'active') {
    return <ApplicantOnboardingStatusView />;
  }

  return <HospitalCommandCenter />;
}

const SUGGESTED_INSTRUCTIONS = [
  "Prepare today's complete hospital operational report.",
  'Check all pending insurance claims and notify the insurance department.',
  'Check all pending radiology reports and notify the concerned doctors.',
  'Find available beds for emergency admissions.',
  "Analyze today's revenue and identify billing discrepancies.",
];

const AGENT_CARD_DEFS: Array<{
  key: OrchestratorAgentKey;
  title: string;
  responsibility: string;
  connectedWith: string;
  to: string;
  icon: typeof Banknote;
  nodeMatch: string;
}> = [
  {
    key: 'finance',
    title: 'Finance & Billing Agent',
    responsibility: 'Revenue audits, billing discrepancies & invoice reconciliation',
    connectedWith: 'Billing Ledger',
    to: '/dashboard/module/billing',
    icon: Banknote,
    nodeMatch: 'Finance & Billing',
  },
  {
    key: 'radiology',
    title: 'Radiology Agent',
    responsibility: 'Pending imaging reads, PACS queues & clinician notifications',
    connectedWith: 'PACS · RIS',
    to: '/dashboard/module/radiology',
    icon: Scan,
    nodeMatch: 'Radiology',
  },
  {
    key: 'operations',
    title: 'Patient Operations Agent',
    responsibility: 'Appointments, emergency bed allocation & inpatient flow',
    connectedWith: 'HIS · EMR',
    to: '/dashboard/appointments',
    icon: CalendarCheck,
    nodeMatch: 'Appointments & Patient Operations',
  },
  {
    key: 'insurance',
    title: 'Insurance & Discharge Agent',
    responsibility: 'Pending TPA approvals, claim clearance & discharge readiness',
    connectedWith: 'TPA Claims',
    to: '/dashboard/module/insurance',
    icon: ShieldCheck,
    nodeMatch: 'Insurance & Discharge',
  },
  {
    key: 'sales',
    title: 'Sales Agent',
    responsibility: 'Corporate partnerships, referral pipeline & inquiry tracking',
    connectedWith: 'CRM Pipeline',
    to: '/dashboard/module/sales',
    icon: TrendingUp,
    nodeMatch: 'Sales & Business Development',
  },
  {
    key: 'marketing',
    title: 'Marketing Agent',
    responsibility: 'Health camp campaigns, outreach reach & patient engagement',
    connectedWith: 'Campaigns',
    to: '/dashboard/module/marketing',
    icon: Megaphone,
    nodeMatch: 'Marketing Intelligence',
  },
];

const AGENT_SHORT_LABELS: Record<OrchestratorAgentKey, string> = {
  finance: 'Finance & Billing',
  radiology: 'Radiology',
  operations: 'Patient Operations',
  insurance: 'Insurance & Discharge',
  sales: 'Sales',
  marketing: 'Marketing',
};

// =========================================================================
// CAREOS ADVANCED AGENTIC HOSPITAL INTELLIGENCE SYSTEM
// =========================================================================
function HospitalCommandCenter() {
  const { user, apiFetch } = useAuth();
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const [commandInput, setCommandInput] = useState('');
  const [contextPickerOpen, setContextPickerOpen] = useState(false);
  const [workforceView, setWorkforceView] = useState<'chain' | 'cards'>('chain');
  const [selectedAgent, setSelectedAgent] = useState<OrchestratorAgentKey>('marketing');

  // Immersive Full-Screen Agent Execution Mode state
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [activeInstruction, setActiveInstruction] = useState('');
  const [executionPhase, setExecutionPhase] = useState<ExecutionPhase>('understanding');
  const [executionRecord, setExecutionRecord] = useState<WorkflowExecutionRecord | null>(null);
  const [overlayError, setOverlayError] = useState<string | null>(null);

  const runSeqRef = useRef(0);
  const voicePreferenceRef = useRef(true);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardOverviewData>('/api/dashboard/overview?range=today');
      setData(res);
      voicePreferenceRef.current = res.hospitalSettings.voiceResponsesEnabled;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load hospital overview.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const {
    voiceState,
    voiceError,
    startListening,
    stopListening,
    clearVoiceError,
  } = useVoiceAssistant({
    onTranscriptUpdate: (transcript) => {
      setCommandInput(transcript);
    },
  });

  const executeOrchestration = useCallback(
    async (rawText: string) => {
      const clean = rawText.trim();
      if (!clean) return;
      if (voiceState === 'listening') {
        stopListening(false);
      }

      const runId = ++runSeqRef.current;
      setActiveInstruction(clean);
      setExecutionRecord(null);
      setOverlayError(null);
      setExecutionPhase('understanding');
      setOverlayOpen(true);

      const coordTimer = window.setTimeout(() => {
        if (runSeqRef.current === runId) {
          setExecutionPhase((prev) => (prev === 'understanding' ? 'coordinating' : prev));
        }
      }, 480);

      try {
        const res = await apiFetch<{ execution: WorkflowExecutionRecord }>('/api/hospital/orchestrate', {
          method: 'POST',
          body: JSON.stringify({ instruction: clean }),
        });

        window.clearTimeout(coordTimer);
        if (runSeqRef.current !== runId) return;

        if (!res?.execution) {
          throw new Error('CareOS received an incomplete orchestration response. Please retry.');
        }

        const safeMessages = Array.isArray(res.execution.interAgentMessages)
          ? res.execution.interAgentMessages
          : [];
        const normalizedExecution: WorkflowExecutionRecord = {
          ...res.execution,
          interAgentMessages: safeMessages,
          departmentalAlerts: Array.isArray(res.execution.departmentalAlerts)
            ? res.execution.departmentalAlerts
            : [],
          pendingApprovals: Array.isArray(res.execution.pendingApprovals)
            ? res.execution.pendingApprovals
            : [],
          reportSections: Array.isArray(res.execution.reportSections)
            ? res.execution.reportSections
            : [],
        };

        setExecutionRecord(normalizedExecution);
        setExecutionPhase('executing');
        setCommandInput('');

        const revealMs = Math.max(900, Math.min(2600, (safeMessages.length || 1) * 420 + 260));

        window.setTimeout(() => {
          if (runSeqRef.current !== runId) return;
          setExecutionPhase('completed');
          speakCareOSConfirmation(normalizedExecution.voiceConfirmation, voicePreferenceRef.current);
          loadOverview();
        }, revealMs);
      } catch (err) {
        window.clearTimeout(coordTimer);
        if (runSeqRef.current !== runId) return;
        setOverlayError(
          err instanceof Error ? err.message : 'CareOS Intelligence could not complete orchestration.'
        );
        setExecutionPhase('error');
      }
    },
    [apiFetch, loadOverview, stopListening, voiceState]
  );

  const handleCommandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = commandInput.trim();
    if (!text) return;
    executeOrchestration(text);
  };

  const handleToggleVoice = () => {
    if (voiceState === 'listening') {
      stopListening(true);
    } else if (voiceState === 'idle') {
      clearVoiceError();
      startListening(commandInput);
    }
  };

  const handleToggleVoiceResponses = async () => {
    const nextValue = !(data?.hospitalSettings.voiceResponsesEnabled ?? true);
    voicePreferenceRef.current = nextValue;
    try {
      await apiFetch<{ voiceResponsesEnabled: boolean }>('/api/hospital/voice-settings', {
        method: 'PATCH',
        body: JSON.stringify({ voiceResponsesEnabled: nextValue }),
      });
      setData((prev) =>
        prev
          ? {
              ...prev,
              hospitalSettings: { ...prev.hospitalSettings, voiceResponsesEnabled: nextValue },
            }
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save voice preference.');
    }
  };

  const handleApproveItem = async (workflowId: string, approvalId: string) => {
    const res = await apiFetch<{ execution: WorkflowExecutionRecord }>(
      `/api/hospital/workflows/${workflowId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ approvalId }),
      }
    );
    setExecutionRecord(res.execution);
    await loadOverview();
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await apiFetch(`/api/hospital/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Acknowledged' }),
      });
      await loadOverview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to acknowledge departmental alert.');
    }
  };

  const handleOpenWorkflowHistory = (wf: WorkflowExecutionRecord) => {
    runSeqRef.current += 1;
    setActiveInstruction(wf.instruction);
    setExecutionRecord(wf);
    setOverlayError(null);
    setExecutionPhase('completed');
    setOverlayOpen(true);
  };

  const handleCloseOverlay = () => {
    runSeqRef.current += 1;
    setOverlayOpen(false);
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const attentionTotal = data
    ? data.needsAttentionSummary.pendingInsuranceApproval +
      data.needsAttentionSummary.reportsAwaitingReview +
      data.needsAttentionSummary.appointmentsConfirmationRequired
    : 0;

  const workflows = data?.workflowExecutions ?? [];
  const alerts = data?.departmentalAlerts ?? [];

  return (
    <DashboardLayout
      title="Home"
      breadcrumb="Home"
      hidePageTitle
      attentionBadgeCount={attentionTotal}
      departmentalAlerts={alerts}
      onAcknowledgeAlert={handleAcknowledgeAlert}
    >
      {user?.mustChangePassword && <FirstLoginChangePasswordModal />}

      {/* Immersive Full-Screen Agent Execution Mode */}
      <AgentExecutionOverlay
        open={overlayOpen}
        instruction={activeInstruction}
        phase={executionPhase}
        execution={executionRecord}
        errorMessage={overlayError}
        onRetry={() => executeOrchestration(activeInstruction)}
        onApproveItem={handleApproveItem}
        onClose={handleCloseOverlay}
      />

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-700 hover:text-red-900">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="space-y-6 pb-8">
        {/* SECTION A & B: Central CareOS AI Assistant Hero */}
        <section className="relative flex flex-col items-center text-center pt-2">
          <svg
            viewBox="0 0 380 120"
            className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 h-28 w-80 opacity-80"
            aria-hidden="true"
          >
            <path d="M 35 110 A 155 100 0 0 1 345 110" fill="none" stroke="#DCEBFB" strokeWidth="1.5" />
            <path d="M 80 110 A 110 75 0 0 1 300 110" fill="#EDF6FF" opacity="0.55" />
            <path d="M 240 24 h10 v-10 h10 v10 h10 v10 h-10 v10 h-10 v-10 h-10 z" fill="#9ED1FC" opacity="0.7" />
          </svg>

          <div className="relative z-10 h-16 w-16 rounded-full border-2 border-white bg-[#EAF5FF] shadow-md overflow-hidden flex items-center justify-center">
            {!avatarFailed ? (
              <img
                src={CLINICIAN_AVATAR_PATH}
                alt="CareOS Clinical Coordinator"
                onError={() => setAvatarFailed(true)}
                className="h-full w-full object-cover object-top"
              />
            ) : (
              <HeartPulse className="h-7 w-7 text-[#218AEF]" />
            )}
          </div>

          <h1 className="relative z-10 mt-2.5 font-display text-2xl sm:text-[30px] font-bold leading-tight tracking-tight text-[#102653]">
            {greeting}, Admin.
            <br />
            I&apos;m <span className="text-[#218AEF]">CareOS</span>. Your hospital is ready.
          </h1>
          <p className="relative z-10 mt-1.5 max-w-2xl text-xs sm:text-[13px] text-[#4F627D]">
            Speak or type any operational instruction. CareOS coordinates your departmental AI agents, dispatches
            targeted alerts, and compiles verified reports.
          </p>

          <div className="relative z-10 mt-3 flex flex-wrap items-center justify-center gap-3 text-xs">
            <VoiceSynthesisStatusBadge
              enabled={data?.hospitalSettings.voiceResponsesEnabled ?? true}
              onToggle={handleToggleVoiceResponses}
            />
            <span className="text-[11px] font-medium text-[#71839C]">
              Human Oversight: {data?.hospitalSettings.humanOversightRequired ? 'Enabled' : 'Standard'}
            </span>
          </div>
        </section>

        {/* Quick workspace administration entry point right after sign-in */}
        <section className="mx-auto w-full max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCEBFA] bg-[#F7FBFF] px-5 py-3.5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#218AEF]">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs font-bold text-[#102653]">Need to add a department or a team member?</div>
                <div className="text-[11px] text-[#71839C]">
                  Provision staff with generated User IDs and a temporary password they can change.
                </div>
              </div>
            </div>
            <Link
              to="/dashboard/manage"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#DCEBFA] bg-white px-3.5 text-[11.5px] font-semibold text-[#218AEF] hover:border-[#218AEF]"
            >
              Manage workspace <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        {/* SECTION C & D: Large Natural-Language & Voice Instruction Bar + Suggested Prompts */}
        <section className="mx-auto w-full max-w-4xl rounded-2xl border border-[#DCEBFA] bg-white p-4 sm:p-5 shadow-[0_8px_28px_rgba(33,138,239,0.07)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#218AEF]" />
              <h2 className="font-display text-sm sm:text-base font-bold text-[#102653]">
                What would you like me to take care of?
              </h2>
            </div>
            <VoiceWaveform state={voiceState} />
          </div>

          {voiceError && (
            <div className="mt-2.5 flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                {voiceError}
              </span>
              <button type="button" onClick={clearVoiceError} className="text-amber-700 hover:text-amber-950">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleCommandSubmit} className="mt-3">
            <div className="relative rounded-2xl border border-[#DCE8F5] bg-[#FAFCFF] p-2 focus-within:border-[#3299F5] focus-within:bg-white transition-colors">
              <textarea
                rows={2}
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (commandInput.trim()) executeOrchestration(commandInput);
                  }
                }}
                placeholder="Give CareOS an instruction (e.g., Check all pending insurance claims and notify the insurance department)..."
                aria-label="CareOS natural language instruction"
                className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm text-[#172B4D] placeholder:text-[#71839C] focus:outline-none"
              />

              <div className="mt-1 flex items-center justify-between gap-2 border-t border-[#EDF3FA] pt-2 px-1">
                <div className="flex items-center gap-1.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setContextPickerOpen((p) => !p)}
                      title="Insert department focus"
                      aria-label="Insert department focus"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E3EDF6] bg-white px-2.5 text-[11px] font-medium text-[#4F627D] hover:border-[#3299F5] hover:text-[#102653]"
                    >
                      <Paperclip className="h-3.5 w-3.5 text-[#3299F5]" />
                      <span className="hidden sm:inline">Department Focus</span>
                    </button>
                    {contextPickerOpen && (
                      <div className="absolute left-0 bottom-10 z-30 w-52 rounded-xl border border-[#E3EDF6] bg-white p-1.5 shadow-lg text-xs">
                        {[
                          'Radiology pending reports',
                          'Pending insurance claims',
                          'Billing discrepancies',
                          'Emergency bed availability',
                          'Delayed inpatient discharges',
                        ].map((ctx) => (
                          <button
                            key={ctx}
                            type="button"
                            onClick={() => {
                              setCommandInput((prev) => (prev ? `${prev} · focus on ${ctx}` : `Check ${ctx}`));
                              setContextPickerOpen(false);
                            }}
                            className="block w-full rounded-lg px-2.5 py-1.5 text-left text-[#102653] hover:bg-[#EAF5FF]"
                          >
                            {ctx}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="hidden md:inline text-[11px] text-[#71839C]">
                    Press Enter to coordinate · Shift+Enter for newline
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <VoiceControlButton voiceState={voiceState} onToggle={handleToggleVoice} />
                  <button
                    type="submit"
                    disabled={!commandInput.trim() || overlayOpen}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E8DF2] px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#1578d4] disabled:opacity-50"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Coordinate Agents</span>
                  </button>
                </div>
              </div>
            </div>
          </form>

          {/* Suggested Instructions */}
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold text-[#71839C]">Suggested instructions</div>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_INSTRUCTIONS.map((promptText) => (
                <button
                  key={promptText}
                  type="button"
                  onClick={() => executeOrchestration(promptText)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#DCE8F5] bg-[#F7FBFF] px-3 py-1.5 text-[11.5px] font-medium text-[#172B4D] transition-colors hover:border-[#218AEF] hover:bg-[#EAF5FF] hover:text-[#102653]"
                >
                  <Zap className="h-3 w-3 shrink-0 text-[#218AEF]" />
                  <span>{promptText}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION E: Six Departmental AI Agents & 3-Tier Sub-Group Round Chain */}
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-[#218AEF]" />
              <h2 className="font-display text-sm font-bold text-[#102653]">Departmental AI Workforce</h2>
              <span className="text-xs text-[#71839C]">·</span>
              <span className="text-xs font-medium text-emerald-700">6 agents · 22 sub-tool nodes</span>
            </div>

            <div className="flex items-center gap-3">
              <div
                role="tablist"
                aria-label="Workforce visualization view"
                className="inline-flex items-center rounded-xl border border-[#DCEBFA] bg-[#F4F9FF] p-0.5 text-[11px] font-semibold"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={workforceView === 'chain'}
                  onClick={() => setWorkforceView('chain')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors',
                    workforceView === 'chain'
                      ? 'bg-white text-[#102653] shadow-2xs'
                      : 'text-[#60748E] hover:text-[#102653]'
                  )}
                >
                  <Network className="h-3.5 w-3.5 text-[#3299F5]" />
                  <span>Round Chain</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workforceView === 'cards'}
                  onClick={() => setWorkforceView('cards')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors',
                    workforceView === 'cards'
                      ? 'bg-white text-[#102653] shadow-2xs'
                      : 'text-[#60748E] hover:text-[#102653]'
                  )}
                >
                  <LayoutGrid className="h-3.5 w-3.5 text-[#3299F5]" />
                  <span>Agent Cards</span>
                </button>
              </div>

              <Link to="/dashboard/agents" className="text-xs font-semibold text-[#218AEF] hover:text-[#102653]">
                Open AI Agent Hub →
              </Link>
            </div>
          </div>

          {workforceView === 'chain' ? (
            (() => {
              const idleNodeStatuses: Record<OrchestratorAgentKey, NodeVisualStatus> = {
                finance: 'inactive',
                radiology: 'inactive',
                operations: 'inactive',
                insurance: 'inactive',
                sales: 'inactive',
                marketing: 'inactive',
              };
              const selectedCard =
                AGENT_CARD_DEFS.find((c) => c.key === selectedAgent) ?? AGENT_CARD_DEFS[0];
              const SelectedIcon = selectedCard.icon;
              const liveNode = data?.orchestrationNodes.find(
                (n) => n.title === selectedCard.nodeMatch
              );
              const count = liveNode?.tasksCount ?? 0;
              const selectedTools = AGENT_CONNECTED_TOOLS[selectedCard.key] ?? [];

              return (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 items-stretch">
                  <div className="lg:col-span-8">
                    <AgentNetwork
                      interactive
                      coreState="active"
                      coreLabel="6 Depts · 22 Tools"
                      nodeStatuses={idleNodeStatuses}
                      selectedAgent={selectedAgent}
                      onSelectAgent={(key) => {
                        if (key) setSelectedAgent(key);
                      }}
                    />
                  </div>

                  <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-[#DCEBFA] bg-white p-4">
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-[#EFF4FA] pb-2.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#71839C]">
                          Agent Chain Inspector
                        </span>
                        <span className="text-[11px] font-medium text-[#3299F5]">
                          Click or hover any node
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                        {AGENT_CARD_DEFS.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => setSelectedAgent(item.key)}
                            className={cn(
                              'truncate rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors',
                              selectedAgent === item.key
                                ? 'border-[#3299F5] bg-[#EAF5FF] text-[#102653]'
                                : 'border-[#E3EDF6] bg-[#FAFCFF] text-[#60748E] hover:border-[#BFDDFB] hover:text-[#102653]'
                            )}
                          >
                            {AGENT_SHORT_LABELS[item.key]}
                          </button>
                        ))}
                      </div>

                      <div className="mt-4 flex items-start justify-between gap-2 rounded-xl border border-[#DCEBFA] bg-[#F7FBFF] p-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white border border-[#DCEBFA] text-[#218AEF]">
                            <SelectedIcon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-bold text-[#102653]">
                              {selectedCard.title}
                            </div>
                            <div className="text-[10.5px] font-medium text-[#71839C]">
                              {selectedCard.connectedWith}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-[#3299F5] tabular-nums">
                          {count} tasks
                        </span>
                      </div>

                      <p className="mt-2.5 text-[11.5px] leading-relaxed text-[#4F627D]">
                        {selectedCard.responsibility}
                      </p>

                      <div className="mt-3.5">
                        <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#71839C]">
                          <span>Linked Sub-Group Round Tools ({selectedTools.length})</span>
                          <span className="text-[#3299F5]">Core → Agent → Tool</span>
                        </div>
                        <div className="space-y-1.5">
                          {selectedTools.map((tool) => (
                            <div
                              key={tool.id}
                              className="flex items-center justify-between rounded-xl border border-[#E6F0FA] bg-[#FAFCFF] px-3 py-2 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#DCE8F5] bg-white">
                                  {tool.renderIcon()}
                                </span>
                                <span className="truncate font-semibold text-[#102653]">
                                  {tool.name}
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-[10px] font-semibold text-[#60748E]">
                                {tool.shortTag} · Linked
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 border-t border-[#EFF4FA] pt-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() =>
                          executeOrchestration(
                            `Coordinate ${selectedCard.title} across ${selectedTools
                              .map((t) => t.name)
                              .join(', ')} and summarize current hospital status.`
                          )
                        }
                        className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1E8DF2] px-3 text-[11.5px] font-semibold text-white transition-colors hover:bg-[#1578d4]"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>Run {AGENT_SHORT_LABELS[selectedCard.key]}</span>
                      </button>
                      <Link
                        to={selectedCard.to}
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#DCEBFA] bg-[#F7FBFF] px-3 text-[11.5px] font-semibold text-[#102653] transition-colors hover:border-[#3299F5] hover:text-[#3299F5]"
                      >
                        <span>Department</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {AGENT_CARD_DEFS.map((card) => {
                const Icon = card.icon;
                const liveNode = data?.orchestrationNodes.find((n) => n.title === card.nodeMatch);
                const count = liveNode?.tasksCount ?? 0;
                return (
                  <Link
                    key={card.key}
                    to={card.to}
                    className="group flex flex-col justify-between rounded-2xl border border-[#DCEBFA] bg-white p-4 transition-colors hover:border-[#218AEF] hover:bg-[#FAFCFF]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#218AEF]">
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-bold text-[#102653] leading-snug">
                              {card.title}
                            </div>
                            <div className="text-[10.5px] font-medium text-[#71839C]">
                              Connected · {card.connectedWith}
                            </div>
                          </div>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] font-semibold text-[#3299F5] tabular-nums">
                          {count} tasks
                        </span>
                      </div>
                      <p className="mt-2 text-[11.5px] leading-relaxed text-[#4F627D]">{card.responsibility}</p>
                    </div>

                    <div className="mt-3 border-t border-[#EDF3FA] pt-2.5">
                      <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-[#71839C]">
                        <span>Connected Tools</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#218AEF] opacity-70 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </div>
                      <ConnectedToolsRow agentKey={card.key} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION F, G & H: Hospital Pulse | Recent Agent Activity | Needs Attention */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Hospital Pulse */}
          <div className="lg:col-span-4 rounded-2xl border border-[#DCEBFA] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#102653]">
                <HeartPulse className="h-4 w-4 text-[#218AEF]" />
                <span>Hospital Pulse</span>
              </div>
              <Link to="/dashboard/analytics" className="text-[11px] font-semibold text-[#218AEF] hover:text-[#102653]">
                Analytics →
              </Link>
            </div>
            <div className="mt-3 divide-y divide-[#EFF4FA]">
              <Link
                to="/dashboard/appointments"
                className="flex items-center justify-between py-2.5 text-xs hover:text-[#218AEF]"
              >
                <span className="flex items-center gap-2 text-[#4F627D]">
                  <Calendar className="h-3.5 w-3.5 text-[#3299F5]" />
                  Today&apos;s Appointments
                </span>
                <span className="font-display text-base font-bold text-[#102653] tabular-nums">
                  {loading && !data ? '—' : data?.metrics.todaysAppointments ?? 0}
                </span>
              </Link>
              <Link
                to="/dashboard/patients"
                className="flex items-center justify-between py-2.5 text-xs hover:text-[#218AEF]"
              >
                <span className="flex items-center gap-2 text-[#4F627D]">
                  <Activity className="h-3.5 w-3.5 text-[#3299F5]" />
                  Active Admissions
                </span>
                <span className="font-display text-base font-bold text-[#102653] tabular-nums">
                  {loading && !data ? '—' : data?.metrics.activeAdmissions ?? 0}
                </span>
              </Link>
              <Link
                to="/dashboard/resources"
                className="flex items-center justify-between py-2.5 text-xs hover:text-[#218AEF]"
              >
                <span className="flex items-center gap-2 text-[#4F627D]">
                  <BedDouble className="h-3.5 w-3.5 text-emerald-600" />
                  Available Beds
                </span>
                <span className="font-display text-base font-bold text-[#102653] tabular-nums">
                  {loading && !data ? '—' : data?.metrics.availableBeds ?? 0}
                </span>
              </Link>
            </div>
          </div>

          {/* Recent Agent Activity */}
          <div className="lg:col-span-4 rounded-2xl border border-[#DCEBFA] bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#102653]">
                <Zap className="h-4 w-4 text-[#218AEF]" />
                <span>Recent Agent Activity</span>
              </div>
              <Link to="/dashboard/agents" className="text-[11px] font-semibold text-[#218AEF] hover:text-[#102653]">
                View Logs →
              </Link>
            </div>
            <div className="mt-3 divide-y divide-[#EFF4FA]">
              {!data || data.liveActivityFeed.length === 0 ? (
                <div className="py-7 text-center text-xs text-[#71839C]">
                  No activity yet — instruct CareOS above or add hospital records.
                </div>
              ) : (
                data.liveActivityFeed.slice(0, 4).map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between gap-2 py-2.5 text-xs">
                    <span className="flex items-center gap-2 min-w-0 text-[#172B4D]">
                      {idx < 2 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      ) : (
                        <Info className="h-3.5 w-3.5 shrink-0 text-[#218AEF]" />
                      )}
                      <span className="truncate">{item.title}</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-[#71839C] tabular-nums">
                      {formatTimeAgo(item.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Needs Attention */}
          <div className="lg:col-span-4 rounded-2xl border border-[#F5DFC2] bg-gradient-to-br from-[#FFF9F2] to-[#FFFFFF] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-[#102653]">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span>Needs Attention</span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-amber-700 tabular-nums">
                {attentionTotal} total
              </span>
            </div>
            <div className="mt-3 divide-y divide-[#F6EAD9]">
              <Link
                to="/dashboard/module/insurance"
                className="flex items-center justify-between py-2.5 text-xs hover:text-[#102653]"
              >
                <span className="text-[#4F627D]">Pending insurance approval</span>
                <span className="font-display text-base font-bold text-[#102653] tabular-nums">
                  {loading && !data ? '—' : data?.needsAttentionSummary.pendingInsuranceApproval ?? 0}
                </span>
              </Link>
              <Link
                to="/dashboard/module/radiology"
                className="flex items-center justify-between py-2.5 text-xs hover:text-[#102653]"
              >
                <span className="text-[#4F627D]">Report awaiting clinician review</span>
                <span className="font-display text-base font-bold text-[#102653] tabular-nums">
                  {loading && !data ? '—' : data?.needsAttentionSummary.reportsAwaitingReview ?? 0}
                </span>
              </Link>
              <Link
                to="/dashboard/appointments"
                className="flex items-center justify-between py-2.5 text-xs hover:text-[#102653]"
              >
                <span className="text-[#4F627D]">Appointment confirmation required</span>
                <span className="font-display text-base font-bold text-[#102653] tabular-nums">
                  {loading && !data ? '—' : data?.needsAttentionSummary.appointmentsConfirmationRequired ?? 0}
                </span>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION I: Recent Workflows & Execution History + Departmental Alerts */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Workflow Execution History */}
          <div className="lg:col-span-7 rounded-2xl border border-[#DCEBFA] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFF4FA] pb-3">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-[#218AEF]" />
                <div>
                  <h2 className="font-display text-sm font-bold text-[#102653]">
                    Recent Workflows &amp; Execution History
                  </h2>
                  <p className="text-[11px] text-[#71839C]">
                    Reopen any orchestrated workflow to inspect inter-agent messages, approvals, and full reports.
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-[#3299F5] tabular-nums">
                {workflows.length} runs
              </span>
            </div>

            {workflows.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#71839C]">
                No agent workflows executed yet. Submit an instruction or pick a suggested command above to launch
                CareOS Intelligence.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-[#EFF4FA]">
                {workflows.slice(0, 6).map((wf) => (
                  <div key={wf.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-[#3299F5]">{wf.workflowCode}</span>
                        <span className="text-[#71839C]">·</span>
                        <span
                          className={cn(
                            'font-semibold',
                            wf.status === 'Awaiting Approval'
                              ? 'text-amber-600'
                              : wf.status === 'Issue Detected'
                              ? 'text-red-600'
                              : 'text-emerald-600'
                          )}
                        >
                          {wf.status}
                        </span>
                        <span className="text-[#71839C]">·</span>
                        <span className="font-mono text-[11px] text-[#71839C] tabular-nums">
                          {(wf.executionMs / 1000).toFixed(1)}s · {formatTimeAgo(wf.executedAt)}
                        </span>
                      </div>
                      <div className="mt-1 truncate font-semibold text-[#102653]">{wf.instruction}</div>
                      <div className="mt-1 truncate text-[11px] text-[#71839C]">
                        Agents: {wf.participatingAgents.map((k) => AGENT_SHORT_LABELS[k] || k).join(' · ')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenWorkflowHistory(wf)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#DCEBFA] bg-[#F7FBFF] px-3 text-[11px] font-semibold text-[#102653] transition-colors hover:border-[#3299F5] hover:bg-[#EAF5FF] hover:text-[#3299F5]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>View Report</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Departmental Notification Center */}
          <div className="lg:col-span-5 rounded-2xl border border-[#DCEBFA] bg-white p-5">
            <div className="flex items-center justify-between border-b border-[#EFF4FA] pb-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#218AEF]" />
                <div>
                  <h2 className="font-display text-sm font-bold text-[#102653]">Departmental Notification Center</h2>
                  <p className="text-[11px] text-[#71839C]">Alerts dispatched automatically during orchestration.</p>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-[#3299F5] tabular-nums">
                {alerts.filter((a) => a.status === 'Delivered (In-App)').length} unread
              </span>
            </div>

            {alerts.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#71839C]">
                No departmental alerts dispatched yet. CareOS routes notifications directly to relevant teams when
                instructed.
              </div>
            ) : (
              <div className="mt-3 space-y-2.5 max-h-[340px] overflow-y-auto pr-0.5">
                {alerts.slice(0, 6).map((alert) => {
                  const isUnread = alert.status === 'Delivered (In-App)';
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'rounded-xl border p-3 text-xs',
                        isUnread ? 'border-[#BFDDFB] bg-[#F7FBFF]' : 'border-[#E3EDF6] bg-white'
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[#102653]">{alert.department}</span>
                        <span
                          className={cn(
                            'font-mono text-[10.5px] font-semibold',
                            alert.priority === 'Urgent'
                              ? 'text-red-600'
                              : alert.priority === 'High'
                              ? 'text-amber-600'
                              : 'text-[#3299F5]'
                          )}
                        >
                          {alert.workflowCode} · {alert.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-[#172B4D] leading-snug">{alert.summary}</p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-[#71839C]">
                          {alert.status} · {formatTimeAgo(alert.timestamp)}
                        </span>
                        <div className="flex items-center gap-2">
                          {isUnread && (
                            <button
                              type="button"
                              onClick={() => handleAcknowledgeAlert(alert.id)}
                              className="rounded-md border border-[#DCEBFA] bg-white px-2 py-0.5 font-semibold text-[#102653] hover:border-[#3299F5] hover:text-[#3299F5]"
                            >
                              Acknowledge
                            </button>
                          )}
                          <Link to={alert.targetPath} className="font-semibold text-[#3299F5] hover:text-[#102653]">
                            Open →
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
