import React, { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, Clock, Send } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { AgentProfile } from '@/shared/types/careos';
import { cn } from '../../lib/utils';

export function AgentsHubPage() {
  const { user, apiFetch } = useAuth();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('agent-clinical');
  const [taskSummary, setTaskSummary] = useState('');
  const [department, setDepartment] = useState('Onboarding');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ agents: AgentProfile[] }>('/api/agents');
      setAgents(res.agents);
      if (res.agents.length > 0 && !res.agents.some((a) => a.id === selectedId)) {
        setSelectedId(res.agents[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, selectedId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  const selectedAgent = agents.find((a) => a.id === selectedId) ?? agents[0];

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    setDispatching(true);
    setFeedback(null);
    try {
      await apiFetch(`/api/agents/${selectedAgent.id}/dispatch`, {
        method: 'POST',
        body: JSON.stringify({
          taskSummary: taskSummary.trim() || `Coordinate ${selectedAgent.category.toLowerCase()} check for ${department}`,
          department,
        }),
      });
      setTaskSummary('');
      setFeedback(`Task dispatched to ${selectedAgent.name} and logged in activity timeline.`);
      await loadAgents();
    } finally {
      setDispatching(false);
    }
  };

  const handleStatusUpdate = async (agentId: string, status: AgentProfile['status']) => {
    await apiFetch(`/api/agents/${agentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadAgents();
  };

  return (
    <DashboardLayout
      title={user?.role === 'admin' ? 'AI Agent Monitoring' : 'AI Agent Hub'}
      breadcrumb={user?.role === 'admin' ? 'AI Agent Monitoring' : 'AI Agent Hub'}
      subtitle="Monitor and dispatch CareOS multi-agent orchestration across onboarding, clinical, compliance, and operations."
    >
      {loading && agents.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map((ag) => {
              const active = ag.id === selectedAgent?.id;
              return (
                <button
                  key={ag.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(ag.id);
                    setFeedback(null);
                  }}
                  className={cn(
                    'flex flex-col justify-between rounded-2xl border p-5 text-left transition-colors',
                    active ? 'border-[#3299F5] bg-[#EAF5FF]/50' : 'border-[#E3EDF6] bg-white hover:bg-[#F7FAFF]'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3299F5]">
                        <Bot className="h-4 w-4" />
                        {ag.category}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs font-semibold',
                          ag.status === 'Active' ? 'text-emerald-600' : ag.status === 'Monitoring' ? 'text-amber-600' : 'text-[#71839C]'
                        )}
                      >
                        <span
                          className={cn(
                            'h-1.5 w-1.5 rounded-full',
                            ag.status === 'Active' ? 'bg-emerald-500' : ag.status === 'Monitoring' ? 'bg-amber-500' : 'bg-slate-400'
                          )}
                        />
                        {ag.status}
                      </span>
                    </div>
                    <h2 className="mt-3 font-display text-base font-bold text-[#102653]">{ag.name}</h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#71839C]">{ag.description}</p>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#E3EDF6] pt-3 font-mono text-xs tabular-nums">
                    <div>
                      <div className="text-[11px] text-[#71839C]">Assigned</div>
                      <div className="font-semibold text-[#102653]">{ag.assignedTasks}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#71839C]">Completed</div>
                      <div className="font-semibold text-[#3299F5]">{ag.completedTasks}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-[#71839C]">Pending</div>
                      <div className="font-semibold text-[#102653]">{ag.pendingTasks}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedAgent && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-white p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-[#102653]">{selectedAgent.name}</h3>
                  {user?.role === 'admin' ? (
                    <select
                      value={selectedAgent.status}
                      onChange={(e) => handleStatusUpdate(selectedAgent.id, e.target.value as AgentProfile['status'])}
                      aria-label="Update agent status"
                      className="h-8 rounded-lg border border-[#E3EDF6] bg-[#F7FAFF] px-2.5 text-xs font-semibold text-[#102653]"
                    >
                      <option value="Active">Active</option>
                      <option value="Monitoring">Monitoring</option>
                      <option value="Paused">Paused</option>
                    </select>
                  ) : (
                    <span className="font-mono text-xs text-[#71839C] tabular-nums">
                      {selectedAgent.avgResponseSeconds}s avg
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-[#71839C]">{selectedAgent.description}</p>

                <div className="mt-4 space-y-1.5 border-t border-[#E3EDF6] pt-4">
                  {selectedAgent.highlights.map((hl) => (
                    <div key={hl} className="flex items-center gap-2 text-xs text-[#172B4D]">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[#3299F5]" />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleDispatch} className="mt-6 space-y-3 border-t border-[#E3EDF6] pt-5">
                  <div className="text-xs font-semibold text-[#102653]">Dispatch Agent Coordination Task</div>
                  {feedback && (
                    <div className="rounded-xl border border-[#3299F5]/30 bg-[#EAF5FF] px-3 py-2 text-xs text-[#102653]">
                      {feedback}
                    </div>
                  )}
                  <div>
                    <label htmlFor="agent-dept" className="block text-xs font-medium text-[#71839C]">
                      Target Area / Department
                    </label>
                    <select
                      id="agent-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] bg-white px-3 text-sm text-[#172B4D]"
                    >
                      <option>Onboarding</option>
                      <option>Governance</option>
                      <option>Cardiology</option>
                      <option>Emergency</option>
                      <option>General Medicine</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="agent-task" className="block text-xs font-medium text-[#71839C]">
                      Instruction / Coordination Request
                    </label>
                    <textarea
                      id="agent-task"
                      rows={3}
                      value={taskSummary}
                      onChange={(e) => setTaskSummary(e.target.value)}
                      placeholder={`Instruct ${selectedAgent.shortName} (e.g., Verify onboarding license or audit department throughput)...`}
                      className="mt-1 w-full rounded-xl border border-[#E3EDF6] p-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={dispatching}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3299F5] px-4 text-xs font-semibold text-white hover:bg-[#2383db] disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {dispatching ? 'Dispatching...' : `Run ${selectedAgent.shortName} Agent`}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-6">
                <h3 className="font-display text-base font-bold text-[#102653]">
                  Recent Activity Timeline · {selectedAgent.name}
                </h3>
                <p className="mt-1 text-xs text-[#71839C]">
                  Real-time operational log updated whenever tasks or onboarding workflows execute
                </p>

                {selectedAgent.recentActivity.length === 0 ? (
                  <div className="mt-8 rounded-xl border border-dashed border-[#E3EDF6] bg-[#F7FAFF] py-10 text-center text-xs text-[#71839C]">
                    No tasks executed yet by {selectedAgent.name}. Activity will populate here dynamically.
                  </div>
                ) : (
                  <div className="mt-5 divide-y divide-[#E3EDF6]">
                    {selectedAgent.recentActivity.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-4 py-3.5">
                        <div className="space-y-1">
                          <div className="text-sm font-medium text-[#102653]">{item.summary}</div>
                          <div className="flex items-center gap-2 text-xs text-[#71839C]">
                            <Clock className="h-3.5 w-3.5 text-[#3299F5]" />
                            <span className="font-mono tabular-nums">{item.timestamp}</span>
                            <span aria-hidden="true">·</span>
                            <span>{item.department}</span>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 text-xs font-semibold',
                            item.outcome === 'Completed' ? 'text-emerald-600' : 'text-amber-700'
                          )}
                        >
                          {item.outcome}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
