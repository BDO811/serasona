import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Phone, ArrowUpRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { MemberShell } from "@/components/member/MemberShell";
import { VoiceWave } from "@/components/member/VoiceSculpture";
import { startVoiceCheckin, pollVoiceCheckin, normalisePhone, failureCopy, VoiceCheckinError, type VoiceCheckinSession } from "@/lib/voice-checkin-client";
import { trackPhoneSession } from "@/lib/voice-history-client";
import { computeSerasonaScore } from "@/lib/serasona-score";

const WAITING: Record<string, string> = { dialing: "Connecting your call…", ringing: "Your phone is ringing.", in_call: "Your check-in is in progress.", analyzing: "Reading your voice…", capturing: "Capturing your voice…", sending_link: "Preparing your check-in…", link_sent: "Your check-in is ready." };
export default function CheckinByPhone() {
  const { user, isEntitled } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState<VoiceCheckinSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const uid = user?.uid;
  useEffect(() => {
    let canceled = false;
    if (uid && db) getDoc(doc(db, "users", uid)).then((snap) => { if (!canceled) setPhone(snap.data()?.phoneNumber || ""); }).catch(() => {});
    return () => { canceled = true; abort.current?.abort(); };
  }, [uid]);
  if (!isEntitled("plus")) return <Navigate to="/account#subscription" replace />;
  const saveFinal = async (id: string) => {
    setSaving(true); setSaveError("");
    try { await trackPhoneSession(id); return true; }
    catch (err) { setSaveError(err instanceof Error ? err.message : "History sync is unavailable. Please retry."); return false; }
    finally { setSaving(false); }
  };
  const begin = async () => {
    const number = normalisePhone(phone);
    if (!number) { setError("Enter a valid phone number, including the country code outside the US."); return; }
    if (!consent) { setError("Confirm the call and recording consent first."); return; }
    setError(""); setSaveError(""); setStarting(true);
    abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    try {
      // The authenticated service checks the plan and links this call to the account before returning.
      const started = await startVoiceCheckin(number, { mode: "phone", consent: true });
      if (controller.signal.aborted) return;
      setSession({ sessionId: started.sessionId, status: started.status, provider: started.provider, model: "haven", speechSeconds: null, captureSampleRate: null, smsStatus: null, error: null, quality: null, result: null });
      const final = await pollVoiceCheckin(started.sessionId, { signal: controller.signal, onTick: setSession });
      if (controller.signal.aborted) return;
      setSession(final);
      const saved = await saveFinal(final.sessionId);
      if (saved && final.status === "complete" && !controller.signal.aborted) navigate("/dashboard", { replace: true });
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof VoiceCheckinError ? [err.message, err.hint].filter(Boolean).join(" ") : "Could not complete the check-in. Your dashboard can recover a call that already started.");
    } finally { if (!controller.signal.aborted) setStarting(false); }
  };
  const complete = session?.status === "complete";
  const failure = session && !WAITING[session.status] && !complete ? failureCopy(session) : null;
  const signals = session?.quality?.usable === false ? [] : computeSerasonaScore(session?.result?.result?.signals)?.signals ?? [];
  return <MemberShell><main className="member-phone-page">
    <Link to="/dashboard" className="member-text-button">Back to dashboard</Link>
    <span className="member-pill">Plus & Executive · Phone check-in</span>
    <h1>{complete ? "Your check-in is ready." : failure ? failure.title : session ? WAITING[session.status] ?? "Your check-in is in progress." : "Your voice. Any phone."}</h1>
    <VoiceWave />
    {error && <p className="member-message member-error" role="alert">{error}</p>}
    {!session ? <><p>Serasona calls your number. Speak naturally in full sentences, then review the real results in your dashboard.</p><label htmlFor="phone" className="member-field-label">Your phone number<input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={starting} /></label><label className="member-check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} disabled={starting} /><span>I want Serasona to call this number and record and analyze my voice for this check-in.</span></label><button className="member-primary" onClick={begin} disabled={starting || !phone.trim() || !consent}><Phone size={16} />{starting ? "Starting your call…" : "Call me now"}</button><p className="member-note">Phone audio has lower fidelity than browser audio. Calls are compared with other compatible calls.</p><Link to="/checkin" className="member-button">Record in the browser instead <ArrowUpRight size={16} /></Link></> : <>
      {session.speechSeconds != null && <p>{Math.round(session.speechSeconds)} seconds of speech captured.</p>}
      {complete ? <><p>These are the signs returned by this call’s model. Missing and inconclusive readings are not treated as normal.</p><div className="member-result-signals">{signals.map((sign) => <div key={sign.name}><span>{sign.label}</span><strong>{sign.displayBand.toLowerCase()}</strong></div>)}</div>{!signals.length && <p>No readable signs were returned. No wellness index is calculated for this recording.</p>}</> : failure ? <p>{failure.body}</p> : <p role="status">This call is linked to your account. Your dashboard retrieves the result when you return, even if you close this page.</p>}
      {saveError && <div className="member-message" role="alert"><p>{saveError}</p><button onClick={() => saveFinal(session.sessionId)} disabled={saving}>{saving ? "Saving…" : "Retry history sync"}</button></div>}
      <Link to="/dashboard" className="member-button member-primary">{saving ? "Syncing history…" : "View my dashboard"}<ArrowUpRight size={16} /></Link>
      {(complete || failure) && <button disabled={saving} onClick={() => { setSession(null); setError(""); setSaveError(""); setConsent(false); }}>Start another check-in</button>}
    </>}
  </main></MemberShell>;
}
