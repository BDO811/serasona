import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { DEMO_MODE } from "@/lib/demo-mode";
import { DemoModeBanner } from "@/components/DemoModeBanner";
import { toast } from "sonner";

const ResetPassword = () => {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't send that reset link.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8">
        <DemoModeBanner />
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Reset your password</h1>
          <p className="text-sm text-muted-foreground">
            {DEMO_MODE
              ? "Demo mode has no real email to send to — there's no password to lose here."
              : "We'll email you a link."}
          </p>
        </div>

        {sent ? (
          <p className="text-center text-sm text-foreground">
            If an account exists for that email, a reset link is on its way.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
            <Button type="submit" className="w-full" disabled={submitting || DEMO_MODE}>
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-foreground underline underline-offset-4">
            Back to log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
