import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  Scan,
  Send,
  Users,
  X,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import { readFileAsDataUrl } from '../../lib/files';
import type { DoctorQueueItem } from '../../types/careos';
import { cn, formatTimeAgo } from '../../lib/utils';

function liveWaitMinutes(item: DoctorQueueItem): number {
  const stamp = item.queueJoinedAt || item.createdAt;
  const computed = stamp
    ? Math.max(0, Math.floor((Date.now() - new Date(stamp).getTime()) / 60000))
    : 0;
  return Math.max(item.waitingMinutes || 0, computed);
}

export function DoctorQueuePage() {
  const { apiFetch } = useAuth();
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [doctorFilter, setDoctorFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const [rxTarget, setRxTarget] = useState<DoctorQueueItem | null>(null);
  const [diagnosis, setDiagnosis] = useState('');
  const [medications, setMedications] = useState('');
  const [instructions, setInstructions] = useState('');
  const [rxFileName, setRxFileName] = useState('');
  const [rxFileData, setRxFileData] = useState('');
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxError, setRxError] = useState<string | null>(null);

  const [referTarget, setReferTarget] = useState<DoctorQueueItem | null>(null);
  const [examType, setExamType] = useState('X-Ray');
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState<'Routine' | 'Urgent' | 'STAT'>('Routine');
  const [referSubmitting, setReferSubmitting] = useState(false);
  const [referError, setReferError] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const query = doctorFilter ? `?doctor=${encodeURIComponent(doctorFilter)}` : '';
        const res = await apiFetch<{ queue: DoctorQueueItem[]; doctors: string[] }>(`/api/doctor/queue${query}`);
        setQueue(res.queue);
        setDoctors(res.doctors);
        setError(null);
      } catch (err) {
        if (!quiet) setError(err instanceof Error ? err.message : 'Unable to load the doctor queue.');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [apiFetch, doctorFilter]
  );

  useEffect(() => {
    load();
    const poll = window.setInterval(() => load(true), 8000);
    return () => window.clearInterval(poll);
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const checkIn = async (item: DoctorQueueItem) => {
    try {
      await apiFetch(`/api/appointments/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'Checked In' }),
      });
      setSuccess(`${item.patientName} checked in. Waiting time is now running.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to check in patient.');
    }
  };

  const openPrescription = (item: DoctorQueueItem) => {
    setRxTarget(item);
    setDiagnosis('');
    setMedications('');
    setInstructions(item.notes || '');
    setRxFileName('');
    setRxFileData('');
    setRxError(null);
  };

  const openReferral = (item: DoctorQueueItem) => {
    setReferTarget(item);
    setExamType('X-Ray');
    setReason(item.notes || '');
    setPriority('Routine');
    setReferError(null);
  };

  const handlePrescriptionFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const attachment = await readFileAsDataUrl(file);
      setRxFileName(attachment.fileName);
      setRxFileData(attachment.fileData);
      setRxError(null);
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Unable to attach file.');
    }
  };

  const submitPrescription = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rxTarget) return;
    setRxSubmitting(true);
    setRxError(null);
    try {
      await apiFetch(`/api/appointments/${rxTarget.id}/prescription`, {
        method: 'POST',
        body: JSON.stringify({
          diagnosis: diagnosis.trim(),
          medications: medications.trim(),
          instructions: instructions.trim(),
          fileName: rxFileName || undefined,
          fileData: rxFileData || undefined,
        }),
      });
      setRxTarget(null);
      setSuccess(`Prescription uploaded for ${rxTarget.patientName}. It is now visible in the patient portal.`);
      await load();
    } catch (err) {
      setRxError(err instanceof Error ? err.message : 'Unable to upload prescription.');
    } finally {
      setRxSubmitting(false);
    }
  };

  const submitReferral = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!referTarget) return;
    setReferSubmitting(true);
    setReferError(null);
    try {
      const res = await apiFetch<{ order: { id: string } }>(`/api/appointments/${referTarget.id}/refer-radiology`, {
        method: 'POST',
        body: JSON.stringify({ examType: examType.trim(), reason: reason.trim(), priority }),
      });
      setReferTarget(null);
      setSuccess(`${examType} referral ${res.order.id} sent to the radiology dashboard.`);
      await load();
    } catch (err) {
      setReferError(err instanceof Error ? err.message : 'Unable to send radiology referral.');
    } finally {
      setReferSubmitting(false);
    }
  };

  // `tick` forces the live wait labels to recalculate even between polls.
  void tick;

  return (
    <DashboardLayout
      title="Doctor Queue"
      breadcrumb="Clinical Care / Doctor Queue"
      subtitle="Live patient queue with waiting time, prescriptions, and radiology referrals."
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Active patients</div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#102653]">
              <Users className="h-5 w-5 text-[#3299F5]" />
              {queue.length}
            </div>
          </div>
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Longest wait</div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#102653]">
              <Clock className="h-5 w-5 text-[#B45309]" />
              {queue.length ? Math.max(...queue.map(liveWaitMinutes)) : 0} min
            </div>
          </div>
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-4">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">Radiology referrals</div>
            <div className="mt-1 flex items-center gap-2 font-display text-2xl font-bold text-[#102653]">
              <Scan className="h-5 w-5 text-[#3299F5]" />
              {queue.filter((item) => item.radiologyOrder && item.radiologyOrder.status !== 'Completed').length}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E3EDF6] bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#102653]">
            <CalendarClock className="h-4 w-4 text-[#3299F5]" />
            Patient Queue ({queue.length})
          </div>
          <select
            value={doctorFilter}
            onChange={(event) => setDoctorFilter(event.target.value)}
            className="h-9 rounded-lg border border-[#E3EDF6] bg-white px-3 text-xs text-[#334663]"
          >
            <option value="">All doctors</option>
            {doctors.map((doctor) => (
              <option key={doctor} value={doctor}>
                {doctor}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-xl border border-[#E3EDF6] bg-white" />
        ) : queue.length === 0 ? (
          <div className="rounded-xl border border-[#E3EDF6] bg-white p-10 text-center text-sm text-[#71839C]">
            No active patients in this queue. Book an appointment or check in from the Appointments page.
          </div>
        ) : (
          <div className="space-y-3">
            {queue.map((item, index) => {
              const wait = liveWaitMinutes(item);
              return (
                <article key={item.id} className="rounded-xl border border-[#E3EDF6] bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF5FF] text-xs font-bold text-[#3299F5]">
                        {index + 1}
                      </span>
                      <div>
                        <div className="text-sm font-bold text-[#102653]">{item.patientName}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#71839C]">
                          {item.mrn} · {item.patient?.age || '—'} yrs · {item.patient?.gender || '—'}
                        </div>
                        <div className="mt-1 text-xs text-[#4F627D]">
                          {item.doctorName} · {item.department} · {item.type}
                        </div>
                        {item.patient?.phone && item.patient.phone !== 'Not provided' && (
                          <div className="mt-0.5 text-[11px] text-[#71839C]">{item.patient.phone}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-bold',
                          wait >= 30 ? 'bg-red-50 text-red-600' : wait >= 15 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                        )}
                      >
                        {wait} min waiting
                      </div>
                      <span className="rounded-full bg-[#F4F9FF] px-2.5 py-1 text-[11px] font-semibold text-[#334663]">
                        {item.status}
                      </span>
                      <span className="text-[10px] text-[#9AAAC0]">{formatTimeAgo(item.createdAt || item.date)}</span>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="mt-3 rounded-lg bg-[#F7FAFF] p-2.5 text-[11px] text-[#4F627D]">Note: {item.notes}</p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#E3EDF6] pt-3">
                    {item.status === 'Scheduled' && (
                      <button
                        type="button"
                        onClick={() => checkIn(item)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E3EDF6] px-3 text-xs font-semibold text-[#102653] hover:bg-[#EAF5FF]"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Check In
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openPrescription(item)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#3299F5] px-3 text-xs font-semibold text-white hover:bg-[#2383db]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      {item.prescription ? 'Update Prescription' : 'Upload Prescription'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openReferral(item)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E3EDF6] px-3 text-xs font-semibold text-[#334663] hover:bg-[#F4F9FF]"
                    >
                      <Scan className="h-3.5 w-3.5" />
                      {item.radiologyOrder ? `X-Ray ${item.radiologyOrder.id}` : 'Refer to Radiology'}
                    </button>
                    {item.prescription && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> Synced to portal
                      </span>
                    )}
                    {item.radiologyOrder?.report && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" /> X-ray report ready
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Prescription modal */}
      {rxTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E3EDF6] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#102653]">Upload Prescription</h2>
                <p className="mt-0.5 text-xs text-[#71839C]">
                  {rxTarget.patientName} · {rxTarget.mrn} · {rxTarget.doctorName}
                </p>
              </div>
              <button type="button" onClick={() => setRxTarget(null)} className="p-1 text-[#71839C]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {rxError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {rxError}
              </div>
            )}
            <form onSubmit={submitPrescription} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#102653]">Diagnosis</label>
                <input
                  value={diagnosis}
                  onChange={(event) => setDiagnosis(event.target.value)}
                  placeholder="e.g. Acute bronchitis"
                  className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#102653]">Medications & dosage</label>
                <textarea
                  value={medications}
                  onChange={(event) => setMedications(event.target.value)}
                  rows={3}
                  placeholder="e.g. Amoxicillin 500mg — 1 tablet three times daily for 5 days"
                  className="mt-1 w-full rounded-lg border border-[#E3EDF6] p-3 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#102653]">Instructions</label>
                <input
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  placeholder="Follow-up after 5 days"
                  className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] px-3 text-sm"
                />
              </div>
              <label className="block cursor-pointer rounded-xl border border-dashed border-[#B7D8F5] bg-[#F7FBFF] p-3">
                <span className="flex items-center gap-2 text-xs font-semibold text-[#3299F5]">
                  <FileText className="h-4 w-4" />
                  {rxFileName || 'Attach prescription file (optional)'}
                </span>
                <input type="file" accept=".txt,.pdf,.png,.jpg,.jpeg,image/*" onChange={handlePrescriptionFile} className="mt-2 w-full text-[11px]" />
              </label>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setRxTarget(null)} className="rounded-lg border border-[#E3EDF6] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rxSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3299F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {rxSubmitting ? 'Uploading...' : 'Upload to Portal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Radiology referral modal */}
      {referTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E3EDF6] pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-[#102653]">Refer to Radiology</h2>
                <p className="mt-0.5 text-xs text-[#71839C]">
                  {referTarget.patientName} · MRN {referTarget.mrn}
                </p>
              </div>
              <button type="button" onClick={() => setReferTarget(null)} className="p-1 text-[#71839C]">
                <X className="h-5 w-5" />
              </button>
            </div>
            {referError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {referError}
              </div>
            )}
            <form onSubmit={submitReferral} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#102653]">Examination</label>
                  <select
                    value={examType}
                    onChange={(event) => setExamType(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] bg-white px-2.5 text-sm"
                  >
                    <option>X-Ray</option>
                    <option>Chest X-Ray</option>
                    <option>CT Scan</option>
                    <option>MRI</option>
                    <option>Ultrasound</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#102653]">Priority</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as typeof priority)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] bg-white px-2.5 text-sm"
                  >
                    <option>Routine</option>
                    <option>Urgent</option>
                    <option>STAT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#102653]">Reason / clinical notes</label>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Suspected fracture — please evaluate"
                  className="mt-1 w-full rounded-lg border border-[#E3EDF6] p-3 text-sm"
                />
              </div>
              <div className="rounded-lg bg-[#F7FAFF] p-3 text-[11px] text-[#71839C]">
                This creates a live order in the radiology dashboard with the full patient details. Uploading the X-ray there
                will automatically add a $150.00 patient bill and sync the report to this queue and the patient portal.
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setReferTarget(null)} className="rounded-lg border border-[#E3EDF6] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={referSubmitting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3299F5] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Scan className="h-4 w-4" />
                  {referSubmitting ? 'Sending...' : 'Send Referral'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
