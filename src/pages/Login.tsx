import { useState, useEffect, useRef, FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { redirectToMemberDashboard } from "@/lib/member-navigation";
import { SiteHeader } from "@/components/SiteHeader";

const Login = () => {
  const { logIn, user } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirecting = useRef(false);
  useEffect(() => {
    if (user && !submitting && !redirecting.current) {
      redirecting.current = true;
      redirectToMemberDashboard();
    }
  }, [user, submitting]);

  // Successful login always opens the member dashboard. Preserve the same-site
  // signup destination only for the create-account link below.
  const nextParam = new URLSearchParams(location.search).get("next");
  const safeNext = nextParam && /^\/[^/]/.test(nextParam) ? nextParam : null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await logIn(email, password);
      redirecting.current = true;
      redirectToMemberDashboard();
    } catch (error) {
      toast.error("That email and password didn't match. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (user && !submitting) return <main className="min-h-screen bg-background p-10 text-center" role="status">Opening your dashboard…</main>;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-3xl text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Log in to see your trend.</p>
        </div>

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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/reset-password" className="text-xs text-muted-foreground hover:text-foreground">
                Forgot it?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting || redirecting.current}>
            {submitting ? "Logging in…" : "Log in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New to Serasona?{" "}
          <Link
            to={safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup"}
            className="text-foreground underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
    </div>
  );
};

export default Login;
