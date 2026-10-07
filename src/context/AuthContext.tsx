import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, setDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import { DEMO_MODE, demoAuth } from "@/lib/demo-mode";

const NOT_CONFIGURED_ERROR = new Error("Accounts aren't set up yet. Check back soon.");

// Plan ids match Stripe Price lookup_keys — see docs/SETUP_BILLING.md.
export type PlanId = "free" | "core" | "plus" | "executive";

export interface SubscriptionState {
  planId: PlanId;
  status: "active" | "trialing" | "past_due" | "canceled" | "none";
  currentPeriodEnd: number | null; // unix seconds
  stripeCustomerId: string | null;
}

/**
 * The subset of Firebase's User that the rest of the app actually touches.
 * Demo mode constructs a plain object satisfying this same shape, so every
 * consumer (ProtectedRoute, use-voice-history, Account, Checkin, ...) works
 * identically regardless of which mode is active.
 */
export interface SerasonaUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  getIdToken: () => Promise<string>;
}

const DEFAULT_SUBSCRIPTION: SubscriptionState = {
  planId: "free",
  status: "none",
  currentPeriodEnd: null,
  stripeCustomerId: null,
};

interface AuthContextType {
  user: SerasonaUser | null;
  loading: boolean;
  subscription: SubscriptionState;
  isEntitled: (plan: Exclude<PlanId, "free">) => boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  logIn: (email: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Plans rank in the order a subscriber would reasonably upgrade through, so
// "isEntitled(core)" also passes for a plus or executive subscriber.
const PLAN_RANK: Record<PlanId, number> = { free: 0, core: 1, plus: 2, executive: 3 };

function toSerasonaUser(demoUser: { uid: string; email: string; fullName: string }): SerasonaUser {
  return {
    uid: demoUser.uid,
    email: demoUser.email,
    displayName: demoUser.fullName,
    // Nothing in demo mode ever sends this token anywhere real — every
    // network call it would gate (voice-history, Stripe functions) is
    // short-circuited to a local mock before a fetch happens.
    getIdToken: async () => "demo-mode-token",
  };
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<SerasonaUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionState>(DEFAULT_SUBSCRIPTION);

  // Demo mode: localStorage is the backend. Read it once, then re-read on
  // every change (sign up, log in/out, mock subscribe/cancel) via the custom
  // event demo-mode.ts fires, so this stays a single source of truth instead
  // of a second copy of the same state.
  useEffect(() => {
    if (!DEMO_MODE) return;
    const sync = () => {
      const state = demoAuth.getState();
      setUser(state.user ? toSerasonaUser(state.user) : null);
      setSubscription({ ...DEFAULT_SUBSCRIPTION, ...state.subscription });
      setLoading(false);
    };
    sync();
    return demoAuth.subscribe(sync);
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return;
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribeAuth;
  }, []);

  useEffect(() => {
    if (DEMO_MODE) return; // subscription already comes from the demo sync above
    if (!user || !db) {
      setSubscription(DEFAULT_SUBSCRIPTION);
      return;
    }
    // The Stripe webhook (gcp-functions/stripe-webhook) is the only writer to
    // this field; the client only ever reads it.
    const unsubscribeDoc = onSnapshot(doc(db, "users", user.uid), (snap) => {
      const data = snap.data();
      if (!data?.subscription) {
        setSubscription(DEFAULT_SUBSCRIPTION);
        return;
      }
      setSubscription({ ...DEFAULT_SUBSCRIPTION, ...data.subscription });
    });
    return unsubscribeDoc;
  }, [user]);

  const isEntitled = useCallback(
    (plan: Exclude<PlanId, "free">) => {
      const activeStatuses: SubscriptionState["status"][] = ["active", "trialing"];
      return activeStatuses.includes(subscription.status) && PLAN_RANK[subscription.planId] >= PLAN_RANK[plan];
    },
    [subscription]
  );

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (DEMO_MODE) {
      await demoAuth.signUp(email, password, fullName);
      return;
    }
    if (!auth || !db) throw NOT_CONFIGURED_ERROR;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: fullName });
    await setDoc(doc(db, "users", credential.user.uid), {
      email,
      fullName,
      createdAt: serverTimestamp(),
      subscription: DEFAULT_SUBSCRIPTION,
    });
  }, []);

  const logIn = useCallback(async (email: string, password: string) => {
    if (DEMO_MODE) {
      await demoAuth.logIn(email, password);
      return;
    }
    if (!auth) throw NOT_CONFIGURED_ERROR;
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logOut = useCallback(async () => {
    if (DEMO_MODE) {
      await demoAuth.logOut();
      return;
    }
    if (!auth) return;
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    if (DEMO_MODE) return; // nothing to reset against in demo mode
    if (!auth) throw NOT_CONFIGURED_ERROR;
    await sendPasswordResetEmail(auth, email);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, subscription, isEntitled, signUp, logIn, logOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};
