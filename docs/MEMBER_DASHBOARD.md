# Member dashboard and account administration

The selected version 2 of the October 18 dashboard comparison is the live authenticated dashboard at `/dashboard`. It combines the previous Pattern Lab trends with a persistent body map, assessment scale, individual returned signs and provenance. Login always lands there. `/history` redirects there as well. The independent `/dashboard-lab/` gallery remains a labeled prototype.

The member dashboard reads authenticated `voiceHistory` responses. It orders sessions chronologically, uses the newest readable result, and filters history by date and recording source. Trend cohorts require matching source, model and returned signal coverage. Missing or inconclusive signs remain unscored. Existing records without source metadata are labeled as such. The animated artwork is decorative. The body map uses the existing report zone registry and only renders markers for regions with returned signs. Its sign rows filter the main signal list. The assessment profile and flag count reuse the full report's displayed-band grading, including per-sign overrides; provider recommended action is labeled separately. Historical records expose their saved session identifier, not an invented original job ID. Missing pathway, source and model metadata stays labeled as not recorded.

Browser recording uses the existing `/checkin` capture and results pipeline. The result persistence hook sends a stable job identifier, allowing server retries without duplicate sessions or a second free check-in charge. Save and fetch failures surface instead of becoming fake empty data.

Phone recording uses `/checkin/phone`. The browser requests `voiceHistory` with `action: startPhone` and a Firebase ID token. The server verifies an active Plus or Executive subscription, validates the phone number and explicit per-call consent, selects the user's ready calling voice if available, starts the real voice harness, and binds the provider session to the user. It does not trust a client-supplied user identity. No SMS path was added.

Pending calls live in a server-owned collection. A subsequent authenticated history read retrieves terminal results from the harness, stores the returned signs or an unscored quality failure, and marks the request saved. Closing the call page does not lose the linkage. Dashboard history refreshes every 30 seconds while visible and when the window regains focus. Phone/browser observations do not share a trend cohort. The legacy voice harness itself remains an independently deployed service.

The account page at `/account` reads and edits the current user's full name, phone number, age range and biological sex. Email is displayed as the immutable sign-in identity. Age range and sex are optional context, not claimed analysis inputs. Profile writes contain no subscription, consent or timestamp fields. Auth display-name synchronization is best effort after the Firestore profile save. Firestore rules permit only the existing profile allowlist plus a validated optional E.164 phone number. Subscription and consent restrictions are preserved.

Account and pricing upgrade controls send existing Stripe customers to their billing portal rather than creating another subscription. New paying customers use the existing authenticated Checkout function. Active subscriptions without a Stripe customer are directed to their original billing provider. No purchase is performed by visiting the page.

## Validation

TypeScript, the full Vitest suite and production Vite build must pass. `scripts/verify-build.mjs` verifies the configured authentication and recording consent entry gate. New tests cover compatible trend cohorts, missing and failed readings, profile write fields, subscription routing, server plan enforcement, ownership isolation, call recovery, quality failures and idempotent browser saves. Browser layout QA uses isolated fixtures outside committed application code. No real call or payment is initiated by automated tests.

## Deployment

Deploy the `voiceHistory` Cloud Function from `gcp-functions/voice-history`, preserving its runtime configuration and public HTTP trigger. Deploy the profile rules with `firebase deploy --only firestore:rules --project amits-playground-po`. Push application changes to `main`; the existing GitHub Pages workflow runs type checks, tests, the production build and artifact verification before publishing to www.serasona.com.
