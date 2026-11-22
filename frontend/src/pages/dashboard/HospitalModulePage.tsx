import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Activity,
  Banknote,
  Box,
  CheckCircle2,
  FlaskConical,
  Megaphone,
  Pill,
  Plus,
  Scan,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { HospitalModuleKey, HospitalModuleRecord } from '@/shared/types/careos';
import { cn, formatTimeAgo } from '../../lib/utils';

interface ModuleMeta {
  title: string;
  breadcrumb: string;
  subtitle: string;
  itemNoun: string;
  titlePlaceholder: string;
  subtitlePlaceholder: string;
  metricLabel: string;
  metricPlaceholder: string;
  icon: typeof Scan;
}

const MODULE_META: Record<HospitalModuleKey, ModuleMeta> = {
  radiology: {
    title: 'Radiology & Imaging',
    breadcrumb: 'Clinical Management / Radiology',
    subtitle: 'RIS, PACS, and DICOM imaging orders synchronized with the CareOS Intelligence Core.',
    itemNoun: 'Imaging Order',
    titlePlaceholder: 'e.g., Brain MRI Contrast Scan',
    subtitlePlaceholder: 'e.g., Patient MRN-10002 · Neuro Wing',
    metricLabel: 'Modality / Study',
    metricPlaceholder: 'CT / MRI / X-Ray',
    icon: Scan,
  },
  laboratory: {
    title: 'Laboratory Diagnostics',
    breadcrumb: 'Clinical Management / Laboratory',
    subtitle: 'Pathology panels, specimen tracking, and automated diagnostic reporting.',
    itemNoun: 'Lab Panel',
    titlePlaceholder: 'e.g., Complete Metabolic Panel',
    subtitlePlaceholder: 'e.g., Urgent ER Sample · Dr. Rao',
    metricLabel: 'Sample / Turnaround',
    metricPlaceholder: 'Stat 45m',
    icon: FlaskConical,
  },
  pharmacy: {
    title: 'Pharmacy & Dispensary',
    breadcrumb: 'Clinical Management / Pharmacy',
    subtitle: 'Inpatient & outpatient medication dispensing, formulary checks, and fulfillment.',
    itemNoun: 'Dispense Order',
    titlePlaceholder: 'e.g., Inpatient Ward B Prescription Batch',
    subtitlePlaceholder: 'e.g., Verified by Clinical Pharmacist',
    metricLabel: 'Units / Dosage',
    metricPlaceholder: '14 units',
    icon: Pill,
  },
  billing: {
    title: 'Finance & Billing',
    breadcrumb: 'Administration / Finance & Billing',
    subtitle: 'Hospital invoicing, payment reconciliation, and revenue cycle automation.',
    itemNoun: 'Invoice / Transaction',
    titlePlaceholder: 'e.g., Inpatient Discharge Settlement',
    subtitlePlaceholder: 'e.g., Surgical Ward · Razorpay Settlement',
    metricLabel: 'Amount',
    metricPlaceholder: '$1,450',
    icon: Banknote,
  },
  insurance: {
    title: 'Insurance & Claims',
    breadcrumb: 'Administration / Insurance & Claims',
    subtitle: 'TPA pre-authorization, claims verification, and discharge clearance coordination.',
    itemNoun: 'Insurance Claim',
    titlePlaceholder: 'e.g., Pre-Authorization #TPA-882',
    subtitlePlaceholder: 'e.g., Cardiac Procedure Coverage',
    metricLabel: 'Claim Value',
    metricPlaceholder: '$4,200',
    icon: ShieldCheck,
  },
  inventory: {
    title: 'Hospital Inventory',
    breadcrumb: 'Administration / Inventory',
    subtitle: 'Clinical consumables, surgical kits, and automated stock threshold alerts.',
    itemNoun: 'Inventory Item',
    titlePlaceholder: 'e.g., Sterile Surgical Glove Pack',
    subtitlePlaceholder: 'e.g., Central Supply Room A',
    metricLabel: 'Quantity',
    metricPlaceholder: '240 boxes',
    icon: Box,
  },
  sales: {
    title: 'Sales & Corporate Leads',
    breadcrumb: 'Growth & Marketing / Sales & Leads',
    subtitle: 'Corporate health partnerships, referral physician outreach, and CRM pipeline.',
    itemNoun: 'Lead / Partnership',
    titlePlaceholder: 'e.g., Corporate Wellness Checkup Tie-Up',
    subtitlePlaceholder: 'e.g., TechPark Employer Group (450 lives)',
    metricLabel: 'Est. Value',
    metricPlaceholder: '450 enrollees',
    icon: TrendingUp,
  },
  marketing: {
    title: 'Marketing Campaigns & Analytics',
    breadcrumb: 'Growth & Marketing / Campaigns',
    subtitle: 'Preventive care campaigns, patient outreach channels, and engagement attribution.',
    itemNoun: 'Campaign',
    titlePlaceholder: 'e.g., Annual Preventive Heart Screening Drive',
    subtitlePlaceholder: 'e.g., Multi-channel community outreach',
    metricLabel: 'Reach / Leads',
    metricPlaceholder: '0 leads',
    icon: Megaphone,
  },
};

const VALID_MODULES = Object.keys(MODULE_META) as HospitalModuleKey[];

export function HospitalModulePage() {
  const { module: paramModule } = useParams<{ module: string }>();
  const modKey: HospitalModuleKey = VALID_MODULES.includes(paramModule as HospitalModuleKey)
    ? (paramModule as HospitalModuleKey)
    : 'radiology';
  const meta = MODULE_META[modKey];
  const Icon = meta.icon;

  const { apiFetch } = useAuth();
  const [records, setRecords] = useState<HospitalModuleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [status, setStatus] = useState<HospitalModuleRecord['status']>('Active');
  const [amountOrCount, setAmountOrCount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<{ records: HospitalModuleRecord[] }>(`/api/hospital/modules/${modKey}`);
      setRecords(res.records);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Unable to load module records.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, modKey]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setErr(null);
    try {
      await apiFetch(`/api/hospital/modules/${modKey}`, {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          status,
          amountOrCount: amountOrCount.trim() || undefined,
        }),
      });
      setTitle('');
      setSubtitle('');
      setAmountOrCount('');
      setStatus('Active');
      await loadRecords();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Unable to create entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id: string, nextStatus: HospitalModuleRecord['status']) => {
    await apiFetch(`/api/hospital/modules/${modKey}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadRecords();
  };

  const filtered = records.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.referenceCode.toLowerCase().includes(search.toLowerCase()) ||
      r.subtitle.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout
      title={meta.title}
      breadcrumb={meta.breadcrumb}
      subtitle={meta.subtitle}
      searchValue={search}
      onSearchChange={setSearch}
    >
      {err && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{err}</div>}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Create Form */}
        <div className="lg:col-span-4 rounded-2xl border border-[#E3EDF6] bg-white p-5 h-fit">
          <div className="flex items-center gap-2.5 border-b border-[#E3EDF6] pb-3.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold text-[#102653]">New {meta.itemNoun}</h2>
              <p className="text-[11px] text-[#71839C]">Updates Central Dashboard metrics live</p>
            </div>
          </div>

          <form onSubmit={handleCreate} className="mt-4 space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-[#102653]">Title *</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={meta.titlePlaceholder}
                className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#102653]">Details / Reference</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={meta.subtitlePlaceholder}
                className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#102653]">{meta.metricLabel}</label>
                <input
                  value={amountOrCount}
                  onChange={(e) => setAmountOrCount(e.target.value)}
                  placeholder={meta.metricPlaceholder}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#102653]">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as HospitalModuleRecord['status'])}
                  className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] bg-white px-2.5 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                >
                  <option value="Active">Active</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Completed">Completed</option>
                  <option value="Flagged">Flagged</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3299F5] text-xs font-semibold text-white transition-colors hover:bg-[#2383db] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {submitting ? 'Saving...' : `Add ${meta.itemNoun}`}
            </button>
          </form>
        </div>

        {/* Live Records Table */}
        <div className="lg:col-span-8 rounded-2xl border border-[#E3EDF6] bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E3EDF6] pb-3.5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#3299F5]" />
              <h2 className="font-display text-sm font-bold text-[#102653]">
                Live {meta.title} Queue ({filtered.length})
              </h2>
            </div>
            <span className="text-[11px] font-medium text-[#71839C]">
              Pending/Flagged entries surface in Needs Your Attention
            </span>
          </div>

          {loading ? (
            <div className="mt-4 h-48 animate-pulse rounded-xl bg-[#F7FAFF]" />
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Icon className="mx-auto h-8 w-8 text-[#62C5F5]" />
              <p className="mt-3 text-sm font-semibold text-[#102653]">No {meta.title.toLowerCase()} records yet</p>
              <p className="mt-1 text-xs text-[#71839C]">
                Create your first {meta.itemNoun.toLowerCase()} using the form to update live hospital metrics.
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E3EDF6] text-[#71839C]">
                    <th className="py-2.5 pr-3 font-medium">Ref ID</th>
                    <th className="py-2.5 px-3 font-medium">Item</th>
                    <th className="py-2.5 px-3 font-medium">{meta.metricLabel}</th>
                    <th className="py-2.5 px-3 font-medium">Status</th>
                    <th className="py-2.5 pl-3 text-right font-medium">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3EDF6]">
                  {filtered.map((rec) => (
                    <tr key={rec.id} className="hover:bg-[#F7FAFF]">
                      <td className="py-3 pr-3 font-mono font-semibold text-[#3299F5] whitespace-nowrap">
                        {rec.referenceCode}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-[#102653]">{rec.title}</div>
                        <div className="text-[11px] text-[#71839C]">
                          {rec.subtitle || 'Workspace entry'} · {formatTimeAgo(rec.createdAt)}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono text-[#172B4D] whitespace-nowrap">
                        {rec.amountOrCount || '—'}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold',
                            rec.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : rec.status === 'Flagged'
                              ? 'bg-red-50 text-red-700'
                              : rec.status === 'Pending Review'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-[#EAF5FF] text-[#3299F5]'
                          )}
                        >
                          {rec.status}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {rec.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(rec.id, 'Completed')}
                              className="inline-flex items-center gap-1 rounded-lg border border-[#E3EDF6] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#102653] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Complete
                            </button>
                          )}
                          {rec.status !== 'Pending Review' && rec.status !== 'Completed' && (
                            <button
                              type="button"
                              onClick={() => handleStatusChange(rec.id, 'Pending Review')}
                              className="rounded-lg border border-[#E3EDF6] bg-white px-2 py-1 text-[11px] font-medium text-[#71839C] hover:text-[#102653]"
                            >
                              Flag Review
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
