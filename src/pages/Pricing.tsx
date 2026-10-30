import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock } from "lucide-react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { startCheckout, openBillingPortal } from "@/lib/billing-client";
import { DEMO_MODE, demoAuth } from "@/lib/demo-mode";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import type { PlanId } from "@/context/AuthContext";
import { MODELS, ADDON_MODELS, type VoiceModel } from "@/lib/models";

type Interval = "monthly" | "annual";

interface Tier {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  annualPrice?: number;
  description: string;
  upgradeReason: string;
  features: string[];
  trialDays?: number;
  highlighted?: boolean;
  /** One accent per tier (reused from the model catalogue's own tones), so the
   * card that reads Pulse-only, the one that adds three models and the one
   * that carries the whole catalogue each read as a distinct colour, not
   * three identical black-on-cream boxes. */
  accent: string;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Try it",
    monthlyPrice: 0,
    description: "Three check-ins a day. No card required.",
    upgradeReason: "A real daily habit, not a one-off demo.",
    accent: "#177A4B",
    features: [
      "3 check-ins a day, the Pulse model",
      "A real 7-day trend of your own voice",
      "Older check-ins lock once you pass 7 days",
    ],
  },
  {
    id: "core",
    name: "Core",
    monthlyPrice: 7.99,
    annualPrice: 59.99,
    description: "One check-in a day on the Pulse model, tracked against your own history.",
    upgradeReason: "See your full history, not just a week.",
    trialDays: 7,
    accent: "#2F5BEA",
    features: [
      "Unlimited daily check-ins",
      "The Pulse model: mood, anxiety, stress, fatigue, hydration, blood pressure",
      "Your complete longitudinal trend, never locked",
      "Add any other model for $4.99/month",
    ],
    highlighted: true,
  },
  {
    id: "plus",
    name: "Plus",
    monthlyPrice: 14.99,
    annualPrice: 119,
    description: "Everything in Core, plus three models of your choice and a daily call.",
    upgradeReason: "Add a daily phone call, no app required.",
    accent: "#A8201C",
    features: [
      "Everything in Core",
      "Any three models included, worth $14.97 on their own",
      "A daily call, any phone, no app required",
      "Your result still lands in the app either way",
    ],
  },
  {
    id: "executive",
    name: "Executive",
    monthlyPrice: 19.99,
    annualPrice: 179,
    description: "Every model Serasona has, read from the same twenty seconds.",
    upgradeReason: "Every model, from the same twenty seconds.",
    accent: "#7F1D1D",
    features: [
      "Everything in Plus",
      "All seven models included, worth $34.93 on their own",
      "A report you can hand to a clinician",
      "Priority support",
    ],
  },
];

/** Whole-dollar annual prices read cleaner without trailing zeros (e.g. "$119" not "$119.00"). */
const formatPrice = (amount: number) => (Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`);

const annualMonthlyEquivalent = (tier: Tier) => (tier.annualPrice ? tier.annualPrice / 12 : null);

const annualSavingsPct = (tier: Tier) => {
  if (!tier.annualPrice) return null;
  const fullYear = tier.monthlyPrice * 12;
  return Math.round(((fullYear - tier.annualPrice) / fullYear) * 100);
};

/**
 * An illustrative month of stress check-ins: not a counter climbing from
 * zero, a day-by-day line across thirty days that rises into the high range
 * and eases back down, same as a real stretch of a demanding month would
 * read. Static and representative, not wired to any account's actual data —
 * the same "show the goods" role as a product screenshot.
 *
 * Hand-drawn SVG, animated imperatively (direct attribute writes on every
 * frame rather than React state) so a 30-point reveal stays smooth at 60fps.
 * The line reads calm in the app's ink color until the value crosses 50,
 * then it and the live number switch to the destructive red and pulse —
 * the same stress-flag semantics as DashboardTrends, just driven by a
 * fixed illustrative curve instead of real sessions.
 *
 * Styled after the comet-drawn, glowing curve and popping keyframes of
 * Anthropic's scenario-kinetic-film skill (the Graph block this page used
 * to render to video): a soft bloom filter on the line and head, a fading
 * comet tail trailing the head, five keyframe diamonds that pop open as
 * the line passes them, and a one-shot expanding ring exactly where the
 * curve crosses the 50 line in either direction.
 */
const STRESS_DAYS = [
  30, 31, 33, 34, 37, 39, 42, 44, 47, 49, 52, 55, 58, 61, 63, 65, 67, 68, 67, 65, 62, 59, 55, 51, 48, 45, 42, 39, 36, 34,
];
const STRESS_THRESHOLD = 50;
const STRESS_VIEW_W = 960;
const STRESS_VIEW_H = 450;
const STRESS_PAD = { l: 44, r: 20, t: 20, b: 46 };
const STRESS_PLOT_W = STRESS_VIEW_W - STRESS_PAD.l - STRESS_PAD.r;
const STRESS_PLOT_H = STRESS_VIEW_H - STRESS_PAD.t - STRESS_PAD.b;
const STRESS_POINTS: Array<readonly [number, number]> = STRESS_DAYS.map((value, i) => [
  STRESS_PAD.l + (i / (STRESS_DAYS.length - 1)) * STRESS_PLOT_W,
  STRESS_PAD.t + STRESS_PLOT_H - (value / 100) * STRESS_PLOT_H,
]);
const STRESS_FULL_PATH = STRESS_POINTS.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
const STRESS_THRESHOLD_Y = STRESS_PAD.t + STRESS_PLOT_H - (STRESS_THRESHOLD / 100) * STRESS_PLOT_H;
const STRESS_BASELINE_Y = STRESS_PAD.t + STRESS_PLOT_H;
/** Twice the pace of the first cut: a brisk, lively draw rather than a slow crawl. */
const STRESS_DRAW_MS = 9000;
const STRESS_HOLD_MS = 1300;
const STRESS_RESET_MS = 350;
const STRESS_CYCLE_MS = STRESS_DRAW_MS + STRESS_HOLD_MS + STRESS_RESET_MS;
/** Five pop points along the month, the same spread as the kinetic-film Graph block's keyframes. */
const STRESS_KEYFRAME_DAYS = [0, 7, 14, 21, 29];
const STRESS_KEYFRAME_HIGH = STRESS_KEYFRAME_DAYS.map((d) => STRESS_DAYS[d] > STRESS_THRESHOLD);

function stressPathUpTo(progressDays: number) {
  const lastIndex = STRESS_POINTS.length - 2;
  const i = Math.max(0, Math.min(Math.floor(progressDays), lastIndex));
  const frac = progressDays - i;
  const [x0, y0] = STRESS_POINTS[i];
  const [x1, y1] = STRESS_POINTS[i + 1];
  const hx = x0 + (x1 - x0) * frac;
  const hy = y0 + (y1 - y0) * frac;
  let d = `M${STRESS_POINTS[0][0].toFixed(1)} ${STRESS_POINTS[0][1].toFixed(1)}`;
  for (let k = 1; k <= i; k++) d += ` L${STRESS_POINTS[k][0].toFixed(1)} ${STRESS_POINTS[k][1].toFixed(1)}`;
  d += ` L${hx.toFixed(1)} ${hy.toFixed(1)}`;
  const area = `${d} L${hx.toFixed(1)} ${STRESS_BASELINE_Y} L${STRESS_POINTS[0][0].toFixed(1)} ${STRESS_BASELINE_Y} Z`;
  return { d, area, head: [hx, hy] as const };
}

function stressValueAt(progressDays: number) {
  const lastIndex = STRESS_DAYS.length - 2;
  const i = Math.max(0, Math.min(Math.floor(progressDays), lastIndex));
  const frac = progressDays - i;
  return STRESS_DAYS[i] + (STRESS_DAYS[i + 1] - STRESS_DAYS[i]) * frac;
}

/** A point on the curve at an arbitrary (possibly negative, clamped) day — used for the comet's trailing ghosts. */
function stressPointAt(progressDays: number) {
  const lastIndex = STRESS_POINTS.length - 2;
  const p = Math.max(0, Math.min(progressDays, lastIndex + 1));
  const i = Math.max(0, Math.min(Math.floor(p), lastIndex));
  const frac = p - i;
  const [x0, y0] = STRESS_POINTS[i];
  const [x1, y1] = STRESS_POINTS[i + 1];
  return [x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac] as const;
}

interface StressBurst {
  key: number;
  x: number;
  y: number;
  color: string;
}

const TrendPreview = () => {
  const reduce = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-10% 0px -10% 0px" });
  const [escaped, setEscaped] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setEscaped(true), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const play = Boolean(reduce || inView || escaped);

  const revealRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const trail1Ref = useRef<SVGCircleElement>(null);
  const trail2Ref = useRef<SVGCircleElement>(null);
  const trail3Ref = useRef<SVGCircleElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const dayRef = useRef<HTMLSpanElement>(null);
  const [isHigh, setIsHigh] = useState(false);
  const [keyframePopped, setKeyframePopped] = useState<boolean[]>(() => STRESS_KEYFRAME_DAYS.map(() => false));
  const [burst, setBurst] = useState<StressBurst | null>(null);
  const burstKeyRef = useRef(0);
  const rafRef = useRef<number>();
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!play) return;

    const setTrail = (ref: typeof trail1Ref, progressDays: number) => {
      const [x, y] = stressPointAt(progressDays);
      ref.current?.setAttribute("cx", x.toFixed(1));
      ref.current?.setAttribute("cy", y.toFixed(1));
    };

    if (reduce) {
      const lastDay = STRESS_DAYS.length - 1;
      const { d, area } = stressPathUpTo(lastDay);
      revealRef.current?.setAttribute("d", d);
      areaRef.current?.setAttribute("d", area);
      const [hx, hy] = STRESS_POINTS[lastDay];
      headRef.current?.setAttribute("cx", String(hx));
      headRef.current?.setAttribute("cy", String(hy));
      haloRef.current?.setAttribute("cx", String(hx));
      haloRef.current?.setAttribute("cy", String(hy));
      setTrail(trail1Ref, lastDay);
      setTrail(trail2Ref, lastDay);
      setTrail(trail3Ref, lastDay);
      const v = STRESS_DAYS[lastDay];
      setIsHigh(v > STRESS_THRESHOLD);
      setKeyframePopped(STRESS_KEYFRAME_DAYS.map(() => true));
      if (valueRef.current) valueRef.current.textContent = String(Math.round(v));
      if (dayRef.current) dayRef.current.textContent = String(STRESS_DAYS.length);
      return;
    }

    let lastHigh = false;
    let prevElapsed = -1;
    let revealed = STRESS_KEYFRAME_DAYS.map(() => false);
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const elapsed = (now - startRef.current) % STRESS_CYCLE_MS;
      if (elapsed < prevElapsed) {
        // wrapped into a new loop: clear the keyframe pops and arm the threshold burst again
        revealed = STRESS_KEYFRAME_DAYS.map(() => false);
        setKeyframePopped(revealed);
        lastHigh = false;
      }
      prevElapsed = elapsed;

      const holdEnd = STRESS_DRAW_MS + STRESS_HOLD_MS;
      let progressDays: number;
      let groupOpacity = 1;
      if (elapsed < STRESS_DRAW_MS) {
        progressDays = (elapsed / STRESS_DRAW_MS) * (STRESS_DAYS.length - 1);
      } else if (elapsed < holdEnd) {
        progressDays = STRESS_DAYS.length - 1;
      } else {
        const resetT = elapsed - holdEnd;
        const half = STRESS_RESET_MS / 2;
        progressDays = 0;
        groupOpacity = resetT < half ? 1 - resetT / half : (resetT - half) / half;
      }
      const { d, area, head } = stressPathUpTo(progressDays);
      const v = stressValueAt(progressDays);
      const high = v > STRESS_THRESHOLD;
      revealRef.current?.setAttribute("d", d);
      areaRef.current?.setAttribute("d", area);
      headRef.current?.setAttribute("cx", head[0].toFixed(1));
      headRef.current?.setAttribute("cy", head[1].toFixed(1));
      haloRef.current?.setAttribute("cx", head[0].toFixed(1));
      haloRef.current?.setAttribute("cy", head[1].toFixed(1));
      setTrail(trail1Ref, progressDays - 0.5);
      setTrail(trail2Ref, progressDays - 1.0);
      setTrail(trail3Ref, progressDays - 1.6);
      if (groupRef.current) groupRef.current.style.opacity = groupOpacity.toFixed(3);
      if (valueRef.current) valueRef.current.textContent = String(Math.round(v));
      if (dayRef.current) dayRef.current.textContent = String(Math.min(STRESS_DAYS.length, Math.floor(progressDays) + 1));
      if (high !== lastHigh) {
        lastHigh = high;
        setIsHigh(high);
        if (elapsed < STRESS_DRAW_MS) {
          burstKeyRef.current += 1;
          setBurst({
            key: burstKeyRef.current,
            x: head[0],
            y: head[1],
            color: high ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
          });
        }
      }
      let changed = false;
      STRESS_KEYFRAME_DAYS.forEach((kd, j) => {
        if (!revealed[j] && progressDays >= kd) {
          revealed[j] = true;
          changed = true;
        }
      });
      if (changed) setKeyframePopped(revealed.slice());
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      startRef.current = null;
    };
  }, [play, reduce]);

  const lineColor = isHigh ? "hsl(var(--destructive))" : "hsl(var(--foreground) / 0.82)";
  const fillColor = isHigh ? "hsl(var(--destructive) / 0.12)" : "hsl(var(--foreground) / 0.05)";
  const glow = `drop-shadow(0 0 4px ${lineColor}) drop-shadow(0 0 12px ${lineColor})`;

  return (
    <motion.div
      ref={containerRef}
      initial={reduce ? false : { opacity: 0, scale: 1.08, x: 22, filter: "blur(10px)" }}
      animate={play ? { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" } : undefined}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <style>{`
        @keyframes stress-flash { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes stress-ring-burst { from { transform: scale(0.4); opacity: 0.95; } to { transform: scale(3.4); opacity: 0; } }
      `}</style>
      <p className="sr-only">
        Know your stress, sleep and clarity every day: this is what a month of check-ins can look like,
        starting around 30, climbing into the high range past day ten, then easing back down by day
        thirty. On the free plan, the oldest 3 days fade out. Core keeps all of it.
      </p>
      <div className="flex items-end justify-between px-1 mb-2" aria-hidden="true">
        <span className="text-xs font-mono tracking-wider uppercase text-muted-foreground max-w-[60%]">
          Know your stress, sleep and clarity every day.
        </span>
        <span className="text-right">
          <span
            ref={valueRef}
            className="block text-2xl font-mono font-semibold tabular-nums leading-none"
            style={{ color: lineColor, animation: isHigh ? "stress-flash 0.6s ease-in-out infinite" : "none" }}
          >
            30
          </span>
          <span className="block text-[10px] font-mono tracking-wider uppercase text-muted-foreground mt-0.5">
            Day <span ref={dayRef}>1</span> of {STRESS_DAYS.length}
          </span>
        </span>
      </div>
      <div className="w-full aspect-[32/15]" aria-hidden="true">
        <svg viewBox={`0 0 ${STRESS_VIEW_W} ${STRESS_VIEW_H}`} className="w-full h-full overflow-visible">
          <line
            x1={STRESS_PAD.l}
            x2={STRESS_VIEW_W - STRESS_PAD.r}
            y1={STRESS_THRESHOLD_Y}
            y2={STRESS_THRESHOLD_Y}
            stroke="hsl(var(--border))"
            strokeWidth={1.5}
            strokeDasharray="5 6"
          />
          <text x={STRESS_PAD.l} y={STRESS_THRESHOLD_Y - 8} className="font-mono" fontSize={13} fill="hsl(var(--muted-foreground))">
            50
          </text>
          <path d={STRESS_FULL_PATH} fill="none" stroke="hsl(var(--foreground) / 0.14)" strokeWidth={2} />
          {[0, 9, 19, 29].map((i) => (
            <text
              key={i}
              x={STRESS_POINTS[i][0]}
              y={STRESS_VIEW_H - 14}
              textAnchor={i === 0 ? "start" : i === 29 ? "end" : "middle"}
              className="font-mono"
              fontSize={12}
              fill="hsl(var(--muted-foreground))"
            >
              Day {i + 1}
            </text>
          ))}
          <g ref={groupRef}>
            <path ref={areaRef} d="" fill={fillColor} />
            <path
              ref={revealRef}
              d=""
              fill="none"
              stroke={lineColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: glow }}
            />
            {STRESS_KEYFRAME_DAYS.map((kd, j) => {
              const [x, y] = STRESS_POINTS[kd];
              const kColor = STRESS_KEYFRAME_HIGH[j] ? "hsl(var(--destructive))" : "hsl(var(--foreground) / 0.82)";
              const popped = keyframePopped[j];
              return (
                <rect
                  key={kd}
                  x={x - 6}
                  y={y - 6}
                  width={12}
                  height={12}
                  fill="hsl(var(--background))"
                  stroke={kColor}
                  strokeWidth={2.5}
                  style={{
                    transformBox: "fill-box",
                    transformOrigin: "center",
                    transform: popped ? "rotate(45deg) scale(1)" : "rotate(45deg) scale(0)",
                    opacity: popped ? 1 : 0,
                    transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s",
                  }}
                />
              );
            })}
            {burst && (
              <circle
                key={burst.key}
                cx={burst.x}
                cy={burst.y}
                r={9}
                fill="none"
                stroke={burst.color}
                strokeWidth={2.5}
                style={{ transformBox: "fill-box", transformOrigin: "center", animation: "stress-ring-burst 0.55s ease-out forwards" }}
              />
            )}
            <circle ref={trail3Ref} r={2.2} fill={lineColor} opacity={0.08} />
            <circle ref={trail2Ref} r={3.2} fill={lineColor} opacity={0.18} />
            <circle ref={trail1Ref} r={4.2} fill={lineColor} opacity={0.35} />
            <circle
              ref={haloRef}
              r={14}
              fill={isHigh ? "hsl(var(--destructive) / 0.22)" : "hsl(var(--foreground) / 0.12)"}
              style={{ animation: isHigh ? "stress-flash 0.6s ease-in-out infinite" : "none" }}
            />
            <circle ref={headRef} r={5.5} fill={lineColor} style={{ filter: glow }} />
          </g>
        </svg>
      </div>
      <div className="flex items-center gap-2 mt-3 px-1 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>On the free plan, the oldest 3 days fade out. Core keeps all of it.</span>
      </div>
    </motion.div>
  );
};

/**
 * What each tier actually reads from the recording, not just how much it
 * costs. Built directly off the model catalogue in lib/models.ts so this can
 * never drift from what Models.tsx and the API actually report — free and
 * core read the same single model (Pulse), Plus adds any three of the seven
 * add-ons, and Executive carries the whole catalogue.
 */
const PULSE_MODEL = MODELS.find((m) => m.included)!;
const ALL_UNIQUE_SIGNALS = Array.from(new Set(MODELS.flatMap((m) => m.signs)));

function modelsForPlan(planId: PlanId): VoiceModel[] {
  if (planId === "plus") return [PULSE_MODEL, ...ADDON_MODELS.slice(0, 3)];
  if (planId === "executive") return [PULSE_MODEL, ...ADDON_MODELS];
  return [PULSE_MODEL];
}

const MEASUREMENT_NOTE: Partial<Record<PlanId, string>> = {
  plus: `Any 3 of ${ADDON_MODELS.length} add-ons — shown here as an example basket`,
  executive: "The entire catalogue, every add-on included",
};

const MeasurementComparison = () => (
  <div className="mt-12">
    <div className="text-center space-y-2 mb-6">
      <h2 className="font-serif text-2xl text-foreground">What each plan actually measures</h2>
      <p className="text-sm text-muted-foreground max-w-lg mx-auto">
        Every plan reads the same twenty-second recording. The difference is how much of it gets reported back to you.
      </p>
    </div>
    {/* Same subgrid technique as the tier cards above: Plus and Executive carry
        more model pills than Free/Core, and without a shared row grid that
        extra height pushes only their own signal count, bar and caption down,
        leaving the four cards out of step with each other. */}
    <div className="grid grid-cols-1 md:grid-cols-4 md:[grid-template-rows:repeat(4,auto)] gap-5">
      {TIERS.map((tier) => {
        const models = modelsForPlan(tier.id);
        const signals = Array.from(new Set(models.flatMap((m) => m.signs)));
        const pct = Math.round((signals.length / ALL_UNIQUE_SIGNALS.length) * 100);
        return (
          <div
            key={tier.id}
            className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3 md:grid md:[grid-template-rows:subgrid] md:row-span-4 md:gap-3"
          >
            <div className="flex flex-wrap gap-1.5 content-start">
              {models.map((m) => (
                <span
                  key={m.id}
                  className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                  style={{ background: `${m.tone}1a`, color: m.tone }}
                >
                  {m.name}
                </span>
              ))}
            </div>
            <div>
              <span className="font-serif text-2xl" style={{ color: tier.accent }}>{signals.length}</span>
              <span className="text-sm text-muted-foreground"> signals tracked</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: tier.accent }}
                initial={{ width: 0 }}
                whileInView={{ width: `${pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {MEASUREMENT_NOTE[tier.id] ?? `${models.length} model${models.length === 1 ? "" : "s"}, the baseline every plan starts with`}
            </p>
          </div>
        );
      })}
    </div>
  </div>
);

const Pricing = () => {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [interval, setInterval] = useState<Interval>("monthly");

  const handleSelect = async (planId: PlanId) => {
    if (planId === "free") {
      navigate(user ? "/account" : "/");
      return;
    }
    if (!user) {
      navigate(`/signup?plan=${planId}`);
      return;
    }
    setLoadingPlan(planId);
    try {
      if (DEMO_MODE) {
        await demoAuth.mockSubscribe(planId as Exclude<PlanId, "free">);
        navigate("/account?checkout=success");
        return;
      }
      if (subscription.stripeCustomerId) {
        await openBillingPortal();
      } else if (subscription.planId !== "free" && ["active", "trialing", "past_due"].includes(subscription.status)) {
        throw new Error("Use your original billing provider to change this subscription.");
      } else {
        await startCheckout(planId as Exclude<PlanId, "free">, interval);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <DemoModeBanner />
        <div className="text-center space-y-3 mb-8">
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">
            Twenty seconds a day. Your own baseline, not someone else's average.
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Every plan compares you to your own history, never a population average. Cancel any time.
          </p>
        </div>

        <div className="max-w-lg mx-auto mb-10">
          <TrendPreview />
        </div>

        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-full border border-border p-1 bg-card">
            <button
              onClick={() => setInterval("monthly")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                interval === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                interval === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Annual, save up to 37%
            </button>
          </div>
        </div>

        {/*
          Each card is a 6-item subgrid (badge, header, price, reason,
          features, button) row-spanned onto the outer grid's 6 explicit row
          tracks. A description that wraps to 3 lines on one tier no longer
          pushes just that tier's price down — the row track itself grows for
          every column, so the $ amounts, the reason line and the buttons all
          land on the same baseline regardless of copy length. The badge slot
          always renders (empty when a tier has none) so every card contributes
          exactly 6 children and the row mapping stays 1:1.
        */}
        <div className="grid grid-cols-1 md:grid-cols-4 md:[grid-template-rows:repeat(6,auto)] gap-5">
          {TIERS.map((tier) => {
            // A signed-out visitor has no plan, so the free tier must read as an
            // invitation rather than "your current plan" — which also disabled
            // the one button a new visitor is meant to press.
            const isCurrentPlan = Boolean(user) && (
              tier.id === "free"
                ? subscription.status === "none"
                : subscription.planId === tier.id && subscription.status !== "none"
            );
            const showAnnual = interval === "annual" && tier.annualPrice;
            const monthlyEquivalent = showAnnual ? annualMonthlyEquivalent(tier) : null;
            const savings = showAnnual ? annualSavingsPct(tier) : null;
            const ctaLabel = isCurrentPlan
              ? "Your current plan"
              : loadingPlan === tier.id
              ? "Redirecting…"
              : tier.id === "free"
              ? "Start free"
              : `Start ${tier.name}`;

            return (
              <div
                key={tier.id}
                className="rounded-2xl border p-6 bg-card flex flex-col gap-4 md:grid md:[grid-template-rows:subgrid] md:row-span-6 md:gap-4"
                style={{
                  borderColor: tier.highlighted ? tier.accent : "hsl(var(--border))",
                  boxShadow: tier.highlighted ? `0 0 0 1px ${tier.accent}` : undefined,
                }}
              >
                <div className="h-5 flex items-center">
                  {tier.highlighted && (
                    <span className="text-xs font-mono tracking-wider uppercase" style={{ color: tier.accent }}>
                      Most popular
                    </span>
                  )}
                </div>
                <div>
                  <h2 className="font-serif text-2xl" style={{ color: tier.accent }}>{tier.name}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                </div>
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-serif text-3xl text-foreground">
                      {tier.monthlyPrice === 0 ? "$0" : formatPrice(showAnnual ? tier.annualPrice! : tier.monthlyPrice)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {tier.monthlyPrice === 0 ? "forever" : showAnnual ? "/year" : "/month"}
                    </span>
                  </div>
                  {monthlyEquivalent !== null && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatPrice(monthlyEquivalent)}/mo, billed annually
                      {savings !== null && ` · saves ${savings}%`}
                    </p>
                  )}
                  {tier.trialDays && !showAnnual && (
                    <p className="text-xs font-medium mt-0.5" style={{ color: tier.accent }}>
                      {tier.trialDays}-day free trial, then {formatPrice(tier.monthlyPrice)}/month
                    </p>
                  )}
                  {tier.trialDays && showAnnual && (
                    <p className="text-xs font-medium mt-0.5" style={{ color: tier.accent }}>
                      {tier.trialDays}-day free trial, then billed annually
                    </p>
                  )}
                  {tier.id !== "free" && (
                    <p className="text-xs text-muted-foreground mt-0.5">Cancel any time, right from your account</p>
                  )}
                </div>
                <p className="text-sm font-medium" style={{ color: tier.accent }}>{tier.upgradeReason}</p>
                <ul className="space-y-2 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: tier.accent }} />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSelect(tier.id)}
                  disabled={loadingPlan === tier.id || isCurrentPlan}
                  variant={tier.highlighted ? "default" : "outline"}
                  className="w-full self-end"
                  style={tier.highlighted ? { background: tier.accent } : { color: tier.accent, borderColor: tier.accent }}
                >
                  {ctaLabel}
                </Button>
              </div>
            );
          })}
        </div>

        <MeasurementComparison />

        <p className="text-center text-xs text-muted-foreground mt-10 max-w-md mx-auto">
          Secure checkout via Stripe. Serasona is a wellness product. It is not a medical device and does not
          diagnose, treat, prevent or cure any condition.
        </p>
      </div>
    </div>
    </div>
  );
};

export default Pricing;
