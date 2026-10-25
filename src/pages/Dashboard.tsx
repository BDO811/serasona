import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Mic, Phone, ArrowUpRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import { DashboardTrends } from "@/components/member/DashboardTrends";
import type { TrendMetric } from "@/lib/dashboard-trends";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import { MemberShell } from "@/components/member/MemberShell";
import { VoiceSculpture, VoiceWave } from "@/components/member/VoiceSculpture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SCORE_VERSION, computeSerasonaScore, scoreBandFor } from "@/lib/serasona-score";
import { computeSleepScore } from "@/lib/sleep-score";
import { dashboardSessions, comparableSessions, metricValue, sourceLabel, isUsableSession, type DashboardMetric } from "@/lib/dashboard-data";
import { SignalPanel } from "@/components/report/SignalPanel";
import { DashboardBodyMap } from "@/components/member/DashboardBodyMap";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import { RUNG_SCALE, RUNG_RECOMMENDATION } from "@/lib/result-headline";
import { bandForSignal, bandLabelForSignal, signLabel, actionOf, actionLabel } from "@/lib/signal-band";
import { dashboardZoneForSignal, DASHBOARD_ZONE_LABEL, type DashboardZone } from "@/lib/dashboard-body-zones";
import { getProtocolId } from "@/lib/assessment-display-utils";
import type { AssessmentPathway } from "@/context/AssessmentContext";
import "@/components/member/dashboard-v2.css";
import type { StoredSession } from "@/lib/voice-history-client";

import { lastThreeMeasurements } from "@/lib/daily-scores";
import { scoreMatrixForPlan } from "@/lib/score-matrix";

const SIGNAL_COLORS = { NORMAL: "#7CC49A", LOW: "#8FA9F5", MODERATE: "#EE8E8A", ELEVATED: "#D12B26", INCONCLUSIVE: "#B9B3A6" };
const METRICS = [{ key: "overall", label: "Serasona" }, { key: "stress", label: "Stress" }, { key: "wellness", label: "Wellness" }, { key: "clarity", label: "Clarity" }] as const;
const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const dateAndTime = (ms: number) => new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const stateLabel = (session: StoredSession) => session.status && session.status !== "complete" ? session.status.replace(/_/g, " ") : session.quality?.usable === false ? "Unusable audio" : session.signals.length ? "Results available" : "No readable results";

export default function Dashboard() {
  const { user, subscription, subscriptionError, isEntitled } = useAuth();
  const { sessions, loading, error, refresh } = useVoiceHistory({ save: true, refreshInterval: 30000 });
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("all");
  const [metric, setMetric] = useState<TrendMetric>("all");
  const [selected, setSelected] = useState<StoredSession | null>(null);
  const [zone, setZone] = useState<DashboardZone | null>(null);
  const [tab, setTab] = useState("overview");
  const [explaining, setExplaining] = useState(false);
  const [bodySex, setBodySex] = useState("");
  useEffect(() => {
    let canceled = false;
    if (!user || !db) return;
    getDoc(doc(db, "users", user.uid)).then((snapshot) => {
      if (!canceled) setBodySex(snapshot.data()?.biologicalSex ?? "");
    }).catch(() => {});
    return () => { canceled = true; };
  }, [user?.uid]);
  const chronological = useMemo(() => [...sessions].sort((a, b) => a.capturedAt - b.capturedAt), [sessions]);
  const readable = chronological.filter(isUsableSession);
  const latest = readable[readable.length - 1];
  const measurements = lastThreeMeasurements(sessions);
  const score = latest ? computeSerasonaScore(latest.signals) : null;
  const sleepScore = latest ? computeSleepScore(latest.signals) : null;
  const visible = useMemo(() => dashboardSessions(sessions, days, source), [sessions, days, source]);
  const reference = [...visible].reverse().find(isUsableSession);
  const comparable = comparableSessions(visible, reference);
  const matrix = measurements;

  const firstName = user?.displayName?.split(" ")[0];
  const canCall = isEntitled("plus");
  useEffect(() => setZone(null), [latest?.sessionId]);
  const assessment = assessmentForSession(latest);
  const phonePath = canCall ? "/checkin/phone?mode=phone" : "/account#subscription";
  const filteredSignals = latest?.signals.filter((sign) => !zone || dashboardZoneForSignal(sign.name) === zone) ?? [];
  const captureLinks = <><Link className="member-button member-primary" to="/checkin"><Mic size={16} />Record my voice</Link><Link className="member-button" to={phonePath}><Phone size={16} />{canCall ? "Phone check-in" : "Upgrade for phone calls"}</Link></>;

  // One row, four cards: the three group indices plus the Sleep Score. Every
  // card is a link straight to that measure's full method-and-references
  // page rather than a filter toggle or a modal — the Dashboard shows the
  // number, the docs page carries the explanation.
  const metricCards = [
    ...METRICS.slice(1).map(({ key, label }) => {
      const value = latest ? metricValue(latest, key) : null;
      return { key, label: `${label} Index`, path: `/docs/${key}-score`, value, bandLabel: value != null ? scoreBandFor(value).bandLabel : null };
    }),
    { key: "sleep", label: "Sleep Score", path: "/docs/sleep-score", value: sleepScore?.score ?? null, bandLabel: sleepScore?.bandLabel ?? null },
  ];


  return <MemberShell>
    <main className="dashboard-v2 dv-priority">
      <section className="dv-score-banner" aria-labelledby="serasona-score-title">
        <div className="dv-score-copy"><h1 id="serasona-score-title">YOUR SERASONA SCORE</h1><p>{firstName ? `${firstName}, your` : "Your"} last three measurements. The latest scored check-ins, whenever they were recorded.</p><button className="dv-score-method" onClick={() => setExplaining(true)}>View score weights and level matrix</button></div>
        <div className="dv-score-days" aria-label="Last three measurements of Serasona scores" aria-live="polite">{measurements.map((measurement, index) => {
          const content = <><span className="dv-day-heading">{measurement.label}<small>{measurement.capturedAt ? date(measurement.capturedAt) : "—"}</small></span><span className="dv-day-value">{loading && !sessions.length ? "…" : error ? "Unavailable" : measurement.score ?? "No reading"}{measurement.score != null && <small>/ 100</small>}</span><span className="dv-day-context">{measurement.session ? <>{measurement.band} · {sourceLabel(measurement.session)}<small>{new Date(measurement.session.capturedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</small></> : loading ? "Loading readings" : "No saved check-in yet"}</span></>;
          return measurement.session ? <button key={index} className={`dv-score-day ${index === 0 ? "is-latest" : ""}`} onClick={() => setSelected(measurement.session!)} aria-label={`Review ${measurement.label.toLowerCase()} reading, ${dateTime(measurement.session.capturedAt)}: Serasona score ${measurement.score}`}>{content}</button> : <div key={index} className="dv-score-day is-empty">{content}</div>;
        })}</div><button className="member-icon-button dv-score-refresh" onClick={refresh} disabled={loading} aria-label="Refresh results"><RefreshCw size={18} className={loading ? "member-spin" : ""} /></button>
        <VoiceSculpture />
      </section>
      {subscriptionError && <p className="member-message" role="alert">{subscriptionError}</p>}
    <section className="member-capture dv-capture dv-capture-top" aria-label="Voice check-in"><div className="dv-capture-copy"><VoiceWave /><h2>Your next check-in starts here.</h2><p>Speak naturally. Keep your recording source consistent when following a trend.</p></div><div className="dv-capture-actions">{captureLinks}<p className="member-note">{canCall ? "Phone calls are included in your plan." : "Phone calls require active Plus or Executive."}</p><Link to="/account#calling-voice" className="dv-voice-settings">Choose your calling voice</Link></div></section>
      {error ? <div className="member-message member-error" role="alert"><h2>We couldn’t load your readings.</h2><p>{error}</p><button onClick={refresh}>Try again</button></div> : loading && !sessions.length ? <div className="member-message" role="status">Loading your check-in history…</div> : !sessions.length ? <section className="member-message"><h2>Your first reading starts with your voice.</h2><p>Record a check-in above to see your actual results here. Your history builds with each completed reading.</p></section> : <>
        <div className="dv-priority-results" aria-label="Your latest assessment">
          <DashboardBodyMap session={latest} zone={zone} onZoneChange={setZone} loading={false} bodySex={bodySex} />
          <section className="dv-panel dv-signals"><div className="member-section-heading"><h2>PHYSIOLOGIC ANALYSIS</h2><small>{assessment.flaggedCount} OF {latest?.signals.length ?? 0} FLAGGED</small></div><div className="dv-signal-filter"><p>{zone ? `${DASHBOARD_ZONE_LABEL[zone]} signals` : "Select a region in the body map to filter these results."}</p>{zone && <button onClick={() => setZone(null)}>Show all signs</button>}</div><div className="dv-report-signals"><SignalPanel signals={filteredSignals.map((s) => ({ ...s, level: s.level || "inconclusive" }))} showContent bandColors={SIGNAL_COLORS} /></div>{!filteredSignals.length && <p>No signs returned for this region in this recording.</p>}</section>

        </div>
          <div className="member-metrics member-metrics-4">{metricCards.map((card) => {
            const abnormal = card.bandLabel != null && card.bandLabel !== "Clear";
            return <Link key={card.key} to={card.path} className={`member-metric ${card.key} ${abnormal ? "is-abnormal" : ""}`}><small>{card.label.toUpperCase()}</small><strong>{card.value ?? "Not read"}</strong><small>{card.bandLabel ?? (latest ? "No reading" : "Not read")}</small></Link>;
          })}</div>
        {latest && <div className="dv-summary"><div><small>{assessment.title.toUpperCase()} PROFILE</small><strong>{assessment.profileLabel}</strong></div><div><small>ASSESSMENT</small><strong>{RUNG_RECOMMENDATION[assessment.rung]}</strong></div><div className="dv-scale" aria-label={`Assessment profile: ${assessment.profileLabel}`}>{RUNG_SCALE.map((rung) => <span key={rung.key} className={`dv-level-${rung.key} ${assessment.rung === rung.key ? "is-current" : ""}`} aria-current={assessment.rung === rung.key ? "true" : undefined}>{rung.label}</span>)}{assessment.rung === "unreadable" && <span className="is-current">INCONCLUSIVE</span>}</div></div>}
        <div className="dv-tabs" aria-label="Dashboard view">{["overview", "assessment"].map((value) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "overview" ? "Trends & history" : "Assessment details"}</button>)}</div>
        {tab === "overview" && <>
          <section className="member-section dv-panel">
            <DashboardTrends sessions={comparable} metric={metric} onMetricChange={setMetric} controls={<>
              <div className="member-controls"><span className="member-note">Saved history period</span><div className="member-ranges" aria-label="History period">{[7, 30, 90].map((n) => <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n}D</button>)}</div></div>
              <div className="member-controls member-source-controls"><label htmlFor="source"><SlidersHorizontal size={14} />Recording source</label><select id="source" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All sources</option><option value="browser">Browser</option><option value="phone">Phone</option><option value="unknown">Source not recorded</option></select></div>
            </>} />
            <div className="member-matrix-scroll"><table className="member-matrix dv-daily-matrix"><caption>Your saved readings · Last 3 measurements</caption><thead><tr><th scope="col">SIGNAL INDEX</th>{matrix.map((measurement, index) => <th scope="col" key={index}>{measurement.session ? <button onClick={() => setSelected(measurement.session!)} title={dateTime(measurement.session.capturedAt)}>{dateAndTime(measurement.session.capturedAt)}</button> : "—"}</th>)}</tr></thead><tbody>{METRICS.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th>{matrix.map((measurement, index) => { const value = measurement.session ? metricValue(measurement.session, key) : null; return <td key={index} className={value !== null && value >= 67 ? "member-matrix-clear" : ""}>{value ?? (measurement.session ? "Not read" : "No reading")}</td>; })}</tr>)}</tbody></table></div>
          </section>
          <section className="member-section dv-panel"><div className="member-section-heading"><h2>Recent check-ins</h2><span className="member-note">{visible.length} in this view</span></div><div className="member-table-scroll"><table className="member-sessions"><thead><tr><th scope="col">RECORDED</th><th scope="col">SOURCE</th><th scope="col">MODEL</th><th scope="col">STATUS</th><th scope="col">REVIEW</th></tr></thead><tbody>{[...visible].reverse().map((session) => <tr key={session.sessionId}><td>{dateTime(session.capturedAt)}</td><td>{sourceLabel(session)}</td><td>{session.model || "Not recorded"}</td><td>{stateLabel(session)}</td><td><button onClick={() => setSelected(session)} aria-label={`Open reading from ${dateTime(session.capturedAt)}`}>Open <ArrowUpRight size={14} /></button></td></tr>)}</tbody></table></div></section>

        </>}
        {tab === "assessment" && <section className="dv-panel dv-assessment-detail"><h2>Your assessment in context</h2><p>The profile summarizes the returned sign bands. Individual signs above show what was flagged and what was inconclusive.</p>{latest?.summary?.recommendedAction && <p><strong>Provider recommended action:</strong> {actionLabel(actionOf(latest.summary.recommendedAction))}</p>}{latest && <button onClick={() => setSelected(latest)}>Inspect latest result <ArrowUpRight size={16} /></button>}
        {latest && <details className="dv-panel dv-provenance" open={tab === "assessment"}><summary>Assessment provenance</summary><dl><dt>STATUS</dt><dd>Analysis complete</dd><dt>ASSESSMENT</dt><dd>{assessment.title} check assessment</dd><dt>PROTOCOL</dt><dd>{latest.pathway ? getProtocolId(latest.pathway as AssessmentPathway) : "Not recorded"}</dd><dt>DATE / SOURCE</dt><dd>{dateTime(latest.capturedAt)} · {sourceLabel(latest)}</dd><dt>MODEL</dt><dd>{latest.model || "Not recorded"}</dd><dt>SAVED SESSION ID</dt><dd>{latest.sessionId}</dd><dt>METHOD</dt><dd>Vocal biomarker analysis</dd>{latest.summary?.recommendedAction && <><dt>PROVIDER RECOMMENDED ACTION</dt><dd>{actionLabel(actionOf(latest.summary.recommendedAction))}</dd></>}</dl></details>}

        </section>}
      </>}
      <button className="member-text-button" onClick={() => setExplaining(true)}>How are these indices calculated?</button>
    </main>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="member-result-dialog"><DialogHeader><DialogTitle>Your check-in</DialogTitle><DialogDescription>{selected ? `${dateTime(selected.capturedAt)} · ${sourceLabel(selected)} · ${selected.model || "Model not recorded"}` : ""}</DialogDescription></DialogHeader>{selected && <><div className="member-result-status">{stateLabel(selected)}{selected.speechSeconds != null ? ` · ${Math.round(selected.speechSeconds)} seconds of speech` : ""}{selected.captureSampleRate != null ? ` · ${selected.captureSampleRate.toLocaleString()} Hz` : ""}</div>{selected.quality?.reason && <p>{selected.quality.reason}</p>}{isUsableSession(selected) ? <><p className="member-note">{selected.summary?.recommendedAction?.replace(/_/g, " ") || "Review these readings in the context of how you feel."}</p><div className="member-result-signals">{selected.signals.map((sign) => { const band = bandForSignal(sign.name, sign.level, sign.score); return <div key={sign.name}><span>{signLabel(sign.name, sign.label)}</span><strong>{band === "INCONCLUSIVE" ? "Inconclusive · not scored" : bandLabelForSignal(sign.name, band).toLowerCase()}</strong></div>; })}</div></> : <p>No wellness index is calculated for an unsuccessful or unusable recording.</p>}</>}</DialogContent></Dialog>
    <Dialog open={explaining} onOpenChange={setExplaining}><DialogContent className="member-result-dialog"><DialogHeader><DialogTitle>What the index means</DialogTitle><DialogDescription>Higher values mean fewer flagged signs in the returned model results.</DialogDescription></DialogHeader><p>Serasona groups the model’s returned sign bands into Stress, Wellness and Clarity. Inconclusive and missing signs never count as normal.</p><p><Link to="/docs/serasona-score">Read the score method and measurement references</Link></p><p>{latest?.signals.some((sign) => sign.baseline_score != null) ? "Personal baseline returned by the longitudinal API." : "Personal baseline is still building or unavailable for this recording."}</p><p>Score = sum of each readable sign’s index × weight, divided by the total readable weight. Normal = 100, Low = 68, Moderate = 38, Elevated = 8. Higher means fewer flags. Repeated signs count once.</p><p>Compare the same source, model and scored signs. A change in coverage starts a separate comparison. Provider recommendations and individual flags remain visible even when the composite is high.</p>
      <div className="member-table-scroll"><table className="member-sessions"><caption>Level matrix · {subscription.planId} · {SCORE_VERSION}</caption><thead><tr><th>Available model</th><th>Measured signs and relative weights</th></tr></thead><tbody>{scoreMatrixForPlan(subscription.planId).map(({ model, signs }) => <tr key={model.id}><th>{model.name}</th><td>{signs.map((sign) => `${sign.name.replace(/-/g, " ")}: ${sign.weight}`).join(" · ")}</td></tr>)}</tbody></table></div><p>Free and Core: Pulse. Plus: Pulse with Haven, Apex and Tide available. Executive: all eight models. Sensitive models still require consent. Only returned signs enter the score.</p>
      {score && <div className="member-table-scroll"><table className="member-sessions"><caption>Latest score contributions</caption><thead><tr><th>Sign</th><th>Index</th><th>Effective weight</th></tr></thead><tbody>{score.signals.map((sign) => <tr key={sign.name}><th>{sign.label}</th><td>{sign.index ?? "Unscored"}</td><td>{sign.index === null ? "Excluded" : `${(100 * sign.weight / score.signals.filter((s) => s.index !== null).reduce((sum, s) => sum + s.weight, 0)).toFixed(1)}%`}</td></tr>)}</tbody></table></div>}</DialogContent></Dialog>
  </MemberShell>;
}
