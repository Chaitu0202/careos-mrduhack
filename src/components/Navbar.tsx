import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, ChevronDown, Menu, X } from 'lucide-react';
import { CareOSLogo } from './CareOSLogo';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';

type DropdownKey = 'platform' | 'solutions' | null;

const DROPDOWNS: Record<Exclude<DropdownKey, null>, Array<{ label: string; desc: string; to: string }>> = {
  platform: [
    { label: 'Hospital Command Center', desc: 'Unified real-time operational visibility across wards', to: '/platform#command-center' },
    { label: 'AI Agent Ecosystem', desc: 'Six coordinated healthcare intelligence agents', to: '/agents' },
    { label: 'Integrations & FHIR', desc: 'Supported REST, FHIR R4, and planned HIS bridges', to: '/integrations' },
    { label: 'Security & Governance', desc: 'Role-based access, audit trails, and clinical oversight', to: '/security' },
  ],
  solutions: [
    { label: 'Hospital Leadership', desc: 'Capacity visibility, bottleneck alerts, and executive KPIs', to: '/solutions#leadership' },
    { label: 'Clinical Operations', desc: 'Reduced chart prep time and streamlined ward handoffs', to: '/solutions#clinical-ops' },
    { label: 'Nursing & Patient Flow', desc: 'Automated bed turnover and admission coordination', to: '/solutions#nursing-flow' },
    { label: 'Health IT & Systems', desc: 'FHIR-ready adapters, RBAC, and complete audit trails', to: '/solutions#health-it' },
  ],
};

export function Navbar() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpenDropdown(null);
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setMobileOpen(false);
      }
    };
    const onClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onClickOutside);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onClickOutside);
    };
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      ref={navRef}
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-200',
        scrolled
          ? 'bg-white/95 backdrop-blur-sm border-b border-[#E3EDF6] shadow-[0_2px_12px_rgba(16,38,83,0.04)]'
          : 'bg-white/80 backdrop-blur-xs border-b border-transparent'
      )}
    >
      <div className="mx-auto flex h-18 max-w-[1200px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Left: CareOS Logo */}
        <Link to="/" className="shrink-0 focus-visible:rounded-md" aria-label="CareOS Home">
          <CareOSLogo variant="compact" />
        </Link>

        {/* Center: Clean 3-item primary navigation matching reference */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Primary Navigation">
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'platform' ? null : 'platform')}
              aria-expanded={openDropdown === 'platform'}
              className={cn(
                'inline-flex items-center gap-1 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0',
                isActive('/platform') || isActive('/agents') || openDropdown === 'platform'
                  ? 'text-[#3299F5]'
                  : 'text-[#172B4D] hover:text-[#3299F5]'
              )}
            >
              Platform
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openDropdown === 'platform' && 'rotate-180')} />
            </button>
            {openDropdown === 'platform' && (
              <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-[#E3EDF6] bg-white p-2 shadow-[0_14px_36px_rgba(16,38,83,0.09)]">
                {DROPDOWNS.platform.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F4F9FF]"
                  >
                    <div className="text-sm font-semibold text-[#102653]">{item.label}</div>
                    <div className="mt-0.5 text-xs text-[#71839C]">{item.desc}</div>
                  </Link>
                ))}
                <div className="mt-1 border-t border-[#E3EDF6] pt-1">
                  <Link
                    to="/platform"
                    className="block rounded-lg px-3 py-2 text-xs font-semibold text-[#3299F5] hover:bg-[#F4F9FF]"
                  >
                    Explore full platform →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpenDropdown(openDropdown === 'solutions' ? null : 'solutions')}
              aria-expanded={openDropdown === 'solutions'}
              className={cn(
                'inline-flex items-center gap-1 py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0',
                isActive('/solutions') || openDropdown === 'solutions'
                  ? 'text-[#3299F5]'
                  : 'text-[#172B4D] hover:text-[#3299F5]'
              )}
            >
              Solutions
              <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openDropdown === 'solutions' && 'rotate-180')} />
            </button>
            {openDropdown === 'solutions' && (
              <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-[#E3EDF6] bg-white p-2 shadow-[0_14px_36px_rgba(16,38,83,0.09)]">
                {DROPDOWNS.solutions.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-[#F4F9FF]"
                  >
                    <div className="text-sm font-semibold text-[#102653]">{item.label}</div>
                    <div className="mt-0.5 text-xs text-[#71839C]">{item.desc}</div>
                  </Link>
                ))}
                <div className="mt-1 border-t border-[#E3EDF6] pt-1">
                  <Link
                    to="/solutions"
                    className="block rounded-lg px-3 py-2 text-xs font-semibold text-[#3299F5] hover:bg-[#F4F9FF]"
                  >
                    View all solutions →
                  </Link>
                </div>
              </div>
            )}
          </div>

          <Link
            to="/about"
            className={cn(
              'py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0',
              isActive('/about') ? 'text-[#3299F5]' : 'text-[#172B4D] hover:text-[#3299F5]'
            )}
          >
            About
          </Link>
        </nav>

        {/* Right: Login & Book a Demo pill buttons matching reference */}
        <div className="hidden md:flex items-center gap-3 shrink-0">
          {isAuthenticated ? (
            <Link
              to="/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-full bg-[#3299F5] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(50,153,245,0.28)] transition-colors hover:bg-[#2383db] whitespace-nowrap shrink-0"
            >
              Open Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex h-10 items-center justify-center rounded-full border border-[#E3EDF6] bg-white px-5 text-sm font-medium text-[#102653] transition-colors hover:border-[#3299F5] hover:bg-[#F4F9FF] whitespace-nowrap shrink-0"
              >
                Login
              </Link>
              <Link
                to="/contact?intent=demo"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#3299F5] px-5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(50,153,245,0.28)] transition-colors hover:bg-[#2383db] whitespace-nowrap shrink-0"
              >
                Book a Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileOpen}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#E3EDF6] text-[#102653] md:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileOpen && (
        <div className="border-t border-[#E3EDF6] bg-white px-4 py-5 md:hidden">
          <div className="space-y-1">
            {[
              { label: 'Platform', to: '/platform' },
              { label: 'AI Agents', to: '/agents' },
              { label: 'Solutions', to: '/solutions' },
              { label: 'Integrations', to: '/integrations' },
              { label: 'Security', to: '/security' },
              { label: 'About', to: '/about' },
              { label: 'Contact', to: '/contact' },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-base font-medium',
                  isActive(item.to) ? 'bg-[#EAF5FF] text-[#102653]' : 'text-[#172B4D] hover:bg-[#F4F9FF]'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2.5 border-t border-[#E3EDF6] pt-4">
            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="flex h-11 items-center justify-center rounded-full bg-[#3299F5] px-4 text-sm font-semibold text-white"
              >
                Open Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/contact?intent=demo"
                  className="flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#3299F5] px-4 text-sm font-semibold text-white"
                >
                  Book a Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/login"
                  className="flex h-11 items-center justify-center rounded-full border border-[#E3EDF6] bg-white px-4 text-sm font-medium text-[#102653]"
                >
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
