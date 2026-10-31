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
import { asset } from "@/lib/asset";

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
    accent: "#111111",
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
 * zero, a real day-by-day line across thirty days that climbs into the high
 * range, holds, and eases back down — the same shape a demanding month
 * actually reads as. Static and representative, not wired to any account's
 * actual data — the same "show the goods" role as a product screenshot.
 *
 * A genuine kinetic-film render (Anthropic's scenario-kinetic-film skill):
 * StressGraph, a data-driven fork of the shipped Graph block (source and
 * render pipeline in ~/.claude/skills/scenario-kinetic-film). A comet draws
 * the 30-day series instead of the block's fixed curve — blue below 50,
 * a second copy of the same path clipped to the band above 50 and blinked
 * so that stretch reads as a flashing alarm, not a tint — then the line
 * folds and lands on the month's closing score with echo rings and a light
 * burst. Real motion blur, bloom and film grain from the render pipeline,
 * at half the shipped block's default pace. "STRESS" plus two lines of mono
 * copy land beside the number; the message lives only in the clip now, so
 * there is no separate on-page label repeating it.
 *
 * Muted, looping, autoplaying background footage: same accessibility
 * contract as AmbientVideo.tsx (poster for prefers-reduced-motion and a
 * metered connection, aria-hidden on the video itself, a screen-reader-only
 * paragraph carries the same information as text).
 */
const TrendPreview = () => {
  const reduce = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playable, setPlayable] = useState(false);

  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const metered = conn?.saveData === true || /^(slow-)?2g$/.test(conn?.effectiveType || "");
    setPlayable(!reduce && !metered);
  }, [reduce]);

  useEffect(() => {
    if (!playable) return;
    void videoRef.current?.play().catch(() => {});
  }, [playable]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-10% 0px -10% 0px" });
  const [escaped, setEscaped] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setEscaped(true), 1200);
    return () => window.clearTimeout(t);
  }, []);
  const play = Boolean(reduce || inView || escaped);

  return (
    <motion.div
      ref={containerRef}
      initial={reduce ? false : { opacity: 0, scale: 1.08, x: 22, filter: "blur(10px)" }}
      animate={play ? { opacity: 1, scale: 1, x: 0, filter: "blur(0px)" } : undefined}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      <p className="sr-only">
        Know your stress, sleep and clarity every day: this is what a month of check-ins can look like,
        starting at 30, climbing past 50 by day eight, peaking near day fifteen at 77, then easing back
        under 50 by day twenty-three and settling at 38. On the free plan, the oldest 3 days fade out.
        Core keeps all of it.
      </p>
      {/* The clip's own "paper" ground is rendered at the exact hex of the page
          background, so the settled frame reads as the page itself rather
          than a lighter box sitting on a cream page. */}
      <div className="w-full aspect-[32/15] rounded-2xl overflow-hidden" aria-hidden="true">
        {playable ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            poster={asset("video/trend-loop-poster.jpg")}
            muted
            loop
            playsInline
            preload="auto"
          >
            <source src={asset("video/trend-loop.webm")} type="video/webm" />
            <source src={asset("video/trend-loop.mp4")} type="video/mp4" />
          </video>
        ) : (
          <img src={asset("video/trend-loop-poster.jpg")} alt="" className="h-full w-full object-cover" />
        )}
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
