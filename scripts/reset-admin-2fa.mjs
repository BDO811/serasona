#!/usr/bin/env node
/**
 * Break-glass reset for admin two-factor.
 *
 *   node scripts/reset-admin-2fa.mjs --list
 *   node scripts/reset-admin-2fa.mjs amit@amplifierhealth.com
 *
 * Deletes the stored TOTP enrollment so the account can enrol again from
 * /admin and scan a fresh QR code.
 *
 * This is a local script run against Application Default Credentials rather
 * than a button in the admin panel, and that is the whole point. A
 * "reset my authenticator" control reachable by whoever is already holding
 * the session is not a second factor — anyone who stole the password could
 * press it. Resetting therefore requires access to the Google Cloud project
 * itself, which is a genuinely separate credential.
 *
 * The reset is written to the same audit log as every other admin action, so
 * a factor being removed is never silent.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT = "amits-playground-po";
initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith("--"));

async function list() {
  const snap = await db.collection("adminTotp").get();
  const now = Math.floor(Date.now() / 1000 / 30);

  if (snap.empty) {
    console.log("No admin has two-factor enrolled.");
    return;
  }

  console.log(`${snap.size} enrolment(s):\n`);
  for (const doc of snap.docs) {
    const d = doc.data();
    const user = await auth.getUser(doc.id).catch(() => null);
    const drift = (d.lastUsedCounter ?? -1) - now;
    console.log(`  ${user?.email ?? "(unknown account)"}`);
    console.log(`    uid        ${doc.id}`);
    console.log(`    confirmed  ${d.confirmed ? "yes" : "no — enrolment never finished"}`);
    console.log(
      `    last used  ${
        d.lastUsedCounter > 0
          ? `${((now - d.lastUsedCounter) * 30 / 3600).toFixed(1)}h ago`
          : "never"
      }${drift > 1 ? "  *** AHEAD OF THE CLOCK — every code will be refused as a replay ***" : ""}`
    );
    console.log("");
  }
}

async function main() {
  if (!target || args.includes("--list")) return list();

  const user = await auth.getUserByEmail(target).catch(() => null);
  if (!user) {
    console.error(`No account for ${target}.`);
    process.exit(1);
  }

  const ref = db.collection("adminTotp").doc(user.uid);
  if (!(await ref.get()).exists) {
    console.log(`${target} has no enrolment to reset. They can enrol at /admin now.`);
    return;
  }

  await ref.delete();

  // Any live elevation was granted by the factor just removed, so it goes too.
  const grants = await db.collection("adminElevation").where("uid", "==", user.uid).get();
  await Promise.all(grants.docs.map((d) => d.ref.delete()));

  await db.collection("adminAudit").add({
    at: FieldValue.serverTimestamp(),
    actorUid: "script:reset-admin-2fa",
    actorEmail: "local operator (ADC)",
    action: "totp.reset",
    target: user.uid,
    outcome: "ok",
    detail: { email: target, elevationsRevoked: grants.size },
  });

  console.log(`Reset two-factor for ${target}.`);
  console.log(`  ${grants.size} live elevation(s) revoked.`);
  console.log("");
  console.log("Next: sign in at https://www.serasona.com/admin and scan the QR code.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
