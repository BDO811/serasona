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
  neurocognitive: { left: "49%", top: "13.5%" }, cardiorespiratory: { left: "48%", top: "26%" }, core: { left: "49%", top: "40.5%" },
};
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
    if (moving) video.play().catch(() => {});
    else video.pause();
  }, [moving, figure]);
  return <section className="dv-body-card"><div className="dv-body-heading"><div><h2>Your body map</h2><small>{loading ? "LOADING" : `${assessment.flaggedCount} / ${signals.length} FLAGGED`}</small></div><p>Explore the signals behind your profile.</p></div><div className="dv-body-canvas"><div className="dv-body-figure"><video key={figure} ref={videoRef} autoPlay={moving} muted loop playsInline aria-hidden="true"><source src={asset(`video/body-${figure}.webm`)} type="video/webm" /><source src={asset(`video/body-${figure}.mp4`)} type="video/mp4" /></video>{available.map((z) => { const count = signals.filter((s) => dashboardZoneForSignal(s.name) === z).length; return <button key={z} style={POSITIONS[z]} className={`dv-zone dv-zone-${z}`} aria-label={`Explore ${DASHBOARD_ZONE_LABEL[z]}: ${count} returned signs`} aria-pressed={activeZone === z} onClick={() => onZoneChange(zone === z ? null : z)} />; })}</div><div className="dv-scan" aria-hidden="true" /></div><div className="dv-body-info" aria-live="polite"><h3>{activeZone ? DASHBOARD_ZONE_LABEL[activeZone] : "Neurocognitive · Cardiorespiratory · Core"}</h3></div></section>;
}
