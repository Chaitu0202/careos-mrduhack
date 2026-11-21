import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  BedDouble,
  Calendar,
  LayoutGrid,
  Play,
  Users,
  X,
} from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { HeroCommandPreview } from '../components/HeroCommandPreview';
import { CareOSLogo } from '../components/CareOSLogo';
import { cn } from '../lib/utils';

interface HubNode {
  id: string;
  label: string;
  icon: typeof Users;
  description: string;
  route: string;
}

const LEFT_NODES: HubNode[] = [
  {
    id: 'patients',
    label: 'Patients',
    icon: Users,
    description: 'Unified patient intake, longitudinal visit context, and consent-aware communication across every touchpoint.',
    route: '/platform#patient-management',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: Calendar,
    description: 'Coordinated provider availability, automated pre-visit verification, and conflict-free clinic scheduling.',
    route: '/platform#appointment-intelligence',
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: LayoutGrid,
    description: 'Shared operational visibility linking Emergency, Cardiology, Neurology, Surgery, and inpatient wards.',
    route: '/platform#department-coordination',
  },
];

const RIGHT_NODES: HubNode[] = [
  {
    id: 'operations',
    label: 'Hospital Operations',
    icon: Activity,
    description: 'Real-time shift handoffs, queue balancing, and cross-team task orchestration with clinician oversight.',
    route: '/agents',
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: BedDouble,
    description: 'Live bed turnover tracking, ICU readiness, diagnostic suite availability, and medical equipment utilization.',
    route: '/platform#resource-management',
  },
];

const ALL_NODES = [...LEFT_NODES, ...RIGHT_NODES];

function HospitalArchitectureIllustration() {
  return (
    <svg
      viewBox="0 0 420 240"
      className="h-full w-full select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Sky wash */}
      <circle cx="310" cy="80" r="110" fill="#D8ECFF" fillOpacity="0.45" />
      {/* Main modern hospital wing */}
      <path d="M90 220V82L230 42V220H90Z" fill="#FFFFFF" stroke="#CFE2F5" strokeWidth="1.5" />
      <path d="M230 42L355 72V220H230V42Z" fill="#EAF4FF" stroke="#CFE2F5" strokeWidth="1.5" />
      {/* Glass window bands */}
      {[72, 102, 132, 162].map((y) => (
        <g key={y}>
          <path d={`M108 ${y + 18}L216 ${y - 12}V${y + 4}L108 ${y + 34}V${y + 18}Z`} fill="#62C5F5" fillOpacity="0.55" />
          <path d={`M242 ${y - 8}L340 ${y + 14}V${y + 28}L242 ${y + 6}V${y - 8}Z`} fill="#3299F5" fillOpacity="0.45" />
        </g>
      ))}
      {/* Front wing */}
      <path d="M35 220V138L165 112V220H35Z" fill="#F4F9FF" stroke="#CFE2F5" strokeWidth="1.5" />
      {[146, 174].map((y) => (
        <path key={y} d={`M50 ${y + 10}L152 ${y - 10}V${y + 4}L50 ${y + 24}V${y + 10}Z`} fill="#3299F5" fillOpacity="0.4" />
      ))}
      {/* Subtle cross emblem on building */}
      <rect x="200" y="66" width="12" height="4" rx="2" fill="#3299F5" />
      <rect x="204" y="62" width="4" height="12" rx="2" fill="#3299F5" />
      {/* Trees */}
      <ellipse cx="62" cy="204" rx="18" ry="22" fill="#6495B8" fillOpacity="0.65" />
      <ellipse cx="195" cy="208" rx="14" ry="18" fill="#4B7B9E" fillOpacity="0.7" />
      <ellipse cx="320" cy="204" rx="20" ry="24" fill="#6495B8" fillOpacity="0.6" />
      <ellipse cx="368" cy="210" rx="15" ry="18" fill="#4B7B9E" fillOpacity="0.65" />
      {/* Ground line */}
      <line x1="12" y1="220" x2="408" y2="220" stroke="#CFE2F5" strokeWidth="2" />
    </svg>
  );
}

export function HomePage() {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('patients');
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  const selectedNode = ALL_NODES.find((n) => n.id === selectedNodeId) ?? LEFT_NODES[0];

  return (
    <div className="min-h-screen bg-white text-[#172B4D] overflow-x-hidden">
      <Navbar />

      <main className="relative">
        {/* Ambient Soft Ice-Blue Curved Backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden"
        >
          <svg
            viewBox="0 0 1440 760"
            className="h-full w-full object-cover"
            preserveAspectRatio="none"
          >
            <path
              d="M720 -40 C 980 60, 1220 20, 1460 120 L 1460 660 C 1180 740, 860 540, 620 480 C 440 435, 360 220, 720 -40 Z"
              fill="#F0F7FF"
            />
            <path
              d="M840 40 C 1080 120, 1290 100, 1460 210 L 1460 540 C 1220 620, 960 450, 740 390 C 600 350, 630 140, 840 40 Z"
              fill="#E5F2FF"
              fillOpacity="0.65"
            />
          </svg>
        </div>

        {/* Section 1: Hero */}
        <section className="relative z-10 mx-auto max-w-[1200px] px-4 pt-12 pb-20 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Left Copy Column */}
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E9FB] bg-[#EFF7FF] px-3.5 py-1.5 text-xs font-semibold text-[#3299F5]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3299F5]" />
                <span>AI-Native Hospital OS</span>
              </div>

              <h1 className="mt-6 font-display text-[2.65rem] font-bold leading-[1.06] tracking-[-0.03em] text-[#102653] sm:text-[3.35rem] [text-wrap:balance]">
                Healthcare,
                <br />
                Connected by
                <br />
                <span className="text-[#3299F5]">Intelligence.</span>
              </h1>

              <p className="mt-5 text-base leading-relaxed text-[#526581] sm:text-lg">
                One Intelligence. Every Department. Every Patient.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3.5">
                <a
                  href="#careos-advantage"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#3299F5] px-7 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(50,153,245,0.3)] transition-colors hover:bg-[#2383db] whitespace-nowrap"
                >
                  Explore CareOS
                  <ArrowRight className="h-4 w-4" />
                </a>

                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full border border-[#D6E6F7] bg-white px-6 text-sm font-semibold text-[#102653] transition-colors hover:border-[#3299F5] hover:bg-[#F4F9FF] whitespace-nowrap"
                >
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#3299F5]/40 text-[#3299F5]">
                    <Play className="h-3 w-3 fill-current ml-0.5" />
                  </span>
                  Watch Demo
                </button>
              </div>

              {/* Trust Avatar Row */}
              <div className="mt-8 flex items-center gap-3.5">
                <div className="flex -space-x-2.5">
                  {['MC', 'SJ', 'HP', 'PN'].map((initials, idx) => (
                    <span
                      key={initials}
                      className={cn(
                        'inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[11px] font-semibold',
                        idx % 2 === 0 ? 'bg-[#102653] text-white' : 'bg-[#EAF5FF] text-[#102653]'
                      )}
                    >
                      {initials}
                    </span>
                  ))}
                </div>
                <span className="text-xs font-medium text-[#71839C]">Trusted by leading hospitals</span>
              </div>
            </div>

            {/* Right Elevated Command Center Preview */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-7"
            >
              <HeroCommandPreview />
            </motion.div>
          </div>
        </section>

        {/* Section 2: Orbital Hub Diagram — One platform. Complete hospital intelligence. */}
        <section id="careos-advantage" className="relative z-10 mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E9FB] bg-[#EFF7FF] px-3.5 py-1.5 text-xs font-semibold text-[#3299F5]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#3299F5]" />
              <span>The CareOS Advantage</span>
            </div>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-[-0.025em] text-[#102653] sm:text-[2.5rem] [text-wrap:balance]">
              One platform. Complete hospital intelligence.
            </h2>
          </div>

          {/* Connected Orbital Diagram */}
          <div className="relative mt-14 mx-auto max-w-[960px]">
            {/* Concentric Rings Background (Desktop) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 hidden md:flex items-center justify-center"
            >
              <div className="h-[360px] w-[360px] rounded-full border border-[#DCEAF7]" />
              <div className="absolute h-[265px] w-[265px] rounded-full border border-dashed border-[#BFDDFB]" />
              <div className="absolute h-[440px] w-[440px] rounded-full bg-[#F4F9FF]/50 -z-10" />
            </div>

            <div className="relative grid grid-cols-1 items-center gap-6 md:grid-cols-12 md:gap-4 py-4">
              {/* Left 3 Connected Nodes */}
              <div className="md:col-span-4 space-y-5">
                {LEFT_NODES.map((node, index) => {
                  const Icon = node.icon;
                  const active = selectedNodeId === node.id;
                  return (
                    <div
                      key={node.id}
                      className={cn(
                        'relative flex items-center justify-end',
                        index === 1 ? 'md:pr-6' : 'md:pr-0'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          'flex w-full md:w-56 items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all shadow-[0_8px_24px_rgba(16,38,83,0.05)]',
                          active
                            ? 'border-[#3299F5] bg-white ring-2 ring-[#3299F5]/20'
                            : 'border-[#E3EDF6] bg-white hover:border-[#62C5F5]'
                        )}
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-display text-sm font-semibold text-[#102653]">{node.label}</span>
                      </button>
                      {/* Dotted horizontal connector to central orb */}
                      <span
                        aria-hidden="true"
                        className="hidden md:block w-10 border-t border-dashed border-[#62C5F5]"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Center CareOS Hub Circle */}
              <div className="md:col-span-4 flex justify-center py-4">
                <div className="flex h-48 w-48 flex-col items-center justify-center rounded-full border border-[#DCEAF7] bg-white shadow-[0_18px_50px_rgba(16,38,83,0.09)]">
                  <CareOSLogo variant="symbol" className="scale-125" />
                  <div className="mt-3 font-display text-2xl font-bold tracking-[-0.03em]">
                    <span className="text-[#102653]">Care</span>
                    <span className="text-[#3299F5]">OS</span>
                  </div>
                </div>
              </div>

              {/* Right 2 Connected Nodes */}
              <div className="md:col-span-4 space-y-6">
                {RIGHT_NODES.map((node) => {
                  const Icon = node.icon;
                  const active = selectedNodeId === node.id;
                  return (
                    <div key={node.id} className="relative flex items-center justify-start">
                      <span
                        aria-hidden="true"
                        className="hidden md:block w-10 border-t border-dashed border-[#62C5F5]"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedNodeId(node.id)}
                        className={cn(
                          'flex w-full md:w-60 items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all shadow-[0_8px_24px_rgba(16,38,83,0.05)]',
                          active
                            ? 'border-[#3299F5] bg-white ring-2 ring-[#3299F5]/20'
                            : 'border-[#E3EDF6] bg-white hover:border-[#62C5F5]'
                        )}
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF5FF] text-[#3299F5]">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="font-display text-sm font-semibold text-[#102653]">{node.label}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Node Context Strip */}
            <div className="mt-6 mx-auto max-w-2xl rounded-xl border border-[#E3EDF6] bg-[#F4F9FF] px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm">
                <span className="font-semibold text-[#102653]">{selectedNode.label}: </span>
                <span className="text-[#71839C]">{selectedNode.description}</span>
              </div>
              <Link
                to={selectedNode.route}
                className="shrink-0 text-xs font-semibold text-[#3299F5] hover:text-[#102653] whitespace-nowrap"
              >
                Explore module →
              </Link>
            </div>
          </div>
        </section>

        {/* Section 3: Bottom Rounded Soft-Blue Banner Card */}
        <section className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-[28px] border border-[#DCEAF7] bg-gradient-to-br from-[#F4F9FF] via-[#F7FBFF] to-[#DFEEFF]">
            <div className="grid grid-cols-1 items-center lg:grid-cols-12">
              <div className="p-8 sm:p-12 lg:col-span-7 lg:p-14">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D7E9FB] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#3299F5]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#3299F5]" />
                  <span>Smarter Operations</span>
                </div>

                <h2 className="mt-5 font-display text-3xl font-bold leading-[1.12] tracking-[-0.025em] text-[#102653] sm:text-[2.6rem] [text-wrap:balance]">
                  Build a more
                  <br />
                  connected hospital.
                </h2>

                <p className="mt-4 max-w-md text-base leading-relaxed text-[#526581]">
                  Bring your departments, workflows and intelligence together.
                </p>

                <div className="mt-8">
                  <Link
                    to="/signup"
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#102653] px-7 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(16,38,83,0.18)] transition-colors hover:bg-[#1b3a78] whitespace-nowrap"
                  >
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-5 self-end pt-4 lg:pt-8 pr-2">
                <HospitalArchitectureIllustration />
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Interactive Watch Demo / Walkthrough Modal */}
      {demoModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102653]/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-modal-title"
        >
          <div className="w-full max-w-3xl rounded-2xl border border-[#E3EDF6] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E3EDF6] pb-4">
              <div>
                <h2 id="demo-modal-title" className="font-display text-xl font-bold text-[#102653]">
                  CareOS Interactive Product Tour
                </h2>
                <p className="text-xs text-[#71839C]">
                  Click the sidebar views or time toggle below to explore the live Command Center layout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemoModalOpen(false)}
                aria-label="Close demo preview"
                className="rounded-lg p-1.5 text-[#71839C] hover:bg-[#F4F9FF] hover:text-[#102653]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5">
              <HeroCommandPreview />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#E3EDF6] pt-4">
              <span className="text-xs text-[#71839C]">
                Want a guided live hospital walkthrough?
              </span>
              <div className="flex items-center gap-3">
                <Link
                  to="/contact?intent=demo"
                  onClick={() => setDemoModalOpen(false)}
                  className="rounded-full bg-[#3299F5] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2383db]"
                >
                  Schedule Live Demo
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setDemoModalOpen(false)}
                  className="rounded-full bg-[#102653] px-5 py-2 text-xs font-semibold text-white hover:bg-[#1b3a78]"
                >
                  Create Workspace
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
