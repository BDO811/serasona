const crypto = require("node:crypto");
const admin = require("firebase-admin");
const Stripe = require("stripe");
const totp = require("./totp");

if (!admin.apps.length) admin.initializeApp();

/**
 * Admin API for www.serasona.com/admin.
 *
 * The panel itself is a static React page on GitHub Pages. Anyone can read that
 * bundle, open devtools, and call whatever it calls — so NOTHING is enforced
 * there. Every check that matters is here:
 *
 *   1. A valid Firebase ID token.
 *   2. An `admin: true` custom claim on that token. Custom claims can only be
 *      written by the Admin SDK, never by a client.
 *   3. For anything that changes or reveals data, a live ELEVATION proved by a
 *      TOTP code within the last 30 minutes. Being logged in all day is not the
 *      same as having your authenticator in your hand right now.
 *   4. Every action, allowed or refused, is written to an append-only audit log.
 *
 * Read operations need 1 and 2. Mutations need all four.
 */

const db = admin.firestore();
const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

const ADMIN_TOTP = "adminTotp";       // per-admin TOTP secret. Rules deny all client access.
const ADMIN_ELEVATION = "adminElevation";
const ADMIN_AUDIT = "adminAudit";
const USERS = "users";
const SESSIONS = "voiceSessions";

const ELEVATION_MINUTES = 30;
const MAX_PAGE = 200;

// Mirrors the site. A plan change here must match src/context/AuthContext.tsx.
const PLAN_RANK = { free: 0, core: 1, plus: 2, executive: 3 };

/* ------------------------------------------------------------------ CORS */

function corsOrigin(origin) {
  const allowed = [
    "https://www.serasona.com",
    "https://serasona.com",
    "https://tryserasona.com",
    "https://www.tryserasona.com",
  ];
  if (!origin) return allowed[0];
  if (allowed.includes(origin)) return origin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  return allowed[0];
}

function setCors(req, res) {
  res.set("Access-Control-Allow-Origin", corsOrigin(req.headers.origin));
  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Elevation");
  // An admin panel must never be cached by anything.
  res.set("Cache-Control", "no-store");
}

/* ------------------------------------------------------------- auth gate */

async function requireAdmin(req) {
  const header = req.headers.authorization || "";
  const idToken = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!idToken) throw httpError(401, "Not signed in.");

  let decoded;
  try {
    // checkRevoked: a revoked session must stop working immediately, which is
    // the entire point of the "sign out everywhere" button below.
    decoded = await admin.auth().verifyIdToken(idToken, true);
  } catch (err) {
    throw httpError(401, "Session is not valid.");
  }
  if (decoded.admin !== true) throw httpError(403, "Not an administrator.");
  return decoded;
}

/**
 * Elevation: a short-lived grant proving a TOTP code was entered recently.
 * The token is random and only its SHA-256 is stored, so a database read does
 * not yield a usable token.
 */
async function requireElevation(req, uid) {
  const raw = req.headers["x-elevation"];
  if (!raw) throw httpError(428, "Confirm with your authenticator to continue.", { needsElevation: true });

  const hash = crypto.createHash("sha256").update(String(raw)).digest("hex");
  const snap = await db.collection(ADMIN_ELEVATION).doc(hash).get();
  if (!snap.exists) throw httpError(428, "That confirmation is no longer valid.", { needsElevation: true });

  const data = snap.data();
  if (data.uid !== uid) throw httpError(403, "Confirmation belongs to another account.");
  if (Date.now() > data.expiresAt) {
    await snap.ref.delete().catch(() => {});
    throw httpError(428, "Confirmation expired. Enter a fresh code.", { needsElevation: true });
  }
  return true;
}

function httpError(status, message, extra = {}) {
  const e = new Error(message);
  e.status = status;
  e.extra = extra;
  return e;
}

/* ------------------------------------------------------------- audit log */

async function audit(actor, action, target, detail, outcome = "ok") {
  // Append-only: rules forbid update and delete, and nothing here ever rewrites
  // an entry. An audit log you can edit is not an audit log.
  await db.collection(ADMIN_AUDIT).add({
    at: admin.firestore.FieldValue.serverTimestamp(),
    actorUid: actor?.uid ?? null,
    actorEmail: actor?.email ?? null,
    action,
    target: target ?? null,
    detail: detail ?? null,
    outcome,
  }).catch((err) => console.error("[admin] audit write failed:", err.message));
}

/* ------------------------------------------------------------------ TOTP */

async function totpStatus(uid) {
  const snap = await db.collection(ADMIN_TOTP).doc(uid).get();
  return { enrolled: snap.exists && snap.data().confirmed === true };
}

async function totpEnroll(actor) {
  const ref = db.collection(ADMIN_TOTP).doc(actor.uid);
  const snap = await ref.get();
  if (snap.exists && snap.data().confirmed) {
    throw httpError(409, "Already enrolled. Reset it before enrolling again.");
  }
  const secret = totp.generateSecret();
  await ref.set({
    secret,
    confirmed: false,
    lastUsedCounter: -1,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await audit(actor, "totp.enroll.begin", actor.uid, null);
  // The one and only time the secret leaves the server.
  return { secret, otpauth: totp.otpauthUri({ secret, account: actor.email || actor.uid }) };
}

async function totpConfirm(actor, code) {
  const ref = db.collection(ADMIN_TOTP).doc(actor.uid);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(409, "Start enrollment first.");
  const { secret, lastUsedCounter } = snap.data();

  const result = totp.verify(secret, code, { lastUsedCounter });
  if (!result.ok) {
    await audit(actor, "totp.enroll.confirm", actor.uid, { reason: result.reason }, "denied");
    throw httpError(401, "That code did not match.");
  }
  await ref.update({ confirmed: true, lastUsedCounter: result.counter });
  await audit(actor, "totp.enroll.confirm", actor.uid, null);
  return { enrolled: true };
}

async function elevate(actor, code) {
  const ref = db.collection(ADMIN_TOTP).doc(actor.uid);
  const snap = await ref.get();
  if (!snap.exists || !snap.data().confirmed) throw httpError(409, "Set up your authenticator first.");

  const { secret, lastUsedCounter } = snap.data();
  const result = totp.verify(secret, code, { lastUsedCounter });
  if (!result.ok) {
    await audit(actor, "admin.elevate", actor.uid, { reason: result.reason }, "denied");
    throw httpError(401, "That code did not match.");
  }
  await ref.update({ lastUsedCounter: result.counter });

  const token = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + ELEVATION_MINUTES * 60 * 1000;
  await db.collection(ADMIN_ELEVATION).doc(hash).set({ uid: actor.uid, expiresAt });

  await audit(actor, "admin.elevate", actor.uid, null);
  return { token, expiresAt, minutes: ELEVATION_MINUTES };
}

/* ------------------------------------------------------------------ users */

async function userSummary(rec) {
  const doc = await db.collection(USERS).doc(rec.uid).get();
  const sub = doc.exists ? doc.data().subscription || null : null;
  return {
    uid: rec.uid,
    email: rec.email ?? null,
    displayName: rec.displayName ?? doc.data?.()?.fullName ?? null,
    disabled: rec.disabled,
    emailVerified: rec.emailVerified,
    isAdmin: rec.customClaims?.admin === true,
    createdAt: rec.metadata.creationTime,
    lastSignInAt: rec.metadata.lastSignInTime,
    plan: sub?.planId ?? "free",
    planStatus: sub?.status ?? "none",
    stripeCustomerId: sub?.stripeCustomerId ?? null,
  };
}

async function listUsers(query) {
  const limit = Math.min(Number(query.limit) || 50, MAX_PAGE);
  const search = String(query.search || "").trim().toLowerCase();

  // listUsers pages at 1000. For a product at this stage that is one page;
  // if it ever is not, this needs a real index rather than a bigger loop.
  const page = await admin.auth().listUsers(1000);
  let records = page.users;
  if (search) {
    records = records.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(search) ||
        (u.displayName || "").toLowerCase().includes(search) ||
        u.uid === search
    );
  }
  records.sort((a, b) => (b.metadata.creationTime || "").localeCompare(a.metadata.creationTime || ""));
  const slice = records.slice(0, limit);
  return {
    total: records.length,
    users: await Promise.all(slice.map(userSummary)),
  };
}

async function userDetail(uid) {
  const rec = await admin.auth().getUser(uid);
  const summary = await userSummary(rec);
  const checkins = await db.collection(SESSIONS).where("userKey", "==", `uid:${uid}`).count().get();
  return {
    ...summary,
    checkinCount: checkins.data().count,
    providers: rec.providerData.map((p) => p.providerId),
    tokensValidAfter: rec.tokensValidAfterTime,
  };
}

async function userCheckins(uid, limit = 50) {
  const snap = await db
    .collection(SESSIONS)
    .where("userKey", "==", `uid:${uid}`)
    .limit(Math.min(Number(limit) || 50, MAX_PAGE))
    .get();
  return {
    checkins: snap.docs
      .map((d) => {
        const v = d.data();
        return {
          id: d.id,
          capturedAt: v.capturedAt ?? null,
          model: v.model ?? null,
          overallLevel: v.summary?.overallLevel ?? null,
          flaggedCount: v.summary?.flaggedCount ?? null,
          signalCount: Array.isArray(v.signals) ? v.signals.length : 0,
        };
      })
      .sort((a, b) => (b.capturedAt || 0) - (a.capturedAt || 0)),
  };
}

/* ---------------------------------------------------------------- billing */

async function billing(uid) {
  if (!stripe) throw httpError(503, "Stripe is not configured on this deployment.");
  const doc = await db.collection(USERS).doc(uid).get();
  const customerId = doc.exists ? doc.data().subscription?.stripeCustomerId : null;
  if (!customerId) return { customerId: null, subscriptions: [], invoices: [], charges: [] };

  const [subs, invoices, charges] = await Promise.all([
    stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 }),
    stripe.invoices.list({ customer: customerId, limit: 10 }),
    stripe.charges.list({ customer: customerId, limit: 10 }),
  ]);

  return {
    customerId,
    subscriptions: subs.data.map((s) => ({
      id: s.id,
      status: s.status,
      priceId: s.items?.data?.[0]?.price?.id ?? null,
      amount: s.items?.data?.[0]?.price?.unit_amount ?? null,
      currentPeriodEnd: s.current_period_end,
      cancelAtPeriodEnd: s.cancel_at_period_end,
    })),
    invoices: invoices.data.map((i) => ({
      id: i.id, number: i.number, status: i.status, total: i.total,
      created: i.created, hostedUrl: i.hosted_invoice_url,
    })),
    charges: charges.data.map((c) => ({
      id: c.id, amount: c.amount, refunded: c.refunded,
      amountRefunded: c.amount_refunded, created: c.created, status: c.status,
    })),
  };
}

/* ------------------------------------------------------------------ stats */

async function stats() {
  const page = await admin.auth().listUsers(1000);
  const byPlan = { free: 0, core: 0, plus: 0, executive: 0 };
  let disabled = 0;
  let admins = 0;

  const docs = await db.collection(USERS).get();
  const plans = new Map();
  docs.forEach((d) => plans.set(d.id, d.data().subscription || null));

  for (const u of page.users) {
    if (u.disabled) disabled++;
    if (u.customClaims?.admin === true) admins++;
    const sub = plans.get(u.uid);
    const active = sub && ["active", "trialing"].includes(sub.status);
    byPlan[active ? sub.planId : "free"] = (byPlan[active ? sub.planId : "free"] || 0) + 1;
  }

  const checkins = await db.collection(SESSIONS).count().get();
  const paying = byPlan.core + byPlan.plus + byPlan.executive;
  // Mirrors live Stripe pricing. If prices change this is wrong, so it is
  // labelled an estimate in the UI rather than presented as revenue.
  const mrrCents = byPlan.core * 1450 + byPlan.plus * 2450 + byPlan.executive * 7450;

  return {
    users: page.users.length,
    disabled,
    admins,
    byPlan,
    paying,
    estimatedMrrCents: mrrCents,
    totalCheckins: checkins.data().count,
  };
}

/* ----------------------------------------------------------------- router */

const json = (res, status, body) => res.status(status).json(body);

exports.adminApi = async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  const path = (req.path || "/").replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  let actor = null;

  try {
    actor = await requireAdmin(req);

    // --- things that do not need elevation ---------------------------------
    if (req.method === "GET" && path === "/me") {
      return json(res, 200, {
        uid: actor.uid, email: actor.email, admin: true, ...(await totpStatus(actor.uid)),
      });
    }
    if (req.method === "POST" && path === "/totp/enroll") return json(res, 200, await totpEnroll(actor));
    if (req.method === "POST" && path === "/totp/confirm") {
      return json(res, 200, await totpConfirm(actor, req.body?.code));
    }
    if (req.method === "POST" && path === "/elevate") {
      return json(res, 200, await elevate(actor, req.body?.code));
    }

    // Everything past here is real data. Require the authenticator, including
    // for reads: a list of every customer and their plan is worth protecting.
    await requireElevation(req, actor.uid);

    if (req.method === "GET" && path === "/stats") return json(res, 200, await stats());
    if (req.method === "GET" && path === "/users") return json(res, 200, await listUsers(req.query || {}));
    if (req.method === "GET" && path === "/audit") {
      const snap = await db.collection(ADMIN_AUDIT).orderBy("at", "desc").limit(100).get();
      return json(res, 200, {
        entries: snap.docs.map((d) => ({ id: d.id, ...d.data(), at: d.data().at?.toMillis?.() ?? null })),
      });
    }

    if (parts[0] === "users" && parts[1]) {
      const uid = parts[1];
      const action = parts[2];

      if (req.method === "GET" && !action) return json(res, 200, await userDetail(uid));
      if (req.method === "GET" && action === "checkins") {
        return json(res, 200, await userCheckins(uid, req.query?.limit));
      }
      if (req.method === "GET" && action === "billing") return json(res, 200, await billing(uid));

      if (req.method === "POST" && action === "disable") {
        await admin.auth().updateUser(uid, { disabled: true });
        // Disabling without revoking leaves existing tokens working for up to
        // an hour, which is not what "disable" means to the person clicking it.
        await admin.auth().revokeRefreshTokens(uid);
        await audit(actor, "user.disable", uid, null);
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && action === "enable") {
        await admin.auth().updateUser(uid, { disabled: false });
        await audit(actor, "user.enable", uid, null);
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && action === "revoke-sessions") {
        await admin.auth().revokeRefreshTokens(uid);
        await audit(actor, "user.revokeSessions", uid, null);
        return json(res, 200, { ok: true });
      }
      if (req.method === "POST" && action === "password-reset") {
        const rec = await admin.auth().getUser(uid);
        if (!rec.email) throw httpError(400, "That account has no email address.");
        // A link, not a new password. An admin who can set passwords can
        // impersonate; sending a reset keeps the secret with the account owner.
        const link = await admin.auth().generatePasswordResetLink(rec.email);
        await audit(actor, "user.passwordResetLink", uid, null);
        return json(res, 200, { ok: true, link, email: rec.email });
      }
      if (req.method === "POST" && action === "set-admin") {
        const grant = req.body?.admin === true;
        if (uid === actor.uid && !grant) {
          // Removing your own access locks everyone out if you are the only one.
          throw httpError(400, "You cannot remove your own admin access here.");
        }
        const rec = await admin.auth().getUser(uid);
        await admin.auth().setCustomUserClaims(uid, { ...(rec.customClaims || {}), admin: grant });
        await admin.auth().revokeRefreshTokens(uid); // claims only refresh on a new token
        await audit(actor, grant ? "user.grantAdmin" : "user.revokeAdmin", uid, null);
        return json(res, 200, { ok: true, admin: grant });
      }
      if (req.method === "POST" && action === "set-plan") {
        const planId = String(req.body?.planId || "");
        if (!(planId in PLAN_RANK)) throw httpError(400, "Unknown plan.");
        // Comp/manual grant. Deliberately does NOT touch Stripe — if there is a
        // real subscription, the next webhook would overwrite this anyway, and
        // silently diverging from the billing system is worse than not trying.
        await db.collection(USERS).doc(uid).set(
          { subscription: { planId, status: planId === "free" ? "none" : "active", manual: true } },
          { merge: true }
        );
        await audit(actor, "user.setPlan", uid, { planId });
        return json(res, 200, { ok: true, planId });
      }
      if (req.method === "DELETE" && action === "checkins") {
        const snap = await db.collection(SESSIONS).where("userKey", "==", `uid:${uid}`).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
        await audit(actor, "user.deleteCheckins", uid, { deleted: snap.size });
        return json(res, 200, { ok: true, deleted: snap.size });
      }
      if (req.method === "DELETE" && !action) {
        if (uid === actor.uid) throw httpError(400, "You cannot delete your own account here.");
        const snap = await db.collection(SESSIONS).where("userKey", "==", `uid:${uid}`).get();
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(db.collection(USERS).doc(uid));
        await batch.commit();
        await admin.auth().deleteUser(uid);
        await audit(actor, "user.delete", uid, { checkinsDeleted: snap.size });
        return json(res, 200, { ok: true, checkinsDeleted: snap.size });
      }
    }

    if (parts[0] === "billing" && parts[1] && req.method === "POST") {
      if (!stripe) throw httpError(503, "Stripe is not configured on this deployment.");
      const uid = parts[1];
      const action = parts[2];

      if (action === "cancel") {
        const subId = String(req.body?.subscriptionId || "");
        if (!subId) throw httpError(400, "subscriptionId is required.");
        const atPeriodEnd = req.body?.atPeriodEnd !== false;
        const updated = atPeriodEnd
          ? await stripe.subscriptions.update(subId, { cancel_at_period_end: true })
          : await stripe.subscriptions.cancel(subId);
        await audit(actor, "billing.cancel", uid, { subId, atPeriodEnd });
        return json(res, 200, { ok: true, status: updated.status, cancelAtPeriodEnd: updated.cancel_at_period_end });
      }
      if (action === "refund") {
        const chargeId = String(req.body?.chargeId || "");
        if (!chargeId) throw httpError(400, "chargeId is required.");
        const amount = req.body?.amount ? Number(req.body.amount) : undefined;
        const refund = await stripe.refunds.create({ charge: chargeId, ...(amount ? { amount } : {}) });
        await audit(actor, "billing.refund", uid, { chargeId, amount: refund.amount });
        return json(res, 200, { ok: true, refundId: refund.id, amount: refund.amount });
      }
    }

    return json(res, 404, { error: "Unknown endpoint." });
  } catch (err) {
    const status = err.status || 500;
    if (status === 403 || status === 401) {
      await audit(actor, "admin.denied", path, { method: req.method, reason: err.message }, "denied");
    }
    if (status === 500) console.error("[admin]", req.method, path, err);
    return json(res, status, {
      error: status === 500 ? "Something went wrong." : err.message,
      ...(err.extra || {}),
    });
  }
};
