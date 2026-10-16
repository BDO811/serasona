/** A small trend line over recent sessions. Values are 0-100; nothing fancy,
 * just enough graphic weight to make a number read as a trend. */
export const Sparkline = ({
  values,
  color,
  height = 28,
}: {
  values: number[];
  color: string;
  height?: number;
}) => {
  if (values.length < 2) return null;
  const w = 100;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = height - 2 - (Math.max(0, Math.min(100, v)) / 100) * (height - 4);
    return [x, y] as const;
  });
  const path = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L");
  const [lastX, lastY] = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
    >
      <path
        d={`M${path}`}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill={color} />
    </svg>
  );
};
