import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import { startCheckout } from "@/lib/billing-client";
import { DEMO_MODE, demoAuth } from "@/lib/demo-mode";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { toast } from "sonner";
import type { PlanId } from "@/context/AuthContext";

interface Tier {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    id: "free",
    name: "Try it",
    price: "$0",
    cadence: "one check-in",
    description: "See what your voice says today. No card required.",
    features: ["One 20-second check-in", "No history or trend yet"],
  },
  {
    id: "core",
    name: "Core",
    price: "$14.50",
    cadence: "/month",
    description: "One check-in a day, tracked against your own history across ten biomarkers.",
    features: [
      "One check-in every day",
      "Your own longitudinal trend across 10 biomarkers",
      "Clear / Watch / Strained, with a direction, not just a number",
      "No wearables, no lab work",
    ],
    highlighted: true,
  },
  {
    id: "plus",
    name: "Plus",
    price: "$24.50",
    cadence: "/month",
    description: "Everything in Core, plus Serasona calls you once a day.",
    features: [
      "Everything in Core",
      "A daily call, any phone, no app required",
      "Your result still lands in the app either way",
    ],
  },
  {
    id: "executive",
    name: "Executive",
    price: "$74.50",
    cadence: "/month",
    description: "Everything in Plus, plus clinical biomarkers like cognitive decline and anemia risk.",
    features: [
      "Everything in Plus",
      "Clinical-grade biomarkers: cognitive decline, anemia, and more",
      "Priority support",
    ],
  },
];

const Pricing = () => {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);

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
      await startCheckout(planId as Exclude<PlanId, "free">);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't start checkout.");
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background px-6 py-16 md:py-24">
      <div className="max-w-5xl mx-auto">
        <DemoModeBanner />
        <div className="text-center space-y-3 mb-12">
          <h1 className="font-serif text-4xl md:text-5xl text-foreground">Choose how you check in</h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Every plan compares you to your own baseline, never a population average. Cancel any time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          {TIERS.map((tier) => {
            const isCurrentPlan =
              tier.id === "free" ? subscription.status === "none" : subscription.planId === tier.id && subscription.status !== "none";
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
                <div className="flex items-baseline gap-1">
                  <span className="font-serif text-3xl text-foreground">{tier.price}</span>
                  <span className="text-sm text-muted-foreground">{tier.cadence}</span>
                </div>
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
                  {isCurrentPlan ? "Your current plan" : loadingPlan === tier.id ? "Redirecting…" : tier.id === "free" ? "Start free" : "Subscribe"}
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
  );
};

export default Pricing;
