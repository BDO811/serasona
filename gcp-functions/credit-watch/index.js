/**
 * Watches the Serasona LAM account's credit balance and emails when it runs low.
 *
 * Serasona is its own tenant (acct_Serasona_9243913e). Running it dry means
 * every voice check-in on a paid product starts failing, so this is a
 * production alarm, not a report.
 *
 * Two things a naive version of this gets wrong, and this one does not:
 *
 *   1. It re-sends forever. Once the balance is below the threshold it stays
 *      below until someone tops it up, so a plain "if low, email" fires on
 *      every single run. State is kept in Firestore and a repeat alert is held
 *      back for RE_ALERT_HOURS.
 *
 *   2. It dies silently. A monitor that stops running looks exactly like a
 *      monitor with nothing to report. Consecutive failures to read the balance
 *      raise their own alert, so a broken check is noisy rather than quiet.
 *
 * Invoked by Cloud Scheduler. Deployed without public access: the scheduler
 * authenticates with OIDC.
 */

const { Firestore } = require("@google-cloud/firestore");

const API_URL = process.env.AMPLIFIER_API_URL || "https://api.amplifierhealth.com";
const ACCOUNT_ID = process.env.AMPLIFIER_ACCOUNT_ID;
const API_KEY = process.env.AMPLIFIER_API_KEY;

const THRESHOLD = Number(process.env.CREDIT_THRESHOLD || 1000);
// What one analysis costs, measured against the live API rather than assumed.
// Only used to turn a credit count into the number that actually matters.
const CREDITS_PER_CHECKIN = Number(process.env.CREDITS_PER_CHECKIN || 75);
const RE_ALERT_HOURS = Number(process.env.RE_ALERT_HOURS || 24);
const ALERT_TO = process.env.ALERT_TO || "amit@amplifierhealth.com";

const STATE_DOC = "ops/creditWatch";

let _db = null;
const db = () => (_db ??= new Firestore({ projectId: process.env.GCP_PROJECT_ID }));

const base64url = (s) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function getGmailAccessToken() {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new Error("Gmail credentials not configured");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Failed to refresh Gmail token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function sendEmail(subject, body) {
  const accessToken = await getGmailAccessToken();
  const message = [
    `To: ${ALERT_TO}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64url(message) }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
}

async function readCredits() {
  const res = await fetch(`${API_URL}/v2/account/credits`, {
    headers: { "X-Account-ID": ACCOUNT_ID, "X-API-Key": API_KEY },
  });
  if (!res.ok) throw new Error(`credits read failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  if (typeof data.credits !== "number") throw new Error(`unexpected credits payload: ${JSON.stringify(data).slice(0, 200)}`);
  return data.credits;
}

/** How much the balance has dropped since the last run, and how long that leaves. */
function burnLine(prev, credits, prevAt) {
  if (typeof prev !== "number" || !prevAt || prev <= credits) return null;
  const hours = (Date.now() - prevAt) / 3_600_000;
  if (hours < 0.5) return null;
  const perDay = ((prev - credits) / hours) * 24;
  if (perDay <= 0) return null;
  const days = credits / perDay;
  return `Burn rate: about ${Math.round(perDay)} credits/day, which is roughly ${
    days < 1 ? "under a day" : `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`
  } left at that pace.`;
}

exports.creditWatch = async (req, res) => {
  if (!ACCOUNT_ID || !API_KEY) {
    console.error("[credit-watch] credentials not configured");
    res.status(500).json({ error: "Not configured." });
    return;
  }

  const ref = db().doc(STATE_DOC);
  const snap = await ref.get();
  const state = snap.exists ? snap.data() : {};
  const now = Date.now();

  let credits;
  try {
    credits = await readCredits();
  } catch (err) {
    // A failed read is only interesting once it persists. One blip is noise;
    // several in a row means the alarm itself is down.
    const failures = (state.consecutiveFailures || 0) + 1;
    const lastFailAlert = state.lastFailureAlertAt || 0;
    console.error(`[credit-watch] read failed (${failures} in a row):`, err.message);

    if (failures >= 3 && now - lastFailAlert > RE_ALERT_HOURS * 3_600_000) {
      await sendEmail(
        "Serasona credit check is failing",
        [
          `The Serasona credit check has failed ${failures} times in a row.`,
          "",
          `Account: ${ACCOUNT_ID}`,
          `Last error: ${err.message}`,
          "",
          "Until this clears, the low-credit alert is not watching anything.",
        ].join("\n")
      );
      await ref.set({ ...state, consecutiveFailures: failures, lastFailureAlertAt: now }, { merge: true });
    } else {
      await ref.set({ ...state, consecutiveFailures: failures }, { merge: true });
    }
    res.status(502).json({ ok: false, error: err.message });
    return;
  }

  const checkins = Math.floor(credits / CREDITS_PER_CHECKIN);
  const low = credits <= THRESHOLD;
  const lastAlertAt = state.lastAlertAt || 0;
  const dueForRepeat = now - lastAlertAt > RE_ALERT_HOURS * 3_600_000;
  let emailed = false;

  if (low && (!state.alerting || dueForRepeat)) {
    const burn = burnLine(state.credits, credits, state.checkedAt);
    await sendEmail(
      `Serasona credits low: ${credits.toLocaleString()} left`,
      [
        `The Serasona LAM account is down to ${credits.toLocaleString()} credits, at or below the ${THRESHOLD.toLocaleString()} alert threshold.`,
        "",
        `That is about ${checkins} more voice check-in${checkins === 1 ? "" : "s"} at ${CREDITS_PER_CHECKIN} credits each.`,
        burn ? "" : null,
        burn,
        "",
        `Account: ${ACCOUNT_ID}`,
        "",
        "When this runs out, every voice check-in on serasona.com starts failing.",
      ]
        .filter((l) => l !== null)
        .join("\n")
    );
    emailed = true;
    console.log(`[credit-watch] alerted at ${credits} credits`);
  }

  if (!low && state.alerting) {
    // Topped up. Clear the latch so the next dip alerts immediately rather
    // than waiting out the repeat window.
    console.log(`[credit-watch] recovered to ${credits} credits`);
  }

  await ref.set(
    {
      credits,
      checkins,
      checkedAt: now,
      alerting: low,
      lastAlertAt: emailed ? now : lastAlertAt,
      consecutiveFailures: 0,
      threshold: THRESHOLD,
    },
    { merge: true }
  );

  res.status(200).json({ ok: true, credits, checkins, threshold: THRESHOLD, low, emailed });
};
