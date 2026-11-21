import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Play, Shield, Sliders } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { AppointmentTrendChart, HorizontalBarMetric } from '../../components/Charts';
import { useAuth } from '../../context/AuthContext';
import type {
  AuditLogEntry,
  AuthUser,
  DepartmentRecord,
  HospitalNotification,
  IntegrationItem,
  ResourceItem,
  StaffMember,
  UserRole,
  WorkflowDefinition,
} from '../../types/careos';
import { cn, formatTimeAgo } from '../../lib/utils';

export function OperationsWorkflowsPage() {
  const { apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab = rawTab === 'workflows' ? 'workflows' : rawTab === 'comms' ? 'comms' : 'overview';

  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [notifications, setNotifications] = useState<HospitalNotification[]>([]);
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [wfRes, ovRes] = await Promise.all([
      apiFetch<{ workflows: WorkflowDefinition[] }>('/api/workflows'),
      apiFetch<{ notifications: HospitalNotification[]; departments: DepartmentRecord[] }>('/api/dashboard/overview?range=today'),
    ]);
    setWorkflows(wfRes.workflows);
    setNotifications(ovRes.notifications);
    setDepartments(ovRes.departments);
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleWorkflow = async (wf: WorkflowDefinition) => {
    await apiFetch(`/api/workflows/${wf.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active: !wf.active }),
    });
    await loadData();
  };

  const handleTriggerWorkflow = async (wf: WorkflowDefinition) => {
    await apiFetch(`/api/workflows/${wf.id}/trigger`, { method: 'POST' });
    setStatusMsg(`Executed workflow "${wf.name}" via ${wf.agentName}.`);
    await loadData();
  };

  return (
    <DashboardLayout
      title={activeTab === 'workflows' ? 'Workflow Automation' : activeTab === 'comms' ? 'Knowledge & Communication Center' : 'Hospital Overview'}
      breadcrumb={`Operations / ${activeTab}`}
      actions={
        <div className="flex items-center gap-1 rounded-md border border-[#E3EDF6] bg-[#F4F9FF] p-0.5">
          {([
            { id: 'overview', label: 'Hospital Overview' },
            { id: 'workflows', label: 'Workflows' },
            { id: 'comms', label: 'Comms & Knowledge' },
          ] as const).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSearchParams(t.id === 'overview' ? {} : { tab: t.id })}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap',
                activeTab === t.id ? 'bg-white text-[#102653] shadow-xs' : 'text-[#71839C]'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {statusMsg && (
        <div className="mb-5 rounded-md border border-[#3299F5]/40 bg-[#EAF5FF] px-4 py-2.5 text-xs font-medium text-[#102653]">
          {statusMsg}
        </div>
      )}

      {activeTab === 'workflows' ? (
        <div className="space-y-5">
          {workflows.map((wf) => (
            <div key={wf.id} className="rounded-lg border border-[#E3EDF6] bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-medium text-[#3299F5]">
                    {wf.agentName} · {wf.executionsCount} runs · Last run: {wf.lastRunAt}
                  </div>
                  <h2 className="mt-1 font-display text-lg font-bold text-[#102653]">{wf.name}</h2>
                  <p className="mt-1 text-sm text-[#71839C]">{wf.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleWorkflow(wf)}
                    className="rounded-md border border-[#E3EDF6] px-3 py-1.5 text-xs font-medium text-[#102653] hover:bg-[#F4F9FF]"
                  >
                    {wf.active ? 'Active' : 'Paused'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTriggerWorkflow(wf)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#102653] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1b3a78]"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Run Workflow
                  </button>
                </div>
              </div>

              {/* Visual Pipeline Steps */}
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-6">
                {[
                  { label: '01. Trigger', val: wf.trigger },
                  { label: '02. Condition', val: wf.condition },
                  { label: '03. Agent', val: wf.agentName },
                  { label: '04. Action', val: wf.action },
                  { label: '05. Approval', val: wf.requiresApproval ? 'Human sign-off required' : 'Auto-authorized' },
                  { label: '06. Completion', val: wf.completionOutcome },
                ].map((stage, i) => (
                  <div key={stage.label} className="relative rounded-md border border-[#E3EDF6] bg-[#F4F9FF]/60 p-3">
                    <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-[#3299F5]">
                      <span>{stage.label}</span>
                      {i < 5 && <ArrowRight className="hidden md:block h-3 w-3 text-[#71839C]" />}
                    </div>
                    <p className="mt-1.5 text-xs leading-snug text-[#172B4D]">{stage.val}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'comms' ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-lg border border-[#E3EDF6] bg-white p-6">
            <h2 className="font-display text-base font-bold text-[#102653]">Communication & Alert Feed</h2>
            <div className="mt-4 divide-y divide-[#E3EDF6]">
              {notifications.map((n) => (
                <div key={n.id} className="py-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#102653]">{n.title}</span>
                    <span className="font-mono text-[#71839C]">{n.timestamp}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#71839C]">{n.detail}</p>
                  <div className="mt-1 text-[11px] font-medium text-[#3299F5]">{n.department}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 rounded-lg border border-[#E3EDF6] bg-[#F4F9FF] p-6 space-y-4">
            <h2 className="font-display text-base font-bold text-[#102653]">Hospital Protocol Knowledge Base</h2>
            {[
              { title: 'Inpatient Discharge Clearance Protocol', detail: 'Requires attending sign-off, pharmacy reconciliation, and EVS sanitization trigger.' },
              { title: 'Emergency Surge Escalation Threshold', detail: 'Triggers nursing supervisor float proposal when bay utilization exceeds 82%.' },
              { title: 'Clinical AI Summary Oversight Policy', detail: 'All AI-synthesized clinical briefs are labeled draft until clinician verification.' },
            ].map((kb) => (
              <div key={kb.title} className="rounded-md border border-[#E3EDF6] bg-white p-4">
                <div className="text-sm font-semibold text-[#102653]">{kb.title}</div>
                <p className="mt-1 text-xs text-[#71839C]">{kb.detail}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div key={d.id} className="rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#102653]">{d.name}</h2>
                <span className="text-xs font-semibold text-[#3299F5]">{d.status}</span>
              </div>
              <p className="mt-1 text-xs text-[#71839C]">Lead: {d.head}</p>
              <div className="mt-4 space-y-2 text-xs font-mono text-[#172B4D] tabular-nums">
                <div className="flex justify-between">
                  <span className="text-[#71839C] font-sans">Active Patients</span>
                  <span>{d.activePatients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71839C] font-sans">Staff On Duty</span>
                  <span>{d.staffOnDuty} / {d.totalStaff}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71839C] font-sans">Beds Occupied</span>
                  <span>{d.occupiedBeds} / {d.bedCapacity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71839C] font-sans">Avg Wait</span>
                  <span>{d.avgWaitMinutes} min</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function DepartmentsPage() {
  const { apiFetch } = useAuth();
  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);

  useEffect(() => {
    apiFetch<{ departments: DepartmentRecord[]; staff: StaffMember[] }>('/api/departments').then((res) => {
      setDepartments(res.departments);
      setStaff(res.staff);
    });
  }, [apiFetch]);

  return (
    <DashboardLayout title="Departments & Staff" breadcrumb="Hospital Operations / Departments & Staff">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((d) => (
            <div key={d.id} className="rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-[#102653]">{d.name}</h2>
                <span className="text-xs font-semibold text-[#3299F5]">{d.status}</span>
              </div>
              <div className="mt-1 text-xs text-[#71839C]">{d.head}</div>
              <div className="mt-4">
                <HorizontalBarMetric
                  label="Bed Occupancy"
                  value={d.occupiedBeds}
                  max={d.bedCapacity}
                  sublabel={`${d.occupiedBeds}/${d.bedCapacity}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[#E3EDF6] bg-white">
          <div className="border-b border-[#E3EDF6] px-5 py-3.5">
            <h2 className="font-display text-base font-bold text-[#102653]">Doctors & Clinical Staff Roster (Sample)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-xs text-[#71839C]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Clinician</th>
                  <th className="px-5 py-3 font-semibold">Department</th>
                  <th className="px-5 py-3 font-semibold">Shift Window</th>
                  <th className="px-5 py-3 font-semibold">Availability</th>
                  <th className="px-5 py-3 text-right font-semibold">Active Cases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EDF6]">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-[#102653]">{s.name}</div>
                      <div className="text-xs text-[#71839C]">{s.role}</div>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#172B4D]">{s.department}</td>
                    <td className="px-5 py-3 font-mono text-xs text-[#71839C] tabular-nums">{s.shift}</td>
                    <td className="px-5 py-3 text-xs font-semibold text-[#3299F5]">{s.availability}</td>
                    <td className="px-5 py-3 text-right font-mono text-xs text-[#102653] tabular-nums">{s.activeCases}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export function ResourcesPage() {
  const { apiFetch } = useAuth();
  const [resources, setResources] = useState<ResourceItem[]>([]);

  const loadResources = useCallback(async () => {
    const res = await apiFetch<{ resources: ResourceItem[] }>('/api/resources');
    setResources(res.resources);
  }, [apiFetch]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const adjustAllocation = async (id: string, allocateDelta: number) => {
    await apiFetch(`/api/resources/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ allocateDelta }),
    });
    await loadResources();
  };

  return (
    <DashboardLayout title="Beds & Resources" breadcrumb="Hospital Operations / Beds & Resources">
      <div className="overflow-x-auto rounded-lg border border-[#E3EDF6] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-xs text-[#71839C]">
            <tr>
              <th className="px-5 py-3 font-semibold">Resource Pool</th>
              <th className="px-5 py-3 font-semibold">Category</th>
              <th className="px-5 py-3 font-semibold">Department</th>
              <th className="px-5 py-3 text-right font-semibold">Available</th>
              <th className="px-5 py-3 text-right font-semibold">In Use</th>
              <th className="px-5 py-3 text-right font-semibold">Total</th>
              <th className="px-5 py-3 text-right font-semibold">Allocate / Release</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3EDF6]">
            {resources.map((r) => (
              <tr key={r.id}>
                <td className="px-5 py-3.5 font-medium text-[#102653]">{r.name}</td>
                <td className="px-5 py-3.5 text-xs text-[#71839C]">{r.category}</td>
                <td className="px-5 py-3.5 text-xs text-[#172B4D]">{r.department}</td>
                <td className="px-5 py-3.5 text-right font-mono text-xs font-semibold text-[#3299F5] tabular-nums">{r.available}</td>
                <td className="px-5 py-3.5 text-right font-mono text-xs text-[#102653] tabular-nums">{r.inUse}</td>
                <td className="px-5 py-3.5 text-right font-mono text-xs text-[#71839C] tabular-nums">{r.total}</td>
                <td className="px-5 py-3.5 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustAllocation(r.id, 1)}
                      disabled={r.available <= 0}
                      className="rounded border border-[#E3EDF6] px-2.5 py-1 text-xs font-medium text-[#102653] hover:bg-[#EAF5FF] disabled:opacity-40"
                    >
                      + Assign
                    </button>
                    <button
                      type="button"
                      onClick={() => adjustAllocation(r.id, -1)}
                      disabled={r.inUse <= 0}
                      className="rounded border border-[#E3EDF6] px-2.5 py-1 text-xs font-medium text-[#71839C] hover:bg-[#F4F9FF] disabled:opacity-40"
                    >
                      Release
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}

export function AnalyticsPage() {
  const { apiFetch } = useAuth();
  const [analytics, setAnalytics] = useState<{
    metrics: {
      totalHospitals: number;
      pendingApplications: number;
      approvedHospitals: number;
      activeWorkspaces: number;
      totalUsers: number;
      activeSubscriptions: number;
    };
    totalBedsProvisioned: number;
    totalDeptsProvisioned: number;
    mrrUsd: number;
    monthlyGrowth: Array<{ month: string; count: number }>;
    applicationOverview: { total: number; pending: number; underReview: number; approved: number };
    hospitals: Array<{
      id: string;
      hospitalId: string;
      hospitalName: string;
      bedsCount: number;
      departmentsCount: number;
      subscriptionPlan: string;
      workspaceStatus: string;
    }>;
    agentPerformance: Array<{
      id: string;
      name: string;
      completed: number;
      pending: number;
      completionRate: number;
      avgResponseSeconds: number;
    }>;
  } | null>(null);

  useEffect(() => {
    apiFetch<typeof analytics>('/api/analytics').then(setAnalytics);
  }, [apiFetch]);

  return (
    <DashboardLayout
      title="Platform Analytics"
      breadcrumb="Platform Analytics"
      subtitle="Live metrics across hospital onboarding, provisioned capacity, and AI agent execution."
    >
      {!analytics ? (
        <div className="h-64 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="text-xs text-[#71839C]">Total Hospital Requests</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {analytics.metrics.totalHospitals}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="text-xs text-[#71839C]">Approved Workspaces</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#3299F5] tabular-nums">
                {analytics.metrics.activeWorkspaces}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="text-xs text-[#71839C]">Provisioned Bed Capacity</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {analytics.totalBedsProvisioned}
              </div>
            </div>
            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <div className="text-xs text-[#71839C]">Monthly Recurring Billing</div>
              <div className="mt-1 font-display text-2xl font-bold text-[#102653] tabular-nums">
                ${analytics.mrrUsd.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <h2 className="mb-4 font-display text-base font-bold text-[#102653]">12-Month Registration Trend</h2>
              <AppointmentTrendChart
                data={analytics.monthlyGrowth.map((m) => ({
                  label: m.month,
                  scheduled: m.count,
                  completed: m.count,
                  walkIn: 0,
                }))}
              />
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-white p-5">
              <h2 className="mb-4 font-display text-base font-bold text-[#102653]">AI Agent Execution Rate</h2>
              <div className="space-y-3.5">
                {analytics.agentPerformance.map((ap) => (
                  <HorizontalBarMetric
                    key={ap.id}
                    label={ap.name}
                    value={ap.completionRate}
                    max={100}
                    sublabel={`${ap.completed} tasks · ${ap.completionRate}%`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
            <h2 className="mb-4 font-display text-base font-bold text-[#102653]">Provisioned Hospital Capacity</h2>
            {analytics.hospitals.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#71839C]">
                No hospitals provisioned yet. Metrics populate dynamically as hospitals are approved.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                    <tr>
                      <th className="py-2.5 px-3">Hospital ID</th>
                      <th className="py-2.5 px-3">Hospital Name</th>
                      <th className="py-2.5 px-3 text-right">Beds</th>
                      <th className="py-2.5 px-3 text-right">Departments</th>
                      <th className="py-2.5 px-3 text-right">Plan</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3EDF6] font-mono tabular-nums">
                    {analytics.hospitals.map((h) => (
                      <tr key={h.id}>
                        <td className="py-2.5 px-3 text-[#71839C]">{h.hospitalId}</td>
                        <td className="py-2.5 px-3 font-sans font-semibold text-[#102653]">{h.hospitalName}</td>
                        <td className="py-2.5 px-3 text-right">{h.bedsCount}</td>
                        <td className="py-2.5 px-3 text-right">{h.departmentsCount}</td>
                        <td className="py-2.5 px-3 text-right text-[#3299F5]">{h.subscriptionPlan}</td>
                        <td className="py-2.5 px-3 text-right">{h.workspaceStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export function IntegrationsDashPage() {
  const { apiFetch } = useAuth();
  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    const res = await apiFetch<{ integrations: IntegrationItem[] }>('/api/integrations');
    setItems(res.integrations);
  }, [apiFetch]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const toggleIntegration = async (item: IntegrationItem) => {
    setError(null);
    try {
      await apiFetch(`/api/integrations/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ connected: !item.connected }),
      });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update integration.');
    }
  };

  return (
    <DashboardLayout
      title="Integrations"
      breadcrumb="Integrations"
      subtitle="Configure supported HL7 FHIR, CalDAV, and CareOS REST adapters."
    >
      {error && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[#E3EDF6] bg-white p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#71839C]">{item.category}</span>
                <span className={cn('font-semibold', item.availability === 'supported' ? 'text-[#3299F5]' : 'text-[#71839C]')}>
                  {item.availability === 'supported' ? 'Supported' : 'Planned Roadmap'}
                </span>
              </div>
              <h2 className="mt-2 font-display text-base font-bold text-[#102653]">{item.name}</h2>
              <p className="mt-1.5 text-sm text-[#71839C]">{item.description}</p>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[#E3EDF6] pt-3">
              <span className="font-mono text-xs text-[#102653]">{item.protocol}</span>
              {item.availability === 'supported' ? (
                <button
                  type="button"
                  onClick={() => toggleIntegration(item)}
                  className={cn(
                    'rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors',
                    item.connected
                      ? 'bg-[#EAF5FF] text-[#102653] border border-[#3299F5]/40'
                      : 'bg-[#102653] text-white'
                  )}
                >
                  {item.connected ? 'Connected' : 'Connect'}
                </button>
              ) : (
                <span className="text-xs font-medium text-[#71839C]">Coming in roadmap</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

export function SettingsAdminPage() {
  const { user, apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'admin' && user?.role === 'admin' ? 'admin' : 'general';

  const [hospitalName, setHospitalName] = useState(user?.hospitalName || '');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [humanOversight, setHumanOversight] = useState(true);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const loadAdminData = useCallback(async () => {
    if (user?.role !== 'admin') return;
    const [uRes, aRes] = await Promise.all([
      apiFetch<{ users: AuthUser[] }>('/api/admin/users'),
      apiFetch<{ logs: AuditLogEntry[] }>('/api/admin/audit-logs'),
    ]);
    setUsers(uRes.users);
    setAuditLogs(aRes.logs);
  }, [apiFetch, user?.role]);

  useEffect(() => {
    apiFetch<{ hospitalSettings: { hospitalName: string; timezone: string; humanOversightRequired: boolean } }>(
      '/api/dashboard/overview?range=today'
    ).then((res) => {
      setHospitalName(res.hospitalSettings.hospitalName);
      setTimezone(res.hospitalSettings.timezone);
      setHumanOversight(res.hospitalSettings.humanOversightRequired);
    });
    loadAdminData();
  }, [apiFetch, loadAdminData]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      await apiFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ hospitalName, timezone, humanOversightRequired: humanOversight }),
      });
      setSavedMsg('Platform configuration saved.');
      await loadAdminData();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save settings.');
    }
  };

  const handleRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    setPwErr(null);
    try {
      await apiFetch('/api/super-admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setPwMsg('Super Admin password updated securely.');
    } catch (err) {
      setPwErr(err instanceof Error ? err.message : 'Unable to update password.');
    }
  };

  const handleRoleUpdate = async (userId: string, role: UserRole) => {
    await apiFetch(`/api/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    await loadAdminData();
  };

  return (
    <DashboardLayout
      title={tab === 'admin' ? 'User Management & Audit Logs' : 'Platform Settings'}
      breadcrumb={tab === 'admin' ? 'Admin Governance' : 'Settings'}
      actions={
        user?.role === 'admin' ? (
          <div className="flex items-center gap-1 rounded-xl border border-[#E3EDF6] bg-white p-1">
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-semibold',
                tab === 'general' ? 'bg-[#EAF5FF] text-[#3299F5]' : 'text-[#71839C]'
              )}
            >
              System Settings
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({ tab: 'admin' })}
              className={cn(
                'rounded-lg px-3 py-1 text-xs font-semibold',
                tab === 'admin' ? 'bg-[#EAF5FF] text-[#3299F5]' : 'text-[#71839C]'
              )}
            >
              Users &amp; Audit Logs
            </button>
          </div>
        ) : undefined
      }
    >
      {tab === 'admin' && user?.role === 'admin' ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[#E3EDF6] bg-white">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-[#3299F5]" />
                <h2 className="font-display text-base font-bold text-[#102653]">Registered Organization Accounts</h2>
              </div>
              <span className="text-xs text-[#71839C]">{users.length} accounts</span>
            </div>
            {users.length === 0 ? (
              <div className="p-6 text-sm text-[#71839C]">No registered hospital users yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-xs text-[#71839C]">
                    <tr>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Organization</th>
                      <th className="px-5 py-3">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E3EDF6]">
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="px-5 py-3">
                          <div className="font-medium text-[#102653]">{u.fullName}</div>
                          <div className="text-xs text-[#71839C]">{u.email}</div>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#172B4D]">{u.hospitalName}</td>
                        <td className="px-5 py-3">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleUpdate(u.id, e.target.value as UserRole)}
                            className="h-8 rounded-lg border border-[#E3EDF6] bg-white px-2 text-xs text-[#102653]"
                          >
                            <option value="coordinator">coordinator</option>
                            <option value="clinician">clinician</option>
                            <option value="operator">operator</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[#E3EDF6] bg-white">
            <div className="border-b border-[#E3EDF6] px-5 py-3.5">
              <h2 className="font-display text-base font-bold text-[#102653]">Security &amp; Operational Audit Logs</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <tr>
                    <th className="px-5 py-2.5">When</th>
                    <th className="px-5 py-2.5">Actor</th>
                    <th className="px-5 py-2.5">Action</th>
                    <th className="px-5 py-2.5">Resource</th>
                    <th className="px-5 py-2.5 text-right">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3EDF6]">
                  {auditLogs.slice(0, 25).map((log) => (
                    <tr key={log.id}>
                      <td className="px-5 py-2.5 font-mono text-[#71839C]">{formatTimeAgo(log.timestamp)}</td>
                      <td className="px-5 py-2.5 text-[#102653]">
                        {log.actorEmail} ({log.actorRole})
                      </td>
                      <td className="px-5 py-2.5 font-mono text-[#172B4D]">{log.action}</td>
                      <td className="px-5 py-2.5 text-[#71839C]">{log.resource}</td>
                      <td
                        className={cn(
                          'px-5 py-2.5 text-right font-semibold',
                          log.outcome === 'Allowed' ? 'text-[#3299F5]' : 'text-red-600'
                        )}
                      >
                        {log.outcome}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-6">
            <div className="flex items-center gap-2 border-b border-[#E3EDF6] pb-3">
              <Sliders className="h-4 w-4 text-[#3299F5]" />
              <h2 className="font-display text-base font-bold text-[#102653]">
                Organization &amp; Clinical Oversight Settings
              </h2>
            </div>

            {savedMsg && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-[#3299F5]/30 bg-[#EAF5FF] px-3.5 py-2.5 text-xs text-[#102653]">
                <CheckCircle2 className="h-4 w-4 text-[#3299F5]" />
                {savedMsg}
              </div>
            )}
            {errorMsg && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#102653]">Platform / Workspace Name</label>
                <input
                  value={hospitalName}
                  onChange={(e) => setHospitalName(e.target.value)}
                  disabled={user?.role !== 'admin'}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-sm disabled:bg-[#F4F9FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#102653]">Operational Timezone</label>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  disabled={user?.role !== 'admin'}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-sm disabled:bg-[#F4F9FF]"
                />
              </div>
              <label className="flex items-center gap-2.5 text-sm text-[#172B4D]">
                <input
                  type="checkbox"
                  checked={humanOversight}
                  onChange={(e) => setHumanOversight(e.target.checked)}
                  disabled={user?.role !== 'admin'}
                  className="h-4 w-4 rounded border-[#E3EDF6] text-[#3299F5]"
                />
                <span>Require clinician approval before finalizing AI-drafted clinical summaries</span>
              </label>

              {user?.role === 'admin' ? (
                <button
                  type="submit"
                  className="rounded-xl bg-[#3299F5] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#2383db]"
                >
                  Save Platform Settings
                </button>
              ) : (
                <p className="text-xs text-[#71839C]">
                  Signed in as <span className="font-medium text-[#102653]">{user?.role}</span>. Platform-wide
                  configuration requires administrator privileges.
                </p>
              )}
            </form>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <VoicePreferenceCard />

            {user?.role === 'admin' && (
              <div className="rounded-2xl border border-[#E3EDF6] bg-white p-6">
                <div className="flex items-center gap-2 border-b border-[#E3EDF6] pb-3">
                  <Shield className="h-4 w-4 text-[#3299F5]" />
                  <h2 className="font-display text-base font-bold text-[#102653]">Rotate Super Admin Password</h2>
                </div>

                {pwMsg && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">
                    {pwMsg}
                  </div>
                )}
                {pwErr && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
                    {pwErr}
                  </div>
                )}

                <form onSubmit={handleRotatePassword} className="mt-4 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-[#102653]">Current Password</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#102653]">New Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-sm"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#102653] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#1b3a78]"
                  >
                    Update Password
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function VoicePreferenceCard() {
  const { apiFetch } = useAuth();
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ hospitalSettings: { voiceResponsesEnabled?: boolean } }>('/api/dashboard/overview?range=today')
      .then((res) => {
        if (typeof res.hospitalSettings.voiceResponsesEnabled === 'boolean') {
          setVoiceEnabled(res.hospitalSettings.voiceResponsesEnabled);
        }
      })
      .catch(() => {});
  }, [apiFetch]);

  const handleToggle = async (nextVal: boolean) => {
    setVoiceEnabled(nextVal);
    setSaving(true);
    setStatusMsg(null);
    try {
      await apiFetch('/api/hospital/voice-settings', {
        method: 'PATCH',
        body: JSON.stringify({ voiceResponsesEnabled: nextVal }),
      });
      setStatusMsg(nextVal ? 'Spoken confirmations enabled.' : 'Spoken confirmations muted.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#E3EDF6] bg-white p-6">
      <div className="flex items-center gap-2 border-b border-[#E3EDF6] pb-3">
        <Sliders className="h-4 w-4 text-[#3299F5]" />
        <h2 className="font-display text-base font-bold text-[#102653]">CareOS Voice Assistant</h2>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-[#71839C]">
        Control whether CareOS speaks short voice confirmations via SpeechSynthesis after completing major hospital
        orchestrations.
      </p>
      <label className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] px-4 py-3 text-xs font-semibold text-[#102653] cursor-pointer">
        <span>Speak workflow confirmations &amp; critical alerts</span>
        <input
          type="checkbox"
          checked={voiceEnabled}
          disabled={saving}
          onChange={(e) => handleToggle(e.target.checked)}
          className="h-4 w-4 rounded border-[#E3EDF6] text-[#3299F5]"
        />
      </label>
      {statusMsg && <div className="mt-2.5 text-[11px] font-medium text-[#3299F5]">{statusMsg}</div>}
    </div>
  );
}

