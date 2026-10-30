import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { startCheckout, openBillingPortal } from "@/lib/billing-client";
import { DEMO_MODE, demoAuth } from "@/lib/demo-mode";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { toast } from "sonner";
import { SiteHeader } from "@/components/SiteHeader";
import type { PlanId } from "@/context/AuthContext";

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
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Try it",
    monthlyPrice: 0,
    description: "Three check-ins a day. No card required.",
    upgradeReason: "A real daily habit, not a one-off demo.",
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
 * An illustrative preview of what a week of real check-ins looks like, and
 * what happens to it on the free tier: the last four days read, the three
 * before that are locked. Static and representative, not wired to any
 * account's actual data — the same "show the goods" role as a product
 * screenshot, just drawn instead of captured.
 */
const TrendPreview = () => {
  const days = [0.52, 0.58, 0.49, 0.61, 0.55, 0.64, 0.6];
  const lockedCount = 3;
  const w = 560;
  const h = 140;
  const padX = 24;
  const padY = 20;
  const stepX = (w - padX * 2) / (days.length - 1);
  const y = (v: number) => h - padY - v * (h - padY * 2);
  const points = days.map((v, i) => `${padX + i * stepX},${y(v)}`).join(" ");
  const lockBoundaryX = padX + (lockedCount - 0.5) * stepX;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Your stress trend</p>
          <p className="text-sm text-muted-foreground mt-1">This is what seven days of check-ins looks like.</p>
        </div>
        <span className="font-mono text-xs text-muted-foreground hidden sm:inline">illustrative example</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Example seven day trend, with the oldest days locked on the free plan">
        <rect x={padX} y={padY} width={lockBoundaryX - padX} height={h - padY * 2} fill="currentColor" className="text-muted-foreground" opacity={0.06} />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth={2} className="text-primary" opacity={0.9} />
        {days.map((v, i) => (
          <circle
            key={i}
            cx={padX + i * stepX}
            cy={y(v)}
            r={4}
            fill="currentColor"
            className={i < lockedCount ? "text-muted-foreground" : "text-primary"}
            opacity={i < lockedCount ? 0.4 : 1}
          />
        ))}
        <line x1={lockBoundaryX} y1={padY} x2={lockBoundaryX} y2={h - padY} stroke="currentColor" strokeWidth={1} strokeDasharray="3 3" className="text-border" />
      </svg>
      <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
        <Lock className="w-3 h-3" />
        <span>On the free plan, the oldest 3 days fade out. Core keeps all of it.</span>
      </div>
    </div>
  );
};

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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
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
                className={cn(
                  "rounded-2xl border p-6 flex flex-col gap-4 bg-card",
                  tier.highlighted ? "border-primary shadow-[0_0_0_1px_hsl(var(--primary))]" : "border-border"
                )}
              >
                {tier.highlighted && (
                  <span className="text-xs font-mono tracking-wider uppercase text-primary">Most popular</span>
                )}
                <div>
                  <h2 className="font-serif text-2xl text-foreground">{tier.name}</h2>
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
                    <p className="text-xs text-primary mt-0.5">{tier.trialDays}-day free trial, then {formatPrice(tier.monthlyPrice)}/month</p>
                  )}
                  {tier.trialDays && showAnnual && (
                    <p className="text-xs text-primary mt-0.5">{tier.trialDays}-day free trial, then billed annually</p>
                  )}
                  {tier.id !== "free" && (
                    <p className="text-xs text-muted-foreground mt-0.5">Cancel any time, right from your account</p>
                  )}
                </div>
                <p className="text-sm font-medium text-foreground">{tier.upgradeReason}</p>
                <ul className="space-y-2 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-foreground/90">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => handleSelect(tier.id)}
                  disabled={loadingPlan === tier.id || isCurrentPlan}
                  variant={tier.highlighted ? "default" : "outline"}
                  className="w-full"
                >
                  {ctaLabel}
                </Button>
              </div>
            );
          })}
        </div>

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
