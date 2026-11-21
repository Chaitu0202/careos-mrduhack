import React from 'react';
import type { OrchestratorAgentKey } from '../../types/careos';
import { cn } from '../../lib/utils';

export interface ConnectedToolDef {
  id: string;
  name: string;
  shortTag: string;
  accentClass: string;
  renderIcon: () => React.ReactNode;
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F58529" />
          <stop offset="50%" stopColor="#DD2A7B" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#igGrad)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#1877F2" />
      <path
        d="M13.6 20v-7.1h2.4l.36-2.8H13.6V8.3c0-.81.23-1.36 1.4-1.36h1.48V4.43c-.26-.03-1.14-.11-2.17-.11-2.15 0-3.62 1.31-3.62 3.72v2.06H8.3v2.8h2.39V20h2.91z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2" />
      <circle cx="7.3" cy="7.5" r="1.3" fill="#FFFFFF" />
      <rect x="6.1" y="10.2" width="2.4" height="7.8" fill="#FFFFFF" />
      <path
        d="M11 10.2h2.3v1.08h.03c.32-.6 1.1-1.24 2.27-1.24 2.43 0 2.88 1.6 2.88 3.68V18h-2.4v-3.78c0-.9-.02-2.06-1.25-2.06-1.26 0-1.45.98-1.45 2v3.84H11v-7.8z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <rect x="1.5" y="4.5" width="21" height="15" rx="4.5" fill="#FF0000" />
      <polygon points="10,8.7 16.2,12 10,15.3" fill="#FFFFFF" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="#25D366" />
      <path
        d="M15.8 14.2c-.2-.1-1.3-.65-1.5-.72-.2-.07-.35-.1-.5.1-.15.2-.57.72-.7.87-.13.15-.26.17-.46.07-.2-.1-.9-.33-1.7-1.06-.63-.56-1.05-1.25-1.18-1.46-.12-.2-.01-.32.1-.42.09-.09.2-.24.3-.36.1-.12.13-.2.2-.34.07-.14.03-.26-.02-.36-.05-.1-.5-1.2-.69-1.64-.18-.43-.36-.37-.5-.38h-.42c-.15 0-.38.05-.58.27-.2.22-.77.75-.77 1.83s.79 2.13.9 2.27c.1.15 1.55 2.36 3.76 3.31.52.23.93.36 1.25.46.53.17 1.01.15 1.39.09.42-.06 1.3-.53 1.48-1.04.18-.52.18-.96.13-1.05-.06-.09-.2-.14-.42-.24z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

function ErpIcon({ bg = '#0F62FE', label = 'E' }: { bg?: string; label?: string }) {
  return (
    <span
      style={{ backgroundColor: bg }}
      className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-extrabold text-white leading-none"
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export const AGENT_CONNECTED_TOOLS: Record<OrchestratorAgentKey, ConnectedToolDef[]> = {
  finance: [
    {
      id: 'stripe',
      name: 'Stripe',
      shortTag: 'Stripe',
      accentClass: 'border-[#E0DEFF] bg-[#F6F5FF] text-[#4B45C6]',
      renderIcon: () => <ErpIcon bg="#635BFF" label="S" />,
    },
    {
      id: 'razorpay',
      name: 'Razorpay',
      shortTag: 'Razorpay',
      accentClass: 'border-[#D3E5FD] bg-[#F2F7FF] text-[#0C4A9E]',
      renderIcon: () => <ErpIcon bg="#072654" label="R" />,
    },
    {
      id: 'excel',
      name: 'Excel',
      shortTag: 'Excel',
      accentClass: 'border-[#CCEBD9] bg-[#F2FBF6] text-[#146C43]',
      renderIcon: () => <ErpIcon bg="#1D6F42" label="X" />,
    },
    {
      id: 'erp-fin',
      name: 'Finance ERP',
      shortTag: 'ERP',
      accentClass: 'border-[#DCE8F5] bg-[#F4F9FF] text-[#102653]',
      renderIcon: () => <ErpIcon bg="#102653" label="F" />,
    },
  ],
  radiology: [
    {
      id: 'pacs',
      name: 'PACS',
      shortTag: 'PACS',
      accentClass: 'border-[#CFE3FA] bg-[#EFF7FF] text-[#14559E]',
      renderIcon: () => <ErpIcon bg="#218AEF" label="P" />,
    },
    {
      id: 'ris',
      name: 'RIS',
      shortTag: 'RIS',
      accentClass: 'border-[#DCE8F5] bg-[#F4F9FF] text-[#102653]',
      renderIcon: () => <ErpIcon bg="#102653" label="R" />,
    },
    {
      id: 'ge',
      name: 'GE HealthCare',
      shortTag: 'GE',
      accentClass: 'border-[#D5E6FA] bg-[#F5FAFF] text-[#0B4F9C]',
      renderIcon: () => <ErpIcon bg="#005EB8" label="GE" />,
    },
    {
      id: 'siemens',
      name: 'Siemens',
      shortTag: 'Siemens',
      accentClass: 'border-[#CBEBEB] bg-[#F2FAFA] text-[#006B6B]',
      renderIcon: () => <ErpIcon bg="#009999" label="S" />,
    },
  ],
  operations: [
    {
      id: 'erp',
      name: 'Hospital ERP',
      shortTag: 'ERP',
      accentClass: 'border-[#CFE2FA] bg-[#EFF6FF] text-[#0D4EA6]',
      renderIcon: () => <ErpIcon bg="#0070F2" label="ERP" />,
    },
    {
      id: 'his',
      name: 'HIS',
      shortTag: 'HIS',
      accentClass: 'border-[#DCE8F5] bg-[#F4F9FF] text-[#102653]',
      renderIcon: () => <ErpIcon bg="#102653" label="H" />,
    },
    {
      id: 'emr',
      name: 'EMR',
      shortTag: 'EMR',
      accentClass: 'border-[#CCE6FF] bg-[#F2F9FF] text-[#1868C4]',
      renderIcon: () => <ErpIcon bg="#3299F5" label="E" />,
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      shortTag: 'WA',
      accentClass: 'border-[#CBEFD8] bg-[#F2FCF5] text-[#127C41]',
      renderIcon: () => <WhatsAppIcon />,
    },
  ],
  insurance: [
    {
      id: 'tpa',
      name: 'TPA Portal',
      shortTag: 'TPA',
      accentClass: 'border-[#CFE3FA] bg-[#EFF7FF] text-[#102653]',
      renderIcon: () => <ErpIcon bg="#102653" label="T" />,
    },
    {
      id: 'eclaims',
      name: 'eClaims',
      shortTag: 'eClaims',
      accentClass: 'border-[#CCEBD9] bg-[#F2FBF6] text-[#0E7442]',
      renderIcon: () => <ErpIcon bg="#10B981" label="C" />,
    },
    {
      id: 'hl7',
      name: 'FHIR Desk',
      shortTag: 'FHIR',
      accentClass: 'border-[#F7DFC2] bg-[#FFF8F0] text-[#9A520B]',
      renderIcon: () => <ErpIcon bg="#EA580C" label="F" />,
    },
  ],
  sales: [
    {
      id: 'salesforce',
      name: 'Salesforce',
      shortTag: 'SFDC',
      accentClass: 'border-[#CBE7FB] bg-[#F0F9FF] text-[#026AA7]',
      renderIcon: () => <ErpIcon bg="#00A1E0" label="SF" />,
    },
    {
      id: 'hubspot',
      name: 'HubSpot',
      shortTag: 'HubSpot',
      accentClass: 'border-[#FADBC9] bg-[#FFF6F0] text-[#B84114]',
      renderIcon: () => <ErpIcon bg="#FF7A59" label="H" />,
    },
    {
      id: 'zoho',
      name: 'Zoho CRM',
      shortTag: 'Zoho',
      accentClass: 'border-[#FCE1C7] bg-[#FFF8F2] text-[#9A420D]',
      renderIcon: () => <ErpIcon bg="#E42527" label="Z" />,
    },
  ],
  marketing: [
    {
      id: 'instagram',
      name: 'Instagram',
      shortTag: 'IG',
      accentClass: 'border-[#F5D2E3] bg-[#FFF5FA] text-[#A61E5C]',
      renderIcon: () => <InstagramIcon />,
    },
    {
      id: 'facebook',
      name: 'Facebook',
      shortTag: 'FB',
      accentClass: 'border-[#CFE1FB] bg-[#F2F7FF] text-[#1255B8]',
      renderIcon: () => <FacebookIcon />,
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      shortTag: 'IN',
      accentClass: 'border-[#CCE0F5] bg-[#F1F7FD] text-[#0A529B]',
      renderIcon: () => <LinkedInIcon />,
    },
    {
      id: 'youtube',
      name: 'YouTube',
      shortTag: 'YT',
      accentClass: 'border-[#FAD2D2] bg-[#FFF5F5] text-[#B91C1C]',
      renderIcon: () => <YouTubeIcon />,
    },
  ],
};

export function ConnectedToolsRow({
  agentKey,
  compact = false,
}: {
  agentKey: OrchestratorAgentKey;
  compact?: boolean;
}) {
  const tools = AGENT_CONNECTED_TOOLS[agentKey] ?? [];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tools.map((tool) => (
        <span
          key={tool.id}
          title={`Connected: ${tool.name}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none whitespace-nowrap',
            tool.accentClass
          )}
        >
          {tool.renderIcon()}
          <span>{compact ? tool.shortTag : tool.name}</span>
        </span>
      ))}
    </div>
  );
}
