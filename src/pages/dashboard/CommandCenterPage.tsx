import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileText,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { AppointmentTrendChart, HorizontalBarMetric } from '../../components/Charts';
import { useAuth } from '../../context/AuthContext';
import type { ApprovedHospital, DashboardOverviewData, HospitalApplication } from '../../types/careos';
import { SuperAdminCommandCenter } from './SuperAdminPages';
import { cn } from '../../lib/utils';

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
          <p className="mt-1 text-sm text-[#71839C]">
            Your account is awaiting CareOS Super Admin verification.
          </p>
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

export function CommandCenterPage() {
  const { user, apiFetch } = useAuth();

  // Super Admin views the Platform Command Center
  if (user?.role === 'admin') {
    return <SuperAdminCommandCenter />;
  }

  // Pending applicants view their live onboarding status tracker
  if (user?.status !== 'active') {
    return <ApplicantOnboardingStatusView />;
  }

  return <HospitalCommandCenter />;
}

function HospitalCommandCenter() {
  const { user, apiFetch } = useAuth();
  const [range, setRange] = useState<'today' | '7d' | '30d'>('today');
  const [search, setSearch] = useState('');
  const [data, setData] = useState<DashboardOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardOverviewData>(`/api/dashboard/overview?range=${range}`);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load hospital overview.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, range]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    await apiFetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadOverview();
  };

  const handleMarkNotificationRead = async (notifId: string) => {
    await apiFetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
    await loadOverview();
  };

  const filteredTasks =
    data?.tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.department.toLowerCase().includes(search.toLowerCase()) ||
        t.assignedAgent.toLowerCase().includes(search.toLowerCase())
    ) ?? [];

  return (
    <DashboardLayout
      title="Hospital Command Center"
      breadcrumb="Command Center"
      subtitle={`Live operational workspace for ${user?.hospitalName || 'your hospital'}.`}
      actions={
        <div className="flex items-center gap-1 rounded-xl border border-[#E3EDF6] bg-white p-1">
          {([
            { id: 'today', label: 'Today' },
            { id: '7d', label: '7D' },
            { id: '30d', label: '30D' },
          ] as const).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-semibold transition-colors whitespace-nowrap',
                range === item.id ? 'bg-[#EAF5FF] text-[#3299F5]' : 'text-[#71839C] hover:text-[#102653]'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-28 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Top Metrics (all start at 0 until hospital staff add patients/appointments) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                  <Users className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[#71839C]">Live</span>
              </div>
              <div className="mt-3 text-xs font-medium text-[#71839C]">Total Patients</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {data.metrics.totalPatients}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                  <CalendarCheck className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[#3299F5]">Live</span>
              </div>
              <div className="mt-3 text-xs font-medium text-[#71839C]">Appointments</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {data.metrics.todaysAppointments}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                  <Activity className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[#71839C]">Wards</span>
              </div>
              <div className="mt-3 text-xs font-medium text-[#71839C]">Active Admissions</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {data.metrics.activeAdmissions}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                  <BedDouble className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[#3299F5] tabular-nums">{data.metrics.bedOccupancyRate}% used</span>
              </div>
              <div className="mt-3 text-xs font-medium text-[#71839C]">Available Beds</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {data.metrics.availableBeds} / {data.metrics.totalBeds}
              </div>
            </div>

            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                  <ClipboardList className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[#71839C] tabular-nums">{data.metrics.totalAgentTasksCompleted} done</span>
              </div>
              <div className="mt-3 text-xs font-medium text-[#71839C]">Pending Tasks</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {data.metrics.pendingTasks}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#102653]">Appointment Trends</h2>
                  <p className="text-xs text-[#71839C]">Scheduled vs. completed outpatient and consult volume</p>
                </div>
                <Link to="/dashboard/appointments" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  Manage schedule →
                </Link>
              </div>
              <AppointmentTrendChart data={data.appointmentTrends} />
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#102653]">Patient Flow Monitoring</h2>
                  <p className="text-xs text-[#71839C]">Current volume by care stage</p>
                </div>
                <Link to="/dashboard/patients" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  Add Patients →
                </Link>
              </div>
              <div className="space-y-3">
                {data.patientFlowStages.map((stage) => (
                  <div key={stage.stage} className="rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#102653]">{stage.stage}</span>
                      <span className="font-mono text-sm font-semibold text-[#3299F5] tabular-nums">{stage.count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#102653]">Department Workload</h2>
                  <p className="text-xs text-[#71839C]">Provisioned clinical capacity</p>
                </div>
                <Link to="/dashboard/departments" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  Departments →
                </Link>
              </div>
              {data.departments.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71839C]">
                  Departments appear here once configured.
                </div>
              ) : (
                <div className="space-y-4">
                  {data.departments.map((dept) => {
                    const pct = dept.bedCapacity > 0 ? dept.occupiedBeds / dept.bedCapacity : 0;
                    return (
                      <HorizontalBarMetric
                        key={dept.id}
                        label={`${dept.name} · ${dept.status}`}
                        value={dept.occupiedBeds}
                        max={dept.bedCapacity}
                        sublabel={`${dept.occupiedBeds}/${dept.bedCapacity} beds`}
                        accent={pct > 0.8 ? 'warning' : 'primary'}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-6 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#102653]">AI Agent Activity Status</h2>
                  <p className="text-xs text-[#71839C]">Six coordinated CareOS agents</p>
                </div>
                <Link to="/dashboard/agents" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  Agent Hub →
                </Link>
              </div>
              <div className="divide-y divide-[#E3EDF6]">
                {data.agents.map((ag) => (
                  <div key={ag.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#102653]">{ag.name}</div>
                      <div className="truncate text-xs text-[#71839C]">
                        {ag.recentActivity[0]?.summary || ag.category}
                      </div>
                    </div>
                    <div className="shrink-0 text-right font-mono text-xs tabular-nums">
                      <div className="font-semibold text-[#3299F5]">{ag.status}</div>
                      <div className="text-[#71839C]">{ag.completedTasks} done</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-display text-base font-semibold text-[#102653]">Pending Operational Tasks</h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71839C]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter tasks..."
                    aria-label="Filter operational tasks"
                    className="h-8 rounded-lg border border-[#E3EDF6] pl-8 pr-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                  />
                </div>
              </div>
              {filteredTasks.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71839C]">No operational tasks queued yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-[#E3EDF6] text-xs text-[#71839C]">
                        <th className="py-2 pr-3 font-medium">Task</th>
                        <th className="py-2 px-3 font-medium">Department</th>
                        <th className="py-2 px-3 font-medium">Priority</th>
                        <th className="py-2 pl-3 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3EDF6]">
                      {filteredTasks.map((task) => (
                        <tr key={task.id}>
                          <td className="py-2.5 pr-3">
                            <div className={cn('font-medium text-[#102653]', task.status === 'Completed' && 'line-through text-[#71839C]')}>
                              {task.title}
                            </div>
                            <div className="text-xs text-[#71839C]">
                              {task.assignedAgent} · Due {task.dueTime}
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-[#172B4D]">{task.department}</td>
                          <td className="py-2.5 px-3 text-xs font-medium text-[#102653]">{task.priority}</td>
                          <td className="py-2.5 pl-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleTask(task.id, task.status)}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E3EDF6] px-2.5 py-1 text-xs font-medium text-[#102653] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-[#3299F5]" />
                              {task.status === 'Completed' ? 'Reopen' : 'Complete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="mb-4">
                <h2 className="font-display text-base font-semibold text-[#102653]">Recent Notifications</h2>
                <p className="text-xs text-[#71839C]">Live workspace alerts &amp; agent events</p>
              </div>
              {data.notifications.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71839C]">No notifications yet.</div>
              ) : (
                <div className="space-y-3">
                  {data.notifications.slice(0, 5).map((notif) => (
                    <div
                      key={notif.id}
                      className={cn(
                        'rounded-xl border border-[#E3EDF6] p-3.5',
                        notif.read ? 'bg-white' : 'bg-[#F4F9FF]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-[#102653]">{notif.title}</div>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#71839C]">{notif.detail}</p>
                      <div className="mt-2 flex items-center justify-between text-[11px]">
                        <span className="text-[#3299F5] font-medium">{notif.department}</span>
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => handleMarkNotificationRead(notif.id)}
                            className="font-medium text-[#102653] hover:text-[#3299F5]"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
