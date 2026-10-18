import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { doc, getDoc, setDoc, deleteField } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ArrowUpRight, Check, LogOut, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { openBillingPortal, startCheckout } from "@/lib/billing-client";
import { MemberShell } from "@/components/member/MemberShell";
import { AGE_OPTIONS, validateProfile, type AccountProfile } from "@/lib/account-profile";
import type { PlanId } from "@/context/AuthContext";

const EMPTY: AccountProfile = { fullName: "", phoneNumber: "", biologicalSex: "", ageRange: "" };
const PLANS: Array<{ id: Exclude<PlanId, "free">; name: string; price: string; description: string }> = [
  { id: "core", name: "Core", price: "$7.99", description: "Daily Pulse check-ins and your own longitudinal history." },
  { id: "plus", name: "Plus", price: "$14.99", description: "Core, three additional models and phone check-ins." },
  { id: "executive", name: "Executive", price: "$19.99", description: "All models, phone check-ins and priority support." },
];

export default function Account() {
  const { user, subscription, subscriptionError, isEntitled, logOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<AccountProfile>(EMPTY);
  const [saved, setSaved] = useState<AccountProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const hasBillingAccount = Boolean(subscription.stripeCustomerId);
  const externallyManagedPlan = !hasBillingAccount && subscription.planId !== "free" && ["active", "trialing", "past_due"].includes(subscription.status);

  useEffect(() => {
    let canceled = false;
    setLoading(true); setError(""); setMessage(""); setProfile(EMPTY);
    if (!user || !db) { setLoading(false); setError("Your account is unavailable. Please sign in again."); return; }
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (canceled) return;
      const data = snapshot.data() || {};
      const next = { fullName: data.fullName ?? user.displayName ?? "", phoneNumber: data.phoneNumber ?? "", biologicalSex: data.biologicalSex ?? "", ageRange: data.ageRange ?? "" };
      setProfile(next); setSaved(next);
    }).catch(() => { if (!canceled) setError("Your profile could not be loaded. Please retry before editing."); }).finally(() => { if (!canceled) setLoading(false); });
    return () => { canceled = true; };
  }, [user?.uid, revision]);
  useEffect(() => { if (location.hash === "#subscription") document.getElementById("subscription")?.scrollIntoView({ block: "start" }); }, [location.hash]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !db) return;
    setSaving(true); setMessage("");
    try {
      const clean = validateProfile(profile);
      // Profile fields only. Subscription, consent and creation timestamps are never written here.
      await setDoc(doc(db, "users", user.uid), {
        fullName: clean.fullName,
        phoneNumber: clean.phoneNumber || deleteField(),
        biologicalSex: clean.biologicalSex || deleteField(),
        ageRange: clean.ageRange || deleteField(),
      }, { merge: true });
      setProfile(clean); setSaved(clean);
      try { await updateProfile(user, { displayName: clean.fullName }); }
      catch { setMessage("Your profile was saved. The sign-in display name could not be synchronized."); return; }
      setMessage("Your account details have been saved.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Your profile could not be saved. Please try again."); }
    finally { setSaving(false); }
  };
  const changePlan = async (plan?: Exclude<PlanId, "free">) => {
    if (subscriptionError) { toast.error(subscriptionError); return; }
    if (externallyManagedPlan) { toast.error("This subscription is managed outside Stripe. Use its original billing provider to change or cancel it."); return; }
    setBilling(plan ?? "portal");
    try {
      // Existing subscribers change plans in Stripe, avoiding duplicate subscriptions.
      if (hasBillingAccount || !plan) await openBillingPortal();
      else await startCheckout(plan);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Billing could not be opened. Please try again."); setBilling(null); }
  };
  const patch = (key: keyof AccountProfile, value: string) => { setProfile((previous) => ({ ...previous, [key]: value })); setMessage(""); };
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  return <MemberShell>
    <main className="member-account">
      <div className="member-title"><div><h1>Your account, your way.</h1><p>Keep your details current and choose how you check in.</p></div><Link className="member-button" to="/dashboard">Back to dashboard <ArrowUpRight size={16} /></Link></div>
      <div className="member-account-grid"><section className="member-profile-panel"><h2>Profile & demographics</h2><p className="member-note">Age range and biological sex provide account context. They are optional and are not inputs to the current voice analysis API.</p>
        {error ? <div className="member-message" role="alert"><p>{error}</p><button onClick={() => setRevision((n) => n + 1)}>Reload profile</button></div> : <form onSubmit={save}>
          <fieldset disabled={loading || saving} className="member-fields"><legend className="sr-only">Your profile</legend>
            <label htmlFor="fullName">Full name<input id="fullName" autoComplete="name" value={profile.fullName} maxLength={120} required onChange={(e) => patch("fullName", e.target.value)} /></label>
            <label htmlFor="accountEmail">Sign-in email<input id="accountEmail" type="email" value={user?.email ?? ""} readOnly autoComplete="email" /><span className="member-note">Your sign-in identity. Profile edits do not change this email.</span></label>
            <label htmlFor="phoneNumber">Phone number <span className="member-optional">optional</span><input id="phoneNumber" type="tel" autoComplete="tel" value={profile.phoneNumber} onChange={(e) => patch("phoneNumber", e.target.value)} /><span className="member-note">Used to prefill phone check-ins. Saving a number does not place a call.</span></label>
            <div className="member-form-pair"><label htmlFor="ageRange">Age range<select id="ageRange" value={profile.ageRange} onChange={(e) => patch("ageRange", e.target.value)}><option value="">Not provided</option>{Object.entries(AGE_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label htmlFor="biologicalSex">Biological sex<select id="biologicalSex" value={profile.biologicalSex} onChange={(e) => patch("biologicalSex", e.target.value)}><option value="">Not provided</option><option value="female">Female</option><option value="male">Male</option></select></label></div>
            <div className="member-form-actions"><button className="member-primary" type="submit" disabled={!dirty || saving || loading}><Save size={16} />{loading ? "Loading profile…" : saving ? "Saving…" : "Save changes"}</button><button type="button" disabled={!dirty || saving} onClick={() => { setProfile(saved); setMessage(""); }}>Discard changes</button></div>
          </fieldset>
          {message && <p className="member-save-message" role="status"><Check size={16} />{message}</p>}
        </form>}
      </section>
      <aside id="subscription" className="member-subscription-panel">{subscriptionError && <p role="alert" className="member-message">{subscriptionError}</p>}<span className="member-pill">Your subscription</span><h2 className="member-plan-name">{subscription.planId}</h2><p className="member-capitalize">{subscription.status === "none" ? "No paid subscription" : subscription.status.replace(/_/g, " ")}</p>{subscription.currentPeriodEnd && <p className="member-note">Current billing period ends {new Date(subscription.currentPeriodEnd * 1000).toLocaleDateString()}.</p>}
        {new URLSearchParams(location.search).get("checkout") === "success" && <p className="member-message" role="status">Checkout completed. Your subscription updates after payment confirmation. Refresh this page if it has not appeared yet.</p>}
        <div className="member-plan-includes"><p><MicFeature /> Browser voice check-ins</p><p>{isEntitled("core") ? "Daily readings and history" : "One free check-in"}</p><p>{isEntitled("plus") ? "Phone check-ins included" : "Upgrade to Plus for phone calls"}</p></div>
        {externallyManagedPlan && <p className="member-note">Your plan is managed outside Stripe. Use your original billing provider for plan changes and cancellation.</p>}
        {hasBillingAccount && <button className="member-primary" disabled={Boolean(billing)} onClick={() => changePlan()}>{billing === "portal" ? "Opening billing…" : "Manage billing & subscription"}<ArrowUpRight size={16} /></button>}
        <p className="member-note">Payments, plan changes and cancellations are handled securely in Stripe. Your plan updates after confirmation.</p>
        {isEntitled("plus") && <Link to="/voice" className="member-button">Choose your calling voice <ArrowUpRight size={16} /></Link>}
      </aside></div>
      <section className="member-section"><div className="member-section-heading"><div><h2>Choose your next perspective.</h2><p className="member-note">{hasBillingAccount ? "Change or upgrade your plan through your existing billing account." : "Choose a paid plan to continue beyond your free check-in."}</p></div><Link to="/pricing" className="member-text-button">Compare all features</Link></div><div className="member-plan-grid">{PLANS.map((plan) => {
        const current = subscription.planId === plan.id && ["active", "trialing"].includes(subscription.status);
        return <article key={plan.id} className={`member-plan-card ${current ? "member-plan-current" : ""}`}><small>{current ? "YOUR CURRENT PLAN" : plan.id === "plus" ? "INCLUDES PHONE CALLS" : "VOICE WELLNESS"}</small><h3>{plan.name}</h3><p className="member-plan-price">{plan.price}<span> /month</span></p><p>{plan.description}</p><button className={current ? "" : "member-primary"} disabled={Boolean(billing)} onClick={() => changePlan(plan.id)}>{billing === plan.id ? "Opening…" : current ? "Manage current plan" : hasBillingAccount ? `Change to ${plan.name}` : `Choose ${plan.name}`}<ArrowUpRight size={16} /></button></article>;
      })}</div></section>
      <div className="member-account-bottom"><p className="member-note">Account administration is private to you. Subscription and recording consent records cannot be changed through profile edits.</p><button onClick={async () => { try { await logOut(); navigate("/", { replace: true }); } catch { toast.error("Sign out failed. Please try again."); } }}><LogOut size={16} />Sign out</button></div>
    </main>
  </MemberShell>;
}
function MicFeature() { return <Check size={14} aria-hidden="true" />; }
