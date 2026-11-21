import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  FileText,
  Lock,
  Network,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  Unlink,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroCommandPreview } from '../components/HeroCommandPreview';
import { HOW_IT_WORKS_STEPS, MARKETING_AGENTS, PLATFORM_MODULES } from '../data/marketingData';

function PageShell({
  kicker,
  title,
  highlight,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  highlight?: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-[#172B4D]">
      <Navbar />
      <section className="relative overflow-hidden border-b border-[#E3EDF6] bg-gradient-to-b from-[#F4F9FF]/80 to-white py-14 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E9FB] bg-[#EFF7FF] px-3.5 py-1.5 text-xs font-semibold text-[#3299F5]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3299F5]" />
            <span>{kicker}</span>
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-bold tracking-[-0.025em] text-[#102653] sm:text-5xl [text-wrap:balance]">
            {title}
            {highlight && <span className="text-[#3299F5]"> {highlight}</span>}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#71839C]">{subtitle}</p>
        </div>
      </section>
      <main className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">{children}</main>
      <Footer />
    </div>
  );
}

const SILO_PROBLEMS = [
  {
    icon: Unlink,
    title: 'Disconnected departments',
    desc: 'Emergency, outpatient clinics, wards, and diagnostics run on isolated tools without shared capacity state.',
  },
  {
    icon: FileText,
    title: 'Fragmented patient information',
    desc: 'Intake notes, prior encounters, and discharge plans live across separate records instead of one longitudinal brief.',
  },
  {
    icon: RefreshCw,
    title: 'Manual operational workflows',
    desc: 'Bed turnover, shift handoffs, and visit reminders depend on manual phone calls and spreadsheet updates.',
  },
  {
    icon: Activity,
    title: 'Delayed coordination and decisions',
    desc: 'Queue and staffing bottlenecks appear only after patient wait times have already escalated.',
  },
];

export function PlatformPage() {
  return (
    <PageShell
      kicker="CareOS Platform"
      title="One operating system connecting every clinical and operational"
      highlight="workflow."
      subtitle="Explore the nine unified modules that replace fragmented hospital spreadsheets, phone-tag handoffs, and blind capacity spots."
    >
      <div id="command-center" className="mb-16">
        <HeroCommandPreview />
      </div>

      {/* Problem Framing */}
      <div className="mb-16">
        <h2 className="font-display text-2xl font-bold text-[#102653]">
          Healthcare doesn&apos;t operate in silos. Neither should your systems.
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SILO_PROBLEMS.map((p) => {
            const Icon = p.icon;
            return (
              <div key={p.title} className="rounded-2xl border border-[#E3EDF6] bg-[#F4F9FF]/50 p-6">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-[#102653]">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#71839C]">{p.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 9 Platform Modules */}
      <div id="patient-flow">
        <h2 className="font-display text-2xl font-bold text-[#102653]">Core Platform Modules</h2>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          {PLATFORM_MODULES.map((mod, idx) => (
            <div key={mod.id} id={mod.id} className="rounded-2xl border border-[#E3EDF6] bg-white p-6">
              <div className="font-mono text-xs font-semibold text-[#3299F5]">0{idx + 1}</div>
              <h3 className="mt-2 font-display text-lg font-bold text-[#102653]">{mod.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#71839C]">{mod.summary}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 5-Stage Operating Loop */}
      <div id="workflows" className="mt-16 rounded-3xl border border-[#DCEAF7] bg-[#F4F9FF] p-8">
        <h2 className="font-display text-2xl font-bold text-[#102653]">
          From disconnected workflows to coordinated intelligence.
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-5">
          {HOW_IT_WORKS_STEPS.map((s) => (
            <div key={s.step} className="rounded-2xl border border-[#E3EDF6] bg-white p-4">
              <div className="font-mono text-xs font-semibold text-[#3299F5]">{s.step}</div>
              <div className="mt-1 font-display text-base font-bold text-[#102653]">{s.title}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-[#71839C]">{s.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div id="analytics" className="mt-12 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E3EDF6] bg-white p-6">
        <div>
          <h3 className="font-display text-lg font-bold text-[#102653]">Ready to inspect the live Command Center?</h3>
          <p className="mt-1 text-sm text-[#71839C]">Create an organization workspace or request a guided walkthrough.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/signup" className="rounded-full bg-[#3299F5] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2383db]">
            Get Started
          </Link>
          <Link to="/contact?intent=demo" className="rounded-full border border-[#E3EDF6] px-5 py-2.5 text-sm font-semibold text-[#102653] hover:bg-[#F4F9FF]">
            Book a Demo
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

export function AgentsPage() {
  const [selectedId, setSelectedId] = useState(MARKETING_AGENTS[0].id);
  const selected = MARKETING_AGENTS.find((a) => a.id === selectedId) ?? MARKETING_AGENTS[0];

  return (
    <PageShell
      kicker="AI Agent Ecosystem"
      title="Six specialized healthcare agents working as one"
      highlight="coordinated system."
      subtitle="Each CareOS agent owns a focused operational domain—communicating through a shared hospital context layer with explicit human oversight."
    >
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-5 space-y-3">
          {MARKETING_AGENTS.map((agent) => (
            <button
              key={agent.id}
              id={agent.id}
              type="button"
              onClick={() => setSelectedId(agent.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                selectedId === agent.id
                  ? 'border-[#3299F5] bg-[#EAF5FF]'
                  : 'border-[#E3EDF6] bg-white hover:bg-[#F4F9FF]'
              }`}
            >
              <div className="text-xs font-semibold text-[#3299F5]">{agent.role}</div>
              <div className="mt-1 font-display text-base font-bold text-[#102653]">{agent.name}</div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-7">
          <div className="rounded-2xl border border-[#E3EDF6] bg-white p-8 shadow-[0_12px_32px_rgba(16,38,83,0.05)]">
            <div className="text-xs font-semibold uppercase tracking-wider text-[#3299F5]">{selected.role}</div>
            <h2 className="mt-2 font-display text-2xl font-bold text-[#102653]">{selected.name}</h2>
            <p className="mt-3 text-base leading-relaxed text-[#71839C]">{selected.description}</p>

            <div className="mt-6 border-t border-[#E3EDF6] pt-6">
              <h3 className="text-sm font-semibold text-[#102653]">Core Operational Capabilities</h3>
              <ul className="mt-3 space-y-2.5">
                {selected.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2.5 text-sm text-[#172B4D]">
                    <CheckCircle2 className="h-4 w-4 text-[#3299F5]" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 rounded-xl border border-[#E3EDF6] bg-[#F4F9FF] p-5 space-y-3">
              <div>
                <div className="text-xs font-semibold text-[#102653]">Example Coordination Prompt</div>
                <p className="mt-1 text-sm text-[#172B4D]">{selected.samplePrompt}</p>
              </div>
              <div className="border-t border-[#E3EDF6] pt-3">
                <div className="text-xs font-semibold text-[#3299F5]">Resulting System Action</div>
                <p className="mt-1 text-sm text-[#172B4D]">{selected.sampleOutcome}</p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-full bg-[#3299F5] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2383db]"
              >
                Open AI Agent Hub
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export function SolutionsPage() {
  const tracks = [
    {
      id: 'leadership',
      audience: 'Hospital Leadership & COOs',
      title: 'Real-time capacity, throughput, and bottleneck visibility',
      desc: 'Track bed occupancy, department wait times, and operational queues across your entire hospital without waiting for end-of-week manual reports.',
      points: ['Live bed utilization across ICU and general wards', 'Department-level wait time & load calculation', 'Cross-department performance analytics'],
    },
    {
      id: 'clinical-ops',
      audience: 'Clinical Operations & Physicians',
      title: 'Structured patient context with human sign-off controls',
      desc: 'Prepare clinicians ahead of every consultation with synthesized patient histories, allergy alerts, and scheduled follow-ups.',
      points: ['Automated pre-consult clinical summaries', 'Doctor availability and schedule coordination', 'Clinician approval required before finalization'],
    },
    {
      id: 'nursing-flow',
      audience: 'Nursing & Patient Flow Teams',
      title: 'Predictable admissions, triage handoffs, and discharge turnover',
      desc: 'Coordinate environmental services, pharmacy verification, and bed assignment in one unified flow queue.',
      points: ['Automated discharge-to-bed-ready handoffs', 'Outpatient & Emergency queue balancing', 'Real-time operational task notifications'],
    },
    {
      id: 'health-it',
      audience: 'Health IT & Security Teams',
      title: 'Standards-based integration and strict role governance',
      desc: 'Deploy an intelligence layer that respects existing institutional permissions, server-side authentication, and full auditability.',
      points: ['Role-based access control across 4 permission tiers', 'HL7 FHIR R4 and REST/Webhook API adapters', 'Chronological security & action audit logs'],
    },
  ];

  return (
    <PageShell
      kicker="Hospital Solutions"
      title="Built for every team running the"
      highlight="modern hospital."
      subtitle="Whether overseeing capacity across 500 beds or preparing a morning specialty clinic, CareOS aligns workflows around the patient."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {tracks.map((t) => (
          <div key={t.id} id={t.id} className="rounded-2xl border border-[#E3EDF6] bg-white p-7">
            <div className="text-xs font-semibold text-[#3299F5]">{t.audience}</div>
            <h2 className="mt-2 font-display text-xl font-bold text-[#102653]">{t.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#71839C]">{t.desc}</p>
            <ul className="mt-5 space-y-2 border-t border-[#E3EDF6] pt-4">
              {t.points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-[#172B4D]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3299F5]" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function IntegrationsPage() {
  const items = [
    { name: 'CareOS REST & Webhook API', cat: 'APIs & Third-Party Apps', status: 'Supported', protocol: 'HTTPS / JSON / Bearer Auth', desc: 'Authenticated programmatic access to schedules, tasks, and workflow triggers.' },
    { name: 'HL7 FHIR R4 Data Adapter', cat: 'EMR & EHR Platforms', status: 'Supported', protocol: 'FHIR R4 REST', desc: 'Standards-compliant schema mapping for patient demographics, encounters, and schedules.' },
    { name: 'Institutional Calendar Sync', cat: 'Calendar & Scheduling', status: 'Supported', protocol: 'CalDAV / iCalendar', desc: 'Two-way shift and clinic slot synchronization.' },
    { name: 'Enterprise HIS Connectors', cat: 'HIS & Hospital Management', status: 'Planned', protocol: 'HL7 v2 / MLLP', desc: 'Direct ADT and ward census connectors for legacy hospital information systems.' },
    { name: 'Epic & Cerner SMART Launch', cat: 'EMR & EHR Platforms', status: 'Planned', protocol: 'SMART on FHIR', desc: 'Embedded inpatient clinical workspace launch.' },
    { name: 'Hospital PBX & SIP Voice', cat: 'Telephony Systems', status: 'Planned', protocol: 'SIP / WebRTC', desc: 'Automated inbound voice scheduling and triage routing.' },
    { name: 'WhatsApp & SMS Care Channel', cat: 'WhatsApp & Messaging', status: 'Planned', protocol: 'WhatsApp Cloud API', desc: 'Consent-aware patient reminders and discharge follow-up messaging.' },
  ];

  return (
    <PageShell
      kicker="Ecosystem Integrations"
      title="Transparent connectivity with your"
      highlight="clinical stack."
      subtitle="We clearly distinguish protocols supported today from enterprise connectors currently in development."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {items.map((item) => (
          <div key={item.name} className="rounded-2xl border border-[#E3EDF6] bg-white p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#71839C]">{item.cat}</span>
              <span
                className={`text-xs font-semibold ${
                  item.status === 'Supported' ? 'text-[#3299F5]' : 'text-[#71839C]'
                }`}
              >
                {item.status === 'Supported' ? 'Supported Today' : 'Planned Roadmap'}
              </span>
            </div>
            <h2 className="mt-2 font-display text-lg font-bold text-[#102653]">{item.name}</h2>
            <p className="mt-2 text-sm text-[#71839C]">{item.desc}</p>
            <div className="mt-4 border-t border-[#E3EDF6] pt-3 font-mono text-xs text-[#102653]">
              Protocol: {item.protocol}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function SecurityPage() {
  const safeguards = [
    { icon: Lock, title: 'Cryptographic Authentication & Sessions', desc: 'Passwords are salted and hashed server-side using scrypt. Protected routes validate HMAC-signed Bearer tokens with strict expiration and logout revocation.' },
    { icon: ShieldCheck, title: 'Role-Based Access Control (RBAC)', desc: 'Administrators, clinical coordinators, and operators receive scoped permissions. Regular account registrations never receive elevated admin privileges.' },
    { icon: Stethoscope, title: 'Human-in-the-Loop Clinical Oversight', desc: 'CareOS AI agents prepare documentation drafts and operational proposals; licensed staff approve admissions, discharges, and clinical summaries.' },
    { icon: Network, title: 'Comprehensive Audit Trails', desc: 'Every sign-in, role modification, workflow trigger, and patient record update writes an immutable timestamped entry to the administrator audit log.' },
  ];

  return (
    <PageShell
      kicker="Security & Governance"
      title="Engineered for institutional accountability and"
      highlight="clinical safety."
      subtitle="CareOS prioritizes verifiable access controls, transparent auditability, and clinician authority over unverified marketing badges."
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {safeguards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.title} className="rounded-2xl border border-[#E3EDF6] bg-white p-7">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-display text-xl font-bold text-[#102653]">{s.title}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[#71839C]">{s.desc}</p>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
}

export function AboutPage() {
  return (
    <PageShell
      kicker="About CareOS"
      title="Replacing hospital fragmentation with one"
      highlight="intelligence layer."
      subtitle="CareOS was built around a simple premise: clinical teams should spend their time caring for patients, not reconciling disconnected software."
    >
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-5 text-base leading-relaxed text-[#172B4D]">
          <p>
            Modern hospitals run on dozens of point systems—one tool for outpatient scheduling, another for bed tracking,
            separate clinical record portals, and informal phone calls or spreadsheets to bridge the gaps between them.
          </p>
          <p>
            CareOS serves as the unified operational operating system across those layers. By combining real-time hospital
            telemetry with specialized AI agents under strict clinician oversight, CareOS helps health systems coordinate
            patient journeys from first intake to safe discharge.
          </p>
        </div>
        <div className="lg:col-span-5 rounded-2xl border border-[#E3EDF6] bg-[#F4F9FF] p-7 space-y-4">
          <h2 className="font-display text-lg font-bold text-[#102653]">Our Operating Principles</h2>
          <ul className="space-y-3 text-sm text-[#172B4D]">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3299F5]" />
              <span>Clarity over noise — calm interfaces designed for high-stakes clinical environments.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3299F5]" />
              <span>Human oversight — software assists coordination while clinicians own medical judgment.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3299F5]" />
              <span>Verifiable reliability — calculated metrics and transparent integration states.</span>
            </li>
          </ul>
        </div>
      </div>
    </PageShell>
  );
}

export function ContactPage() {
  const [searchParams] = useSearchParams();
  const isDemo = searchParams.get('intent') === 'demo';
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [organization, setOrganization] = useState('');
  const [roleOrType, setRoleOrType] = useState('Hospital Leadership');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isDemo ? 'demo' : 'contact',
          name,
          email,
          organization,
          roleOrType,
          message,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setSubmittedId(data.inquiryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell
      kicker={isDemo ? 'Book a CareOS Demo' : 'Contact CareOS'}
      title={isDemo ? 'Schedule a personalized hospital' : 'Connect with the'}
      highlight={isDemo ? 'walkthrough.' : 'CareOS team.'}
      subtitle="Share your hospital structure and operational goals. Our healthcare implementation specialists will follow up with a tailored briefing."
    >
      <div className="mx-auto max-w-2xl rounded-2xl border border-[#E3EDF6] bg-white p-7 sm:p-9 shadow-[0_14px_40px_rgba(16,38,83,0.06)]">
        {submittedId ? (
          <div className="space-y-4 text-center py-6">
            <CheckCircle2 className="mx-auto h-10 w-10 text-[#3299F5]" />
            <h2 className="font-display text-2xl font-bold text-[#102653]">Request Received</h2>
            <p className="text-sm text-[#71839C]">
              Thank you, {name}. Your inquiry (<span className="font-mono text-[#102653]">{submittedId}</span>) has been logged for{' '}
              <span className="font-medium text-[#102653]">{organization}</span>.
            </p>
            <div className="pt-2">
              <Link
                to="/"
                className="inline-flex items-center rounded-full bg-[#3299F5] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#2383db]"
              >
                Return to Homepage
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            )}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="block text-xs font-semibold text-[#102653]">
                  Full name
                </label>
                <input
                  id="contact-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#E3EDF6] px-3.5 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                  placeholder="Dr. Jordan Patel"
                />
              </div>
              <div>
                <label htmlFor="contact-email" className="block text-xs font-semibold text-[#102653]">
                  Work email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#E3EDF6] px-3.5 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                  placeholder="j.patel@hospital.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-org" className="block text-xs font-semibold text-[#102653]">
                  Hospital / Organization
                </label>
                <input
                  id="contact-org"
                  required
                  value={organization}
                  onChange={(e) => setOrganization(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#E3EDF6] px-3.5 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                  placeholder="Meridian Regional Health"
                />
              </div>
              <div>
                <label htmlFor="contact-role" className="block text-xs font-semibold text-[#102653]">
                  Department / Role
                </label>
                <select
                  id="contact-role"
                  value={roleOrType}
                  onChange={(e) => setRoleOrType(e.target.value)}
                  className="mt-1.5 h-11 w-full rounded-lg border border-[#E3EDF6] bg-white px-3.5 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                >
                  <option>Hospital Leadership</option>
                  <option>Clinical Operations</option>
                  <option>Nursing & Patient Flow</option>
                  <option>Health IT / Systems</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="contact-message" className="block text-xs font-semibold text-[#102653]">
                How can CareOS assist your hospital?
              </label>
              <textarea
                id="contact-message"
                rows={4}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#E3EDF6] p-3.5 text-sm text-[#172B4D] focus:border-[#3299F5] focus:outline-none"
                placeholder="Tell us about your bed capacity, departments, or coordination priorities..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[#3299F5] px-6 text-sm font-semibold text-white shadow-[0_6px_18px_rgba(50,153,245,0.28)] transition-colors hover:bg-[#2383db] disabled:opacity-60"
            >
              {loading ? 'Submitting...' : isDemo ? 'Request Walkthrough' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </PageShell>
  );
}
