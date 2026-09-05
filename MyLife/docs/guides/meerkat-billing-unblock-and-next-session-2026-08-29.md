# Meerkat: billing unblock + next-session handoff (2026-08-29, Part A corrected 2026-08-30)

Two things in one place: the click-by-click to turn the pilot's bypassed unlock into a real
purchase, and the prompt that gets the new Plan 56 work from `main` onto TestFlight.

## Where things stand right now

| Fact | State |
|---|---|
| TestFlight build in B1 | **1.0.0 (16)**, commit `7a2bd570`, installable now |
| Build 16 unlock | **Bypassed** via `EXPO_PUBLIC_MEERKAT_DEV_UNLOCK=1` (testflight profile only) |
| Fresh-install crash | **FIXED and device-verified** on build 15 (`schema-boot.ts`) |
| Relay | **LIVE**: `wss://meerkat-relay-us.fly.dev`, `/healthz` green |
| IAP product | **Created**: `meerkat_app_unlock`, Apple ID 6806448603, $4.99, 175 territories, EN localization |
| Paid Apps Agreement | **PENDING USER INFO** (blocks all purchases, sandbox included) |
| RevenueCat | **Not set up** (needed for BOTH rails: SDK key for iOS, REST key for the hosted service) |
| Web unlock rail | **Stripe via the hosted billing service, NOT set up.** Web shows "Hosted checkout is not configured in this build." |
| Hosted billing service | **Not deployed.** Refuses to boot without 7 env vars (see A6) |
| Web dev override | `VITE_MEERKAT_DEV_UNLOCK=1`, dev-server only (`import.meta.env.DEV`), uncommitted |
| Cross-surface | A purchase on one surface does NOT unlock the other; a **link code** covers both |
| `main` | `24c06f7c`, pushed, **15 commits ahead of build 16** (all Plan 56) |
| In flight | `feature/meerkat-plan56-c3-plaza`, 2 commits (Plaza pixel board) |

Both bypasses are what let you test today. Each skips only the entitlement gate, fakes no
receipt, and touches nothing about transport, delivery, or counts. The mobile one is blocked
from production builds by `check-build-env.mjs`; the web one cannot exist outside a dev server
because Vite hard-codes `import.meta.env.DEV` to false in a production build. Part A removes
the need for both.

---

# PART A: unblock billing on BOTH surfaces

**Corrected 2026-08-30.** The first version of this guide covered only Apple. Mobile and web
use two DIFFERENT payment rails, so unlocking "the app" is two workstreams. Doing only the
Apple half leaves web stuck showing "Hosted checkout is not configured in this build."

| Surface | Rail | Blocker today |
|---|---|---|
| iOS | Apple IAP via RevenueCat | Paid Apps Agreement is Pending User Info |
| Web | Stripe via your hosted billing service | The hosted service is not deployed or configured |

A purchase on one surface does NOT unlock the other. The buying device mints a **link code**
(`mintMobileAppUnlockLink` on mobile) which the other surface redeems (`redeemAppUnlockLink`,
"Bought on another device? Enter a link code"). So "users can use both" needs A4 AND A7, plus
telling users to link.

**Critical path: start A1 today.** Bank + tax verification has the longest wall-clock wait, and
A6 needs the RevenueCat key from A3, so the order below is the fast one.

## A1. Paid Apps Agreement (blocks ALL Apple purchases, sandbox included)

Until this is Active, StoreKit vends no products, so even a free TestFlight sandbox purchase
fails. Go to [App Store Connect > Business > Agreements](https://appstoreconnect.apple.com/business).

1. **Accept the updated Apple Developer Program License Agreement.** The Account Holder must do
   this and it silently blocks the rest until done.
2. **Add Bank Account** (routing + account number; Apple may micro-deposit verify).
3. **Add Tax Info**: for a US individual/sole proprietor this is **Form W-9** (legal name,
   address, SSN or EIN, signature). A partial form leaves the agreement pending.
4. Refresh until Paid Apps Agreement reads **`Active`**, not `Pending User Info`. Propagation to
   StoreKit takes minutes to ~24 hours.

## A2. Generate the In-App Purchase key

App Store Connect > **Users and Access > Integrations**. Two key types exist and swapping them
produces a famously unhelpful error ("Invalid file name, it should be SubscriptionKey_...").

- **In-App Purchase** tab > generate > `SubscriptionKey_XXXX.p8`. **This is the RevenueCat one.**
- The *App Store Connect API* key (`AuthKey_XXXX.p8`) is for `eas submit` and is already stored
  with EAS. You do not need a new one.

Note the **Issuer ID** and **Key ID**. The `.p8` downloads once.

## A3. RevenueCat (mobile rail, and A6 needs its REST key)

1. Create an account and a project named `Meerkat` at [app.revenuecat.com](https://app.revenuecat.com).
2. Add an **App Store** app with bundle id **`com.mylife.meerkat`**.
3. Upload `SubscriptionKey_XXXX.p8` in the **In-App Purchase Key** field with the Issuer ID and
   Key ID from A2.
4. Copy two different keys, you need both later:
   - the **public Apple SDK key** starting **`appl_`** (goes in the app, A4)
   - a **REST API key** (goes in the hosted service, A6)

No offering or entitlement objects are needed; the app buys by product id directly
(`Purchases.getProducts(['meerkat_app_unlock'])`). The IAP product itself is already created:
`meerkat_app_unlock`, Apple ID 6806448603, $4.99, 175 territories, EN localization.

## A4. Hand off the `appl_` key (mobile goes live)

Tell a Claude session: **"wire the RevenueCat key and remove the mobile dev unlock override."**
It must:

1. Add `EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` to the `testflight` env in `apps/meerkat/eas.json`.
2. **Remove** `EXPO_PUBLIC_MEERKAT_DEV_UNLOCK` from that env; delete
   `apps/meerkat/app/(root)/data/dev-unlock.ts`, its call in `app/(root)/_layout.tsx`, and
   `app/__tests__/dev-unlock.test.ts`. **Leave the `check-build-env.mjs` production block in
   place permanently** as cheap insurance.
3. Run `pnpm --filter @mylife/meerkat-app test`, build, submit, clear export compliance.
4. On device: Unlock > the sheet must read **[Environment: Sandbox]** > buy. You are not charged.
   "Purchase unavailable" means the agreement has not propagated yet, or the key is wrong.

## A5. Stripe (web rail)

1. Create/prepare a Stripe account.
2. Create **two prices** and note both IDs:
   - one-time **$4.99 app unlock** -> `STRIPE_APP_UNLOCK_PRICE_ID`
   - **$4.99/mo hosted server** -> `STRIPE_MONTHLY_PRICE_ID`
   (Both are founder-locked prices. Do not invent others.)
3. Note your **secret key**, and create a **webhook endpoint** pointing at the service you deploy
   in A6; save its **signing secret**.

## A6. Deploy the hosted billing service (web rail)

`packages/meerkat-relay/bin/meerkat-hosted-service.mjs`. It **refuses to boot** unless all seven
of these are set, deliberately, so it can never take payments without being able to issue real
entitlements:

```
ENTITLEMENT_SECRET          # random high-entropy secret you generate
WEBHOOK_SECRET              # Stripe webhook signing secret (A5)
STRIPE_SECRET_KEY           # Stripe secret key (A5)
STRIPE_MONTHLY_PRICE_ID     # $4.99/mo hosted server price (A5)
STRIPE_APP_UNLOCK_PRICE_ID  # $4.99 one-time unlock price (A5)
REVENUECAT_REST_API_KEY     # RevenueCat REST key (A3) -- this is why mobile goes first
MEERKAT_ALLOWED_ORIGINS     # CORS allowlist; must include your web app origin
```

Defaults: `PORT=8893`, `HOST=0.0.0.0`, `DATA_DIR=./.meerkat-hosted`. Deploy it somewhere with
TLS and a stable hostname (the same Fly account already hosting the relay is the easy choice).

## A7. Point web at it (web goes live)

1. Set `VITE_MEERKAT_HOSTED_API_URL` to the A6 service URL for the web build.
2. Remove the web dev override: delete `apps/meerkat-web/src/lib/dev-unlock.ts` and its call in
   `src/ui/App.tsx`. (It is already structurally dev-server-only via `import.meta.env.DEV`, but
   it should not outlive its purpose.)
3. Verify in the browser: Settings > the unlock section should now offer **"Unlock for $4.99"**
   instead of "Hosted checkout is not configured in this build."

## A8. Prove it, then tell users about linking

Done means: a TestFlight build with no bypass where Unlock completes a free sandbox purchase,
AND a web build where Stripe checkout completes. Then verify the cross-surface path once:
buy on one surface, mint a link code, redeem it on the other, confirm both unlock. That link
step is the thing real users will otherwise be confused by.

---

# PART B: prompt for the new session

Paste everything between the lines into a fresh Claude Code session started in
`/Users/trey/Desktop/Apps/MyLife/apps/meerkat`.

---

We are shipping the new Meerkat work on `main` to TestFlight. Repo:
`/Users/trey/Desktop/Apps/MyLife` (app `apps/meerkat`, web twin `apps/meerkat-web`, sync core
`packages/sync`, relay `packages/meerkat-relay`). **Read `apps/meerkat/CLAUDE.md` and the
`AGENTS.md` it imports in full before touching anything.** The transport-honesty rules there
are binding: never fake connectivity, peer counts, delivery, or any number; always separate
implemented+tested from dev-build-only from founder-ops.

## Your job, in order

**1. Review everything that landed since the last shipped build.** TestFlight build 16 was cut
at commit `7a2bd570`. `main` is now `24c06f7c`, 15 commits ahead, all of it Plan 56 (the canvas
/ freeform creation layer): C0 composition spine (CORE_TWINS meta-guard, block registry,
`cm_layout`, layout editors), C1 canvas core, C1b completion, C2 (badges + persona identity,
asset packs, sticker layer, canvas posts, milestone cards + page templates, per-channel theme
overrides + role bubble skins). Plan doc: `docs/plans/active/56-meerkat-canvas-freeform-creation-layer.md`.

Read the actual diff (`git log --oneline 7a2bd570..main`, then read the substantive commits and
`docs/sessions/` entries for them). Report: what shipped, what is dev-build-gated, what is
founder-ops, and anything whose UI copy could overclaim. Verify claims against source, do not
trust commit messages alone.

**2. Merge the in-flight branch.** `feature/meerkat-plan56-c3-plaza` has 2 commits (Plaza
pixel-board data layer + an equal-timestamp rate-limit bypass fix) not in `main`. Confirm the
founder considers it finished, review it, then merge to `main`.

⚠️ **Do NOT bulk-merge other branches.** `git branch` shows ~20 branches "ahead" of main, but
most are content-equivalent leftovers from the 2026-07-17 and 2026-08-25 integration merges
(mynews waves, yearn, rc fix branches). Verify with `git log main..<branch>` and a tree diff
before assuming anything is genuinely unmerged. When in doubt, leave it and report it.

**3. Run the full gates before shipping.** `pnpm --filter @mylife/meerkat-app test`,
`node scripts/check-meerkat-parity.mjs` from the repo root, `pnpm check:parity`,
`pnpm gate:function:changed`. Plan 56 added a CORE_TWINS meta-guard that fails when a new
`*-core.ts` has no parity lock, so new cores must be locked. Everything must be green before a
build.

**4. Ship to TestFlight.**
```bash
cd apps/meerkat
npx eas-cli build --profile testflight --platform ios --non-interactive
npx eas-cli submit --profile testflight --platform ios --latest --non-interactive
```
Then, per build, in App Store Connect (the founder may want to drive this, or you can via
browser control if Claude-in-Chrome is connected): the build appears as **Missing Compliance**
> open the build's own detail page > **Provide Export Compliance Information** > "Standard
encryption algorithms instead of, or in addition to, Apple's OS encryption" > France: **No**.
That matches the saved app-level declaration. Builds auto-join group **B1** (internal, instant)
once compliance clears; **A1 is external and needs Beta App Review, do not use it for the pilot.**

Note: `ITSAppUsesNonExemptEncryption` is deliberately ABSENT from `app.json`. `true` without a
compliance code is undeliverable (ITMS-90592 killed build 12) and `false` would dishonestly
skip the questionnaire. A guard test pins this. Do not "fix" it.

## Things that will bite you if you do not know them

- **Fresh-install boot:** `app/(root)/data/schema-boot.ts` creates EVERY table family
  synchronously at database open, because render-phase reads beat provider effects and builds
  13/14 crashed on exactly that. A new table family MUST be wired in there; a completeness
  guard test enumerates every `ensure*Tables`/`ensure*Schema` in `data/` and fails otherwise.
- **The unlock gate is currently BYPASSED** in the testflight profile via
  `EXPO_PUBLIC_MEERKAT_DEV_UNLOCK=1` (`data/dev-unlock.ts`), because the founder's Paid Apps
  Agreement is pending so StoreKit vends no product. It skips only the entitlement gate, fakes
  no receipt, and is blocked from production builds. **If the founder gives you a RevenueCat
  `appl_` key, wire it and remove the override entirely** (see the guide's Part A4).
- **Relay is live** at `wss://meerkat-relay-us.fly.dev`, baked into the testflight profile as
  `MEERKAT_DEFAULT_RELAY_URL`. Fly app `meerkat-relay-us`. Deploying it needs a root-level
  `fly.toml` copy (gitignored) because flyctl resolves the dockerfile path relative to the
  config file.
- **Repo conventions:** Conventional Commits; branch off main for feature work; run gates
  before committing; update `memory.md` (one Sessions row), `errors_log.md`, and a session log
  under `docs/sessions/` in the same flow; capture to Open Brain with context
  `"personal, mylife"`; every markdown report gets a same-basename HTML twin, opened after
  creation; no em dashes.

Start by reporting the review from step 1 and your merge plan for step 2. Do not build until
the founder confirms the branch is finished and the gates are green.

---
