import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { asset } from "@/lib/asset";

/**
 * A looping demonstration of a check-in: someone speaks, the waveform responds,
 * the signals resolve.
 *
 * The face is licensed stock footage of a real person rather than a generated
 * one: a synthetic human on a health page is a customer who does not exist, and
 * generating one would also not be what was asked for. The clip is served from
 * this origin, not a CDN, so no external host has to be trusted. See Speaker
 * below for the encoding.
 *
 * Everything around the face is vector and motion, which is why the whole
 * demonstration costs well under 100 KB.
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
        <Speaker speaking={speaking && !reduceMotion} />

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
 * The speaker.
 *
 * Licensed stock footage of a real person, cropped to the face and encoded at
 * 300px square: roughly 120 KB per format with a 7 KB poster, which is still
 * small enough to be safe on a phone over cellular.
 *
 * It plays only while the demo is in its speaking phase and is paused
 * otherwise, which keeps a looping face from pulling attention through the
 * rest of the cycle and keeps the decode off the main thread when idle.
 *
 * She is an illustration of the product, not a customer: nothing here is
 * captioned as a testimonial, and the card labels itself an illustration.
 */
const Speaker = ({ speaking }: { speaking: boolean }) => {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (speaking) {
      // Autoplay can still be refused; a paused poster is an acceptable result,
      // so the rejection is swallowed rather than surfaced.
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [speaking]);

  return (
    <div className="relative h-[74px] w-[74px] shrink-0 overflow-hidden rounded-full bg-black/[0.06]">
      <video
        ref={ref}
        className="h-full w-full object-cover"
        poster={asset("video/speaker-poster.jpg")}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      >
        <source src={asset("video/speaker.webm")} type="video/webm" />
        <source src={asset("video/speaker.mp4")} type="video/mp4" />
      </video>
      {/* Warms the clip's white studio background into the card's paper. */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-[#c2410c] mix-blend-multiply opacity-[0.06]" />
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/10" />
    </div>
  );
};
