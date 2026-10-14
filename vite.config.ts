import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Firebase config the signed-in experience cannot work without.
 *
 * These are the three `isFirebaseConfigured` checks for. They are public
 * client config rather than secrets, but their ABSENCE is what matters: with
 * them missing the app has no auth, and the consent gate in front of voice
 * recording has nothing to stand on.
 */
const REQUIRED_FIREBASE_ENV = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
] as const;

/**
 * Refuses to produce a production build without Firebase configured.
 *
 * Serasona records voice, which is biometric data. The account is where the
 * Terms acceptance and the explicit recording consent are captured and
 * versioned, so a build with no auth is a build whose consent gate cannot
 * function. Previously that shipped quietly and degraded to an anonymous
 * flow; the only safe failure for a missing secret is a failed build.
 *
 * This lives in the Vite config rather than an npm prebuild script on
 * purpose: a prebuild hook is skipped by anyone running `vite build`
 * directly, and CI invoking the binary rather than the script is exactly how
 * a guard like this gets quietly bypassed.
 */
const requireFirebaseConfig = (mode: string): Plugin => ({
  name: "serasona:require-firebase-config",
  apply: "build",
  config(_config, { command }) {
    if (command !== "build" || mode === "development") return;

    const env = loadEnv(mode, process.cwd(), "");
    const missing = REQUIRED_FIREBASE_ENV.filter((k) => !env[k] && !process.env[k]);
    if (missing.length === 0) return;

    throw new Error(
      [
        "",
        "Refusing to build: Firebase is not configured.",
        "",
        `  Missing: ${missing.join(", ")}`,
        "",
        "  Serasona records voice, and the account is where Terms acceptance and",
        "  recording consent are captured. A build without auth cannot enforce that",
        "  gate, so this fails the build rather than shipping a site that collects",
        "  voice without consent on file.",
        "",
        "  In CI these come from repository secrets (see .github/workflows/deploy.yml).",
        "  Locally, put them in .env. To build the marketing shell without auth on",
        "  purpose, build with --mode development.",
        "",
      ].join("\n")
    );
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Where the built app will be served from. Defaults to the domain root
  // (tryserasona.com, via public/CNAME). Set VITE_BASE_PATH if this ever needs to
  // build for a project-page subpath instead, e.g. while a custom domain's DNS
  // is still pending.
  base: process.env.VITE_BASE_PATH || "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    requireFirebaseConfig(mode),
    react(),
    mode === "development" && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
