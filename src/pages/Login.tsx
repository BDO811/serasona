import { useState, useEffect, useRef, FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { redirectToMemberDashboard } from "@/lib/member-navigation";
import { SiteHeader } from "@/components/SiteHeader";

const Login = () => {
  const { logIn, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const adminDestination = location.state?.from?.replace(/\/$/, "") === "/admin" ||
    new URLSearchParams(location.search).get("next")?.replace(/\/$/, "") === "/admin";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const redirecting = useRef(false);
  useEffect(() => {
    if (user && !submitting && !redirecting.current) {
      redirecting.current = true;
      if (adminDestination) navigate("/admin", { replace: true });
      else redirectToMemberDashboard();
    }
  }, [user, submitting, adminDestination, navigate]);

  // Successful login always opens the member dashboard. Preserve the same-site
  // signup destination only for the create-account link below.
  const nextParam = new URLSearchParams(location.search).get("next");
  const safeNext = nextParam && /^\/[^/]/.test(nextParam) ? nextParam : null;
  const signupPath = safeNext ? `/signup?next=${encodeURIComponent(safeNext)}` : "/signup";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await logIn(email, password);
      redirecting.current = true;
      if (adminDestination) navigate("/admin", { replace: true });
      else redirectToMemberDashboard();
    } catch (error) {
      const code = (error as { code?: string })?.code;
      setLoginError(
        code === "auth/user-not-found"
          ? "That account doesn't exist. Sign up for a new Serasona account."
          : code === "auth/invalid-credential" || code === "auth/invalid-login-credentials"
            // Firebase may intentionally combine unknown email and incorrect
            // password. Do not claim a known account is missing in that case.
            ? "We couldn't find an account matching those details. Check your email and password, or sign up for a new account."
            : code === "auth/wrong-password"
              ? "That password didn't match. Try again or reset your password."
              : code === "auth/too-many-requests"
                ? "Too many login attempts. Please wait a moment and try again."
                : code === "auth/network-request-failed"
                  ? "We couldn't connect. Check your connection and try again."
                  : "We couldn't log you in. Check your email and password and try again."
      );
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
          {loginError && <div role="alert" className="space-y-2 text-sm text-foreground">
            <p>{loginError}</p>
            <Link to={signupPath} className="underline underline-offset-4">Sign up for a new account</Link>
          </div>}
        </form>

        <p className="text-center text-sm text-muted-foreground">
          New to Serasona?{" "}
          <Link
            to={signupPath}
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
