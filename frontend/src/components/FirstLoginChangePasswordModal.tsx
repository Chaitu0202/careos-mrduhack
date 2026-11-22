import React, { useState } from 'react';
import { AlertCircle, Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/** Shared first-login password gate used by hospital dashboards and the patient portal. */
export function FirstLoginChangePasswordModal({ contextLabel = 'Dashboard' }: { contextLabel?: string }) {
  const { user, changeDefaultPassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('Please choose a new password different from the default password.'
      );
      return;
    }
    setSubmitting(true);
    try {
      await changeDefaultPassword(currentPassword, newPassword);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#102653]/55 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-password-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
        <div className="flex items-start gap-3.5 border-b border-[#E3EDF6] pb-4">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 id="force-password-title" className="font-display text-lg font-bold text-[#102653]">
              Change Your Default Password
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-[#71839C]">
              Welcome to <span className="font-semibold text-[#102653]">{user?.hospitalName}</span>. For security,
              please verify your default password and set a private password before continuing to your {contextLabel}.
            </p>
          </div>
        </div>

        {user?.applicationId && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-[#E3EDF6] bg-[#F7FAFF] px-3.5 py-2.5 text-xs">
            <span className="text-[#71839C]">Hospital Username (App ID)</span>
            <span className="font-mono font-bold text-[#3299F5]">{user.applicationId}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label htmlFor="default-pass-input" className="block text-xs font-semibold text-[#102653]">
              Default / Current Password
            </label>
            <div className="relative mt-1">
              <input
                id="default-pass-input"
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter default onboarding password"
                className="h-10 w-full rounded-xl border border-[#E3EDF6] px-3.5 pr-10 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                aria-label="Toggle default password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71839C] hover:text-[#102653]"
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="new-pass-input" className="block text-xs font-semibold text-[#102653]">
              New Password (min. 8 characters)
            </label>
            <div className="relative mt-1">
              <input
                id="new-pass-input"
                type={showNew ? 'text' : 'password'}
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Create a strong password"
                className="h-10 w-full rounded-xl border border-[#E3EDF6] px-3.5 pr-10 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                aria-label="Toggle new password visibility"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71839C] hover:text-[#102653]"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="confirm-pass-input" className="block text-xs font-semibold text-[#102653]">
              Confirm New Password
            </label>
            <input
              id="confirm-pass-input"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="mt-1 h-10 w-full rounded-xl border border-[#E3EDF6] px-3.5 text-xs text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#3299F5] text-xs font-semibold text-white transition-colors hover:bg-[#2383db] disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            {submitting ? 'Updating Password...' : `Update Password & Unlock ${contextLabel}`}
          </button>
        </form>
      </div>
    </div>
  );
}
