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
  FileText,
  GitBranch,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  Settings,
  Shield,
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
  adminOnly?: boolean;
}

const SIDEBAR_GROUPS: Array<{ title: string; items: SidebarItem[] }> = [
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
    title: 'Information',
    items: [
      { label: 'Medical Records', to: '/dashboard/patients?tab=records', icon: FileText },
      { label: 'Knowledge & Comms', to: '/dashboard/operations?tab=comms', icon: Activity },
    ],
  },
  {
    title: 'Management',
    items: [
      { label: 'Analytics', to: '/dashboard/analytics', icon: BarChart3 },
      { label: 'Integrations', to: '/dashboard/integrations', icon: Network },
      { label: 'Users & Audit Logs', to: '/dashboard/settings?tab=admin', icon: Shield, adminOnly: true },
      { label: 'Settings', to: '/dashboard/settings', icon: Settings },
    ],
  },
];

export function DashboardLayout({
  title,
  breadcrumb,
  actions,
  children,
}: {
  title: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
    return location.pathname === targetPath && !location.search;
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-[#E3EDF6] px-5">
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

        <nav className="space-y-6 px-3.5 py-5" aria-label="Dashboard Navigation">
          {SIDEBAR_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => !item.adminOnly || user?.role === 'admin');
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.title}>
                <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#71839C]">
                  {group.title}
                </div>
                <ul className="mt-2 space-y-1">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(item.to, item.end);
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          onClick={() => setSidebarOpen(false)}
                          className={cn(
                            'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                            active
                              ? 'bg-[#EAF5FF] text-[#3299F5] border border-[#3299F5]/20'
                              : 'text-[#172B4D] hover:bg-white/80 hover:text-[#102653]'
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
            );
          })}
        </nav>
      </div>

      <div className="border-t border-[#E3EDF6] p-4">
        <div className="rounded-lg border border-[#E3EDF6] bg-white p-3">
          <div className="truncate text-xs font-semibold text-[#102653]">{user?.fullName}</div>
          <div className="mt-0.5 truncate text-[11px] text-[#71839C]">
            {user?.role === 'admin' ? 'Platform Administrator' : 'Care Coordinator'} · {user?.hospitalName}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#E3EDF6] bg-[#F4F9FF] px-3 py-1.5 text-xs font-medium text-[#102653] transition-colors hover:border-[#3299F5] hover:bg-[#EAF5FF]"
          >
            <LogOut className="h-3.5 w-3.5" />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-[#172B4D] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-[264px] shrink-0 border-r border-[#E3EDF6] bg-[#F4F9FF]">
        <div className="sticky top-0 h-screen overflow-y-auto">{sidebarContent}</div>
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="fixed inset-0 bg-[#102653]/35" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-10 w-[272px] max-w-[85vw] border-r border-[#E3EDF6] bg-[#F4F9FF] h-full overflow-y-auto">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 border-b border-[#E3EDF6] bg-white/95 backdrop-blur-sm">
          <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open dashboard menu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#E3EDF6] text-[#102653] lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs text-[#71839C]">
                  <span>CareOS</span>
                  <span aria-hidden="true">/</span>
                  <span className="truncate">{breadcrumb || title}</span>
                </div>
                <h1 className="truncate font-display text-lg font-bold text-[#102653]">{title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <span className="hidden md:inline text-xs font-medium text-[#71839C]">
                Sample Hospital Dataset
              </span>
              {actions}
              <Link
                to="/dashboard/operations?tab=comms"
                aria-label="View notifications"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E3EDF6] text-[#102653] hover:bg-[#F4F9FF]"
              >
                <Bell className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1 bg-white px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
