import React, { useCallback, useEffect, useState } from 'react';
import { Bot, CheckCircle2, Clock, Send } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { AgentProfile } from '../../types/careos';
import { cn } from '../../lib/utils';

export function AgentsHubPage() {
  const { apiFetch } = useAuth();
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('agent-patient');
  const [taskSummary, setTaskSummary] = useState('');
  const [department, setDepartment] = useState('Cardiology');
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

  return (
    <DashboardLayout title="AI Agent Hub" breadcrumb="Intelligence / AI Agent Hub">
      {loading && agents.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-lg border border-[#E3EDF6] bg-[#F4F9FF]" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 6 Agent Cards */}
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
                    'flex flex-col justify-between rounded-lg border p-5 text-left transition-colors',
                    active ? 'border-[#3299F5] bg-[#F4F9FF]' : 'border-[#E3EDF6] bg-white hover:bg-[#F4F9FF]/50'
                  )}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3299F5]">
                        <Bot className="h-4 w-4" />
                        {ag.category}
                      </span>
                      <span className="text-xs font-semibold text-[#102653]">{ag.status}</span>
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

          {/* Agent Interaction Panel & Activity Timeline */}
          {selectedAgent && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-5 rounded-lg border border-[#E3EDF6] bg-white p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold text-[#102653]">{selectedAgent.name}</h3>
                  <span className="font-mono text-xs text-[#71839C] tabular-nums">
                    {selectedAgent.avgResponseSeconds}s avg response
                  </span>
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
                    <div className="rounded border border-[#3299F5]/30 bg-[#EAF5FF] px-3 py-2 text-xs text-[#102653]">
                      {feedback}
                    </div>
                  )}
                  <div>
                    <label htmlFor="agent-dept" className="block text-xs font-medium text-[#71839C]">
                      Target Department
                    </label>
                    <select
                      id="agent-dept"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-3 text-sm text-[#172B4D]"
                    >
                      <option>Cardiology</option>
                      <option>Emergency</option>
                      <option>Neurology</option>
                      <option>Orthopedics</option>
                      <option>Pediatrics</option>
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
                      placeholder={`Instruct ${selectedAgent.shortName} (e.g., Prepare ward round brief or verify discharge readiness)...`}
                      className="mt-1 w-full rounded-md border border-[#E3EDF6] p-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={dispatching}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#102653] px-4 text-sm font-semibold text-white hover:bg-[#1b3a78] disabled:opacity-60"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {dispatching ? 'Dispatching...' : `Run ${selectedAgent.shortName}`}
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 rounded-lg border border-[#E3EDF6] bg-white p-6">
                <h3 className="font-display text-base font-bold text-[#102653]">
                  Recent Activity Timeline · {selectedAgent.name}
                </h3>
                <p className="mt-1 text-xs text-[#71839C]">
                  Real-time operational log with human-in-the-loop review statuses
                </p>

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
                          item.outcome === 'Completed' ? 'text-[#3299F5]' : 'text-amber-700'
                        )}
                      >
                        {item.outcome}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
