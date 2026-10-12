import { auth } from "@/lib/firebase";

/**
 * Client for the admin API.
 *
 * Everything here is a convenience, not a control. This file runs in a browser
 * on a static site that anyone can read, so none of it is a security boundary —
 * the Cloud Function re-checks the ID token, the `admin` claim, and the
 * elevation on every single request. If you change a check here, you have
 * changed nothing that matters.
 *
 * The elevation token lives in sessionStorage rather than localStorage: it
 * should die with the tab, not follow you around.
 */

const BASE =
  import.meta.env.VITE_ADMIN_API_URL ??
  "https://us-central1-amits-playground-po.cloudfunctions.net/adminApi";

const ELEVATION_KEY = "serasona.admin.elevation";

export class AdminError extends Error {
  constructor(message: string, readonly status: number, readonly needsElevation = false) {
    super(message);
    this.name = "AdminError";
  }
}

interface Elevation {
  token: string;
  expiresAt: number;
}

export function storedElevation(): Elevation | null {
  try {
    const raw = sessionStorage.getItem(ELEVATION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Elevation;
    if (!parsed?.token || Date.now() >= parsed.expiresAt) {
      sessionStorage.removeItem(ELEVATION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const clearElevation = () => sessionStorage.removeItem(ELEVATION_KEY);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const user = auth?.currentUser;
  if (!user) throw new AdminError("Not signed in.", 401);

  // Force-refresh so a freshly granted (or revoked) admin claim is reflected
  // without making someone sign out and back in.
  const idToken = await user.getIdToken(true);
  const elevation = storedElevation();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...(elevation ? { "X-Elevation": elevation.token } : {}),
      ...(init.headers || {}),
    },
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 428) clearElevation();
    throw new AdminError(body.error || "Request failed.", res.status, body.needsElevation === true);
  }
  return body as T;
}

/* --------------------------------------------------------------- types */

export interface AdminMe { uid: string; email: string; admin: true; enrolled: boolean }

export interface AdminUser {
  uid: string; email: string | null; displayName: string | null;
  disabled: boolean; emailVerified: boolean; isAdmin: boolean;
  createdAt: string; lastSignInAt: string;
  plan: string; planStatus: string; stripeCustomerId: string | null;
}

export interface AdminUserDetail extends AdminUser {
  checkinCount: number; providers: string[]; tokensValidAfter: string;
}

export interface AdminStats {
  users: number; disabled: number; admins: number;
  byPlan: Record<string, number>; paying: number;
  estimatedMrrCents: number; totalCheckins: number;
}

export interface AdminBilling {
  customerId: string | null;
  subscriptions: Array<{ id: string; status: string; priceId: string | null; amount: number | null; currentPeriodEnd: number; cancelAtPeriodEnd: boolean }>;
  invoices: Array<{ id: string; number: string; status: string; total: number; created: number; hostedUrl: string }>;
  charges: Array<{ id: string; amount: number; refunded: boolean; amountRefunded: number; created: number; status: string }>;
}

export interface AuditEntry {
  id: string; at: number | null; actorEmail: string | null;
  action: string; target: string | null; outcome: string; detail: unknown;
}

/* ------------------------------------------------------------ endpoints */

export const adminMe = () => request<AdminMe>("/me");

export const totpEnroll = () => request<{ secret: string; otpauth: string }>("/totp/enroll", { method: "POST" });
export const totpConfirm = (code: string) =>
  request<{ enrolled: boolean }>("/totp/confirm", { method: "POST", body: JSON.stringify({ code }) });

export async function elevate(code: string) {
  const r = await request<{ token: string; expiresAt: number; minutes: number }>("/elevate", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
  sessionStorage.setItem(ELEVATION_KEY, JSON.stringify({ token: r.token, expiresAt: r.expiresAt }));
  return r;
}

export const adminStats = () => request<AdminStats>("/stats");
export const adminUsers = (search = "") =>
  request<{ total: number; users: AdminUser[] }>(`/users?search=${encodeURIComponent(search)}`);
export const adminUser = (uid: string) => request<AdminUserDetail>(`/users/${uid}`);
export const adminUserCheckins = (uid: string) =>
  request<{ checkins: Array<{ id: string; capturedAt: number; model: string; overallLevel: string; signalCount: number }> }>(
    `/users/${uid}/checkins`
  );
export const adminBilling = (uid: string) => request<AdminBilling>(`/users/${uid}/billing`);
export const adminAudit = () => request<{ entries: AuditEntry[] }>("/audit");

const post = (path: string, body?: unknown) =>
  request<{ ok: true } & Record<string, unknown>>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

export const setDisabled = (uid: string, disabled: boolean) =>
  post(`/users/${uid}/${disabled ? "disable" : "enable"}`);
export const revokeSessions = (uid: string) => post(`/users/${uid}/revoke-sessions`);
export const sendPasswordReset = (uid: string) =>
  request<{ ok: true; link: string; email: string }>(`/users/${uid}/password-reset`, { method: "POST" });
export const setAdmin = (uid: string, isAdmin: boolean) => post(`/users/${uid}/set-admin`, { admin: isAdmin });
export const setPlan = (uid: string, planId: string) => post(`/users/${uid}/set-plan`, { planId });
export const cancelSubscription = (uid: string, subscriptionId: string, atPeriodEnd = true) =>
  post(`/billing/${uid}/cancel`, { subscriptionId, atPeriodEnd });
export const refundCharge = (uid: string, chargeId: string, amount?: number) =>
  post(`/billing/${uid}/refund`, { chargeId, ...(amount ? { amount } : {}) });

export const deleteCheckins = (uid: string) =>
  request<{ ok: true; deleted: number }>(`/users/${uid}/checkins`, { method: "DELETE" });
export const deleteUser = (uid: string) =>
  request<{ ok: true; checkinsDeleted: number }>(`/users/${uid}`, { method: "DELETE" });

export const money = (cents: number | null | undefined) =>
  cents == null ? "—" : `$${(cents / 100).toFixed(2)}`;
export const when = (v: number | string | null | undefined) => {
  if (v == null) return "—";
  const d = typeof v === "number" ? new Date(v < 1e12 ? v * 1000 : v) : new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
};
