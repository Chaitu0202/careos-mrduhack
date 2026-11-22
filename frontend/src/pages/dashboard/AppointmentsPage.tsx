import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, CheckCircle2, Copy, Plus, X } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { AppointmentRecord, PatientPortalCredentials, PatientRecord, StaffMember } from '@/shared/types/careos';
import { cn } from '../../lib/utils';

export function AppointmentsPage() {
  const { apiFetch, switchWorkspace } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState(false);

  // Booking form
  const [patientName, setPatientName] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<PatientRecord['gender']>('Other');
  const [doctorName, setDoctorName] = useState('Dr. Marcus Chen');
  const [department, setDepartment] = useState('Cardiology');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('15:00');
  const [type, setType] = useState<AppointmentRecord['type']>('Consultation');
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [portalCredentials, setPortalCredentials] = useState<PatientPortalCredentials | null>(null);
  const [bookedPatient, setBookedPatient] = useState<PatientRecord | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  // Reschedule modal
  const [rescheduleTarget, setRescheduleTarget] = useState<AppointmentRecord | null>(null);
  const [newTime, setNewTime] = useState('16:30');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [aptRes, deptRes] = await Promise.all([
        apiFetch<{ appointments: AppointmentRecord[] }>('/api/appointments'),
        apiFetch<{ staff: StaffMember[] }>('/api/departments'),
      ]);
      setAppointments(aptRes.appointments);
      setStaff(deptRes.staff);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (id: string, status: AppointmentRecord['status']) => {
    await apiFetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await loadData();
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBooking(true);
    setBookError(null);
    try {
      const result = await apiFetch<{
        appointment: AppointmentRecord;
        patient: PatientRecord;
        portalCredentials: PatientPortalCredentials;
      }>('/api/appointments', {
        method: 'POST',
        body: JSON.stringify({
          patientName: patientName.trim(),
          patientEmail: patientEmail.trim(),
          phone: phone.trim(),
          age: age ? Number(age) : undefined,
          gender,
          doctorName,
          department,
          date,
          time,
          type,
          notes,
        }),
      });
      setPortalCredentials(result.portalCredentials);
      setBookedPatient(result.patient);
      setShowBook(false);
      setPatientName('');
      setPatientEmail('');
      setPhone('');
      setAge('');
      setNotes('');
      await loadData();
    } catch (err) {
      setBookError(err instanceof Error ? err.message : 'Unable to book appointment.');
    } finally {
      setBooking(false);
    }
  };

  const copyCredential = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(label);
      window.setTimeout(() => setCopiedField(null), 1600);
    } catch {
      setBookError('Clipboard is unavailable. Please copy the credential manually.');
    }
  };

  const openPatientPortal = async () => {
    if (!portalCredentials) return;
    setOpeningPortal(true);
    setBookError(null);
    try {
      await switchWorkspace(portalCredentials.userId);
      navigate('/patient-portal', { replace: true });
    } catch (err) {
      setBookError(
        `${err instanceof Error ? err.message : 'Unable to open portal.'} You can still sign in at /login with the credentials below.`
      );
    } finally {
      setOpeningPortal(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleTarget) return;
    await apiFetch(`/api/appointments/${rescheduleTarget.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'Rescheduled', time: newTime }),
    });
    setRescheduleTarget(null);
    await loadData();
  };

  const filtered = appointments.filter((a) => statusFilter === 'All' || a.status === statusFilter);

  return (
    <DashboardLayout
      title="Appointments"
      breadcrumb="Hospital Operations / Appointments"
      actions={
        <button
          type="button"
          onClick={() => setShowBook(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#3299F5] px-3.5 text-xs font-semibold text-white hover:bg-[#2383db] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Book Appointment
        </button>
      }
    >
      <div className="space-y-6">
        {/* Doctor Availability Strip */}
        <div className="rounded-lg border border-[#E3EDF6] bg-[#F4F9FF] p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-sm font-bold text-[#102653]">Doctor Availability Today</h2>
            <span className="text-xs text-[#71839C]">Sample clinical roster</span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((doc) => (
              <div key={doc.id} className="rounded-md border border-[#E3EDF6] bg-white px-3.5 py-2.5 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#102653]">{doc.name}</div>
                  <div className="text-xs text-[#71839C]">{doc.department} · {doc.shift}</div>
                </div>
                <span className={cn('text-xs font-semibold', doc.availability === 'On Duty' ? 'text-[#3299F5]' : 'text-[#71839C]')}>
                  {doc.availability}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#102653]">
            <CalendarIcon className="h-4 w-4 text-[#3299F5]" />
            <span>Daily Schedule ({filtered.length})</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#E3EDF6] bg-[#F4F9FF] p-0.5">
            {['All', 'Scheduled', 'Checked In', 'In Progress', 'Completed', 'Rescheduled', 'Cancelled'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium whitespace-nowrap',
                  statusFilter === st ? 'bg-white text-[#102653] shadow-xs' : 'text-[#71839C] hover:text-[#102653]'
                )}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Schedule Table */}
        {loading ? (
          <div className="h-56 animate-pulse rounded-lg border border-[#E3EDF6] bg-[#F4F9FF]" />
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-[#E3EDF6] bg-white p-10 text-center text-sm text-[#71839C]">
            No appointments match this status filter.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#E3EDF6] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-xs text-[#71839C]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date & Time</th>
                  <th className="px-4 py-3 font-semibold">Patient (Sample)</th>
                  <th className="px-4 py-3 font-semibold">Physician & Dept</th>
                  <th className="px-4 py-3 font-semibold">Visit Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3EDF6]">
                {filtered.map((apt) => (
                  <tr key={apt.id} className="hover:bg-[#F4F9FF]/50">
                    <td className="px-4 py-3 font-mono text-xs text-[#102653] tabular-nums">
                      <div>{apt.time}</div>
                      <div className="text-[#71839C]">{apt.date}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#102653]">{apt.patientName}</div>
                      <div className="font-mono text-xs text-[#71839C]">{apt.mrn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-[#172B4D]">{apt.doctorName}</div>
                      <div className="text-xs text-[#71839C]">{apt.department}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#172B4D]">{apt.type}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-[#3299F5]">{apt.status}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {apt.status === 'Scheduled' && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(apt.id, 'Checked In')}
                            className="rounded border border-[#E3EDF6] px-2 py-1 text-xs font-medium text-[#102653] hover:bg-[#EAF5FF]"
                          >
                            Check In
                          </button>
                        )}
                        {(apt.status === 'Checked In' || apt.status === 'In Progress') && (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(apt.id, 'Completed')}
                            className="rounded border border-[#E3EDF6] px-2 py-1 text-xs font-medium text-[#102653] hover:bg-[#EAF5FF]"
                          >
                            Complete
                          </button>
                        )}
                        {apt.status !== 'Completed' && apt.status !== 'Cancelled' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRescheduleTarget(apt);
                                setNewTime(apt.time);
                              }}
                              className="rounded border border-[#E3EDF6] px-2 py-1 text-xs font-medium text-[#71839C] hover:text-[#102653]"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStatusChange(apt.id, 'Cancelled')}
                              className="rounded border border-[#E3EDF6] px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              Cancel
                            </button>
                          </>
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

      {/* Book Appointment Modal */}
      {showBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <h2 className="font-display text-lg font-bold text-[#102653]">Book Sample Appointment</h2>
              <button type="button" onClick={() => setShowBook(false)} className="p-1 text-[#71839C]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleBook} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#102653]">Patient Name</label>
                <input
                  required
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                  placeholder="Eleanor Vance"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Patient Email (optional)</label>
                  <input
                    type="email"
                    value={patientEmail}
                    onChange={(e) => setPatientEmail(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                    placeholder="patient@example.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Phone (optional)</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                    placeholder="9876543210"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Age (optional)</label>
                  <input
                    type="number"
                    min="1"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                    placeholder="32"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as PatientRecord['gender'])}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-2.5 text-sm"
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-2.5 text-sm"
                  >
                    <option>Cardiology</option>
                    <option>Emergency</option>
                    <option>Neurology</option>
                    <option>Orthopedics</option>
                    <option>Pediatrics</option>
                    <option>General Medicine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Doctor</label>
                  <input
                    required
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Date</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Time</label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AppointmentRecord['type'])}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-2 text-xs"
                  >
                    <option>Consultation</option>
                    <option>Follow-up</option>
                    <option>Diagnostic</option>
                    <option>Procedure</option>
                    <option>Telehealth</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#102653]">Notes</label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                  placeholder="Optional pre-visit note..."
                />
              </div>
              {bookError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{bookError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBook(false)} className="rounded-md border border-[#E3EDF6] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" disabled={booking} className="rounded-md bg-[#102653] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {booking ? 'Booking & Creating Portal...' : 'Confirm Booking'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient portal credentials created with the appointment */}
      {portalCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-[#E3EDF6] pb-4">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-lg font-bold text-[#102653]">Patient Portal Credentials</h2>
                  <p className="mt-1 text-xs text-[#71839C]">
                    Appointment booked for <span className="font-semibold text-[#102653]">{bookedPatient?.fullName}</span>
                    {' · MRN '}
                    <span className="font-mono">{bookedPatient?.mrn}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPortalCredentials(null);
                  setBookError(null);
                }}
                className="p-1 text-[#71839C]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { key: 'userId', label: 'Portal User ID', value: portalCredentials.userId },
                { key: 'email', label: 'Portal Email', value: portalCredentials.email },
                ...(portalCredentials.password
                  ? [{ key: 'password', label: 'Temporary Password', value: portalCredentials.password }]
                  : []),
              ].map((credential) => (
                <div
                  key={credential.key}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#9AAAC0]">{credential.label}</div>
                    <div className="mt-0.5 truncate font-mono text-sm font-bold text-[#102653]">{credential.value}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyCredential(credential.key, credential.value)}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#E3EDF6] bg-white px-2.5 text-[11px] font-semibold text-[#3299F5] hover:bg-[#EAF5FF]"
                  >
                    {copiedField === credential.key ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedField === credential.key ? 'Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-[#DCEBFA] bg-[#EAF5FF]/60 p-3 text-[11px] leading-relaxed text-[#4F627D]">
              {portalCredentials.existing
                ? 'This patient already had a portal account, so the existing credentials were reused.'
                : 'A new patient login was created automatically. The patient will be asked to change the temporary password on first sign-in.'}
              {' '}The portal opens only to this patient’s appointments, prescriptions, X-ray reports, and bills.
            </div>

            {bookError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{bookError}</div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPortalCredentials(null);
                  setBookError(null);
                }}
                className="rounded-lg border border-[#E3EDF6] px-4 py-2 text-sm"
              >
                Done
              </button>
              <button
                type="button"
                onClick={openPatientPortal}
                disabled={openingPortal}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#3299F5] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2383db] disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                {openingPortal ? 'Opening Portal...' : 'Open Patient Portal'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <h2 className="font-display text-lg font-bold text-[#102653]">Reschedule Appointment</h2>
            <p className="mt-1 text-xs text-[#71839C]">
              {rescheduleTarget.patientName} · {rescheduleTarget.department}
            </p>
            <form onSubmit={handleReschedule} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#102653]">New Time</label>
                <input
                  type="time"
                  required
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setRescheduleTarget(null)} className="rounded-md border border-[#E3EDF6] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-[#3299F5] px-4 py-2 text-sm font-semibold text-white">
                  Update Time
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
