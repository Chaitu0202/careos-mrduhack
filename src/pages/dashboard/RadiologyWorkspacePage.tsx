import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Scan,
  Send,
  UserRound,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { isImageDataUrl, readFileAsDataUrl } from '../../lib/files';
import type { RadiologyOrderRecord } from '../../types/careos';
import { cn, formatTimeAgo } from '../../lib/utils';

function orderWait(order: RadiologyOrderRecord): number {
  const computed = Math.max(0, Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 60000));
  return Math.max(order.waitingMinutes || 0, computed);
}

export function RadiologyWorkspacePage() {
  const { apiFetch } = useAuth();
  const [orders, setOrders] = useState<RadiologyOrderRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileData, setFileData] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const res = await apiFetch<{ orders: RadiologyOrderRecord[] }>('/api/radiology/orders');
        setOrders(res.orders);
        setSelectedId((current) => current || res.orders[0]?.id || null);
        setError(null);
      } catch (err) {
        if (!quiet) setError(err instanceof Error ? err.message : 'Unable to load radiology orders.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    load();
    const timer = window.setInterval(() => load(true), 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  const selected = orders.find((order) => order.id === selectedId) || null;

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const attachment = await readFileAsDataUrl(file);
      setFileName(attachment.fileName);
      setFileData(attachment.fileData);
      setUploadError(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to attach X-ray file.');
    }
  };

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setUploading(true);
    setUploadError(null);
    try {
      const res = await apiFetch<{ order: RadiologyOrderRecord; bill: { id: string; amount: number } }>(
        `/api/radiology/orders/${selected.id}/report`,
        {
          method: 'POST',
          body: JSON.stringify({
            findings: findings.trim(),
            impression: impression.trim(),
            fileName: fileName || undefined,
            fileData: fileData || undefined,
            uploadedBy: 'Radiology Department',
          }),
        }
      );
      setFindings('');
      setImpression('');
      setFileName('');
      setFileData('');
      setSuccess(
        `Report uploaded for ${selected.patientName}. Bill ${res.bill.id} ($${res.bill.amount.toFixed(2)}) was added and synced to the patient and doctor dashboards.`
      );
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Unable to upload X-ray report.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <DashboardLayout
      title="Radiology Workspace"
      breadcrumb="Clinical Care / Radiology"
      subtitle="Doctor referrals, complete patient details, X-ray upload, and automatic patient billing."
      actions={
        <button
          type="button"
          onClick={() => load()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E3EDF6] px-3 text-xs font-semibold text-[#334663] hover:bg-[#F4F9FF]"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      }
    >
      <div className="space-y-5">
        {success && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{success}</span>
            <button type="button" onClick={() => setSuccess(null)} className="font-bold">
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Total orders</div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#102653]">
              <Scan className="h-5 w-5 text-[#3299F5]" />
              {orders.length}
            </div>
          </div>
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Awaiting report</div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#102653]">
              <Clock className="h-5 w-5 text-[#B45309]" />
              {orders.filter((order) => order.status !== 'Completed').length}
            </div>
          </div>
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Bills generated</div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#102653]">
              <Banknote className="h-5 w-5 text-[#3299F5]" />
              {orders.filter((order) => order.billId).length}
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* Order list */}
          <section className="rounded-xl border border-[#E3EDF6] bg-white p-4">
            <h2 className="font-display text-sm font-bold text-[#102653]">Referred Patient Orders</h2>
            <div className="mt-3 space-y-2.5">
              {loading ? (
                <div className="h-48 animate-pulse rounded-lg bg-[#F4F9FF]" />
              ) : orders.length === 0 ? (
                <p className="rounded-lg bg-[#F7FAFF] p-4 text-xs text-[#71839C]">
                  No referrals yet. Ask a doctor to use “Refer to Radiology” from the Doctor Queue.
                </p>
              ) : (
                orders.map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => setSelectedId(order.id)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-colors',
                      selectedId === order.id
                        ? 'border-[#3299F5] bg-[#EAF5FF]'
                        : 'border-[#E3EDF6] bg-white hover:bg-[#F7FAFF]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-[#102653]">{order.patientName}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          order.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-amber-50 text-amber-700'
                        )}
                      >
                        {order.status}
                      </span>
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-[#71839C]">
                      {order.id} · MRN {order.mrn}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[#4F627D]">
                      <span>{order.examType}</span>
                      <span className="text-[#9AAAC0]">·</span>
                      <span>{order.priority}</span>
                      <span className="text-[#9AAAC0]">·</span>
                      <span>{orderWait(order)} min</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          {/* Patient detail + report upload */}
          <section className="rounded-xl border border-[#E3EDF6] bg-white p-5">
            {!selected ? (
              <div className="flex h-full min-h-64 flex-col items-center justify-center text-center text-sm text-[#71839C]">
                <UserRound className="h-8 w-8 text-[#B7D8F5]" />
                <p className="mt-3">Select a referral to view full patient details.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-[#E3EDF6] pb-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Radiology order</div>
                    <h2 className="mt-1 font-display text-lg font-bold text-[#102653]">
                      {selected.examType} · {selected.patientName}
                    </h2>
                    <p className="mt-1 font-mono text-[11px] text-[#71839C]">
                      {selected.id} · created {formatTimeAgo(selected.createdAt)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[10px] font-bold',
                      selected.priority === 'STAT'
                        ? 'bg-red-50 text-red-600'
                        : selected.priority === 'Urgent'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-[#EAF5FF] text-[#3299F5]'
                    )}
                  >
                    {selected.priority}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    ['MRN', selected.mrn],
                    ['Department', selected.department],
                    ['Referred by', selected.doctorName],
                    ['Appointment', selected.appointmentId],
                    ['Priority', selected.priority],
                    ['Waiting', `${orderWait(selected)} minutes`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[#E3EDF6] bg-[#F7FAFF] p-2.5">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">{label}</div>
                      <div className="mt-0.5 text-xs font-semibold text-[#102653]">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-lg border border-[#E3EDF6] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Clinical reason</div>
                  <p className="mt-1 text-xs text-[#4F627D]">{selected.reason || 'No additional notes provided.'}</p>
                </div>

                {selected.report && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4" />
                      Report completed · synced to patient & doctor
                    </div>
                    <p className="mt-2 text-xs text-[#4F627D]">
                      <span className="font-semibold text-[#102653]">Findings:</span> {selected.report.findings}
                    </p>
                    <p className="mt-1 text-xs text-[#4F627D]">
                      <span className="font-semibold text-[#102653]">Impression:</span> {selected.report.impression}
                    </p>
                    {selected.report.fileData && (
                      <div className="mt-3 overflow-hidden rounded-lg border border-[#E3EDF6] bg-white">
                        {isImageDataUrl(selected.report.fileData) && (
                          <img
                            src={selected.report.fileData}
                            alt={selected.report.fileName || 'X-ray'}
                            className="max-h-56 w-full object-contain"
                          />
                        )}
                        <a
                          href={selected.report.fileData}
                          download={selected.report.fileName || 'xray-report'}
                          className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[#3299F5]"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          {selected.report.fileName || 'Open X-ray file'}
                        </a>
                      </div>
                    )}
                    {selected.billId && (
                      <Link
                        to="/dashboard/module/billing"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[10px] font-semibold text-[#B45309]"
                      >
                        <Banknote className="h-3 w-3" />
                        Patient bill {selected.billId} · $150.00
                      </Link>
                    )}
                  </div>
                )}

                {selected.status !== 'Completed' && (
                  <form onSubmit={submitReport} className="mt-4 border-t border-[#E3EDF6] pt-4">
                    <h3 className="font-display text-sm font-bold text-[#102653]">Upload X-ray / Report</h3>
                    {uploadError && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {uploadError}
                      </div>
                    )}
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#102653]">Findings</label>
                        <textarea
                          value={findings}
                          onChange={(event) => setFindings(event.target.value)}
                          rows={2}
                          placeholder="Describe the radiological findings"
                          className="mt-1 w-full rounded-lg border border-[#E3EDF6] p-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#102653]">Impression</label>
                        <input
                          value={impression}
                          onChange={(event) => setImpression(event.target.value)}
                          placeholder="e.g. No acute fracture"
                          className="mt-1 h-9 w-full rounded-lg border border-[#E3EDF6] px-3 text-xs"
                        />
                      </div>
                      <label className="block cursor-pointer rounded-xl border border-dashed border-[#B7D8F5] bg-[#F7FBFF] p-3">
                        <span className="flex items-center gap-2 text-xs font-semibold text-[#3299F5]">
                          <FileText className="h-4 w-4" />
                          {fileName || 'Attach X-ray image / report (optional)'}
                        </span>
                        <input type="file" accept="image/*,.pdf,.txt" onChange={handleFile} className="mt-2 w-full text-[11px]" />
                      </label>
                      <div className="rounded-lg bg-[#F7FAFF] p-2.5 text-[11px] text-[#71839C]">
                        Uploading immediately marks the order complete, pushes the report to the patient portal and doctor
                        queue, and logs a $150.00 X-ray bill in patient billing.
                      </div>
                      <button
                        type="submit"
                        disabled={uploading}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#3299F5] px-4 text-xs font-semibold text-white hover:bg-[#2383db] disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
                        {uploading ? 'Uploading...' : 'Upload & Sync Report'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
