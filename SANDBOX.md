# Serasona_App — the serasona.com product sandbox

This is the full product app (signup, pricing, payment, account, daily check-in, trend history) —
separate from `Serasona_Site`, which is the tryserasona.com lead-gen demo and stays untouched.

## Start it

```bash
cd /Users/amitmehta/Claude-Outputs/Serasona_App
npm run dev -- --port 8282
```

Or ask Claude to start the `serasona-app-sandbox` preview, which does the same thing.

## Demo mode

`.env` ships with `VITE_DEMO_MODE="true"`. While it's on, sign-up, login, "payment," and check-in
history all run against `localStorage` instead of real Firebase/Stripe — see `src/lib/demo-mode.ts`.
This is what lets the full round trip be clicked through with zero live credentials:

1. `/signup?plan=core` (or any plan) — creates a local mock account and immediately marks that plan
   active, as if checkout had succeeded.
2. `/account` — shows the active plan, renewal date, "Check in now" / "See my trend".
3. `/checkin` — the real capture → analysis → reveal flow (needs real microphone access, which the
   Claude Browser pane itself cannot grant — test this one in an actual browser tab).
4. `/history` — seeded with a realistic 26-day sample series the first time it's opened, so the trend
   view has something to show rather than an empty state. A real check-in from `/checkin` appends onto
   that same series.

A demo-mode banner appears on every account-flow screen so it's never ambiguous that nothing here is a
real charge or a real account. Flip `VITE_DEMO_MODE` to `"false"` and fill in real Firebase/Stripe keys
(see `docs/SETUP_BILLING.md`) once those are ready — every page already branches on that flag, so no
further code changes are needed to go live.

## Screens you cannot otherwise reach

Recording audio to reach a screen is slow, and some screens cannot be reached at
all without a live result. These render them directly:

| Path | What it shows |
|---|---|
| `/panel-preview?dev=true` | Hero at all four rungs, signal rows, sub-dimensions |
| `/panel-preview?dev=true&screen=analysis` | The analysis screen on its own |
| `/api-debug?dev=true` | The raw API response behind the last result |

## Before pushing anything live

```bash
npx tsc --noEmit   # types
npm test           # 209 tests
npm run build      # production build
```

This project has no remote yet — it's a local-only git repo (`git log` to see what's committed). Nothing
gets pushed or deployed anywhere until that's explicitly asked for.
