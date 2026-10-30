import { RUNG_SCALE } from "@/lib/result-headline";

// Shared by the dashboard's main score and every index. No green accents.
export const DASHBOARD_SCORE_SCALE = RUNG_SCALE;
const WEIGHTS: Record<string, number> = { clean: 10, good: 23, steady: 33, focus: 34 };

export function ScorePositionScale({ value, label }: { value: number | null; label: string }) {
  const position = value != null && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : null;
  return <div className="score-position" role="img" aria-label={`${label}: ${position == null ? "no reading" : `${position} out of 100`}. Scale 0 to 100`}>
    <div className="score-position-labels" aria-hidden="true"><span>100</span><span>50</span><span>0</span></div>
    <div className="member-metric-scale" aria-hidden="true">
      {[...DASHBOARD_SCORE_SCALE].reverse().map((segment) => <span key={segment.key} className="member-metric-scale-seg" style={{ background: segment.colorLight, flexGrow: WEIGHTS[segment.key] }} />)}
      {position != null && <span className="member-metric-scale-dot" style={{ bottom: `${position}%` }} />}
    </div>
  </div>;
}
