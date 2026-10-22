# Serasona for iOS and Apple Watch

A native SwiftUI client for the existing Serasona backend (the Cloud Functions
and Firebase project already live under `gcp-functions/` at the repo root —
this app calls the same endpoints the web app at serasona.com calls, with the
same auth). Built from scratch in this PR: no prior iOS/watchOS code existed
anywhere in the BDO811 GitHub account before this.

## What's here

```
ios/
  project.yml                  XcodeGen spec — the source of truth for the project
  Serasona.xcodeproj           generated from project.yml, checked in so it opens in Xcode directly
  Packages/SerasonaKit/        shared Swift package: models, auth, networking, scoring (24 unit tests, all passing)
  Serasona/Sources/            iOS app (SwiftUI): sign in/up, record a check-in, see results, history, account
  SerasonaWatch/Sources/       watchOS companion app: standalone sign-in + a one-button check-in
  Shared/Sources/              code used by both app targets (audio recording, Keychain session storage, session manager)
```

### What the app does

- **Sign up / sign in** against the same Firebase project the web app uses
  (`amits-playground-po`), via the Identity Toolkit REST API directly rather
  than the full firebase-ios-sdk — keeps the dependency graph small and keeps
  `SerasonaKit` buildable and testable on Linux.
- **Record a check-in** (up to 90s of AAC/M4A audio) and upload it to the
  `analyzeAudio` Cloud Function with the same model allow-list
  (`pulse`/`clarity`/`haven`/`tide`/`aria`/`breath`/`harbor`/`apex`) and the
  same bearer-token auth the web app uses.
- **Show the result**: recommended action, the seven headline metrics (ported
  from `src/lib/voice-checkin-client.ts`), and per-signal bands (ported from
  `src/lib/signal-band.ts`, including both documented overrides —
  `head-impact`/`elevated-blood-pressure` flagging only at ELEVATED, and the
  percentile-bucketed `cardiovascular-strain`/`cognitive-load` signals).
  Both ports have unit tests asserting they match the web logic.
- **History**: lists past check-ins from the `voiceHistory` Cloud Function.
- **Watch app**: a standalone one-button check-in on the wrist. It signs in
  independently (its own Keychain entry) rather than inheriting the phone's
  session via WatchConnectivity — the simpler, more reliable choice for a
  first cut; sharing the session automatically would be a reasonable follow-up.

### What's genuinely validated vs. what Xcode will need to confirm

This container is Linux with no Xcode, so there is a hard ceiling on what
could be checked here. What was actually done, not just written:

- `Packages/SerasonaKit` **builds and its 24 tests pass** on this machine —
  `cd ios/Packages/SerasonaKit && swift build && swift test`. That's the
  entire auth client, the analyze-audio client (multipart body, headers,
  error handling), the history client, and the signal-banding/metric-scoring
  logic that was ported from the TypeScript source.
- `ios/project.yml` **actually generates** a structurally valid
  `Serasona.xcodeproj` — two targets, the local SwiftPM package wired as a
  dependency of both, and a working "Embed Watch Content" build phase — via
  XcodeGen built from source on this machine (`xcodegen generate`).
- Every SwiftUI/AVFoundation/Keychain source file **parses cleanly**
  (`swift -frontend -parse`, syntax-only — no SDK needed).
- What this does **not** confirm: that the SwiftUI/AVFoundation/Security APIs
  type-check against the real iOS/watchOS SDKs, because those SDKs are
  Apple-proprietary and cannot legally be obtained or redistributed outside
  Xcode on macOS. The first `⌘B` in Xcode is the real compile; if anything in
  the app-layer code needs a small fix (an API that needs a slightly later
  OS version, for instance — `AVAudioSession.requestRecordPermission` was
  deliberately used over its iOS/watchOS 17+ replacement for this reason),
  Xcode's own diagnostics will point at the exact line.

### To open and run it

1. On a Mac, with Xcode 15+ installed: open `ios/Serasona.xcodeproj` directly
   (it's checked in — no `xcodegen generate` needed unless you change
   `project.yml`, in which case: `brew install xcodegen && xcodegen generate`).
2. Set your own Team under both targets' Signing & Capabilities (automatic
   signing is fine for simulator/device testing).
3. Build and run `Serasona` on an iPhone simulator; the watch app runs via the
   paired Watch simulator.

### What's still needed from you before this can ship to the App Store / Watch App Store

This is the one part no agent can do for you, on Linux or otherwise:

1. **An active Apple Developer Program membership** ($99/yr) tied to your own
   Apple ID.
2. **An App Store Connect record** for the app: register the bundle IDs
   (`com.amplifierhealth.serasona` and the watch app's
   `com.amplifierhealth.serasona.watchkitapp`) in your Apple Developer
   account, create the app in App Store Connect, fill in pricing, privacy
   nutrition labels, screenshots, and the export-compliance questionnaire.
3. **Signing**: either open the project in Xcode on a Mac and let Automatic
   Signing provision it against your team, or, if you want to keep doing this
   from Linux, set up `xtool` (xtool.dev) — it still needs your own Xcode.xip
   (downloaded from developer.apple.com with your Apple ID) to build an SDK
   bundle, since Apple's SDK cannot be redistributed. There's no way around
   providing that yourself; it's an Apple licensing restriction, not a tooling
   gap.
4. **Upload**: once signed, `xcrun altool`/`xcrun notarytool` (from Xcode) or
   an App Store Connect API key (`.p8` + Issuer ID + Key ID, generated in App
   Store Connect under Users and Access → Keys) can drive the actual upload
   and submission for review non-interactively. Either way, review itself is
   Apple's human process and can take anywhere from hours to a few days, and
   they can come back with questions only you can answer as the account
   holder.

None of the above can be substituted with more engineering — it's Apple's
account/credential/payment model, not a build problem.

## API surface this app relies on (unchanged, already live)

| Endpoint | Used for |
|---|---|
| `identitytoolkit.googleapis.com/v1/accounts:signUp` / `:signInWithPassword` | sign up / sign in |
| `securetoken.googleapis.com/v1/token` | refreshing the ID token |
| `https://us-central1-amits-playground-po.cloudfunctions.net/analyzeAudio` | upload + analyze a check-in |
| `https://us-central1-amits-playground-po.cloudfunctions.net/voiceHistory` | read/write check-in history |

The Firebase web API key embedded in `SerasonaEndpoints` is the same one
already public in the deployed serasona.com JS bundle — Firebase's own docs
are explicit that this key identifies the project only and is not a secret
(access is enforced server-side, by the Cloud Functions verifying the bearer
token). Nothing new was exposed in shipping it here.
