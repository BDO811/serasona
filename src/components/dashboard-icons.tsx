/**
 * Small inline icons for the dashboard — 24px grid, 2px stroke, round caps,
 * the same minimal line-icon language as the rest of the report components
 * (OptionScale, SignalPanel). Not design-system canon; drawn to match.
 */
type IconProps = { className?: string; color?: string };

const base = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const MicIcon = ({ className, color = "currentColor" }: IconProps) => (
  <svg {...base} stroke={color} className={className}>
    <rect x="9" y="3" width="6" height="11" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <path d="M12 18v3" />
    <path d="M8.5 21h7" />
  </svg>
);

export const PhoneIcon = ({ className, color = "currentColor" }: IconProps) => (
  <svg {...base} stroke={color} className={className}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 2-2z" />
  </svg>
);

export const StressIcon = ({ className, color = "currentColor" }: IconProps) => (
  <svg {...base} stroke={color} className={className}>
    <path d="M2 12h3l2-6 2.5 12L12 6l2 9 1.5-4 1.5 1h5" />
  </svg>
);

export const WellnessIcon = ({ className, color = "currentColor" }: IconProps) => (
  <svg {...base} stroke={color} className={className}>
    <path d="M4 16c2.5-6 13.5-6 16 0" />
    <circle cx="12" cy="9" r="1.6" />
  </svg>
);

export const ClarityIcon = ({ className, color = "currentColor" }: IconProps) => (
  <svg {...base} stroke={color} className={className}>
    <circle cx="12" cy="12" r="7.2" />
    <circle cx="12" cy="12" r="2.8" />
  </svg>
);
