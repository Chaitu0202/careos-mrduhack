import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  MessageSquare,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AGENT_NODES, AgentNetwork, type NodeVisualStatus } from './AgentNetwork';
import { ConnectedToolsRow } from './ConnectedTools';
import type {
  InterAgentMessage,
  OrchestratorAgentKey,
  WorkflowExecutionRecord,
} from '@/shared/types/careos';
import { cn, formatTimeAgo } from '../../lib/utils';

export type ExecutionPhase = 'understanding' | 'coordinating' | 'executing' | 'completed' | 'error';

const INITIAL_STATUSES: Record<OrchestratorAgentKey, NodeVisualStatus> = {
  finance: 'inactive',
  radiology: 'inactive',
  operations: 'inactive',
  insurance: 'inactive',
  sales: 'inactive',
  marketing: 'inactive',
};

const PHASE_COPY: Record<ExecutionPhase, { title: string; subtitle: string }> = {
  understanding: {
    title: 'Understanding your request...',
    subtitle: 'CareOS Intelligence is analyzing intent and querying live hospital context.',
  },
  coordinating: {
    title: 'Identifying the departments required...',
    subtitle: 'Selecting specialized departmental agents and establishing orchestration order.',
  },
  executing: {
    title: 'Your departments are working together.',
    subtitle: 'Agents are exchanging findings, verifying approvals, and compiling results.',
  },
  completed: {
    title: 'Your request has been processed.',
    subtitle: 'CareOS consolidated the departmental findings and prepared your operational brief.',
  },
  error: {
    title: 'Orchestration encountered an issue.',
    subtitle: 'CareOS could not complete this workflow. Review the diagnostic notice below.',
  },
};

export function AgentExecutionOverlay({
  open,
  instruction,
  phase,
  execution,
  errorMessage,
  onRetry,
  onApproveItem,
  onClose,
}: {
  open: boolean;
  instruction: string;
  phase: ExecutionPhase;
  execution: WorkflowExecutionRecord | null;
  errorMessage: string | null;
  onRetry: () => void;
  onApproveItem: (workflowId: string, approvalId: string) => Promise<void>;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const [revealedCount, setRevealedCount] = useState(0);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [activeFeedTab, setActiveFeedTab] = useState<'messages' | 'timeline' | 'alerts'>('messages');

  const messages = execution?.interAgentMessages ?? [];

  // Progressively reveal real inter-agent messages during executing -> completed
  useEffect(() => {
    if (!open || !execution) {
      setRevealedCount(0);
      return;
    }
    if (phase === 'completed') {
      setRevealedCount(messages.length);
      return;
    }
    if (phase === 'executing') {
      setRevealedCount(messages.length > 0 ? 1 : 0);
      let step = 1;
      const timer = setInterval(() => {
        step += 1;
        setRevealedCount(Math.min(step, messages.length));
        if (step >= messages.length) {
          clearInterval(timer);
        }
      }, 420);
      return () => clearInterval(timer);
    }
  }, [open, execution, phase, messages.length]);

  const visibleMessages: InterAgentMessage[] = useMemo(() => {
    if (!execution) return [];
    return messages.slice(0, phase === 'completed' ? messages.length : revealedCount);
  }, [execution, messages, phase, revealedCount]);

  // Compute node visual states strictly from phase & real execution data
  const nodeStatuses: Record<OrchestratorAgentKey, NodeVisualStatus> = useMemo(() => {
    const map = { ...INITIAL_STATUSES };
    if (phase === 'error') {
      if (execution?.participatingAgents) {
        for (const k of execution.participatingAgents) map[k] = 'error';
      }
      return map;
    }
    if (!execution) return map;

    if (phase === 'coordinating') {
      for (const k of execution.participatingAgents) map[k] = 'active';
      return map;
    }

    if (phase === 'executing') {
      const doneKeys = new Set<OrchestratorAgentKey>();
      visibleMessages.slice(0, -1).forEach((m) => {
        if (m.fromKey !== 'core') doneKeys.add(m.fromKey);
      });
      for (const k of execution.participatingAgents) {
        map[k] = doneKeys.has(k) ? 'completed' : 'active';
      }
      return map;
    }

    if (phase === 'completed') {
      for (const k of execution.participatingAgents) {
        const hasWarning = execution.interAgentMessages.some(
          (m) => (m.fromKey === k || m.toKey === k) && m.status === 'warning'
        );
        map[k] = hasWarning ? 'error' : 'completed';
      }
    }
    return map;
  }, [execution, phase, visibleMessages]);

  const activeLinkPair = useMemo(() => {
    if (phase !== 'executing' || visibleMessages.length === 0) return null;
    const latest = visibleMessages[visibleMessages.length - 1];
    return { from: latest.fromKey, to: latest.toKey };
  }, [phase, visibleMessages]);

  const coreState: NodeVisualStatus =
    phase === 'error' ? 'error' : phase === 'completed' ? 'completed' : 'active';

  const handleDownloadReport = () => {
    if (!execution) return;
    const lines: string[] = [
      `CAREOS OPERATIONAL INTELLIGENCE REPORT`,
      `Workflow ID: ${execution.workflowCode}`,
      `Executed: ${new Date(execution.executedAt).toLocaleString()}`,
      `Instruction: ${execution.instruction}`,
      `Status: ${execution.status}`,
      ``,
      `EXECUTIVE BRIEF`,
      execution.executiveBrief,
      ``,
      `VOICE CONFIRMATION`,
      execution.voiceConfirmation,
      ``,
      ...execution.reportSections.flatMap((sec) => [
        sec.title.toUpperCase(),
        ...sec.items.map((it) => `  - ${it.label}: ${it.value}`),
        ``,
      ]),
      `INTER-AGENT COORDINATION LOG`,
      ...execution.interAgentMessages.map(
        (m) => `  [${m.step}] ${m.fromAgent} -> ${m.toAgent}: ${m.message}`
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${execution.workflowCode.toLowerCase()}-report.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleApprove = async (approvalId: string) => {
    if (!execution) return;
    setApprovingId(approvalId);
    try {
      await onApproveItem(execution.id, approvalId);
    } finally {
      setApprovingId(null);
    }
  };

  const copy = PHASE_COPY[phase];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="careos-execution-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.1 : 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-50 overflow-y-auto bg-[#F4F9FF]/82 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="CareOS Immersive Agent Execution Mode"
        >
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 18, scale: reduced ? 1 : 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : 12, scale: reduced ? 1 : 0.985 }}
            transition={{ duration: reduced ? 0.1 : 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-[1320px] px-4 py-5 sm:px-6 lg:px-8"
          >
            {/* Top Execution Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#DCEBFA] bg-white/95 px-5 py-3.5 shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={cn(
                    'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl',
                    phase === 'error'
                      ? 'bg-amber-50 text-amber-600'
                      : phase === 'completed'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-[#EAF5FF] text-[#3299F5]'
                  )}
                >
                  {phase === 'error' ? (
                    <AlertTriangle className="h-5 w-5" />
                  ) : phase === 'completed' ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#3299F5]">
                    <span>CAREOS ORCHESTRATION</span>
                    {execution?.workflowCode && (
                      <>
                        <span className="text-[#71839C]">·</span>
                        <span className="font-mono text-[#102653]">{execution.workflowCode}</span>
                      </>
                    )}
                    {execution && (
                      <>
                        <span className="text-[#71839C]">·</span>
                        <span className="font-mono text-[#71839C] tabular-nums">
                          {(execution.executionMs / 1000).toFixed(1)}s
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="truncate font-display text-base sm:text-lg font-bold text-[#102653]">
                    {copy.title}
                  </h2>
                  <p className="truncate text-xs text-[#71839C]">{copy.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E3EDF6] bg-white px-3.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to Dashboard
                </button>
              </div>
            </div>

            {/* Submitted Natural Language Instruction */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#DCEBFA] bg-white/90 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[#3299F5] shrink-0">Instruction:</span>
                <span className="truncate font-medium text-[#102653]">&ldquo;{instruction}&rdquo;</span>
              </div>
              {execution && (
                <div className="text-[11px] font-medium text-[#71839C] whitespace-nowrap">
                  Activated {execution.participatingAgents.length} departmental agents
                </div>
              )}
            </div>

            {/* Error State Notice */}
            {phase === 'error' && errorMessage && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  <div className="flex-1">
                    <h3 className="font-display text-sm font-bold text-[#102653]">
                      Unable to Complete Multi-Agent Orchestration
                    </h3>
                    <p className="mt-1 text-xs leading-relaxed text-red-700">{errorMessage}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={onRetry}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#3299F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2383db]"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Retry Orchestration
                      </button>
                      <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-[#E3EDF6] bg-white px-4 py-2 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                      >
                        Return to Dashboard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Main Stage: Circular Agent Network + Live Communication / Timeline / Alerts */}
            <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7 space-y-3">
                <AgentNetwork
                  coreState={coreState}
                  coreLabel={
                    phase === 'understanding'
                      ? 'Understanding request'
                      : phase === 'coordinating'
                      ? 'Selecting departments'
                      : phase === 'executing'
                      ? 'Coordinating agents'
                      : phase === 'error'
                      ? 'Issue detected'
                      : 'Coordination complete'
                  }
                  nodeStatuses={nodeStatuses}
                  activeLinkPair={activeLinkPair}
                />

                {execution && execution.participatingAgents.length > 0 && (
                  <div className="rounded-xl border border-[#DCEBFA] bg-white/95 p-3 shadow-xs">
                    <div className="mb-2 text-[11px] font-bold text-[#102653]">
                      Connected External Tools Queried in This Workflow
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {execution.participatingAgents.map((agentKey) => {
                        const def = AGENT_NODES.find((n) => n.key === agentKey);
                        return (
                          <div
                            key={agentKey}
                            className="flex flex-col gap-1.5 rounded-lg border border-[#EDF3FA] bg-[#FAFCFF] px-2.5 py-2"
                          >
                            <span className="text-[11px] font-semibold text-[#102653]">
                              {def?.label || agentKey}
                            </span>
                            <ConnectedToolsRow agentKey={agentKey} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Inter-Agent Communication Feed / Timeline / Alerts */}
              <div className="lg:col-span-5 rounded-2xl border border-[#DCEBFA] bg-white p-4 shadow-sm flex flex-col">
                <div className="flex items-center gap-1 rounded-xl bg-[#F4F9FF] p-1">
                  {(
                    [
                      { id: 'messages', label: 'Agent Messages', icon: MessageSquare },
                      { id: 'timeline', label: 'Timeline', icon: Clock },
                      {
                        id: 'alerts',
                        label: `Alerts (${execution?.departmentalAlerts.length ?? 0})`,
                        icon: Bell,
                      },
                    ] as const
                  ).map((t) => {
                    const TabIcon = t.icon;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveFeedTab(t.id)}
                        className={cn(
                          'flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11.5px] font-semibold transition-colors whitespace-nowrap',
                          activeFeedTab === t.id
                            ? 'bg-white text-[#3299F5] shadow-xs'
                            : 'text-[#71839C] hover:text-[#102653]'
                        )}
                      >
                        <TabIcon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 flex-1 space-y-2.5 overflow-y-auto max-h-[380px] pr-1">
                  {activeFeedTab === 'messages' && (
                    <>
                      {visibleMessages.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[#71839C]">
                          {phase === 'error'
                            ? 'No agent communication completed due to orchestration error.'
                            : 'CareOS Intelligence is dispatching departmental queries...'}
                        </div>
                      ) : (
                        visibleMessages.map((msg) => (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: reduced ? 0 : 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.25 }}
                            className="rounded-xl border border-[#E3EDF6] bg-[#FAFCFF] p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-[#102653]">
                                {msg.fromAgent} → <span className="text-[#3299F5]">{msg.toAgent}</span>
                              </span>
                              <span
                                className={cn(
                                  'font-semibold',
                                  msg.status === 'warning'
                                    ? 'text-amber-600'
                                    : msg.status === 'pending_approval'
                                    ? 'text-[#3299F5]'
                                    : 'text-emerald-600'
                                )}
                              >
                                {msg.status === 'pending_approval' ? 'Review' : msg.status}
                              </span>
                            </div>
                            <p className="mt-1 text-[#172B4D] leading-relaxed">{msg.message}</p>
                          </motion.div>
                        ))
                      )}
                    </>
                  )}

                  {activeFeedTab === 'timeline' && (
                    <div className="relative space-y-3 pl-5 pt-1 before:absolute before:left-[6px] before:top-2 before:bottom-2 before:w-px before:bg-[#DCEBFA]">
                      <div className="relative text-xs">
                        <span className="absolute -left-5 top-1 h-3 w-3 rounded-full bg-[#3299F5] ring-4 ring-white" />
                        <div className="font-bold text-[#102653]">CAREOS INTELLIGENCE</div>
                        <div className="text-[#71839C]">
                          {execution ? execution.intentSummary : 'Understanding administrator instruction.'}
                        </div>
                      </div>
                      {visibleMessages.map((msg) => (
                        <div key={msg.id} className="relative text-xs">
                          <span className="absolute -left-5 top-1 h-3 w-3 rounded-full bg-emerald-500 ring-4 ring-white" />
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#102653]">{msg.fromAgent.toUpperCase()}</span>
                            <span className="font-mono text-[10px] text-[#71839C]">
                              {formatTimeAgo(msg.timestamp)}
                            </span>
                          </div>
                          <div className="text-[#172B4D]">{msg.message}</div>
                        </div>
                      ))}
                      {phase === 'completed' && execution && (
                        <div className="relative text-xs">
                          <span className="absolute -left-5 top-1 h-3 w-3 rounded-full bg-emerald-600 ring-4 ring-white" />
                          <div className="font-bold text-emerald-700">CONSOLIDATED BRIEF READY</div>
                          <div className="text-[#4F627D]">{execution.reportTitle}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeFeedTab === 'alerts' && (
                    <>
                      {!execution || execution.departmentalAlerts.length === 0 ? (
                        <div className="py-12 text-center text-xs text-[#71839C]">
                          No departmental alerts triggered for this workflow.
                        </div>
                      ) : (
                        execution.departmentalAlerts.map((al) => (
                          <div
                            key={al.id}
                            className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#102653]">{al.department}</span>
                              <span className="font-mono text-[10.5px] font-semibold text-amber-700">
                                {al.priority} · {al.status}
                              </span>
                            </div>
                            <p className="mt-1 text-[#172B4D]">{al.summary}</p>
                            <div className="mt-2 flex items-center justify-between text-[11px]">
                              <span className="text-[#71839C]">{al.agentName}</span>
                              <Link
                                to={al.targetPath}
                                onClick={onClose}
                                className="font-semibold text-[#3299F5] hover:text-[#102653]"
                              >
                                Open Department →
                              </Link>
                            </div>
                          </div>
                        ))
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* STATE 4: Consolidated Final Result Panel */}
            {phase === 'completed' && execution && (
              <motion.section
                initial={{ opacity: 0, y: reduced ? 0 : 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="mt-5 rounded-2xl border border-[#BFDDFB] bg-white p-5 shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E3EDF6] pb-4">
                  <div>
                    <div className="text-xs font-semibold text-emerald-600">
                      Consolidated Result · {execution.workflowCode}
                    </div>
                    <h3 className="mt-0.5 font-display text-lg font-bold text-[#102653]">
                      {execution.reportTitle}
                    </h3>
                    <p className="mt-1 max-w-3xl text-xs leading-relaxed text-[#4F627D]">
                      {execution.executiveBrief}
                    </p>
                    {execution.voiceConfirmation && (
                      <div className="mt-2 flex max-w-3xl flex-wrap items-start gap-x-2 gap-y-1 rounded-lg bg-[#F7FBFF] px-3 py-2 text-[11px] text-[#4F627D]">
                        <span className="font-bold text-[#3299F5]">CareOS voice confirmation:</span>
                        <span>&ldquo;{execution.voiceConfirmation}&rdquo;</span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailModalOpen(true)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#3299F5] px-4 text-xs font-semibold text-white hover:bg-[#2383db]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      View Detailed Report
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E3EDF6] bg-white px-3.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                    >
                      <Download className="h-3.5 w-3.5 text-[#3299F5]" />
                      Download Report
                    </button>
                  </div>
                </div>

                {/* Department-wise Consolidated Summary Grid */}
                {execution.reportSections.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
                    {execution.reportSections.slice(0, 4).map((sec) => (
                      <div key={sec.title} className="rounded-xl border border-[#E3EDF6] bg-[#F8FBFF] p-3.5">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-[#3299F5]">
                          {sec.title}
                        </div>
                        <div className="mt-2 space-y-1.5">
                          {sec.items.map((item) => (
                            <div key={item.label} className="flex items-center justify-between gap-2 text-xs">
                              <span className="truncate text-[#4F627D]">{item.label}</span>
                              <span className="font-mono font-semibold text-[#102653] tabular-nums">
                                {item.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Human-in-the-Loop Approvals */}
                {execution.pendingApprovals.length > 0 && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#102653]">
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                      <span>Human Oversight · Pending Administrator Approval</span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-1 gap-2.5 md:grid-cols-2">
                      {execution.pendingApprovals.map((pa) => (
                        <div
                          key={pa.id}
                          className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3.5 py-2.5 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-[#102653]">{pa.title}</div>
                            <div className="truncate text-[11px] text-[#71839C]">
                              {pa.department} · {pa.description}
                            </div>
                          </div>
                          {pa.approved ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 shrink-0">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Approved
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={approvingId === pa.id}
                              onClick={() => handleApprove(pa.id)}
                              className="shrink-0 rounded-lg bg-[#102653] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1c3d82] disabled:opacity-60"
                            >
                              {approvingId === pa.id ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.section>
            )}

            {/* Full Detailed Report Modal */}
            {detailModalOpen && execution && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#102653]/50 p-4">
                <div className="w-full max-w-2xl rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl max-h-[88vh] overflow-y-auto">
                  <div className="flex items-start justify-between border-b border-[#E3EDF6] pb-3.5">
                    <div>
                      <div className="font-mono text-xs font-semibold text-[#3299F5]">
                        {execution.workflowCode} · Detailed Report
                      </div>
                      <h3 className="mt-0.5 font-display text-lg font-bold text-[#102653]">
                        {execution.reportTitle}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDetailModalOpen(false)}
                      className="rounded-lg p-1 text-[#71839C] hover:bg-[#F4F9FF]"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-[#172B4D]">{execution.executiveBrief}</p>

                  <div className="mt-4 space-y-4">
                    {execution.reportSections.map((sec) => (
                      <div key={sec.title} className="rounded-xl border border-[#E3EDF6] bg-[#FAFCFF] p-4">
                        <div className="text-xs font-bold text-[#102653]">{sec.title}</div>
                        <div className="mt-2 divide-y divide-[#EDF3FA]">
                          {sec.items.map((it) => (
                            <div key={it.label} className="flex items-center justify-between py-1.5 text-xs">
                              <span className="text-[#4F627D]">{it.label}</span>
                              <span className="font-mono font-semibold text-[#102653]">{it.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#E3EDF6] px-4 py-2 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                    >
                      <Download className="h-3.5 w-3.5 text-[#3299F5]" />
                      Download
                    </button>
                    <button
                      type="button"
                      onClick={() => setDetailModalOpen(false)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#3299F5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2383db]"
                    >
                      Done
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
