import type { StoredSession } from "@/lib/voice-history-client";
import { DASHBOARD_ZONES, DASHBOARD_ZONE_LABEL, dashboardZoneForSignal, type DashboardZone } from "@/lib/dashboard-body-zones";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import body from "@/assets/bodymap/body-full.png";

const POSITIONS: Record<DashboardZone, { left: string; top: string }> = {
  neurocognitive: { left: "50%", top: "9.5%" }, cardiorespiratory: { left: "43%", top: "26%" }, core: { left: "50%", top: "40.5%" },
};
export function DashboardBodyMap({ session, zone, onZoneChange, loading }: { session?: StoredSession; zone: DashboardZone | null; onZoneChange: (zone: DashboardZone | null) => void; loading: boolean }) {
  const signals = session?.signals ?? [];
  const available = DASHBOARD_ZONES.filter((z) => signals.some((s) => dashboardZoneForSignal(s.name) === z));
  const activeZone = zone && available.includes(zone) ? zone : available[0];
  const assessment = assessmentForSession(session);
  return <section className="dv-body-card"><div className="dv-body-heading"><div><h2>Your body map</h2><small>{loading ? "LOADING" : `${assessment.flaggedCount} / ${signals.length} FLAGGED`}</small></div><p>Explore the signals behind your profile.</p></div><div className="dv-body-canvas"><div className="dv-body-figure"><img src={body} alt="Thematic body map" />{available.map((z) => { const count = signals.filter((s) => dashboardZoneForSignal(s.name) === z).length; return <button key={z} style={POSITIONS[z]} className={`dv-zone dv-zone-${z}`} aria-label={`Explore ${DASHBOARD_ZONE_LABEL[z]}: ${count} returned signs`} aria-pressed={activeZone === z} onClick={() => onZoneChange(zone === z ? null : z)} />; })}</div><div className="dv-scan" aria-hidden="true" /></div><div className="dv-body-info" aria-live="polite"><h3>{activeZone ? DASHBOARD_ZONE_LABEL[activeZone] : "Neurocognitive · Cardiorespiratory · Core"}</h3></div></section>;
}
