import type { StoredSession } from "@/lib/voice-history-client";
import { BODY_ZONES, BODY_ZONE_LABEL, zoneForSignal, type BodyZone } from "@/lib/body-zone-map";
import { bandForSignal, bandLabelForSignal, isFlaggedBand, signLabel } from "@/lib/signal-band";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import body from "@/assets/bodymap/body-full.png";

const POSITIONS: Record<BodyZone, { left: string; top: string }> = {
  brain: { left: "50%", top: "9.5%" }, mouth: { left: "50%", top: "19.5%" }, heart: { left: "36%", top: "26%" }, core: { left: "50%", top: "33%" }, lungs: { left: "58%", top: "28.6%" }, blood: { left: "50%", top: "40.5%" },
};
export function DashboardBodyMap({ session, zone, onZoneChange, loading }: { session?: StoredSession; zone: BodyZone | null; onZoneChange: (zone: BodyZone | null) => void; loading: boolean }) {
  const signals = session?.signals ?? [];
  const available = BODY_ZONES.filter((z) => signals.some((s) => zoneForSignal(s.name) === z));
  const activeZone = zone && available.includes(zone) ? zone : available[0];
  const active = signals.filter((s) => zoneForSignal(s.name) === activeZone);
  const assessment = assessmentForSession(session);
  return <section className="dv-body-card"><div className="dv-body-heading"><div><h2>Your body map</h2><small>{loading ? "LOADING" : `${assessment.flaggedCount} / ${signals.length} FLAGGED`}</small></div><p>Explore the signals behind your profile.</p></div><div className="dv-body-canvas"><div className="dv-body-figure"><img src={body} alt="Thematic body map" />{available.map((z) => { const count = signals.filter((s) => zoneForSignal(s.name) === z).length; return <button key={z} style={POSITIONS[z]} className={`dv-zone dv-zone-${z}`} aria-label={`Explore ${BODY_ZONE_LABEL[z]}: ${count} returned signs`} aria-pressed={activeZone === z} onClick={() => onZoneChange(zone === z ? null : z)} />; })}</div><div className="dv-scan" aria-hidden="true" /><p>Thematic map · not organ measurements</p></div><div className="dv-body-info" aria-live="polite">{activeZone ? <><h3>{BODY_ZONE_LABEL[activeZone]}</h3>{active.map((s) => { const band = bandForSignal(s.name, s.level, s.score); return <div key={s.name}><span>{signLabel(s.name, s.label)}</span><strong className={isFlaggedBand(band) ? "dv-flagged" : "dv-unflagged"}>{bandLabelForSignal(s.name, band)}</strong></div>; })}<p>Review these voice signs in the context of how you feel.</p></> : <p>{loading ? "Loading your readings…" : "Your returned voice signs will appear here after a completed check-in."}</p>}</div></section>;
}
