const crypto = require("node:crypto");

/**
 * TOTP (RFC 6238) for admin second-factor.
 *
 * Implemented here rather than switching on Firebase's own MFA for two reasons:
 * Firebase TOTP needs Identity Platform (currently DISABLED on this project, and
 * a billing change to turn on), and more importantly it secures *sign-in*, while
 * what this panel needs is a short-lived ELEVATION — proving possession again
 * before a destructive action, separately from being logged in all day.
 *
 * Nothing here is novel crypto: HMAC-SHA1 over a counter, which is what every
 * authenticator app implements.
 */

const STEP_SECONDS = 30;
const DIGITS = 6;
// One step either side. Enough for clock drift, small enough that a shoulder-
// surfed code is stale almost immediately.
const SKEW_STEPS = 1;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = str.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 in TOTP secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160 bits, which is what RFC 4226 recommends and what authenticator apps expect. */
function generateSecret() {
  return base32Encode(crypto.randomBytes(20));
}

function codeForCounter(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const bin =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

/**
 * Verify a code. Compares in constant time and checks a small window, then
 * returns the counter it matched so the caller can refuse a replay of the same
 * code inside its own validity window.
 */
function verify(secretBase32, code, { lastUsedCounter = -1 } = {}) {
  const cleaned = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(cleaned)) return { ok: false, reason: "malformed" };

  const now = Math.floor(Date.now() / 1000 / STEP_SECONDS);
  for (let drift = -SKEW_STEPS; drift <= SKEW_STEPS; drift++) {
    const counter = now + drift;
    const expected = codeForCounter(secretBase32, counter);
    const a = Buffer.from(expected);
    const b = Buffer.from(cleaned);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      // A code stays valid for a whole step. Without this, an attacker who
      // observes one code can reuse it until the step rolls over.
      if (counter <= lastUsedCounter) return { ok: false, reason: "replayed" };
      return { ok: true, counter };
    }
  }
  return { ok: false, reason: "invalid" };
}

/** The URI an authenticator app scans. The secret never leaves the server except here, once, at enrollment. */
function otpauthUri({ secret, account, issuer = "Serasona Admin" }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

module.exports = { generateSecret, verify, otpauthUri, STEP_SECONDS, DIGITS };
