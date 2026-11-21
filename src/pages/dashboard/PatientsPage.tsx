import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, Plus, Search, User, X } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { AppointmentRecord, PatientRecord } from '../../types/careos';
import { cn } from '../../lib/utils';

export function PatientsPage() {
  const { apiFetch } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'records' ? 'records' : 'registry';

  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  // Registration state
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('42');
  const [gender, setGender] = useState<'Female' | 'Male' | 'Other'>('Female');
  const [department, setDepartment] = useState('Cardiology');
  const [attendingDoctor, setAttendingDoctor] = useState('Dr. Marcus Chen');
  const [admissionStatus, setAdmissionStatus] = useState<PatientRecord['admissionStatus']>('Outpatient');
  const [phone, setPhone] = useState('');
  const [medicalSummary, setMedicalSummary] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [patRes, aptRes] = await Promise.all([
        apiFetch<{ patients: PatientRecord[] }>('/api/patients'),
        apiFetch<{ appointments: AppointmentRecord[] }>('/api/appointments'),
      ]);
      setPatients(patRes.patients);
      setAppointments(aptRes.appointments);
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiFetch<{ patient: PatientRecord }>('/api/patients', {
      method: 'POST',
      body: JSON.stringify({
        fullName,
        age: Number(age),
        gender,
        department,
        attendingDoctor,
        admissionStatus,
        phone,
        medicalSummary,
      }),
    });
    setShowRegister(false);
    setFullName('');
    setPhone('');
    setMedicalSummary('');
    setSelectedPatient(res.patient);
    await loadData();
  };

  const handleUpdateAdmission = async (patientId: string, nextStatus: PatientRecord['admissionStatus']) => {
    const res = await apiFetch<{ patient: PatientRecord }>(`/api/patients/${patientId}`, {
      method: 'PATCH',
      body: JSON.stringify({ admissionStatus: nextStatus }),
    });
    setSelectedPatient(res.patient);
    await loadData();
  };

  const filtered = patients.filter((p) => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.mrn.toLowerCase().includes(search.toLowerCase()) ||
      p.department.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || p.admissionStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const patientAppointments = selectedPatient
    ? appointments.filter((a) => a.patientId === selectedPatient.id || a.mrn === selectedPatient.mrn)
    : [];

  return (
    <DashboardLayout
      title={activeTab === 'records' ? 'Medical Records' : 'Patients'}
      breadcrumb={activeTab === 'records' ? 'Information / Medical Records' : 'Hospital Operations / Patients'}
      actions={
        <button
          type="button"
          onClick={() => setShowRegister(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#3299F5] px-3.5 text-xs font-semibold text-white hover:bg-[#2383db] whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          Register Sample Patient
        </button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E3EDF6] bg-[#F4F9FF] px-4 py-3 text-xs text-[#102653]">
        <span>
          <strong>Demonstration Dataset Notice:</strong> Records below are synthetic sample patients for workflow verification and never represent real clinical records.
        </span>
        <div className="flex items-center gap-1 rounded-md border border-[#E3EDF6] bg-white p-0.5">
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              activeTab === 'registry' ? 'bg-[#EAF5FF] text-[#102653]' : 'text-[#71839C]'
            )}
          >
            Patient Registry
          </button>
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'records' })}
            className={cn(
              'rounded px-2.5 py-1 text-xs font-medium',
              activeTab === 'records' ? 'bg-[#EAF5FF] text-[#102653]' : 'text-[#71839C]'
            )}
          >
            Authorized Medical Summaries
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, MRN, or department..."
            className="h-10 w-full rounded-md border border-[#E3EDF6] pl-9 pr-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#E3EDF6] bg-[#F4F9FF] p-0.5">
          {['All', 'Admitted', 'ICU Observation', 'Outpatient', 'Pre-Admission', 'Discharged'].map((st) => (
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

      {/* Registry or Records View */}
      {loading ? (
        <div className="h-64 animate-pulse rounded-lg border border-[#E3EDF6] bg-[#F4F9FF]" />
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-[#E3EDF6] bg-white p-12 text-center">
          <p className="text-sm text-[#71839C]">No sample patient records match your current search or filter.</p>
        </div>
      ) : activeTab === 'records' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-lg border border-[#E3EDF6] bg-white p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-[#3299F5]">{p.mrn} · Sample Record</div>
                  <h3 className="mt-1 font-display text-base font-bold text-[#102653]">{p.fullName}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPatient(p)}
                  className="inline-flex items-center gap-1 rounded border border-[#E3EDF6] px-2.5 py-1 text-xs font-medium text-[#102653] hover:bg-[#F4F9FF]"
                >
                  <FileText className="h-3.5 w-3.5 text-[#3299F5]" />
                  Open Profile
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[#172B4D]">{p.medicalSummary}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#E3EDF6] pt-3 text-xs text-[#71839C]">
                <span>Attending: {p.attendingDoctor}</span>
                <span>·</span>
                <span>Allergies: {p.allergies.join(', ')}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E3EDF6] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E3EDF6] bg-[#F4F9FF] text-xs text-[#71839C]">
              <tr>
                <th className="px-4 py-3 font-semibold">MRN</th>
                <th className="px-4 py-3 font-semibold">Patient (Sample)</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Attending</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 text-right font-semibold">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E3EDF6]">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#F4F9FF]/50">
                  <td className="px-4 py-3 font-mono text-xs text-[#102653] tabular-nums">{p.mrn}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#102653]">{p.fullName}</div>
                    <div className="text-xs text-[#71839C]">
                      {p.age} yrs · {p.gender}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#172B4D]">{p.department}</td>
                  <td className="px-4 py-3 text-xs text-[#172B4D]">{p.attendingDoctor}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-[#3299F5]">{p.admissionStatus}</td>
                  <td className="px-4 py-3 text-xs text-[#71839C]">{p.wardBed}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedPatient(p)}
                      className="rounded border border-[#E3EDF6] px-2.5 py-1 text-xs font-medium text-[#102653] hover:border-[#3299F5] hover:bg-[#EAF5FF]"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patient Profile Drawer */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#102653]/35" role="dialog" aria-modal="true">
          <div className="h-full w-full max-w-lg overflow-y-auto border-l border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#E3EDF6] pb-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF5FF] text-[#102653]">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-mono text-xs text-[#3299F5]">{selectedPatient.mrn} · Sample Profile</div>
                  <h2 className="font-display text-xl font-bold text-[#102653]">{selectedPatient.fullName}</h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                aria-label="Close patient profile"
                className="rounded-md p-1.5 text-[#71839C] hover:bg-[#F4F9FF]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-sm">
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-[#E3EDF6] bg-[#F4F9FF] p-4">
                <div>
                  <div className="text-xs text-[#71839C]">Age / Gender</div>
                  <div className="font-medium text-[#102653]">{selectedPatient.age} yrs · {selectedPatient.gender}</div>
                </div>
                <div>
                  <div className="text-xs text-[#71839C]">Department</div>
                  <div className="font-medium text-[#102653]">{selectedPatient.department}</div>
                </div>
                <div>
                  <div className="text-xs text-[#71839C]">Phone</div>
                  <div className="font-mono text-xs text-[#172B4D]">{selectedPatient.phone}</div>
                </div>
                <div>
                  <div className="text-xs text-[#71839C]">Location / Ward</div>
                  <div className="font-medium text-[#102653]">{selectedPatient.wardBed}</div>
                </div>
              </div>

              <div>
                <label htmlFor="patient-status-select" className="block text-xs font-semibold text-[#102653]">
                  Admission Status
                </label>
                <select
                  id="patient-status-select"
                  value={selectedPatient.admissionStatus}
                  onChange={(e) => handleUpdateAdmission(selectedPatient.id, e.target.value as PatientRecord['admissionStatus'])}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-3 text-sm text-[#102653]"
                >
                  <option>Outpatient</option>
                  <option>Pre-Admission</option>
                  <option>Admitted</option>
                  <option>ICU Observation</option>
                  <option>Discharged</option>
                </select>
              </div>

              <div className="rounded-lg border border-[#E3EDF6] p-4">
                <div className="text-xs font-semibold text-[#102653]">Authorized Medical History Summary</div>
                <p className="mt-2 text-sm leading-relaxed text-[#172B4D]">{selectedPatient.medicalSummary}</p>
                <div className="mt-3 border-t border-[#E3EDF6] pt-2.5 text-xs text-[#71839C]">
                  Reported Allergies: <span className="font-medium text-[#102653]">{selectedPatient.allergies.join(', ')}</span>
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-[#102653] mb-2">Appointment History</div>
                {patientAppointments.length === 0 ? (
                  <p className="text-xs text-[#71839C]">No scheduled appointments for this sample patient.</p>
                ) : (
                  <div className="space-y-2">
                    {patientAppointments.map((a) => (
                      <div key={a.id} className="rounded-md border border-[#E3EDF6] p-3 text-xs">
                        <div className="flex justify-between font-medium text-[#102653]">
                          <span>{a.date} · {a.time} ({a.type})</span>
                          <span className="text-[#3299F5]">{a.status}</span>
                        </div>
                        <div className="mt-1 text-[#71839C]">{a.doctorName} · {a.notes}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register Sample Patient Modal */}
      {showRegister && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <h2 className="font-display text-lg font-bold text-[#102653]">Register Sample Patient</h2>
              <button type="button" onClick={() => setShowRegister(false)} className="p-1 text-[#71839C]">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleRegister} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Full Name</label>
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                    placeholder="Sample Patient Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Age & Gender</label>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="h-10 w-20 rounded-md border border-[#E3EDF6] px-3 text-sm"
                    />
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value as 'Female' | 'Male' | 'Other')}
                      className="h-10 flex-1 rounded-md border border-[#E3EDF6] bg-white px-2 text-sm"
                    >
                      <option>Female</option>
                      <option>Male</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Department</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-3 text-sm"
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
                  <label className="block text-xs font-medium text-[#102653]">Attending Physician</label>
                  <input
                    required
                    value={attendingDoctor}
                    onChange={(e) => setAttendingDoctor(e.target.value)}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Admission Status</label>
                  <select
                    value={admissionStatus}
                    onChange={(e) => setAdmissionStatus(e.target.value as PatientRecord['admissionStatus'])}
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] bg-white px-3 text-sm"
                  >
                    <option>Outpatient</option>
                    <option>Pre-Admission</option>
                    <option>Admitted</option>
                    <option>ICU Observation</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#102653]">Contact Phone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (415) 555-0199"
                    className="mt-1 h-10 w-full rounded-md border border-[#E3EDF6] px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#102653]">Clinical Intake Summary</label>
                <textarea
                  rows={2}
                  value={medicalSummary}
                  onChange={(e) => setMedicalSummary(e.target.value)}
                  className="mt-1 w-full rounded-md border border-[#E3EDF6] p-3 text-sm"
                  placeholder="Initial reason for visit or intake summary..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="rounded-md border border-[#E3EDF6] px-4 py-2 text-sm font-medium text-[#102653]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-[#102653] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1b3a78]"
                >
                  Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
