import { useEffect, useRef, useState } from "react";
import { useAssessment } from "@/context/AssessmentContext";
import { useAuth } from "@/context/AuthContext";
import { analyzeSignalHistory, changeSinceLastVisit, type LongitudinalRead } from "@/lib/longitudinal";
import {
  fetchHistory,
  saveSession,
  toSignalSeries,
  type StoredSession,
} from "@/lib/voice-history-client";

export interface SignalHistory {
  name: string;
  label: string;
  read: LongitudinalRead;
  /** Change from the user's previous visit. Null on a first visit. */
  sinceLastVisit: { previous: number; latest: number; change: number } | null;
}

export interface VoiceHistoryState {
  loading: boolean;
  error: string | null;
  refresh: () => void;
  /** Every stored session for this user, oldest first. */
  sessions: StoredSession[];
  /** One positioned read per signal, most-recent-deviation first. */
  signals: SignalHistory[];
  /** True when the user had sessions on record before this one. */
  isReturning: boolean;
}

const EMPTY: VoiceHistoryState = {
  loading: false,
  error: null,
  refresh: () => {},
  sessions: [],
  signals: [],
  isReturning: false,
};

/**
 * Load a user's session history, optionally persisting the current result first.
 *
 * The save is awaited before the fetch so the history that comes back includes
 * the session the user just recorded. It runs at most once per result: a
 * re-render, or a trip to the detailed view and back, must not write a
 * duplicate session and skew the user's own baseline.
 *
 * Identity is whichever of these is available, in this order: a signed-in
 * Serasona account (uid, via Firebase), or the email entered in triage
 * (anonymous demo, unchanged from before accounts existed). A signed-in user
 * is never identified by email here — see gcp-functions/voice-history for why.
 */
export function useVoiceHistory({ save = false, refreshInterval = 0 }: { save?: boolean; refreshInterval?: number } = {}): VoiceHistoryState {
  const { userProfile, visualizedResult, pathway } = useAssessment();
  const { user } = useAuth();
  const email = userProfile.email?.trim() || "";
  const jobId = visualizedResult?.jobId || "";
  const identityKey = user?.uid || email;

  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((n) => n + 1);
  const [state, setState] = useState<VoiceHistoryState>({ ...EMPTY, loading: Boolean(identityKey) });
  useEffect(() => {
    if (!refreshInterval) return;
    const interval = window.setInterval(() => { if (!document.hidden) setRevision((n) => n + 1); }, refreshInterval);
    const onFocus = () => setRevision((n) => n + 1);
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", onFocus); };
  }, [refreshInterval]);
  const savedJobIds = useRef<Set<string>>(new Set());
  const loadedIdentity = useRef(identityKey);

  useEffect(() => {
    if (!identityKey) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    const changedIdentity = loadedIdentity.current !== identityKey;
    loadedIdentity.current = identityKey;
    setState((prev) => ({ ...(changedIdentity ? EMPTY : prev), loading: true, error: null }));

    const run = async () => {
      const idToken = user ? await user.getIdToken() : null;

      // Count prior sessions before writing this one, so "returning member"
      // means they had history already rather than that they have any at all.
      let priorSessionCount = 0;

      const shouldSave =
        save && jobId && visualizedResult?.signals?.length && !savedJobIds.current.has(jobId);

      if (shouldSave) {
        const existing = await fetchHistory(email, idToken);
        priorSessionCount = existing.length;
        const saved = await saveSession(
          {
            email,
            jobId,
            source: "browser",
            model: visualizedResult.modelName ?? null,
            pathway: pathway ?? null,
            signals: visualizedResult.signals!,
            summary: {
              overallLevel: visualizedResult.likelihoodTier ?? null,
              recommendedAction: visualizedResult.recommendedAction ?? null,
              flaggedCount: visualizedResult.flaggedCount ?? null,
              totalSignals: visualizedResult.totalSignals ?? null,
            },
          },
          idToken
        );
        if (!saved) throw new Error("Your result could not be saved. Please retry before leaving this page.");
        savedJobIds.current.add(jobId);
      }

      const sessions = await fetchHistory(email, idToken, { strict: true });
      if (cancelled) return;

      const signals: SignalHistory[] = toSignalSeries(sessions)
        .map((series) => {
          const read = analyzeSignalHistory(series.readings);
          if (!read) return null;
          return {
            name: series.name,
            label: series.label,
            read,
            sinceLastVisit: changeSinceLastVisit(series.readings),
          };
        })
        .filter((s): s is SignalHistory => s !== null)
        // Largest absolute move from baseline first: that is what a returning
        // user is looking for when they open the page.
        .sort((a, b) => Math.abs(b.read.deviation ?? 0) - Math.abs(a.read.deviation ?? 0));

      setState({
        loading: false,
        error: null,
        refresh,
        sessions,
        signals,
        isReturning: shouldSave ? priorSessionCount > 0 : sessions.length > 1,
      });
    };

    run().catch((error) => {
      console.warn("[useVoiceHistory] Failed:", error);
      if (!cancelled) setState({ ...EMPTY, loading: false, error: error instanceof Error ? error.message : "Your readings could not be loaded." });
    });

    return () => {
      cancelled = true;
    };
    // visualizedResult is intentionally not a dependency: it is a new object on
    // every render, and jobId already identifies the result that matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKey, email, jobId, save, pathway, revision]);

  return loadedIdentity.current !== identityKey ? { ...EMPTY, loading: Boolean(identityKey), refresh } : { ...state, refresh };
}
