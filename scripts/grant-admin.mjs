#!/usr/bin/env node
/**
 * Grant or revoke the `admin` custom claim.
 *
 *   node scripts/grant-admin.mjs --list
 *   node scripts/grant-admin.mjs amit@amplifierhealth.com
 *   node scripts/grant-admin.mjs amit@amplifierhealth.com --revoke
 *
 * The claim is the root of trust for the whole admin panel: the API checks it
 * on every request, and only the Admin SDK can write it. That is deliberate —
 * it means no amount of tampering in the browser can grant it.
 *
 * Run with Application Default Credentials (gcloud auth application-default
 * login), which is why this is a local script and not an endpoint.
 */

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const PROJECT = "amits-playground-po";
initializeApp({ projectId: PROJECT });
const auth = getAuth();

const args = process.argv.slice(2);
const revoke = args.includes("--revoke");
const target = args.find((a) => !a.startsWith("--"));

async function list() {
  const page = await auth.listUsers(1000);
  if (!page.users.length) {
    console.log("No accounts exist yet. Sign up on the site first, then re-run with that email.");
    return;
  }
  console.log(`${page.users.length} account(s):\n`);
  for (const u of page.users) {
    const isAdmin = u.customClaims?.admin === true;
    console.log(
      `  ${isAdmin ? "ADMIN " : "      "}${(u.email || "(no email)").padEnd(34)} ` +
        `${u.uid}  created ${u.metadata.creationTime?.slice(0, 16) || "?"}`
    );
  }
}

async function main() {
  if (!target || args.includes("--list")) return list();

  const user = await auth.getUserByEmail(target).catch(() => null);
  if (!user) {
    console.error(`No account for ${target}. Sign up on the site first.`);
    process.exit(1);
  }

  const claims = { ...(user.customClaims || {}), admin: !revoke };
  if (revoke) delete claims.admin;
  await auth.setCustomUserClaims(user.uid, claims);

  // A custom claim only lands in a NEW ID token, so an existing session would
  // keep its old claims for up to an hour. Revoking forces a fresh token.
  await auth.revokeRefreshTokens(user.uid);

  console.log(`${revoke ? "Revoked" : "Granted"} admin for ${target} (${user.uid}).`);
  console.log("Sign out and back in for it to take effect.");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
