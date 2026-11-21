import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  BedDouble,
  Bell,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  CreditCard,
  FileText,
  GitBranch,
  HelpCircle,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { CareOSLogo } from './CareOSLogo';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

interface SidebarItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
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

const HOSPITAL_GROUPS: Array<{ title: string; items: SidebarItem[] }> = [
  {
    title: 'Overview',
    items: [
      { label: 'Command Center', to: '/dashboard', icon: LayoutDashboard, end: true },
      { label: 'Hospital Overview', to: '/dashboard/operations', icon: Activity },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      { label: 'AI Agent Hub', to: '/dashboard/agents', icon: Bot },
      { label: 'Workflow Automation', to: '/dashboard/operations?tab=workflows', icon: GitBranch },
    ],
  },
  {
    title: 'Hospital Operations',
    items: [
      { label: 'Patients', to: '/dashboard/patients', icon: Users },
      { label: 'Appointments', to: '/dashboard/appointments', icon: Calendar },
      { label: 'Departments & Staff', to: '/dashboard/departments', icon: Building2 },
      { label: 'Beds & Resources', to: '/dashboard/resources', icon: BedDouble },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Medical Records', to: '/dashboard/patients?tab=records', icon: FileText },
      { label: 'Analytics', to: '/dashboard/analytics', icon: BarChart3 },
      { label: 'Integrations', to: '/dashboard/integrations', icon: Network },
      { label: 'Settings', to: '/dashboard/settings', icon: Settings },
    ],
  },
];

export function DashboardLayout({
  title,
  breadcrumb,
  subtitle,
  actions,
  searchValue,
  onSearchChange,
  children,
}: {
  title: string;
  breadcrumb?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [localSearch, setLocalSearch] = useState('');

  const isAdmin = user?.role === 'admin';
  const isPendingApplicant = !isAdmin && user?.status === 'pending';

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
    }
  };

  const initials =
    user?.fullName
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SA';

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between bg-[#F7FAFF]">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-[#E3EDF6] bg-white px-5">
          <Link to="/" aria-label="CareOS Public Home">
            <CareOSLogo variant="compact" />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-md p-1.5 text-[#71839C] hover:bg-[#EAF5FF] lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
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
          <nav className="space-y-6 px-3.5 py-5" aria-label="Hospital Navigation">
            {HOSPITAL_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71839C]">
                  {group.title}
                </div>
                <ul className="mt-2 space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item.to, item.end);
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
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
              </div>
            ))}
          </nav>
        )}
      </div>

      <div className="border-t border-[#E3EDF6] p-3.5">
        {isAdmin ? (
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-3.5">
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
        ) : (
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-3">
            <div className="truncate text-xs font-semibold text-[#102653]">{user?.fullName}</div>
            <div className="mt-0.5 truncate text-[11px] text-[#71839C]">{user?.hospitalName}</div>
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
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7FAFF] text-[#172B4D] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 border-r border-[#E3EDF6] bg-[#F7FAFF]">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-[#102653]/35" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-[264px] max-w-[85vw] border-r border-[#E3EDF6] bg-[#F7FAFF] h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-[#E3EDF6] bg-white">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open dashboard menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E3EDF6] text-[#102653] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 text-xs text-[#71839C] truncate">
                <span className="font-medium text-[#71839C]">{isAdmin ? 'Super Admin' : 'CareOS'}</span>
                <span aria-hidden="true">/</span>
                <span className="truncate font-semibold text-[#102653]">{breadcrumb || title}</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              {isAdmin && (
                <form onSubmit={handleGlobalSearchSubmit} className="relative hidden md:block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71839C]" />
                  <input
                    value={searchValue !== undefined ? searchValue : localSearch}
                    onChange={(e) => {
                      if (onSearchChange) onSearchChange(e.target.value);
                      else setLocalSearch(e.target.value);
                    }}
                    placeholder="Search hospitals, users, applications..."
                    aria-label="Search platform"
                    className="h-9 w-64 lg:w-72 rounded-full border border-[#E3EDF6] bg-[#F4F9FF]/70 pl-9 pr-3.5 text-xs text-[#172B4D] placeholder:text-[#71839C] focus:border-[#3299F5] focus:bg-white focus:outline-none"
                  />
                </form>
              )}

              {isAdmin && (
                <Link
                  to="/dashboard/applications"
                  aria-label="Notifications & pending reviews"
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3EDF6] bg-white text-[#102653] hover:bg-[#F4F9FF]"
                >
                  <Bell className="h-4 w-4" />
                </Link>
              )}

              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="Platform guide"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#E3EDF6] bg-white text-[#102653] hover:bg-[#F4F9FF]"
              >
                <HelpCircle className="h-4 w-4" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#E3EDF6] bg-white py-1 pl-1 pr-2.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#3299F5] text-[11px] font-bold text-white">
                    {initials}
                  </span>
                  <span className="hidden sm:inline max-w-[120px] truncate">{user?.fullName || 'Super Admin'}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-[#71839C]" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[#E3EDF6] bg-white p-2 shadow-lg">
                    <div className="border-b border-[#E3EDF6] px-3 py-2">
                      <div className="truncate text-xs font-semibold text-[#102653]">{user?.fullName}</div>
                      <div className="truncate text-[11px] text-[#71839C]">{user?.email}</div>
                    </div>
                    <Link
                      to="/dashboard/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#172B4D] hover:bg-[#F4F9FF]"
                    >
                      <Settings className="h-3.5 w-3.5 text-[#71839C]" />
                      Platform Settings
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

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1440px]">
            {(title || actions) && (
              <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
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
                <span className="font-semibold text-[#102653]">Live Zero-Mock State:</span> All platform metrics,
                onboarding tables, growth charts, and hospital directories begin at 0 and update dynamically as real
                hospitals apply via Signup or Book a Demo.
              </li>
              <li>
                <span className="font-semibold text-[#102653]">Onboarding & Approval:</span> Open any incoming application
                to request verification documents, record review notes, or approve the hospital into the Directory with a
                dedicated HSP ID and subscription plan.
              </li>
              <li>
                <span className="font-semibold text-[#102653]">Hospital Activation:</span> Once approved by Super Admin,
                that hospital&apos;s workspace and administrator account unlock automatically.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
