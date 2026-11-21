import React, { useCallback, useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Plus, X } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { AppointmentRecord, StaffMember } from '../../types/careos';
import { cn } from '../../lib/utils';

export function AppointmentsPage() {
  const { apiFetch } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [showBook, setShowBook] = useState(false);

  // Booking form
  const [patientName, setPatientName] = useState('');
  const [doctorName, setDoctorName] = useState('Dr. Marcus Chen');
  const [department, setDepartment] = useState('Cardiology');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('15:00');
  const [type, setType] = useState<AppointmentRecord['type']>('Consultation');
  const [notes, setNotes] = useState('');

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
    await apiFetch('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ patientName, doctorName, department, date, time, type, notes }),
    });
    setShowBook(false);
    setPatientName('');
    setNotes('');
    await loadData();
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
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowBook(false)} className="rounded-md border border-[#E3EDF6] px-4 py-2 text-sm">
                  Cancel
                </button>
                <button type="submit" className="rounded-md bg-[#102653] px-4 py-2 text-sm font-semibold text-white">
                  Confirm Booking
                </button>
              </div>
            </form>
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
