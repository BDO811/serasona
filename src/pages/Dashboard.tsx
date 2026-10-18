import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Phone, ArrowUpRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import { MemberShell } from "@/components/member/MemberShell";
import { VoiceSculpture, VoiceWave } from "@/components/member/VoiceSculpture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SCORE_VERSION, computeSerasonaScore } from "@/lib/serasona-score";
import { dashboardSessions, comparableSessions, metricValue, sourceLabel, isUsableSession, type DashboardMetric } from "@/lib/dashboard-data";
import { SignalPanel } from "@/components/report/SignalPanel";
import { DashboardBodyMap } from "@/components/member/DashboardBodyMap";
import { assessmentForSession } from "@/lib/dashboard-assessment";
import { RUNG_SCALE, RUNG_RECOMMENDATION } from "@/lib/result-headline";
import { bandForSignal, bandLabelForSignal, isFlaggedBand, signLabel, actionOf, actionLabel } from "@/lib/signal-band";
import { zoneForSignal, BODY_ZONE_LABEL, type BodyZone } from "@/lib/body-zone-map";
import { getProtocolId } from "@/lib/assessment-display-utils";
import type { AssessmentPathway } from "@/context/AssessmentContext";
import "@/components/member/dashboard-v2.css";
import type { StoredSession } from "@/lib/voice-history-client";

import { scoreMatrixForPlan } from "@/lib/score-matrix";

const SIGNAL_COLORS = { NORMAL: "#99E4FF", LOW: "#F5EF79", MODERATE: "#FFC163", ELEVATED: "#FF6173", INCONCLUSIVE: "#CECECE" };
const METRICS = [{ key: "overall", label: "Serasona" }, { key: "stress", label: "Stress" }, { key: "wellness", label: "Wellness" }, { key: "clarity", label: "Clarity" }] as const;
const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const stateLabel = (session: StoredSession) => session.status && session.status !== "complete" ? session.status.replace(/_/g, " ") : session.quality?.usable === false ? "Unusable audio" : session.signals.length ? "Results available" : "No readable results";

export default function Dashboard() {
  const { user, subscription, subscriptionError, isEntitled } = useAuth();
  const { sessions, loading, error, refresh } = useVoiceHistory({ refreshInterval: 30000 });
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("all");
  const [metric, setMetric] = useState<DashboardMetric>("overall");
  const [selected, setSelected] = useState<StoredSession | null>(null);
  const [zone, setZone] = useState<BodyZone | null>(null);
  const [tab, setTab] = useState("overview");
  const [explaining, setExplaining] = useState(false);
  const chronological = useMemo(() => [...sessions].sort((a, b) => a.capturedAt - b.capturedAt), [sessions]);
  const readable = chronological.filter(isUsableSession);
  const latest = readable[readable.length - 1];
  const score = latest ? computeSerasonaScore(latest.signals) : null;
  const visible = useMemo(() => dashboardSessions(sessions, days, source), [sessions, days, source]);
  const reference = [...visible].reverse().find(isUsableSession);
  const comparable = comparableSessions(visible, reference);
  const points = comparable.map((session) => ({ capturedAt: session.capturedAt, value: metricValue(session, metric) }));
  const matrix = comparable.slice(-7);

  const firstName = user?.displayName?.split(" ")[0];
  const canCall = isEntitled("plus");
  useEffect(() => setZone(null), [latest?.sessionId]);
  const assessment = assessmentForSession(latest);
  const phonePath = canCall ? "/checkin/phone?mode=phone" : "/account#subscription";
  const filteredSignals = latest?.signals.filter((sign) => !zone || zoneForSignal(sign.name) === zone) ?? [];
  const captureLinks = <><Link className="member-button member-primary" to="/checkin"><Mic size={16} />Record my voice</Link><Link className="member-button" to={phonePath}><Phone size={16} />{canCall ? "Phone check-in" : "Upgrade for phone calls"}</Link></>;


  return <MemberShell motionControl>
    {subscriptionError && <p className="member-message" role="alert">{subscriptionError}</p>}
    <div className="dashboard-v2">
      <div className="dv-intro"><div><h1>A closer look at your patterns.</h1><p>{firstName ? `${firstName}, your` : "Your"} voice, your results, and the context to understand them.</p></div><div className="dv-actions"><button className="member-icon-button" onClick={refresh} disabled={loading} aria-label="Refresh results"><RefreshCw size={18} className={loading ? "member-spin" : ""} /></button></div></div>
    <section className="dv-panel dv-score" aria-label="Serasona Score">
      <div><small>SERASONA SCORE · {subscription.planId.toUpperCase()}</small><h2>{loading && !sessions.length ? "Loading…" : score?.score == null ? "No score yet" : <>{score.score}<small> / 100</small></>}</h2><p>{score?.bandLabel ?? "A completed, readable check-in starts your score."}</p></div>
      <div><p>Higher scores mean fewer flagged voice signs. Weighted only from what your recording measured.</p><p className="member-note">{score ? `${score.signals.filter((sign) => sign.index !== null).length} scored signs · ${latest?.model ?? "Model not recorded"} · ${dateTime(latest!.capturedAt)}` : "Missing and inconclusive signs stay unscored."}</p><p className="member-note">{latest?.signals.some((sign) => sign.baseline_score != null) ? "Personal baseline returned by the longitudinal API." : "Personal baseline is still building or unavailable for this recording."}</p><button className="member-text-button" onClick={() => setExplaining(true)}>View score weights and level matrix</button></div>
    </section>
    <section className="member-capture dv-capture dv-capture-top" aria-label="Voice check-in"><div className="dv-capture-copy"><VoiceWave /><h2>Your next check-in starts here.</h2><p>Speak naturally. Keep your recording source consistent when following a trend.</p></div><div className="dv-capture-actions">{captureLinks}<p className="member-note">{canCall ? "Phone calls are included in your plan." : "Phone calls require active Plus or Executive."}</p><Link to="/account#calling-voice" className="dv-voice-settings">Choose your calling voice</Link></div></section>
    <div className="dv-layout">
      <main className="dv-main">
        <div className="dv-tabs" aria-label="Dashboard view">{["overview", "assessment"].map((value) => <button key={value} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "overview" ? "Overview" : "Assessment details"}</button>)}</div>
        <section className="member-hero dv-hero">
          <div className="member-hero-copy"><span className="member-pill">{loading && !sessions.length ? "Loading your readings" : latest ? `Assessment complete · ${sourceLabel(latest)}` : "Your next chapter starts here"}</span><h2>{latest ? <>Your voice.<br />Your whole picture.</> : <>A small moment.<br />A useful perspective.</>}</h2><p>{latest ? `${assessment.flaggedCount} of ${latest.signals.length} returned signs flagged. Review the individual results alongside how you feel.` : "Record a voice check-in to build your personal picture. Your actual results will appear here."}</p>{latest && <div className="dv-scale" aria-label={`Assessment profile: ${assessment.profileLabel}`}>{RUNG_SCALE.map((rung) => <span key={rung.key} className={assessment.rung === rung.key ? "is-current" : ""} aria-current={assessment.rung === rung.key ? "true" : undefined}>{rung.label}</span>)}{assessment.rung === "unreadable" && <span className="is-current">INCONCLUSIVE</span>}</div>}</div>
          <VoiceSculpture />
        </section>
        {latest && <div className="dv-summary"><div><small>{assessment.title.toUpperCase()} PROFILE</small><strong>{assessment.profileLabel}</strong></div><div><small>ASSESSMENT</small><strong>{RUNG_RECOMMENDATION[assessment.rung]}</strong></div><div><small>LAST CHECK-IN</small><strong>{dateTime(latest.capturedAt)}</strong></div></div>}
        {error ? <div className="member-message member-error" role="alert"><h2>We couldn’t load your readings.</h2><p>{error}</p><button onClick={refresh}>Try again</button></div> : loading && !sessions.length ? <div className="member-message" role="status">Loading your check-in history…</div> : !sessions.length ? <section className="member-message"><h2>Your first reading starts with your voice.</h2><p>Record a check-in to see your actual results here. Your history builds with each completed reading.</p></section> : <>
          {tab === "assessment" && latest && <section className="dv-panel dv-assessment-detail"><h2>Your assessment in context</h2><p>The profile summarizes the returned sign bands. Individual signs below show what was flagged and what was inconclusive.</p>{latest?.summary?.recommendedAction && <p><strong>Provider recommended action:</strong> {actionLabel(actionOf(latest.summary.recommendedAction))}</p>}<button onClick={() => latest && setSelected(latest)}>Inspect latest result <ArrowUpRight size={16} /></button></section>}
          {tab === "overview" && <>
          <div className="member-metrics">{METRICS.slice(1).map(({ key, label }) => <button key={key} className={`member-metric ${key}`} onClick={() => setMetric(key)} aria-pressed={metric === key}><small>{label.toUpperCase()} INDEX</small><strong>{latest ? metricValue(latest, key) ?? "Not read" : "Not read"}</strong><small>{score?.groups.find((group) => group.group === key)?.signals.filter((sign) => sign.index !== null).length ?? 0} readable signs</small></button>)}</div>
          <section className="member-section dv-panel">
            <h2 className="dv-chart-heading">Your patterns over time</h2>
            <div className="member-controls"><label><span className="sr-only">Trend metric</span><select value={metric} onChange={(e) => setMetric(e.target.value as DashboardMetric)}>{METRICS.map(({ key, label }) => <option value={key} key={key}>{label} index</option>)}</select></label><div className="member-ranges" aria-label="History period">{[7, 30, 90].map((n) => <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n}D</button>)}</div></div>
            <div className="member-controls member-source-controls"><label htmlFor="source"><SlidersHorizontal size={14} />Recording source</label><select id="source" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All sources</option><option value="browser">Browser</option><option value="phone">Phone</option><option value="unknown">Source not recorded</option></select></div>
            {points.some((point) => point.value !== null) ? <div className="member-chart"><ResponsiveContainer width="100%" height={230}><LineChart data={points} margin={{ top: 20, right: 20, left: -15, bottom: 10 }}><CartesianGrid vertical={false} stroke="#d0c0db" /><XAxis dataKey="capturedAt" type="number" domain={['dataMin', 'dataMax']} tickFormatter={date} tick={{ fontSize: 11, fill: "#523567" }} minTickGap={35} /><YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: "#523567" }} /><Tooltip labelFormatter={(value) => dateTime(Number(value))} formatter={(value: number) => [value, `${METRICS.find((item) => item.key === metric)?.label} index`]} contentStyle={{ background: "#F0EAE0", borderRadius: 12, borderColor: "#c3a5db" }} /><Line type="linear" dataKey="value" stroke="#7040b8" strokeWidth={3} dot={{ r: 4, fill: "#7040b8", stroke: "#F0EAE0", strokeWidth: 2 }} connectNulls={false} isAnimationActive /></LineChart></ResponsiveContainer></div> : <div className="member-message"><p>{visible.length ? "This group has no conclusive results in the selected recordings." : "No check-ins in this period and source. Choose another filter or record a new check-in."}</p></div>}
            <p className="member-note">{comparable.length} comparable recordings{reference ? ` · ${sourceLabel(reference)} · ${reference.model ?? "Model not recorded"}` : ""}. The chart uses the latest matching source, model and returned signal coverage in this period. Missing results stay unscored.</p>
            {matrix.length > 0 && <div className="member-matrix-scroll"><table className="member-matrix"><caption>Recent comparable readings</caption><thead><tr><th scope="col">SIGNAL INDEX</th>{matrix.map((session) => <th scope="col" key={session.sessionId}><button onClick={() => setSelected(session)} title={dateTime(session.capturedAt)}>{date(session.capturedAt)}</button></th>)}</tr></thead><tbody>{METRICS.map(({ key, label }) => <tr key={key}><th scope="row">{label}</th>{matrix.map((session) => { const value = metricValue(session, key); return <td key={session.sessionId} className={value !== null && value >= 67 ? "member-matrix-clear" : ""}>{value ?? "Not read"}</td>; })}</tr>)}</tbody></table></div>}
          </section>
          </>}
          <section className="dv-panel dv-signals"><div className="member-section-heading"><h2>PHYSIOLOGIC ANALYSIS</h2><small>{assessment.flaggedCount} OF {latest?.signals.length ?? 0} FLAGGED</small></div><div className="dv-signal-filter"><p>{zone ? `${BODY_ZONE_LABEL[zone]} signals` : "Select a region in the body map to filter these results."}</p>{zone && <button onClick={() => setZone(null)}>Show all signs</button>}</div><div className="dv-report-signals"><SignalPanel signals={filteredSignals.map((s) => ({ ...s, level: s.level || "inconclusive" }))} showContent bandColors={SIGNAL_COLORS} /></div>{!filteredSignals.length && <p>No signs returned for this region in this recording.</p>}</section>
          <section className="member-section dv-panel"><div className="member-section-heading"><h2>Recent check-ins</h2><span className="member-note">{visible.length} in this view</span></div><div className="member-table-scroll"><table className="member-sessions"><thead><tr><th scope="col">RECORDED</th><th scope="col">SOURCE</th><th scope="col">MODEL</th><th scope="col">STATUS</th><th scope="col">REVIEW</th></tr></thead><tbody>{[...visible].reverse().map((session) => <tr key={session.sessionId}><td>{dateTime(session.capturedAt)}</td><td>{sourceLabel(session)}</td><td>{session.model || "Not recorded"}</td><td>{stateLabel(session)}</td><td><button onClick={() => setSelected(session)} aria-label={`Open reading from ${dateTime(session.capturedAt)}`}>Open <ArrowUpRight size={14} /></button></td></tr>)}</tbody></table></div></section>
        </>}
        <button className="member-text-button" onClick={() => setExplaining(true)}>How are these indices calculated?</button>
      </main>
      <aside className="dv-aside">
        <DashboardBodyMap session={latest} zone={zone} onZoneChange={setZone} loading={loading && !sessions.length} />
        {latest && <details className="dv-panel dv-provenance" open={tab === "assessment"}><summary>Assessment provenance</summary><dl><dt>STATUS</dt><dd>Analysis complete</dd><dt>ASSESSMENT</dt><dd>{assessment.title} check assessment</dd><dt>PROTOCOL</dt><dd>{latest.pathway ? getProtocolId(latest.pathway as AssessmentPathway) : "Not recorded"}</dd><dt>DATE / SOURCE</dt><dd>{dateTime(latest.capturedAt)} · {sourceLabel(latest)}</dd><dt>MODEL</dt><dd>{latest.model || "Not recorded"}</dd><dt>SAVED SESSION ID</dt><dd>{latest.sessionId}</dd><dt>METHOD</dt><dd>Vocal biomarker analysis</dd>{latest.summary?.recommendedAction && <><dt>PROVIDER RECOMMENDED ACTION</dt><dd>{actionLabel(actionOf(latest.summary.recommendedAction))}</dd></>}</dl></details>}
        <p className="member-note dv-disclaimer">The body map organizes returned voice signs by theme. It does not measure organs or diagnose a condition. Missing and inconclusive results stay unscored.</p>
      </aside>
    </div></div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="member-result-dialog"><DialogHeader><DialogTitle>Your check-in</DialogTitle><DialogDescription>{selected ? `${dateTime(selected.capturedAt)} · ${sourceLabel(selected)} · ${selected.model || "Model not recorded"}` : ""}</DialogDescription></DialogHeader>{selected && <><div className="member-result-status">{stateLabel(selected)}{selected.speechSeconds != null ? ` · ${Math.round(selected.speechSeconds)} seconds of speech` : ""}{selected.captureSampleRate != null ? ` · ${selected.captureSampleRate.toLocaleString()} Hz` : ""}</div>{selected.quality?.reason && <p>{selected.quality.reason}</p>}{isUsableSession(selected) ? <><p className="member-note">{selected.summary?.recommendedAction?.replace(/_/g, " ") || "Review these readings in the context of how you feel."}</p><div className="member-result-signals">{selected.signals.map((sign) => { const band = bandForSignal(sign.name, sign.level, sign.score); return <div key={sign.name}><span>{signLabel(sign.name, sign.label)}</span><strong>{band === "INCONCLUSIVE" ? "Inconclusive · not scored" : bandLabelForSignal(sign.name, band).toLowerCase()}</strong></div>; })}</div></> : <p>No wellness index is calculated for an unsuccessful or unusable recording.</p>}</>}</DialogContent></Dialog>
    <Dialog open={explaining} onOpenChange={setExplaining}><DialogContent className="member-result-dialog"><DialogHeader><DialogTitle>What the index means</DialogTitle><DialogDescription>Higher values mean fewer flagged signs in the returned model results.</DialogDescription></DialogHeader><p>Serasona groups the model’s returned sign bands into Stress, Wellness and Clarity. Inconclusive and missing signs never count as normal. The composite uses provisional product weights, not a validated clinical scale.</p><p>Score = sum of each readable sign’s index × weight, divided by the total readable weight. Normal = 100, Low = 68, Moderate = 38, Elevated = 8. Higher means fewer flags. Repeated signs count once.</p><p>Compare the same source, model and scored signs. A change in coverage starts a separate comparison. The score is a provisional wellness index. Provider recommendations and individual flags remain visible even when the composite is high.</p>
      <div className="member-table-scroll"><table className="member-sessions"><caption>Level matrix · {subscription.planId} · {SCORE_VERSION}</caption><thead><tr><th>Available model</th><th>Measured signs and relative weights</th></tr></thead><tbody>{scoreMatrixForPlan(subscription.planId).map(({ model, signs }) => <tr key={model.id}><th>{model.name}</th><td>{signs.map((sign) => `${sign.name.replace(/-/g, " ")}: ${sign.weight}`).join(" · ")}</td></tr>)}</tbody></table></div><p>Free and Core: Pulse. Plus: Pulse with Haven, Apex and Tide available. Executive: all eight models. Sensitive models still require consent. Only returned signs enter the score.</p>
      {score && <div className="member-table-scroll"><table className="member-sessions"><caption>Latest score contributions</caption><thead><tr><th>Sign</th><th>Index</th><th>Effective weight</th></tr></thead><tbody>{score.signals.map((sign) => <tr key={sign.name}><th>{sign.label}</th><td>{sign.index ?? "Unscored"}</td><td>{sign.index === null ? "Excluded" : `${(100 * sign.weight / score.signals.filter((s) => s.index !== null).reduce((sum, s) => sum + s.weight, 0)).toFixed(1)}%`}</td></tr>)}</tbody></table></div>}</DialogContent></Dialog>
  </MemberShell>;
}
