import { useEffect, useRef } from "react";
import type { StoredSession } from "@/lib/voice-history-client";
import { DASHBOARD_ZONES, DASHBOARD_ZONE_LABEL, dashboardZoneForSignal, type DashboardZone } from "@/lib/dashboard-body-zones";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import { asset } from "@/lib/asset";
import { useMemberMotion } from "@/components/member/MemberShell";

/**
 * The figure rotates a full 360 degrees, but each of these points sits close
 * enough to the body's own vertical turntable axis (head center, chest
 * center, navel) that its on-screen position barely shifts as the body
 * turns - a few percent at most, measured directly off the rendered frames.
 * A marker that chased that small per-frame drift read as jittery rather
 * than deliberate, so each zone gets one fixed point instead.
 */
const POSITIONS: Record<DashboardZone, { left: string; top: string }> = {
  neurocognitive: { left: "49%", top: "16.5%" }, cardiorespiratory: { left: "48%", top: "30%" }, core: { left: "49%", top: "40.5%" },
};

/**
 * Same per-zone identity colors as the PDF report's body map (BodyMapPanel.tsx
 * ZONE_COLOR), so a region reads as the same color on the live dashboard as
 * on a downloaded report, not just "pink means bad" everywhere.
 */
const ZONE_COLOR: Record<DashboardZone, string> = {
  neurocognitive: "#1d5fa8", // metric-hydration
  cardiorespiratory: "#7b2d5e", // metric-stress
  core: "#0d6a76", // tide
};
const ALL_COLOR = "#1b1510"; // ink
type LegendKey = "all" | DashboardZone;
const LEGEND: Array<{ key: LegendKey; label: string; color: string }> = [
  { key: "all", label: "ALL", color: ALL_COLOR },
  { key: "neurocognitive", label: "NEURO", color: ZONE_COLOR.neurocognitive },
  { key: "cardiorespiratory", label: "CARDIO", color: ZONE_COLOR.cardiorespiratory },
  { key: "core", label: "CORE", color: ZONE_COLOR.core },
];

export function DashboardBodyMap({ session, zone, onZoneChange, loading, bodySex }: { session?: StoredSession; zone: DashboardZone | null; onZoneChange: (zone: DashboardZone | null) => void; loading: boolean; bodySex?: string }) {
  const signals = session?.signals ?? [];
  const available = DASHBOARD_ZONES.filter((z) => signals.some((s) => dashboardZoneForSignal(s.name) === z));
  const activeZone = zone && available.includes(zone) ? zone : available[0];
  const assessment = assessmentForSession(session);
  const figure = bodySex === "female" ? "female" : "male";
  const moving = useMemberMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (moving) video.play()?.catch(() => {});
    else video.pause();
  }, [moving, figure]);

  const abnormal: Record<DashboardZone, boolean> = {
    neurocognitive: signals.some((s) => s.flagged && dashboardZoneForSignal(s.name) === "neurocognitive"),
    cardiorespiratory: signals.some((s) => s.flagged && dashboardZoneForSignal(s.name) === "cardiorespiratory"),
    core: signals.some((s) => s.flagged && dashboardZoneForSignal(s.name) === "core"),
  };
  const anyAbnormal = DASHBOARD_ZONES.some((z) => abnormal[z]);

  return <section className="dv-body-card">
    <div className="dv-body-heading">
      <div><h2>Your body map</h2><small>{loading ? "LOADING" : `${assessment.flaggedCount} / ${signals.length} FLAGGED`}</small></div>
      <p>Explore the signals behind your profile.</p>
      <div className="dv-legend" role="group" aria-label="Filter by body region">
        {LEGEND.map((item) => {
          const isAbnormal = item.key === "all" ? anyAbnormal : abnormal[item.key];
          const isActive = item.key === "all" ? zone === null : zone === item.key;
          return <button key={item.key} type="button" className="dv-legend-dot" aria-pressed={isActive} aria-label={item.key === "all" ? "Show all signals" : `Filter to ${DASHBOARD_ZONE_LABEL[item.key]}`} onClick={() => onZoneChange(item.key === "all" ? null : item.key)}>
            <span className={`dv-legend-swatch dv-dot ${isAbnormal ? "is-abnormal" : ""}`} style={{ ["--dot-color" as string]: item.color }} />
            <small>{item.label}</small>
          </button>;
        })}
      </div>
    </div>
    <div className="dv-body-canvas">
      <div className="dv-body-figure">
        <video key={figure} ref={videoRef} autoPlay={moving} muted loop playsInline aria-hidden="true"><source src={asset(`video/body-${figure}.webm`)} type="video/webm" /><source src={asset(`video/body-${figure}.mp4`)} type="video/mp4" /></video>
        {available.map((z) => {
          const count = signals.filter((s) => dashboardZoneForSignal(s.name) === z).length;
          return <button key={z} style={{ ...POSITIONS[z], ["--dot-color" as string]: ZONE_COLOR[z] }} className={`dv-zone dv-dot dv-zone-${z} ${abnormal[z] ? "is-abnormal" : ""}`} aria-label={`Explore ${DASHBOARD_ZONE_LABEL[z]}: ${count} returned signs`} aria-pressed={activeZone === z} onClick={() => onZoneChange(zone === z ? null : z)} />;
        })}
      </div>
      <div className="dv-scan" aria-hidden="true" />
    </div>
    <div className="dv-body-info" aria-live="polite"><h3>{activeZone ? DASHBOARD_ZONE_LABEL[activeZone] : "Neurocognitive · Cardiorespiratory · Core"}</h3></div>
  </section>;
}
