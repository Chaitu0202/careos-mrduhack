import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  LogOut,
  RefreshCw,
  Scan,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { CareOSLogo } from '../components/CareOSLogo';
import { FirstLoginChangePasswordModal } from '../components/FirstLoginChangePasswordModal';
import { useAuth } from '../context/AuthContext';
import { isImageDataUrl } from '../lib/files';
import type { PatientPortalData } from '@/shared/types/careos';

function formatDate(value?: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function AttachmentLink({ fileName, fileData, label }: { fileName?: string; fileData?: string; label: string }) {
  if (!fileData) {
    return fileName ? <span className="text-[11px] text-[#71839C]">{fileName} (text record)</span> : null;
  }
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-[#E3EDF6] bg-[#F7FAFF]">
      {isImageDataUrl(fileData) && (
        <a href={fileData} target="_blank" rel="noreferrer">
          <img src={fileData} alt={fileName || label} className="max-h-48 w-full object-contain" />
        </a>
      )}
      <a
        href={fileData}
        download={fileName || label}
        className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold text-[#3299F5] hover:text-[#102653]"
      >
        <FileText className="h-3.5 w-3.5" />
        {fileName || label}
      </a>
    </div>
  );
}

export function PatientPortalPage() {
  const { user, apiFetch, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<PatientPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const result = await apiFetch<PatientPortalData>('/api/patient/portal');
        setData(result);
        setError(null);
        setUpdatedAt(new Date());
      } catch (err) {
        if (!quiet) setError(err instanceof Error ? err.message : 'Unable to load your portal.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [apiFetch]
  );

  useEffect(() => {
    load();
    // Polling keeps prescriptions, X-ray reports, and bills in sync across dashboards.
    const timer = window.setInterval(() => load(true), 8000);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const latestAppointment = data?.appointments[0];
  const assignedDoctor = latestAppointment?.doctorName || data?.patient.attendingDoctor || 'Assignment pending';
  const pendingTotal = (data?.bills || []).filter((bill) => bill.status === 'Pending').reduce((sum, bill) => sum + bill.amount, 0);

  return (
    <div className="min-h-screen bg-[#F4F9FF] text-[#172B4D]">
      <header className="sticky top-0 z-30 border-b border-[#E3EDF6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <CareOSLogo variant="compact" />
            <span className="hidden border-l border-[#E3EDF6] pl-3 text-xs font-semibold text-[#71839C] sm:inline">
              Patient Portal
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E3EDF6] px-3 text-xs font-medium text-[#334663] hover:bg-[#F4F9FF]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold text-[#102653]">{user?.fullName}</div>
              <div className="font-mono text-[10px] text-[#71839C]">{user?.username || data?.patient.portalUsername}</div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E3EDF6] px-3 text-xs font-medium text-[#71839C] hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-[#DCEBFA] bg-gradient-to-br from-white via-[#F7FBFF] to-[#EAF5FF] p-6 shadow-[0_12px_36px_rgba(16,38,83,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF5FF] px-3 py-1 text-[11px] font-semibold text-[#3299F5]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure patient workspace
              </div>
              <h1 className="mt-3 font-display text-2xl font-bold text-[#102653]">
                Hello, {data?.patient.fullName || user?.fullName || 'Patient'}
              </h1>
              <p className="mt-1 text-sm text-[#71839C]">
                MRN <span className="font-mono font-semibold text-[#334663]">{data?.patient.mrn || '—'}</span>
                {' · '}
                {data?.patient.department || 'CareOS'}
              </p>
            </div>
            <div className="rounded-xl border border-[#DCEBFA] bg-white px-4 py-3 shadow-sm">
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Assigned doctor</div>
              <div className="mt-1 flex items-center gap-2 text-sm font-bold text-[#102653]">
                <Stethoscope className="h-4 w-4 text-[#3299F5]" />
                {assignedDoctor}
              </div>
              <div className="mt-1 text-[11px] text-[#71839C]">
                {latestAppointment ? `${latestAppointment.date} at ${latestAppointment.time}` : 'No active appointment yet'}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4 text-[11px] text-[#71839C]">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-[#3299F5]" />
              Live sync active
            </span>
            {updatedAt && <span>Last checked {updatedAt.toLocaleTimeString()}</span>}
          </div>
        </section>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && !data ? (
          <div className="h-64 animate-pulse rounded-2xl border border-[#E3EDF6] bg-white" />
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Appointments */}
              <section className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#102653]">
                    <Calendar className="h-4 w-4 text-[#3299F5]" />
                    My Appointments
                  </h2>
                  <span className="text-[11px] text-[#71839C]">{data?.appointments.length || 0} total</span>
                </div>
                <div className="mt-4 space-y-3">
                  {(data?.appointments || []).length === 0 && (
                    <p className="rounded-xl bg-[#F7FAFF] p-4 text-xs text-[#71839C]">No appointments have been booked yet.</p>
                  )}
                  {(data?.appointments || []).map((apt) => (
                    <div key={apt.id} className="rounded-xl border border-[#E3EDF6] p-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-[#102653]">{apt.doctorName}</div>
                        <span className="rounded-full bg-[#EAF5FF] px-2 py-0.5 text-[10px] font-semibold text-[#3299F5]">
                          {apt.status}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#71839C]">
                        {apt.date} · {apt.time} · {apt.department}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Bills */}
              <section className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#102653]">
                    <FileText className="h-4 w-4 text-[#3299F5]" />
                    My Bills
                  </h2>
                  <span className="text-[11px] font-semibold text-[#B45309]">
                    ${pendingTotal.toFixed(2)} pending
                  </span>
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-[#E3EDF6]">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F4F9FF] text-[10px] uppercase tracking-wider text-[#71839C]">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Description</th>
                        <th className="px-3 py-2 text-right font-semibold">Amount</th>
                        <th className="px-3 py-2 text-right font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E3EDF6]">
                      {(data?.bills || []).length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-3 py-4 text-center text-[#71839C]">
                            No patient bills yet.
                          </td>
                        </tr>
                      )}
                      {(data?.bills || []).map((bill) => (
                        <tr key={bill.id}>
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-[#102653]">{bill.description}</div>
                            <div className="font-mono text-[10px] text-[#71839C]">{bill.id}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-[#102653]">${bill.amount.toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="rounded-full bg-[#FFF7ED] px-2 py-0.5 text-[10px] font-semibold text-[#B45309]">
                              {bill.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* Prescriptions */}
            <section className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#102653]">
                <FileText className="h-4 w-4 text-[#3299F5]" />
                Prescriptions from Your Doctor
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(data?.prescriptions || []).length === 0 && (
                  <p className="rounded-xl bg-[#F7FAFF] p-4 text-xs text-[#71839C] md:col-span-2">
                    Your doctor has not uploaded a prescription yet.
                  </p>
                )}
                {(data?.prescriptions || []).map((rx) => (
                  <article key={rx.id} className="rounded-xl border border-[#E3EDF6] p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-bold text-[#102653]">{rx.diagnosis || 'Prescription'}</div>
                      <span className="font-mono text-[10px] text-[#71839C]">{rx.id}</span>
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-[#4F627D]">
                      <p><span className="font-semibold text-[#102653]">Medication:</span> {rx.medications || '—'}</p>
                      <p><span className="font-semibold text-[#102653]">Instructions:</span> {rx.instructions || '—'}</p>
                      <p className="text-[11px] text-[#71839C]">
                        {rx.doctorName} · {formatDate(rx.createdAt)}
                      </p>
                    </div>
                    <AttachmentLink fileName={rx.fileName} fileData={rx.fileData} label="Prescription attachment" />
                  </article>
                ))}
              </div>
            </section>

            {/* Radiology */}
            <section className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#102653]">
                <Scan className="h-4 w-4 text-[#3299F5]" />
                X-Ray & Radiology Reports
              </h2>
              <div className="mt-4 space-y-3">
                {(data?.radiologyOrders || []).length === 0 && (
                  <p className="rounded-xl bg-[#F7FAFF] p-4 text-xs text-[#71839C]">
                    No radiology referrals have been raised yet.
                  </p>
                )}
                {(data?.radiologyOrders || []).map((order) => (
                  <article key={order.id} className="rounded-xl border border-[#E3EDF6] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-bold text-[#102653]">
                        {order.examType} <span className="font-mono text-[10px] text-[#71839C]">· {order.id}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#F4F9FF] px-2 py-0.5 text-[10px] font-semibold text-[#334663]">
                          {order.priority}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            order.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {order.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-[#71839C]">
                      Referred by {order.doctorName} · {formatDate(order.createdAt)}
                    </div>
                    {order.status !== 'Completed' && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#B45309]">
                        <Clock className="h-3.5 w-3.5" />
                        Waiting for radiology report · {order.waitingMinutes} min
                      </div>
                    )}
                    {order.report && (
                      <div className="mt-3 rounded-xl bg-[#F7FAFF] p-3 text-xs text-[#4F627D]">
                        <p><span className="font-semibold text-[#102653]">Findings:</span> {order.report.findings || '—'}</p>
                        <p className="mt-1"><span className="font-semibold text-[#102653]">Impression:</span> {order.report.impression || '—'}</p>
                        <p className="mt-1 text-[11px] text-[#71839C]">
                          Reported by {order.report.uploadedBy} · {formatDate(order.report.uploadedAt)}
                        </p>
                      </div>
                    )}
                    <AttachmentLink
                      fileName={order.report?.fileName}
                      fileData={order.report?.fileData}
                      label="X-ray image"
                    />
                    {order.billId && (
                      <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[10px] font-semibold text-[#B45309]">
                        <CheckCircle2 className="h-3 w-3" />
                        Bill {order.billId} added to your account
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>

            {/* Notifications */}
            <section className="rounded-2xl border border-[#E3EDF6] bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-bold text-[#102653]">
                <Bell className="h-4 w-4 text-[#3299F5]" />
                Care Updates
              </h2>
              <div className="mt-4 space-y-2">
                {(data?.notifications || []).length === 0 && (
                  <p className="rounded-xl bg-[#F7FAFF] p-4 text-xs text-[#71839C]">No updates yet.</p>
                )}
                {(data?.notifications || []).map((note) => (
                  <div key={note.id} className="flex items-start gap-3 rounded-xl border border-[#E3EDF6] p-3">
                    <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#EAF5FF] text-[#3299F5]">
                      <Bell className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#102653]">{note.title}</div>
                      <div className="mt-0.5 text-[11px] text-[#71839C]">{note.detail}</div>
                      <div className="mt-1 text-[10px] text-[#9AAAC0]">{formatDate(note.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>

      {user?.mustChangePassword && <FirstLoginChangePasswordModal contextLabel="Patient Portal" />}
    </div>
  );
}
