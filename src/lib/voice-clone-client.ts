/**
 * Clone a recorded voice sample into a reusable Telnyx voice id, so the phone
 * check-in calls back in a voice the member chose rather than the stock
 * default. Backend: gcp-functions/clone-voice (Telnyx's native Voice Design
 * Lab, Minimax provider, same account the voice-call-harness already
 * dials through — see that function's own header comment for why).
 */

import { auth, db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

const CLONE_VOICE_URL = import.meta.env.VITE_CLONE_VOICE_URL as string | undefined;

export const VOICE_CLONE_NOT_READY = "Choosing a calling voice isn't open yet. Check back shortly.";

export type CallingVoice = "female" | "male" | "own";

export type VoiceCloneStatus = "pending" | "ready" | "failed";

export interface VoiceCloneDoc {
  selection?: CallingVoice;
  displayName: string;
  provider: string;
  providerVoiceId: string | null;
  status: VoiceCloneStatus;
}

export interface CloneVoiceResult {
  status: VoiceCloneStatus;
  providerVoiceId: string | null;
}

export async function cloneVoice(audioBase64: string, gender: "female" | "male"): Promise<CloneVoiceResult> {
  if (!CLONE_VOICE_URL) throw new Error(VOICE_CLONE_NOT_READY);
  const user = auth?.currentUser;
  if (!user) throw new Error("Not signed in.");
  const idToken = await user.getIdToken();

  const response = await fetch(CLONE_VOICE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ audioBase64, gender, consent: true }),
  });

  if (!response.ok) {
    // Same reasoning as billing-client.ts: an undeployed function answers 404
    // with an HTML body, which throws a confusing SyntaxError if parsed as JSON.
    if (response.status === 404) throw new Error(VOICE_CLONE_NOT_READY);
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || "Couldn't create that voice. Try again in a moment.");
  }
  return response.json();
}

/** Live status of the signed-in user's own clone, if any — drives the voice
 * page's pending/ready/failed display and (once ready) the phone check-in's
 * choice of voice. Firestore rules (voiceClones/{userId}) only allow a user
 * to read their own doc; the clone-voice function is the only writer. */
export function subscribeVoiceClone(uid: string, onChange: (clone: VoiceCloneDoc | null) => void, onError?: (error: Error) => void) {
  if (!db) {
    onChange(null);
    return () => {};
  }
  return onSnapshot(doc(db, "voiceClones", uid), (snap) => {
    onChange(snap.exists() ? (snap.data() as VoiceCloneDoc) : null);
  }, onError);
}

/** Saved by the authenticated backend; provider voice IDs are never accepted from the browser. */
export async function selectCallingVoice(selection: CallingVoice): Promise<void> {
  if (!CLONE_VOICE_URL) throw new Error(VOICE_CLONE_NOT_READY);
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in to choose your calling voice.");
  const token = await user.getIdToken();
  const response = await fetch(CLONE_VOICE_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "selectVoice", selection }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || "Your voice choice could not be saved."); }
}

export async function refreshCallingVoice(): Promise<void> {
  if (!CLONE_VOICE_URL || !auth?.currentUser) throw new Error("Sign in to check your voice status.");
  const token = await auth.currentUser.getIdToken();
  const response = await fetch(CLONE_VOICE_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: "refreshVoice" }) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || "Voice status could not be checked."); }
}
