const crypto = require("crypto");
const { Firestore, FieldValue } = require("@google-cloud/firestore");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

/**
 * Per-user voice session history.
 *
 * POST  { email, model, pathway, capturedAt, signals[], summary }  -> saves one session
 * GET   ?email=...                                                 -> that user's sessions
 *
 * Runs as a function rather than letting the browser talk to Firestore directly
 * so the collection needs no public read/write rule and no API key ships in the
 * client bundle.
 *
 * Two identity modes, chosen per request:
 *
 *   Signed in  (Authorization: Bearer <Firebase ID token>) -> keyed on
 *     "uid:<firebase uid>". The verified token is the only thing trusted; any
 *     email in the body is ignored for identity purposes. This is the path a
 *     Serasona account (see src/context/AuthContext.tsx) uses.
 *
 *   Anonymous  (no Authorization header) -> keyed on a SHA-256 of the
 *     normalized email, exactly as before. This is the original try-it demo
 *     flow (no account, no entitlement check) and is left completely
 *     unchanged so the public anonymous funnel keeps working. The plaintext
 *     address is deliberately NOT stored in this mode: lookup only ever needs
 *     the hash, which keeps a database of health readings from doubling as a
 *     mailing list.
 *
 * The anonymous mode's own limitation stands as before: anyone who knows an
 * email can read that email's history. That is acceptable for a demo and is
 * why the signed-in mode exists for anything that should actually be private.
 */

const COLLECTION = "voiceSessions";
const MAX_SESSIONS_RETURNED = 200;
const MAX_SIGNALS_PER_SESSION = 64;
const MAX_BODY_BYTES = 64 * 1024;

/**
 * How many check-ins an account with no paid plan may record per rolling day,
 * and how far back its history reaches. Pricing sells the free tier as "three
 * check-ins a day, a week of your own trend" — enough to feel the habit and
 * see a real trend line, not enough to replace Core's full history.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const FREE_CHECKIN_DAILY_LIMIT = 3;
const FREE_HISTORY_WINDOW_MS = 7 * DAY_MS;

/** Plans ranked the way a subscriber would upgrade. Mirrors src/context/AuthContext.tsx. */
const PLAN_RANK = { free: 0, core: 1, plus: 2, executive: 3 };
const ACTIVE_STATUSES = new Set(["active", "trialing"]);

const firestore = new Firestore();

/**
 * Whether this account may store an unlimited number of check-ins.
 *
 * Read from the user document, never from the request. The client already
 * checks this to decide what to render, but a UI check is a courtesy: anyone
 * can call this endpoint directly with a valid token and no browser involved.
 * This is the copy that actually costs money if it is wrong, because every
 * stored session is a model call that was already paid for.
 *
 * `subscription` on that document is written only by the stripe-webhook
 * function via the Admin SDK — the Firestore rules forbid the client from
 * touching it — so it is safe to trust here.
 */
async function hasUnlimitedCheckins(uid) {
  const snap = await firestore.collection("users").doc(uid).get();
  const subscription = snap.exists ? snap.data().subscription : null;
  if (!subscription) return false;
  if (!ACTIVE_STATUSES.has(subscription.status)) return false;
  if (subscription.provider === "apple" &&
      (!Number.isFinite(subscription.currentPeriodEnd) || subscription.currentPeriodEnd * 1000 <= Date.now())) return false;
  return (PLAN_RANK[subscription.planId] ?? 0) >= PLAN_RANK.core;
}

/**
 * How many of this user's sessions were captured in the last rolling day.
 *
 * Equality filter only, same reason as handleFetch below: a second range
 * filter on capturedAt would need a composite index. A free account has at
 * most a handful of sessions, so filtering the small result set in memory
 * costs nothing extra.
 */
async function countSessionsToday(userKey) {
  const snapshot = await firestore
    .collection(COLLECTION)
    .where("userKey", "==", userKey)
    .limit(100)
    .get();
  const cutoff = Date.now() - DAY_MS;
  return snapshot.docs.filter((doc) => (doc.data().capturedAt ?? 0) >= cutoff).length;
}

function getCorsOrigin(requestOrigin) {
  const fallback = "https://try.amplifierhealth.com";
  if (!requestOrigin) return fallback;
  if (requestOrigin.endsWith(".amplifierhealth.com") && requestOrigin.startsWith("https://")) return requestOrigin;
  if (requestOrigin.endsWith(".lovable.app") && requestOrigin.startsWith("https://")) return requestOrigin;
  if (requestOrigin === "https://tryswara.com" || requestOrigin === "https://www.tryswara.com") return requestOrigin;
  if (requestOrigin === "https://serasona.com" || requestOrigin === "https://www.serasona.com") return requestOrigin;
  // tryserasona.com now redirects here, but a redirected request still
  // preflights with its original origin, so it stays allowed.
  if (requestOrigin === "https://tryserasona.com" || requestOrigin === "https://www.tryserasona.com") return requestOrigin;
  if (requestOrigin === "https://bdo811.github.io") return requestOrigin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(requestOrigin)) return requestOrigin;
  return fallback;
}

function setCorsHeaders(req, res) {
  res.set("Access-Control-Allow-Origin", getCorsOrigin(req.headers.origin));
  res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/** Lowercase and trim, so "Amit@X.com " and "amit@x.com" are the same user. */
function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  // Deliberately permissive: this gates obvious junk, it is not validation.
  if (email.length < 5 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return null;
  }
  return email;
}

function userKeyForEmail(email) {
  return crypto.createHash("sha256").update(email).digest("hex");
}

/**
 * Figures out whose history this request is touching. A present, valid
 * Authorization header always wins — an authenticated caller cannot be
 * downgraded to the anonymous email path by also sending an email field.
 * Returns null when neither a valid token nor a valid email was supplied.
 */
async function resolveIdentity(req, emailValue) {
  const authHeader = req.headers.authorization || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (idToken) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken, true);
      return { userKey: `uid:${decoded.uid}`, mode: "account" };
    } catch (error) {
      console.warn("[voice-history] ID token verification failed:", error.message);
      return null;
    }
  }

  const email = normalizeEmail(emailValue);
  if (!email) return null;
  return { userKey: userKeyForEmail(email), mode: "anonymous" };
}

/** Clamp a model score into 0-1, rejecting anything non-numeric. */
function cleanScore(value) {
  const score = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(score)) return null;
  return Math.min(Math.max(score, 0), 1);
}

function cleanString(value, maxLength) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

/**
 * Keep only the fields the longitudinal view actually reads. Whatever else the
 * client sends is dropped rather than persisted, so the shape of the stored
 * document does not drift with the shape of the API response.
 */
function cleanSignals(raw) {
  if (!Array.isArray(raw)) return [];
  const signals = [];
  for (const entry of raw.slice(0, MAX_SIGNALS_PER_SESSION)) {
    if (!entry || typeof entry !== "object") continue;
    const name = cleanString(entry.name, 64);
    const score = cleanScore(entry.score);
    if (!name || score === null) continue;
    signals.push({
      name,
      label: cleanString(entry.label, 120) || name,
      score,
      level: cleanString(entry.level, 32),
      flagged: entry.flagged === true,
      baseline_score: typeof entry.baseline_score === "number" && Number.isFinite(entry.baseline_score) ? entry.baseline_score : null,
      latest_score: typeof entry.latest_score === "number" && Number.isFinite(entry.latest_score) ? entry.latest_score : null,
      deviation_from_baseline: typeof entry.deviation_from_baseline === "number" && Number.isFinite(entry.deviation_from_baseline) ? entry.deviation_from_baseline : null,
      anomaly: typeof entry.anomaly === "boolean" ? entry.anomaly : null,
    });
  }
  return signals;
}

function cleanSummary(raw) {
  if (!raw || typeof raw !== "object") return null;
  const flaggedCount = Number(raw.flaggedCount);
  const totalSignals = Number(raw.totalSignals);
  return {
    overallLevel: cleanString(raw.overallLevel, 32),
    recommendedAction: cleanString(raw.recommendedAction, 32),
    flaggedCount: Number.isFinite(flaggedCount) ? flaggedCount : null,
    totalSignals: Number.isFinite(totalSignals) ? totalSignals : null,
  };
}

/**
 * Trust the server clock for ordering. A client-supplied capturedAt is accepted
 * only when it is sane, because the burst-collapsing and trend maths downstream
 * are driven entirely by these timestamps.
 */
function resolveCapturedAt(value) {
  const now = Date.now();
  const capturedAt = Number(value);
  if (!Number.isFinite(capturedAt)) return now;
  const oneDayAhead = now + 24 * 60 * 60 * 1000;
  const tenYearsAgo = now - 10 * 365 * 24 * 60 * 60 * 1000;
  if (capturedAt > oneDayAhead || capturedAt < tenYearsAgo) return now;
  return capturedAt;
}

const PHONE_REQUESTS = "serasonaPhoneRequests";
const HARNESS = "https://voice-call-harness-551580534721.us-central1.run.app";
const TERMINAL = new Set(["complete", "failed", "low_quality", "insufficient_audio"]);

function sessionDocumentId(userKey, jobId) {
  return crypto.createHash("sha256").update(`${userKey}:${jobId}`).digest("hex");
}

async function recoverPhoneRequest(request) {
  const data = request.data();
  const response = await fetch(`${HARNESS}/voiceCall/status?session=${encodeURIComponent(data.phoneSessionId)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Phone status unavailable");
  const call = await response.json();
  if (!TERMINAL.has(call.status)) return;
  const job = call.result || {};
  const result = job.result || {};
  const usable = call.status === "complete" && call.quality?.usable !== false;
  const signals = usable ? cleanSignals(result.signals) : [];
  const entry = {
    userKey: data.userKey,
    model: cleanString(call.model, 32),
    pathway: null,
    source: "phone",
    status: usable && signals.length ? "complete" : (call.status === "complete" ? "low_quality" : call.status),
    capturedAt: data.capturedAt,
    speechSeconds: Number.isFinite(call.speechSeconds) ? call.speechSeconds : null,
    captureSampleRate: Number.isFinite(call.captureSampleRate) ? call.captureSampleRate : (job.audio_sample_rate || null),
    quality: { usable: Boolean(usable && signals.length), reason: cleanString(call.quality?.reason || call.error, 500) },
    signals,
    summary: cleanSummary({ overallLevel: result.summary?.overall_level, recommendedAction: result.summary?.recommended_action }),
    createdAt: FieldValue.serverTimestamp(),
  };
  const ref = firestore.collection(COLLECTION).doc(sessionDocumentId(data.userKey, `phone:${data.phoneSessionId}`));
  try { await ref.create(entry); } catch (error) { if (error.code !== 6) throw error; }
  await request.ref.update({ status: "saved" });
}

async function startPhone(req, res) {
  const identity = await resolveIdentity(req, null);
  if (!identity || identity.mode !== "account") return res.status(401).json({ error: "Sign in first." });
  const uid = identity.userKey.slice(4);
  const profile = await firestore.collection("users").doc(uid).get();
  const subscription = profile.data()?.subscription;
  if (!ACTIVE_STATUSES.has(subscription?.status) || (PLAN_RANK[subscription?.planId] || 0) < PLAN_RANK.plus) {
    return res.status(403).json({ error: "Phone check-ins require an active Plus or Executive plan." });
  }
  if (req.body.consent !== true) return res.status(400).json({ error: "Confirm you want us to call and analyze this recording." });
  const phone = req.body.phone;
  if (typeof phone !== "string" || !/^[+][1-9][0-9]{7,14}$/.test(phone)) return res.status(400).json({ error: "Enter a valid phone number." });
  const clone = await firestore.collection("voiceClones").doc(uid).get();
  // The same two Telnyx library voices used by BDO811/myabuela. These are IDs, not credentials.
  const defaultVoices = {
    female: "Minimax.speech-2.8-turbo.TzAbof88qTAKUpml5AfSnl8K7IX5xkk3fmrX31X2jvNAV",
    male: "Telnyx.Qwen3TTS.5a9bb629-f9cc-4f4f-b2ee-eb07b47d8cd9",
  };
  const voice = clone.data();
  const selection = voice?.selection || (voice?.status === "ready" ? "own" : "female");
  if (selection === "own" && (voice?.status !== "ready" || !voice?.providerVoiceId)) return res.status(409).json({ error: "Your recorded voice is not ready. Select a female or male voice in your account or try again when processing finishes." });
  const voiceId = selection === "own" ? voice.providerVoiceId : defaultVoices[selection] || defaultVoices.female;
  const response = await fetch(`${HARNESS}/voiceCall/start`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: req.headers.authorization },
    body: JSON.stringify({ phone, mode: "phone", model: "haven", brand: "serasona", ...(voiceId ? { voiceId } : {}) }),
    signal: AbortSignal.timeout(25000),
  });
  const call = await response.json().catch(() => ({}));
  if (!response.ok || !call.sessionId) return res.status(502).json({ error: call.message || "The phone service could not start the call." });
  const ref = firestore.collection(PHONE_REQUESTS).doc(sessionDocumentId("phone", call.sessionId));
  await ref.create({ userKey: identity.userKey, phoneSessionId: call.sessionId, capturedAt: Date.now(), status: "pending" });
  return res.status(200).json({ sessionId: call.sessionId, status: call.status, provider: call.provider, checkinUrl: null });
}

async function trackPhone(req, res) {
  const identity = await resolveIdentity(req, null);
  if (!identity || identity.mode !== "account") return res.status(401).json({ error: "Sign in first." });
  const uid = identity.userKey.slice(4);
  const profile = await firestore.collection("users").doc(uid).get();
  const subscription = profile.data()?.subscription;
  if (!ACTIVE_STATUSES.has(subscription?.status) || (PLAN_RANK[subscription?.planId] || 0) < PLAN_RANK.plus) {
    return res.status(403).json({ error: "Phone check-ins require an active Plus or Executive plan." });
  }
  const id = req.body.phoneSessionId;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{8,160}$/.test(id)) return res.status(400).json({ error: "Invalid phone session." });
  // Bind each capability to one account. Never allow another caller to claim it.
  const ref = firestore.collection(PHONE_REQUESTS).doc(sessionDocumentId("phone", id));
  try {
    await ref.create({ userKey: identity.userKey, phoneSessionId: id, capturedAt: Date.now(), status: "pending" });
  } catch (error) {
    if (error.code !== 6) throw error;
  }
  const request = await ref.get();
  if (request.data().userKey !== identity.userKey) return res.status(403).json({ error: "This session belongs to a different account." });
  if (request.data().status === "pending") {
    try { await recoverPhoneRequest(request); } catch { /* A later history read retries recovery. */ }
  }
  return res.status(200).json({ linked: true });
}

async function recoverPendingPhones(userKey) {
  const requests = await firestore.collection(PHONE_REQUESTS).where("userKey", "==", userKey).get();
  const pending = requests.docs.filter((doc) => doc.data().status === "pending").slice(-6);
  await Promise.allSettled(pending.map(recoverPhoneRequest));
}

async function handleSave(req, res) {
  const body = req.body;
  if (!body || typeof body !== "object") {
    res.status(400).json({ error: "Invalid request." });
    return;
  }

  if (JSON.stringify(body).length > MAX_BODY_BYTES) {
    res.status(413).json({ error: "Request too large." });
    return;
  }

  const identity = await resolveIdentity(req, body.email);
  if (!identity) {
    res.status(401).json({ error: "Sign in, or provide a valid email." });
    return;
  }

  if (body.action === "startPhone") return startPhone(req, res);
  if (body.action === "trackPhone") return trackPhone(req, res);
  const signals = cleanSignals(body.signals);
  if (signals.length === 0) {
    res.status(400).json({ error: "At least one signal is required." });
    return;
  }

  const jobId = cleanString(body.jobId, 160);
  const sessionRef = jobId && identity.mode === "account"
    ? firestore.collection(COLLECTION).doc(sessionDocumentId(identity.userKey, jobId))
    : firestore.collection(COLLECTION).doc();
  if ((await sessionRef.get()).exists) return res.status(200).json({ sessionId: sessionRef.id, alreadySaved: true });

  // The free tier's daily check-in allowance, enforced here rather than only
  // in the UI.
  //
  // Scoped to account mode on purpose. The anonymous email path belongs to the
  // original try-it demo, which has no accounts and no entitlements, and
  // limiting it would break that funnel. Serasona itself always sends a token:
  // since the free check-in started requiring an account, there is no path
  // through the Serasona client that reaches the anonymous branch.
  if (identity.mode === "account") {
    const uid = identity.userKey.slice("uid:".length);
    if (!(await hasUnlimitedCheckins(uid))) {
      const usedToday = await countSessionsToday(identity.userKey);
      if (usedToday >= FREE_CHECKIN_DAILY_LIMIT) {
        console.log(`[voice-history] Free daily limit reached for ${identity.userKey} (${usedToday} today)`);
        // 402 rather than 403: the request is well-formed and the caller is
        // who they say they are. What is missing is a plan.
        res.status(402).json({
          error: "You've used your free check-ins for today. More tomorrow, or upgrade for unlimited and your full history.",
          code: "free_limit_reached",
          limit: FREE_CHECKIN_DAILY_LIMIT,
        });
        return;
      }
    }
  }

  const session = {
    userKey: identity.userKey,
    model: cleanString(body.model, 32),
    pathway: cleanString(body.pathway, 32),
    source: body.source === "browser" ? "browser" : null,
    status: "complete",
    capturedAt: resolveCapturedAt(body.capturedAt),
    signals,
    summary: cleanSummary(body.summary),
    createdAt: FieldValue.serverTimestamp(),
  };

  try { await sessionRef.create(session); } catch (error) { if (error.code !== 6) throw error; }
  const written = sessionRef;
  console.log(`[voice-history] Saved session ${written.id} (${signals.length} signals)`);

  res.status(200).json({ sessionId: written.id, capturedAt: session.capturedAt });
}

async function handleFetch(req, res) {
  const identity = await resolveIdentity(req, req.query && req.query.email);
  if (!identity) {
    res.status(401).json({ error: "Sign in, or provide a valid email." });
    return;
  }

  if (identity.mode === "account") await recoverPendingPhones(identity.userKey);

  // Equality filter only, then sort in memory. Adding orderBy(capturedAt) here
  // would need a composite index provisioned before the endpoint works at all.
  const snapshot = await firestore
    .collection(COLLECTION)
    .where("userKey", "==", identity.userKey)
    .limit(MAX_SESSIONS_RETURNED)
    .get();

  let sessions = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        sessionId: doc.id,
        capturedAt: data.capturedAt,
        model: data.model,
        source: data.source || null,
        status: data.status || "complete",
        speechSeconds: data.speechSeconds ?? null,
        captureSampleRate: data.captureSampleRate ?? null,
        quality: data.quality || null,
        pathway: data.pathway,
        signals: Array.isArray(data.signals) ? data.signals : [],
        summary: data.summary || null,
      };
    })
    .sort((a, b) => a.capturedAt - b.capturedAt);

  // Free accounts see a rolling week; Core and up see everything. This is the
  // real difference between "try it" and "track it" — not a different model,
  // a different amount of your own history.
  if (identity.mode === "account") {
    const uid = identity.userKey.slice("uid:".length);
    if (!(await hasUnlimitedCheckins(uid))) {
      const cutoff = Date.now() - FREE_HISTORY_WINDOW_MS;
      sessions = sessions.filter((s) => s.capturedAt >= cutoff);
    }
  }

  console.log(`[voice-history] Returned ${sessions.length} sessions`);
  res.status(200).json({ sessions });
}

async function handleDelete(req, res) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ") || !header.slice(7)) {
    return res.status(401).json({ error: "Sign in to delete your readings." });
  }
  let decoded;
  try { decoded = await admin.auth().verifyIdToken(header.slice(7), true); }
  catch { return res.status(401).json({ error: "Sign in again to delete your readings." }); }
  const userKey = `uid:${decoded.uid}`;
  let deleted = 0;
  // Batch at most 400 writes; keep querying until every owned row is gone.
  // Query parameters never determine ownership.
  for (const name of [COLLECTION, PHONE_REQUESTS]) {
    for (;;) {
      const snapshot = await firestore.collection(name).where("userKey", "==", userKey).limit(400).get();
      if (snapshot.empty) break;
      const batch = firestore.batch();
      for (const doc of snapshot.docs) batch.delete(doc.ref);
      await batch.commit();
      deleted += snapshot.size;
    }
  }
  return res.status(200).json({ deleted });
}

exports.voiceHistory = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  try {
    if (req.method === "DELETE") {
      await handleDelete(req, res);
      return;
    }
    if (req.method === "POST") {
      await handleSave(req, res);
      return;
    }
    if (req.method === "GET") {
      await handleFetch(req, res);
      return;
    }
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    console.error("[voice-history] Error:", error);
    res.status(500).json({ error: "Something went wrong." });
  }
};
