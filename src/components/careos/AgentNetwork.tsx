import { useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Brain,
  Check,
  Megaphone,
  Scan,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { OrchestratorAgentKey } from '../../types/careos';
import { AGENT_CONNECTED_TOOLS } from './ConnectedTools';
import { cn } from '../../lib/utils';

export type NodeVisualStatus = 'inactive' | 'active' | 'completed' | 'error';

export interface AgentNodeDefinition {
  key: OrchestratorAgentKey;
  label: string;
  shortLabel: string;
  department: string;
  angleDeg: number;
  icon: typeof Banknote;
  x: number;
  y: number;
}

const VB_W = 920;
const VB_H = 640;
const CENTER_X = 460;
const CENTER_Y = 320;
const AGENT_RADIUS = 148;
const TOOL_RX = 292;
const TOOL_RY = 248;

function pointOnCircle(cx: number, cy: number, rx: number, ry: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: Number((cx + rx * Math.cos(rad)).toFixed(1)),
    y: Number((cy + ry * Math.sin(rad)).toFixed(1)),
  };
}

const BASE_AGENTS: Array<Omit<AgentNodeDefinition, 'x' | 'y'>> = [
  {
    key: 'radiology',
    label: 'Radiology Agent',
    shortLabel: 'Radiology',
    department: 'Imaging & PACS',
    angleDeg: -90,
    icon: Scan,
  },
  {
    key: 'finance',
    label: 'Finance & Billing Agent',
    shortLabel: 'Finance & Billing',
    department: 'Revenue & Ledger',
    angleDeg: -30,
    icon: Banknote,
  },
  {
    key: 'insurance',
    label: 'Insurance & Discharge Agent',
    shortLabel: 'Insurance & Discharge',
    department: 'TPA & Clearance',
    angleDeg: 30,
    icon: ShieldCheck,
  },
  {
    key: 'sales',
    label: 'Sales Agent',
    shortLabel: 'Sales',
    department: 'Partnerships & CRM',
    angleDeg: 90,
    icon: TrendingUp,
  },
  {
    key: 'marketing',
    label: 'Marketing Agent',
    shortLabel: 'Marketing',
    department: 'Campaigns & Outreach',
    angleDeg: 150,
    icon: Megaphone,
  },
  {
    key: 'operations',
    label: 'Patient Operations Agent',
    shortLabel: 'Patient Operations',
    department: 'Admissions & Beds',
    angleDeg: 210,
    icon: Users,
  },
];

export const AGENT_NODES: AgentNodeDefinition[] = BASE_AGENTS.map((a) => {
  const pt = pointOnCircle(CENTER_X, CENTER_Y, AGENT_RADIUS, AGENT_RADIUS, a.angleDeg);
  return { ...a, x: pt.x, y: pt.y };
});

function curvedPath(x1: number, y1: number, x2: number, y2: number, bend = 18): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = mx + nx * bend;
  const cy = my + ny * bend;
  return `M ${x1} ${y1} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2} ${y2}`;
}

function getSubToolNodes(agent: AgentNodeDefinition) {
  const tools = AGENT_CONNECTED_TOOLS[agent.key] ?? [];
  const count = tools.length;
  const spread = count >= 4 ? 42 : 32;
  return tools.map((tool, idx) => {
    const offset = count <= 1 ? 0 : -spread / 2 + (spread / (count - 1)) * idx;
    const angle = agent.angleDeg + offset;
    const pt = pointOnCircle(CENTER_X, CENTER_Y, TOOL_RX, TOOL_RY, angle);
    return {
      tool,
      angle,
      x: pt.x,
      y: pt.y,
    };
  });
}

export function AgentNetwork({
  coreState,
  coreLabel,
  nodeStatuses,
  activeLinkPair,
  interactive = false,
  selectedAgent = null,
  onSelectAgent,
}: {
  coreState: NodeVisualStatus;
  coreLabel: string;
  nodeStatuses: Record<OrchestratorAgentKey, NodeVisualStatus>;
  activeLinkPair?: { from: OrchestratorAgentKey | 'core'; to: OrchestratorAgentKey | 'core' } | null;
  interactive?: boolean;
  selectedAgent?: OrchestratorAgentKey | null;
  onSelectAgent?: (key: OrchestratorAgentKey | null) => void;
}) {
  const reduced = useReducedMotion();
  const [hoveredAgent, setHoveredAgent] = useState<OrchestratorAgentKey | null>(null);
  const focusedAgent = hoveredAgent ?? selectedAgent;

  const getCoords = (key: OrchestratorAgentKey | 'core') => {
    if (key === 'core') return { x: CENTER_X, y: CENTER_Y };
    const found = AGENT_NODES.find((n) => n.key === key);
    return found ? { x: found.x, y: found.y } : { x: CENTER_X, y: CENTER_Y };
  };

  const activeInterAgentPath =
    activeLinkPair && activeLinkPair.from !== activeLinkPair.to
      ? (() => {
          const p1 = getCoords(activeLinkPair.from);
          const p2 = getCoords(activeLinkPair.to);
          return curvedPath(p1.x, p1.y, p2.x, p2.y, 32);
        })()
      : null;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[#DCEBFA] bg-gradient-to-b from-[#FFFFFF] via-[#F7FBFF] to-[#EEF6FF] p-2 sm:p-3">
      <div className="relative mx-auto w-full max-w-[920px]">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="CareOS 3-Tier Agent and Connected Tool Network"
        >
        <defs>
          <radialGradient id="careosCoreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#62C5F5" stopOpacity="0.28" />
            <stop offset="70%" stopColor="#3299F5" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#3299F5" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Inner & Outer concentric guide rings */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={AGENT_RADIUS}
          fill="none"
          stroke="#DCEBFA"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <ellipse
          cx={CENTER_X}
          cy={CENTER_Y}
          rx={TOOL_RX}
          ry={TOOL_RY}
          fill="none"
          stroke="#E4EFFA"
          strokeWidth="1"
          strokeDasharray="3 7"
        />

        {/* Core Aura */}
        <circle cx={CENTER_X} cy={CENTER_Y} r={coreState === 'active' ? 88 : 74} fill="url(#careosCoreGlow)" />

        {/* Layer 1 & Layer 2 Curved SVG Links + Animated Particles */}
        {AGENT_NODES.map((node, index) => {
          const status = nodeStatuses[node.key];
          const isFocused = focusedAgent === node.key;
          const isActive = status === 'active' || isFocused;
          const isCompleted = status === 'completed';
          const isError = status === 'error';

          const coreToAgentPath = curvedPath(
            CENTER_X,
            CENTER_Y,
            node.x,
            node.y,
            index % 2 === 0 ? 16 : -16
          );
          const subTools = getSubToolNodes(node);

          const strokeColor = isError
            ? '#F59E0B'
            : isCompleted
            ? '#10B981'
            : isActive
            ? '#3299F5'
            : '#D5E5F5';

          return (
            <g key={node.key}>
              {/* Core -> Agent link */}
              <path
                d={coreToAgentPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isActive || isCompleted ? 2.1 : 1.3}
                strokeDasharray={isActive ? '5 4' : undefined}
                opacity={status === 'inactive' && !isFocused ? 0.68 : 0.96}
              />

              {isActive && !reduced && (
                <>
                  <circle r="4" fill="#3299F5">
                    <animateMotion dur="1.4s" repeatCount="indefinite" path={coreToAgentPath} />
                  </circle>
                  <circle r="2.8" fill="#62C5F5" opacity="0.85">
                    <animateMotion dur="1.4s" begin="0.7s" repeatCount="indefinite" path={coreToAgentPath} />
                  </circle>
                </>
              )}

              {/* Agent -> Sub-Group Tool Round Links */}
              {subTools.map((sub, subIdx) => {
                const agentToToolPath = curvedPath(
                  node.x,
                  node.y,
                  sub.x,
                  sub.y,
                  subIdx % 2 === 0 ? 10 : -10
                );
                const subStroke = isError
                  ? '#F59E0B'
                  : isCompleted
                  ? '#34D399'
                  : isActive
                  ? '#3299F5'
                  : '#DCE8F5';

                return (
                  <g key={sub.tool.id}>
                    <path
                      d={agentToToolPath}
                      fill="none"
                      stroke={subStroke}
                      strokeWidth={isActive || isCompleted ? 1.65 : 1.15}
                      strokeDasharray={isActive ? '3 3' : undefined}
                      opacity={status === 'inactive' && !isFocused ? 0.72 : 0.95}
                    />
                    {isActive && !reduced && (
                      <circle r="3" fill="#3299F5">
                        <animateMotion
                          dur="1.15s"
                          begin={`${(subIdx * 0.22).toFixed(2)}s`}
                          repeatCount="indefinite"
                          path={agentToToolPath}
                        />
                      </circle>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Active inter-agent coordination arc & particle */}
        {activeInterAgentPath && (
          <g>
            <path
              d={activeInterAgentPath}
              fill="none"
              stroke="#3299F5"
              strokeWidth="2.4"
              strokeDasharray="6 4"
            />
            {!reduced && (
              <circle r="4.5" fill="#102653" stroke="#62C5F5" strokeWidth="1.5">
                <animateMotion dur="1.1s" repeatCount="indefinite" path={activeInterAgentPath} />
              </circle>
            )}
          </g>
        )}
      </svg>

      {/* Positioned HTML layer synced cleanly to 920x640 SVG coordinates */}
      <div className="pointer-events-none absolute inset-0">
        {/* Central CAREOS INTELLIGENCE node */}
        <div
          style={{ left: `${(CENTER_X / VB_W) * 100}%`, top: `${(CENTER_Y / VB_H) * 100}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
        >
          <motion.div
            animate={
              reduced
                ? {}
                : coreState === 'active'
                ? { scale: [1, 1.05, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 1.8, repeat: coreState === 'active' ? Infinity : 0, ease: 'easeInOut' }}
            className={cn(
              'relative flex h-20 w-20 sm:h-24 sm:w-24 flex-col items-center justify-center rounded-full border-4 border-white text-center shadow-lg transition-colors duration-300',
              coreState === 'error'
                ? 'bg-gradient-to-b from-amber-50 to-amber-100 ring-2 ring-amber-400'
                : coreState === 'completed'
                ? 'bg-gradient-to-b from-[#FFFFFF] to-[#ECFDF5] ring-2 ring-emerald-500'
                : 'bg-gradient-to-b from-[#FFFFFF] to-[#E6F3FF] ring-2 ring-[#3299F5]'
            )}
          >
            <div
              className={cn(
                'flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl text-white shadow-sm',
                coreState === 'error'
                  ? 'bg-amber-500'
                  : coreState === 'completed'
                  ? 'bg-emerald-500'
                  : 'bg-[#3299F5]'
              )}
            >
              {coreState === 'error' ? (
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : coreState === 'completed' ? (
                <Check className="h-4 w-4 sm:h-5 sm:w-5" />
              ) : (
                <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
              )}
            </div>
            <div className="mt-1 font-display text-[9.5px] sm:text-[10.5px] font-bold tracking-wide text-[#102653]">
              CAREOS
            </div>
            <div className="text-[7.5px] sm:text-[8.5px] font-semibold uppercase tracking-wider text-[#3299F5]">
              Intelligence
            </div>
          </motion.div>
          <div className="mt-1 rounded-full border border-[#DCEBFA] bg-white/95 px-2 py-0.5 text-[9.5px] font-semibold text-[#102653] shadow-xs whitespace-nowrap">
            {coreLabel}
          </div>
        </div>

        {/* Ring 1: 6 Departmental Agent Nodes + Ring 2: Outer Sub-Group Tool Round Nodes */}
        {AGENT_NODES.map((node) => {
          const status = nodeStatuses[node.key];
          const Icon = node.icon;
          const isFocused = focusedAgent === node.key;
          const isActive = status === 'active' || isFocused;
          const isCompleted = status === 'completed';
          const isError = status === 'error';
          const isInactive = status === 'inactive' && !isFocused;
          const subTools = getSubToolNodes(node);

          return (
            <div key={node.key}>
              {/* Departmental Agent Circle */}
              <div
                style={{
                  left: `${(node.x / VB_W) * 100}%`,
                  top: `${(node.y / VB_H) * 100}%`,
                }}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center z-10',
                  interactive && 'pointer-events-auto'
                )}
              >
                <button
                  type="button"
                  disabled={!interactive}
                  onMouseEnter={() => interactive && setHoveredAgent(node.key)}
                  onMouseLeave={() => interactive && setHoveredAgent(null)}
                  onClick={() => {
                    if (!interactive) return;
                    onSelectAgent?.(selectedAgent === node.key ? null : node.key);
                  }}
                  aria-label={node.label}
                  className={cn(
                    'relative flex flex-col items-center focus:outline-none',
                    interactive ? 'cursor-pointer' : 'cursor-default'
                  )}
                >
                  <div className="relative">
                    {status === 'active' && !reduced && (
                      <motion.span
                        className="absolute -inset-1.5 rounded-full border-2 border-[#3299F5]"
                        animate={{ scale: [1, 1.25], opacity: [0.7, 0] }}
                        transition={{ duration: 1.3, repeat: Infinity, ease: 'easeOut' }}
                      />
                    )}
                    <div
                      className={cn(
                        'relative flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full border-2 shadow-sm transition-all duration-300',
                        isError
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : isCompleted
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : isActive
                          ? 'border-[#3299F5] bg-[#EAF5FF] text-[#3299F5] shadow-[0_0_16px_rgba(50,153,245,0.28)]'
                          : 'border-[#DCE8F5] bg-white text-[#6D829C]'
                      )}
                    >
                      <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                      {isCompleted && (
                        <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                          <Check className="h-2.5 w-2.5" />
                        </span>
                      )}
                      {isError && (
                        <span className="absolute -right-1 -top-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-white shadow">
                          <AlertTriangle className="h-2.5 w-2.5" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      'mt-0.5 max-w-[125px] rounded-md px-1.5 py-0.5 text-[9.5px] sm:text-[10px] leading-tight transition-colors whitespace-nowrap',
                      isInactive
                        ? 'bg-white/85 text-[#4F627D] font-semibold'
                        : isCompleted
                        ? 'bg-white/95 font-bold text-emerald-800 shadow-2xs'
                        : isError
                        ? 'bg-amber-50 font-bold text-amber-800'
                        : 'bg-white/95 font-bold text-[#102653] shadow-xs'
                    )}
                  >
                    {node.shortLabel}
                  </div>
                </button>
              </div>

              {/* Ring 2: Outer Sub-Group Tool Round Nodes */}
              {subTools.map((sub) => (
                <div
                  key={sub.tool.id}
                  style={{
                    left: `${(sub.x / VB_W) * 100}%`,
                    top: `${(sub.y / VB_H) * 100}%`,
                  }}
                  title={`${node.label} → ${sub.tool.name}`}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center text-center z-10',
                    interactive && 'pointer-events-auto'
                  )}
                >
                  <div
                    onMouseEnter={() => interactive && setHoveredAgent(node.key)}
                    onMouseLeave={() => interactive && setHoveredAgent(null)}
                    className={cn(
                      'flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full border bg-white shadow-xs transition-all duration-300',
                      isError
                        ? 'border-amber-400 ring-2 ring-amber-100'
                        : isCompleted
                        ? 'border-emerald-400 ring-2 ring-emerald-100'
                        : isActive
                        ? 'border-[#3299F5] ring-2 ring-[#3299F5]/20 scale-105'
                        : 'border-[#DCE8F5]'
                    )}
                  >
                    {sub.tool.renderIcon()}
                  </div>
                  <span
                    className={cn(
                      'mt-0.5 rounded px-1 py-px text-[8px] sm:text-[9px] font-semibold leading-none whitespace-nowrap',
                      isActive || isCompleted
                        ? 'bg-white/95 text-[#102653] shadow-2xs'
                        : 'bg-white/80 text-[#5E738E]'
                    )}
                  >
                    {sub.tool.shortTag}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
