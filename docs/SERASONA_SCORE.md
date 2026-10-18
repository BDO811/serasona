# Serasona Score · October 2026

Version: serasona-1. Product weights are provisional and are not a clinically validated scale.

The dashboard shows a score from 0 to 100 at the top. Higher means fewer flagged voice signs. It retains individual flags and provider recommended actions alongside the composite.

## Levels and measurements

| Level | Available models | Scoring scope |
| :--- | :--- | :--- |
| Free | Pulse | One check-in, without an established personal trend |
| Core | Pulse | Repeated Pulse readings |
| Plus | Pulse, Haven, Apex, Tide | Returned signs from the model actually run |
| Executive | All eight models | Returned signs from the model actually run |

These are the current server allowances. They describe access, not a claim that every available model runs on every recording. Consent and activation requirements still apply. `src/lib/score-matrix.ts` defines every model's canonical signs and draws its weights from the scoring registry. The dashboard displays this matrix and the effective percentage contribution of each sign in the latest recording.

## Formula

Score = round(sum(index × relative weight) / sum(relative weight)). Display bands map to Normal 100, Low 68, Moderate 38 and Elevated 8. The existing sign display overrides are applied consistently. Missing, inconclusive, unknown and invalid readings contribute neither points nor weight. Repeated signs count once. Stress and anxiety receive the largest individual weights. The source registry is `src/lib/serasona-score.ts`.

The result records the formula version and sorted scored sign coverage. Comparisons require matching source, model, version and scored coverage. Thus losing a sign to an inconclusive result cannot silently masquerade as a comparable score improvement. Upgrading access alone does not change a recording's score.

## Longitudinal integration

Serasona browser analysis submits to `POST /v2/models/{model}/groups/{subject}/analyze/longitudinal`. The subject is a SHA-256 hash of a brand namespace, verified Firebase UID and browser source. Client identity fields cannot choose another person's baseline. `recorded_at` is supplied. Baseline, latest estimate, deviation and anomaly fields survive result mapping and storage; a null baseline remains unavailable. The app's composite history is a product calculation, distinct from the API's per-sign baseline estimates.

MyAbuela browser and phone submissions use the longitudinal analyze endpoint with the existing stable per-senior group. Existing group identities are retained. A scheduled refresh resolves trajectories initially returned as running.

Serasona phone analysis is performed by the separately deployed voice-call-harness service in BDO811/claude-outputs. The companion change verifies the forwarded Firebase token, derives a separate phone subject group and uses longitudinal analyze. Deploy that companion service with this change. Browser and phone baselines stay separate. Old phone sessions without a group retain their original behavior.

## Release

Build and test both repositories. Deploy Serasona analyzeAudio and voiceHistory with their existing API credentials and runtime configuration. Deploy MyAbuela recording handlers, webhook and refreshLongitudinal. Existing historical Serasona jobs are not automatically backfilled into the new browser group. Baselines start with new grouped recordings unless a separately verified migration is performed.

API contract: https://docs.amplifierhealth.com/reference/longitudinal-api

## Public documentation

The public page at `/docs/serasona-score` explains the calculation, band exceptions, plan matrix, all 21 weights, comparison rules and measurement specific evidence. Its bibliography is in `src/lib/score-evidence.ts`; weights and model membership come from the live scoring registries. References describe research context, not clinical validation of Serasona or its product weights.
