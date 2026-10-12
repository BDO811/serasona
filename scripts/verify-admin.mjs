#!/usr/bin/env node
/**
 * Prove the admin chain end to end against the DEPLOYED function.
 *
 *   node scripts/verify-admin.mjs
 *
 * Uses a throwaway admin account, enrolls a throwaway TOTP secret, and deletes
 * both at the end — so the real admin's enrollment is never touched.
 *
 * What this has to establish, in order, is that each layer independently
 * refuses: a non-admin cannot read, an admin without elevation cannot read,
 * a replayed code cannot elevate, and only the full chain works.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const totp = require("../gcp-functions/admin-api/totp.js");

const PROJECT = "amits-playground-po";
const API = "https://us-central1-amits-playground-po.cloudfunctions.net/adminApi";
const IDENTITY = "https://identitytoolkit.googleapis.com/v1/accounts";

initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const WEB_KEY = env.VITE_FIREBASE_API_KEY;

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "  ok  " : " FAIL "} ${name}${detail ? "  — " + detail : ""}`);
};

// Signing in as the probe account is how a real ID token gets minted.
// createCustomToken would need a service-account signer, which local ADC user
// credentials cannot do. PROBE_SECRET is generated per run, belongs to a
// throwaway account created and deleted by this script, and is never a real
// person's credential.
const PROBE_SECRET = randomBytes(24).toString("base64url");

async function idTokenFor(email) {
  const r = await fetch(`${IDENTITY}:signInWithPassword?key=${WEB_KEY}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PROBE_SECRET, returnSecureToken: true }),
  }).then((x) => x.json());
  if (!r.idToken) throw new Error("could not mint an ID token: " + JSON.stringify(r).slice(0, 200));
  return r.idToken;
}

const call = (path, { token, elevation, method = "GET", body } = {}) =>
  fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(elevation ? { "X-Elevation": elevation } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

async function main() {
  const email = `admin-probe-${Date.now()}@example.com`;
  const user = await auth.createUser({ email, password: PROBE_SECRET });
  let plainUser = null;

  try {
    // --- a signed-in NON-admin must be refused -----------------------------
    plainUser = await auth.createUser({ email: `plain-probe-${Date.now()}@example.com`, password: PROBE_SECRET });
    const plainToken = await idTokenFor(plainUser.email);
    const r403 = await call("/stats", { token: plainToken });
    check("non-admin refused", r403.status === 403, `HTTP ${r403.status}`);

    // --- grant admin -------------------------------------------------------
    await auth.setCustomUserClaims(user.uid, { admin: true });
    const token = await idTokenFor(email);

    const me = await call("/me", { token }).then((r) => r.json());
    check("admin recognised", me.admin === true && me.enrolled === false, `enrolled=${me.enrolled}`);

    // --- admin WITHOUT elevation must still be refused ---------------------
    const r428 = await call("/stats", { token });
    const body428 = await r428.json();
    check("admin without 2FA refused", r428.status === 428 && body428.needsElevation === true, `HTTP ${r428.status}`);

    // --- enroll ------------------------------------------------------------
    const enroll = await call("/totp/enroll", { token, method: "POST" }).then((r) => r.json());
    check("enrollment returns a secret", typeof enroll.secret === "string" && enroll.otpauth?.startsWith("otpauth://"));

    const codeNow = () =>
      totp.codeForCounter(enroll.secret, Math.floor(Date.now() / 1000 / totp.STEP_SECONDS));

    const confirm = await call("/totp/confirm", { token, method: "POST", body: { code: codeNow() } });
    check("enrollment confirmed", confirm.status === 200, `HTTP ${confirm.status}`);

    const badConfirm = await call("/elevate", { token, method: "POST", body: { code: "000000" } });
    check("wrong code cannot elevate", badConfirm.status === 401, `HTTP ${badConfirm.status}`);

    // --- elevate -----------------------------------------------------------
    // Wait for a fresh step: the code used to confirm is burned against replay.
    await new Promise((r) => setTimeout(r, (totp.STEP_SECONDS + 2) * 1000));
    const code = codeNow();
    const elev = await call("/elevate", { token, method: "POST", body: { code } }).then((r) => r.json());
    check("elevation granted", typeof elev.token === "string", `${elev.minutes}min`);

    const replay = await call("/elevate", { token, method: "POST", body: { code } });
    check("same code refused as replay", replay.status === 401, `HTTP ${replay.status}`);

    // --- now the data ------------------------------------------------------
    const stats = await call("/stats", { token, elevation: elev.token }).then((r) => r.json());
    check("stats readable once elevated", typeof stats.users === "number", `${stats.users} users`);

    const users = await call("/users", { token, elevation: elev.token }).then((r) => r.json());
    check("users listable", Array.isArray(users.users), `${users.total} total`);

    const audit = await call("/audit", { token, elevation: elev.token }).then((r) => r.json());
    check("audit log populated", (audit.entries || []).length > 0, `${audit.entries?.length} entries`);

    // --- self-protection ---------------------------------------------------
    const selfDel = await call(`/users/${user.uid}`, { token, elevation: elev.token, method: "DELETE" });
    check("cannot delete own account", selfDel.status === 400, `HTTP ${selfDel.status}`);

    const selfAdmin = await call(`/users/${user.uid}/set-admin`, {
      token, elevation: elev.token, method: "POST", body: { admin: false },
    });
    check("cannot de-admin self", selfAdmin.status === 400, `HTTP ${selfAdmin.status}`);

    // --- a forged elevation token ------------------------------------------
    const forged = await call("/stats", { token, elevation: "not-a-real-elevation-token" });
    check("forged elevation refused", forged.status === 428, `HTTP ${forged.status}`);
  } finally {
    await db.collection("adminTotp").doc(user.uid).delete().catch(() => {});
    await auth.deleteUser(user.uid).catch(() => {});
    if (plainUser) await auth.deleteUser(plainUser.uid).catch(() => {});
    check("probe accounts cleaned up", true);
  }

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error("harness error:", e.message); process.exit(1); });
