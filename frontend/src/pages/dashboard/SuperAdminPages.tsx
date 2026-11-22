import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Download,
  FileText,
  Filter,
  Monitor,
  Network,
  Plus,
  Search,
  Server,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type {
  ApplicationStatus,
  ApprovedHospital,
  AuditLogEntry,
  AuthUser,
  HospitalApplication,
  SubscriptionPlan,
  SubscriptionRecord,
  SuperAdminOverviewData,
  UserRole,
} from '@/shared/types/careos';
import { cn, formatTimeAgo } from '../../lib/utils';

function HospitalBuildingThumb({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 180 110"
      className={cn('rounded-xl border border-[#E3EDF6] bg-[#EAF5FF] object-cover', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hspSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9ED4FC" />
          <stop offset="100%" stopColor="#EAF5FF" />
        </linearGradient>
      </defs>
      <rect width="180" height="110" fill="url(#hspSky)" />
      <rect x="24" y="34" width="132" height="68" rx="4" fill="#FFFFFF" stroke="#D5E6F5" />
      <rect x="34" y="24" width="112" height="12" rx="2" fill="#F4F9FF" stroke="#D5E6F5" />
      <rect x="78" y="14" width="24" height="12" rx="2" fill="#3299F5" />
      <path d="M87 17h6v6h-6z" fill="#FFFFFF" />
      <rect x="85" y="19" width="10" height="2" fill="#FFFFFF" />
      {[42, 62, 82, 102, 122].map((x) => (
        <g key={x}>
          <rect x={x} y="44" width="12" height="14" rx="2" fill="#EAF5FF" stroke="#B7DCF9" />
          <rect x={x} y="64" width="12" height="14" rx="2" fill="#EAF5FF" stroke="#B7DCF9" />
        </g>
      ))}
      <rect x="78" y="84" width="24" height="18" rx="2" fill="#3299F5" fillOpacity="0.18" stroke="#3299F5" />
      <rect x="0" y="100" width="180" height="10" fill="#DCECF9" />
    </svg>
  );
}

function StatusBadge({ status }: { status: ApplicationStatus | 'Active' | 'Suspended' | 'Paused' }) {
  const styles: Record<string, string> = {
    Pending: 'bg-amber-50 text-amber-700 border-amber-200',
    'Under Review': 'bg-[#EAF5FF] text-[#3299F5] border-[#3299F5]/25',
    'Docs Requested': 'bg-orange-50 text-orange-700 border-orange-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-red-50 text-red-700 border-red-200',
    Active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Suspended: 'bg-red-50 text-red-700 border-red-200',
    Paused: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        styles[status] || 'bg-[#F4F9FF] text-[#102653] border-[#E3EDF6]'
      )}
    >
      {status}
    </span>
  );
}

function PlanBadge({ plan }: { plan: SubscriptionPlan }) {
  const styles: Record<SubscriptionPlan, string> = {
    Enterprise: 'bg-[#EAF5FF] text-[#3299F5] border-[#3299F5]/25',
    Pro: 'bg-[#F4F9FF] text-[#102653] border-[#E3EDF6]',
    Starter: 'bg-slate-50 text-[#71839C] border-[#E3EDF6]',
  };
  return (
    <span className={cn('inline-flex rounded-md border px-2.5 py-0.5 text-[11px] font-semibold', styles[plan])}>
      {plan}
    </span>
  );
}

function RegistrationGrowthChart({ data }: { data: Array<{ month: string; count: number }> }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 420;
  const height = 190;
  const padL = 32;
  const padR = 14;
  const padT = 22;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const peak = Math.max(...data.map((d) => d.count), 0);
  const maxVal = peak === 0 ? 10 : Math.max(peak, 4);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const pts = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - (d.count / maxVal) * innerH,
    ...d,
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath =
    pts.length > 0
      ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${padT + innerH} L ${pts[0].x.toFixed(1)} ${padT + innerH} Z`
      : '';

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 overflow-visible" role="img" aria-label="Hospital Registration Growth">
        <defs>
          <linearGradient id="saGrowthGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3299F5" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#3299F5" stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t, idx) => {
          const y = padT + innerH * (1 - t);
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E3EDF6" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-[#71839C] text-[10px] font-mono tabular-nums">
                {Math.round(maxVal * t)}
              </text>
            </g>
          );
        })}
        {areaPath && <path d={areaPath} fill="url(#saGrowthGrad)" />}
        {linePath && <path d={linePath} fill="none" stroke="#3299F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {pts.map((p, i) => {
          const active = hoverIdx === i || (i === pts.length - 1 && peak > 0 && hoverIdx === null);
          return (
            <g
              key={`${p.month}-${i}`}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect x={p.x - 14} y={padT} width={28} height={innerH + padB} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={active ? 4.5 : 3} fill="#3299F5" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x={p.x} y={height - 6} textAnchor="middle" className="fill-[#71839C] text-[9.5px] font-mono">
                {p.month}
              </text>
              {active && (
                <g transform={`translate(${Math.min(Math.max(p.x - 16, 20), width - 48)}, ${Math.max(p.y - 24, 2)})`}>
                  <rect width="32" height="18" rx="4" fill="#3299F5" />
                  <text x="16" y="12.5" textAnchor="middle" className="fill-white text-[10px] font-mono font-semibold">
                    {p.count}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ApplicationDonutChart({
  total,
  pending,
  underReview,
  approved,
}: {
  total: number;
  pending: number;
  underReview: number;
  approved: number;
}) {
  const size = 144;
  const strokeWidth = 18;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;

  const pctPending = total > 0 ? Math.round((pending / total) * 100) : 0;
  const pctReview = total > 0 ? Math.round((underReview / total) * 100) : 0;
  const pctApproved = total > 0 ? Math.round((approved / total) * 100) : 0;

  const segPending = total > 0 ? (pending / total) * c : 0;
  const segReview = total > 0 ? (underReview / total) * c : 0;
  const segApproved = total > 0 ? (approved / total) * c : 0;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="relative h-36 w-36 shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-label="Application Overview Donut">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EAF5FF" strokeWidth={strokeWidth} />
          {total > 0 && (
            <>
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#F59E0B"
                strokeWidth={strokeWidth}
                strokeDasharray={`${segPending} ${c}`}
                strokeDashoffset={0}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#3299F5"
                strokeWidth={strokeWidth}
                strokeDasharray={`${segReview} ${c}`}
                strokeDashoffset={-segPending}
              />
              <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke="#10B981"
                strokeWidth={strokeWidth}
                strokeDasharray={`${segApproved} ${c}`}
                strokeDashoffset={-(segPending + segReview)}
              />
            </>
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-display text-2xl font-bold text-[#102653] tabular-nums">{total}</span>
          <span className="text-[11px] font-medium text-[#71839C]">Total</span>
        </div>
      </div>

      <div className="flex-1 min-w-[140px] space-y-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#172B4D]">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pending
          </span>
          <span className="font-mono font-semibold text-[#102653] tabular-nums">
            {pending} ({pctPending}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#172B4D]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3299F5]" /> Under Review
          </span>
          <span className="font-mono font-semibold text-[#102653] tabular-nums">
            {underReview} ({pctReview}%)
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#172B4D]">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Approved
          </span>
          <span className="font-mono font-semibold text-[#102653] tabular-nums">
            {approved} ({pctApproved}%)
          </span>
        </div>
      </div>
    </div>
  );
}

function OnboardHospitalModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { apiFetch } = useAuth();
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalType, setHospitalType] = useState('Multi-Specialty');
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bedsCount, setBedsCount] = useState('200');
  const [departmentsCount, setDepartmentsCount] = useState('14');
  const [plan, setPlan] = useState<SubscriptionPlan>('Enterprise');
  const [autoApprove, setAutoApprove] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    hospitalName: string;
    applicationId: string;
    hospitalId?: string;
    usesDefaultPassword: boolean;
  } | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setCreatedCredentials(null);
    setErr(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{
        application: HospitalApplication;
        hospital?: ApprovedHospital | null;
        provisionedLogin?: { username: string; usesDefaultPassword: boolean } | null;
      }>('/api/super-admin/hospitals/manual', {
        method: 'POST',
        body: JSON.stringify({
          hospitalName,
          hospitalType,
          location,
          address,
          contactPerson,
          email,
          phone,
          bedsCount: Number(bedsCount) || 150,
          departmentsCount: Number(departmentsCount) || 10,
          plan,
          autoApprove,
        }),
      });
      const submittedName = hospitalName;
      setHospitalName('');
      setLocation('');
      setAddress('');
      setContactPerson('');
      setEmail('');
      setPhone('');
      onSuccess();
      if (res.provisionedLogin?.username) {
        setCreatedCredentials({
          hospitalName: submittedName,
          applicationId: res.provisionedLogin.username,
          hospitalId: res.hospital?.hospitalId,
          usesDefaultPassword: res.provisionedLogin.usesDefaultPassword,
        });
      } else {
        handleClose();
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to onboard hospital.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3.5">
          <div>
            <h2 className="font-display text-lg font-bold text-[#102653]">
              {createdCredentials ? 'Hospital Workspace Provisioned' : 'Onboard Hospital'}
            </h2>
            <p className="text-xs text-[#71839C]">
              {createdCredentials
                ? 'Share the Application ID username below with the hospital administrator.'
                : 'Create a hospital onboarding record or provision workspace immediately.'}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-1.5 text-[#71839C] hover:bg-[#F4F9FF]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {err && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</div>}

        {createdCredentials ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950">
              <div className="flex items-center gap-2 font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                {createdCredentials.hospitalName} is now active
                {createdCredentials.hospitalId ? ` (${createdCredentials.hospitalId})` : ''}
              </div>
              <p className="mt-1.5 text-emerald-800">
                The hospital administrator can sign in immediately using their Application ID as the username.
              </p>
            </div>
            <div className="rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#71839C]">Login Username (App ID)</span>
                <span className="font-mono font-bold text-sm text-[#102653]">{createdCredentials.applicationId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#71839C]">Initial Password</span>
                <span className="font-mono font-semibold text-[#3299F5]">
                  {createdCredentials.usesDefaultPassword ? 'password (reset required on first login)' : 'User-configured password'}
                </span>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-[#3299F5] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2383db]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Hospital Name *</label>
              <input
                required
                value={hospitalName}
                onChange={(e) => setHospitalName(e.target.value)}
                placeholder="Apollo Care Institute"
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Hospital Type</label>
              <select
                value={hospitalType}
                onChange={(e) => setHospitalType(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] bg-white px-3 text-sm text-[#172B4D]"
              >
                <option>Multi-Specialty</option>
                <option>Academic Medical Center</option>
                <option>Community Hospital</option>
                <option>Specialty Clinic Network</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Administrator / Contact *</label>
              <input
                required
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Dr. Meera Sharma"
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Administrator Email *</label>
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="meera.sharma@hospital.org"
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#102653]">City / Region</label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Bengaluru, KA"
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#102653]">Street Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Healthcare Blvd"
              className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Beds</label>
              <input
                type="number"
                min={1}
                value={bedsCount}
                onChange={(e) => setBedsCount(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 font-mono text-sm text-[#172B4D]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Departments</label>
              <input
                type="number"
                min={1}
                value={departmentsCount}
                onChange={(e) => setDepartmentsCount(e.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 font-mono text-sm text-[#172B4D]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Subscription</label>
              <select
                value={plan}
                onChange={(e) => setPlan(e.target.value as SubscriptionPlan)}
                className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] bg-white px-3 text-sm text-[#172B4D]"
              >
                <option value="Starter">Starter</option>
                <option value="Pro">Pro</option>
                <option value="Enterprise">Enterprise</option>
              </select>
            </div>
          </div>

          <label className="flex items-center gap-2.5 pt-1 text-xs text-[#172B4D] cursor-pointer">
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              className="h-4 w-4 rounded border-[#E3EDF6] text-[#3299F5]"
            />
            <span>Immediately approve &amp; activate workspace in Hospital Directory</span>
          </label>

          <div className="flex items-center justify-end gap-3 border-t border-[#E3EDF6] pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-[#E3EDF6] px-4 py-2 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-[#3299F5] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2383db] disabled:opacity-60"
            >
              {submitting ? 'Provisioning...' : autoApprove ? 'Create & Approve Hospital' : 'Submit Application'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}

// =========================================================================
// 1. SUPER ADMIN PLATFORM COMMAND CENTER
// =========================================================================
export function SuperAdminCommandCenter() {
  const { apiFetch } = useAuth();
  const [data, setData] = useState<SuperAdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [healthModalOpen, setHealthModalOpen] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<SuperAdminOverviewData>('/api/super-admin/overview');
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const filteredApps =
    data?.applications.filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        a.hospitalName.toLowerCase().includes(q) ||
        a.applicationId.toLowerCase().includes(q) ||
        a.contactPerson.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q)
      );
    }) ?? [];

  const kpis = data
    ? [
        { label: 'Total Hospitals', value: data.metrics.totalHospitals, icon: Building2, tone: 'text-[#3299F5]' },
        { label: 'Pending Applications', value: data.metrics.pendingApplications, icon: Clock, tone: 'text-amber-500' },
        { label: 'Approved Hospitals', value: data.metrics.approvedHospitals, icon: CheckCircle2, tone: 'text-emerald-500' },
        { label: 'Active Workspaces', value: data.metrics.activeWorkspaces, icon: Monitor, tone: 'text-[#3299F5]' },
        { label: 'Total Users', value: data.metrics.totalUsers, icon: Users, tone: 'text-[#3299F5]' },
        { label: 'Active Subscriptions', value: data.metrics.activeSubscriptions, icon: CreditCard, tone: 'text-[#3299F5]' },
      ]
    : [];

  return (
    <DashboardLayout
      title="Platform Command Center"
      breadcrumb="Command Center"
      subtitle="Manage hospitals, monitor activity and oversee the CareOS ecosystem."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      actions={
        <button
          type="button"
          onClick={() => setOnboardOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3299F5] px-4 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(50,153,245,0.28)] hover:bg-[#2383db]"
        >
          <Plus className="h-4 w-4" />
          Onboard Hospital
        </button>
      }
    >
      {loading && !data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* 6 KPI Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="rounded-2xl border border-[#E3EDF6] bg-white p-4 shadow-[0_2px_10px_rgba(16,38,83,0.03)]"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF]', kpi.tone)}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-2xl font-bold text-[#102653] tabular-nums">{kpi.value}</div>
                      <div className="truncate text-[11.5px] font-medium text-[#71839C]">{kpi.label}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: Onboarding Requests + Hospital Registration Growth */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-8 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-display text-base font-bold text-[#102653]">Hospital Onboarding Requests</h2>
                <Link to="/dashboard/applications" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  View All Applications →
                </Link>
              </div>

              {filteredApps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E3EDF6] bg-[#F7FAFF] px-6 py-10 text-center">
                  <Building2 className="mx-auto h-7 w-7 text-[#3299F5]/70" />
                  <div className="mt-2 text-sm font-semibold text-[#102653]">No hospital onboarding requests yet</div>
                  <p className="mx-auto mt-1 max-w-md text-xs text-[#71839C]">
                    Requests submitted from Hospital Signup or Book a Demo will appear here in real time, or click Onboard Hospital above.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                        <th className="py-2.5 px-3 font-semibold rounded-l-lg">Hospital Name</th>
                        <th className="py-2.5 px-3 font-semibold">Application ID</th>
                        <th className="py-2.5 px-3 font-semibold">Location</th>
                        <th className="py-2.5 px-3 font-semibold">Contact Person</th>
                        <th className="py-2.5 px-3 font-semibold">Submitted Date</th>
                        <th className="py-2.5 px-3 font-semibold">Status</th>
                        <th className="py-2.5 px-3 text-right font-semibold rounded-r-lg">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3EDF6]">
                      {filteredApps.slice(0, 6).map((app) => (
                        <tr key={app.id} className="hover:bg-[#F4F9FF]/50">
                          <td className="py-3 px-3 font-semibold text-[#102653]">{app.hospitalName}</td>
                          <td className="py-3 px-3 font-mono text-[#71839C]">{app.applicationId}</td>
                          <td className="py-3 px-3 text-[#172B4D]">{app.location}</td>
                          <td className="py-3 px-3 text-[#172B4D]">{app.contactPerson}</td>
                          <td className="py-3 px-3 text-[#71839C]">
                            {new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={app.status} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <Link
                              to={`/dashboard/applications/${app.applicationId}`}
                              className="inline-flex items-center rounded-lg border border-[#E3EDF6] bg-white px-3 py-1 text-xs font-semibold text-[#3299F5] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
                            >
                              {app.status === 'Approved' ? 'View' : 'Review'}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="xl:col-span-4 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-bold text-[#102653]">Hospital Registration Growth</h2>
                <span className="text-[11px] font-semibold text-[#3299F5]">Last 12 Months</span>
              </div>
              <RegistrationGrowthChart data={data.monthlyGrowth} />
            </div>
          </div>

          {/* Row 3: Application Overview Donut + Recently Registered Hospitals + Platform Activity */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-4 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <h2 className="mb-4 font-display text-base font-bold text-[#102653]">Application Overview</h2>
              <ApplicationDonutChart
                total={data.applicationOverview.total}
                pending={data.applicationOverview.pending}
                underReview={data.applicationOverview.underReview}
                approved={data.applicationOverview.approved}
              />
            </div>

            <div className="lg:col-span-4 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-base font-bold text-[#102653]">Recently Registered Hospitals</h2>
                <Link to="/dashboard/directory" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  View All →
                </Link>
              </div>
              {data.recentHospitals.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71839C]">
                  No hospitals approved yet. Approved hospitals appear here automatically.
                </div>
              ) : (
                <div className="divide-y divide-[#E3EDF6]">
                  {data.recentHospitals.slice(0, 4).map((hsp) => (
                    <div key={hsp.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-[#102653]">{hsp.hospitalName}</div>
                          <div className="truncate text-[11px] text-[#71839C]">{hsp.location}</div>
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-mono text-[#71839C]">{formatTimeAgo(hsp.approvedAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="lg:col-span-4 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <h2 className="mb-4 font-display text-base font-bold text-[#102653]">Platform Activity</h2>
              {data.platformActivity.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#71839C]">
                  Activity timeline is quiet. Events appear as hospitals and users interact.
                </div>
              ) : (
                <div className="relative space-y-4 pl-4 before:absolute before:left-[5px] before:top-2 before:bottom-2 before:w-px before:bg-[#E3EDF6]">
                  {data.platformActivity.slice(0, 5).map((item) => (
                    <div key={item.id} className="relative flex items-start justify-between gap-3 text-xs">
                      <span className="absolute -left-4 top-1 h-2.5 w-2.5 rounded-full bg-[#3299F5] ring-4 ring-white" />
                      <span className="text-[#172B4D] font-medium leading-snug">{item.message}</span>
                      <span className="shrink-0 font-mono text-[11px] text-[#71839C]">{formatTimeAgo(item.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Global AI Agent Status + System Health */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-base font-bold text-[#102653]">Global AI Agent Status</h2>
                <Link to="/dashboard/agents" className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                  View All →
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                {data.agents.map((ag) => (
                  <div key={ag.id} className="rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] p-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                        <Bot className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-[#102653]">{ag.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {ag.status} · {ag.completedTasks} tasks
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-base font-bold text-[#102653]">System Health</h2>
                <button
                  type="button"
                  onClick={() => setHealthModalOpen(true)}
                  className="text-xs font-semibold text-[#3299F5] hover:text-[#102653]"
                >
                  View Details →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Database', status: data.systemHealth.database, icon: Database },
                  { label: 'Backend', status: data.systemHealth.backend, icon: Server },
                  { label: 'AI Services', status: data.systemHealth.aiServices, icon: Activity },
                  { label: 'Integrations', status: data.systemHealth.integrations, icon: Network },
                ].map((sys) => {
                  const Icon = sys.icon;
                  return (
                    <div key={sys.label} className="rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] p-3 text-center">
                      <Icon className="mx-auto h-5 w-5 text-[#3299F5]" />
                      <div className="mt-2 text-xs font-semibold text-[#102653]">{sys.label}</div>
                      <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        {sys.status}
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <OnboardHospitalModal open={onboardOpen} onClose={() => setOnboardOpen(false)} onSuccess={loadOverview} />

      {healthModalOpen && data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <h3 className="font-display text-base font-bold text-[#102653]">Platform Infrastructure Diagnostics</h3>
              <button type="button" onClick={() => setHealthModalOpen(false)} className="rounded-md p-1 text-[#71839C]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex justify-between rounded-lg bg-[#F4F9FF] px-3.5 py-2.5">
                <span className="font-medium text-[#102653]">Persistent Store (.data/careos-db.json)</span>
                <span className="font-semibold text-emerald-600">{data.systemHealth.database}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#F4F9FF] px-3.5 py-2.5">
                <span className="font-medium text-[#102653]">Express API &amp; Session Auth</span>
                <span className="font-semibold text-emerald-600">{data.systemHealth.backend}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#F4F9FF] px-3.5 py-2.5">
                <span className="font-medium text-[#102653]">CareOS AI Agent Engine</span>
                <span className="font-semibold text-[#3299F5]">{data.systemHealth.aiServices}</span>
              </div>
              <div className="flex justify-between rounded-lg bg-[#F4F9FF] px-3.5 py-2.5">
                <span className="font-medium text-[#102653]">Integration Adapters</span>
                <span className="font-semibold text-emerald-600">{data.systemHealth.integrations}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// =========================================================================
// 2. HOSPITAL APPLICATIONS LIST + APPLICATION REVIEW SCREEN
// =========================================================================
export function HospitalApplicationsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { apiFetch } = useAuth();
  const [applications, setApplications] = useState<HospitalApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<HospitalApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [onboardOpen, setOnboardOpen] = useState(false);

  // Review screen states
  const [notes, setNotes] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [requestDocsOpen, setRequestDocsOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [chosenPlan, setChosenPlan] = useState<SubscriptionPlan>('Enterprise');
  const [processing, setProcessing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (id) {
        const res = await apiFetch<{ application: HospitalApplication }>(`/api/super-admin/applications/${id}`);
        setSelectedApp(res.application);
        setNotes(res.application.internalNotes || '');
        setChosenPlan(res.application.bedsCount >= 200 ? 'Enterprise' : res.application.bedsCount >= 80 ? 'Pro' : 'Starter');
      } else {
        const res = await apiFetch<{ applications: HospitalApplication[] }>('/api/super-admin/applications');
        setApplications(res.applications);
        setSelectedApp(null);
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveNotes = async () => {
    if (!selectedApp) return;
    setProcessing(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/super-admin/applications/${selectedApp.applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ internalNotes: notes }),
      });
      setActionMsg('Internal review notes saved.');
      await loadData();
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusChange = async (nextStatus: ApplicationStatus, requestedMessage?: string) => {
    if (!selectedApp) return;
    setProcessing(true);
    setActionMsg(null);
    try {
      await apiFetch(`/api/super-admin/applications/${selectedApp.applicationId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus, internalNotes: notes, requestedMessage }),
      });
      setActionMsg(`Application marked as ${nextStatus}.`);
      setRequestDocsOpen(false);
      setRequestMessage('');
      await loadData();
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveHospital = async () => {
    if (!selectedApp) return;
    setProcessing(true);
    setActionMsg(null);
    try {
      const res = await apiFetch<{
        hospital: ApprovedHospital;
        provisionedLogin?: { username: string; usesDefaultPassword: boolean };
      }>(`/api/super-admin/applications/${selectedApp.applicationId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ plan: chosenPlan }),
      });
      setApproveModalOpen(false);
      const loginInfo = res.provisionedLogin?.username
        ? ` Login Username: ${res.provisionedLogin.username}${
            res.provisionedLogin.usesDefaultPassword ? ' (initial password: password)' : ''
          }.`
        : '';
      setActionMsg(`Approved! Provisioned ${res.hospital.hospitalId} on the ${chosenPlan} plan.${loginInfo}`);
      await loadData();
    } finally {
      setProcessing(false);
    }
  };

  // Detail Review View (matches Hospital Application Review in CareOS_Platform_Command_Center_d3f84f16.webp)
  if (id) {
    return (
      <DashboardLayout
        title="Hospital Application Review"
        breadcrumb={`Hospital Applications / Review`}
        actions={
          selectedApp ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/dashboard/applications')}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E3EDF6] bg-white px-3.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                All Applications
              </button>
              {selectedApp.status !== 'Approved' && (
                <>
                  {selectedApp.status === 'Pending' && (
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleStatusChange('Under Review')}
                      className="inline-flex h-10 items-center rounded-xl border border-[#3299F5]/40 bg-[#EAF5FF] px-4 text-xs font-semibold text-[#3299F5] hover:bg-[#dceeff]"
                    >
                      Mark Under Review
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => setRequestDocsOpen(true)}
                    className="inline-flex h-10 items-center rounded-xl border border-[#E3EDF6] bg-white px-4 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                  >
                    Request Documents
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleStatusChange('Rejected')}
                    className="inline-flex h-10 items-center rounded-xl border border-red-200 bg-white px-4 text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => setApproveModalOpen(true)}
                    className="inline-flex h-10 items-center rounded-xl bg-[#3299F5] px-5 text-xs font-semibold text-white shadow-[0_4px_14px_rgba(50,153,245,0.28)] hover:bg-[#2383db]"
                  >
                    Approve Hospital
                  </button>
                </>
              )}
            </div>
          ) : undefined
        }
      >
        {actionMsg && (
          <div className="mb-5 flex items-center justify-between rounded-xl border border-[#3299F5]/30 bg-[#EAF5FF] px-4 py-3 text-xs font-medium text-[#102653]">
            <span>{actionMsg}</span>
            {selectedApp?.status === 'Approved' && (
              <Link to="/dashboard/directory" className="font-semibold text-[#3299F5] hover:underline">
                View in Hospital Directory →
              </Link>
            )}
          </div>
        )}

        {loading || !selectedApp ? (
          <div className="h-72 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
        ) : (
          <div className="space-y-6">
            {/* Hospital Header Banner */}
            <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
              <div className="flex flex-wrap items-center gap-5">
                <HospitalBuildingThumb className="h-24 w-40 shrink-0" />
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-xl font-bold text-[#102653]">{selectedApp.hospitalName}</h2>
                    <StatusBadge status={selectedApp.status} />
                  </div>
                  <div className="mt-1.5 text-xs text-[#172B4D]">
                    Application ID: <span className="font-mono font-semibold text-[#102653]">{selectedApp.applicationId}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#71839C]">
                    Submitted:{' '}
                    {new Date(selectedApp.submittedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Information Cards */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
                <h3 className="font-display text-sm font-bold text-[#102653]">Registration Information</h3>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Hospital Name</dt>
                    <dd className="text-right font-semibold text-[#102653]">{selectedApp.hospitalName}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Hospital Type</dt>
                    <dd className="text-right font-medium text-[#172B4D]">{selectedApp.hospitalType}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Number of Beds</dt>
                    <dd className="text-right font-mono font-semibold text-[#102653]">{selectedApp.bedsCount}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Departments</dt>
                    <dd className="text-right font-mono font-semibold text-[#102653]">{selectedApp.departmentsCount}</dd>
                  </div>
                </dl>
              </div>

              <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
                <h3 className="font-display text-sm font-bold text-[#102653]">Location &amp; Contact</h3>
                <dl className="mt-4 space-y-3 text-xs">
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Address</dt>
                    <dd className="text-right font-medium text-[#102653]">{selectedApp.address || selectedApp.location}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Contact Person</dt>
                    <dd className="text-right font-semibold text-[#102653]">{selectedApp.contactPerson}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Email</dt>
                    <dd className="text-right font-medium text-[#3299F5] break-all">{selectedApp.email}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#71839C]">Phone</dt>
                    <dd className="text-right font-mono text-[#172B4D]">{selectedApp.phone}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
                <div>
                  <h3 className="font-display text-sm font-bold text-[#102653]">Documents</h3>
                  <ul className="mt-4 space-y-2.5 text-xs">
                    {selectedApp.documents.map((doc, idx) => (
                      <li key={`${doc.name}-${idx}`} className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 text-[#3299F5] font-medium truncate">
                          <FileText className="h-4 w-4 shrink-0 text-[#3299F5]" />
                          <span className="truncate">{doc.name}</span>
                        </span>
                        <span className="text-[11px] font-medium text-[#71839C]">{doc.status}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setDocsModalOpen(true)}
                  className="mt-4 w-full rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] py-2 text-xs font-semibold text-[#102653] hover:bg-[#EAF5FF]"
                >
                  View All Documents
                </button>
              </div>
            </div>

            {/* Application Timeline + Internal Review Notes */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="lg:col-span-6 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
                <h3 className="font-display text-sm font-bold text-[#102653]">Application Timeline</h3>
                <div className="mt-8 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#3299F5] text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#102653]">Submitted</div>
                    <div className="mt-0.5 text-[11px] text-[#71839C]">
                      {new Date(selectedApp.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <div>
                    <div
                      className={cn(
                        'mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2',
                        selectedApp.status !== 'Pending'
                          ? 'border-[#3299F5] bg-[#EAF5FF] text-[#3299F5]'
                          : 'border-[#3299F5] bg-white text-[#3299F5]'
                      )}
                    >
                      <span className="h-2.5 w-2.5 rounded-full bg-[#3299F5]" />
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#102653]">Under Review</div>
                    <div className="mt-0.5 text-[11px] text-[#71839C]">
                      {selectedApp.status === 'Docs Requested' ? 'Docs Requested' : 'Now'}
                    </div>
                  </div>
                  <div>
                    <div
                      className={cn(
                        'mx-auto flex h-8 w-8 items-center justify-center rounded-full border-2',
                        selectedApp.status === 'Approved'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                          : selectedApp.status === 'Rejected'
                          ? 'border-red-500 bg-red-50 text-red-600'
                          : 'border-[#E3EDF6] bg-[#F7FAFF] text-[#71839C]'
                      )}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="mt-2 text-xs font-semibold text-[#102653]">Decision</div>
                    <div className="mt-0.5 text-[11px] text-[#71839C]">
                      {selectedApp.status === 'Approved'
                        ? 'Approved'
                        : selectedApp.status === 'Rejected'
                        ? 'Rejected'
                        : 'Pending'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
                <h3 className="font-display text-sm font-bold text-[#102653]">Internal Review Notes</h3>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add your notes..."
                  className="mt-3 w-full rounded-xl border border-[#E3EDF6] p-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={handleSaveNotes}
                    className="rounded-xl border border-[#E3EDF6] bg-white px-4 py-2 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Request Docs Modal */}
        {requestDocsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
              <h3 className="font-display text-base font-bold text-[#102653]">Request Verification Documents</h3>
              <p className="mt-1 text-xs text-[#71839C]">
                This message will appear on the applicant&apos;s onboarding status tracker.
              </p>
              <textarea
                rows={3}
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Please provide an updated clinical facility license and accreditation certificate."
                className="mt-4 w-full rounded-xl border border-[#E3EDF6] p-3 text-xs text-[#172B4D]"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRequestDocsOpen(false)}
                  className="rounded-lg border border-[#E3EDF6] px-4 py-2 text-xs font-semibold text-[#102653]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleStatusChange(
                      'Docs Requested',
                      requestMessage.trim() || 'Please submit your Hospital License and Registration Certificate.'
                    )
                  }
                  className="rounded-lg bg-[#3299F5] px-4 py-2 text-xs font-semibold text-white"
                >
                  Send Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approve Modal */}
        {approveModalOpen && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
              <h3 className="font-display text-base font-bold text-[#102653]">Approve Hospital &amp; Provision Workspace</h3>
              <p className="mt-1 text-xs text-[#71839C]">
                Select the subscription plan for <span className="font-semibold text-[#102653]">{selectedApp.hospitalName}</span>.
              </p>
              <div className="mt-4 space-y-2.5">
                {(['Starter', 'Pro', 'Enterprise'] as const).map((planOption) => (
                  <button
                    key={planOption}
                    type="button"
                    onClick={() => setChosenPlan(planOption)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border p-3.5 text-left text-xs transition-colors',
                      chosenPlan === planOption
                        ? 'border-[#3299F5] bg-[#EAF5FF]'
                        : 'border-[#E3EDF6] bg-white hover:bg-[#F7FAFF]'
                    )}
                  >
                    <div>
                      <div className="font-semibold text-[#102653]">{planOption} Plan</div>
                      <div className="text-[#71839C]">
                        {planOption === 'Enterprise'
                          ? 'Up to 250 clinical seats · Full Agent Orchestration'
                          : planOption === 'Pro'
                          ? 'Up to 75 clinical seats · Multi-department automation'
                          : 'Up to 25 clinical seats · Core workspace'}
                      </div>
                    </div>
                    <span className="font-mono font-bold text-[#3299F5]">
                      ${planOption === 'Enterprise' ? '2,400' : planOption === 'Pro' ? '950' : '350'}/mo
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApproveModalOpen(false)}
                  className="rounded-lg border border-[#E3EDF6] px-4 py-2 text-xs font-semibold text-[#102653]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleApproveHospital}
                  className="rounded-lg bg-[#3299F5] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2383db]"
                >
                  {processing ? 'Approving...' : 'Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Documents Modal */}
        {docsModalOpen && selectedApp && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
            <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
                <h3 className="font-display text-base font-bold text-[#102653]">Submitted Verification Documents</h3>
                <button type="button" onClick={() => setDocsModalOpen(false)} className="rounded-md p-1 text-[#71839C]">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ul className="mt-4 space-y-2.5 text-xs">
                {selectedApp.documents.map((doc, idx) => (
                  <li key={idx} className="flex items-center justify-between rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] p-3">
                    <span className="font-medium text-[#102653]">{doc.name}</span>
                    <span className="font-semibold text-[#3299F5]">{doc.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DashboardLayout>
    );
  }

  // Applications List View
  const filtered = applications.filter((a) => {
    const matchesStatus = statusFilter === 'All' || a.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      a.hospitalName.toLowerCase().includes(q) ||
      a.applicationId.toLowerCase().includes(q) ||
      a.contactPerson.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <DashboardLayout
      title="Hospital Applications"
      breadcrumb="Hospital Applications"
      subtitle="Review incoming hospital onboarding requests, verify documentation, and provision workspaces."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      actions={
        <button
          type="button"
          onClick={() => setOnboardOpen(true)}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3299F5] px-4 text-xs font-semibold text-white hover:bg-[#2383db]"
        >
          <Plus className="h-4 w-4" />
          New Hospital Request
        </button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {['All', 'Pending', 'Under Review', 'Docs Requested', 'Approved', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                statusFilter === st
                  ? 'bg-[#102653] text-white'
                  : 'border border-[#E3EDF6] bg-white text-[#71839C] hover:text-[#102653]'
              )}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
        {loading ? (
          <div className="h-48 animate-pulse rounded-xl bg-[#F4F9FF]" />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-[#3299F5]/70" />
            <div className="mt-2 text-sm font-semibold text-[#102653]">No applications in this queue</div>
            <p className="mt-1 text-xs text-[#71839C]">
              Hospital applications submitted via Signup or Book a Demo appear here automatically.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <th className="py-2.5 px-3 font-semibold">Application ID</th>
                  <th className="py-2.5 px-3 font-semibold">Hospital Name</th>
                  <th className="py-2.5 px-3 font-semibold">Location</th>
                  <th className="py-2.5 px-3 font-semibold">Contact Person</th>
                  <th className="py-2.5 px-3 font-semibold">Beds</th>
                  <th className="py-2.5 px-3 font-semibold">Submitted Date</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EDF6]">
                {filtered.map((app) => (
                  <tr key={app.id} className="hover:bg-[#F4F9FF]/50">
                    <td className="py-3 px-3 font-mono text-[#71839C]">{app.applicationId}</td>
                    <td className="py-3 px-3 font-semibold text-[#102653]">{app.hospitalName}</td>
                    <td className="py-3 px-3 text-[#172B4D]">{app.location}</td>
                    <td className="py-3 px-3 text-[#172B4D]">{app.contactPerson}</td>
                    <td className="py-3 px-3 font-mono text-[#102653]">{app.bedsCount}</td>
                    <td className="py-3 px-3 text-[#71839C]">
                      {new Date(app.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={app.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        to={`/dashboard/applications/${app.applicationId}`}
                        className="inline-flex items-center rounded-lg border border-[#E3EDF6] bg-white px-3 py-1 text-xs font-semibold text-[#3299F5] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
                      >
                        {app.status === 'Approved' ? 'View' : 'Review'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <OnboardHospitalModal open={onboardOpen} onClose={() => setOnboardOpen(false)} onSuccess={loadData} />
    </DashboardLayout>
  );
}

// =========================================================================
// 3. HOSPITAL DIRECTORY + APPROVED HOSPITALS + RIGHT DETAILS DRAWER
// =========================================================================
export function HospitalDirectoryPage({ approvedOnly = false }: { approvedOnly?: boolean }) {
  const { apiFetch } = useAuth();
  const [searchParams] = useSearchParams();
  const [hospitals, setHospitals] = useState<ApprovedHospital[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [planFilter, setPlanFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>(approvedOnly ? 'Active' : 'All');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<ApprovedHospital | null>(null);
  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadHospitals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ hospitals: ApprovedHospital[] }>('/api/super-admin/hospitals');
      setHospitals(res.hospitals);
      setSelectedHospital((prev) => (prev ? res.hospitals.find((h) => h.id === prev.id) || null : null));
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    setStatusFilter(approvedOnly ? 'Active' : 'All');
  }, [approvedOnly]);

  useEffect(() => {
    loadHospitals();
  }, [loadHospitals]);

  const handleUpdateHospital = async (
    hospitalId: string,
    updates: { subscriptionPlan?: SubscriptionPlan; workspaceStatus?: 'Active' | 'Suspended' }
  ) => {
    const res = await apiFetch<{ hospital: ApprovedHospital }>(`/api/super-admin/hospitals/${hospitalId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    setSelectedHospital(res.hospital);
    setHospitals((prev) => prev.map((h) => (h.id === res.hospital.id ? res.hospital : h)));
  };

  const filtered = hospitals.filter((h) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      h.hospitalName.toLowerCase().includes(q) ||
      h.hospitalId.toLowerCase().includes(q) ||
      h.location.toLowerCase().includes(q) ||
      h.administratorName.toLowerCase().includes(q);
    const matchesPlan = planFilter === 'All' || h.subscriptionPlan === planFilter;
    const matchesStatus = statusFilter === 'All' || h.workspaceStatus === statusFilter;
    return matchesSearch && matchesPlan && matchesStatus;
  });

  const handleExportCsv = () => {
    const headers = ['Hospital ID', 'Hospital Name', 'Location', 'Administrator', 'Email', 'Subscription', 'Workspace Status'];
    const rows = filtered.map((h) => [
      h.hospitalId,
      `"${h.hospitalName.replace(/"/g, '""')}"`,
      `"${h.location.replace(/"/g, '""')}"`,
      `"${h.administratorName.replace(/"/g, '""')}"`,
      h.administratorEmail,
      h.subscriptionPlan,
      h.workspaceStatus,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `careos-hospitals-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout
      title={approvedOnly ? 'Approved Hospitals' : 'Hospital Directory'}
      breadcrumb={approvedOnly ? 'Approved Hospitals' : 'Hospital Directory'}
      subtitle={
        approvedOnly
          ? 'Active CareOS hospital organizations and provisioned multi-department workspaces.'
          : 'Complete registry of CareOS hospital organizations, administrators, plans, and workspace statuses.'
      }
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
      actions={
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#71839C]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hospitals..."
              className="h-9 w-52 rounded-xl border border-[#E3EDF6] bg-white pl-9 pr-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersOpen((prev) => !prev)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E3EDF6] bg-white px-3.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
          >
            <Filter className="h-3.5 w-3.5 text-[#71839C]" />
            Filters
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#E3EDF6] bg-white px-3.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF] disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5 text-[#71839C]" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setOnboardOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#3299F5] px-4 text-xs font-semibold text-white hover:bg-[#2383db]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Hospital
          </button>
        </div>
      }
    >
      {filtersOpen && (
        <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-[#E3EDF6] bg-white p-4 text-xs">
          <div>
            <span className="font-semibold text-[#102653] mr-2">Subscription:</span>
            {['All', 'Starter', 'Pro', 'Enterprise'].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlanFilter(p)}
                className={cn(
                  'mr-1.5 rounded-lg px-2.5 py-1 font-medium',
                  planFilter === p ? 'bg-[#3299F5] text-white' : 'bg-[#F4F9FF] text-[#172B4D]'
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <div>
            <span className="font-semibold text-[#102653] mr-2">Workspace:</span>
            {['All', 'Active', 'Suspended'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'mr-1.5 rounded-lg px-2.5 py-1 font-medium',
                  statusFilter === s ? 'bg-[#102653] text-white' : 'bg-[#F4F9FF] text-[#172B4D]'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div
          className={cn(
            'rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]',
            selectedHospital ? 'lg:col-span-8' : 'lg:col-span-12'
          )}
        >
          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-[#F4F9FF]" />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Building2 className="mx-auto h-8 w-8 text-[#3299F5]/70" />
              <div className="mt-2 text-sm font-semibold text-[#102653]">No hospitals in directory yet</div>
              <p className="mt-1 text-xs text-[#71839C]">
                Approve an incoming application or click Add Hospital to provision a workspace.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                    <th className="py-2.5 px-3 font-semibold">Hospital ID</th>
                    <th className="py-2.5 px-3 font-semibold">Hospital Name</th>
                    <th className="py-2.5 px-3 font-semibold">Location</th>
                    <th className="py-2.5 px-3 font-semibold">Administrator</th>
                    <th className="py-2.5 px-3 font-semibold">Subscription</th>
                    <th className="py-2.5 px-3 font-semibold">Workspace Status</th>
                    <th className="py-2.5 px-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3EDF6]">
                  {filtered.map((h) => {
                    const active = selectedHospital?.id === h.id;
                    return (
                      <tr
                        key={h.id}
                        className={cn('hover:bg-[#F4F9FF]/50', active && 'bg-[#EAF5FF]/50')}
                      >
                        <td className="py-3 px-3 font-mono text-[#71839C]">{h.hospitalId}</td>
                        <td className="py-3 px-3 font-semibold text-[#102653]">{h.hospitalName}</td>
                        <td className="py-3 px-3 text-[#172B4D]">{h.location}</td>
                        <td className="py-3 px-3 text-[#172B4D]">{h.administratorName}</td>
                        <td className="py-3 px-3">
                          <PlanBadge plan={h.subscriptionPlan} />
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={h.workspaceStatus} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedHospital(h)}
                            className="inline-flex items-center rounded-lg border border-[#E3EDF6] bg-white px-3 py-1 text-xs font-semibold text-[#3299F5] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="mt-4 flex items-center justify-between border-t border-[#E3EDF6] pt-3 text-xs text-[#71839C]">
                <span>
                  Showing 1–{filtered.length} of {hospitals.length}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Hospital Details Drawer */}
        {selectedHospital && (
          <div className="lg:col-span-4 rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_6px_24px_rgba(16,38,83,0.06)]">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-[#102653]">
                <Building2 className="h-4 w-4 text-[#3299F5]" />
                Hospital Details
              </div>
              <button
                type="button"
                onClick={() => setSelectedHospital(null)}
                aria-label="Close hospital details"
                className="rounded-md p-1 text-[#71839C] hover:bg-[#F4F9FF]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <HospitalBuildingThumb className="mt-4 h-36 w-full" />

            <div className="mt-4">
              <h3 className="font-display text-lg font-bold text-[#102653]">{selectedHospital.hospitalName}</h3>
              <div className="mt-0.5 font-mono text-xs text-[#71839C]">{selectedHospital.hospitalId}</div>
              <div className="mt-2">
                <StatusBadge status={selectedHospital.workspaceStatus} />
              </div>
            </div>

            <div className="mt-5 border-t border-[#E3EDF6] pt-4">
              <div className="text-xs font-bold text-[#102653]">Overview</div>
              <dl className="mt-3 space-y-2.5 text-xs">
                <div>
                  <dt className="text-[#71839C]">Location</dt>
                  <dd className="font-medium text-[#102653]">{selectedHospital.location}</dd>
                </div>
                <div>
                  <dt className="text-[#71839C]">Administrator</dt>
                  <dd className="font-medium text-[#102653]">{selectedHospital.administratorName}</dd>
                </div>
                <div>
                  <dt className="text-[#71839C]">Subscription Plan</dt>
                  <dd className="mt-1">
                    <select
                      value={selectedHospital.subscriptionPlan}
                      onChange={(e) =>
                        handleUpdateHospital(selectedHospital.hospitalId, {
                          subscriptionPlan: e.target.value as SubscriptionPlan,
                        })
                      }
                      className="h-8 w-full rounded-lg border border-[#E3EDF6] bg-[#F7FAFF] px-2.5 text-xs font-semibold text-[#102653]"
                    >
                      <option value="Starter">Starter ($350/mo)</option>
                      <option value="Pro">Pro ($950/mo)</option>
                      <option value="Enterprise">Enterprise ($2,400/mo)</option>
                    </select>
                  </dd>
                </div>
                <div>
                  <dt className="text-[#71839C]">Workspace Status</dt>
                  <dd className="mt-1 flex items-center justify-between">
                    <StatusBadge status={selectedHospital.workspaceStatus} />
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateHospital(selectedHospital.hospitalId, {
                          workspaceStatus: selectedHospital.workspaceStatus === 'Active' ? 'Suspended' : 'Active',
                        })
                      }
                      className="text-xs font-semibold text-[#3299F5] hover:underline"
                    >
                      {selectedHospital.workspaceStatus === 'Active' ? 'Suspend Workspace' : 'Activate Workspace'}
                    </button>
                  </dd>
                </div>
              </dl>

              <button
                type="button"
                onClick={() => setFullProfileOpen(true)}
                className="mt-5 w-full rounded-xl bg-[#3299F5] py-2.5 text-xs font-semibold text-white hover:bg-[#2383db]"
              >
                View Full Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {fullProfileOpen && selectedHospital && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <div>
                <h3 className="font-display text-lg font-bold text-[#102653]">{selectedHospital.hospitalName}</h3>
                <div className="font-mono text-xs text-[#71839C]">
                  {selectedHospital.hospitalId} · Application {selectedHospital.applicationId}
                </div>
              </div>
              <button type="button" onClick={() => setFullProfileOpen(false)} className="rounded-md p-1 text-[#71839C]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-xs">
              <div>
                <dt className="text-[#71839C]">Hospital Type</dt>
                <dd className="font-semibold text-[#102653]">{selectedHospital.hospitalType}</dd>
              </div>
              <div>
                <dt className="text-[#71839C]">Capacity</dt>
                <dd className="font-mono font-semibold text-[#102653]">
                  {selectedHospital.bedsCount} beds · {selectedHospital.departmentsCount} depts
                </dd>
              </div>
              <div>
                <dt className="text-[#71839C]">Administrator Email</dt>
                <dd className="font-medium text-[#3299F5] break-all">{selectedHospital.administratorEmail}</dd>
              </div>
              <div>
                <dt className="text-[#71839C]">Phone</dt>
                <dd className="font-mono text-[#172B4D]">{selectedHospital.phone}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[#71839C]">Address</dt>
                <dd className="font-medium text-[#102653]">{selectedHospital.address}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      <OnboardHospitalModal open={onboardOpen} onClose={() => setOnboardOpen(false)} onSuccess={loadHospitals} />
    </DashboardLayout>
  );
}

// =========================================================================
// 4. USER MANAGEMENT, SUBSCRIPTIONS & BILLING, AUDIT LOGS
// =========================================================================
export function SuperAdminUsersPage() {
  const { apiFetch } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ users: AuthUser[] }>('/api/admin/users');
      setUsers(res.users);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const updateUser = async (id: string, patch: { role?: UserRole; status?: 'active' | 'pending' | 'suspended' }) => {
    await apiFetch(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    await loadUsers();
  };

  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.hospitalName.toLowerCase().includes(q)
    );
  });

  return (
    <DashboardLayout
      title="User Management"
      breadcrumb="User Management"
      subtitle="Manage hospital administrators, clinical coordinators, roles, and workspace access."
      searchValue={searchQuery}
      onSearchChange={setSearchQuery}
    >
      <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-[#F4F9FF]" />
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#71839C]">
            No registered hospital accounts yet. Accounts appear as hospitals sign up for CareOS.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <th className="py-2.5 px-3 font-semibold">User</th>
                  <th className="py-2.5 px-3 font-semibold">Hospital</th>
                  <th className="py-2.5 px-3 font-semibold">Role</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EDF6]">
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#102653]">{u.fullName}</div>
                      <div className="text-[#71839C]">{u.email}</div>
                    </td>
                    <td className="py-3 px-3 text-[#172B4D]">
                      <div>{u.hospitalName}</div>
                      {u.hospitalId && <div className="font-mono text-[11px] text-[#3299F5]">{u.hospitalId}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => updateUser(u.id, { role: e.target.value as UserRole })}
                        className="h-8 rounded-lg border border-[#E3EDF6] bg-white px-2 text-xs text-[#102653]"
                      >
                        <option value="coordinator">coordinator</option>
                        <option value="clinician">clinician</option>
                        <option value="operator">operator</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-3">
                      <select
                        value={u.status}
                        onChange={(e) => updateUser(u.id, { status: e.target.value as 'active' | 'pending' | 'suspended' })}
                        className="h-8 rounded-lg border border-[#E3EDF6] bg-white px-2 text-xs text-[#102653]"
                      >
                        <option value="pending">pending</option>
                        <option value="active">active</option>
                        <option value="suspended">suspended</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#71839C]">{formatTimeAgo(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export function SubscriptionsBillingPage() {
  const { apiFetch } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ subscriptions: SubscriptionRecord[] }>('/api/super-admin/subscriptions');
      setSubscriptions(res.subscriptions);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadSubs();
  }, [loadSubs]);

  const mrr = subscriptions.filter((s) => s.status === 'Active').reduce((sum, s) => sum + s.monthlyPriceUsd, 0);
  const totalSeats = subscriptions.filter((s) => s.status === 'Active').reduce((sum, s) => sum + s.seatsIncluded, 0);

  return (
    <DashboardLayout
      title="Subscriptions & Billing"
      breadcrumb="Subscriptions & Billing"
      subtitle="Track active hospital subscriptions, seat allocations, and monthly recurring billing."
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
          <div className="text-xs font-medium text-[#71839C]">Monthly Recurring Revenue</div>
          <div className="mt-1 font-display text-2xl font-bold text-[#102653] tabular-nums">
            ${mrr.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
          <div className="text-xs font-medium text-[#71839C]">Active Subscriptions</div>
          <div className="mt-1 font-display text-2xl font-bold text-[#3299F5] tabular-nums">
            {subscriptions.filter((s) => s.status === 'Active').length}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5">
          <div className="text-xs font-medium text-[#71839C]">Licensed Clinical Seats</div>
          <div className="mt-1 font-display text-2xl font-bold text-[#102653] tabular-nums">{totalSeats}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-[#F4F9FF]" />
        ) : subscriptions.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#71839C]">
            No active hospital subscriptions yet. Subscriptions are generated automatically when hospitals are approved.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <th className="py-2.5 px-3 font-semibold">Hospital ID</th>
                  <th className="py-2.5 px-3 font-semibold">Hospital Name</th>
                  <th className="py-2.5 px-3 font-semibold">Plan</th>
                  <th className="py-2.5 px-3 font-semibold">Seats</th>
                  <th className="py-2.5 px-3 font-semibold">Monthly Rate</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EDF6]">
                {subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="py-3 px-3 font-mono text-[#71839C]">{sub.hospitalId}</td>
                    <td className="py-3 px-3 font-semibold text-[#102653]">{sub.hospitalName}</td>
                    <td className="py-3 px-3">
                      <PlanBadge plan={sub.plan} />
                    </td>
                    <td className="py-3 px-3 font-mono text-[#172B4D]">{sub.seatsIncluded}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-[#102653]">${sub.monthlyPriceUsd}/mo</td>
                    <td className="py-3 px-3">
                      <StatusBadge status={sub.status} />
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#71839C]">
                      {new Date(sub.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export function AuditLogsPage() {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ logs: AuditLogEntry[] }>('/api/admin/audit-logs')
      .then((res) => setLogs(res.logs))
      .finally(() => setLoading(false));
  }, [apiFetch]);

  return (
    <DashboardLayout
      title="Audit Logs"
      breadcrumb="Audit Logs"
      subtitle="Immutable record of authentication events, hospital approvals, role updates, and workspace actions."
    >
      <div className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-[0_2px_10px_rgba(16,38,83,0.03)]">
        {loading ? (
          <div className="h-44 animate-pulse rounded-xl bg-[#F4F9FF]" />
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#71839C]">No audit entries recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-3 font-semibold">Actor</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Resource</th>
                  <th className="py-2.5 px-3 text-right font-semibold">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EDF6]">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2.5 px-3 font-mono text-[#71839C]">{formatTimeAgo(log.timestamp)}</td>
                    <td className="py-2.5 px-3 text-[#102653]">
                      {log.actorEmail} <span className="text-[#71839C]">({log.actorRole})</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[#172B4D]">{log.action}</td>
                    <td className="py-2.5 px-3 text-[#71839C]">{log.resource}</td>
                    <td
                      className={cn(
                        'py-2.5 px-3 text-right font-semibold',
                        log.outcome === 'Allowed' ? 'text-emerald-600' : 'text-red-600'
                      )}
                    >
                      {log.outcome}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
