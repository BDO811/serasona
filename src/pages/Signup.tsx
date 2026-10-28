import { useState, FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/context/AuthContext";
import { startCheckout } from "@/lib/billing-client";
import { toast } from "sonner";
import type { PlanId } from "@/context/AuthContext";
import { SiteHeader } from "@/components/SiteHeader";
import { LEGAL_EFFECTIVE } from "@/components/LegalDoc";

const Signup = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Carries the tier a visitor picked on /pricing through signup, so creating
  // an account and starting checkout is one flow instead of two.
  const selectedPlan = searchParams.get("plan") as PlanId | null;
  // Where to land after the account exists. The marketing home sends people
  // here to do a check-in, so dropping them on the dashboard instead loses the
  // one thing they came to do. Only same-site paths are honoured: an absolute
  // URL here would turn signup into an open redirect.
  const nextParam = searchParams.get("next");
  const nextPath = nextParam && /^\/[^/]/.test(nextParam) ? nextParam : "/dashboard";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  // Illinois BIPA requires a written release for a biometric identifier that is
  // SEPARATE from general terms acceptance. Bundling it into the terms checkbox
  // is the specific mistake BIPA cases are built on, so this is its own box and
  // its own sentence, unticked by default.
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!consentGiven) {
      toast.error("You'll need to accept the terms to continue.");
      return;
    }
    if (!voiceConsent) {
      toast.error("We need your consent to process your voice before we can create an account.");
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email, password, fullName, {
        // A written release is only worth having if you can show what was
        // agreed and when. Stored with the policy version so a later change to
        // the wording cannot be mistaken for what this person actually saw.
        termsAcceptedAt: new Date().toISOString(),
        biometricConsentAt: new Date().toISOString(),
        consentPolicyVersion: LEGAL_EFFECTIVE,
      });

    } catch (error) {
      const code = (error as { code?: string }).code;
      const messages: Record<string, string> = {
        "auth/email-already-in-use": "An account already exists for this email. Log in or reset your password.",
        "auth/invalid-email": "Enter a valid email address.",
        "auth/weak-password": "Choose a stronger password with at least 8 characters.",
        "auth/password-does-not-meet-requirements": "Choose a stronger password with uppercase and lowercase letters, a number and a symbol.",
        "auth/network-request-failed": "We couldn't connect. Check your connection and try again.",
        "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
        "auth/operation-not-allowed": "Account creation is temporarily unavailable. Please try again later.",
        "permission-denied": "Your account was created, but we couldn't save your profile. Try again with the same email and password.",
        "unavailable": "We couldn't save your profile right now. Try again with the same email and password.",
      };
      toast.error(messages[code ?? ""] ?? "We couldn't finish setting up your account. Try again with the same email and password.");
      setSubmitting(false);
      return;
    }
    if (selectedPlan && ["core", "plus", "executive"].includes(selectedPlan)) {
      try {
        await startCheckout(selectedPlan as Exclude<PlanId, "free">);
      } catch {
        toast.error("Your account is ready. Checkout couldn't open. Choose your plan from your account page.");
        navigate("/account", { replace: true });
      }
      return;
    }
    navigate(nextPath, { replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            {selectedPlan && selectedPlan !== "free"
              ? "One more step, then on to checkout."
              : "Twenty seconds a day is all it takes."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="fullName">Name</Label>
            <Input id="fullName" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="consent"
              checked={consentGiven}
              onCheckedChange={(checked) => setConsentGiven(checked === true)}
            />
            <Label htmlFor="consent" className="text-xs font-normal text-muted-foreground leading-relaxed">
              I'm 18+ and agree to the{" "}
              <Link to="/terms" target="_blank" className="underline underline-offset-2 text-foreground">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" className="underline underline-offset-2 text-foreground">
                Privacy Policy
              </Link>
              , including the recording and handling of my voice. Serasona is a wellness product and does
              not diagnose, treat, prevent or cure any condition.
            </Label>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-card p-3">
            <Checkbox
              id="voice-consent"
              checked={voiceConsent}
              onCheckedChange={(checked) => setVoiceConsent(checked === true)}
            />
            <Label
              htmlFor="voice-consent"
              className="text-xs font-normal text-muted-foreground leading-relaxed"
            >
              <strong className="text-foreground">I consent to Serasona recording my voice.</strong> A
              recording of your voice is a biometric identifier. Serasona collects it only to compute
              your wellness readings, destroys it as soon as the analysis finishes and within one day at
              the latest, and never sells, leases or trades it. You can withdraw this consent at any
              time. See the{" "}
              <Link
                to="/privacy#biometric"
                target="_blank"
                className="underline underline-offset-2 text-foreground"
              >
                biometric notice
              </Link>
              .
            </Label>
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            to={nextParam ? `/login?next=${encodeURIComponent(nextPath)}` : "/login"}
            className="text-foreground underline underline-offset-4"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
    </div>
  );
};

export default Signup;
