/**
 * Demo mode stands in for Firebase Auth + Firestore + Stripe with plain
 * localStorage, so the full account round trip — sign up, pick a plan,
 * "pay", land in the account, check in, see a trend — works end to end with
 * zero live credentials. It is the sandbox's answer to "what does this
 * actually feel like," not a staging environment: nothing here is real
 * billing, real auth, or shared between devices.
 *
 * Every mock function below mirrors the shape of its real counterpart
 * (AuthContext, billing-client, voice-history-client) so swapping demo mode
 * off is a matter of filling in real Firebase/Stripe keys in .env, not a
 * rewrite. See docs/SETUP_BILLING.md.
 */

export const DEMO_MODE = (import.meta.env.VITE_DEMO_MODE as string | undefined) === "true";

const STORAGE_KEY = "serasona_demo_state_v1";

export interface DemoSubscription {
  planId: "free" | "core" | "plus" | "executive";
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  currentPeriodEnd: number | null;
}

export interface DemoUser {
  uid: string;
  email: string;
  fullName: string;
}

interface DemoState {
  user: DemoUser | null;
  subscription: DemoSubscription;
  /** Keyed by account email -> password, for the mock sign-in check only. */
  credentials: Record<string, string>;
}

const DEFAULT_SUBSCRIPTION: DemoSubscription = { planId: "free", status: "none", currentPeriodEnd: null };

const DEFAULT_STATE: DemoState = { user: null, subscription: DEFAULT_SUBSCRIPTION, credentials: {} };

function readState(): DemoState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
}

function writeState(state: DemoState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  // Same-tab listeners (React state) can't hear the native "storage" event,
  // which only fires in *other* tabs — so fire our own for this tab.
  window.dispatchEvent(new CustomEvent("serasona-demo-state-changed"));
}

function uidFor(email: string): string {
  return `demo-${email.toLowerCase()}`;
}

export const demoAuth = {
  getState: readState,

  subscribe(callback: () => void): () => void {
    window.addEventListener("serasona-demo-state-changed", callback);
    window.addEventListener("storage", callback);
    return () => {
      window.removeEventListener("serasona-demo-state-changed", callback);
      window.removeEventListener("storage", callback);
    };
  },

  async signUp(email: string, password: string, fullName: string): Promise<DemoUser> {
    const state = readState();
    const normalized = email.trim().toLowerCase();
    const user: DemoUser = { uid: uidFor(normalized), email: normalized, fullName };
    writeState({
      ...state,
      user,
      subscription: DEFAULT_SUBSCRIPTION,
      credentials: { ...state.credentials, [normalized]: password },
    });
    return user;
  },

  async logIn(email: string, password: string): Promise<DemoUser> {
    const state = readState();
    const normalized = email.trim().toLowerCase();
    if (state.credentials[normalized] !== password) {
      throw new Error("That email and password didn't match. Try again.");
    }
    // Reconstruct the user record rather than requiring it still be in
    // state.user — logging back in after a logOut should still work.
    const user: DemoUser = { uid: uidFor(normalized), email: normalized, fullName: state.user?.fullName ?? "" };
    writeState({ ...state, user });
    return user;
  },

  async logOut(): Promise<void> {
    const state = readState();
    writeState({ ...state, user: null });
  },

  /** Simulates a completed Stripe Checkout: sets the plan active immediately. */
  async mockSubscribe(planId: Exclude<DemoSubscription["planId"], "free">): Promise<void> {
    const state = readState();
    const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    writeState({
      ...state,
      subscription: { planId, status: "active", currentPeriodEnd: thirtyDaysFromNow },
    });
  },

  /** Simulates the Stripe Customer Portal's cancel action. */
  async mockCancel(): Promise<void> {
    const state = readState();
    writeState({ ...state, subscription: { ...state.subscription, status: "canceled" } });
  },
};

// --- Sample check-in history --------------------------------------------
//
// So /history shows a real-looking 30-day trend instead of an empty state
// the first time anyone opens the sandbox. Shaped exactly like
// voice-history-client's StoredSession, so the real longitudinal math in
// src/lib/longitudinal.ts runs over this completely unmodified — only the
// data source is fake, not the analysis.

interface DemoStoredSignal {
  name: string;
  label: string;
  score: number;
  level: string | null;
  flagged: boolean;
}

interface DemoStoredSession {
  sessionId: string;
  capturedAt: number;
  model: string | null;
  pathway: string | null;
  signals: DemoStoredSignal[];
  summary: {
    overallLevel: string | null;
    recommendedAction: string | null;
    flaggedCount: number | null;
    totalSignals: number | null;
  } | null;
}

const HISTORY_STORAGE_KEY = "serasona_demo_history_v1";

// The pulse model's own signal set (see pathway-model-map.ts) — the model the
// signed-in daily check-in already uses, so demo data and real data agree.
const PULSE_SIGNALS: Array<{ name: string; label: string; baseline: number; drift: number }> = [
  { name: "mood-disruption", label: "Mood", baseline: 0.22, drift: 0 },
  { name: "anxiety", label: "Anxiety", baseline: 0.28, drift: 0.02 },
  { name: "stress", label: "Stress", baseline: 0.31, drift: 0.14 },
  { name: "fatigue", label: "Fatigue", baseline: 0.35, drift: 0.09 },
  { name: "dehydration", label: "Hydration", baseline: 0.2, drift: -0.04 },
  { name: "elevated-blood-pressure", label: "Blood pressure", baseline: 0.18, drift: 0.01 },
];

function clamp01(value: number): number {
  return Math.min(0.97, Math.max(0.03, value));
}

/** One session per day for the trailing `days` days, oldest first. */
function generateSampleSessions(days = 26): DemoStoredSession[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const sessions: DemoStoredSession[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const capturedAt = now - i * dayMs - Math.floor(Math.random() * 2 * 60 * 60 * 1000);
    // Drift ramps in over the trailing third of the series, so the most
    // recent week reads as a real, gentle upward move in stress/fatigue
    // rather than a flat line — something for the trend view to say.
    const progress = 1 - i / (days - 1);
    const rampIn = Math.max(0, (progress - 0.6) / 0.4);

    const signals: DemoStoredSignal[] = PULSE_SIGNALS.map((signal) => {
      const noise = (Math.random() - 0.5) * 0.06;
      const score = clamp01(signal.baseline + signal.drift * rampIn + noise);
      return {
        name: signal.name,
        label: signal.label,
        score,
        level: score > 0.6 ? "elevated" : score > 0.4 ? "moderate" : "low",
        flagged: score > 0.6,
      };
    });

    sessions.push({
      sessionId: `demo-${i}`,
      capturedAt,
      model: "pulse",
      pathway: "WELLNESS",
      signals,
      summary: {
        overallLevel: null,
        recommendedAction: null,
        flaggedCount: signals.filter((s) => s.flagged).length,
        totalSignals: signals.length,
      },
    });
  }

  return sessions;
}

export const demoHistory = {
  /** Seeds a sample 26-day series the first time this account has none. */
  getSessions(): DemoStoredSession[] {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // fall through to reseed
    }
    const seeded = generateSampleSessions();
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  },

  /** Appends a real check-in captured in demo mode onto the sample series. */
  addSession(session: Omit<DemoStoredSession, "sessionId">): void {
    const sessions = demoHistory.getSessions();
    sessions.push({ ...session, sessionId: `demo-live-${Date.now()}` });
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(sessions));
  },
};
