import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Building2,
  Check,
  Copy,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { useAuth } from '../../context/AuthContext';
import type { AuthUser, DepartmentRecord, UserRole } from '../../types/careos';
import { cn } from '../../lib/utils';

interface CreatedCredentials {
  label: string;
  departmentId?: string;
  user?: AuthUser;
  defaultUserId?: string;
  temporaryPassword?: string;
}

const inputClass =
  'h-10 w-full rounded-xl border border-[#E3EDF6] bg-white px-3 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none';
const labelClass = 'block text-xs font-semibold text-[#102653]';

export function WorkspaceManagementPage() {
  const { apiFetch, switchWorkspace, user } = useAuth();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState<DepartmentRecord[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);

  const [deptName, setDeptName] = useState('');
  const [deptHead, setDeptHead] = useState('');
  const [deptHeadEmail, setDeptHeadEmail] = useState('');
  const [deptCapacity, setDeptCapacity] = useState('20');
  const [deptError, setDeptError] = useState<string | null>(null);
  const [deptSaving, setDeptSaving] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Exclude<UserRole, 'admin'>>('clinician');
  const [newDepartment, setNewDepartment] = useState('');
  const [newContact, setNewContact] = useState('');
  const [userError, setUserError] = useState<string | null>(null);
  const [userSaving, setUserSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [deptRes, usersRes] = await Promise.all([
        apiFetch<{ departments: DepartmentRecord[] }>('/api/departments'),
        apiFetch<{ users: AuthUser[] }>('/api/hospital/users'),
      ]);
      setDepartments(deptRes.departments);
      setUsers(usersRes.users);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptError(null);
    setCredentials(null);
    if (!deptName.trim()) {
      setDeptError('Department name is required.');
      return;
    }
    setDeptSaving(true);
    try {
      const res = await apiFetch<CreatedCredentials & { department: DepartmentRecord }>('/api/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptName.trim(),
          head: deptHead.trim(),
          headEmail: deptHeadEmail.trim(),
          bedCapacity: Number(deptCapacity) || 20,
        }),
      });
      setCredentials({
        label: `Department ${res.department.name}`,
        departmentId: res.departmentId,
        user: res.user,
        defaultUserId: res.defaultUserId,
        temporaryPassword: res.temporaryPassword,
      });
      setDeptName('');
      setDeptHead('');
      setDeptHeadEmail('');
      setDeptCapacity('20');
      await loadData();
    } catch (err) {
      setDeptError(err instanceof Error ? err.message : 'Unable to create department.');
    } finally {
      setDeptSaving(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setCredentials(null);
    setUserSaving(true);
    try {
      const res = await apiFetch<{ user: AuthUser; defaultUserId?: string; temporaryPassword?: string }>(
        '/api/hospital/users',
        {
          method: 'POST',
          body: JSON.stringify({
            fullName: newName.trim(),
            workEmail: newEmail.trim(),
            role: newRole,
            department: newDepartment,
            contactNumber: newContact.trim(),
          }),
        }
      );
      setCredentials({
        label: res.user.fullName,
        user: res.user,
        defaultUserId: res.defaultUserId ?? res.user.username,
        temporaryPassword: res.temporaryPassword,
      });
      setNewName('');
      setNewEmail('');
      setNewDepartment('');
      setNewContact('');
      await loadData();
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Unable to create user.');
    } finally {
      setUserSaving(false);
    }
  };

  const handleCopy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setCopied(null);
    }
  };

  const handleSwitchTo = async (targetId: string | undefined) => {
    if (!targetId) return;
    setSwitchingTo(targetId);
    try {
      await switchWorkspace(targetId);
      navigate('/dashboard', { replace: true });
    } finally {
      setSwitchingTo(null);
    }
  };

  return (
    <DashboardLayout
      title="User & Department Management"
      breadcrumb="Workspace Administration"
      subtitle="Provision departments and staff accounts with generated sign-in IDs and a temporary password."
      actions={
        <button
          type="button"
          onClick={loadData}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E3EDF6] bg-white px-3.5 text-xs font-semibold text-[#102653] hover:bg-[#F4F9FF]"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-[#3299F5]', loading && 'animate-spin')} />
          Refresh
        </button>
      }
    >
      <div className="space-y-6 pb-10">
        <div className="flex items-start gap-3 rounded-2xl border border-[#D7E9FB] bg-[#EFF7FF] px-5 py-4">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#3299F5]">
            <KeyRound className="h-4 w-4" />
          </span>
          <div className="text-xs leading-relaxed text-[#4F627D]">
            <span className="font-bold text-[#102653]">Default provisioning rules.</span> Every new account receives a
            generated User ID (for example <span className="font-mono font-semibold text-[#3299F5]">USR-2026-0007</span>)
            and the temporary password <span className="font-mono font-semibold text-[#3299F5]">password</span>. Users are
            required to change it the first time they open their dashboard.
          </div>
        </div>

        {loadError && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{loadError}</span>
            <button type="button" onClick={() => void loadData()} className="ml-auto font-bold hover:underline">
              Retry
            </button>
          </div>
        )}

        {credentials && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
              <Check className="h-4 w-4" />
              {credentials.label} created successfully
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {credentials.departmentId && (
                <CredentialTile
                  label="Department ID"
                  value={credentials.departmentId}
                  copyKey="department"
                  copied={copied}
                  onCopy={handleCopy}
                />
              )}
              {credentials.defaultUserId && (
                <CredentialTile
                  label="Generated User ID"
                  value={credentials.defaultUserId}
                  copyKey="userid"
                  copied={copied}
                  onCopy={handleCopy}
                />
              )}
              {credentials.temporaryPassword && (
                <CredentialTile
                  label="Temporary Password"
                  value={credentials.temporaryPassword}
                  copyKey="password"
                  copied={copied}
                  onCopy={handleCopy}
                />
              )}
            </div>
            {credentials.user && (
              <button
                type="button"
                onClick={() => handleSwitchTo(credentials.user?.id)}
                disabled={switchingTo !== null}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#102653] px-4 py-2 text-xs font-semibold text-white hover:bg-[#1b3a78] disabled:opacity-60"
              >
                {switchingTo === credentials.user.id ? 'Opening…' : `Open ${credentials.user.fullName}'s dashboard`}
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Add department */}
          <section className="rounded-2xl border border-[#E3EDF6] bg-white p-6">
            <div className="flex items-center gap-2 border-b border-[#E3EDF6] pb-3">
              <Building2 className="h-4 w-4 text-[#3299F5]" />
              <h2 className="font-display text-base font-bold text-[#102653]">Add a Department</h2>
            </div>
            {deptError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {deptError}
              </div>
            )}
            <form onSubmit={handleCreateDepartment} className="mt-4 space-y-3.5">
              <div>
                <label className={labelClass}>Department name</label>
                <input
                  required
                  value={deptName}
                  onChange={(e) => setDeptName(e.target.value)}
                  placeholder="e.g. Neurology"
                  className={cn(inputClass, 'mt-1')}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Head name (optional)</label>
                  <input
                    value={deptHead}
                    onChange={(e) => setDeptHead(e.target.value)}
                    placeholder="Dr. A. Sharma"
                    className={cn(inputClass, 'mt-1')}
                  />
                </div>
                <div>
                  <label className={labelClass}>Bed capacity</label>
                  <input
                    type="number"
                    min={1}
                    value={deptCapacity}
                    onChange={(e) => setDeptCapacity(e.target.value)}
                    className={cn(inputClass, 'mt-1')}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Head work email (optional)</label>
                <input
                  type="email"
                  value={deptHeadEmail}
                  onChange={(e) => setDeptHeadEmail(e.target.value)}
                  placeholder="head@hospital.com — creates a clinician account automatically"
                  className={cn(inputClass, 'mt-1')}
                />
                <p className="mt-1 text-[11px] text-[#71839C]">
                  Supplying an email also generates a User ID and temporary password for the department head.
                </p>
              </div>
              <button
                type="submit"
                disabled={deptSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#3299F5] px-4 text-xs font-semibold text-white hover:bg-[#2383db] disabled:opacity-60"
              >
                <Building2 className="h-3.5 w-3.5" />
                {deptSaving ? 'Creating…' : 'Create Department'}
              </button>
            </form>
          </section>

          {/* Add user */}
          <section className="rounded-2xl border border-[#E3EDF6] bg-white p-6">
            <div className="flex items-center gap-2 border-b border-[#E3EDF6] pb-3">
              <UserPlus className="h-4 w-4 text-[#3299F5]" />
              <h2 className="font-display text-base font-bold text-[#102653]">Add a User</h2>
            </div>
            {userError && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {userError}
              </div>
            )}
            <form onSubmit={handleCreateUser} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Full name</label>
                  <input
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Dr. Meera Iyer"
                    className={cn(inputClass, 'mt-1')}
                  />
                </div>
                <div>
                  <label className={labelClass}>Work email</label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="meera@hospital.com"
                    className={cn(inputClass, 'mt-1')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Exclude<UserRole, 'admin'>)}
                    className={cn(inputClass, 'mt-1')}
                  >
                    <option value="clinician">Clinician</option>
                    <option value="coordinator">Coordinator</option>
                    <option value="operator">Operator</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Department</label>
                  <select
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className={cn(inputClass, 'mt-1')}
                  >
                    <option value="">No department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={labelClass}>Contact number (optional)</label>
                <input
                  value={newContact}
                  onChange={(e) => setNewContact(e.target.value)}
                  placeholder="+1 555 0100"
                  className={cn(inputClass, 'mt-1')}
                />
              </div>
              <button
                type="submit"
                disabled={userSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#102653] px-4 text-xs font-semibold text-white hover:bg-[#1b3a78] disabled:opacity-60"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {userSaving ? 'Creating…' : 'Create User Account'}
              </button>
            </form>
          </section>
        </div>

        {/* Lists */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-[#E3EDF6] bg-white">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#3299F5]" />
                <h2 className="font-display text-sm font-bold text-[#102653]">Departments</h2>
              </div>
              <span className="text-xs text-[#71839C]">{departments.length} total</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">Department</th>
                    <th className="px-3 py-2.5 font-semibold">ID</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Beds</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3EDF6]">
                  {departments.map((d) => (
                    <tr key={d.id}>
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-[#102653]">{d.name}</div>
                        <div className="text-[11px] text-[#71839C]">{d.head}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#3299F5]">{d.id}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[#172B4D]">{d.bedCapacity}</td>
                    </tr>
                  ))}
                  {departments.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-[#71839C]">
                        No departments yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E3EDF6] bg-white">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] px-5 py-3.5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#3299F5]" />
                <h2 className="font-display text-sm font-bold text-[#102653]">Workspace Users</h2>
              </div>
              <span className="text-xs text-[#71839C]">{users.length} total</span>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-[#E3EDF6] bg-[#F4F9FF] text-[#71839C]">
                  <tr>
                    <th className="px-5 py-2.5 font-semibold">User</th>
                    <th className="px-3 py-2.5 font-semibold">User ID</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3EDF6]">
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="px-5 py-2.5">
                        <div className="font-semibold text-[#102653]">{u.fullName}</div>
                        <div className="text-[11px] text-[#71839C]">{u.email}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#3299F5]">{u.username || '—'}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-[10px] font-semibold',
                            u.mustChangePassword
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          )}
                        >
                          {u.mustChangePassword ? 'Password to change' : u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-[#71839C]">
          <ShieldCheck className="h-3.5 w-3.5 text-[#3299F5]" />
          Signed in as {user?.fullName} ({user?.role}). New accounts appear instantly across dashboards.
        </div>
      </div>
    </DashboardLayout>
  );
}

function CredentialTile({
  label,
  value,
  copyKey,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copyKey: string;
  copied: string | null;
  onCopy: (value: string, key: string) => void;
}) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-white px-3.5 py-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#71839C]">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="font-mono text-sm font-bold text-[#102653]">{value}</span>
        <button
          type="button"
          onClick={() => onCopy(value, copyKey)}
          aria-label={`Copy ${label}`}
          className="rounded-md p-1 text-[#71839C] hover:bg-[#F4F9FF] hover:text-[#3299F5]"
        >
          {copied === copyKey ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
