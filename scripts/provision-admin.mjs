#!/usr/bin/env node
/**
 * Provision a full-access Serasona account.
 *
 *   node scripts/provision-admin.mjs serasona@helix.harvard7.net
 *
 * The password is read from PROVISION_PASSWORD in the environment, never
 * passed as an argument — arguments land in shell history and in the process
 * list, where any other user on the machine can read them.
 *
 * "Full access" here means three separate things, because they are stored in
 * three separate places and granting one does not grant the others:
 *
 *   1. the `admin` custom claim, which the adminApi Cloud Function checks on
 *      every request;
 *   2. an `executive` subscription in Firestore, which is what analyzeAudio
 *      reads to decide which voice models this account may run;
 *   3. a verified email, so nothing in the product nags about it.
 *
 * What it deliberately does NOT do is enrol two-factor. The admin panel
 * refuses to show customer data without a live TOTP elevation, and that
 * enrolment has to happen from the browser so the secret reaches a real
 * authenticator app. Creating an admin that could skip 2FA from a script
 * would make the second factor optional, which is the same as not having one.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT = "amits-playground-po";
initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

const email = process.argv.slice(2).find((a) => !a.startsWith("--"));
const password = process.env.PROVISION_PASSWORD;

if (!email || !password) {
  console.error("usage: PROVISION_PASSWORD='…' node scripts/provision-admin.mjs <email>");
  process.exit(1);
}

// A full-access account on a product holding voice recordings and billing
// detail is worth a sanity check, not a silent accept.
if (password.length < 12) {
  console.error("Refusing: password is under 12 characters for a full-access account.");
  process.exit(1);
}

async function main() {
  let user = await auth.getUserByEmail(email).catch(() => null);

  if (user) {
    await auth.updateUser(user.uid, { password, emailVerified: true, disabled: false });
    console.log(`Updated the existing account for ${email}.`);
  } else {
    user = await auth.createUser({
      email,
      password,
      emailVerified: true,
      displayName: "Serasona Admin",
    });
    console.log(`Created ${email}.`);
  }

  // 1. Admin claim.
  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });

  // 2. Top plan, so every voice model is entitled. analyzeAudio reads this
  //    exact path against the verified uid; without it the account reads as
  //    free and would silently be downgraded to the pulse model.
  await db.collection("users").doc(user.uid).set(
    {
      email,
      subscription: { planId: "executive", status: "active", source: "provisioned" },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // A custom claim only lands in a NEW ID token, so an existing session would
  // keep its old claims for up to an hour.
  await auth.revokeRefreshTokens(user.uid);

  await db.collection("adminAudit").add({
    at: FieldValue.serverTimestamp(),
    actorUid: "script:provision-admin",
    actorEmail: "local operator (ADC)",
    action: "admin.provision",
    target: user.uid,
    outcome: "ok",
    detail: { email, planId: "executive" },
  });

  const totp = await db.collection("adminTotp").doc(user.uid).get();

  console.log("");
  console.log(`  uid              ${user.uid}`);
  console.log(`  admin claim      yes`);
  console.log(`  plan             executive (all voice models)`);
  console.log(`  email verified   yes`);
  console.log(`  two-factor       ${totp.exists ? "already enrolled" : "NOT enrolled — required for /admin"}`);
  console.log("");
  console.log("Next: sign in at https://www.serasona.com/admin and scan the QR code.");
  console.log("The admin panel shows no customer data until that is done.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
