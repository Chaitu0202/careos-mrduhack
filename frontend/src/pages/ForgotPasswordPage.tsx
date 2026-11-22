import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react';
import { CareOSLogo } from '../components/CareOSLogo';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed.');
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F9FF] flex flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[460px]">
        <div className="relative overflow-hidden rounded-2xl border border-[#E3EDF6] bg-white p-7 sm:p-9 shadow-[0_18px_48px_rgba(16,38,83,0.08)]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 -left-12 h-36 w-36 rounded-full bg-[#EAF5FF]/70"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[#EAF5FF]/60"
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4">
              <Link to="/" aria-label="CareOS Homepage">
                <CareOSLogo variant="compact" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3299F5] hover:text-[#102653] transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to website
              </Link>
            </div>

            <div className="mt-7">
              <h1 className="font-display text-[1.75rem] font-bold tracking-tight text-[#102653]">
                Reset password
              </h1>
              <p className="mt-1 text-sm text-[#71839C]">
                Enter your work email address to initiate institutional recovery.
              </p>
            </div>

            {message ? (
              <div className="mt-6 space-y-5 text-center py-2">
                <CheckCircle2 className="mx-auto h-10 w-10 text-[#3299F5]" />
                <p className="text-sm leading-relaxed text-[#172B4D]">{message}</p>
                <Link
                  to="/login"
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#3299F5] px-5 text-sm font-semibold text-white hover:bg-[#2383db]"
                >
                  Return to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{error}</div>
                )}
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-[#102653]">
                    Work email address
                  </label>
                  <div className="relative mt-1.5">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                    <input
                      id="reset-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 w-full rounded-lg border border-[#E3EDF6] bg-white pl-10 pr-3.5 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                      placeholder="you@hospital.com"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#3299F5] px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(50,153,245,0.28)] transition-colors hover:bg-[#2383db] disabled:opacity-60"
                >
                  {loading ? 'Sending...' : 'Request Password Reset'}
                </button>
                <div className="pt-2 text-center">
                  <Link to="/login" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#3299F5] hover:text-[#102653]">
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
