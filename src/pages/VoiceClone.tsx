import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import "@/components/member/calling-voice.css";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { convertRecordingToWav, blobToBase64, pickSupportedRecordingMimeType } from "@/lib/voice-sample-audio";
import { cloneVoice, subscribeVoiceClone, type VoiceCloneDoc } from "@/lib/voice-clone-client";

/**
 * "Use your own voice as the calling agent" — Plus and above, the same tier
 * that buys the phone check-in this personalizes. Record a sample, consent,
 * and Serasona calls back in that voice instead of the stock default.
 *
 * Mirrors the shape of MyAbuela's family/voice page: record -> review ->
 * gender -> consent -> submit -> poll the resulting doc for ready/failed.
 */

const MIN_SECONDS = 60;
const MAX_SECONDS = 180;

const READING_PASSAGE = [
  "Hello! It is so nice to have a little time to talk with you today. I hope you are feeling comfortable and that your morning has started well. I have been thinking about the small things that make an ordinary day feel special: a warm cup of coffee, sunlight through the window, and hearing a familiar voice.",
  "This morning I opened the curtains and watched a few birds hopping along the fence. One of them picked up a tiny twig, dropped it, and tried again. It made me smile. After breakfast, I went outside for a short walk. The air was fresh, the street was quiet, and someone nearby was baking bread. It reminded me of being in the kitchen with family, sharing stories while something delicious was cooking.",
  "What sounds good to you today? Maybe listening to some music, looking through a photo album, or sitting in your favorite chair for a while. There is no need to rush. Take a slow breath and enjoy a little rest. I would love to hear about something that made you happy, whether it happened yesterday or many years ago.",
  "I am glad we can share these moments. Please take care of yourself, keep some water nearby, and remember that you matter to the people who love you. I hope the rest of your day brings you something pleasant to look forward to. We will talk again soon.",
];

type Phase = "idle" | "requesting" | "recording" | "processing" | "review" | "submitting" | "done" | "error";

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const VoiceClone = () => {
  const { user, isEntitled } = useAuth();
  const navigate = useNavigate();
  const entitled = isEntitled("plus");

  const [existingClone, setExistingClone] = useState<VoiceCloneDoc | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [gender, setGender] = useState<"female" | "male" | "">("");
  const [consented, setConsented] = useState(false);

  const mountedRef = useRef(true);
  const startedAtRef = useRef(0);
  const previewRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wavBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeVoiceClone(user.uid, setExistingClone);
  }, [user]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (recorderRef.current) recorderRef.current.onstop = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  const startRecording = useCallback(async () => {
    setError(null);
    const mimeType = pickSupportedRecordingMimeType();
    if (!mimeType) { setError("Recording is not supported in this browser. Try Chrome or Safari."); setPhase("error"); return; }
    setPhase("requesting");
    try {
      // Same constraints as the check-in capture (QuestionFlowVisualizer):
      // mono, echo cancellation and noise suppression on — a cleaner sample
      // for the clone than a raw unprocessed one.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true },
      });
      if (!mountedRef.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStopped;
      recorderRef.current = recorder;
      startedAtRef.current = performance.now();
      recorder.start();

      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((performance.now() - startedAtRef.current) / 1000);
        setElapsed(Math.min(seconds, MAX_SECONDS));
        if (seconds >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch {
      setPhase("error");
      setError("Couldn't access the microphone, check your browser's permission for this site.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopRecording() {
    clearTimer();
    if (recorderRef.current?.state !== "recording") return;
    setPhase("processing");
    recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function handleStopped() {
    try {
      const mimeType = recorderRef.current?.mimeType || "audio/webm";
      const rawBlob = new Blob(chunksRef.current, { type: mimeType });
      const wavBlob = await convertRecordingToWav(rawBlob, { voiceClone: true });
      if (!mountedRef.current) return;
      wavBlobRef.current = wavBlob;
      const url = URL.createObjectURL(wavBlob);
      previewRef.current = url;
      setPreviewUrl(url);
      setPhase("review");
    } catch {
      setPhase("error");
      setError("Couldn't process that recording. Try again.");
    }
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    previewRef.current = null;
    setConsented(false);
    setElapsed(0);
    wavBlobRef.current = null;
    setPhase("idle");
  }

  async function handleSubmit() {
    if (!wavBlobRef.current || !gender || !consented) return;
    setPhase("submitting");
    setError(null);
    try {
      const audioBase64 = await blobToBase64(wavBlobRef.current);
      const result = await cloneVoice(audioBase64, gender);
      if (result.status === "failed") throw new Error("Your voice could not be created. Please record again.");
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Something went wrong creating that voice.");
    }
  }

  if (!entitled) return <Navigate to="/pricing" replace />;

  return (
    <div className="min-h-screen bg-background px-6 py-16">
      <div className="max-w-md mx-auto space-y-8">
        <div>
          <p className="text-xs font-mono uppercase tracking-wider text-primary">Plus</p>
          <h1 className="font-serif text-3xl text-foreground">Choose your calling voice</h1>
          <p className="text-muted-foreground mt-2 leading-relaxed">
            Record about a minute or two of yourself talking naturally. Serasona will call your
            phone check-ins back in that voice instead of the default, with your consent, until you
            change it.
          </p>
        </div>

        {existingClone && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-1">
            <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
              Your recorded voice
            </p>
            <p className="text-foreground">
              {existingClone.status === "ready"
                ? existingClone.selection && existingClone.selection !== "own" ? "Your recorded voice is ready. Select it in your account to use it." : "Your own voice is active."
                : existingClone.status === "pending"
                  ? "Still processing…"
                  : "The last recording failed, record another below."}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {(phase === "idle" || phase === "requesting") && (
          <Button className="w-full" onClick={startRecording} disabled={phase === "requesting"}>
            {phase === "requesting" ? "Asking for microphone access…" : "Start recording"}
          </Button>
        )}

        {phase === "recording" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
            <span className="font-mono text-sm text-foreground">{formatElapsed(elapsed)}</span>
            <Button variant="outline" onClick={stopRecording} disabled={elapsed < MIN_SECONDS}>
              {elapsed < MIN_SECONDS ? `Keep talking (${MIN_SECONDS - elapsed}s)` : "Stop recording"}
            </Button>
          </div>
        )}

        {phase === "processing" && <p role="status">Preparing your recording…</p>}
        {["idle", "requesting", "recording"].includes(phase) && <section className="voice-reading-passage"><h2>Read this aloud</h2><p>Read naturally for at least one minute. You can stop when you finish the passage. Recording ends automatically after three minutes.</p>{READING_PASSAGE.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</section>}
        {(phase === "review" || phase === "submitting") && previewUrl && (
          <div className="space-y-5">
            <audio controls src={previewUrl} className="w-full" />

            <div className="space-y-3">
              <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Your voice</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`rounded-2xl border p-3 text-sm transition ${
                    gender === "female" ? "border-primary bg-card" : "border-border bg-card/50"
                  }`}
                >
                  Female
                </button>
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`rounded-2xl border p-3 text-sm transition ${
                    gender === "male" ? "border-primary bg-card" : "border-border bg-card/50"
                  }`}
                >
                  Male
                </button>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={consented}
                onChange={(e) => setConsented(e.target.checked)}
                className="mt-1"
              />
              <span>
                I consent to Serasona using this recording to create a synthetic version of my
                voice, used only for my own phone check-ins.
              </span>
            </label>

            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={phase === "submitting" || !gender || !consented}
              >
                {phase === "submitting" ? "Creating your voice…" : "Use this recording"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={reRecord} disabled={phase === "submitting"}>
                Re-record
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="space-y-4">
            <p className="text-foreground">
              {existingClone?.status === "ready"
                ? "Your voice is ready. Your next phone check-in will call back in it."
                : "Your voice is still processing, check back shortly."}
            </p>
            <Button className="w-full" onClick={() => navigate("/account")}>
              Back to account
            </Button>
          </div>
        )}

        {phase === "error" && (
          <Button variant="outline" className="w-full" onClick={reRecord}>
            Try again
          </Button>
        )}

        <Button variant="ghost" className="w-full" onClick={() => navigate("/account")}>
          Back to account
        </Button>
      </div>
    </div>
  );
};

export default VoiceClone;
