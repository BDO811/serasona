const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const admin = require("firebase-admin");
const { SignedDataVerifier, Environment } = require("@apple/app-store-server-library");

if (!admin.apps.length) admin.initializeApp();

/**
 * Verifies a StoreKit 2 signed transaction and writes the same
 * `users/{uid}.subscription` shape `stripe-webhook` already writes, so every
 * entitlement check in `analyze-audio` and `voice-history` (`hasUnlimitedCheckins`,
 * `entitledModel`) works unchanged regardless of which store a person paid
 * through. This is the Apple-side half of billing; Stripe remains the web path.
 *
 * Called by the iOS app right after `Product.purchase()` resolves, with the
 * transaction's `jwsRepresentation` and which StoreKit environment it ran in
 * (Xcode local testing, Sandbox, or Production — StoreKit 2 exposes this on
 * the transaction itself, so the client doesn't have to guess).
 *
 * Verification needs no App Store Connect credentials: `SignedDataVerifier`
 * checks the JWS signature chain against Apple's own public root certificate,
 * nothing more. The one thing Production mode additionally requires is the
 * app's numeric App Store Connect ID (`appAppleId`), which doesn't exist until
 * this app is actually created there — Xcode and Sandbox verification work
 * today, Production needs that one id added once the app exists.
 */

// Mirrors `stripe-webhook`'s PRICE_ID_TO_PLAN — same Firestore field, same
// three tiers, different store. Must match the product ids in the iOS
// project's StoreKit configuration and App Store Connect once products are
// created there.
const PRODUCT_ID_TO_PLAN = {
  "com.serasona.app.core.monthly": "core",
  "com.serasona.app.plus.monthly": "plus",
  "com.serasona.app.executive.monthly": "executive",
};

const BUNDLE_ID = "com.serasona.app";
// Set once the app exists in App Store Connect — required only for
// Environment.PRODUCTION; Xcode/Sandbox verification ignores it.
const APP_APPLE_ID = process.env.APPLE_APP_APPLE_ID
  ? Number(process.env.APPLE_APP_APPLE_ID)
  : undefined;

const ROOT_CA_PATH = path.join(__dirname, "AppleRootCA-G3.cer");
let cachedRootCAs = null;
function loadRootCAs() {
  if (!cachedRootCAs) cachedRootCAs = [fs.readFileSync(ROOT_CA_PATH)];
  return cachedRootCAs;
}

function resolveEnvironment(value) {
  switch ((value || "").toLowerCase()) {
    case "xcode": return process.env.FUNCTIONS_EMULATOR === "true" ? Environment.XCODE : null;
    case "sandbox": return Environment.SANDBOX;
    case "production": return Environment.PRODUCTION;
    default: return null;
  }
}

// Stable opaque UUID shared with the native purchase client. The signed
// transaction must identify this caller rather than whichever account first
// presents a copied transaction to this endpoint.
function accountToken(uid) {
  const bytes = crypto.createHash("sha256").update(`com.serasona.app.account:${uid}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x80;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

const httpError = (status, message, clientMessage) =>
  Object.assign(new Error(message), { status, clientMessage });

async function authenticateCaller(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw httpError(401, "no bearer token", "Sign in to redeem a purchase.");
  try {
    const decoded = await admin.auth().verifyIdToken(token, true);
    return decoded.uid;
  } catch (err) {
    throw httpError(401, `token rejected: ${err.message}`, "Your session has expired. Sign in again.");
  }
}

/** Mirrors `stripe-webhook`'s status field: Stripe-style strings so every
 * downstream entitlement check (`ACTIVE_STATUSES = {active, trialing}`)
 * reads identically regardless of which store wrote the document. */
function resolveStatus(transaction) {
  if (transaction.revocationDate) return "canceled";
  if (typeof transaction.expiresDate === "number" && transaction.expiresDate < Date.now()) {
    return "canceled"; // expired and not renewed (StoreKit would have sent a new transaction otherwise)
  }
  return "active";
}

exports.appleIapVerify = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  let uid;
  try {
    uid = await authenticateCaller(req);
  } catch (err) {
    console.warn("[apple-iap-verify] rejected:", err.message);
    res.status(err.status || 401).json({ error: err.clientMessage || "Sign in to redeem a purchase." });
    return;
  }

  const { signedTransactionInfo, environment: environmentValue } = req.body || {};
  if (typeof signedTransactionInfo !== "string" || !signedTransactionInfo || signedTransactionInfo.length > 256 * 1024) {
    res.status(400).json({ error: "Missing signedTransactionInfo." });
    return;
  }

  const environment = resolveEnvironment(environmentValue);
  if (!environment) {
    res.status(400).json({ error: "Missing or unrecognized environment." });
    return;
  }
  if (environment === Environment.PRODUCTION && !APP_APPLE_ID) {
    console.error("[apple-iap-verify] Production verification requested but APPLE_APP_APPLE_ID is not set");
    res.status(503).json({ error: "Apple billing isn't fully configured yet." });
    return;
  }

  try {
    const verifier = new SignedDataVerifier(
      loadRootCAs(),
      /* enableOnlineChecks */ environment !== Environment.XCODE, // Xcode-local transactions have no live OCSP responder
      environment,
      BUNDLE_ID,
      environment === Environment.PRODUCTION ? APP_APPLE_ID : undefined
    );

    const transaction = await verifier.verifyAndDecodeTransaction(signedTransactionInfo);
    if (typeof transaction.appAccountToken !== "string" || transaction.appAccountToken.toLowerCase() !== accountToken(uid)) {
      return res.status(403).json({ error: "This purchase belongs to a different Serasona account." });
    }
    if (!Number.isFinite(transaction.expiresDate) || transaction.expiresDate <= 0 || !transaction.originalTransactionId) {
      return res.status(400).json({ error: "Missing subscription expiration or transaction identity." });
    }

    const planId = PRODUCT_ID_TO_PLAN[transaction.productId];
    if (!planId) {
      console.warn("[apple-iap-verify] Unrecognized productId:", transaction.productId);
      res.status(400).json({ error: "Unrecognized product." });
      return;
    }

    const subscription = {
      planId,
      status: resolveStatus(transaction),
      currentPeriodEnd: typeof transaction.expiresDate === "number"
        ? Math.floor(transaction.expiresDate / 1000)
        : null,
      stripeCustomerId: null,
      provider: "apple",
      appleOriginalTransactionId: transaction.originalTransactionId || null,
      appleEnvironment: environmentValue,
    };

    const userRef = admin.firestore().collection("users").doc(uid);
    await admin.firestore().runTransaction(async (tx) => {
      const existing = await tx.get(userRef);
      const previous = existing.exists ? existing.data().subscription : null;
      // Delayed restores and older renewals must not shorten a newer period.
      if (previous?.provider === "apple" && Number(previous.currentPeriodEnd) > subscription.currentPeriodEnd) return;
      // An expired Apple transaction must not cancel an active web plan.
      if (previous?.provider !== "apple" && previous?.status === "active" && subscription.status !== "active") return;
      tx.set(userRef, { subscription }, { merge: true });
    });

    console.log(`[apple-iap-verify] ${uid} -> ${planId} (${subscription.status}, ${environmentValue})`);
    res.status(200).json({ subscription });
  } catch (error) {
    console.error("[apple-iap-verify] Verification failed:", error);
    res.status(400).json({ error: "Couldn't verify that purchase." });
  }
};
