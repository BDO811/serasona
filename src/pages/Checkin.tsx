import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import Index from "@/pages/Index";

/**
 * The signed-in entry point: skips the marketing home, language picker, and
 * triage (an account already carries consent and an identity) and opens
 * straight on recording. Finishing or starting over returns to /dashboard.
 *
 * Entitlement, which is subtler than it looks:
 *
 *   free   one check-in, ever. Pricing sells this as "Try it — one 20-second
 *          check-in, your seven signals, this time only, no history or trend".
 *   core+  unlimited.
 *
 * This used to require Core, which bounced every free account straight to
 * /pricing and made the free tier unreachable despite being sold on the
 * pricing page. Now the gate is an ACCOUNT, and free accounts are stopped by
 * having already used their one rather than by their plan.
 *
 * The count comes from stored history, which is the same record the trend view
 * reads. It is a product gate, not a security boundary: history is append-only
 * per the Firestore rules, but anyone determined could still burn a second
 * check-in by other means. Enforce for real server-side before this costs
 * money at volume.
 */
const Checkin = () => {
  const { user, isEntitled } = useAuth();
  const { loading, sessions, error, refresh } = useVoiceHistory();

  const unlimited = isEntitled("core");
  const [admittedUid, setAdmittedUid] = useState<string | null>(null);
  const admitted = Boolean(user && admittedUid === user.uid);

  // History is an entry gate, not a live condition on an active recording.
  // Its hook reloads when pathway/jobId changes. Hiding Index on those
  // reloads remounts it with initialState=capture and clears the completed
  // result, so a successful analysis starts recording again for free users.
  useEffect(() => {
    if (!user) { setAdmittedUid(null); return; }
    if (!loading && !error && sessions.length === 0) setAdmittedUid(user.uid);
  }, [user?.uid, loading, error, sessions.length]);

  // Admission is scoped to this account and this mounted /checkin visit.
  // A later visit still checks whether the free reading has been used.
  if (!user) return <Navigate to="/login" replace />;

  // Don't decide anything while history is still loading, or a paid-looking
  // free user gets bounced on a race.
  if (!unlimited && !admitted && loading) return null;

  if (!unlimited && !admitted && error) return <main className="p-8"><p role="alert">{error}</p><button onClick={refresh}>Retry loading history</button></main>;

  if (!unlimited && !admitted && sessions.length > 0) {
    return <Navigate to="/pricing" replace />;
  }

  if (!unlimited && !admitted) return null;

  return <Index initialState="capture" presetPathway="WELLNESS" exitTo="/dashboard" />;
};

export default Checkin;
