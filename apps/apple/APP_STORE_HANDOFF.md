# Serasona iOS: App Store handoff

Historical handoff. Current source locations, decisions, verification, and release blockers are recorded in `../../SERASONA_MASTER.md`. The original pricing and phone-to-Watch App Group assumptions below are superseded.

Written 2026-10-30. Everything needed to pick this up on another Mac.

## Where the code is

Repo `https://github.com/BDO811/claude-outputs.git`, project at `Serasona_iOS/` inside it.
An auto-sync job commits this repo every few minutes, so the work is already pushed. The
App Store commit message is `Serasona iOS: privacy manifest and in-app account deletion for
App Store submission` (`7dfa6578`); the files themselves landed in the auto-sync commits
immediately around it (`fa0e4474` and later), so pull `main` rather than cherry-picking.

## Setting up a second Mac

1. Xcode 15 or later, with the iOS 17 and watchOS 10 simulator runtimes installed.
2. `brew install xcodegen`.
3. `cd Serasona_iOS && ./regenerate.sh`. That runs `xcodegen generate` and then re-applies the
   StoreKit configuration file to the Serasona scheme, which xcodegen cannot express and wipes
   on every regen. Never run `xcodegen generate` on its own.
4. Open `Serasona.xcodeproj`. Firebase resolves over SPM on first open.
5. `GoogleService-Info.plist` points at the live Firebase project `amits-playground-po`. It is
   in the repo, so nothing extra is needed.

Four targets, all built from `Shared/`: `Serasona` (iOS), `SerasonaWatch`, `SerasonaComplication`,
`SerasonaWidget`. App Group `group.com.serasona.app` ties them together.

## What was done for the App Store

### 1. Privacy manifest

`Shared/PrivacyInfo.xcprivacy`. Apple requires one per bundle, and because `Shared/` compiles into
all four targets, one file lands in all four. Verified in the built product at the app root,
`Watch/SerasonaWatch.app`, `PlugIns/SerasonaWidget.appex`, and the complication inside the watch app.

Without it, App Store Connect rejects the upload with ITMS-91053.

It declares:

- `NSPrivacyTracking` false, no tracking domains.
- One required-reason API entry, `NSPrivacyAccessedAPICategoryUserDefaults`, with both reasons that
  are actually true in the code: `CA92.1` for the standard suite (`SerasonaIdentity`,
  `CheckInReminders`) and `1C8F.1` for the App Group suite the watch and widget read
  (`SharedStore`, `AuthTokenCache`).
- Five collected data types: email address, user ID, audio data, health, purchase history. All
  marked linked to the user, none for tracking, all purpose `AppFunctionality`.

### 2. In-app account deletion

App Store Guideline 5.1.1(v) requires it for any app that lets someone create an account.

`Serasona/Features/Settings/DeleteAccountView.swift`, reached from a new "Delete account" row in
Settings below Log out. Two steps: confirm the password, then a plain "This cannot be undone"
screen. Nothing is deleted until the second screen is confirmed.

The password is asked for again rather than carried from the session because Firebase refuses
`user.delete()` without a recent sign-in.

`FirebaseAuthService.deleteAccount(password:)` runs in this order, and the order matters:

1. Reauthenticate with `EmailAuthProvider.credential`.
2. `SerasonaAPI.deleteHistory()`, erasing the server-side readings.
3. Delete the `users/{uid}` Firestore document.
4. Delete the Firebase auth user.
5. Clear `AuthTokenCache`, `SharedStore` (so the watch face stops showing a band for an account
   that no longer exists), `CheckInReminders`, and `SerasonaIdentity.email`.

Steps 2 and 3 have to happen before step 4, because once the auth user is gone there is no token
left to authorize either call.

Supporting additions: `SerasonaAPI.deleteHistory()` in `Shared/SerasonaAPI.swift` and
`SharedStore.clear()` in `Shared/SharedStore.swift`.

### 3. Signing

`project.yml` sets `DEVELOPMENT_TEAM: "JC874B66JG"`, taken from the only code-signing identity on
the machine this was built on (`Apple Development: Tima Athem`). See open item 1 below.

### Verification done

Both schemes built clean (`** BUILD SUCCEEDED **`, exit 0). Both delete-account steps were driven
in the simulator and screenshotted. The manifest was confirmed present in all four built bundles
with `find`.

## Open items, in priority order

### 1. Confirm the team ID

`JC874B66JG` is the team on the build machine, registered to a different name. If Serasona enrolled
under a different Apple Developer team, change that one line in `project.yml` and run
`./regenerate.sh`. Find the right value with:

```bash
security find-identity -v -p codesigning
```

The `OU=` field in the certificate is the Team ID.

### 2. Add a DELETE handler to the voiceHistory Cloud Function

This is the real blocker. The `voiceHistory` function has no DELETE method, so
`SerasonaAPI.deleteHistory()` gets a 404 or 405 back. It treats that as "unsupported" and lets the
account deletion proceed rather than blocking it, but until the handler exists the saved readings
outlive the deleted account, which is the part App Review actually checks.

The function lives in the `Serasona_App` project under `gcp-functions/voice-history`. It needs to
accept `DELETE` with a Bearer ID token and an `email` query parameter, and delete that user's rows.

### 3. Decide on the Health data type

`NSPrivacyCollectedDataTypeHealth` is declared in the manifest and feeds the public App Store
nutrition label. Apple's definition covers user-provided health data and voice-derived stress and
fatigue readings fit it. If that cuts against the wellness-not-medical positioning, swap it for
`NSPrivacyCollectedDataTypeOtherDataTypes`. One line in `Shared/PrivacyInfo.xcprivacy`.

### 4. Decide whether the DEBUG harness stays

`Serasona/App/UIHarness.swift` renders single screens with synthetic data without signing in,
launched with `-serasona.uiHarness <screen>` where screen is `capture`, `result`, `settings`, or
`delete`. It is inside `#if DEBUG`, so it compiles out of Release entirely and there is no path
around the sign-in gate in anything that ships. Keeping it is safe and it is the only way to review
screens without touching the live Firebase project.

## What is left in App Store Connect

All browser work, none of it code.

1. Register four bundle IDs: `com.serasona.app`, `.watchkitapp`, `.watchkitapp.complication`,
   `.widget`. Plus the app group `group.com.serasona.app`.
2. Create the app record.
3. Create three auto-renewable subscriptions in one group:
   - `com.serasona.app.core.monthly`, $29/month
   - `com.serasona.app.plus.monthly`, $49/month
   - `com.serasona.app.executive.monthly`, $149/month

   The local `Serasona/StoreKit/Products.storekit` has the group as "Serasona Plans"
   (id `20261013001`) but sets no display name on any of the three, so pick those in App Store
   Connect and mirror them back into the local file.
4. Privacy policy URL. Required, and submission is blocked without it.
5. Privacy nutrition label, matching the five types in the manifest.
6. Screenshots: 6.9 inch and 6.5 inch for iPhone, plus a separate watch set.
7. Archive, upload, TestFlight, submit.

`MARKETING_VERSION` is 1.0 and `CURRENT_PROJECT_VERSION` is 1 in `project.yml`.
`ITSAppUsesNonExemptEncryption` is already false, so there is no export compliance questionnaire
on each upload.

## Unrelated open threads on this project

Carried over, not blocking submission:

- Whether OPTIMAL should go back to gold instead of hydration-blue.
- The ported question copy from serasona.com contains an em dash, which matches the site verbatim
  but conflicts with the no-dashes writing rule.
- Watch app glance text cuts off mid-sentence on 46mm, and the mood word renders forest green.
