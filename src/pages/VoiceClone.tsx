import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { convertToWav, blobToBase64 } from "@/lib/audio-utils";
import { cloneVoice, subscribeVoiceClone, type VoiceCloneDoc } from "@/lib/voice-clone-client";

/**
 * "Use your own voice as the calling agent" — Plus and above, the same tier
 * that buys the phone check-in this personalizes. Record a sample, consent,
 * and Serasona calls back in that voice instead of the stock default.
 *
 * Mirrors the shape of MyAbuela's family/voice page: record -> review ->
 * gender -> consent -> submit -> poll the resulting doc for ready/failed.
 */

const MIN_SECONDS = 15;
const MAX_SECONDS = 180;

type Phase = "idle" | "requesting" | "recording" | "review" | "submitting" | "done" | "error";

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
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function clearTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  }

  const startRecording = useCallback(async () => {
    setError(null);
    setPhase("requesting");
    try {
      // Same constraints as the check-in capture (QuestionFlowVisualizer):
      // mono, echo cancellation and noise suppression on — a cleaner sample
      // for the clone than a raw unprocessed one.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: { ideal: 1 }, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = handleStopped;
      recorderRef.current = recorder;
      recorder.start();

      setElapsed(0);
      setPhase("recording");
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_SECONDS) stopRecording();
          return next;
        });
      }, 1000);
    } catch {
      setPhase("error");
      setError("Couldn't access the microphone, check your browser's permission for this site.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopRecording() {
    clearTimer();
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function handleStopped() {
    try {
      const mimeType = recorderRef.current?.mimeType || "audio/webm";
      const rawBlob = new Blob(chunksRef.current, { type: mimeType });
      const wavBlob = await convertToWav(rawBlob);
      wavBlobRef.current = wavBlob;
      setPreviewUrl(URL.createObjectURL(wavBlob));
      setPhase("review");
    } catch {
      setPhase("error");
      setError("Couldn't process that recording. Try again.");
    }
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    wavBlobRef.current = null;
    setPhase("idle");
  }

  async function handleSubmit() {
    if (!wavBlobRef.current || !gender || !consented) return;
    setPhase("submitting");
    setError(null);
    try {
      const audioBase64 = await blobToBase64(wavBlobRef.current);
      await cloneVoice(audioBase64, gender);
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
              Current calling voice
            </p>
            <p className="text-foreground">
              {existingClone.status === "ready"
                ? "Your own voice is active."
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
