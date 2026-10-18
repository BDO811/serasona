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

## October 18 account voice and dashboard refinements

The dashboard has one blue acquisition card at the top. Its voice and phone links use the existing authenticated flows. Subscription controls remain exclusively in the member Account page. The physiologic analysis uses the shared report SignalPanel: dark rows with every band visible and the returned band selected. Dashboard colors use blue for normal, without changing signal grading.

The Account calling-voice controls adapt BDO811/myabuela's VoicePicker and family recording flow. Female and male MP3 samples and the two existing Telnyx library voice IDs come from that repository. `cloneVoice` accepts authenticated selectVoice and refreshVoice actions; the saved choice is written only by the backend to the current user's voiceClones document. `voiceHistory` reads this saved choice before placing a phone call. Existing ready personal voices remain selected when no explicit selection exists.

Personal recordings use Minimax through Telnyx's voice_clones/from_upload endpoint, not a separately configured Minimax service. The actual provider/model/voice ID returned by Telnyx is preserved for outbound calls. Recording requires explicit consent, at least 60 seconds, a suggested 2 to 3 minute reading and a 180 second automatic stop. Browser and server validate mono 24kHz PCM WAV audio, audible content and clipping. Provider pending states can be rechecked from Account, and unready personal voices cannot be selected or silently substituted. No personal sample or outbound call was created during implementation verification.

## Results-first layout and ten-measurement trend preview

The full-width YOUR SERASONA SCORE banner now leads the dashboard and reads the existing real composite. Its method button retains the plan matrix, contribution breakdown, measurement references and longitudinal baseline context. The single blue recording card follows. The body map and physiologic analysis are adjacent immediately beneath it; Stress, Wellness and Clarity index cards follow that pair. Desktop and 615px layouts keep the two result panels adjacent; small phones stack them in reading order.

The trend chart defaults to an explicitly labeled ten-measurement sample preview at the user's request. Stress is purple, Wellness coral and Clarity blue. Each series has a dated dot and a dotted connecting line. Samples exist only in the view layer and are never written to voice history, included in the score, or used in the body map. My results switches to the last ten real comparable readings, keeping missing groups null. Saved history tables and source/model/coverage/version cohort rules stay real in both chart modes.
