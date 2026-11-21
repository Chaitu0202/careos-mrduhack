import { useState } from 'react';

interface TrendPoint {
  label: string;
  scheduled: number;
  completed: number;
  walkIn: number;
}

export function AppointmentTrendChart({ data }: { data: TrendPoint[] }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 560;
  const height = 210;
  const padL = 36;
  const padR = 16;
  const padT = 18;
  const padB = 30;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const maxVal = Math.max(...data.map((d) => Math.max(d.scheduled, d.completed + d.walkIn)), 10);
  const stepX = data.length > 1 ? innerW / (data.length - 1) : innerW;

  const pointsScheduled = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - (d.scheduled / maxVal) * innerH,
  }));
  const pointsCompleted = data.map((d, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - (d.completed / maxVal) * innerH,
  }));

  const pathLine = (pts: Array<{ x: number; y: number }>) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const areaScheduled = `${pathLine(pointsScheduled)} L ${pointsScheduled[pointsScheduled.length - 1].x.toFixed(1)} ${
    padT + innerH
  } L ${pointsScheduled[0].x.toFixed(1)} ${padT + innerH} Z`;

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-52 overflow-visible" role="img" aria-label="Appointment Trends Chart">
        <defs>
          <linearGradient id="careosAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3299F5" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#3299F5" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
          const y = padT + innerH * (1 - t);
          const val = Math.round(maxVal * t);
          return (
            <g key={idx}>
              <line x1={padL} y1={y} x2={width - padR} y2={y} stroke="#E3EDF6" strokeWidth="1" />
              <text x={padL - 8} y={y + 4} textAnchor="end" className="fill-[#71839C] text-[10px] font-mono tabular-nums">
                {val}
              </text>
            </g>
          );
        })}

        <path d={areaScheduled} fill="url(#careosAreaGrad)" />
        <path d={pathLine(pointsScheduled)} fill="none" stroke="#3299F5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathLine(pointsCompleted)} fill="none" stroke="#102653" strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />

        {data.map((d, i) => {
          const p = pointsScheduled[i];
          const c = pointsCompleted[i];
          const active = hoverIdx === i;
          return (
            <g
              key={d.label}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer"
            >
              <rect x={p.x - 24} y={padT} width={48} height={innerH + padB} fill="transparent" />
              {active && <line x1={p.x} y1={padT} x2={p.x} y2={padT + innerH} stroke="#62C5F5" strokeWidth="1" />}
              <circle cx={p.x} cy={p.y} r={active ? 5 : 3.5} fill="#3299F5" stroke="#FFFFFF" strokeWidth="2" />
              <circle cx={c.x} cy={c.y} r={active ? 4.5 : 3} fill="#102653" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x={p.x} y={height - 8} textAnchor="middle" className="fill-[#71839C] text-[11px] font-mono">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-[#71839C]">
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 bg-[#3299F5]" /> Scheduled
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-0.5 w-4 border-t-2 border-dashed border-[#102653]" /> Completed
          </span>
        </div>
        {hoverIdx !== null && data[hoverIdx] && (
          <span className="font-mono text-[#102653] tabular-nums">
            {data[hoverIdx].label} · Scheduled {data[hoverIdx].scheduled} · Completed {data[hoverIdx].completed} · Walk-in {data[hoverIdx].walkIn}
          </span>
        )}
      </div>
    </div>
  );
}

export function HorizontalBarMetric({
  label,
  value,
  max,
  sublabel,
  accent = 'primary',
}: {
  label: string;
  value: number;
  max: number;
  sublabel: string;
  accent?: 'primary' | 'navy' | 'warning';
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const barColor =
    accent === 'warning' ? 'bg-amber-500' : accent === 'navy' ? 'bg-[#102653]' : 'bg-[#3299F5]';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#102653]">{label}</span>
        <span className="font-mono text-xs text-[#71839C] tabular-nums">{sublabel}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[#EAF5FF] overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
