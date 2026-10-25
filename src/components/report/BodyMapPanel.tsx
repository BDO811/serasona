import { motion } from "framer-motion";
import type { ExtendedMetric, LabMetric, SignalSummary } from "@/lib/result-types";
import {
  bandColor,
  bandColorForSignal,
  bandForSignal,
  bandLabelForSignal,
  bandScaleOptions,
  signLabel,
} from "@/lib/signal-band";
import { readableSubDimensions } from "@/lib/sub-dimensions";
import {
  BODY_ZONE_LABEL,
  BODY_ZONES,
  type BodyZone,
  zoneForLabMetric,
  zoneForSignal,
  zoneForSubDimension,
} from "@/lib/body-zone-map";
import { OptionScale, type ScaleOption } from "./OptionScale";
import bodyFull from "@/assets/bodymap/body-full.png";
import iconBrain from "@/assets/bodymap/icon-brain.png";
import iconMouth from "@/assets/bodymap/icon-mouth.png";
import iconHeart from "@/assets/bodymap/icon-heart.png";
import iconCore from "@/assets/bodymap/icon-core.png";
import iconLungs from "@/assets/bodymap/icon-lungs.png";
import iconBlood from "@/assets/bodymap/icon-blood.png";

interface BodyMapPanelProps {
  signals: SignalSummary[];
  extendedMetrics: ExtendedMetric[] | undefined;
  labMetrics: LabMetric[];
  showContent: boolean;
  isHighVis?: boolean;
  isSeniorMode?: boolean;
}

const ZONE_ICON: Record<BodyZone, string> = {
  brain: iconBrain,
  mouth: iconMouth,
  heart: iconHeart,
  core: iconCore,
  lungs: iconLungs,
  blood: iconBlood,
};

/**
 * Position of each zone's marker on body-full.png, as a fraction of its box.
 * Heart sits on the body's actual left side (the viewer's left, since the
 * figure faces forward) rather than dead-center, since it is standing in for
 * the heart specifically. Core sits at the solar plexus, between heart and
 * blood, for the "body chakra" read.
 */
const ZONE_MARKER_POSITION: Record<BodyZone, { left: string; top: string }> = {
  brain: { left: "50%", top: "9.5%" },
  mouth: { left: "50%", top: "19.5%" },
  heart: { left: "36%", top: "26%" },
  core: { left: "50%", top: "33%" },
  lungs: { left: "58%", top: "28.6%" },
  blood: { left: "50%", top: "40.5%" },
};

/**
 * Each zone gets its own identity shade, drawn from the bone neutral scale
 * rather than a hue, so the marker on the figure and the zone-header dot are
 * recognizably the same zone from across the screen without spending any of
 * Bone and Signal's three meaning-bearing colors (steady/info/alert) on an
 * identity mark. None of this touches the severity scale colors in
 * signal-band.ts, which stay as they are.
 */
const ZONE_COLOR: Record<BodyZone, string> = {
  brain: "#111111", // bone-900 - cognitive zone
  mouth: "#4A4741", // bone-700 - mouth/dehydration
  heart: "#2B2926", // bone-800 - cardiovascular
  core: "#6B675F", // bone-600 - body-wide energy/chakra center
  lungs: "#8F897D", // bone-500 - breath
  blood: "#4A4741", // bone-700 - blood/metabolic
};

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Mirrors SubDimensionPanel's DIRECTION_COLORS (unfavourable, middle,
 * favourable at indices 0/1/2 there; this scale is drawn favourable-left to
 * match every other scale on the report, so the order here is reversed).
 */
const SUBDIM_SCALE_COLOR: Array<{ dark: string; light: string }> = [
  { dark: "#EE8E8A", light: "#7F1D1D" }, // unfavourable - alert
  { dark: "#8FA9F5", light: "#1E3A8A" }, // middle - info
  { dark: "#7CC49A", light: "#0F5132" }, // favourable - steady
];

interface SignalRow {
  kind: "signal";
  key: string;
  label: string;
  bandWord: string;
  scale: ScaleOption[];
  activeKey: string | null;
  isAbnormal: boolean;
}

interface SubDimRow {
  kind: "subdim";
  key: string;
  label: string;
  scoreMean: number;
  scoreStd: number;
  scale: ScaleOption[];
  activeKey: string;
  isAbnormal: boolean;
}

interface LabRow {
  kind: "lab";
  key: string;
  label: string;
  value: string;
  unit: string;
  reference: string;
  isAbnormal: boolean;
}

type ZoneRow = SignalRow | SubDimRow | LabRow;

interface ZoneGroup {
  zone: BodyZone;
  hasAbnormal: boolean;
  hasData: boolean;
  signalRows: SignalRow[];
  subDimRows: SubDimRow[];
  labRows: LabRow[];
}

function buildZoneGroups(
  signals: SignalSummary[],
  extendedMetrics: ExtendedMetric[] | undefined,
  labMetrics: LabMetric[]
): Record<BodyZone, ZoneGroup> {
  const groups = Object.fromEntries(
    BODY_ZONES.map((zone) => [
      zone,
      { zone, hasAbnormal: false, hasData: false, signalRows: [], subDimRows: [], labRows: [] },
    ])
  ) as Record<BodyZone, ZoneGroup>;

  for (const sig of signals) {
    const band = bandForSignal(sig.name, sig.level);
    if (band === "INCONCLUSIVE") continue;
    const zone = zoneForSignal(sig.name);
    /*
      Not a raw isFlaggedBand check: fatigue/stress/anxiety display LOW in the
      same green as NORMAL (GREEN_THROUGH_LOW in signal-band.ts — "a faint
      indicator here is not something to act on"), so flashing them at LOW
      would blink a row the app itself is showing as fine. Comparing the row's
      actual displayed colour against NORMAL's is what the rest of the report
      already uses to decide this, so it is reused here rather than
      re-deriving the same exception.
    */
    const isAbnormal = bandColorForSignal(sig.name, band, "dark") !== bandColor("NORMAL", "dark");
    groups[zone].signalRows.push({
      kind: "signal",
      key: `signal-${sig.name}`,
      label: signLabel(sig.name, sig.label),
      bandWord: bandLabelForSignal(sig.name, band),
      scale: bandScaleOptions(sig.name),
      activeKey: band,
      isAbnormal,
    });
    groups[zone].hasData = true;
    if (isAbnormal) groups[zone].hasAbnormal = true;
  }

  for (const row of readableSubDimensions(extendedMetrics)) {
    const zone = zoneForSubDimension(row.id);
    const isAbnormal = !row.neutral && row.bandIndex === 2;
    /*
      row.levels is always [favourable, "NORMAL", unfavourable] (see
      sub-dimensions.ts), but SUBDIM_SCALE_COLOR is indexed the other way
      round - [unfavourable, middle, favourable] - matching
      SubDimensionPanel's own DIRECTION_COLORS. Indexing it with the same `i`
      used to walk row.levels paired favourable with the unfavourable colour
      and vice versa; `2 - i` maps each label to its actual semantic colour
      before the array is reversed for favourable-left display.
    */
    const scale: ScaleOption[] = row.levels
      .map((label, i) => ({
        key: String(i),
        label,
        color: SUBDIM_SCALE_COLOR[2 - i].dark,
        colorLight: SUBDIM_SCALE_COLOR[2 - i].light,
      }))
      .reverse();
    groups[zone].subDimRows.push({
      kind: "subdim",
      key: `subdim-${row.id}`,
      label: row.label,
      scoreMean: row.scoreMean,
      scoreStd: row.scoreStd,
      scale,
      activeKey: String(row.bandIndex),
      isAbnormal,
    });
    groups[zone].hasData = true;
    if (isAbnormal) groups[zone].hasAbnormal = true;
  }

  /*
    Raw acoustic lab metrics (pitch, loudness, jitter, shimmer, HNR, pause,
    breathiness...) are intentionally not shown here - they read as a wall of
    unexplained numbers to a non-clinical visitor, where the signal and
    sub-dimension rows above already carry the same information in words. The
    loop stays rather than being deleted so turning them back on is a one-line
    change, not a rebuild of labMetrics plumbing through every call site.
  */
  for (const metric of [] as typeof labMetrics) {
    const zone = zoneForLabMetric(metric.label);
    const isAbnormal = metric.status !== "normal";
    groups[zone].labRows.push({
      kind: "lab",
      key: `lab-${metric.label}`,
      label: metric.label,
      value: metric.value,
      unit: metric.unit,
      reference: metric.reference,
      isAbnormal,
    });
    groups[zone].hasData = true;
    if (isAbnormal) groups[zone].hasAbnormal = true;
  }

  return groups;
}

/**
 * Groups every real measurement Sona-2 reports (signals, sub-dimensions, lab
 * metrics) under the body-part icon it reads on, with a marker on a full-body
 * graphic at the top showing where each group lives. A row or marker that is
 * off-normal breathes slowly (.animate-gentle-blink); everything in range
 * stays still, so stillness itself is informative.
 *
 * Single-column by design: the report chassis is a fixed max-w-[500px] at
 * every viewport (see HealthProfile.tsx), so there is no width to split the
 * body graphic and the measurement list side by side the way an earlier
 * desktop-width mock of this showed it. Correlation between a body marker and
 * its group is by colour (red = flagged, matching the group's own header dot)
 * rather than a drawn line.
 */
export const BodyMapPanel = ({
  signals,
  extendedMetrics,
  labMetrics,
  showContent,
  isHighVis = false,
  isSeniorMode = false,
}: BodyMapPanelProps) => {
  const groups = buildZoneGroups(signals, extendedMetrics, labMetrics);
  const zonesWithData = BODY_ZONES.filter((z) => groups[z].hasData);
  if (zonesWithData.length === 0) return null;

  const labelSize = isSeniorMode
    ? "text-sm font-semibold text-white"
    : isHighVis
      ? "text-[11px] font-medium text-white"
      : "text-[10px] font-medium text-white";
  const zoneNameSize = isSeniorMode ? "text-sm" : isHighVis ? "text-[11px]" : "text-[10px]";

  return (
    <div>
      {/* Full-body graphic with a marker per zone that has data. */}
      <div
        className="relative mx-auto mb-3 rounded-lg overflow-hidden"
        style={{ backgroundColor: "#111111", maxWidth: 220 }}
      >
        <img src={bodyFull} alt="" className="w-full h-auto block" />
        {zonesWithData.map((zone) => {
          const g = groups[zone];
          const pos = ZONE_MARKER_POSITION[zone];
          const color = ZONE_COLOR[zone];
          return (
            <span
              key={zone}
              className={`absolute rounded-full ${g.hasAbnormal ? "animate-bodymap-marker-flash" : ""}`}
              style={{
                left: pos.left,
                top: pos.top,
                width: 4.5,
                height: 4.5,
                transform: "translate(-50%, -50%)",
                background: color,
                boxShadow: g.hasAbnormal
                  ? `0 0 10px 4px ${hexToRgba(color, 0.75)}`
                  : `0 0 5px 1.5px ${hexToRgba(color, 0.45)}`,
              }}
            />
          );
        })}
      </div>

      {/* One section per zone, icon header first, then every row it carries. */}
      <div className="flex flex-col gap-3">
        {zonesWithData.map((zone, zoneIndex) => {
          const g = groups[zone];
          const rows: ZoneRow[] = [...g.signalRows, ...g.subDimRows, ...g.labRows];
          return (
            <motion.div
              key={zone}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 8 }}
              transition={{ delay: 1.15 + zoneIndex * 0.08, duration: 0.3 }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <img src={ZONE_ICON[zone]} alt="" className="w-6 h-6 opacity-90" />
                <span className={`font-mono uppercase tracking-widest ${zoneNameSize} text-[#111111]`}>
                  {BODY_ZONE_LABEL[zone]}
                </span>
                {/* Static, not blinking: the marker on the body graphic
                    above is the only thing on this screen that glows. */}
                {g.hasAbnormal && (
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ZONE_COLOR[zone] }} />
                )}
              </div>

              <div className="flex flex-col gap-px bg-[#111111]/15 rounded-lg overflow-hidden">
                {rows.map((row) => {
                  if (row.kind === "lab") {
                    return (
                      <div
                        key={row.key}
                        className={`bg-black/85 flex items-baseline gap-2 ${
                          isSeniorMode ? "px-4 py-3" : isHighVis ? "px-3.5 py-2.5" : "px-3 py-2"
                        } ${row.isAbnormal ? "animate-gentle-blink" : ""}`}
                      >
                        <span className={`font-mono uppercase tracking-wider ${labelSize}`}>{row.label}</span>
                        <span
                          className="font-mono text-[11px] font-semibold"
                          style={{ color: row.isAbnormal ? "#D12B26" : "#177A4B" }}
                        >
                          {row.value}
                        </span>
                        <span className="font-mono text-[9px] text-white/50">{row.unit}</span>
                        <span className="font-mono text-[8px] text-white/35 ml-auto">{row.reference}</span>
                      </div>
                    );
                  }

                  const scoreText =
                    row.kind === "subdim" ? (
                      <span className="font-mono tabular-nums text-white/70 text-[9px] flex-shrink-0">
                        {row.scoreMean.toFixed(2)}
                        <span className="text-white/50"> &plusmn;{row.scoreStd.toFixed(2)}</span>
                      </span>
                    ) : null;

                  return (
                    <div
                      key={row.key}
                      className={`bg-black/85 ${
                        isSeniorMode ? "px-4 py-4" : isHighVis ? "px-3.5 py-3" : "px-3 py-2.5"
                      } ${row.isAbnormal ? "animate-gentle-blink" : ""}`}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <span className={`font-mono uppercase tracking-wider truncate ${labelSize}`}>
                          {row.label}
                        </span>
                        {row.kind === "signal" ? (
                          <span
                            className={`font-mono flex-shrink-0 ${isSeniorMode ? "text-xs" : "text-[10px]"}`}
                            style={{ color: "#2F5BEA" }}
                          >
                            {row.bandWord}
                          </span>
                        ) : (
                          scoreText
                        )}
                      </div>
                      <OptionScale
                        options={row.scale}
                        activeKey={row.activeKey}
                        ariaLabel={`${row.label}: ${row.kind === "signal" ? row.bandWord : ""}`}
                        {...(row.kind === "subdim" ? { dimOpacity: 0.8 } : {})}
                      />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default BodyMapPanel;
