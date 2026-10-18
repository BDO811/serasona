import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Phone, ArrowUpRight, RefreshCw, SlidersHorizontal } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useVoiceHistory } from "@/hooks/use-voice-history";
import { MemberShell } from "@/components/member/MemberShell";
import { VoiceSculpture, VoiceWave } from "@/components/member/VoiceSculpture";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { computeSerasonaScore } from "@/lib/serasona-score";
import { dashboardSessions, comparableSessions, metricValue, sourceLabel, isUsableSession, type DashboardMetric } from "@/lib/dashboard-data";
import type { StoredSession } from "@/lib/voice-history-client";

const METRICS = [{ key: "overall", label: "Serasona" }, { key: "stress", label: "Stress" }, { key: "wellness", label: "Wellness" }, { key: "clarity", label: "Clarity" }] as const;
const date = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dateTime = (ms: number) => new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
const stateLabel = (session: StoredSession) => session.status && session.status !== "complete" ? session.status.replace(/_/g, " ") : session.quality?.usable === false ? "Unusable audio" : session.signals.length ? "Results available" : "No readable results";

export default function Dashboard() {
  const { user, subscription, subscriptionError, isEntitled } = useAuth();
  const { sessions, loading, error, refresh } = useVoiceHistory({ refreshInterval: 30000 });
  const [days, setDays] = useState(30);
  const [source, setSource] = useState("all");
  const [metric, setMetric] = useState<DashboardMetric>("stress");
  const [selected, setSelected] = useState<StoredSession | null>(null);
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
  const count = readable.length;
  const firstName = user?.displayName?.split(" ")[0];
  const canCall = isEntitled("plus");

  return <MemberShell motionControl>
    {subscriptionError && <p className="member-message" role="alert">{subscriptionError}</p>}
    <div className="member-layout">
      <main className="member-main">
        <div className="member-title"><div><h1>Your patterns, made visible.</h1><p>{firstName ? `${firstName}, follow` : "Follow"} a signal across check-ins. Keep each recording in perspective.</p></div><button className="member-icon-button" onClick={refresh} disabled={loading} aria-label="Refresh results"><RefreshCw size={18} className={loading ? "member-spin" : ""} /></button></div>
        <section className="member-hero">
          <div className="member-hero-copy"><small>YOUR VOICE, IN PERSPECTIVE</small><h2>Small shifts.<br />A bigger picture.</h2><p>Real readings from your own check-ins, with the context to understand what changed.</p><div className="member-hero-stats"><div><strong>{loading ? "…" : score?.score ?? "Not yet"}</strong><small>LATEST READABLE INDEX</small></div><div><strong>{loading ? "…" : count}</strong><small>READABLE CHECK-INS</small></div><div><strong>{loading ? "…" : score?.groups.length ?? 0}</strong><small>GROUPS RETURNED</small></div></div></div>
          <VoiceSculpture /><span className="member-art-caption">Voice artwork · not measured audio</span>
        </section>
        {error ? <div className="member-message member-error" role="alert"><h2>We couldn’t load your readings.</h2><p>{error}</p><button onClick={refresh}>Try again</button></div> : loading && !sessions.length ? <div className="member-message" role="status">Loading your check-in history…</div> : !sessions.length ? <section className="member-message"><h2>Your first reading starts with your voice.</h2><p>Record a check-in to see your actual results here. Your history builds with each completed reading.</p><Link className="member-button member-primary" to="/checkin"><Mic size={16} />Record my voice</Link></section> : <>
          {latest && <div className="member-latest"><div><small>LATEST READABLE RESULT · {dateTime(latest.capturedAt)} · {sourceLabel(latest)}</small><h2>{score?.bandLabel ?? "No conclusive index"}</h2></div><button onClick={() => setSelected(latest)}>Inspect result <ArrowUpRight size={16} /></button></div>}
          <div className="member-metrics">{METRICS.slice(1).map(({ key, label }) => <button key={key} className={`member-metric ${key}`} onClick={() => setMetric(key)} aria-pressed={metric === key}><small>{label.toUpperCase()} INDEX</small><strong>{latest ? metricValue(latest, key) ?? "Not read" : "Not read"}</strong><small>{score?.groups.find((group) => group.group === key)?.signals.filter((sign) => sign.index !== null).length ?? 0} readable signs</small></button>)}</div>
          <section className="member-section">
            <div className="member-controls"><label><span className="sr-only">Trend metric</span><select value={metric} onChange={(e) => setMetric(e.target.value as DashboardMetric)}>{METRICS.map(({ key, label }) => <option value={key} key={key}>{label} index</option>)}</select></label><div className="member-ranges" aria-label="History period">{[7, 30, 90].map((n) => <button key={n} aria-pressed={days === n} onClick={() => setDays(n)}>{n}D</button>)}</div></div>
            <div className="member-controls member-source-controls"><label htmlFor="source"><SlidersHorizontal size={14} />Recording source</label><select id="source" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All sources</option><option value="browser">Browser</option><option value="phone">Phone</option><option value="unknown">Source not recorded</option></select></div>
            {points.some((point) => point.value !== null) ? <div className="member-chart"><ResponsiveContainer width="100%" height={230}><LineChart data={points} margin={{ top: 20, right: 20, left: -15, bottom: 10 }}><CartesianGrid vertical={false} stroke="#d0c0db" /><XAxis dataKey="capturedAt" type="number" domain={['dataMin', 'dataMax']} tickFormatter={date} tick={{ fontSize: 11, fill: "#523567" }} minTickGap={35} /><YAxis domain={[0, 100]} ticks={[0, 50, 100]} tick={{ fontSize: 11, fill: "#523567" }} /><Tooltip labelFormatter={(value) => dateTime(Number(value))} formatter={(value: number) => [value, `${METRICS.find((item) => item.key === metric)?.label} index`]} contentStyle={{ background: "#F0EAE0", borderRadius: 12, borderColor: "#c3a5db" }} /><Line type="linear" dataKey="value" stroke="#7040b8" strokeWidth={3} dot={{ r: 4, fill: "#7040b8", stroke: "#F0EAE0", strokeWidth: 2 }} connectNulls={false} isAnimationActive /></LineChart></ResponsiveContainer></div> : <div className="member-message"><p>{visible.length ? "This group has no conclusive results in the selected recordings." : "No check-ins in this period and source. Choose another filter or record a new check-in."}</p></div>}
            <p className="member-note">{comparable.length} comparable recordings{reference ? ` · ${sourceLabel(reference)} · ${reference.model ?? "Model not recorded"}` : ""}. The chart uses the latest matching source, model and returned signal coverage in this period. Missing results stay unscored.</p>
            {matrix.length > 0 && <div className="member-matrix-scroll"><table className="member-matrix"><caption>Recent comparable readings</caption><thead><tr><th scope="col">SIGNAL INDEX</th>{matrix.map((session) => <th scope="col" key={session.sessionId}><button onClick={() => setSelected(session)} title={dateTime(session.capturedAt)}>{date(session.capturedAt)}</button></th>)}</tr></thead><tbody>{METRICS.slice(1).map(({ key, label }) => <tr key={key}><th scope="row">{label}</th>{matrix.map((session) => { const value = metricValue(session, key); return <td key={session.sessionId} className={value !== null && value >= 67 ? "member-matrix-clear" : ""}>{value ?? "Not read"}</td>; })}</tr>)}</tbody></table></div>}
          </section>
          <section className="member-section"><div className="member-section-heading"><h2>Session evidence</h2><span className="member-note">{visible.length} in this view</span></div><div className="member-table-scroll"><table className="member-sessions"><thead><tr><th scope="col">RECORDED</th><th scope="col">SOURCE</th><th scope="col">MODEL</th><th scope="col">STATUS</th><th scope="col">REVIEW</th></tr></thead><tbody>{[...visible].reverse().map((session) => <tr key={session.sessionId}><td>{dateTime(session.capturedAt)}</td><td>{sourceLabel(session)}</td><td>{session.model || "Not recorded"}</td><td>{stateLabel(session)}</td><td><button onClick={() => setSelected(session)} aria-label={`Open reading from ${dateTime(session.capturedAt)}`}>Open <ArrowUpRight size={14} /></button></td></tr>)}</tbody></table></div></section>
        </>}
        <button className="member-text-button" onClick={() => setExplaining(true)}>How are these indices calculated?</button>
      </main>
      <aside className="member-aside">
        <span className="member-pill">Your personal pattern lab</span>
        <section className="member-section"><h2>Keep your perspective.</h2><p>One reading is a snapshot. Compare repeated recordings before interpreting a change.</p><Link to="/account" className="member-button">Your account <ArrowUpRight size={16} /></Link></section>
        <section className="member-section"><h2>Know the source.</h2><p>Phone audio carries less detail than browser audio. Calls and browser recordings are kept in separate trend comparisons.</p><Link to="/models" className="member-button">Explore models <ArrowUpRight size={16} /></Link></section>
        <section className="member-capture"><VoiceWave /><h2>A small moment.<br />A useful perspective.</h2><p>Speak naturally for a new reading. Each completed check-in adds to your history.</p><Link className="member-button member-primary" to="/checkin"><Mic size={16} />Record my voice</Link><Link className="member-button" to={canCall ? "/checkin/phone?mode=phone" : "/account#subscription"}><Phone size={16} />{canCall ? "Check in by phone" : "Upgrade for phone calls"}</Link><p className="member-note">{canCall ? "Phone calls are included in your plan." : "Phone calls require active Plus or Executive."}</p></section>
        <section className="member-section"><small>YOUR SUBSCRIPTION</small><h2 className="member-capitalize">{subscription.planId}</h2><p className="member-capitalize">{subscription.status === "none" ? "No paid subscription" : subscription.status.replace(/_/g, " ")}</p><Link className="member-button" to="/account#subscription">Manage plan <ArrowUpRight size={16} /></Link></section>
      </aside>
    </div>
    <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="member-result-dialog"><DialogHeader><DialogTitle>Your check-in</DialogTitle><DialogDescription>{selected ? `${dateTime(selected.capturedAt)} · ${sourceLabel(selected)} · ${selected.model || "Model not recorded"}` : ""}</DialogDescription></DialogHeader>{selected && <><div className="member-result-status">{stateLabel(selected)}{selected.speechSeconds != null ? ` · ${Math.round(selected.speechSeconds)} seconds of speech` : ""}{selected.captureSampleRate != null ? ` · ${selected.captureSampleRate.toLocaleString()} Hz` : ""}</div>{selected.quality?.reason && <p>{selected.quality.reason}</p>}{isUsableSession(selected) ? <><p className="member-note">{selected.summary?.recommendedAction?.replace(/_/g, " ") || "Review these readings in the context of how you feel."}</p><div className="member-result-signals">{computeSerasonaScore(selected.signals)?.signals.map((sign) => <div key={sign.name}><span>{sign.label}</span><strong>{sign.displayBand === "INCONCLUSIVE" ? "Inconclusive · not scored" : sign.displayBand.toLowerCase()}</strong></div>)}</div></> : <p>No wellness index is calculated for an unsuccessful or unusable recording.</p>}<Link className="member-button member-primary" to="/checkin">Record another check-in</Link></>}</DialogContent></Dialog>
    <Dialog open={explaining} onOpenChange={setExplaining}><DialogContent className="member-result-dialog"><DialogHeader><DialogTitle>What the index means</DialogTitle><DialogDescription>Higher values mean fewer flagged signs in the returned model results.</DialogDescription></DialogHeader><p>Serasona groups the model’s returned sign bands into Stress, Wellness and Clarity. Inconclusive and missing signs never count as normal. The composite uses provisional product weights, not a validated clinical scale.</p><p>Compare recordings from the same source, model and returned signal coverage. No sleep, HRV or vital sign measurements are inferred from the artwork or charts.</p></DialogContent></Dialog>
  </MemberShell>;
}
