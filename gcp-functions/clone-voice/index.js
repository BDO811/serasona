// Personal calling voices use Minimax through Telnyx, matching BDO811/myabuela.
// Library voice selection and existing personal clones remain account scoped.
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const TELNYX_API = "https://api.telnyx.com/v2";

// 14MB base64 is roughly a 3.5 minute WAV at 48kHz mono — generous headroom
// over the 1-3 minute sweet spot voice cloning generally wants, regardless of
// provider.
const MAX_BASE64_LENGTH = 14_000_000;

// Stays inside the deployed 150s timeout while giving a slow clone room to finish rather than
// bailing into "pending" on every request.
const POLL_INTERVAL_MS = 5000;
const POLL_MAX_ATTEMPTS = 16;

async function pollUntilActive(apiKey, cloneId) {
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const res = await fetch(`${TELNYX_API}/voice_clones`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) continue;
    const json = await res.json();
    const match = (json.data || []).find((c) => c.id === cloneId);
    if (match && match.status !== "pending") return match;
  }
  return null; // still pending after the full poll window
}

const PLAN_RANK = { free: 0, core: 1, plus: 2, executive: 3 };

function getCorsOrigin(requestOrigin) {
  const fallback = "https://serasona.com";
  if (!requestOrigin) return fallback;
  if (requestOrigin === "https://serasona.com" || requestOrigin === "https://www.serasona.com") return requestOrigin;
  if (requestOrigin === "https://tryserasona.com" || requestOrigin === "https://www.tryserasona.com") return requestOrigin;
  if (requestOrigin === "https://bdo811.github.io") return requestOrigin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(requestOrigin)) return requestOrigin;
  return fallback;
}

function setCorsHeaders(req, res) {
  res.set("Access-Control-Allow-Origin", getCorsOrigin(req.headers.origin));
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

// Voice cloning only matters to someone who can actually use the phone
// check-in it personalizes, so it is gated the same way: Plus and above. A
// Core/Free user hitting this directly (the UI already hides the entry point)
// gets the same plain rejection rather than a cloned voice they can't use.
function isEntitledToClone(subscription) {
  if (!subscription) return false;
  const activeStatuses = ["active", "trialing"];
  return activeStatuses.includes(subscription.status) && (PLAN_RANK[subscription.planId] ?? 0) >= PLAN_RANK.plus;
}

/** Validate actual PCM audio, not a browser timer or supplied MIME label. */
function validateVoiceSample(base64) {
  const fail = (message) => { throw new Error(message); };
  if (base64.length % 4 || /[^A-Za-z0-9+/=]/.test(base64)) fail("Upload a valid WAV recording.");
  const wav = Buffer.from(base64, "base64");
  if (wav.toString("base64") !== base64 || wav.length < 44 || wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") fail("Upload a valid WAV recording.");
  let channels = 0, rate = 0, bits = 0, format = 0, audio;
  for (let offset = 12; offset + 8 <= wav.length;) {
    const size = wav.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > wav.length) fail("The recording is incomplete. Please record again.");
    const name = wav.toString("ascii", offset, offset + 4);
    if (name === "fmt " && size >= 16) { format = wav.readUInt16LE(start); channels = wav.readUInt16LE(start + 2); rate = wav.readUInt32LE(start + 4); bits = wav.readUInt16LE(start + 14); }
    if (name === "data") audio = wav.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (format !== 1 || bits !== 16 || channels !== 1 || rate !== 24000 || !audio || audio.length % 2) fail("Use the voice recorder to create a mono WAV sample.");
  const duration = audio.length / (rate * 2);
  if (duration < 60 || duration > 183) fail("Record at least 1 minute and no more than 3 minutes.");
  let audible = 0, clipped = 0;
  for (let start = 0; start < audio.length; start += 4800) {
    const end = Math.min(start + 4800, audio.length); let energy = 0;
    for (let i = start; i < end; i += 2) { const value = audio.readInt16LE(i) / 32768; energy += value * value; if (Math.abs(value) >= .99) clipped++; }
    if (Math.sqrt(energy / ((end - start) / 2)) > .003) audible += (end - start) / (rate * 2);
  }
  if (audible < 35) fail("Too little audible speech. Please read the passage again closer to the microphone.");
  if (clipped / (audio.length / 2) > .01) fail("The recording is distorted. Move farther from the microphone and record again.");
}

exports.cloneVoice = async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Not signed in." });
    const decoded = await admin.auth().verifyIdToken(idToken);

    const userRef = admin.firestore().collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!isEntitledToClone(userSnap.data()?.subscription)) return res.status(403).json({ error: "Calling voices require an active Plus or Executive plan." });
    const cloneRef = admin.firestore().collection("voiceClones").doc(decoded.uid);
    if (req.body?.action === "refreshVoice") {
      const current = (await cloneRef.get()).data();
      if (current?.status !== "pending" || !current?.telnyxCloneId) return res.status(200).json({ status: current?.status || "none" });
      const apiKey = process.env.TELNYX_API_KEY;
      if (!apiKey) return res.status(503).json({ error: "Voice processing status is temporarily unavailable." });
      const response = await fetch(`${TELNYX_API}/voice_clones`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) return res.status(502).json({ error: "Voice processing status could not be checked. Try again shortly." });
      const match = ((await response.json()).data || []).find((item) => item.id === current.telnyxCloneId);
      if (!match || match.status === "pending") return res.status(200).json({ status: "pending" });
      const id = match.provider && match.model_id && match.provider_voice_id ? `${match.provider}.${match.model_id}.${match.provider_voice_id}` : null;
      const status = match.status === "active" && id ? "ready" : "failed";
      await cloneRef.set({ status, providerVoiceId: id }, { merge: true });
      return res.status(200).json({ status });
    }
    if (req.body?.action === "selectVoice") {
      const selection = req.body.selection;
      if (!["female", "male", "own"].includes(selection)) return res.status(400).json({ error: "Choose female, male or your own recorded voice." });
      if (selection === "own") {
        const existing = await cloneRef.get();
        if (existing.data()?.status !== "ready" || !existing.data()?.providerVoiceId) return res.status(409).json({ error: "Record your voice and wait until it is ready before selecting it." });
      }
      await cloneRef.set({ selection, selectionUpdatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      return res.status(200).json({ selection });
    }
    const { audioBase64, gender, consent } = req.body ?? {};
    if (consent !== true) return res.status(400).json({ error: "Consent is required to create your synthetic voice." });
    if (typeof audioBase64 !== "string" || !audioBase64) return res.status(400).json({ error: "audioBase64 is required." });
    if (audioBase64.length > MAX_BASE64_LENGTH) return res.status(400).json({ error: "Recording is too long. Keep it under a few minutes." });
    if (gender !== "female" && gender !== "male") return res.status(400).json({ error: "Choose the voice type for your recording." });
    const displayName = userSnap.data()?.fullName || "Serasona member";

    const apiKey = process.env.TELNYX_API_KEY;
    if (!apiKey) {
      console.error("[clone-voice] TELNYX_API_KEY is not set");
      return res.status(500).json({ error: "Voice cloning isn't configured yet." });
    }

    try { validateVoiceSample(audioBase64); } catch (error) { return res.status(400).json({ error: error.message }); }
    const sampleBlob = new Blob([Buffer.from(audioBase64, "base64")], { type: "audio/wav" });
    const form = new FormData();
    form.append("audio_file", sampleBlob, "sample.wav");
    form.append("name", `serasona-${decoded.uid}`);
    form.append("language", "en");
    form.append("gender", gender);
    form.append("provider", "minimax");

    const telnyxRes = await fetch(`${TELNYX_API}/voice_clones/from_upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!telnyxRes.ok) {
      const detail = await telnyxRes.text();
      console.error(`[clone-voice] Telnyx /v2/voice_clones/from_upload returned ${telnyxRes.status}: ${detail}`);
      await cloneRef.set(
        {
          displayName,
          provider: "telnyx",
          providerVoiceId: null,
          status: "failed",
          consentGivenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.status(502).json({ error: "Couldn't create that voice. Try again in a moment." });
    }

    // Minimax normally returns active synchronously. Retain bounded polling for pending responses.
    let clone = (await telnyxRes.json()).data ?? {};
    if (clone.status === "pending") {
      const polled = await pollUntilActive(apiKey, clone.id);
      if (polled) clone = polled;
    }

    const { provider, model_id, provider_voice_id, status } = clone;
    const providerVoiceId =
      provider && model_id && provider_voice_id ? `${provider}.${model_id}.${provider_voice_id}` : null;
    const localStatus = !providerVoiceId ? "failed" : status === "active" ? "ready" : status === "pending" ? "pending" : "failed";

    await cloneRef.set(
      {
        displayName,
        provider: provider ? provider.toLowerCase() : "telnyx",
        providerVoiceId,
        telnyxCloneId: clone.id || null,
        status: localStatus,
        ...(localStatus === "ready" ? { selection: "own" } : {}),
        consentGivenAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    res.status(200).json({ status: localStatus, providerVoiceId });
  } catch (error) {
    console.error("[clone-voice] Error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};
