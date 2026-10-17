// Clones a user's recorded voice sample into a reusable Telnyx voice id, so
// the phone check-in (voice-call-harness) can call them back in a voice they
// chose instead of the stock ElevenLabs/Polly default.
//
// Same provider MyAbuela already ships with (Telnyx's native Voice Design Lab,
// Minimax provider via POST /v2/voice_clones/from_upload) rather than a
// separate ElevenLabs integration — one Telnyx account, one API key, no
// per-provider BYOK key to manage, and the resulting voice id format
// (`{Provider}.{Model}.{provider_voice_id}`) drops straight into the same
// `<Say voice="...">` the harness already uses for its default voice.
// Confirmed against developers.telnyx.com/docs/voice/voice-design-lab/
// clone-voice/{quickstart,responses}.

const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

const TELNYX_API = "https://api.telnyx.com/v2";

// Minimax's own floor is ~10s ("Audio is too short"); this just bounds the
// request body. 14MB base64 is roughly a 3.5 minute WAV at 48kHz mono, well
// above Minimax's 1-2 minute sweet spot — matches MyAbuela's own ceiling for
// the same reason (recordWebCheckIn.ts / cloneFamilyVoice.ts).
const MAX_BASE64_LENGTH = 14_000_000;

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
          provider: "minimax",
          providerVoiceId: null,
          status: "failed",
          consentGivenAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      return res.status(502).json({ error: "Couldn't create that voice. Try again in a moment." });
    }

    const json = await telnyxRes.json();
    const { provider, model_id, provider_voice_id, status } = json.data ?? {};
    const providerVoiceId =
      provider && model_id && provider_voice_id ? `${provider}.${model_id}.${provider_voice_id}` : null;
    // Minimax clones are synchronous ("active" on creation); map defensively
    // in case Telnyx ever returns "pending"/"expired" for this provider too —
    // same mapping MyAbuela's voiceClone.ts uses.
    const localStatus = !providerVoiceId ? "failed" : status === "active" ? "ready" : status === "pending" ? "pending" : "failed";

    await cloneRef.set(
      {
        displayName,
        provider: "minimax",
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
