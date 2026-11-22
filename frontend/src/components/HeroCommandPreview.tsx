import { useState } from 'react';
import {
  Activity,
  BarChart3,
  BedDouble,
  Bell,
  Calendar,
  LayoutDashboard,
  Search,
  Settings,
  User,
  Users,
} from 'lucide-react';
import { CareOSLogo } from './CareOSLogo';
import { cn } from '../lib/utils';

type MiniNav = 'dashboard' | 'patients' | 'appointments' | 'analytics' | 'settings';

const METRICS_BY_RANGE = {
  Today: [
    { label: 'Patients', value: '2,480', delta: '↑ 12%', icon: Users },
    { label: 'Appointments', value: '1,320', delta: '↑ 8%', icon: Calendar },
    { label: 'Admissions', value: '892', delta: '↑ 6%', icon: BedDouble },
    { label: 'Available Beds', value: '120', delta: '↑ 4%', icon: BedDouble },
  ],
  '7 Days': [
    { label: 'Patients', value: '14,920', delta: '↑ 9%', icon: Users },
    { label: 'Appointments', value: '8,410', delta: '↑ 11%', icon: Calendar },
    { label: 'Admissions', value: '3,140', delta: '↑ 5%', icon: BedDouble },
    { label: 'Available Beds', value: '128', delta: '↑ 6%', icon: BedDouble },
  ],
};

export function HeroCommandPreview() {
  const [activeNav, setActiveNav] = useState<MiniNav>('dashboard');
  const [range, setRange] = useState<'Today' | '7 Days'>('Today');
  const metrics = METRICS_BY_RANGE[range];

  return (
    <div className="relative rounded-2xl border border-[#DCEAF7] bg-white shadow-[0_24px_60px_rgba(16,38,83,0.10)] overflow-hidden">
      {/* Top Window Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#E3EDF6] bg-white px-4 py-3">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <CareOSLogo variant="compact" className="scale-90 origin-left" />
          <div className="hidden sm:flex items-center gap-2 rounded-lg border border-[#E3EDF6] bg-[#F4F9FF] px-3 py-1.5 text-xs text-[#71839C] w-48">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#71839C]" />
            <span className="truncate">Search hospital...</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
            <Bell className="h-3.5 w-3.5" />
          </span>
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#3299F5] text-white">
            <User className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {/* Main Split Workspace */}
      <div className="grid grid-cols-12 min-h-[300px]">
        {/* Left Mini Sidebar */}
        <div className="col-span-4 sm:col-span-3 border-r border-[#E3EDF6] bg-[#F9FCFF] p-2.5 space-y-1">
          {(
            [
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'patients', label: 'Patients', icon: Users },
              { id: 'appointments', label: 'Appointments', icon: Calendar },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[11px] font-medium transition-colors text-left',
                  active
                    ? 'bg-[#EAF5FF] text-[#3299F5]'
                    : 'text-[#71839C] hover:bg-white hover:text-[#102653]'
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Main Panel */}
        <div className="col-span-8 sm:col-span-9 bg-[#F7FBFF]/50 p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="font-display text-sm font-bold text-[#102653]">
              {activeNav === 'dashboard' && 'Hospital Overview'}
              {activeNav === 'patients' && 'Patient Registry (Sample)'}
              {activeNav === 'appointments' && 'Appointment Schedule'}
              {activeNav === 'analytics' && 'Department Throughput'}
              {activeNav === 'settings' && 'Workspace Controls'}
            </div>
            <button
              type="button"
              onClick={() => setRange(range === 'Today' ? '7 Days' : 'Today')}
              className="rounded-md border border-[#E3EDF6] bg-white px-2.5 py-1 text-[11px] font-medium text-[#102653] hover:border-[#3299F5]"
            >
              {range} ▾
            </button>
          </div>

          {/* 4 KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {metrics.map((m) => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-xl border border-[#E3EDF6] bg-white p-2.5">
                  <div className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-[#EAF5FF] text-[#3299F5]">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="mt-2 text-[10px] text-[#71839C] truncate">{m.label}</div>
                  <div className="font-display text-sm font-bold text-[#102653] tabular-nums">{m.value}</div>
                  <div className="mt-0.5 text-[10px] font-semibold text-emerald-600 tabular-nums">{m.delta}</div>
                </div>
              );
            })}
          </div>

          {/* Bottom 2 Charts */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            {/* Patient Flow Curve */}
            <div className="sm:col-span-7 rounded-xl border border-[#E3EDF6] bg-white p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-[#102653]">Patient Flow</span>
                <span className="rounded bg-[#102653] px-1.5 py-0.5 font-mono text-[9px] font-semibold text-white tabular-nums">
                  2.4k
                </span>
              </div>
              <svg viewBox="0 0 240 76" className="w-full h-16 overflow-visible" aria-hidden="true">
                <defs>
                  <linearGradient id="heroFlowFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3299F5" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#3299F5" stopOpacity="0.01" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 62 C 25 56, 38 42, 62 48 C 86 54, 100 32, 125 36 C 148 40, 165 18, 190 22 C 212 26, 226 10, 240 16 L 240 74 L 0 74 Z"
                  fill="url(#heroFlowFill)"
                />
                <path
                  d="M0 62 C 25 56, 38 42, 62 48 C 86 54, 100 32, 125 36 C 148 40, 165 18, 190 22 C 212 26, 226 10, 240 16"
                  fill="none"
                  stroke="#3299F5"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <circle cx="190" cy="22" r="4" fill="#102653" stroke="#FFFFFF" strokeWidth="1.5" />
              </svg>
            </div>

            {/* Agent Status Card */}
            <div className="sm:col-span-5 rounded-xl border border-[#E3EDF6] bg-white p-3 flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#102653]">Agent Status</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700">
                  <Activity className="h-3 w-3 text-emerald-600" />
                  <span>All Systems Online</span>
                </div>
              </div>
              <svg viewBox="0 0 150 40" className="mt-2 w-full h-9" aria-hidden="true">
                <path
                  d="M0 24 Q 18 14, 36 24 T 72 22 T 108 18 T 150 14"
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
