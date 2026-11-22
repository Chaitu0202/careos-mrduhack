import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { CareOSLogo } from './CareOSLogo';

export function Footer() {
  const [legalDoc, setLegalDoc] = useState<'privacy' | 'terms' | null>(null);

  return (
    <footer className="border-t border-[#E3EDF6] bg-white">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          {/* Left: Logo + Tagline with subtle vertical divider */}
          <div className="flex flex-col gap-2 md:border-r md:border-[#E3EDF6] md:pr-10">
            <Link to="/" aria-label="CareOS Home">
              <CareOSLogo variant="compact" />
            </Link>
            <p className="text-xs text-[#71839C]">One Intelligence. Every Department. Every Patient.</p>
          </div>

          {/* Center: Clean single-row navigation links */}
          <nav className="flex flex-wrap items-center gap-7 text-sm font-medium text-[#102653]" aria-label="Footer Navigation">
            <Link to="/platform" className="hover:text-[#3299F5] transition-colors">Platform</Link>
            <Link to="/solutions" className="hover:text-[#3299F5] transition-colors">Solutions</Link>
            <Link to="/about" className="hover:text-[#3299F5] transition-colors">About</Link>
            <Link to="/contact" className="hover:text-[#3299F5] transition-colors">Contact</Link>
            <button
              type="button"
              onClick={() => setLegalDoc('privacy')}
              className="text-xs font-normal text-[#71839C] hover:text-[#102653] transition-colors"
            >
              Privacy
            </button>
            <button
              type="button"
              onClick={() => setLegalDoc('terms')}
              className="text-xs font-normal text-[#71839C] hover:text-[#102653] transition-colors"
            >
              Terms
            </button>
          </nav>

          {/* Right: Social icons matching reference */}
          <div className="flex items-center gap-2.5">
            <Link
              to="/contact"
              aria-label="CareOS LinkedIn"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E3EDF6] bg-[#F4F9FF] text-[#102653] transition-colors hover:border-[#3299F5] hover:text-[#3299F5]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.94 8.5H3.56V19.5H6.94V8.5ZM5.25 3.5C4.14 3.5 3.25 4.39 3.25 5.5C3.25 6.61 4.14 7.5 5.25 7.5C6.35 7.5 7.25 6.61 7.25 5.5C7.25 4.39 6.35 3.5 5.25 3.5ZM20.44 13.02C20.44 9.88 18.76 8.22 16.16 8.22C14.37 8.22 13.48 9.2 13.02 9.93V8.5H9.65C9.7 9.48 9.65 19.5 9.65 19.5H13.02V13.36C13.02 13.02 13.05 12.69 13.15 12.45C13.42 11.78 14.03 11.09 15.07 11.09C16.41 11.09 17.06 12.11 17.06 13.6V19.5H20.44V13.02Z" />
              </svg>
            </Link>
            <Link
              to="/contact"
              aria-label="CareOS on X"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E3EDF6] bg-[#F4F9FF] text-[#102653] transition-colors hover:border-[#3299F5] hover:text-[#3299F5]"
            >
              <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25H21.552L14.325 10.51L22.827 21.75H16.17L10.956 14.933L4.99 21.75H1.68L9.41 12.915L1.254 2.25H8.08L12.793 8.481L18.244 2.25ZM17.083 19.77H18.916L7.084 4.126H5.117L17.083 19.77Z" />
              </svg>
            </Link>
            <Link
              to="/contact"
              aria-label="CareOS Video Overview"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#E3EDF6] bg-[#F4F9FF] text-[#102653] transition-colors hover:border-[#3299F5] hover:text-[#3299F5]"
            >
              <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21.58 7.19C21.35 6.33 20.67 5.65 19.81 5.42C18.25 5 12 5 12 5C12 5 5.75 5 4.19 5.42C3.33 5.65 2.65 6.33 2.42 7.19C2 8.75 2 12 2 12C2 12 2 15.25 2.42 16.81C2.65 17.67 3.33 18.35 4.19 18.58C5.75 19 12 19 12 19C12 19 18.25 19 19.81 18.58C20.67 18.35 21.35 17.67 21.58 16.81C22 15.25 22 12 22 12C22 12 22 8.75 21.58 7.19ZM10 15V9L15.2 12L10 15Z" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      {legalDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-[#E3EDF6] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-3">
              <h2 id="legal-modal-title" className="text-lg font-semibold text-[#102653]">
                {legalDoc === 'privacy' ? 'CareOS Privacy Policy' : 'CareOS Terms of Service'}
              </h2>
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                aria-label="Close dialog"
                className="rounded-md p-1.5 text-[#71839C] hover:bg-[#F4F9FF] hover:text-[#102653]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-relaxed text-[#71839C]">
              {legalDoc === 'privacy' ? (
                <>
                  <p>
                    CareOS processes organizational and operational workflow metadata strictly in accordance with role-based
                    access policies configured by each healthcare institution.
                  </p>
                  <p>
                    In demonstration environments, all displayed patient profiles, schedules, and ward metrics are synthetic
                    sample records and never represent real patient medical data.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    CareOS provides operational coordination and workflow intelligence software designed to support—not replace—licensed
                    clinical decision-making and hospital governance.
                  </p>
                  <p>
                    Authorized clinicians retain final approval over clinical documentation, admissions, and patient care actions.
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalDoc(null)}
                className="rounded-full bg-[#102653] px-5 py-2 text-sm font-medium text-white hover:bg-[#1b3a78]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
}
