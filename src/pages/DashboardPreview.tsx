import Dashboard from "./Dashboard";
import type { StoredSession } from "@/lib/voice-history-client";

/** Development-only layout fixtures. Never saved to an account or shown on /dashboard. */
export default function DashboardPreview() {
  if (!import.meta.env.DEV) return null;
  const count = new URLSearchParams(window.location.search).get("history") === "three" ? 3 : 1;
  const sessions: StoredSession[] = Array.from({ length: count }, (_, index) => ({
    sessionId: `layout-example-${index}`,
    capturedAt: Date.now() - index * 86400000,
    source: "browser",
    model: "pulse",
    pathway: "WELLNESS",
    summary: null,
    signals: [
      { name: "stress", label: "Stress", level: "moderate", score: .5, flagged: true },
      { name: "anxiety", label: "Anxiety", level: "low", score: .2, flagged: false },
      { name: "fatigue", label: "Fatigue", level: "consider", score: .4, flagged: true },
      { name: "dehydration", label: "Dehydration", level: "none", score: .1, flagged: false },
      { name: "sleep-disturbance", label: "Sleep Disturbance", level: "low", score: .3, flagged: false },
    ],
  }));
  return <><p style={{ padding: 12, textAlign: "center", color: "#111111", background: "#F2EFE9" }}>Layout preview · Example readings only</p><Dashboard previewHistory={sessions} /></>;
}
