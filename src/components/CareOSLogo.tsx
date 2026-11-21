import { cn } from '../lib/utils';

export type CareOSLogoVariant = 'primary' | 'symbol' | 'white' | 'dark' | 'compact';

interface CareOSLogoProps {
  variant?: CareOSLogoVariant;
  className?: string;
}

export function CareOSLogo({ variant = 'primary', className }: CareOSLogoProps) {
  const isDark = variant === 'dark';
  const isCompact = variant === 'compact';
  const isSymbolOnly = variant === 'symbol';

  const symbolSize = isCompact ? 30 : isSymbolOnly ? 44 : 36;

  const careText = isDark ? 'text-white' : 'text-[#102653]';
  const osText = isDark ? 'text-[#62C5F5]' : 'text-[#3299F5]';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0',
        variant === 'white' && 'bg-white px-2 py-1 rounded-lg',
        className
      )}
    >
      <svg
        width={symbolSize}
        height={symbolSize}
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        {/* Top and bottom vertical medical cross arms */}
        <rect x="16.5" y="4.5" width="11" height="35" rx="5.5" fill={isDark ? '#3299F5' : '#258CF4'} />
        {/* Horizontal continuous infinity-inspired connected flow */}
        <path
          d="M11.5 15.2C7.63401 15.2 4.5 18.334 4.5 22.2C4.5 26.066 7.63401 29.2 11.5 29.2C15.9 29.2 18.6 25.4 22 22.2C25.4 19 28.1 15.2 32.5 15.2C36.366 15.2 39.5 18.334 39.5 22.2C39.5 26.066 36.366 29.2 32.5 29.2C28.1 29.2 25.4 25.4 22 22.2C18.6 19 15.9 15.2 11.5 15.2Z"
          stroke={isDark ? '#EAF5FF' : '#62C5F5'}
          strokeWidth="5.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Subtle crisp center highlight */}
        <circle cx="22" cy="22" r="2.6" fill="#FFFFFF" />
      </svg>

      {!isSymbolOnly && (
        <span
          className={cn(
            'font-display font-bold tracking-[-0.03em] leading-none',
            isCompact ? 'text-[1.25rem]' : 'text-[1.45rem]'
          )}
        >
          <span className={careText}>Care</span>
          <span className={osText}>OS</span>
        </span>
      )}
    </span>
  );
}
