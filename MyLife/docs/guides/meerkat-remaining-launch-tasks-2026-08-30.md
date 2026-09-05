# Meerkat: every remaining task to launch (2026-08-30)

Ordered by what unblocks what. Each task says who does it and how you know it is done.
State at time of writing: main `e14eeb46` pushed; TestFlight build 17 submitted (first
no-bypass, real-purchase build); relay live; Paid Apps Agreement Active.

---

# PART 0: get it on two phones for free (today, ~15 min)

**You do not pay $5.** TestFlight routes in-app purchases to Apple's SANDBOX. The purchase
sheet says `[Environment: Sandbox]` and no card is charged, for you or any tester. This is
Apple's intended mechanism, and it exercises the real entitlement path, which a bypass would not.

### 0.1 Clear a build's export compliance

You must repeat this for EVERY new build. It is not sticky. (Build 17 was already done for you
on 2026-08-30; these steps are for the next build.)

**Why it is needed:** Meerkat ships its own end-to-end encryption, so Apple requires an export
compliance answer before the build can be tested. Apple asks per build.

1. In a browser, sign in to App Store Connect and open the Meerkat TestFlight builds list
   directly:
   `https://appstoreconnect.apple.com/apps/6800001912/testflight/ios`
   (Or navigate: **appstoreconnect.apple.com** > **Apps** > **Meerkatts** > the **TestFlight**
   tab in the row of tabs next to the app name > **iOS** under **Builds** in the left sidebar.)
2. Scroll to the section headed **Version 1.0.0**. This is a table with the columns
   `BUILD | STATUS | GROUPS | INVITES | INSTALLS | SESSIONS | CRASHES | FEEDBACK`.
   Find the row for your build number. Its STATUS reads **Missing Compliance** with a blue
   **Manage** link next to it.
3. Click the **build number itself** (the blue number in the left BUILD column, e.g. `17`), NOT
   the Manage link. The Manage link opens the same dialog but is unreliable; the build's own page
   is the dependable route. You land on a page titled `1.0.0 (17)`.
4. On that page, top right, click the button labeled **`Provide Export Compliance Information`**.
   A dialog opens titled **`App Encryption Documentation`** with the question "What type of
   encryption algorithms does your app implement?" and four radio options.
5. Select the SECOND option, worded exactly:
   **`Standard encryption algorithms instead of, or in addition to, using or accessing the
   encryption within Apple's operating system`**
   (This is true: Meerkat uses X25519, Ed25519, XSalsa20-Poly1305, and HKDF-SHA512 from
   `@mylife/sync`, not only Apple's OS encryption.)
6. Click **`Next`**. The dialog now asks "Is your app going to be available for distribution in
   France?"
7. Select **`No`**, then click **`Save`**. (This matches the app-level declaration already saved
   under Distribution. If you later decide to distribute in France, that is a separate
   declaration, see 2.2.)

**Done when:** back on the builds list
(`https://appstoreconnect.apple.com/apps/6800001912/testflight/ios`), your build's STATUS reads
**`Ready to Submit`** and the GROUPS column shows **`B1`**. Builds join B1 automatically once
compliance clears.

**If the dialog does not open:** click the button a second time, or reload the build page first.
The App Store Connect dialog occasionally ignores the first click.

### 0.2 Install it on your iPhone and unlock it for free

**Nobody is charged.** TestFlight sends every in-app purchase to Apple's SANDBOX environment.
The confirmation sheet literally says `[Environment: Sandbox]` and no card is billed, ever, for
you or any tester. This is Apple's intended way to test purchases.

1. On your iPhone, open the **TestFlight** app (blue icon, white paper plane). If you do not have
   it, install "TestFlight" from the App Store first.
2. On the TestFlight home screen, find **Meerkatts** in the apps list. Tap it.
3. Tap **`UPDATE`** (or **`INSTALL`** if this is the first time). Wait for it to finish, then tap
   **`OPEN`**.
4. The app opens on a screen headed **Feed** with a card titled **"When were you born?"**. Enter
   your birth date in the Month / Day / Year boxes and tap **`Continue`**. (This is checked on
   the device and never sent anywhere.)
5. You reach the locked state. Tap the unlock entry point (a button reading
   **`Unlock for $4.99`** or **`Buy or restore unlock`**).
6. Apple's purchase sheet slides up. **Before confirming, check that it says
   `[Environment: Sandbox]`** near the top or bottom. That word Sandbox is your proof this is
   free. If it does NOT say Sandbox, stop and tell Claude; do not confirm.
7. Confirm the purchase with Face ID / Touch ID / your Apple ID password. You will not be
   charged.

**Done when:** the app opens fully and the bottom tab bar shows **Feed, Communities, Public,
Messages, Me**, and tapping into Communities lets you create one.

**If it says the purchase is unavailable:** most likely StoreKit has not finished propagating
your Paid Apps Agreement (it went Active on 2026-08-30). Wait a few hours and retry before
debugging anything. If it still fails, open the RevenueCat dashboard
(`https://app.revenuecat.com`) and look for an incoming sandbox transaction: no transaction at
all points at the app/key wiring, a failed transaction points at the App Store product.

### 0.3 Give a friend access

Which path you use depends on whether your friend is on your App Store Connect team.

**Path A, friend IS on your team (fastest, no review):**

1. Open `https://appstoreconnect.apple.com/access/users` (or: **appstoreconnect.apple.com** >
   **Users and Access** in the top nav).
2. Click the **`+`** next to the **Users** heading, enter their name and the Apple ID email they
   use, choose a role (**Developer** or **Marketer** is enough for testing), and click
   **`Invite`**. They must accept the emailed invitation before the next step.
3. Go to `https://appstoreconnect.apple.com/apps/6800001912/testflight/ios`. In the left sidebar
   under **INTERNAL TESTING**, click **`B1`**.
4. On the **Testers** tab, click the **`+`** next to the **Testers** heading. Tick your friend's
   row in the list, then click **`Add`**.
5. They receive a TestFlight email invitation. They install the TestFlight app, accept, install
   Meerkatts, and follow 0.2 from step 4. Their purchase is sandbox too, so also free.

**Path B, friend is NOT on your team (one-time review, then up to 10,000 testers):**

1. Same builds page, left sidebar under **EXTERNAL TESTING**, click **`A1`** (already created).
2. Add the build to that group and add your friend by email address.
3. Apple requires a one-time **Beta App Review** for external testing, usually 1 to 2 days. After
   it passes, external testers can install, and you can also enable a public invite link.

**Done when:** two separate devices are running the build, unlocked. Now you can run the real
pilot: add each other as friends by QR code or friend code, verify the five-emoji SAS, create a
community, send messages both directions, then force-quit one app and reopen it to confirm
parked messages arrive.

---

# PART 1: web payments (the other half of "users can use both")

Web does NOT use RevenueCat. It uses Stripe through your own hosted billing service, which is
not deployed. Until this is done web honestly reports "Hosted checkout is not configured in
this build" and no one can unlock on web.

### 1.1 Stripe account + two prices
stripe.com > create/sign in > **Products**. Create two prices and copy both IDs:
- one-time **$4.99** app unlock -> `STRIPE_APP_UNLOCK_PRICE_ID`
- recurring **$4.99/mo** hosted server -> `STRIPE_MONTHLY_PRICE_ID`
Founder-locked prices. Do not invent others. Also copy your **secret key** (`sk_live_...` or
`sk_test_...` while testing).

### 1.2 Generate an entitlement secret
Any high-entropy random string you keep private:
```bash
openssl rand -hex 32
```
This becomes `ENTITLEMENT_SECRET`. It signs entitlement tokens; rotating it invalidates them.

### 1.3 Get the RevenueCat REST key
app.revenuecat.com > Project settings > API keys > **REST API key** (not the `appl_` SDK key).
This is `REVENUECAT_REST_API_KEY`, and it is why mobile had to be set up first.

### 1.4 Deploy the hosted billing service
`packages/meerkat-relay/bin/meerkat-hosted-service.mjs`. It **refuses to boot** without all
seven of these, deliberately, so it can never take money it cannot honor:

```
ENTITLEMENT_SECRET          # 1.2
WEBHOOK_SECRET              # 1.5 (Stripe webhook signing secret)
STRIPE_SECRET_KEY           # 1.1
STRIPE_MONTHLY_PRICE_ID     # 1.1
STRIPE_APP_UNLOCK_PRICE_ID  # 1.1
REVENUECAT_REST_API_KEY     # 1.3
MEERKAT_ALLOWED_ORIGINS     # CORS allowlist; must include your web app's origin
```
Defaults: `PORT=8893`, `HOST=0.0.0.0`, `DATA_DIR=./.meerkat-hosted`.

Easiest host is the Fly account already running the relay. Ask a Claude session to write the
Dockerfile/fly.toml for this service; you supply the secrets via `fly secrets set` so they never
enter the repo. **Never commit these values.**

**Done when:** the service boots (no `missing_env` fatal) and answers over TLS on a stable
hostname.

### 1.5 Point Stripe's webhook at it
Stripe > Developers > Webhooks > add endpoint targeting the 1.4 service. Copy the **signing
secret** into `WEBHOOK_SECRET` and restart the service.

**Done when:** Stripe shows a successful test event delivery.

### 1.6 Point web at the service and rebuild
Set `VITE_MEERKAT_HOSTED_API_URL` to the 1.4 URL for the web build.

**Done when:** the web unlock section offers "Unlock for $4.99" instead of the not-configured
notice.

### 1.7 Prove the cross-surface link
A purchase on one surface does NOT unlock the other. Buy on one, mint a **link code**, redeem it
on the other ("Bought on another device? Enter a link code").

**Done when:** one purchase unlocks both surfaces. This is the step real users will otherwise
be confused by, so document it in your onboarding.

---

# PART 2: legal and safety (blocks PUBLIC launch, not private testing)

The private community layer can pilot without these. The **public tier** (publishing to
strangers, the public archive) cannot.

### 2.1 Engage counsel (blocks 2.2-2.5)
The single gating action. You need advice on entity formation, the DSA trader decision, your
public-content liability posture, and your privacy policy/terms.

### 2.2 Decide the DSA trader address
Currently **In Review** and reversible. Trader status publicly displays address, phone, and email
on your App Store product page, and the address on file is your **home address**. Options: a
business address, a registered-agent/virtual address, or withdrawing trader status and not
distributing in the EU. For a privacy product this deserves a deliberate choice.

### 2.3 NCMEC ESP registration
Weeks of lead time; start early. Required before hosting public user content in the US. The code
paths (reporting queue, hash matching) exist; the registration and a populated hash set do not.

### 2.4 DMCA designated agent
Register with the US Copyright Office (small fee). Required for safe-harbor protection once you
host public content.

### 2.5 Host the legal documents
Privacy policy, terms, community standards, support/appeals must be live at real HTTPS URLs.
Drafts exist at `docs/legal/meerkat`. The production build guard requires these URLs.

---

# PART 3: public-tier services (only if launching the public tier)

Each is a deploy plus credentials, in the same shape as the relay.

- **3.1 Public directory node** so Discover shows real communities instead of "Could not reach a
  public directory."
- **3.2 Account service** (Sign in with Apple/Google + blind credential) for the verification
  account and anti-sybil humanity gate.
- **3.3 Archive/seeder** for durable public content and always-on availability. Until deployed,
  library availability copy must stay "available from members who have it, when a sync connects."

---

# PART 4: capabilities that need infrastructure

- **4.1 LiveKit SFU + TURN** for calls and rooms. Without them the app honestly reports calls
  unavailable. TURN also fixes the STUN-only 1:1 gap (symmetric-NAT peers cannot connect today).
- **4.2 Push (APNs)** for real background wake.
- **4.3 Two-device evidence** for nearby/in-person pairing, background scheduling, and calls.
  None of these can be proven by tests.

---

# PART 5: product work (not launch blockers)

Plan 56 remaining chunks, roughly 8-10 weeks:
- **C3 Ambient + audio** (~3-4 wk): soundboard, profile songs, voice-note stickers, playlists,
  drawing and live co-decorating, the Plaza, contribution wall.
- **C4 Rules + rewards** (~3 wk): rule engine, slash commands, rewards, feed weight vectors.
- **C5 Pages + marketplace** (~3-4 wk): rich-page nodes, decoration packs and remix lineage,
  template gallery, webrings.

Plus the known follow-up: pack-precise sealed-asset block-FETCH bounding in `blob-transfer.ts`
(logged Unresolved in `errors_log.md`).

---

# The critical path, if you only do one thing at a time

1. **Part 0** today: two phones running build 17, free. This proves billing end to end.
2. **Part 2.1** (counsel) and **2.3** (NCMEC) next, because they have the longest lead times and
   everything public waits on them.
3. **Part 1** (web payments) when you want web users.
4. **Parts 3 and 4** only when you launch the public tier or need calls.
5. **Part 5** whenever; it is product, not launch.

You can pilot the private community layer with only Part 0 done. That is the wedge: a real,
end-to-end-encrypted community app on a deployed relay, honest about everything it cannot yet do.
