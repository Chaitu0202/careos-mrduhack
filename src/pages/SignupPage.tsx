import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Eye, EyeOff, Lock, Mail, Phone, User } from 'lucide-react';
import { CareOSLogo } from '../components/CareOSLogo';
import { useAuth } from '../context/AuthContext';
import type { AuthUser } from '../types/careos';

export function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [hospitalType, setHospitalType] = useState('Multi-Specialty Hospital');
  const [contactNumber, setContactNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUser, setCreatedUser] = useState<AuthUser | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !workEmail.trim() || !hospitalName.trim() || !contactNumber.trim()) {
      setError('Please complete all required organization and contact fields.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms and Privacy Policy.');
      return;
    }

    setLoading(true);
    try {
      const user = await signup({
        fullName: fullName.trim(),
        workEmail: workEmail.trim(),
        password,
        hospitalName: hospitalName.trim(),
        hospitalType,
        contactNumber: contactNumber.trim(),
        agreedToTerms,
      });
      setCreatedUser(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Account creation failed.');
    } finally {
      setLoading(false);
    }
  };

  if (createdUser) {
    return (
      <div className="min-h-screen bg-[#F4F9FF] flex flex-col justify-center px-4 py-12 sm:px-6">
        <div className="mx-auto w-full max-w-[520px] rounded-2xl border border-[#E3EDF6] bg-white p-8 shadow-[0_18px_48px_rgba(16,38,83,0.08)]">
          <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-5">
            <CareOSLogo variant="compact" />
            <span className="text-xs font-semibold text-[#3299F5]">Organization Onboarding</span>
          </div>

          <div className="mt-6 flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-[#3299F5]" />
            <div>
              <h1 className="font-display text-2xl font-bold text-[#102653]">
                Workspace Ready for {createdUser.hospitalName}
              </h1>
              <p className="mt-1.5 text-sm text-[#71839C]">
                Your account ({createdUser.email}) has been provisioned with{' '}
                <span className="font-medium text-[#102653]">Care Coordinator</span> access.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3 rounded-xl border border-[#E3EDF6] bg-[#F4F9FF] p-5 text-sm">
            <div className="font-semibold text-[#102653]">Initial Onboarding Checklist</div>
            <div className="flex items-center gap-2.5 text-[#172B4D]">
              <CheckCircle2 className="h-4 w-4 text-[#3299F5]" />
              <span>Organization profile configured ({createdUser.hospitalType})</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#172B4D]">
              <CheckCircle2 className="h-4 w-4 text-[#3299F5]" />
              <span>Sample hospital operational dataset loaded for exploration</span>
            </div>
            <div className="flex items-center gap-2.5 text-[#172B4D]">
              <CheckCircle2 className="h-4 w-4 text-[#3299F5]" />
              <span>All 6 CareOS AI agents active under human oversight policy</span>
            </div>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/dashboard', { replace: true })}
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#3299F5] px-6 text-sm font-semibold text-white hover:bg-[#2383db]"
            >
              Launch CareOS Dashboard
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F9FF] flex flex-col justify-center px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-[490px]">
        <div className="relative overflow-hidden rounded-2xl border border-[#E3EDF6] bg-white p-7 sm:p-9 shadow-[0_18px_48px_rgba(16,38,83,0.08)]">
          {/* Soft Ice-Blue Curved Corner Accents */}
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

            <div className="mt-6">
              <h1 className="font-display text-[1.7rem] font-bold tracking-tight text-[#102653]">
                Create your CareOS account
              </h1>
              <p className="mt-1 text-sm text-[#71839C]">
                Bring your hospital operations together with CareOS.
              </p>
            </div>

            {error && (
              <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-3.5" noValidate>
              <div>
                <label htmlFor="signup-name" className="block text-xs font-semibold text-[#102653]">
                  Full name
                </label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="signup-name"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E3EDF6] pl-10 pr-3.5 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="Dr. Jordan Patel"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-email" className="block text-xs font-semibold text-[#102653]">
                  Work email
                </label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="signup-email"
                    type="email"
                    required
                    value={workEmail}
                    onChange={(e) => setWorkEmail(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E3EDF6] pl-10 pr-3.5 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="you@hospital.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="signup-hospital" className="block text-xs font-semibold text-[#102653]">
                    Hospital / Organization name
                  </label>
                  <div className="relative mt-1">
                    <Building2 className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                    <input
                      id="signup-hospital"
                      required
                      value={hospitalName}
                      onChange={(e) => setHospitalName(e.target.value)}
                      className="h-10 w-full rounded-lg border border-[#E3EDF6] pl-10 pr-3 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                      placeholder="City General Hospital"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="signup-type" className="block text-xs font-semibold text-[#102653]">
                    Hospital type
                  </label>
                  <select
                    id="signup-type"
                    value={hospitalType}
                    onChange={(e) => setHospitalType(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#E3EDF6] bg-white px-3 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                  >
                    <option>Multi-Specialty Hospital</option>
                    <option>Academic Medical Center</option>
                    <option>Community Hospital</option>
                    <option>Specialty Clinic Network</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="signup-phone" className="block text-xs font-semibold text-[#102653]">
                  Contact number
                </label>
                <div className="relative mt-1">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="signup-phone"
                    type="tel"
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E3EDF6] pl-10 pr-3.5 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="+1 (415) 555-0190"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="signup-password" className="block text-xs font-semibold text-[#102653]">
                  Password
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="signup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E3EDF6] pl-10 pr-10 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#71839C]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="signup-confirm" className="block text-xs font-semibold text-[#102653]">
                  Confirm password
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71839C]" />
                  <input
                    id="signup-confirm"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-10 w-full rounded-lg border border-[#E3EDF6] pl-10 pr-3.5 text-sm text-[#172B4D] placeholder:text-[#71839C]/70 focus:border-[#3299F5] focus:outline-none"
                    placeholder="Confirm your password"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 pt-1 text-xs text-[#71839C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-[#E3EDF6] text-[#3299F5] focus:ring-[#3299F5]"
                />
                <span>
                  I agree to the <span className="font-semibold text-[#3299F5]">Terms</span> and{' '}
                  <span className="font-semibold text-[#3299F5]">Privacy Policy</span>
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-[#3299F5] px-4 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(50,153,245,0.28)] transition-colors hover:bg-[#2383db] disabled:opacity-60"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center text-xs text-[#71839C]">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-[#3299F5] hover:text-[#102653]">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
