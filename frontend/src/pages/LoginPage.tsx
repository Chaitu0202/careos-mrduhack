import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, ShieldCheck } from 'lucide-react';
import { CareOSLogo } from '../components/CareOSLogo';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'patient' ? '/patient-portal' : '/dashboard'} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please enter your email, Application ID, or patient portal ID and password.');
      return;
    }
    setLoading(true);
    try {
      const signedInUser = await login(email.trim(), password, rememberMe);
      navigate(signedInUser.role === 'patient' ? '/patient-portal' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid credentials.');
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
                Welcome back
              </h1>
              <p className="mt-1 text-sm text-[#71839C]">
                Sign in with your Application ID, work email, or patient portal ID.
              </p>
            </div>

            {error && (
              <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="mt-6 space-y-4" noValidate>
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#102653]">
                  Email / Application ID / Patient ID
                </label>
                <div className="relative mt-1.5">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="login-email"
                    type="text"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#E3EDF6] bg-white pl-10 pr-3.5 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="you@hospital.com, APP-2026-1001, or PAT-2026-0001"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-[#102653]">
                  Password
                </label>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[#E3EDF6] bg-white pl-10 pr-10 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#71839C] hover:text-[#102653]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 text-xs text-[#71839C] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-[#E3EDF6] text-[#3299F5] focus:ring-[#3299F5]"
                  />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-xs font-medium text-[#3299F5] hover:text-[#102653]">
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#3299F5] px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(50,153,245,0.28)] transition-colors hover:bg-[#2383db] disabled:opacity-60"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            <div className="mt-7 text-center text-xs text-[#71839C]">
              New to CareOS?{' '}
              <Link to="/signup" className="font-semibold text-[#3299F5] hover:text-[#102653]">
                Create an account
              </Link>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-[#71839C]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#3299F5]" />
              <span>Your workspace is protected with secure authentication.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
