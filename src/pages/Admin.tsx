import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  AdminError, adminMe, totpEnroll, totpConfirm, elevate, storedElevation, clearElevation,
  adminStats, adminUsers, adminUser, adminUserCheckins, adminBilling, adminAudit,
  setDisabled, revokeSessions, sendPasswordReset, setAdmin, setPlan,
  cancelSubscription, refundCharge, deleteCheckins, deleteUser,
  money, when,
  type AdminMe, type AdminUser, type AdminUserDetail, type AdminStats,
  type AdminBilling, type AuditEntry,
} from "@/lib/admin-client";

/**
 * /admin
 *
 * This page is a client, not a gate. It runs in a browser on a static site that
 * anyone can read — every check that matters happens in the adminApi Cloud
 * Function, which verifies the ID token, the `admin` claim, and a live TOTP
 * elevation on every request. Hiding a button here hides a button; it does not
 * protect anything, and nothing here assumes otherwise.
 *
 * Three states: not an admin (bounce), not enrolled in 2FA (enroll), not
 * elevated (ask for a code). Only past all three does any data load.
 */

const PLANS = ["free", "core", "plus", "executive"];

const Shell = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="min-h-screen bg-background px-6 py-12">
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Serasona</p>
        <h1 className="font-serif text-3xl text-foreground">{title}</h1>
      </div>
      {children}
    </div>
  </div>
);

const Admin = () => {
  const { user, loading } = useAuth();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [checking, setChecking] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [elevated, setElevated] = useState(() => Boolean(storedElevation()));

  useEffect(() => {
    if (loading || !user) return;
    adminMe()
      .then(setMe)
      .catch((e: AdminError) => { if (e.status === 403 || e.status === 401) setForbidden(true); })
      .finally(() => setChecking(false));
  }, [loading, user]);

  if (loading || checking) return null;
  if (!user) return <Navigate to="/login?next=/admin" replace />;
  // A non-admin is sent home rather than told this page exists.
  if (forbidden || !me) return <Navigate to="/" replace />;
  if (!me.enrolled) return <Enroll onDone={() => setMe({ ...me, enrolled: true })} />;
  if (!elevated) return <Elevate onDone={() => setElevated(true)} />;

  return <Panel me={me} onLock={() => { clearElevation(); setElevated(false); }} />;
};

/* ---------------------------------------------------------------- 2FA */

const Enroll = ({ onDone }: { onDone: () => void }) => {
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    totpEnroll()
      .then((r) => { setSecret(r.secret); setUri(r.otpauth); })
      .catch((e: AdminError) => toast.error(e.message));
  }, []);

  const confirm = async () => {
    setBusy(true);
    try {
      await totpConfirm(code);
      toast.success("Authenticator enrolled.");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm.");
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Set up two-factor">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Add this to your authenticator app, then enter the current code. This is shown once and is not
        recoverable — if you lose it, the secret has to be reset from the server.
      </p>
      {secret && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Secret</p>
          <p className="font-mono text-sm break-all text-foreground">{secret}</p>
          {uri && (
            <a href={uri} className="text-sm text-primary underline underline-offset-2">
              Open in your authenticator app
            </a>
          )}
        </div>
      )}
      <Input
        inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="text-center font-mono text-lg tracking-[0.3em]"
      />
      <Button className="w-full" disabled={busy || code.length !== 6 || !secret} onClick={confirm}>
        {busy ? "Checking…" : "Confirm"}
      </Button>
    </Shell>
  );
};

const Elevate = ({ onDone }: { onDone: () => void }) => {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    try {
      const r = await elevate(code);
      toast.success(`Unlocked for ${r.minutes} minutes.`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not verify.");
      setCode("");
    } finally { setBusy(false); }
  };

  return (
    <Shell title="Confirm it's you">
      <p className="text-sm text-muted-foreground leading-relaxed">
        Enter the current code from your authenticator. Being signed in is not enough to see or change
        customer data.
      </p>
      <Input
        inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6}
        value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => { if (e.key === "Enter" && code.length === 6) go(); }}
        className="text-center font-mono text-lg tracking-[0.3em]"
      />
      <Button className="w-full" disabled={busy || code.length !== 6} onClick={go}>
        {busy ? "Checking…" : "Unlock"}
      </Button>
    </Shell>
  );
};

/* -------------------------------------------------------------- panel */

type Tab = "overview" | "users" | "audit";

const Panel = ({ me, onLock }: { me: AdminMe; onLock: () => void }) => {
  const [tab, setTab] = useState<Tab>("overview");
  const [selected, setSelected] = useState<string | null>(null);

  // Any 428 anywhere means the elevation lapsed; drop straight back to the code.
  const guard = useCallback((e: unknown) => {
    if (e instanceof AdminError && (e.needsElevation || e.status === 428)) { onLock(); return; }
    toast.error(e instanceof Error ? e.message : "Something went wrong.");
  }, [onLock]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-5">
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">Admin</span>
            {(["overview", "users", "audit"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelected(null); }}
                className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                  tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-muted-foreground sm:inline">{me.email}</span>
            <Button variant="outline" size="sm" onClick={onLock}>Lock</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        {tab === "overview" && <Overview onError={guard} />}
        {tab === "users" && (
          selected
            ? <UserDetail uid={selected} me={me} onBack={() => setSelected(null)} onError={guard} />
            : <Users onOpen={setSelected} onError={guard} />
        )}
        {tab === "audit" && <Audit onError={guard} />}
      </main>
    </div>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-2xl border border-border bg-card p-5">
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
    <p className="mt-1 font-serif text-3xl text-foreground tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
  </div>
);

const Overview = ({ onError }: { onError: (e: unknown) => void }) => {
  const [s, setS] = useState<AdminStats | null>(null);
  useEffect(() => { adminStats().then(setS).catch(onError); }, [onError]);
  if (!s) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Accounts" value={String(s.users)} sub={`${s.disabled} disabled · ${s.admins} admin`} />
        <Stat label="Paying" value={String(s.paying)} sub={`of ${s.users}`} />
        <Stat label="Est. MRR" value={money(s.estimatedMrrCents)} sub="from plan counts, not Stripe" />
        <Stat label="Check-ins" value={String(s.totalCheckins)} />
      </div>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {PLANS.map((p) => (
          <div key={p} className="flex items-baseline justify-between px-5 py-3">
            <span className="capitalize text-foreground">{p}</span>
            <span className="font-serif text-xl tabular-nums text-foreground">{s.byPlan[p] ?? 0}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        MRR is derived from plan counts at current list prices, not from Stripe invoices. Treat it as an
        estimate; Stripe is the source of truth for revenue.
      </p>
    </div>
  );
};

const Users = ({ onOpen, onError }: { onOpen: (uid: string) => void; onError: (e: unknown) => void }) => {
  const [list, setList] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState("");
  const [total, setTotal] = useState(0);

  const load = useCallback((q: string) => {
    adminUsers(q).then((r) => { setList(r.users); setTotal(r.total); }).catch(onError);
  }, [onError]);
  useEffect(() => { load(""); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search email, name or uid" value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") load(search); }}
        />
        <Button variant="outline" onClick={() => load(search)}>Search</Button>
      </div>
      <p className="text-xs text-muted-foreground">{total} account(s)</p>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {list.map((u) => (
          <button
            key={u.uid} onClick={() => onOpen(u.uid)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/50"
          >
            <div className="min-w-0">
              <p className="truncate text-foreground">
                {u.email ?? u.uid}
                {u.isAdmin && <span className="ml-2 font-mono text-[10px] uppercase text-primary">admin</span>}
                {u.disabled && <span className="ml-2 font-mono text-[10px] uppercase text-destructive">disabled</span>}
              </p>
              <p className="text-xs text-muted-foreground">Joined {when(u.createdAt)}</p>
            </div>
            <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {u.plan}
            </span>
          </button>
        ))}
        {!list.length && <p className="px-5 py-6 text-sm text-muted-foreground">No accounts match.</p>}
      </div>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 px-5 py-3">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-right text-sm text-foreground">{value}</span>
  </div>
);

const UserDetail = ({ uid, me, onBack, onError }: {
  uid: string; me: AdminMe; onBack: () => void; onError: (e: unknown) => void;
}) => {
  const [u, setU] = useState<AdminUserDetail | null>(null);
  const [bill, setBill] = useState<AdminBilling | null>(null);
  const [checkins, setCheckins] = useState<Array<{ id: string; capturedAt: number; overallLevel: string }>>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    adminUser(uid).then(setU).catch(onError);
    adminBilling(uid).then(setBill).catch(() => setBill(null));
    adminUserCheckins(uid).then((r) => setCheckins(r.checkins)).catch(() => setCheckins([]));
  }, [uid, onError]);
  useEffect(reload, [reload]);

  // Every mutation goes through here so nothing can forget to reload or to
  // route a lapsed elevation back to the code prompt.
  const act = async (label: string, fn: () => Promise<unknown>, confirmMsg?: string) => {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try { await fn(); toast.success(label); reload(); }
    catch (e) { onError(e); }
    finally { setBusy(false); }
  };

  if (!u) return <p className="text-sm text-muted-foreground">Loading…</p>;
  const isSelf = u.uid === me.uid;

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
        ← All users
      </button>

      <div>
        <h2 className="font-serif text-2xl text-foreground">{u.email ?? u.uid}</h2>
        <p className="text-xs text-muted-foreground">{u.uid}</p>
      </div>

      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        <Row label="Plan" value={`${u.plan} (${u.planStatus})`} />
        <Row label="Status" value={u.disabled ? "Disabled" : "Active"} />
        <Row label="Admin" value={u.isAdmin ? "Yes" : "No"} />
        <Row label="Email verified" value={u.emailVerified ? "Yes" : "No"} />
        <Row label="Created" value={when(u.createdAt)} />
        <Row label="Last sign-in" value={when(u.lastSignInAt)} />
        <Row label="Sessions valid after" value={when(u.tokensValidAfter)} />
        <Row label="Check-ins" value={String(u.checkinCount)} />
      </div>

      <section className="space-y-2">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Account</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => act("Reset link generated", async () => {
              const r = await sendPasswordReset(uid);
              await navigator.clipboard?.writeText(r.link).catch(() => {});
            })}>
            Password reset link
          </Button>
          <Button size="sm" variant="outline" disabled={busy}
            onClick={() => act("Signed out everywhere", () => revokeSessions(uid))}>
            Sign out everywhere
          </Button>
          <Button size="sm" variant="outline" disabled={busy || isSelf}
            onClick={() => act(u.disabled ? "Enabled" : "Disabled", () => setDisabled(uid, !u.disabled))}>
            {u.disabled ? "Enable" : "Disable"}
          </Button>
          <Button size="sm" variant="outline" disabled={busy || isSelf}
            onClick={() => act(u.isAdmin ? "Admin revoked" : "Admin granted", () => setAdmin(uid, !u.isAdmin),
              u.isAdmin ? "Revoke admin access for this account?" : "Grant full admin access to this account?")}>
            {u.isAdmin ? "Revoke admin" : "Make admin"}
          </Button>
        </div>
        {isSelf && (
          <p className="text-xs text-muted-foreground">
            Disabling, deleting or de-admining your own account is blocked, here and on the server.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Plan override</h3>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <Button key={p} size="sm" variant={u.plan === p ? "default" : "outline"} disabled={busy || u.plan === p}
              onClick={() => act(`Set to ${p}`, () => setPlan(uid, p),
                `Set this account to ${p} without touching Stripe?`)}>
              {p}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Comps only. This does not change Stripe, so a real subscription will overwrite it at the next
          webhook. Cancel in billing instead if they are actually paying.
        </p>
      </section>

      <section className="space-y-2">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Billing</h3>
        {!bill?.customerId && <p className="text-sm text-muted-foreground">No Stripe customer.</p>}
        {bill?.customerId && (
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              <Row label="Stripe customer" value={<span className="font-mono text-xs">{bill.customerId}</span>} />
              {bill.subscriptions.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm text-foreground">
                      {money(s.amount)}/mo · {s.status}
                      {s.cancelAtPeriodEnd && <span className="ml-2 text-xs text-muted-foreground">cancels at period end</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">Renews {when(s.currentPeriodEnd)}</p>
                  </div>
                  {s.status === "active" && !s.cancelAtPeriodEnd && (
                    <Button size="sm" variant="outline" disabled={busy}
                      onClick={() => act("Cancellation scheduled", () => cancelSubscription(uid, s.id, true),
                        "Cancel at the end of the current period? They keep access until then.")}>
                      Cancel
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {bill.charges.length > 0 && (
              <div className="rounded-2xl border border-border bg-card divide-y divide-border">
                {bill.charges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm text-foreground">
                        {money(c.amount)} · {c.status}
                        {c.refunded && <span className="ml-2 text-xs text-muted-foreground">refunded</span>}
                        {!c.refunded && c.amountRefunded > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">{money(c.amountRefunded)} refunded</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{when(c.created)}</p>
                    </div>
                    {!c.refunded && c.status === "succeeded" && (
                      <Button size="sm" variant="outline" disabled={busy}
                        onClick={() => act("Refunded", () => refundCharge(uid, c.id),
                          `Refund ${money(c.amount)} in full? This cannot be undone.`)}>
                        Refund
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Check-ins ({checkins.length})
        </h3>
        {checkins.length > 0 && (
          <div className="max-h-56 overflow-y-auto rounded-2xl border border-border bg-card divide-y divide-border">
            {checkins.map((c) => (
              <div key={c.id} className="flex items-baseline justify-between px-5 py-2.5">
                <span className="text-sm text-foreground">{when(c.capturedAt)}</span>
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {c.overallLevel ?? "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2 rounded-2xl border border-destructive/40 p-5">
        <h3 className="font-mono text-[11px] uppercase tracking-wider text-destructive">Irreversible</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy || !u.checkinCount}
            onClick={() => act("History deleted", () => deleteCheckins(uid),
              `Permanently delete all ${u.checkinCount} check-ins for this account?`)}>
            Delete check-in history
          </Button>
          <Button size="sm" variant="outline" disabled={busy || isSelf}
            onClick={() => act("Account deleted", async () => { await deleteUser(uid); onBack(); },
              "Permanently delete this account and all its data? This cannot be undone.")}>
            Delete account
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Deleting an account does not cancel its Stripe subscription. Cancel billing first, or they keep
          being charged.
        </p>
      </section>
    </div>
  );
};

const Audit = ({ onError }: { onError: (e: unknown) => void }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  useEffect(() => { adminAudit().then((r) => setEntries(r.entries)).catch(onError); }, [onError]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Every admin action, allowed or refused. Append-only — this cannot be edited from the panel or
        from a client.
      </p>
      <div className="rounded-2xl border border-border bg-card divide-y divide-border">
        {entries.map((e) => (
          <div key={e.id} className="px-5 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-xs text-foreground">
                {e.action}
                {e.outcome !== "ok" && <span className="ml-2 uppercase text-destructive">{e.outcome}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{when(e.at)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {e.actorEmail ?? "unknown"}{e.target ? ` → ${e.target}` : ""}
            </p>
          </div>
        ))}
        {!entries.length && <p className="px-5 py-6 text-sm text-muted-foreground">Nothing yet.</p>}
      </div>
    </div>
  );
};

export default Admin;
