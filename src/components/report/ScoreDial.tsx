/**
 * A 270-degree arc dial, the Serasona Score's home. Track and value arc both
 * use pathLength="100" so the dasharray is a plain percentage regardless of
 * radius, rotated so the open 90-degree gap sits at the bottom.
 */
export interface ScoreDialProps {
  value: number;
  color: string;
  trackColor?: string;
  size?: number;
  strokeWidth?: number;
  label?: string;
  children?: React.ReactNode;
}

export const ScoreDial = ({
  value,
  color,
  trackColor = "#E8E4DA",
  size = 200,
  strokeWidth = 14,
  label,
  children,
}: ScoreDialProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const frac = Math.max(0, Math.min(100, value)) * 0.75;

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={label ?? `${Math.round(value)} out of 100`}
      >
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="75 25"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${frac} 100`}
          transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 600ms ease-out" }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ScoreDial;
