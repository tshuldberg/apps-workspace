# MyNews native flow specs (Maestro)

Native end-to-end flow specs for `apps/mynews` (bundle `com.mylife.mynews`).

## Why Maestro and not Detox

Nothing in this repository used either before this directory existed, so this
was a free choice.

- Maestro flows are YAML. They need no native build wiring, no test runner
  inside the app bundle, and no extra dependency in `apps/mynews/package.json`.
  Detox requires a native test target and a config baked into the iOS/Android
  projects, which `apps/mynews` (a managed Expo app) does not check in.
- Maestro drives whatever build is already installed on the device, so the same
  flow runs against a dev client, a preview build, and a store build.
- Maestro is a separately installed CLI, not an npm package. That is a real
  tradeoff: `pnpm --filter @mylife/mynews-app test:flows` fails with a
  "command not found" style error on a machine without it, which is the correct
  loud failure. It never silently passes.

Install: `curl -Ls "https://get.maestro.mobile.dev" | bash` (puts the CLI at
`~/.maestro/bin/maestro`). Verified against Maestro **2.4.0**.

## Selectors

`apps/mynews` ships **zero `testID` props**. It does ship an accessibility
contract that `apps/mynews/app/__tests__/accessibility.test.ts` enforces from
source: every `TextInput` carries an `accessibilityLabel`, every `Pressable`
carries a role and an accessible name. Maestro matches accessibility labels, so
those labels are used as the stable anchors. Everything else is visible text
quoted from the screen source. Maestro matches text as a regex, which is why a
few assertions carry `\\d+` or an escaped `\\$`.

## Safety gates

Three separate opt-in variables, all defaulting to `"0"`, so arming one flow
cannot arm another:

| Variable | Arms | Default |
|---|---|---|
| `MAESTRO_MYNEWS_ALLOW_WRITES` | publish, suggest, review accept, report submit, block | `0` |
| `MAESTRO_MYNEWS_ALLOW_ACCOUNT_DELETION` | pressing the real delete button | `0` |
| `MAESTRO_MYNEWS_ALLOW_KEY_WRITES` | minting a recovery kit and escrowing it | `0` |

With all three off, every flow is read-only against the configured backend.
**Never point an armed run at production.**

## Flows

| Flow | Runnable today on a local simulator | Needs | Not covered, and why |
|---|---|---|---|
| `01-auth.yaml` | Yes | Dev client | Completing sign-in. Supabase email OTP needs a real inbox; the flow stops before sending mail. Creating the profile writes a row, so it stops at the filled form. |
| `02-publish.yaml` | Partly | Dev client; full path needs configured Supabase + seeded journalist + a signing key | The actual publish, unless `MAESTRO_MYNEWS_ALLOW_WRITES=1`. Without the backend the flow asserts the composer's honest disabled/route-to-registration states. |
| `03-suggest.yaml` | Partly | Configured Supabase with at least one published article; a registered profile | Submitting the suggestion (write-gated). On an unconfigured build it asserts the not-connected state and stops. |
| `04-review.yaml` | No, seeded only | A seeded account owning a published article WITH an open suggestion from a different editor | Accepting/rejecting (write-gated). Accept can be HELD by the screening gate, which is a correct outcome, so no flow asserts "published". |
| `05-report.yaml` | Yes | Dev client; the signed-in branch needs a configured Supabase + account | Submitting the report (write-gated). Signed-out is asserted as its own honest state. |
| `06-block.yaml` | Yes | Dev client; the block branch needs a configured Supabase + account | Blocking/muting (write-gated). Signed-out is asserted as its own honest state. |
| `07-support.yaml` | Partly | Configured Supabase; the payments rail on | **Payment. Founder-ops.** Checkout opens the provider's hosted page outside the app and needs a real card or a Stripe test-mode session against a real Connect account. The flow stops at the confirm step and asserts the fee breakdown. |
| `08-subscription.yaml` | Yes | Dev client | **Purchase. Founder-ops.** StoreKit / Play Billing sheets are system UI outside the app hierarchy and need a sandbox Apple ID or a Play licence-tester account. The flow asserts the three gate states and that an unconfigured build renders no purchase controls. |
| `09-deletion.yaml` | Yes | Dev client for the disclosure; the confirm form needs a signed-in account | Pressing delete, unless `MAESTRO_MYNEWS_ALLOW_ACCOUNT_DELETION=1` on a throwaway account. By default it types a wrong phrase then the right one and asserts the guard, without submitting. |
| `10-export.yaml` | Yes | Configured Supabase + signed-in account | The OS share sheet, which is outside the app hierarchy. The flow stops at `Ready` + `Preview`, which is what proves the export was built. |
| `11-key-recovery.yaml` | Partly | Configured Supabase + account; kit creation is key-write-gated | Restoring on a SECOND device (device-farm shape, founder-ops); exporting the kit file (OS share sheet); recovery WITHOUT a kit, which is hard-disabled in the product and asserted as unavailable. |

The recovery code in `11-key-recovery.yaml` cannot come from a fixture: it is
160 bits minted on device and shown once. The flow reads it off the screen with
`copyTextFrom` and types it back, which is exactly what the user does.

## Founder-ops, not wired here

- **Device farm execution.** Nothing in this repository runs these flows on a
  device farm. Maestro Cloud (`maestro cloud`) exists and would take an
  uploaded `.app`/`.apk` plus this directory, but no account, token, or CI job
  is configured. Do not read this directory as evidence of device-farm coverage.
- **Store sandbox accounts** for `08-subscription.yaml` (sandbox Apple ID / Play
  licence tester) and **a payment method** for `07-support.yaml`.
- **A mailbox** the flow can read, for completing email sign-in in
  `01-auth.yaml`.
- **A seeded staging project** with the two-account state `04-review.yaml`
  needs.

## Running locally

```bash
# 1. A device. Either boot your own simulator/emulator, or:
maestro start-device --platform ios

# 2. A build installed on it. Managed Expo needs a dev client, not Expo Go:
#    Expo Go's bundle id is not com.mylife.mynews, so `appId` will not match.
cd /Users/trey/Desktop/Apps/MyLife/apps/mynews
pnpm exec expo run:ios      # or: pnpm exec expo run:android

# 3. Backend + store configuration, if you want the configured branches:
#    EXPO_PUBLIC_MYNEWS_SUPABASE_URL, EXPO_PUBLIC_MYNEWS_SUPABASE_ANON_KEY
#    (see apps/mynews/docs/ENV_MATRIX.md)

# 4. Run every flow
pnpm --filter @mylife/mynews-app test:flows
# equivalently, from apps/mynews:
maestro test maestro

# One flow
maestro test maestro/05-report.yaml

# Arm the write branches (staging project only)
maestro test maestro -e MAESTRO_MYNEWS_ALLOW_WRITES=1

# Syntax-check without a device (this is what CI can do today)
for f in maestro/*.yaml; do maestro check-syntax "$f"; done
```

## CI status

These flows are **not** run in CI. `.github/workflows/mynews.yml` runs the
Vitest suites, the typechecks, the lint, the parity gates, Expo Doctor, and the
two Playwright web suites. Running Maestro in CI needs a simulator or emulator
runner plus a built app binary, which is a separate piece of work. Nothing
should describe these flows as a passing CI gate until that exists.
