import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Banknote,
  BarChart3,
  BedDouble,
  Bell,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  FileText,
  GitBranch,
  HelpCircle,
  Home,
  KeyRound,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Network,
  Pill,
  Puzzle,
  Scan,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  TrendingUp,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { CareOSLogo } from './CareOSLogo';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface SidebarItem {
  label: string;
  to: string;
  icon: typeof Home;
  end?: boolean;
}

const SUPER_ADMIN_NAV: SidebarItem[] = [
  { label: 'Command Center', to: '/dashboard', icon: Home, end: true },
  { label: 'Hospital Applications', to: '/dashboard/applications', icon: ClipboardCheck },
  { label: 'Hospital Directory', to: '/dashboard/directory', icon: Building2 },
  { label: 'Approved Hospitals', to: '/dashboard/approved', icon: CheckCircle2 },
  { label: 'User Management', to: '/dashboard/users', icon: Users },
  { label: 'Subscriptions & Billing', to: '/dashboard/billing', icon: CreditCard },
  { label: 'AI Agent Monitoring', to: '/dashboard/agents', icon: Bot },
  { label: 'Platform Analytics', to: '/dashboard/analytics', icon: BarChart3 },
  { label: 'Integrations', to: '/dashboard/integrations', icon: Network },
  { label: 'Audit Logs', to: '/dashboard/audit-logs', icon: Shield },
  { label: 'Settings', to: '/dashboard/settings', icon: Settings },
];

const HOSPITAL_NAV_GROUPS: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: 'MAIN',
    items: [
      { label: 'Home', to: '/dashboard', icon: Home, end: true },
      { label: 'Patients', to: '/dashboard/patients', icon: Users },
      { label: 'Appointments', to: '/dashboard/appointments', icon: Calendar },
      { label: 'Doctors & Staff', to: '/dashboard/departments?view=staff', icon: Stethoscope },
      { label: 'Departments', to: '/dashboard/departments', icon: LayoutGrid },
    ],
  },
  {
    title: 'HOSPITAL',
    items: [
      { label: 'Radiology', to: '/dashboard/module/radiology', icon: Scan },
      { label: 'Finance & Billing', to: '/dashboard/module/billing', icon: Banknote },
      { label: 'Insurance & Discharge', to: '/dashboard/module/insurance', icon: ShieldCheck },
      { label: 'Beds & Resources', to: '/dashboard/resources', icon: BedDouble },
      { label: 'Pharmacy', to: '/dashboard/module/pharmacy', icon: Pill },
    ],
  },
  {
    title: 'BUSINESS',
    items: [
      { label: 'Sales & Leads', to: '/dashboard/module/sales', icon: TrendingUp },
      { label: 'Marketing', to: '/dashboard/module/marketing', icon: Megaphone },
    ],
  },
  {
    title: 'INTELLIGENCE',
    items: [
      { label: 'AI Agents', to: '/dashboard/agents', icon: Sparkles },
      { label: 'Integrations', to: '/dashboard/integrations', icon: Puzzle },
      { label: 'Workflows', to: '/dashboard/operations?tab=workflows', icon: GitBranch },
      { label: 'Reports', to: '/dashboard/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'SETTINGS',
    items: [
      { label: 'User Management', to: '/dashboard/departments?view=roles', icon: UserCog },
      { label: 'Settings', to: '/dashboard/settings', icon: Settings },
    ],
  },
];

function HospitalMiniThumb() {
  return (
    <svg
      viewBox="0 0 64 44"
      className="h-9 w-12 shrink-0 rounded-lg border border-[#E3EDF6] bg-[#EAF5FF]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hdrSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9CD4FC" />
          <stop offset="100%" stopColor="#EAF5FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="44" fill="url(#hdrSky)" />
      <rect x="8" y="13" width="48" height="27" rx="2" fill="#FFFFFF" stroke="#D5E6F5" />
      <rect x="13" y="9" width="38" height="5" rx="1" fill="#F4F9FF" stroke="#D5E6F5" />
      <rect x="27" y="4" width="10" height="6" rx="1" fill="#3299F5" />
      <rect x="14" y="18" width="7" height="5" rx="1" fill="#CBE7FE" />
      <rect x="24" y="18" width="7" height="5" rx="1" fill="#CBE7FE" />
      <rect x="34" y="18" width="7" height="5" rx="1" fill="#CBE7FE" />
      <rect x="44" y="18" width="7" height="5" rx="1" fill="#CBE7FE" />
      <rect x="14" y="27" width="7" height="6" rx="1" fill="#CBE7FE" />
      <rect x="44" y="27" width="7" height="6" rx="1" fill="#CBE7FE" />
      <rect x="27" y="29" width="10" height="11" rx="1" fill="#EAF5FF" />
    </svg>
  );
}

export function DashboardLayout({
  title,
  breadcrumb,
  subtitle,
  actions,
  searchValue,
  onSearchChange,
  hidePageTitle = false,
  fitToScreen = false,
  attentionBadgeCount = 0,
  departmentalAlerts = [],
  onAcknowledgeAlert,
  children,
}: {
  title: string;
  breadcrumb?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  hidePageTitle?: boolean;
  fitToScreen?: boolean;
  attentionBadgeCount?: number;
  departmentalAlerts?: Array<{
    id: string;
    workflowCode: string;
    department: string;
    summary: string;
    priority: 'Normal' | 'High' | 'Urgent';
    timestamp: string;
    status: 'Delivered (In-App)' | 'Acknowledged' | 'Approved';
    targetPath: string;
  }>;
  onAcknowledgeAlert?: (alertId: string) => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [branchMenuOpen, setBranchMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  const isAdmin = user?.role === 'admin';
  const isPendingApplicant = !isAdmin && user?.status === 'pending';
  const unreadAlertsCount = departmentalAlerts.filter((a) => a.status === 'Delivered (In-App)').length;
  const totalBadgeCount = attentionBadgeCount + unreadAlertsCount;

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
    navigate('/login', { replace: true });
  };

  const isNavItemActive = (to: string, end?: boolean) => {
    const [targetPath, targetQuery] = to.split('?');
    if (targetQuery) {
      return location.pathname === targetPath && location.search === `?${targetQuery}`;
    }
    if (end) {
      return location.pathname === targetPath;
    }
    if (targetPath === '/dashboard/applications' && location.pathname.startsWith('/dashboard/applications')) {
      return true;
    }
    return location.pathname === targetPath && !location.search;
  };

  const handleGlobalSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = (searchValue ?? localSearch).trim();
    if (!q) return;
    if (isAdmin && !onSearchChange) {
      navigate(`/dashboard/directory?q=${encodeURIComponent(q)}`);
    } else if (!isAdmin && !onSearchChange) {
      navigate(`/dashboard/patients?q=${encodeURIComponent(q)}`);
    }
  };

  const initials =
    user?.fullName
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'HA';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#FAFCFF]">
      <div>
        <div className="border-b border-[#E8F0F8] bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="CareOS Public Home">
              <CareOSLogo variant="compact" />
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
              className="rounded-md p-1 text-[#71839C] hover:bg-[#EAF5FF] lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {!isAdmin && !isPendingApplicant && (
            <p className="mt-1.5 text-[10.5px] leading-snug text-[#4F627D]">
              <span className="font-semibold text-[#102653]">One Intelligence.</span>
              <br />
              Every Department. Every Patient.
            </p>
          )}
        </div>

        {isAdmin ? (
          <nav className="px-3 py-4" aria-label="Super Admin Navigation">
            <ul className="space-y-1">
              {SUPER_ADMIN_NAV.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item.to, item.end);
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors whitespace-nowrap',
                        active
                          ? 'bg-[#EAF5FF] text-[#3299F5] font-semibold'
                          : 'text-[#172B4D] hover:bg-white hover:text-[#102653]'
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[#3299F5]' : 'text-[#71839C]')} />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : isPendingApplicant ? (
          <nav className="px-3 py-5" aria-label="Onboarding Navigation">
            <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71839C]">
              Onboarding
            </div>
            <ul className="mt-2 space-y-1">
              <li>
                <NavLink
                  to="/dashboard"
                  className="flex items-center gap-2.5 rounded-xl bg-[#EAF5FF] px-3.5 py-2.5 text-sm font-semibold text-[#3299F5]"
                >
                  <ClipboardCheck className="h-4 w-4 shrink-0 text-[#3299F5]" />
                  <span>Application Status</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        ) : (
          <nav className="px-3 py-2.5 space-y-2.5" aria-label="Hospital Workspace Navigation">
            {HOSPITAL_NAV_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="px-2.5 pb-0.5 text-[10px] font-bold tracking-[0.06em] text-[#71839C]">
                  {group.title}
                </div>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item.to, item.end);
                    return (
                      <li key={item.label}>
                        <NavLink
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors whitespace-nowrap',
                            active
                              ? 'bg-[#E8F3FF] text-[#218AEF] font-semibold'
                              : 'text-[#334663] font-medium hover:bg-white hover:text-[#102653]'
                          )}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon className={cn('h-3.5 w-3.5 shrink-0', active ? 'text-[#218AEF]' : 'text-[#5F738E]')} />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {active && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#218AEF]" />}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        )}
      </div>

      {isAdmin && (
        <div className="border-t border-[#E3EDF6] p-3">
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-3">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-[#102653]">CareOS Platform</div>
                <div className="text-[11px] text-[#71839C] font-mono">v1.0.0</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E3EDF6] bg-[#F4F9FF] px-3 py-1.5 text-xs font-medium text-[#102653] transition-colors hover:border-[#3299F5] hover:bg-[#EAF5FF]"
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div
      className={cn(
        'bg-[#F5F9FF] text-[#172B4D] flex',
        fitToScreen ? 'min-h-screen lg:h-screen lg:overflow-hidden' : 'min-h-screen'
      )}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[224px] shrink-0 border-r border-[#E3EDF6] bg-[#FAFCFF]">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-[#102653]/35" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-[248px] max-w-[85vw] border-r border-[#E3EDF6] bg-[#FAFCFF] h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Viewport */}
      <div className={cn('flex-1 min-w-0 flex flex-col', fitToScreen && 'lg:h-screen lg:overflow-hidden')}>
        <header className="sticky top-0 z-30 h-14 shrink-0 border-b border-[#E6EFF8] bg-white">
          <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open dashboard menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3EDF6] text-[#102653] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>

              {isAdmin || isPendingApplicant ? (
                <div className="flex items-center gap-2 text-xs text-[#71839C] truncate">
                  <span className="font-medium text-[#71839C]">{isAdmin ? 'Super Admin' : 'CareOS'}</span>
                  <span aria-hidden="true">/</span>
                  <span className="truncate font-semibold text-[#102653]">{breadcrumb || title}</span>
                </div>
              ) : (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setBranchMenuOpen((p) => !p)}
                    className="flex items-center gap-2.5 text-left rounded-xl px-1.5 py-1 hover:bg-[#F7FAFF]"
                  >
                    <HospitalMiniThumb />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-[13px] font-bold text-[#102653]">
                        <span className="truncate max-w-[190px]">{user?.hospitalName || 'CareOS Hospital'}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#71839C]" />
                      </div>
                      <div className="text-[11px] font-medium text-[#71839C]">Main Branch</div>
                    </div>
                  </button>

                  {branchMenuOpen && (
                    <div className="absolute left-0 mt-1.5 w-64 rounded-xl border border-[#E3EDF6] bg-white p-3 shadow-lg text-xs">
                      <div className="font-semibold text-[#102653]">{user?.hospitalName}</div>
                      <div className="mt-1 text-[#71839C]">Type: {user?.hospitalType}</div>
                      {user?.applicationId && (
                        <div className="mt-1 font-mono text-[11px] text-[#3299F5]">
                          Workspace ID: {user.applicationId}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {!isPendingApplicant && (
              <form onSubmit={handleGlobalSearchSubmit} className="relative hidden md:block flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71839C]" />
                <input
                  value={searchValue !== undefined ? searchValue : localSearch}
                  onChange={(e) => {
                    if (onSearchChange) onSearchChange(e.target.value);
                    else setLocalSearch(e.target.value);
                  }}
                  placeholder={
                    isAdmin
                      ? 'Search hospitals, users, applications...'
                      : 'Search anything... (e.g. appointments, reports)'
                  }
                  aria-label="Search workspace"
                  className="h-9 w-full rounded-full border border-[#E3EDF6] bg-[#F7FAFF] pl-9 pr-4 text-xs text-[#172B4D] placeholder:text-[#71839C] focus:border-[#3299F5] focus:bg-white focus:outline-none"
                />
              </form>
            )}

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {!isPendingApplicant && (
                isAdmin ? (
                  <Link
                    to="/dashboard/applications"
                    aria-label="Notifications"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3EDF6] bg-white text-[#102653] hover:bg-[#F4F9FF]"
                  >
                    <Bell className="h-4 w-4" />
                    {totalBadgeCount > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
                        {totalBadgeCount}
                      </span>
                    )}
                  </Link>
                ) : (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setNotifMenuOpen((prev) => !prev);
                        setUserMenuOpen(false);
                        setBranchMenuOpen(false);
                      }}
                      aria-label="Departmental Notifications"
                      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3EDF6] bg-white text-[#102653] hover:bg-[#F4F9FF]"
                    >
                      <Bell className="h-4 w-4" />
                      {totalBadgeCount > 0 && (
                        <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white tabular-nums">
                          {totalBadgeCount}
                        </span>
                      )}
                    </button>

                    {notifMenuOpen && (
                      <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-[#DCEBFA] bg-white p-3 shadow-xl z-50">
                        <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-2.5">
                          <div>
                            <div className="text-xs font-bold text-[#102653]">Departmental Notification Center</div>
                            <div className="text-[11px] text-[#71839C]">
                              {unreadAlertsCount} unread alerts · {attentionBadgeCount} attention items
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setNotifMenuOpen(false)}
                            aria-label="Close notifications"
                            className="rounded-md p-1 text-[#71839C] hover:bg-[#F4F9FF]"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="mt-2.5 max-h-72 space-y-2 overflow-y-auto pr-0.5">
                          {departmentalAlerts.length === 0 ? (
                            <div className="rounded-xl border border-[#E3EDF6] bg-[#FAFCFF] px-3 py-5 text-center text-xs text-[#71839C]">
                              No departmental alerts triggered yet. Execute a CareOS instruction to dispatch targeted alerts.
                            </div>
                          ) : (
                            departmentalAlerts.slice(0, 8).map((alert) => {
                              const isUnread = alert.status === 'Delivered (In-App)';
                              return (
                                <div
                                  key={alert.id}
                                  className={cn(
                                    'rounded-xl border p-2.5 text-xs transition-colors',
                                    isUnread
                                      ? 'border-[#BFDDFB] bg-[#F4F9FF]'
                                      : 'border-[#E3EDF6] bg-white'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-[#102653] truncate">{alert.department}</span>
                                    <span
                                      className={cn(
                                        'shrink-0 font-mono text-[10px] font-semibold',
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
                                  <p className="mt-1 text-[11.5px] leading-snug text-[#172B4D]">{alert.summary}</p>
                                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                                    <span className="text-[#71839C]">{alert.status}</span>
                                    <div className="flex items-center gap-2">
                                      {isUnread && onAcknowledgeAlert && (
                                        <button
                                          type="button"
                                          onClick={() => onAcknowledgeAlert(alert.id)}
                                          className="rounded-md border border-[#DCEBFA] bg-white px-2 py-0.5 font-semibold text-[#102653] hover:border-[#3299F5] hover:text-[#3299F5]"
                                        >
                                          Acknowledge
                                        </button>
                                      )}
                                      <Link
                                        to={alert.targetPath}
                                        onClick={() => setNotifMenuOpen(false)}
                                        className="font-semibold text-[#3299F5] hover:text-[#102653]"
                                      >
                                        Open →
                                      </Link>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-2.5 border-t border-[#E3EDF6] pt-2 flex items-center justify-between text-[11px]">
                          <Link
                            to="/dashboard/operations"
                            onClick={() => setNotifMenuOpen(false)}
                            className="font-semibold text-[#3299F5] hover:text-[#102653]"
                          >
                            View Operations Hub →
                          </Link>
                          <Link
                            to="/dashboard/agents"
                            onClick={() => setNotifMenuOpen(false)}
                            className="font-medium text-[#71839C] hover:text-[#102653]"
                          >
                            Agent Logs
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {(isAdmin || isPendingApplicant) && (
                <button
                  type="button"
                  onClick={() => setHelpOpen(true)}
                  aria-label="Platform guide"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3EDF6] bg-white text-[#102653] hover:bg-[#F4F9FF]"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen((prev) => !prev);
                    setNotifMenuOpen(false);
                    setBranchMenuOpen(false);
                  }}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E3EDF6] bg-white py-1 pl-1 pr-3 text-left hover:bg-[#F4F9FF]"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#218AEF] text-[11px] font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden sm:inline max-w-[140px] truncate text-xs font-semibold text-[#102653]">
                    {isAdmin ? user?.fullName || 'Super Admin' : 'Hospital Administrator'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#71839C]" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-xl border border-[#E3EDF6] bg-white p-2 shadow-lg z-50">
                    <div className="border-b border-[#E3EDF6] px-3 py-2">
                      <div className="truncate text-xs font-semibold text-[#102653]">{user?.fullName}</div>
                      <div className="truncate text-[11px] text-[#71839C]">{user?.email}</div>
                      {user?.applicationId && (
                        <div className="mt-0.5 font-mono text-[10px] font-semibold text-[#3299F5]">
                          ID: {user.applicationId}
                        </div>
                      )}
                    </div>
                    <Link
                      to="/dashboard/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#172B4D] hover:bg-[#F4F9FF]"
                    >
                      <Settings className="h-3.5 w-3.5 text-[#71839C]" />
                      Settings
                    </Link>
                    <Link
                      to="/dashboard/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#172B4D] hover:bg-[#F4F9FF]"
                    >
                      <KeyRound className="h-3.5 w-3.5 text-[#71839C]" />
                      Password &amp; Security
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        <main
          className={cn(
            'flex-1 min-h-0 px-4 sm:px-6',
            fitToScreen ? 'py-2.5 flex flex-col overflow-y-auto lg:overflow-hidden' : 'py-5'
          )}
        >
          <div className={cn('mx-auto w-full max-w-[1440px]', fitToScreen && 'flex-1 min-h-0 flex flex-col')}>
            {!hidePageTitle && (title || actions) && (
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold tracking-tight text-[#102653]">{title}</h1>
                  {subtitle && <p className="mt-1 text-sm text-[#71839C]">{subtitle}</p>}
                </div>
                {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>

      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <h2 className="font-display text-base font-bold text-[#102653]">CareOS Platform Operations Guide</h2>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-md p-1 text-[#71839C] hover:bg-[#F4F9FF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-[#172B4D]">
              <li>
                <span className="font-semibold text-[#102653]">Live Zero-Mock State:</span> All hospital pulse metrics,
                attention counters, and reports start at 0 and update dynamically from real workspace records.
              </li>
              <li>
                <span className="font-semibold text-[#102653]">CareOS Command Bar:</span> Type any operational prompt or
                select a quick action to coordinate CareOS agents across your departments.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
