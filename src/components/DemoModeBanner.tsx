import { DEMO_MODE } from "@/lib/demo-mode";

/**
 * Shown on every account-flow screen while DEMO_MODE is on, so it's never
 * ambiguous that a "subscription" or "payment" in the sandbox isn't real.
 * Renders nothing once real Firebase/Stripe keys are in place.
 */
export const DemoModeBanner = () => {
  if (!DEMO_MODE) return null;
  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-center">
      <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
        Demo mode — no real account, no real charge. Stored on this device only.
      </p>
    </div>
  );
};
