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

Use the prices and existing legal pages published on serasona.com. Amit has an Apple account; developer membership and the correct signing team are not yet verified. Email sends require Amit's approval of the exact recipients, subject, full body, and attachments.

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

These are source changes. They are not evidence of a successful TestFlight upload or deployed backend update.

## Build and verification

Regenerate from `apps/apple` using `./regenerate.sh`. It runs XcodeGen and then restores the local StoreKit configuration in the shared scheme. Do not run XcodeGen alone for normal regeneration.

Build the `Serasona` scheme for an iPhone simulator and `SerasonaWatch` for a Watch simulator. The full iPhone build embeds the Watch app and iPhone widget; the Watch app embeds its complication.

The Mac has Xcode 27.0 and iPhone and Watch simulator runtimes. Both simulator builds returned exit zero and `BUILD SUCCEEDED` before the subsequent purchase-account binding and entitlement changes: `Serasona` for iPhone with embedded extensions, and `SerasonaWatch` with its complication. All four built bundles contain `PrivacyInfo.xcprivacy`. The Watch sources have not changed since their successful build.

The 24 existing SerasonaKit tests passed. The backend regression suite now has 13 passing tests: five deletion tests and eight Apple purchase verification tests. These do not test the new Watch authentication or outbox at runtime. Attempts to install and launch the apps in isolated simulators timed out; successful launch and visual checks remain unverified. Rebuilding the latest iPhone purchase changes timed out after 110 seconds without compiler diagnostics, so compilation of those latest iPhone changes is not yet verified. No TestFlight archive has been uploaded.

For the successful builds, use the destination to select the platform, rather than forcing `-sdk iphonesimulator` on the entire embedded Watch build. On this Apple Silicon Mac the verified architecture was arm64. The verification reused the pre-existing Swift package cache at `/Users/amitmehta/Claude-Outputs/Serasona_iOS/build/spm`; normal Xcode opening can resolve the same dependencies itself.

## Release requirements still open

1. Complete Apple sign-in in the Serasona Chrome tab. Identify the correct developer team and verify paid program membership. The only local development certificate belongs to a different name; do not assume it is Amit's release team.
2. Verify bundle identifiers and App Group registration. The active native app currently uses `com.serasona.app`, its Watch and widget suffixes, and `group.com.serasona.app`. The earlier starter used different identifiers; do not register both sets unintentionally.
3. Finish builds, test sign-in and token renewal, offline recording and retry, duplicate-save handling, deletion, StoreKit redemption and restore, widgets, and Watch layouts on real devices.
4. Verify and deploy the history deletion backend change. It has not been deployed during this chat.
5. Audit Apple transaction verification, production environment configuration, subscription lifecycle updates, and App Store Connect products before enabling real billing.
   The account binding and expiry protections described above are implemented locally and covered by mocked backend tests. App Store Server Notifications and real Sandbox/TestFlight purchase validation remain open. Local Xcode StoreKit purchases must use an isolated Functions emulator; they cannot grant a plan through the hosted verifier.
6. Confirm the privacy manifest matches actual data processing, including independent Watch authentication and temporary local offline recordings. Reconcile website retention wording with the new offline queue.
7. Prepare an archive signed by the verified team, upload it to App Store Connect, wait for processing, and configure TestFlight testing. No archive has been uploaded yet.

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
