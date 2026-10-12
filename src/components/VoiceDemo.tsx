import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * A looping demonstration of a check-in: someone speaks, the waveform responds,
 * the signals resolve.
 *
 * Deliberately NOT a video file and NOT a synthetic person. A photoreal figure
 * on a health page reads as a testimonial from a customer who does not exist,
 * and a real video would be a megabyte-scale asset blocked by the site's CSP
 * if it were ever hosted off-origin. This is vector and motion only, so it
 * costs nothing to load, stays sharp at any size, and is honest about being an
 * illustration of the product rather than a person endorsing it.
 *
 * The phase timings are compressed: a real check-in records for twenty seconds,
 * which is far too long to watch on a loop.
 */

type Phase = "speaking" | "analysing" | "result";

const SIGNALS = [
  { name: "Stress", level: "Moderate", pct: 0.58, tone: "#c2410c" },
  { name: "Energy", level: "Steady", pct: 0.71, tone: "#0d6a76" },
  { name: "Mental fatigue", level: "Elevated", pct: 0.64, tone: "#a94e08" },
  { name: "Focus", level: "Clear", pct: 0.79, tone: "#0d6a76" },
];

// Bar heights for the idle waveform. Fixed rather than random so the shape is
// stable across renders and does not flicker on re-mount.
const BARS = [
  0.22, 0.4, 0.68, 0.95, 0.62, 0.35, 0.55, 0.82, 1, 0.74, 0.45, 0.28, 0.5, 0.78,
  0.92, 0.6, 0.38, 0.66, 0.88, 0.7, 0.42, 0.3, 0.58, 0.84, 0.96, 0.64, 0.4, 0.26,
];

const PHASE_MS: Record<Phase, number> = {
  speaking: 4200,
  analysing: 1800,
  result: 4600,
};

export const VoiceDemo = () => {
  const reduceMotion = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("speaking");
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<number>();

  // Advance through the phases on a loop. Each phase schedules the next, so the
  // cycle self-corrects rather than drifting the way a single interval would.
  useEffect(() => {
    timer.current = window.setTimeout(() => {
      setPhase((p) => (p === "speaking" ? "analysing" : p === "analysing" ? "result" : "speaking"));
    }, PHASE_MS[phase]);
    return () => window.clearTimeout(timer.current);
  }, [phase]);

  // The counter only runs while speaking, and resets as that phase begins.
  useEffect(() => {
    if (phase !== "speaking") return;
    setSeconds(0);
    const id = window.setInterval(() => setSeconds((s) => Math.min(s + 1, 20)), 210);
    return () => window.clearInterval(id);
  }, [phase]);

  const speaking = phase === "speaking";

  return (
    <div
      className="relative mx-auto w-full max-w-[420px] select-none rounded-[28px] border border-black/10 bg-[#fbf7f1] px-7 py-8 shadow-[0_18px_50px_-24px_rgba(27,21,16,0.45)]"
      role="img"
      aria-label="A demonstration of a Serasona check-in: twenty seconds of speech resolving into seven wellness signals."
    >
      {/* Status line */}
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-black/50">
          {speaking ? "Listening" : phase === "analysing" ? "Reading" : "Your check-in"}
        </span>
        <div className="flex items-center gap-2">
          <motion.span
            className="h-[7px] w-[7px] rounded-full"
            style={{ background: speaking ? "#c2410c" : "#0d6a76" }}
            animate={reduceMotion || !speaking ? {} : { opacity: [1, 0.25, 1] }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="font-mono text-[10px] tabular-nums text-black/45">
            {speaking ? `0:${String(seconds).padStart(2, "0")}` : "0:20"}
          </span>
        </div>
      </div>

      {/* The speaker */}
      <div className="mt-7 flex items-center gap-5">
        <Figure speaking={speaking && !reduceMotion} />

        {/* Waveform */}
        <div className="flex h-16 flex-1 items-center justify-center gap-[2.5px]">
          {BARS.map((h, i) => (
            <motion.span
              key={i}
              className="w-[2.5px] rounded-full"
              style={{
                height: `${h * 100}%`,
                background: speaking ? "rgba(27,21,16,0.78)" : "rgba(27,21,16,0.18)",
              }}
              animate={
                reduceMotion || !speaking
                  ? { scaleY: 0.35 }
                  : { scaleY: [0.3, 1.15, 0.45, 0.9, 0.3] }
              }
              transition={{
                duration: 1.15 + (i % 6) * 0.13,
                repeat: Infinity,
                ease: "easeInOut",
                delay: (i % 9) * 0.07,
              }}
            />
          ))}
        </div>
      </div>

      {/* Lower panel */}
      <div className="mt-7 min-h-[168px] border-t border-black/10 pt-6">
        {phase === "analysing" ? (
          <div className="flex h-[150px] flex-col items-center justify-center gap-4">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-[#c2410c]"
                  animate={reduceMotion ? {} : { y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.85, repeat: Infinity, delay: i * 0.14 }}
                />
              ))}
            </div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-black/45">
              Reading seven signals
            </p>
          </div>
        ) : phase === "result" ? (
          <div className="space-y-3.5">
            {SIGNALS.map((s, i) => (
              <motion.div
                key={s.name}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.12 }}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[13px] text-black/75">{s.name}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-black/50">
                    {s.level}
                  </span>
                </div>
                <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-black/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: s.tone }}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${s.pct * 100}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.12, ease: "easeOut" }}
                  />
                </div>
              </motion.div>
            ))}
            <p className="pt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-black/35">
              Illustration · three more signals not shown
            </p>
          </div>
        ) : (
          <div className="flex h-[150px] items-center justify-center px-4">
            <p className="text-center text-[15px] leading-relaxed text-black/55">
              “I slept alright, maybe seven hours. Busy week, but I have been
              getting outside most days.”
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * A stylised speaker. The jaw and the sound arcs are the only moving parts,
 * which is enough to read as "talking" without approaching a real likeness.
 */
const Figure = ({ speaking }: { speaking: boolean }) => (
  <svg width="74" height="86" viewBox="0 0 74 86" fill="none" aria-hidden="true">
    {/* shoulders */}
    <path d="M9 86c0-15.5 12.5-25 28-25s28 9.5 28 25" fill="rgba(27,21,16,0.1)" />
    {/* head */}
    <circle cx="37" cy="33" r="22" fill="rgba(27,21,16,0.1)" />
    {/* brow */}
    <rect x="27" y="26" width="7" height="2.6" rx="1.3" fill="rgba(27,21,16,0.42)" />
    <rect x="40" y="26" width="7" height="2.6" rx="1.3" fill="rgba(27,21,16,0.42)" />
    {/* mouth, open and closing while speaking */}
    <motion.ellipse
      cx="37"
      cy="42"
      rx="6"
      fill="#c2410c"
      initial={false}
      animate={speaking ? { ry: [1.4, 4.6, 2.2, 5.2, 1.4] } : { ry: 1.4 }}
      transition={{ duration: 1.25, repeat: Infinity, ease: "easeInOut" }}
    />
    {/* sound arcs */}
    {[0, 1, 2].map((i) => (
      <motion.path
        key={i}
        d={`M${58 + i * 5} ${36 - i * 4}a${7 + i * 5} ${7 + i * 5} 0 0 1 0 ${14 + i * 10}`}
        stroke="#c2410c"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
        initial={false}
        animate={speaking ? { opacity: [0, 0.85, 0] } : { opacity: 0 }}
        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
      />
    ))}
  </svg>
);
