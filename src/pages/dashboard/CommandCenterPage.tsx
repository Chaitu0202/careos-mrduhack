import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Search,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { AppointmentTrendChart, HorizontalBarMetric } from '../../components/Charts';
import { useAuth } from '../../context/AuthContext';
import type { DashboardOverviewData } from '../../types/careos';
import { cn } from '../../lib/utils';

export function CommandCenterPage() {
  const { apiFetch } = useAuth();
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
      title="Command Center"
      breadcrumb="Overview / Command Center"
      actions={
        <div className="flex items-center gap-1 rounded-md border border-[#E3EDF6] bg-[#F4F9FF] p-0.5">
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
                'rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap',
                range === item.id ? 'bg-white text-[#102653] shadow-xs' : 'text-[#71839C] hover:text-[#102653]'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[...Array(5)].map((_, idx) => (
              <div key={idx} className="h-28 animate-pulse rounded-lg border border-[#E3EDF6] bg-[#F4F9FF]" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-lg border border-[#E3EDF6] bg-[#F4F9FF]" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Top Metrics */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                  <Users className="h-4 w-4" />
                </span>
                <span className="text-[11px] font-medium text-[#71839C]">Sample</span>
              </div>
              <div className="mt-3 text-xs font-medium text-[#71839C]">Total Patients</div>
              <div className="mt-0.5 font-display text-2xl font-bold text-[#102653] tabular-nums">
                {data.metrics.totalPatients}
              </div>
              <div className="mt-1 text-xs text-[#71839C]">Registry synchronized</div>
            </div>

            <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
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
              <div className="mt-1 text-xs text-[#71839C]">Avg wait {data.metrics.avgWaitMinutes} min</div>
            </div>

            <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
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
              <div className="mt-1 text-xs text-[#71839C]">Inpatient & ICU</div>
            </div>

            <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
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
              <div className="mt-1 text-xs text-[#71839C]">Hospital capacity</div>
            </div>

            <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
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
              <div className="mt-1 text-xs text-[#71839C]">Agent & staff queue</div>
            </div>
          </div>

          {/* Appointment Trends & Patient Flow Monitoring */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-lg border border-[#E3EDF6] bg-white p-5">
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

            <div className="lg:col-span-5 rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#102653]">Patient Flow Monitoring</h2>
                  <p className="text-xs text-[#71839C]">Current volume and dwell time by stage</p>
                </div>
                <Link to="/dashboard/patients" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  Patients →
                </Link>
              </div>
              <div className="space-y-3.5">
                {data.patientFlowStages.map((stage) => (
                  <div key={stage.stage} className="rounded-md border border-[#E3EDF6] bg-[#F4F9FF]/50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[#102653]">{stage.stage}</span>
                      <span className="font-mono text-sm font-semibold text-[#3299F5] tabular-nums">{stage.count}</span>
                    </div>
                    <div className="mt-1 text-xs text-[#71839C] tabular-nums">
                      Average stage duration: {stage.avgMinutes} min
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Department Workload & AI Agent Activity Status */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-6 rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-[#102653]">Department Workload</h2>
                  <p className="text-xs text-[#71839C]">Bed capacity utilization and wait times</p>
                </div>
                <Link to="/dashboard/departments" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  Departments →
                </Link>
              </div>
              <div className="space-y-4">
                {data.departments.map((dept) => {
                  const pct = dept.bedCapacity > 0 ? dept.occupiedBeds / dept.bedCapacity : 0;
                  return (
                    <HorizontalBarMetric
                      key={dept.id}
                      label={`${dept.name} · ${dept.status}`}
                      value={dept.occupiedBeds}
                      max={dept.bedCapacity}
                      sublabel={`${dept.occupiedBeds}/${dept.bedCapacity} beds · ${dept.avgWaitMinutes}m wait`}
                      accent={pct > 0.8 ? 'warning' : 'primary'}
                    />
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-6 rounded-lg border border-[#E3EDF6] bg-white p-5">
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

          {/* Pending Operational Tasks & Recent Notifications */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-display text-base font-semibold text-[#102653]">Pending Operational Tasks</h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71839C]" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter tasks..."
                    aria-label="Filter operational tasks"
                    className="h-8 rounded-md border border-[#E3EDF6] pl-8 pr-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                  />
                </div>
              </div>
              {filteredTasks.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#71839C]">No operational tasks match your filter.</div>
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
                        <tr key={task.id} className="hover:bg-[#F4F9FF]/50">
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
                              className="inline-flex items-center gap-1 rounded border border-[#E3EDF6] px-2.5 py-1 text-xs font-medium text-[#102653] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
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

            <div className="lg:col-span-5 rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="mb-4">
                <h2 className="font-display text-base font-semibold text-[#102653]">Recent Notifications</h2>
                <p className="text-xs text-[#71839C]">Operational alerts & clinician review items</p>
              </div>
              <div className="space-y-3">
                {data.notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    className={cn(
                      'rounded-md border border-[#E3EDF6] p-3.5',
                      notif.read ? 'bg-white' : 'bg-[#F4F9FF]'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold text-[#102653]">{notif.title}</div>
                      <span className="shrink-0 text-[11px] font-mono text-[#71839C]">{notif.timestamp}</span>
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
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
