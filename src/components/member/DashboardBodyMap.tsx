import { useEffect, useRef } from "react";
import type { StoredSession } from "@/lib/voice-history-client";
import { DASHBOARD_ZONES, DASHBOARD_ZONE_LABEL, dashboardZoneForSignal, type DashboardZone } from "@/lib/dashboard-body-zones";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import { asset } from "@/lib/asset";
import { useMemberMotion } from "@/components/member/MemberShell";

type BodyFigure = "male" | "female";

/**
 * Each zone marks a point on the FRONT surface of the body (skull center,
 * chest, upper abdomen). As the turntable video turns, that surface point
 * physically orbits the body's own vertical axis along with it, so the dot
 * is animated to match: `left` is the point's resting (front-facing)
 * position and `radius` is how far it swings left/right at the apex of the
 * turn, both as a percentage of the figure's own width. `top` never changes
 * - a yaw rotation around a vertical axis doesn't move a point vertically.
 *
 * `radius` is the body's front-to-back DEPTH at that height, not its
 * left-right width - measured off the quarter-turn (profile) frame, where
 * the visible silhouette width directly IS that depth. Using the front-view
 * width instead (an earlier version of this did) overshoots: the dot would
 * swing out to that full width at the apex of the turn, but the video's own
 * silhouette has by then foreshortened to the narrower profile, so the dot
 * floated in the black background past the body's actual edge.
 *
 * The two renders turn in opposite screen directions (independent AI video
 * generations, not mirrored renders of one clip) - `direction` in
 * ROTATION_DIRECTION below corrects for that per figure.
 */
const POSITIONS: Record<BodyFigure, Record<DashboardZone, { left: number; top: string; radius: number }>> = {
  male: {
    neurocognitive: { left: 49.9, top: "16.5%", radius: 5.5 },
    cardiorespiratory: { left: 50, top: "30%", radius: 8.3 },
    core: { left: 50, top: "40.5%", radius: 10.4 },
  },
  female: {
    neurocognitive: { left: 50.2, top: "16.5%", radius: 10.1 },
    cardiorespiratory: { left: 48.4, top: "30%", radius: 8.9 },
    core: { left: 48.3, top: "40.5%", radius: 12.2 },
  },
};

/** Which screen direction each figure's front surface sweeps toward first, measured off the rendered video. */
const ROTATION_DIRECTION: Record<BodyFigure, 1 | -1> = { male: 1, female: -1 };

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
  const figure: BodyFigure = bodySex === "female" ? "female" : "male";
  const moving = useMemberMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const dotRefs = useRef<Partial<Record<DashboardZone, HTMLButtonElement | null>>>({});

  // Orbits each zone dot around the body's own vertical axis in lockstep
  // with the video's rotation (see the POSITIONS/ROTATION_DIRECTION comment
  // above for the geometry), instead of sitting still while the figure
  // turns underneath it. Runs as an imperative rAF loop against DOM refs,
  // not React state, so it doesn't re-render the component 60 times a
  // second - only the dots' own style updates each frame.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const direction = ROTATION_DIRECTION[figure];
    const zonePositions = POSITIONS[figure];
    let raf = 0;
    const tick = () => {
      const duration = video.duration;
      const canOrbit = moving && !document.hidden && Number.isFinite(duration) && duration > 0;
      // theta=0 is front-facing (the resting position below); it sweeps
      // through the body's own full turn as the video plays.
      const theta = canOrbit ? (video.currentTime / duration) * Math.PI * 2 * direction : 0;
      const depth = Math.cos(theta); // >0 faces the camera, <0 is around the back
      const scaleX = Math.max(0.28, Math.abs(depth)); // foreshortens toward profile, never collapses flat
      // Fades out over a short band straddling edge-on (depth 0) rather than
      // vanishing the instant the point passes the silhouette, or staying
      // visible after it's rotated onto the body's far side.
      const opacity = Math.min(1, Math.max(0, (depth + 0.08) / 0.16));
      for (const z of DASHBOARD_ZONES) {
        const el = dotRefs.current[z];
        if (!el) continue;
        const pos = zonePositions[z];
        const left = pos.left + pos.radius * Math.sin(theta);
        el.style.left = `${left}%`;
        el.style.opacity = canOrbit ? String(opacity) : "1";
        el.style.setProperty("--zone-scale-x", canOrbit ? String(scaleX) : "1");
        // Depth cue: orbs read slightly larger and brighter on the near side of the turn, smaller and dimmer as they swing toward the back.
        el.style.setProperty("--zone-depth", canOrbit ? String(0.88 + 0.12 * Math.max(0, depth)) : "1");
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [moving, figure]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Prefer hardware decoded H.264 and retry when media becomes ready or
    // the tab returns. A single mount-time play() can be rejected on Safari.
    const syncPlayback = () => {
      if (!moving || document.hidden) { video.pause(); return; }
      video.muted = true;
      video.defaultMuted = true;
      void video.play()?.catch(() => {});
    };
    syncPlayback();
    video.addEventListener("canplay", syncPlayback);
    document.addEventListener("visibilitychange", syncPlayback);
    window.addEventListener("pageshow", syncPlayback);
    window.addEventListener("pointerdown", syncPlayback);
    window.addEventListener("keydown", syncPlayback);
    return () => {
      video.removeEventListener("canplay", syncPlayback);
      document.removeEventListener("visibilitychange", syncPlayback);
      window.removeEventListener("pageshow", syncPlayback);
      window.removeEventListener("pointerdown", syncPlayback);
      window.removeEventListener("keydown", syncPlayback);
      video.pause();
    };
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
        <video key={figure} ref={videoRef} autoPlay={moving} muted loop playsInline preload="auto" aria-hidden="true" style={{ filter: "none" }}><source src={asset(`video/body-${figure}.mp4`)} type="video/mp4" /><source src={asset(`video/body-${figure}.webm`)} type="video/webm" /></video>
        {available.map((z) => {
          const count = signals.filter((s) => dashboardZoneForSignal(s.name) === z).length;
          const pos = POSITIONS[figure][z];
          return <button key={z} ref={(el) => { dotRefs.current[z] = el; }} style={{ left: `${pos.left}%`, top: pos.top, ["--dot-color" as string]: ZONE_COLOR[z], ["--zone-scale-x" as string]: 1 }} className={`dv-zone dv-dot dv-zone-${z} ${abnormal[z] ? "is-abnormal" : ""}`} aria-label={`Explore ${DASHBOARD_ZONE_LABEL[z]}: ${count} returned signs`} aria-pressed={activeZone === z} onClick={() => onZoneChange(zone === z ? null : z)} />;
        })}
      </div>
      <div className="dv-scan" aria-hidden="true" />
    </div>
    <div className="dv-body-info" aria-live="polite"><h3>{activeZone ? DASHBOARD_ZONE_LABEL[activeZone] : "Neurocognitive · Cardiorespiratory · Core"}</h3></div>
  </section>;
}
