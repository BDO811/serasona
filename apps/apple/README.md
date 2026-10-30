# Serasona — iOS + watchOS (native Swift)

Current working instructions and verification status are in `../../SERASONA_MASTER.md` at the repository root. This is the active native project in the consolidated checkout `/Users/amitmehta/Downloads/Serasona`.

The notes below describe earlier work. In particular, Watch authentication now uses an independent Keychain-backed Firebase session, current monthly prices are $7.99/$14.99/$19.99, and the current backend offers three free check-ins per day. Do not rely on the older authentication, pricing, or release-status descriptions below.

Native Swift/SwiftUI build, with a watchOS companion that does a glance + quick check-in rather
than attempting Soma Health's ambient-capture model (which doesn't port to iOS/watchOS anyway —
see "Why not copy Soma" below).

## What's here

- **Serasona** (iOS app) — email+password sign-up/log-in (Firebase Auth, same project as the web
  app), a check-in flow (record → upload → analyze → result), a result screen with a
  Clear/Watch/Strained dial and a per-signal breakdown, written recommendations, history with a
  30-day baseline trend chart, check-in reminder notifications, a StoreKit paywall, and settings.
- **SerasonaWatch** (watchOS companion) — a glance at the latest result, and its own short
  check-in recorded on the Watch mic, independent of the phone being nearby. Has no Firebase
  session of its own — see "Auth" below.
- **SerasonaComplication** — a WidgetKit complication (circular / rectangular / inline) showing
  the latest Clear/Watch/Strained state on the watch face.
- **SerasonaWidget** — the iOS counterpart: a home-screen widget (small / medium) and iOS
  lock-screen accessory families, reading the same shared `SharedStore` state the watch
  complication reads. Embedded into the Serasona app target.
- **Shared/** — compiled into all four targets: design tokens, typography, the exact
  `signal-band.ts` banding logic ported to Swift, API models, the audio recorder, check-in
  reminder scheduling (`CheckInReminders`), and the networking layer against the real
  `analyzeAudio` / `voiceHistory` / `recommendations` / `appleIapVerify` Cloud Functions
  `Serasona_App` already runs in production.

## History trend view

`HistoryTrendView` (Serasona/Features/History/) sits above the check-in list once there are 3+
check-ins in the last 30 days — the "becomes your own 30-day baseline" line from onboarding, made
real. An overall Clear/Watch/Strained line (Swift Charts `LineMark`/`PointMark`, colored per
state) plus a per-signal score trend for whichever signal the picker selects, both reading
straight off the `checkIns` array `HistoryView` already fetches — no new network calls.

## Check-in reminders

`CheckInReminders` (Shared/) schedules local notifications Mon/Wed/Fri at a user-chosen time
(Settings → Reminders), matching onboarding's "a short voice check-in, a few times a week" copy.
Requests notification permission on first enable; declines leave the toggle off with an inline
message rather than silently failing. Purely local (`UNCalendarNotificationTrigger`) — no push
infrastructure, no server round trip.

## iOS home screen + lock screen widget

`SerasonaWidget` is structured identically to `SerasonaComplication`: same `TimelineProvider`
reading `SharedStore`, same never-refresh timeline policy, same shared App Group. It adds
`.systemSmall`/`.systemMedium` home-screen families on top of the `.accessoryCircular`/
`.accessoryRectangular`/`.accessoryInline` lock-screen families the complication already covers.
Unlike the complication, it bundles and registers its own copy of the four font families (see
`Fonts.swift`'s `SerasonaFontRegistrar`) since the home-screen families are a more prominent brand
surface than a watch-face glance — the lock-screen accessory views still use plain system fonts,
matching the complication's own choice there.

Every color, font, spacing and radius value is pulled straight from
`/Users/amitmehta/Claude-Outputs/serasona-design-system/tokens.json` — not re-approximated.

## Why not copy Soma Health

Soma (`soma-health.co`, app: "Soma: Know Your Mind") has **no Apple Watch app** — their
developer account ships exactly one app, iPhone-only. What reads as "it listens to my Zoom
calls" is a **macOS-only** system-audio tap in their desktop app (captures the Mac's own
speaker output), which has no iOS/watchOS equivalent — neither platform allows ambient
background mic/system-audio capture across other apps. There's no Zoom/Teams/Slack plugin
anywhere in their stack; their only real integration is Google Calendar OAuth plus reading
Apple Health (which is how Watch-sourced vitals reach them, indirectly). So this build doesn't
attempt that architecture — it extends Serasona's existing active check-in model instead, with
a Watch glance + quick check-in as the watch-native addition Soma never shipped.

## Auth

`analyzeAudio` has no anonymous path at all (it spends real model credits) and `voiceHistory`'s
anonymous mode is the original public try-it demo, not the real signed-in product — so the app
needs a real Firebase account, same project as `serasona.com`:

- `FirebaseAuthService` (Serasona/App/) wraps Firebase Auth: sign-up, log-in, log-out, and a live
  Firestore listener on `users/{uid}` that mirrors the web's `AuthContext.tsx` subscription state.
- Every gated `SerasonaAPI` call attaches `Authorization: Bearer <idToken>`, via the
  `SerasonaAuthTokenProviding` protocol in `Shared/SerasonaAPI.swift`.
- **The watch has no Firebase session of its own** — Firebase Auth isn't something to trust
  running standalone on watchOS yet. Instead the phone writes its current ID token into the
  shared App Group (`AuthTokenCache`) every time it refreshes one, and the watch reads that
  cached copy. If the phone hasn't been opened in over an hour (tokens expire in 60 minutes) and
  refreshed its token, the watch's own check-in will fail with "Sign in on your phone, then try
  again" until it has been.

## Billing (StoreKit, free-tier paywall)

The backend caps a free account at **one check-in ever** (`FREE_CHECKIN_LIMIT = 1` in
`voice-history`) unless `users/{uid}.subscription` shows an active paid plan. Two independent
things write that same field: `stripe-webhook` for web checkout, and `appleIapVerify` (new) for
StoreKit purchases here — same shape, so every entitlement check in `analyze-audio` and
`voice-history` works unchanged regardless of which store a person paid through.

- `Serasona/StoreKit/Products.storekit` — three auto-renewable subscriptions (`core` $29/mo,
  `plus` $49/mo, `executive` $149/mo), one group, matching the web pricing page and
  `docs/SETUP_BILLING.md` exactly.
- `StoreManager` (Features/Paywall/) — StoreKit 2: loads products, runs a purchase, listens for
  `Transaction.updates` (renewals, restores), and redeems whatever comes back against
  `appleIapVerify`.
- `PaywallView` — shown automatically when `voiceHistory` returns the free-limit 402
  (`SerasonaAPIError.freeCheckInUsed`), and on demand from Settings → Upgrade plan.
- **To test purchases in the simulator**, the Serasona scheme already points at
  `Products.storekit` (Xcode → Product → Scheme → Edit Scheme → Run → Options → StoreKit
  Configuration, pre-filled). Just build and run from Xcode directly — purchases complete
  instantly with no App Store Connect account needed. **This does not work via a headless
  `simctl launch`**: local StoreKit testing is injected by Xcode's own debug session, not by the
  simulator process itself, so a purchase only works when Xcode is the one launching the app.
- `apple-iap-verify` verifies the signed transaction against Apple's own public root certificate
  (`@apple/app-store-server-library`, `Environment.XCODE`/`SANDBOX` today) — no App Store Connect
  credentials needed for that part. **Production verification needs one more thing**: the app's
  numeric App Store Connect ID, set as `APPLE_APP_APPLE_ID` on the function, once this app
  actually exists there (it doesn't yet — no Apple Developer Program team is enrolled, see
  below). Until then, real purchases from the live App Store can't be verified, only
  Xcode-local and Sandbox ones.
- `regenerate.sh` **replaces** `xcodegen generate` going forward — xcodegen has no declarative
  key for a scheme's StoreKit Configuration, so a plain `xcodegen generate` silently drops it.
  `regenerate.sh` runs `xcodegen generate` then `patch_storekit_scheme.py` to put it back.

## What you need to do before this ships to a real device

1. **Enroll in the Apple Developer Program** (needed for the App Group entitlement, a real
   device, TestFlight, the App Store, and real StoreKit products) and set `DEVELOPMENT_TEAM` in
   `project.yml` once you have a team ID, then re-run `./regenerate.sh`.
2. **Register the bundle IDs and App Group** in the Apple Developer portal:
   `com.serasona.app`, `com.serasona.app.watchkitapp`,
   `com.serasona.app.watchkitapp.complication`, and App Group `group.com.serasona.app`.
3. **Create the three subscription products in App Store Connect** once the app exists there,
   matching the product ids in `Products.storekit` exactly (`com.serasona.app.core.monthly` /
   `.plus.monthly` / `.executive.monthly`), and set `APPLE_APP_APPLE_ID` on `apple-iap-verify`.
4. Open `Serasona.xcodeproj` and build.

## What's verified, and what isn't

Both targets build clean against the real SDKs (`xcodebuild ... BUILD SUCCEEDED`, both as a real
simulator run and as a generic-destination compile check). The onboarding → sign-up → check-in →
save path was verified for real against the live Firebase project and Cloud Functions (not just
compiled): a disposable test account was created via the Firebase Auth REST API, used to call
the live `analyzeAudio` and `voiceHistory` endpoints with the same header shape this Swift code
sends, got back a real completed job and a saved session, then the test account was deleted.

**Not verified**: an actual StoreKit purchase completing end to end. That needs Xcode's own
debug session (see "Billing" above) — a `simctl launch` can't exercise it, and this environment
has no attachable Xcode/Simulator GUI, only headless `simctl`. The `apple-iap-verify` function's
JWS verification logic was sanity-checked locally (module loads, `SignedDataVerifier` constructs
against the bundled Apple root cert) but not against a real signed transaction. Please run an
actual purchase from Xcode against `Products.storekit` and flag anything that doesn't work — the
most likely failure point is the exact shape of `Transaction.jwsRepresentation` versus what
`apple-iap-verify` expects, since that's the one part no amount of static checking catches.

Also not verified on a simulator this round (the host's simulator runtimes kept disappearing —
shared-machine churn from other concurrent sessions, not a problem with the app): the sign-up
screen, settings, and paywall UI rendering. They're code-reviewed and type-check correctly but
weren't screenshotted after the StoreKit changes landed.

### 2026-10-15 round: history trend, reminders, iOS widget

`SerasonaWidget` (new target), `HistoryTrendView`, and `CheckInReminders` were added this round.
`xcodebuild ... BUILD SUCCEEDED` for both the `Serasona` scheme (which embeds `SerasonaWatch.app`
and `SerasonaWidget.appex`) and the standalone `SerasonaWatch` scheme, against a generic simulator
destination — no compiler warnings in any new or touched file. **Not verified**: actually running
any of it. This host had zero simulator runtimes installed (`xcrun simctl list runtimes` returned
empty — not the "kept disappearing" churn noted above, just none present) and only ~10GB free
disk, the same disk that ran out of space earlier this session; downloading an iOS Simulator
runtime (several GB) to boot one felt like the wrong call to make without flagging it first. So:
the widget's timeline/background-family switch, the reminder scheduling math, and the trend
chart's date-axis/picker logic are untested beyond type-checking and manual reasoning. Before
relying on these, install a simulator runtime (`xcodebuild -downloadPlatform iOS`, once disk space
is confirmed) and actually look at all three.
