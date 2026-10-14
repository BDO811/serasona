#!/usr/bin/env node
/**
 * Asserts that the built bundle can actually enforce the consent gate.
 *
 *   node scripts/verify-build.mjs
 *
 * The Vite plugin in vite.config.ts refuses to build when the Firebase
 * variables are absent. This checks the complementary failure: variables that
 * are PRESENT but empty, blank, or placeholder text. Vite happily inlines an
 * empty string, `isFirebaseConfigured` then evaluates false at runtime, and
 * the deployed site has no auth — which is the state the consent gate cannot
 * survive.
 *
 * So this looks at the artifact itself rather than at the environment that
 * produced it. If the real project id and auth domain are not in the shipped
 * JavaScript, the deploy stops here.
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const failures = [];
const ok = (m) => console.log(`  ok    ${m}`);
const fail = (m) => {
  failures.push(m);
  console.log(` FAIL  ${m}`);
};

if (!existsSync(DIST)) {
  console.error("dist/ does not exist — nothing to verify. Run the build first.");
  process.exit(1);
}

const bundleDir = join(DIST, "assets");
const js = existsSync(bundleDir)
  ? readdirSync(bundleDir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => readFileSync(join(bundleDir, f), "utf8"))
      .join("\n")
  : "";

if (!js) fail("no JavaScript bundle found in dist/assets");

/* ------------------------------------------------- the consent-gate checks */

const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN;

if (!projectId || !authDomain) {
  fail("VITE_FIREBASE_PROJECT_ID / VITE_FIREBASE_AUTH_DOMAIN are not set in this environment");
} else {
  js.includes(projectId)
    ? ok(`Firebase project id is inlined in the bundle (${projectId})`)
    : fail(`Firebase project id "${projectId}" is NOT in the bundle — auth will be dead and the consent gate cannot run`);

  js.includes(authDomain)
    ? ok(`Firebase auth domain is inlined in the bundle (${authDomain})`)
    : fail(`Firebase auth domain "${authDomain}" is NOT in the bundle`);
}

// The signup route is where Terms acceptance and recording consent are taken.
// If this string is gone, the funnel has been rewired and that needs to be a
// deliberate, visible change rather than a silent one.
js.includes("/signup?next=/checkin")
  ? ok("the home CTA still routes into signup")
  : fail("the home CTA no longer routes to /signup?next=/checkin — the consent gate may have been bypassed");

// Index.tsx only takes the anonymous path under import.meta.env.DEV, which
// Vite replaces with `false` in a production build and then tree-shakes. If a
// production bundle still contains the development-only branch, that guard has
// been weakened.
js.includes("Accounts are unavailable right now")
  ? ok("production shows the auth-unavailable message rather than proceeding")
  : fail("the production fallback message is missing — check the guard in Index.tsx");

const existsHtml = existsSync(join(DIST, "index.html"));
existsHtml ? ok("dist/index.html exists") : fail("dist/index.html missing");

console.log("");
if (failures.length) {
  console.error(`${failures.length} check(s) failed. Refusing to publish this build.`);
  process.exit(1);
}
console.log("Build verified: auth is configured and the consent gate is intact.");
