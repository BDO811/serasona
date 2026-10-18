import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { asset } from "@/lib/asset";
import { subscribeVoiceClone, selectCallingVoice, refreshCallingVoice, type CallingVoice, type VoiceCloneDoc } from "@/lib/voice-clone-client";
import "./calling-voice.css";

export function CallingVoiceSettings() {
  const { user, isEntitled } = useAuth();
  const [voice, setVoice] = useState<VoiceCloneDoc | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<CallingVoice | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const samples = useRef<Array<HTMLAudioElement | null>>([]);
  const allowed = isEntitled("plus");
  useEffect(() => {
    setVoice(null); setLoading(true); setLoadFailed(false); setError("");
    if (!user) { setLoading(false); return; }
    return subscribeVoiceClone(user.uid, (doc) => { setVoice(doc); setLoadFailed(false); setLoading(false); }, () => { setLoadFailed(true); setError("Your calling voice could not be loaded. Reload this page to retry."); setLoading(false); });
  }, [user?.uid]);
  useEffect(() => () => samples.current.forEach((audio) => audio?.pause()), []);
  const active = voice?.selection || (voice?.status === "ready" ? "own" : "female");
  async function choose(selection: CallingVoice) {
    setSaving(selection); setError(""); setMessage("");
    try { await selectCallingVoice(selection); setVoice((previous) => ({ ...previous, selection } as VoiceCloneDoc)); setMessage("Calling voice saved. Your next phone check-in will use this voice."); }
    catch (err) { setError(err instanceof Error ? err.message : "Your voice choice could not be saved."); }
    finally { setSaving(null); }
  }
  return <section id="calling-voice" className="calling-voice-panel" aria-labelledby="calling-voice-title"><div className="member-section-heading"><div><h2 id="calling-voice-title">Choose your calling voice</h2><p className="member-note">Hear the female and male voices, or record your own voice for your phone check-ins.</p></div></div>
    {!allowed && <p className="member-note">An active Plus or Executive plan is required to use calling voices. <Link to="/account#subscription">View your plan options</Link></p>}
    {loading && <p role="status">Loading your voice preference…</p>}
    <div className="calling-voice-grid">{(["female", "male"] as const).map((type, i) => <article key={type} className={`calling-voice-card ${!loading && !loadFailed && active === type ? "calling-voice-selected" : ""}`}><h3>{type === "female" ? "Female voice" : "Male voice"}</h3><p>A warm, natural voice for your calls.</p><audio aria-label={`Preview ${type} voice`} controls preload="none" src={asset(`voices/${type}_35_greeting.mp3`)} ref={(node) => { samples.current[i] = node; }} onPlay={() => samples.current.forEach((audio, n) => { if (n !== i) audio?.pause(); })} /><button disabled={!allowed || loading || Boolean(saving) || loadFailed} onClick={() => choose(type)} aria-pressed={!loading && !loadFailed && active === type}>{saving === type ? "Saving…" : active === type && !loading ? <><Check size={16} />Selected</> : `Use ${type} voice`}</button></article>)}
    <article className={`calling-voice-card calling-voice-own ${!loading && !loadFailed && active === "own" ? "calling-voice-selected" : ""}`}><Mic size={24} /><h3>Your own voice</h3><p>Record, listen back, and consent to create a personal calling voice.</p>{voice?.status === "pending" && <><p role="status">Your recording is processing.</p><button disabled={Boolean(saving)} onClick={async () => { setSaving("own"); setError(""); try { await refreshCallingVoice(); setMessage("Voice status checked. Your saved recording will appear when processing finishes."); } catch (err) { setError(err instanceof Error ? err.message : "Try again shortly."); } finally { setSaving(null); } }}>Check voice status</button></>}{voice?.status === "failed" && <p>That recording could not be processed. Record another sample.</p>}{voice?.status === "ready" && <button disabled={!allowed || loading || Boolean(saving)} aria-pressed={active === "own"} onClick={() => choose("own")}>{saving === "own" ? "Saving…" : active === "own" ? "Your voice is selected" : "Use my recorded voice"}</button>}<Link className="member-button" to={allowed ? "/voice" : "/account#subscription"}>{voice?.status === "ready" ? "Record a new sample" : "Record your own voice"}</Link></article></div>
    {error && <p role="alert" className="member-message">{error}</p>}{message && <p role="status" className="member-save-message">{message}</p>}
  </section>;
}
