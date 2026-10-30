# Serasona · master working file

Updated October 30, 2026. This is the single entry point for the iPhone and Apple Watch build.

## Master chat

Continue all Serasona app work in the pinned Codex chat **Serasona · Master iPhone and Watch Build**, ID `01a18dda-6710-7952-8e54-cd2abb2bbd19`. Amit clarified that consolidation means one master chat and one folder containing the project, rather than merging source code into a single file.

Historical chats remain separate records. Amit explicitly instructed this chat to ignore the three Claude chats and proceed from the GitHub repositories and the decisions made here. Retrieving those chats is not required and is not a blocker. Previously recovered code and the supplied handoff remain background source material.

Two prior Codex chats were recovered:

1. **Fix Serasona audio intake**, ID `01a1831f-fc3d-7522-8ecf-0d478dc31c01`. Reported fixes for the recording loop caused by a history refresh, the Clarity Index, motion playback, and missing-account signup guidance. Its final messages report deployment to the main repository. Those reports are historical evidence, not new runtime verification in this chat.
2. **Fix phantom voice pattern history**, ID `01a18359-a318-7753-9cb6-69e8a194bf94`. Removed invented history for new accounts, changed unflagged dehydration, mood disruption, and anxiety labels to NONE, removed duplicate findings, and added the referenced score explanation at `/docs/serasona-score`. Its final message reports 325 passing tests and deployment, with the final account-specific browser check limited by a different active account.

## Approved scope

The product name is Serasona. Build toward TestFlight. Keep the existing voice check-ins, results, recommendations, history and baseline trends, reminders, subscriptions, iPhone widgets, and Watch complications. Keep the existing Serasona design and remove green. The Watch must record and authenticate independently of the iPhone, with saved uploads when it lacks connectivity.

Use the prices and existing legal pages published on serasona.com. Apple sign-in and developer membership are verified. The team is Tima Athem, `JC874B66JG`; Amit is an administrator. Email sends require Amit's approval of the exact recipients, subject, full body, and attachments.

## One working checkout

Canonical working directory: `/Users/amitmehta/Downloads/Serasona`.

Repository: https://github.com/BDO811/serasona

Working branch: `codex/serasona-testflight`.

The checkout starts from main commit `12f05a2`, fetched October 30. It includes the current website, backend functions, and the initial native app implementation. The richer four-target native implementation was imported from the local Git history of https://github.com/BDO811/claude-outputs at `Serasona_iOS/`, including the work started during this chat.

## Code map

| Area | Location in this checkout | Role |
| --- | --- | --- |
| Active native app | `apps/apple/Serasona.xcodeproj` | Open this Xcode project for the full iPhone, Watch, widget, and complication build |
| Native project specification | `apps/apple/project.yml` | Source of truth for target generation |
| iPhone | `apps/apple/Serasona/` | Existing SwiftUI app and StoreKit subscriptions |
| Watch | `apps/apple/SerasonaWatch/` | Independent authentication, recording, and durable upload queue |
| Shared native code | `apps/apple/Shared/` | Models, API client, design tokens, result storage, and legal URLs |
| Widgets | `apps/apple/SerasonaWidget/`, `apps/apple/SerasonaComplication/` | iPhone widgets and Watch complications |
| Earlier native starter | `ios/` | Retained initial implementation and its tested SerasonaKit package; not the active app project |
| Earlier Claude Swift starter | `reference/claude-swift-starter/` | Preserved source imported from the Claude outputs repository |
| Earlier Claude iPhone starter | `reference/claude-ios-starter/` | Preserved the other local native starter's source and project files |
| Website | `src/`, `public/` | Current Serasona website |
| Backend | `gcp-functions/` | Current shared production service source |
| History and deletion | `gcp-functions/voice-history/` | Check-in storage, entitlements, and authenticated deletion |
| Original handoff | `apps/apple/APP_STORE_HANDOFF.md` | Historical background; this master file supersedes its status and pricing claims |

No older local backend checkout was copied over the current GitHub source. The original folders remain available and their unrelated local edits were not changed.

## Published pricing and policies

Source: https://www.serasona.com/pricing/ retrieved October 30, 2026.

| Plan | Monthly USD price | Product identifier |
| --- | --- | --- |
| Core | $7.99 | `com.serasona.app.core.monthly` |
| Plus | $14.99 | `com.serasona.app.plus.monthly` |
| Executive | $19.99 | `com.serasona.app.executive.monthly` |

The live page advertises three free Pulse check-ins daily and seven days of free history. The current GitHub backend implements that policy. The previous handoff's one lifetime check-in and $29/$49/$149 prices are stale.

The live page also advertises annual pricing, a Core trial, and model add-ons. The inherited native implementation offers monthly subscriptions only. Annual products, trials, and add-on purchasing are not yet implemented or verified for Apple billing.

Privacy: https://www.serasona.com/privacy/

Terms: https://www.serasona.com/terms/

Apple subscription management: https://apps.apple.com/account/subscriptions

## Work performed in this chat

1. Located the existing repositories and fetched the current `serasona` main branch.
2. Consolidated the richer native app, current website, and current backend into the working checkout above.
3. Added Watch-owned Firebase REST sign-in and token refresh with Keychain storage. App Group storage is local to each device; it does not synchronize an iPhone and Watch.
4. Added a durable, account-scoped Watch outbox. Recordings can be retried after losing connectivity. Completed analyses are persisted before history save, so save failures do not require analyzing the same audio again. Pending recordings are purged after 24 hours when the app next executes.
5. Added direct server-history refresh on Watch activation and explicit WidgetKit timeline reloads after local result changes.
6. Added an authenticated backend DELETE handler. Ownership comes only from a verified Firebase token. It removes account-owned voice history and phone request rows in bounded batches. Native account deletion now fails if the server deletion endpoint fails rather than silently leaving readings behind.
7. Aligned the local monthly StoreKit prices and plan descriptions with the website, added privacy and terms links, improved restore handling, and retained unfinished transactions when server redemption fails.
8. Hardened Apple purchase verification: Xcode transactions are refused on hosted deployments, the signed account token must match the signed-in Serasona account, expiration and original transaction identity are required, and delayed restores cannot shorten a newer Apple period. The iPhone purchase request now supplies the corresponding opaque account token.
9. Added Apple expiration checks to backend entitlements and expiration-aware iPhone subscription state. Current Apple entitlements are checked after sign-in without prompting a manual restore.

The native Release build was uploaded successfully to App Store Connect on October 30. Backend updates were deployed and checked as described below. Apple processing and native purchase/audio runtime checks are separate from these completed steps.

## Build and verification

Regenerate from `apps/apple` using `./regenerate.sh`. It runs XcodeGen and then restores the local StoreKit configuration in the shared scheme. Do not run XcodeGen alone for normal regeneration.

Build the `Serasona` scheme for an iPhone simulator and `SerasonaWatch` for a Watch simulator. The full iPhone build embeds the Watch app and iPhone widget; the Watch app embeds its complication.

The Mac has Xcode 27.0 and iPhone and Watch simulator runtimes. The current iPhone simulator build passed, including the embedded Watch, widgets, and purchase account binding. All four built bundles contain `PrivacyInfo.xcprivacy`.

The 24 existing SerasonaKit tests passed. The backend regression suite has 13 passing tests: five deletion tests and eight Apple purchase verification tests. A live disposable Firebase account passed sign-in, token refresh, and authenticated empty history retrieval; the disposable account was removed. No audio analysis was performed in that smoke test.

Both current apps installed and launched in isolated simulators, and their login screens were visually checked. Screenshots are saved at `.build/Serasona_iPhone.png` and `.build/Serasona_Watch.png`, with review copies in the master chat outputs folder. Native sign-in, audio capture, offline retry, and StoreKit purchases still require full runtime testing.

A signed Release archive completed successfully at `.build/Serasona-signed.xcarchive`, version 1.0, build 1, team `JC874B66JG`. Its top-level app correctly embeds the Watch app and both extensions. App Store distribution export and upload returned `EXPORT SUCCEEDED` at 14:05:59 local time on October 30. Apple reported that the uploaded package is processing. `apps/apple/ExportOptions.plist` configures the reproducible upload. Apple issued nonfatal missing dSYM warnings for FirebaseFirestoreInternal, absl, grpc, grpcpp, and openssl_grpc; application symbols were included, but symbolication inside those dependencies may be limited.

The updated `voiceHistory`, `appleIapVerify`, and `analyzeAudio` functions were deployed successfully to `amits-playground-po`, us-central1. The two functions previously on retiring Node.js 20 were also redeployed successfully on Node.js 22. Active revisions are `voicehistory-00010-lis`, `appleiapverify-00003-nuw`, and `analyzeaudio-00016-xet`. `APPLE_APP_APPLE_ID=6829005022` is set on the verifier. All three live endpoints reject unsigned calls with HTTP 401. A disposable signed-in account successfully called DELETE history (HTTP 200, zero rows), and the hosted verifier rejected a fake Xcode purchase with HTTP 400. The disposable account was then removed. These checks did not record or analyze audio or redeem a real Apple purchase.

## Verified Apple configuration

App Store Connect record: https://appstoreconnect.apple.com/apps/6829005022/distribution

TestFlight: https://appstoreconnect.apple.com/teams/589b0edd-eb54-4794-8bc8-1a19c31d26ab/apps/6829005022/testflight

Internal group **Serasona Internal** has automatic distribution off. Apple has finished processing build 1.0 (1), marked it **Ready to Test**, and the build was added to this group. Amit explicitly authorized the TestFlight invitation to `mehta@helix.harvard7.net`. On reopening the prepared page, Apple already showed **1 Tester**, **1 Build**, a successful tester-added notice, and status **Invited** for that address. No duplicate invitation was sent. Tester installation remains unverified.

Apple app ID: `6829005022`. SKU: `SERASONA-IOS-001`. Language: English (U.S.).

All four bundle IDs are registered and assigned to App Group `group.com.serasona.app`:

1. iPhone: `com.serasona.app`
2. Watch: `com.serasona.app.watchkitapp`
3. iPhone widget: `com.serasona.app.widget`
4. Watch complication: `com.serasona.app.watchkitapp.widgets`

The originally proposed complication suffix was unavailable. The active project and archive use the registered `.widgets` identifier. Watch and complication targets use `SKIP_INSTALL=YES`, preventing a second top-level app from breaking archive packaging.

Subscription group **Serasona Plans**, ID `22529915`, and its English (U.S.) display name were saved. All three monthly products were created in descending service order, with English display names, descriptions, and United States availability for initial testing:

| Product | Apple product ID | Monthly USD price | Group level |
| --- | --- | --- | --- |
| Executive | `6829006046` | $19.99 | 1 |
| Plus | `6829006762` | $14.99 | 2 |
| Core | `6829007030` | $7.99 | 3 |

The exact product identifiers match the source pricing table above. Prices were confirmed in Apple's availability confirmation dialogs. The products remain Prepare for Submission; review screenshots and App Review submission are still open. No subscriptions have been published for sale. Annual, trial, and add-on products remain unimplemented in native billing.

For the successful builds, use the destination to select the platform, rather than forcing `-sdk iphonesimulator` on the entire embedded Watch build. On this Apple Silicon Mac the verified architecture was arm64. The verification reused the pre-existing Swift package cache at `/Users/amitmehta/Claude-Outputs/Serasona_iOS/build/spm`; normal Xcode opening can resolve the same dependencies itself.

## Release requirements still open

### Build 2 interface update, October 30

Amit reported overlapping Settings text and requested independent Dashboard navigation, a processing countdown, blank missing prior readings, a left-hand 0–100 score-position bar for every index and the main score, and a full-website button below the circular score. These changes are implemented in the iPhone app and corresponding website dashboard/analysis screens.

Settings now uses a scrolling layout and inline system title. The four-tab app starts on Dashboard and loads real saved history without recording first. Recording from Dashboard starts a fresh capture. Empty accounts remain empty. Prior-reading cards retain their labels but leave missing dates, scores, and context blank. Main score and Stress, Wellness, Clarity, and Sleep use proportional scales with thresholds 34, 67, and 90. The countdown is explicitly an estimate; after 60 seconds it shows elapsed time and a finishing message rather than claiming the analysis is complete.

Native simulator screenshots verified Settings and Dashboard on an iPhone SE (375 points wide), the existing larger iPhone simulator, and an iPhone Duo matching Amit's 1398 × 2034 active display. The inactive second Duo display was not counted as a verified expanded layout. App Store Connect confirms Amit installed build 1 on an iPhone Duo running iOS 27.1. Processing countdown and its over-estimate finishing state were also visually checked in the simulator. Browser dashboard preview was checked at desktop and iPhone width; an existing mobile capture-panel overflow was fixed, and the final mobile DOM check found no overflow outside intentionally scrollable tables. All 325 website regression tests, TypeScript, production build, and the production authentication/consent artifact check passed. Development-only example readings are excluded from the production build.

Website changes are commit `e2e9c091`, pushed to main. Deployment run https://github.com/BDO811/serasona/actions/runs/41121230125 completed successfully at 15:21 local time. The deployment gate cleared without changing repository protections. A fresh public www.serasona.com/dashboard bundle check returned `/assets/index-BerVJKpD.js` and verified the new score scales, full-website button, and countdown code. The website update is live.

The signed iPhone build 2 archive at `.build/Serasona-build2.xcarchive` passed deep code-signature verification. The iPhone, Watch, widget, and complication all contain version 1.0, build 2. App Store export returned `EXPORT SUCCEEDED` and upload success at 15:17:59 local time on October 30. Apple finished processing build 2, and its Test Details and What to Test notes are saved. The same nonfatal third-party Firebase dSYM warnings as build 1 remain. The Add Group dialog has Serasona Internal selected, with the final Add button ready. That final action triggers Apple's tester notification email; it was left for Amit under his message-specific email approval rule because Apple does not preview the generated email body. No build 2 tester notification was sent by the agent. Build 2 is not yet available to the group until that final Add action is completed. XcodeGen now explicitly binds all four generated Info.plist version fields to the build settings, preventing old hardcoded build 1 values from surviving regeneration. Native changes are committed on `codex/serasona-testflight` at `8b7c0d93`.

1. Complete the final Add action in the prepared Chrome dialog to make build 2 available to Serasona Internal, then verify its installation on Amit's iPhone Duo. Build 1 installation is confirmed. Build 2 processing and the website deployment are complete. The only remaining release action is the prepared tester-group assignment, which triggers Apple's email notification.
2. Finish subscription review screenshots, app metadata, and privacy disclosures. Monthly product creation, pricing, English localization, initial U.S. availability, and the backend Apple app ID are configured.
3. Finish builds, test sign-in and token renewal, offline recording and retry, duplicate-save handling, deletion, StoreKit redemption and restore, widgets, and Watch layouts on real devices.
4. Test account deletion with populated native check-in history. Deployment and a signed-in empty-history deletion check are complete.
5. Audit Apple transaction verification, production environment configuration, subscription lifecycle updates, and App Store Connect products before enabling real billing.
   The account binding and expiry protections described above are implemented locally and covered by mocked backend tests. App Store Server Notifications and real Sandbox/TestFlight purchase validation remain open. Local Xcode StoreKit purchases must use an isolated Functions emulator; they cannot grant a plan through the hosted verifier.
6. Confirm the privacy manifest matches actual data processing, including independent Watch authentication and temporary local offline recordings. Reconcile website retention wording with the new offline queue.
7. Configure TestFlight testing after a successful upload and processing. Do not email tester invitations without Amit's approval of the exact message.

## Source labels

`github-current`: BDO811/serasona, main `12f05a2`.

`native-full`: BDO811/claude-outputs, Serasona_iOS, imported from local Git history on October 30.

`native-starter`: BDO811/serasona, ios/, also present on branch claude/ios-watch-app.

`historical-handoff`: APP_STORE_HANDOFF.md supplied by Amit.

`website-live`: www.serasona.com/pricing/, retrieved October 30.

`firebase-auth-reference`: https://firebase.google.com/docs/reference/rest/auth

`codex-audio-history`: Fix Serasona audio intake, chat `01a1831f-fc3d-7522-8ecf-0d478dc31c01`.

`codex-dashboard-history`: Fix phantom voice pattern history, chat `01a18359-a318-7753-9cb6-69e8a194bf94`.

`apple-verifier-reference`: https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html

`apple-account-token-reference`: https://developer.apple.com/documentation/appstoreserverapi/appaccounttoken

## Build 3 Clarity and palette correction, October 30

The native Clarity card previously depended on cognitive specialist signals absent from normal Pulse readings. It now uses the website's dedicated Clarity calculation with fatigue or a cognitive signal as the required anchor. Stress or mood alone cannot fabricate Clarity. The calculation is shared by the current result, history matrix, and trends. Eleven native checks cover Pulse parity, missing and invalid inputs, deduplication, and cohort versioning. The iPhone Duo simulator visibly renders Clarity using a six-signal Pulse fixture. The fixture score is demonstration data, not Amit's reading.

Colors now follow the saved Bone and Signal design kit. Green is replaced by neutral Bone and black. A single JSON palette supplies website semantic colors and generated assets for iPhone, Watch, widget, and complication. Blue indicates links and watch states; red indicates strained states. Legacy orange and teal actions were removed. Three palette checks enforce exact agreement across Apple targets. All 325 website tests and TypeScript passed.

Signed version 1.0 build 3 archived and uploaded successfully. Apple processing and tester-group assignment remain to be checked. Build 3 supersedes the prepared build 2 group assignment; do not distribute build 2. Tester notification email remains subject to Amit's message-specific approval rule. Website changes are prepared for main deployment; live status will be recorded after verification.

Build 3 release follow-through: Apple processing is complete. What to Test notes are saved. Chrome is prepared at Add Group to Build 1.0 (3), with Serasona Internal selected. Final Add remains for Amit because Apple can generate a tester email without exposing its complete body for approval. The current visible build 2 page showed its group had already been added since the previous handoff. Build 3 is the intended update.

Website changes are pushed to main at `96e55923`. Latest deployment run: https://github.com/BDO811/serasona/actions/runs/41124623185 . The superseded earlier run passed all build checks and was cancelled to free the deployment queue for the final neutral-wordmark change. At the last check the latest run remained queued. Palette preview and Clarity simulator screenshots are saved in `.build` under this Downloads checkout, with review copies in the master chat outputs folder.
