// Clones a user's recorded voice sample into a reusable Telnyx voice id, so
// the phone check-in (voice-call-harness) can call them back in a voice they
// chose instead of the stock ElevenLabs/Polly default.
//
// Telnyx's native Voice Design Lab (POST /v2/voice_clones/from_upload), same
// account as everything else here, rather than a separate ElevenLabs
// integration — one API key, no per-provider BYOK key to manage, and the
// resulting voice id format (`{Provider}.{Model}.{provider_voice_id}`) drops
// straight into the same `<Say voice="...">` the harness already uses.
//
// provider=telnyx, model_id=Ultra specifically — Telnyx's own quickstart docs
// call this out as "the higher-quality Ultra model" versus the default
// (Qwen3TTS) or Minimax options, and Ultra's provider_voice_id is a
// Cartesia-assigned id (confirmed against
// developers.telnyx.com/docs/voice/voice-design-lab/clone-voice/responses) —
// Cartesia is a dedicated voice-cloning model, not a general TTS engine with
// cloning bolted on, which is the actual lever for sounding like the real
// person rather than a good-but-generic voice. The tradeoff: Ultra clones
// are created async (202 Accepted, status "pending"), unlike Minimax's
// synchronous "active" — hence pollUntilActive below. Confirmed empirically
// 2026-10-17: a clone went pending -> active in 30-40s.
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const TELNYX_API = "https://api.telnyx.com/v2";

// 14MB base64 is roughly a 3.5 minute WAV at 48kHz mono — generous headroom
// over the 1-3 minute sweet spot voice cloning generally wants, regardless of
// provider.
const MAX_BASE64_LENGTH = 14_000_000;

// Stays comfortably inside the function's 120s timeout (deployed with
// --timeout=120s) while giving a slow clone room to finish rather than
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

exports.cloneVoice = async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  try {
    const authHeader = req.headers.authorization || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!idToken) return res.status(401).json({ error: "Not signed in." });
    const decoded = await admin.auth().verifyIdToken(idToken);

    const { audioBase64, gender } = req.body ?? {};
    if (typeof audioBase64 !== "string" || !audioBase64) {
      return res.status(400).json({ error: "audioBase64 is required." });
    }
    if (audioBase64.length > MAX_BASE64_LENGTH) {
      return res.status(400).json({ error: "Recording is too long — keep it under a few minutes." });
    }
    if (gender !== "female" && gender !== "male") {
      return res.status(400).json({ error: 'gender must be "female" or "male".' });
    }

    const userRef = admin.firestore().collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    if (!isEntitledToClone(userSnap.data()?.subscription)) {
      return res.status(403).json({ error: "Choosing a calling voice is a Plus feature. Upgrade to turn it on." });
    }

    const cloneRef = admin.firestore().collection("voiceClones").doc(decoded.uid);
    const displayName = userSnap.data()?.fullName || "Serasona member";

    const apiKey = process.env.TELNYX_API_KEY;
    if (!apiKey) {
      console.error("[clone-voice] TELNYX_API_KEY is not set");
      return res.status(500).json({ error: "Voice cloning isn't configured yet." });
    }

    const sampleBlob = new Blob([Buffer.from(audioBase64, "base64")], { type: "audio/wav" });
    const form = new FormData();
    form.append("audio_file", sampleBlob, "sample.wav");
    form.append("name", `serasona-${decoded.uid}`);
    form.append("language", "en");
    form.append("gender", gender);
    form.append("provider", "telnyx");
    form.append("model_id", "Ultra");

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

    // Ultra clones come back 202/"pending" — poll until Cartesia finishes
    // processing (confirmed empirically: 30-40s) rather than handing the
    // client a "pending" doc for a clone that would have been ready in under
    // a minute anyway.
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
        status: localStatus,
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
