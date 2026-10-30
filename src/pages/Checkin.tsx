import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import Index from "@/pages/Index";

/** Mirrors FREE_CHECKIN_DAILY_LIMIT in gcp-functions/voice-history. */
const FREE_CHECKIN_DAILY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The signed-in entry point: skips the marketing home, language picker, and
 * triage (an account already carries consent and an identity) and opens
 * straight on recording. Finishing or starting over returns to /dashboard.
 *
 * Entitlement, which is subtler than it looks:
 *
 *   free   three check-ins a day. Pricing sells this as "Try it — three
 *          check-ins a day, a week of your own trend".
 *   core+  unlimited.
 *
 * This used to require Core, which bounced every free account straight to
 * /pricing and made the free tier unreachable despite being sold on the
 * pricing page. Now the gate is an ACCOUNT, and free accounts are stopped by
 * having already used today's three rather than by their plan.
 *
 * The count comes from stored history, which is the same record the trend view
 * reads. It is a product gate, not a security boundary: history is append-only
 * per the Firestore rules, but anyone determined could still burn an extra
 * check-in by other means. The real limit is enforced server-side in
 * gcp-functions/voice-history; this is a courtesy that avoids the round trip.
 */
const Checkin = () => {
  const { user, isEntitled } = useAuth();
  const { loading, sessions, error, refresh } = useVoiceHistory();

  const unlimited = isEntitled("core");
  const usedToday = sessions.filter((session) => Date.now() - session.capturedAt < DAY_MS).length;
  const underLimit = usedToday < FREE_CHECKIN_DAILY_LIMIT;
  const [admittedUid, setAdmittedUid] = useState<string | null>(null);
  const admitted = Boolean(user && admittedUid === user.uid);

  // History is an entry gate, not a live condition on an active recording.
  // Its hook reloads when pathway/jobId changes. Hiding Index on those
  // reloads remounts it with initialState=capture and clears the completed
  // result, so a successful analysis starts recording again for free users.
  useEffect(() => {
    if (!user) { setAdmittedUid(null); return; }
    if (!loading && !error && underLimit) setAdmittedUid(user.uid);
  }, [user?.uid, loading, error, underLimit]);

  // Admission is scoped to this account and this mounted /checkin visit.
  // A later visit still checks whether today's free check-ins are used up.
  if (!user) return <Navigate to="/login" replace />;

  // Don't decide anything while history is still loading, or a paid-looking
  // free user gets bounced on a race.
  if (!unlimited && !admitted && loading) return null;

  if (!unlimited && !admitted && error) return <main className="p-8"><p role="alert">{error}</p><button onClick={refresh}>Retry loading history</button></main>;

  if (!unlimited && !admitted && !underLimit) {
    return <Navigate to="/pricing" replace />;
  }

  if (!unlimited && !admitted) return null;

  return <Index initialState="capture" presetPathway="WELLNESS" exitTo="/dashboard" />;
};

export default Checkin;
