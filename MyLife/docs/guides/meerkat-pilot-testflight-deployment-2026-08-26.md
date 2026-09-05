# Meerkat pilot TestFlight deployment, click by click (2026-08-26)

Scope: get Meerkat onto YOUR phone via TestFlight and usable with the private
wedge (pairing, communities, channel chat, DMs, sync over relay). This is the
pilot path, not the full 18-step launch runbook
(`docs/guides/meerkat-launch-execution-guide-2026-07-21.md`); the full
production topology (account/hosted/persona/LiveKit/scanner services) is
public-tier infrastructure the pilot does not need. Release candidate context:
`meerkat-2026-08-25-rc19` at `cdfea6d6`.

Every identifier below was read from the repo at HEAD, not memory:
`apps/meerkat/app.config.ts` (env vars), `apps/meerkat/eas.json` (profiles,
ASC ids), `packages/entitlements/src/meerkat-app.ts` (product id),
`apps/meerkat/app/(root)/data/app-unlock.ts` (purchase flow),
`packages/meerkat-relay/deploy/fly.toml` + `render.yaml` (relay deploy).

---

## Step 1: deploy one pilot relay (the only server the private wedge needs)

The slim relay is STATELESS: no database, no disk, no secrets. It reads only
`PORT`/`HOST` and keeps a 24h in-memory store-and-forward mailbox
(`RELAY_MAILBOX_TTL_MS=86400000`, already preset in both deploy templates).
Pairing, manual sync sessions, offline mailbox delivery, communities, DMs, and
live-wake all ride this one service.

### Option A: Fly.io (recommended; template ready)

1. Install flyctl (`brew install flyctl`) and `fly auth login`.
2. From the relay PACKAGE ROOT (this matters; the Docker build context is the
   package root):
   ```bash
   cd packages/meerkat-relay
   fly apps create meerkat-relay-us       # first time; global namespace, rename on conflict
   cp deploy/fly.toml ./fly.toml          # root copy is REQUIRED (gitignored)
   fly deploy --remote-only
   ```
   The template names the app `meerkat-relay-us` in region `iad`; change in
   `deploy/fly.toml` if you want another name/region.
   Verified 2026-08-27: deploying straight off `--config deploy/fly.toml`
   FAILS because flyctl resolves the `[build].dockerfile` path relative to the
   config file's directory (it looks for `deploy/Dockerfile`), and a
   `--dockerfile` CLI override is ignored in favor of the config value. The
   root copy is the working layout; `fly launch --copy-config` produces the
   same file. Also verified: if `flyctl auth whoami` reports no token right
   after a successful browser login, pass the stored token explicitly:
   `FLY_API_TOKEN="$(awk '/^access_token:/{print $2}' ~/.fly/config.yml)" fly deploy ...`
3. Verify: `curl https://meerkat-relay-us.fly.dev/healthz` returns the
   two-field health response. Fly terminates TLS, so your relay URL is:
   `wss://meerkat-relay-us.fly.dev`
4. Keep this URL; it goes into the build in Step 3.

### Option B: Render.com

1. Render dashboard > New > Blueprint > connect the MyLife repo.
2. Point it at `packages/meerkat-relay/deploy/render.yaml` (service
   `meerkat-relay`, Docker runtime, health check `/healthz`, `autoDeploy`
   deliberately off).
3. After deploy, your relay URL is `wss://<service>.onrender.com`.

Fleet notes (multi-region, custom domains, TLS):
`docs/designs/meerkat-relay-fleet-runbook.md`.

---

## Step 2: App Store Connect IAP + RevenueCat

The unlock gate is deny-by-default with no dev bypass: without this step the
app installs and browses but stays LOCKED at the $4.99 gate (honest fail-closed
copy). The app purchases by PRODUCT ID directly
(`Purchases.getProducts(['meerkat_app_unlock'])`,
`app-unlock.ts:175`), so RevenueCat needs NO offering or entitlement objects,
just the app + store key.

### 2a. Create the IAP in App Store Connect

1. appstoreconnect.apple.com > My Apps > Meerkat (app id `6800001912`, bundle
   `com.mylife.meerkat`, team `4LMG5HM5UV`; all already wired in `eas.json`).
2. Monetization > In-App Purchases > Create:
   - Type: **Non-Consumable**
   - Product ID: exactly `meerkat_app_unlock` (the code keys off this literal;
     a typo here cannot be fixed later, only replaced)
   - Reference name: Meerkat App Unlock
   - Price: **$4.99** (founder-locked; no other SKU exists by design)
3. Add the English localization (display name + description) and a review
   screenshot (any real app screenshot; required for metadata completeness).
4. Get it to **Ready to Submit** state. TestFlight sandbox purchases work once
   metadata is complete; the IAP goes to review together with the first App
   Store submission, which the pilot does not need.

### 2b. The two .p8 keys (do not mix them up)

App Store Connect issues two different key types; the deploy walkthrough
(`docs/guides/meerkat-deploy-and-test-walkthrough-2026-08-01.html`) documents
the exact failure ("Invalid file name, it should be SubscriptionKey_...") when
they are swapped:

- Users and Access > Integrations > **App Store Connect API** > generate
  `AuthKey_XXXX.p8` with **App Manager** access. This one is for `eas submit`
  (Step 5).
- Users and Access > Integrations > **In-App Purchase** > generate
  `SubscriptionKey_XXXX.p8`. This one is what RevenueCat's purchase-key field
  wants.

### 2c. RevenueCat

1. app.revenuecat.com > create project Meerkat > add an **App Store** app with
   bundle id `com.mylife.meerkat`.
2. Upload `SubscriptionKey_XXXX.p8` in the In-App Purchase key field (issuer id
   + key id from the same ASC page).
3. Project settings > API keys > copy the **public Apple SDK key** (starts
   `appl_`). The app validates that prefix (`app-unlock.ts` RC_KEY_PREFIX) and
   refuses a key that does not match it.

---

## Step 3: bake the two env values into the testflight profile

`extra.defaultRelayUrl` comes from `MEERKAT_DEFAULT_RELAY_URL` at build time
and defaults to '' (no out-of-box connectivity, by design);
`EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` is inlined at build. Both are non-secret (a
public wss address and RevenueCat's publishable SDK key), so the simplest
reproducible home is an `env` block on the testflight profile.

Edit `apps/meerkat/eas.json`:

```json
"testflight": {
  "extends": "production",
  "distribution": "store",
  "ios": { "image": "macos-sequoia-15.6-xcode-26.0" },
  "env": {
    "MEERKAT_DEFAULT_RELAY_URL": "wss://meerkat-relay-us.fly.dev",
    "EXPO_PUBLIC_MEERKAT_RC_KEY_IOS": "appl_XXXXXXXXXXXX"
  }
}
```

Optional now, useful once friends join: `MEERKAT_INSTALL_URL` set to the
TestFlight public link makes share/invite envelopes include the install step
(unset, they honestly omit it).

Notes:
- Updated 2026-09-04: every store-distributed profile, including `testflight`,
  runs [the store environment guard](../../apps/meerkat/scripts/check-build-env.mjs).
  The two values above are no longer sufficient: the guard also requires the
  configured HTTPS service/legal endpoints, pinned public-service keys and topics,
  and secure TURN configuration. Missing values stop the build before dependency
  installation and are listed by variable name. Supply the real configuration;
  do not insert placeholder endpoints to pass. No private-only capability profile
  is currently implemented.
- Never set `EXPO_PUBLIC_MEERKAT_TEST_MODE`.

Commit the eas.json change (Conventional Commits, branch off main if you treat
it as feature work; it is build config, `build(meerkat):` is fine).

---

## Step 4: build

```bash
cd apps/meerkat
npx eas-cli build --profile testflight --platform ios
```

- Credentials are stored (valid to 2027-03) and this lane has produced FINISHED
  builds three times (06cc1435, 3280ac53, 4e355d3e), so expect ~20-35 min.
- If it errors on provisioning with a missing Push Notifications capability
  (the 2026-08-01 failure mode), run the same command once WITHOUT
  `--non-interactive`, sign in to Apple when prompted, and let EAS regenerate
  the profile; then re-run.

---

## Step 5: submit and install

```bash
cd apps/meerkat
npx eas-cli submit --profile testflight --platform ios --latest
```

- `ascAppId 6800001912` and the team id are already in `eas.json`. When EAS
  asks for API credentials, use `AuthKey_XXXX.p8` (the App Store Connect API
  key from Step 2b, App Manager role), or sign in interactively.
- App Store Connect > Meerkat > TestFlight: the build appears as "Processing"
  (10-60 min). Export compliance (updated 2026-08-28): `ITSAppUsesNonExemptEncryption`
  is deliberately ABSENT from `app.json`. `true` without an
  `ITSEncryptionExportComplianceCode` is undeliverable (ITMS-90592 rejected
  build 12), Apple only issues codes for uploaded-documentation lanes
  (France/CCATS) which the app-level ASC encryption declaration (standard
  algorithms, distribution excludes France) concluded Meerkat does not need,
  and `false` would dishonestly skip the questionnaire. So each processed
  build shows "Missing Compliance" in TestFlight: click Manage, answer YES it
  uses encryption / standard algorithms / consistent with the saved
  declaration, and the build becomes testable.
- TestFlight > Internal Testing > create a group (e.g. "Founders"), add your
  Apple ID as tester, enable the processed build for the group.
- On your phone: install the TestFlight app, accept the invite, install
  Meerkat.

---

## Step 6: first run + sandbox purchase + two-device proof

1. Launch: age gate (neutral first-launch floor), then identity creation
   (device keypair, stored in the keychain).
2. Unlock: buy `meerkat_app_unlock`. TestFlight routes purchases to the
   SANDBOX automatically; you will not be charged. If the Unlock screen says
   purchase unavailable, the RC key is missing/typo'd (must start `appl_`) or
   the IAP is not yet metadata-complete; the copy is fail-closed, not a bug.
3. Connectivity: the connection status card runs a real `/healthz` probe
   against the baked relay URL and should show the reachable state. No probe
   pass = check the Step 1 URL responds over TLS.
4. Second device (pairing needs two): easiest is the web twin. Serve
   `apps/meerkat-web` on `127.0.0.1` (SubtleCrypto requires a secure context;
   localhost qualifies) or any HTTPS host, and point it at the same relay.
5. Pilot smoke, in order: add friend (QR or friend code over the relay), SAS
   emoji verify (now MANDATORY before community sync; unverified peers do not
   replicate communities), create a community, send channel messages both ways,
   send a DM, kill the app on one side and confirm the mailbox drains on
   relaunch. The scripted version is the tester guide sweep
   (`docs/guides/meerkat-friend-guide-2026-08-01.html` for friends).
6. Version rule: every pilot device must run a build from the SAME side of
   `cdfea6d6` (v1/v2 relay-token break, accepted in the rc19 ledger). Anyone
   installing this new build is automatically on the right side.

---

## Step 7: re-enable CI and finish the rc19 ledger (governance)

Not install-blocking, but rc19 cannot flip to verified without it:

1. github.com/settings/billing > fix Billing & plans (payment method).
2. Repo Settings > Actions > General > re-enable Actions (currently DISABLED
   at the repo level: `GET /actions/permissions` returns `enabled:false`, which
   is why the 2026-08-25 merge push created zero runs).
3. Dispatch, never with a hand-typed SHA:
   ```bash
   gh workflow run release-verify.yml -f sha=$(git rev-parse cdfea6d6)
   ```
4. Attach the run URL + conclusion to
   `docs/releases/meerkat/meerkat-2026-08-25-rc19/evidence.json` Step 1
   (or tell Claude to).

---

## What this pilot deliberately does NOT include

- The full compose topology (account service, hosted billing API, persona,
  directory, LiveKit calls, ClamAV/NCMEC pipeline): public-tier and calls
  infrastructure. The Plan 51 verification account and hosted subscription
  stay honestly `not_configured` in-app.
- Push wake (`MEERKAT_PUSH_GATEWAY_URL` unset => `registerPushWake` reports
  `not_configured`); the pilot uses foreground live-wake + drains.
- Native mesh rungs beyond relay (LAN/Nearby/BLE/WebRTC) work only in dev
  builds and are not required; relay is the pilot transport.
- App Store public release, legal page hosting, store review: launch-runbook
  Steps 3 and 16.
