# Meerkat Launch Execution Guide

Date: 2026-07-21
Bound to: active candidate `meerkat-2026-07-21-rc12` at `985a7dc7` (runbook: `docs/guides/meerkat-production-activation-runbook-2026-07-15.md`)
Audience: the founder. Every action below is written so you can execute it directly. Where an action says "Tell Claude", paste the listed values into a Claude Code session in this repo and Claude performs the repo/ledger side.

How to use this guide:

1. Work top to bottom. Steps 1-3 and the two long-lead items (attorney, NCMEC) come first; steps 4-8 build the production platform; steps 9-16 prove it; steps 17-18 launch it.
2. The runbook remains the contract; this guide is the click-by-click expansion. When this guide and the runbook disagree, the runbook wins. Evidence always lands in `docs/releases/meerkat/<active-rc>/evidence.json`.
3. Change freeze rules still apply: if any step forces a code or CI change, Claude cuts a new rc at the new SHA and re-dispatches `release-verify` before that step's evidence counts.
4. Never paste secrets into chat, the repo, or the ledger. Secrets go into the secret manager (Step 4/5); everything else (ids, URLs, digests) is safe to paste to Claude.

Legend: [YOU] founder action in a browser/console/device. [CLAUDE] done by Claude in-session with your ids. [YOU+CLAUDE] interactive.

## Critical path and parallel tracks

Do these in parallel starting today:

- Track A (longest lead, external): Step 2 attorney engagement, then Step 3 with counsel. Start now.
- Track B (long lead, external): NCMEC CyberTipline ESP registration (Step 9 prerequisite). Start now; it can take weeks.
- Track C (mechanical, you alone): Step 4 account creation and Step 5/6 provisioning. Can start immediately; nothing in it waits on counsel except retention-schedule approval.
- Track D (device logistics): make sure you have an iPhone + an Android phone available for Steps 11-12, plus real payment instruments for Step 10.

Steps 7-8 wait on 4-6. Steps 9-16 wait on 7-8 (except the NCMEC registration lead time in Track B). Step 15 includes a 48-hour wall-clock soak; schedule it. Steps 17-18 close.

## Step 1: select the immutable release candidate (PASS, nothing to do)

Status: PASS at rc12 (`985a7dc7`) on 2026-07-21; full-matrix release-verify 10/10 green plus push CI green under live branch protection. Exception rc10-exc-1 (PR path waived, solo operation) is signed and recorded.

Only action for you: none, unless a later step forces a code change. Then:

1. [CLAUDE] fixes, commits, and pushes; Claude runs `gh workflow run release-verify.yml -f sha=$(git rev-parse <ref>)` (never a hand-typed SHA), monitors both runs, cuts the new rc directory superseding rc12, and re-flips Step 1.
2. [YOU] nothing except approving the fix.

## Step 2: assign accountable owners and freeze launch changes (one open item)

Everything is recorded except the counsel naming. The freeze started 2026-07-18. Exception rc8-exc-2 (no backup rollback human) is signed.

### 2.1 Engage the attorney (the single blocking action)

1. [YOU] Pick a lawyer. You need startup/product counsel comfortable with: consumer apps with UGC, DMCA safe harbor, privacy (GDPR/CCPA exposure decisions), minors/age-gating, and ideally E2E-encrypted products. Sources, in order of speed:
   - Referral from any founder you know who has shipped a consumer app.
   - Firms with startup packages that do flat-fee product-launch reviews (for example Wilson Sonsini, Cooley, Gunderson have startup groups; smaller boutique firms are cheaper and fine for this scope).
   - Marketplace fallback: an attorney on a platform like Priori or Axiom with consumer-app launch experience.
2. [YOU] Scope the engagement in the first email so it is quotable as a flat or small fixed package. Copy this scope text:
   "One-founder consumer messaging app (E2E encrypted, UGC public layer) preparing a production launch. Need: (1) entity formation or confirmation; (2) review + approval of seven drafted policy documents (Terms, Privacy, Community Standards, Safety/Appeals, Law Enforcement Guidelines, DMCA Policy, data-deletion instructions); (3) rulings on a 13-item open-decision agenda including minimum age, privacy regime scope, CSAM reporting duties, export classification confirmation, auto-renewal commerce terms, and purchase-rail policy; (4) DMCA agent registration; (5) sign-off recorded with version ids and effective dates. All drafts and a code-verified product-behavior fact sheet are prepared; estimated a few hours of review plus rulings."
3. [YOU] Attach or link the consult package when they accept: `docs/reports/REPORT-meerkat-legal-readiness-2026-07-18.html` (the whole consult prep: facts, agenda, drafts) plus the rendered draft pages in `docs/legal/meerkat/` (run `node docs/legal/meerkat/render-legal-pages.mjs` and send the HTML files, or host them on a private URL).
4. [YOU] Tell Claude: "Counsel engaged: <name, firm, email>." [CLAUDE] records them as legal + privacy lane owner in the ledger, closes Step 2's open item, flips Step 2 to PASS, re-renders the summary + dashboard.

Exit gate check: every lane has an accepting owner; backup coverage by exception. Done when 2.1.4 lands.

## Step 3: approve and publish legal and safety policy

Prerequisite: Step 2.1 (counsel engaged). All seven documents are already drafted and staged at `docs/legal/meerkat/` with DRAFT banners. This step is the counsel loop plus publication.

### 3.1 Entity decision (first, everything cascades from it)

1. [YOU+counsel] Decide entity type, state, and exact legal name (agenda item 1). A single-member Delaware or home-state LLC is the typical shape for this; counsel decides.
2. [YOU] If forming new: counsel or a service files it; get the EIN from the IRS (free, online, minutes) at https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online.
3. [YOU] Record: legal name, entity type, state, formation date, EIN, registered address. You will re-enter these in the DMCA filing, Apple, Google, Stripe, and NCMEC registrations, so keep them in your password manager as a note.

### 3.2 The counsel session (agenda items 2-13)

1. [YOU] Book one working session with counsel. The agenda is Section 4 of the legal readiness report; the 13 items in one line each:
   1 entity (done in 3.1), 2 DMCA agent + repeat-infringer policy, 3 export classification (ECCN 5D992.c self-classification + annual BIS report + ASC questionnaire + French declaration if distributing in France), 4 minimum age (MEERKAT_MINIMUM_AGE, default 13, clamped 13-21), 5 privacy regime scope (GDPR/CCPA, launch jurisdictions), 6 CSAM reporting duties (18 U.S.C. 2258A, 90-day preservation), 7 Section 230 posture incl. self-host mode, 8 E2EE policy environment (EU CSA, UK OSA; exclude jurisdictions?), 9 clickwrap enforceability (version 2026-07, re-acceptance triggers), 10 auto-renewal/refund commerce terms, 11 store compliance package, 12 law-enforcement process handling, 13 purchase-rail policy (store-only unlock proposal).
2. [YOU] Capture counsel's ruling on each item in writing (email summary is fine).
3. [YOU] Tell Claude the rulings, especially: the age floor number, jurisdiction scope, purchase-rail decision (item 13, this may disable the web Stripe unlock path, which is a code change and cuts a new rc), and any wording changes to the seven documents.

### 3.3 DMCA agent registration

1. [YOU] Go to https://dmca.copyright.gov/ and create an account for the entity.
2. [YOU] Register the designated agent ($6, about 15 minutes). You need: entity legal name (3.1), any alternate names (register "Meerkat" as an alternate name of the entity), agent name + address + phone + email. Use a role email you will keep (for example dmca@ your production domain).
3. [YOU] Save the registration confirmation and the exact registered values.
4. [YOU] Tell Claude the six values: organization, name, address, phone, email, and the registration reference. [CLAUDE] stages them as the `MEERKAT_DMCA_AGENT_*` production env values (Step 6/7 config) and syncs `dmca-policy.md` so the published identity is identical.

### 3.4 Finalize and publish the seven documents

1. [YOU+counsel] Counsel approves each document (with 3.2 rulings applied). Get: approval statement, version id, effective date for each.
2. [YOU] Tell Claude each approval. [CLAUDE] fills the bracketed fields, flips each frontmatter `status` off DRAFT, sets effective dates, re-renders with `node docs/legal/meerkat/render-legal-pages.mjs`.
3. [YOU] Decide the production domains now if not owned (needed here and for Step 5). Buy the apex you want (registrar of choice; keep it in the Step 4 account set). The legal pages need stable HTTPS URLs like `https://<domain>/legal/terms`.
4. [YOU+CLAUDE] Host the rendered pages. They are fully self-contained static HTML; any static host works. The simplest paths: host them on the same edge/web deploy from Step 7, or on a static host (Cloudflare Pages / Netlify) pointed at the production domain now, before the app stack exists. Claude prepares the upload bundle; you connect the host to the domain.
5. [YOU] Verify each URL from a logged-out desktop browser AND a phone on cellular (not your wifi). Screenshot each (URL bar + padlock visible).
6. [YOU] Tell Claude: the final URLs + screenshots. [CLAUDE] records Step 3 evidence (counsel approvals, version ids, effective dates, URLs, TLS screenshots, DMCA registration reference) in the ledger and sets `MEERKAT_TERMS_URL`, `MEERKAT_PRIVACY_POLICY_URL`, `MEERKAT_COMMUNITY_STANDARDS_URL`, `MEERKAT_SUPPORT_URL` (and `VITE_` twins) in the production config set.

### 3.5 Export classification founder-ops

1. [YOU+counsel] Confirm the mass-market self-classification (ECCN 5D992.c) applies (agenda item 3).
2. [YOU] Send the annual self-classification report email to BIS + NSA per EAR 740.17(b)(1)/742.15(b): a CSV of product name/ECCN/entity emailed to crypt@bis.doc.gov and enc@nsa.gov (counsel confirms format; due by Feb 1 for the prior year, send the initial one now).
3. [YOU] If distributing in France, file the French import declaration (counsel handles or provides the ANSSI form).
4. [YOU] Keep the ASC encryption questionnaire answers counsel approves; you will enter them in Step 16.

Exit gate check: all documents approved, public, internally consistent, matching product behavior; DMCA agent registered and identical everywhere; export classification resolved. [CLAUDE] verifies consistency rules (report categories = `PublicReportReason`, deletion steps = `DELETE_MY_DATA_COPY`, DMCA windows 5/14, terms version 2026-07) before flipping Step 3 to PASS.

## Step 4: create production accounts and secure access

All you, mostly form-filling. Budget a half day. Use the entity identity from 3.1 everywhere, a dedicated work email (create one on the production domain first if possible, for example founder@<domain>), and hardware-key MFA wherever supported.

### 4.1 Buy the security hardware

1. [YOU] Buy two hardware security keys if you do not own them (YubiKey 5 series or Google Titan; one primary, one backup stored separately).

### 4.2 Create the accounts

Create each with the work identity, enable the strongest MFA offered (hardware key first, TOTP fallback), and file recovery codes offline (printed or on an encrypted USB, stored where you keep passports; never in cloud notes):

1. [YOU] Cloud/host provider + container registry (decided in Step 5.1; account can be created here).
2. [YOU] DNS registrar for the production domain (from 3.4.3).
3. [YOU] Managed PostgreSQL 17 provider and S3-compatible object storage (Step 5.1 decision).
4. [YOU] KMS / secret manager (usually part of the cloud provider).
5. [YOU] Monitoring + alerting (must be able to page your phone: PagerDuty free tier, or the provider's alerting to a phone-push app).
6. [YOU] Apple Developer Program, $99/yr, as the entity (D-U-N-S number required for org accounts; solo alternative is an individual account but the entity account matches the legal docs): https://developer.apple.com/programs/enroll/
7. [YOU] Google Play Console, $25 one-time: https://play.google.com/console/signup (entity account; Google may require a DUNS too since 2024).
8. [YOU] Stripe (entity, live mode activated: business details, bank account).
9. [YOU] RevenueCat (free tier is fine to start).
10. [YOU] Google Cloud console project (for Drive OAuth + FCM + Play API), Dropbox developer, Microsoft Entra (OneDrive), Box developer accounts.
11. [YOU] LiveKit Cloud account.
12. [YOU] Cloudflare account (free tier) for Turnstile, the humanity-gate CAPTCHA (fail-closed dependency of the public layer).
13. [YOU] Support inbox: a real mailbox for the MEERKAT_SUPPORT_URL contact + dmca@ + security@ on the production domain (Google Workspace or any host; aliases to one inbox are fine).

### 4.3 Access hygiene

1. [YOU] No shared personal credentials: every one of these is the work identity, not tshuldberg999@gmail.com.
2. [YOU] Write the break-glass note (where the backup key and recovery codes live, how a locked-out founder recovers each account) and store it offline next to the backup key.
3. [YOU] Tell Claude the account inventory (provider names + account ids/emails only, NO credentials). [CLAUDE] records the redacted inventory, role matrix, and MFA status as Step 4 evidence.

Exit gate check: no production system on a shared personal credential; MFA everywhere; recovery codes offline; break-glass written.

## Step 5: provision the production data and network plane

Prerequisite: Step 4 accounts. Recommended stack (single vendor, meets every Step 5 exit-gate requirement): AWS. Budget alternative if you prefer: Hetzner VM + Crunchy Bridge Postgres + Backblaze B2; the instructions below name the AWS console paths, the alternative maps 1:1. Tell Claude which you chose; Claude prepares every command and config for that choice.

The deploy shape is fixed by the repo: one Docker Compose topology (`packages/meerkat-relay/deploy/compose.production.yml`, 15 services incl. Caddy edge, LiveKit, ClamAV) on a VM, plus managed PostgreSQL 17, versioned S3 storage, and the separate Plan 51 account service.

### 5.1 Domains and DNS

1. [YOU] In the registrar (Step 4.2.2), create the DNS zone for the production apex. You need one subdomain per edge route plus three extras. Write these down; they become the compose env values:
   - `relay.<domain>` (RELAY_DOMAIN), `humanity.<domain>`, `hosted.<domain>`, `persona.<domain>`, `community.<domain>`, `directory.<domain>`, `moderation.<domain>`, `livekit.<domain>`
   - `account.<domain>` (Plan 51 account service), `app.<domain>` (meerkat-web), `<domain>/legal/*` or `legal.<domain>` (Step 3 pages)
2. [YOU] Point every name at the VM's IP (created in 5.4) with A/AAAA records once it exists. Caddy auto-provisions TLS via ACME; no manual certificates.

### 5.2 PostgreSQL 17

1. [YOU] AWS console > RDS > Create database: PostgreSQL 17, Multi-AZ deployment (HA), automated backups ON with the max retention you accept (PITR comes free with automated backups + WAL), storage encryption ON, deletion protection ON, NOT publicly accessible (same VPC as the VM).
2. [YOU] Create the master credentials into Secrets Manager (RDS offers this natively).
3. [YOU] Download the RDS CA bundle (global-bundle.pem); it becomes the `postgres_ca` mounted secret (`MEERKAT_POSTGRES_SSL_MODE=verify-full` is forced in production; boot fails without the CA).
4. [YOU] Paste to Claude: endpoint hostname, region, instance id. [CLAUDE] prepares per-service connection URLs for the 23 least-privilege roles (Step 8) and the monitoring config.

### 5.3 Object storage

1. [YOU] S3 > Create bucket (same region): Versioning ENABLED (required), default encryption ON, Block Public Access ON, server access logging ON to a second log bucket, lifecycle rule per the retention schedule counsel approved, and Cross-Region Replication to a second-region bucket (the regional-recovery path Step 13 drills).
2. [YOU] Create an IAM user/role scoped to this bucket only; access key + secret key go into Secrets Manager (they mount as `object_store_access_key`/`object_store_secret_key` files).
3. [YOU] Paste to Claude: bucket name, region, endpoint. [CLAUDE] sets `MEERKAT_OBJECT_STORE_ENDPOINT/REGION/BUCKET` (+ `FORCE_PATH_STYLE` as needed).

### 5.4 Compute, registry, operator network

1. [YOU] EC2 > Launch instance: Ubuntu LTS or Amazon Linux, 8 vCPU / 16 GB to start (LiveKit media + ClamAV are the heavy tenants), 200 GB gp3, Elastic IP attached. Security group: inbound 80/443 (TCP) from anywhere, 7881 (TCP+UDP) and 50000-50100 (UDP) from anywhere (LiveKit RTC), 22 from your IP only.
2. [YOU] Install Docker + compose plugin (Claude gives the exact one-liner for the distro).
3. [YOU] ECR > Create two private repositories: `meerkat-relay`, `meerkat-platform`.
4. [YOU] Operator network: install Tailscale (simplest) on the VM and your laptop/phone. The Tailscale CIDR (100.64.0.0/10 or your tailnet range) becomes `MODERATION_ALLOWED_CIDRS`; the moderation console is then reachable only over it. Alternative: WireGuard, same outcome.
5. [YOU] Paste to Claude: instance IP, tailnet CIDR, ECR registry URL.

### 5.5 KMS, secrets, monitoring, clocks

1. [YOU] Secrets Manager is the custody home for everything from Step 6 (OAuth secrets, APNs key, FCM JSON, VAPID key, operator secrets, DB credentials, S3 keys). Claude will name each secret; you create/paste values when instructed (Step 6).
2. [YOU] CloudWatch: enable detailed monitoring on the instance + RDS; create an SNS topic wired to your phone. Alarms Claude will define: instance down, RDS failover/storage, disk > 80%, healthcheck failures, backup failure. Pages the phone per the Step 2 escalation commitment (15 min in launch window).
3. [YOU] Clocks: the VM uses chrony/systemd-timesyncd by default; Claude adds an NTP-drift alarm (signed requests and nonce windows are time-sensitive).
4. [YOU] Approve in writing (message to Claude): the retention and deletion schedules from counsel (Step 3) before they are configured on the bucket and database.

Exit gate check: data plane meets availability, privacy, retention, recovery requirements BEFORE any app service deploys. [CLAUDE] records resource ids, regions, topology diagram, TLS report, backup policy, versioning proof, key ids, monitoring links in the ledger.

## Step 6: register external providers and load secrets

Prerequisite: Step 4 accounts, Step 5 secret manager. Identifiers below are the exact names the code reads. Secrets always land in the secret manager as mounted files (`*_FILE` vars), never in chat, env dumps, or the repo.

App identity constants you will enter everywhere: iOS bundle id `com.mylife.meerkat`, Android package `com.mylife.meerkat`, deep-link scheme `meerkat://`, OAuth redirect `meerkat://oauth/connect/complete`.

### 6.1 Google Drive OAuth client

1. [YOU] In the Google Cloud project (Step 4.2.10): APIs & Services > enable "Google Drive API".
2. [YOU] OAuth consent screen: External, app name Meerkat, support email your support inbox, scope `https://www.googleapis.com/auth/drive.file`, then submit for verification (drive.file is non-sensitive in most flows; Google may still ask for the app homepage + privacy URL, use the Step 3 URLs).
3. [YOU] Credentials > Create credentials > OAuth client ID > type iOS (bundle `com.mylife.meerkat`) and Android (package + SHA-1 from EAS credentials), plus a Web application client for the relay broker with the redirect the broker uses (Claude provides the exact broker redirect URL from the production domain when configuring).
4. [YOU] Paste the client id(s) to Claude; put the client secret (web client) into the secret manager as the file for `MEERKAT_OAUTH_GOOGLE_CLIENT_SECRET_FILE`.
5. [CLAUDE] sets `MEERKAT_GOOGLE_DRIVE_CLIENT_ID` (app build) and `MEERKAT_OAUTH_GOOGLE_AUTH_URL/TOKEN_URL/CLIENT_ID/REDIRECT_ALLOWLIST/SCOPES` (relay broker).

### 6.2 Dropbox OAuth client

1. [YOU] https://www.dropbox.com/developers/apps > Create app > Scoped access > Full Dropbox (folder boundary enforced app-side) > name Meerkat.
2. [YOU] Permissions tab: enable `files.content.read`, `files.content.write`, `files.metadata.read`, `account_info.read`. Settings tab: add redirect URI `meerkat://oauth/connect/complete` plus the web broker redirect Claude gives you.
3. [YOU] Paste the app key to Claude; app secret into the secret manager (`MEERKAT_OAUTH_DROPBOX_CLIENT_SECRET_FILE`). [CLAUDE] sets `MEERKAT_DROPBOX_CLIENT_ID` + `MEERKAT_OAUTH_DROPBOX_*`.

### 6.3 Microsoft OneDrive OAuth client

1. [YOU] https://entra.microsoft.com > App registrations > New registration > name Meerkat, accounts: personal Microsoft accounts + org accounts.
2. [YOU] Add platform: Mobile and desktop with redirect `meerkat://oauth/connect/complete`; add Web with the broker redirect. API permissions: Microsoft Graph delegated `Files.ReadWrite.AppFolder`, `offline_access`.
3. [YOU] Certificates & secrets: create a client secret, put it in the secret manager (`MEERKAT_OAUTH_ONEDRIVE_CLIENT_SECRET_FILE`). Paste the Application (client) ID to Claude. [CLAUDE] sets `MEERKAT_ONEDRIVE_CLIENT_ID` + `MEERKAT_OAUTH_ONEDRIVE_*`.

### 6.4 Box OAuth client

1. [YOU] https://app.box.com/developers/console > Create Platform App > Custom App > User Authentication (OAuth 2.0) > name Meerkat.
2. [YOU] Configuration: redirect URIs `meerkat://oauth/connect/complete` + broker redirect; scope: read/write all files (`root_readwrite`; the adapter enforces the folder boundary).
3. [YOU] Paste client id to Claude; client secret to the secret manager (`MEERKAT_OAUTH_BOX_CLIENT_SECRET_FILE`). [CLAUDE] sets `MEERKAT_BOX_CLIENT_ID` + `MEERKAT_OAUTH_BOX_*`.

### 6.5 Apple: iCloud, APNs, Sign in with Apple

1. [YOU] developer.apple.com > Certificates, Identifiers & Profiles > Identifiers: confirm/create the App ID `com.mylife.meerkat` with capabilities iCloud (CloudKit/Documents), Push Notifications, Sign in with Apple, App Groups (`group.com.mylife.meerkat`), Associated Domains.
2. [YOU] Identifiers > iCloud Containers: create `iCloud.com.mylife.meerkat`; assign it to the App ID. Paste the container id to Claude (`MEERKAT_ICLOUD_CONTAINER_ID`).
3. [YOU] Keys > create an APNs key (Apple Push Notifications service). Download the `.p8` ONCE, store it in the secret manager as the `MEERKAT_PUSH_APNS_KEY_FILE` secret; paste the Key ID and your Team ID to Claude (`MEERKAT_PUSH_APNS_KEY_ID`, `MEERKAT_PUSH_APNS_TEAM_ID`; topic is the bundle id).
4. [YOU] Identifiers > Services IDs: create the Sign in with Apple service id (for example `com.mylife.meerkat.signin`), enable Sign in with Apple, configure the account-service return URL Claude gives you. Paste the service id to Claude (app `MEERKAT_APPLE_SERVICE_ID`; account service `MEERKAT_APPLE_SERVICE_IDS`).
5. [YOU] Later, once the app record exists (Step 6.9): App Store Connect > App Information > App Store Server Notifications: set the production URL to `https://account.<domain>/api/account/entitlements/apple`. Claude configures `MEERKAT_ASSN_ROOT_CA` (Apple root CA PEM) so notification signatures verify.

### 6.6 Google: FCM + Sign-in client

1. [YOU] In Firebase console (same Google account): create project Meerkat, add Android app `com.mylife.meerkat`. Project settings > Service accounts > Generate new private key; the JSON goes into the secret manager as `MEERKAT_PUSH_FCM_SERVICE_ACCOUNT_FILE`.
2. [YOU] In Google Cloud Credentials: create the Sign-in OAuth client for the account service (Web application type; redirect = the account-service callback URL Claude gives you). Paste the client id to Claude (app `MEERKAT_ACCOUNT_GOOGLE_CLIENT_ID`; account service `MEERKAT_GOOGLE_CLIENT_IDS`).
3. [YOU] Play billing notifications (after Step 6.9 products exist): Play Console > Monetize > Monetization setup > Real-time developer notifications: create a Cloud Pub/Sub topic and a push subscription targeting `https://account.<domain>/api/account/entitlements/google` with an OIDC token; Claude sets `MEERKAT_PLAY_RTDN_AUDIENCE` to match.

### 6.7 Web push VAPID

1. [CLAUDE] generates the ES256 VAPID keypair directly into the secret manager (`MEERKAT_PUSH_VAPID_PRIVATE_KEY_FILE`) and sets `MEERKAT_PUSH_VAPID_SUBJECT` to `mailto:` your support inbox. Nothing for you beyond approving.

### 6.8 LiveKit

1. [YOU] cloud.livekit.io > create production project Meerkat. Copy the project WebSocket URL (`wss://<project>.livekit.cloud`) to Claude (`MEERKAT_LIVEKIT_URL`); API key + secret into the secret manager.
2. [YOU] If counsel/you decided on self-hosted TURN instead, tell Claude; `MEERKAT_TURN_URL/USERNAME/CREDENTIAL` get set from the secret manager. Default STUN is Google's public server; production keeps LiveKit Cloud TURN.

### 6.9 Store products and billing (founder-locked pricing)

Pricing is locked: app unlock $4.99 one-time; hosted subscription $4.99/mo, storage included. Do not invent other prices or tiers.

The product ids are hardcoded in `packages/billing-config`: `meerkat_app_unlock` (non-consumable, $4.99) and `meerkat_hosted_monthly` (auto-renew subscription, $4.99/mo). Use these EXACT ids in both stores.

1. [YOU] App Store Connect > My Apps > New App (iOS, `com.mylife.meerkat`, name Meerkat). In-App Purchases: non-consumable `meerkat_app_unlock`, price $4.99. Subscriptions: auto-renewable `meerkat_hosted_monthly`, $4.99/month, its own subscription group.
2. [YOU] Play Console > Create app (`com.mylife.meerkat`). Monetize > Products: one-time in-app product `meerkat_app_unlock` $4.99; subscription `meerkat_hosted_monthly` $4.99/month.
3. [YOU] RevenueCat: create project Meerkat, add both store apps, paste the public SDK keys to Claude (`EXPO_PUBLIC_MEERKAT_RC_KEY_IOS`, `EXPO_PUBLIC_MEERKAT_RC_KEY_ANDROID`); the REST API key goes to the secret manager (`REVENUECAT_REST_API_KEY` for the hosted service). Attach both products to the entitlement Claude confirms.
4. [YOU] Stripe live mode: create the hosted subscription product/price ($4.99/mo) and, only if counsel kept the web unlock rail (agenda item 13), the one-time unlock price. Paste the price ids to Claude (`STRIPE_MONTHLY_PRICE_ID`, `STRIPE_APP_UNLOCK_PRICE_ID`); secret key + webhook signing secret into the secret manager (`STRIPE_SECRET_KEY`, `WEBHOOK_SECRET`, `MEERKAT_STRIPE_WEBHOOK_SECRET`). Stripe webhook endpoint: `https://account.<domain>/api/account/entitlements/stripe`.
5. [YOU] App Store Server API key (App Store Connect > Users and Access > Integrations) and a Play Developer API service account (Play Console > API access): both into the secret manager for the account-service entitlement binding.

### 6.11 Cloudflare Turnstile (humanity gate)

1. [YOU] Cloudflare dashboard > Turnstile > Add site: hostnames `app.<domain>` + the mobile widget mode. Paste the site key to Claude (`MEERKAT_TURNSTILE_SITE_KEY` / `VITE_MEERKAT_TURNSTILE_SITE_KEY`); the secret key goes to the secret manager (`TURNSTILE_SECRET`, humanity service, fail-closed).

### 6.10 Account service secrets

1. [CLAUDE] generates `MEERKAT_ACCOUNT_SESSION_SECRET` and `MEERKAT_ACCOUNT_EPOCH_KEY_SECRET` directly into the secret manager, plus the OAuth KMS key (`MEERKAT_OAUTH_KMS_KEY_FILE`, 32 bytes) and push token keys (`MEERKAT_PUSH_TOKEN_KEYS_DIR` + `MEERKAT_PUSH_TOKEN_ACTIVE_VERSION`).
2. [YOU] Confirm rotation ownership: a calendar reminder per key family (quarterly review is fine) and expiry alerts in the monitoring tool.

Exit gate check: every provider production-approved, exact identifiers match the candidate configuration, zero placeholders. [CLAUDE] renders the provider inventory (ids, allowlists, key versions, owners, rotation dates) into the ledger.

## Step 7: deploy the complete topology by immutable digest

Prerequisites: Steps 5-6 complete. The topology is `packages/meerkat-relay/deploy/compose.production.yml`: Caddy edge, relay, humanity, hosted, persona, push, account, directory, community, LiveKit + egress + redis, ClamAV, archive-scanner, archive-seeder, ncmec-filer. Two networks (public edge, private internal); every stateful service boots fail-closed in `MEERKAT_DEPLOYMENT_PROFILE=first-party` + `MEERKAT_STORE_BACKEND=postgres`.

The Plan 51 account service (`bin/meerkat-account-service.mjs`, persona-service lineage, never merged into the slim relay image) is wired into compose as the `account` service: port 8896, `ACCOUNT_DOMAIN` Caddy route, `ACCOUNT_DATABASE_URL` on the meerkat_account role, session + epoch secrets required at boot, SSO and entitlement rails honest-OFF until the Step 6 values land AND the founder-ops payload resolvers are wired (transport secrets alone never turn a rail on; the ready log names the real state per rail), and the Apple ASSN root CA mounted via the `assn_root_ca` secret (`ACCOUNT_ASSN_ROOT_CA_HOST_FILE` on the host, `MEERKAT_ASSN_ROOT_CA_FILE=/run/secrets/assn-root-ca.pem` in the container). The production-topology test pins this shape.

1. [CLAUDE] dispatches `.github/workflows/release-images.yml` at the release SHA. CI builds all images, generates SPDX SBOMs, runs blocking Grype scans, signs with cosign (GitHub OIDC keyless), attests SLSA provenance, and emits the draft release manifest with exact digests. No hand-built images.
2. [YOU] On the VM (over Tailscale/SSH): log Docker into the registry (Claude gives the exact `docker login` + pull commands pinned BY DIGEST, never by tag).
3. [CLAUDE] renders the production env file for compose from everything collected in Steps 3-6 (domains, DB URLs per role, S3 config, DMCA values, provider ids, secret file paths). You place the mounted secret files (Claude lists each path under the compose `secrets:` map, e.g. `postgres-ca.pem`, `push-apns-key`, `oauth-*-client-secret`, `ncmec-filing-api-token`).
4. [YOU] Run the bring-up (Claude provides verbatim): `docker compose -f compose.production.yml --env-file <prod-env> up -d`, then watch `docker compose ps` until every service is healthy. Edge stays blocked until scanner, seeder, and filer dependencies are healthy by design.
5. [YOU+CLAUDE] Verify, and capture output for the ledger:
   - `/healthz` on relay (two-field response only) and `/readyz` on every stateful service via the public domains (TLS live).
   - Operator-network denial proof: request `moderation.<domain>` from a non-tailnet network, expect 403; then from the tailnet, expect the console.
   - Dependency-failure proof: stop clamav, watch archive-scanner go unready and edge refuse, restart.
   - No runtime package installs: images are pinned-digest, read-only rootfs on the slim relay.
6. [YOU+CLAUDE] Deploy meerkat-web: Claude builds the Vite bundle with the production `VITE_MEERKAT_*` values and the production CSP; you serve it at `app.<domain>` (static host or the edge). The legal pages from Step 3 live beside it.

Exit gate check: deployed digest set exactly matches the release manifest; every service healthy; no file/in-memory authority anywhere in first-party production.

## Step 8: run migrations and prove least privilege

Prerequisite: Step 7 deployed (or at minimum the database reachable from the VM). Fresh production means a clean PostgreSQL: migrations 0001-0018 run in order; the file-to-postgres cutover CLI (`meerkat-postgres-cutover`) is NOT needed because no file-mode production state exists. If that ever changes, `docs/guides/meerkat-postgres-cutover-runbook.md` is the script.

1. [YOU+CLAUDE] Staging rehearsal first (runbook requirement): restore a snapshot of the empty-but-initialized production instance (or a scratch RDS instance from the same engine version), run against it:
   - `pnpm --filter @mylife/meerkat-relay exec meerkat-postgres-migrate --status`
   - `... --migrate` and record checksums + durations from the output.
2. [YOU] Approve the production maintenance window (for a pre-launch system this is a formality; say "go" to Claude).
3. [CLAUDE] runs the production migration with the owner role, then generates and applies the least-privilege grants:
   - `MEERKAT_POSTGRES_OWNER_ROLE=meerkat_owner node bin/meerkat-postgres-role-grants.mjs > grants.sql && psql -U meerkat_owner -f grants.sql`
   - Creates the per-service LOGIN roles (meerkat_community, meerkat_persona, meerkat_hosted, meerkat_moderation, meerkat_push, meerkat_directory, meerkat_archive*, meerkat_account, meerkat_ops, meerkat_observer, meerkat_backup_digest, ...) with passwords in the secret manager.
4. [CLAUDE] runs the positive/negative proofs from each service identity and captures output: allowed operations succeed (e.g. community SELECT on community.publications); prohibited ones fail (e.g. community DELETE on persona.records denied; meerkat_account cannot touch persona/community/moderation schemas per the AC-2 wall).
5. [CLAUDE] verifies the NCMEC, archive lifecycle, OAuth custody, hosted storage, release, promotion, and backup evidence tables exist and are constrained (migration 15 CHECK: `filed` requires provider_ref + filed_at).

Exit gate check: schema + grants match the release SHA, every negative control fails as expected, no service connects as owner/superuser. Your only actions: the window approval and pasting any credentials Claude cannot mint.

## Step 9: activate malware, abuse, NCMEC, DMCA, and moderation operations

Two external dependencies here have WEEKS of lead time; if you have not started them, do it today (they run in parallel with Steps 4-8):

### 9.1 NCMEC CyberTipline ESP registration (start immediately)

1. [YOU] Email the NCMEC ESP team (espteam@ncmec.org) or use the registration path at https://report.cybertip.org to register the entity (3.1) as a reporting Electronic Service Provider. You will need: entity name and address, point of contact (you), and a description of the service. Ask explicitly for API (programmatic) reporting access to the CyberTipline.
2. [YOU] When approved, you receive API credentials. Put the API token in the secret manager (mounts as `ncmec-filing-api-token`), and give Claude the API endpoint URL for `MEERKAT_NCMEC_FILING_ENDPOINT`.
3. [CLAUDE] configures the filer, which only marks `filed` after real provider acceptance (schema-enforced), and verifies the queue drains in the drill below.

### 9.2 Abuse-hash source

1. [YOU] Contract a legally authorized CSAM hash-list source. Realistic options for a small ESP: NCMEC's hash-sharing program (ask the ESP team in the same thread), or Thorn Safer / Tech Coalition programs. This is a contract + data-feed onboarding; counsel reviews the agreement.
2. [YOU] Deliver the hash file to the VM path Claude names (`MEERKAT_ARCHIVE_ABUSE_HASH_FILE` volume, 64-hex hashes one per line) and set up its refresh cadence.

### 9.3 Everything else

1. [CLAUDE] verifies ClamAV is on the pinned engine (1.5.3) with fresh definitions and a freshness alert; records `MEERKAT_ARCHIVE_MALWARE_VERSION`/`MEERKAT_ARCHIVE_MALWARE_DEFINITIONS`.
2. [CLAUDE] verifies the served DMCA agent identity (`/public/dmca/agent`) is byte-identical to the Step 3 registration.
3. [YOU] Moderation reality, in writing to Claude: your daily review window(s), the on-call thresholds you accept, and the backlog ceiling. Claude encodes them as alert lanes that page your phone.
4. [YOU+CLAUDE] Operator console tests over the tailnet: auth with `MEERKAT_OPERATOR_CONSOLE_SECRET`, failed-auth rate limiting, non-tailnet 403, audit rows written, access revocation.
5. [YOU+CLAUDE] Run the synthetic drills with lawful fixtures and record drill ids + timings: EICAR file through the archive scanner (malware), synthetic hash-list match (a hash YOU generate and add to a test copy of the list), CSAM escalation path with a benign fixture flagged by the test hash, credible-threat lane, DMCA notice against a test publication with the 5-day clock, appeal flow, and a safety-provider outage (stop clamav, verify fail-closed + alert). You sign the incident-owner line.

Exit gate check: safety queues cannot silently pass, `filed` cannot be fabricated, alerts reach your phone inside the approved windows, all drills pass.

## Step 10: prove billing, entitlement, refund, and deletion behavior

Prerequisites: Step 6 products live in App Store Connect/Play/Stripe/RevenueCat, Step 7 deployed, signed builds available (Claude prepares TestFlight/internal-track builds via EAS in Step 11 prep; billing tests use them too). Product ids are hardcoded: `meerkat_app_unlock` ($4.99 one-time) and `meerkat_hosted_monthly` ($4.99/mo).

1. [YOU] On your iPhone (TestFlight build, real Apple ID with a real card): buy the app unlock, then the hosted subscription. On Android (internal track): same two purchases. On web: subscribe hosted via Stripe (and buy the unlock via Stripe only if counsel kept the web rail in agenda item 13).
2. [YOU] Restore proof: delete + reinstall the app, restore purchases; sign into a second device and restore there.
3. [YOU+CLAUDE] Cross-rail link codes: create a link code on the phone, redeem on web; then prove single-use (second redeem refused), expiry, and invalid-signature refusal (Claude drives the negative cases).
4. [YOU] Refund/cancel matrix, one at a time while Claude watches the entitlement state through the webhooks (`/api/account/entitlements/apple|google|stripe`): request an Apple refund, cancel the Play subscription, cancel Stripe, let one lapse to expiry, and fire Stripe's duplicate-webhook + delayed-webhook simulations from the Stripe dashboard.
5. [YOU+CLAUDE] Deletion, the full ladder: with entitlement LAPSED, run in-app "Delete my data" end to end (persona + posts first, storage revocations, broker vaults, hosted objects, then local wipe; injected remote failure then idempotent retry).
6. [YOU+CLAUDE] Plan 51 verification-account deletion: sign in with Apple and with Google against the live account service, mint a blind credential, delete the verification account with SSO re-auth. Claude captures: account row + entitlements + issuance bookkeeping gone; client-submitted serial in the revocation list (serial only); renewal refused; inner-layer data untouched. Repeat without the device present and confirm the outstanding credential reports as expiring at epoch end, never falsely revoked.
7. [CLAUDE] runs the AC-2 wall guard against the production schema and captures the output: no credential serial and no persona/device identifier anywhere in the account database.

Exit gate check: all rails agree, failure states honest, replay refused, deletion works without an active subscription. You approve the zero-inventory proof as privacy owner (one written line to Claude).

## Step 11: execute the complete Plan 41 provider matrix

Prerequisites: Steps 6-8; signed builds on both phones (EAS `production` profile or TestFlight/internal track; Expo Go does NOT count); a browser profile for web rows. There is no scripted tracker for this matrix; Claude generates a guided checklist (one row at a time, exact taps, expected states) and records each cell into `docs/releases/meerkat/<rc>/providers/`. Budget one focused day.

1. [YOU] Have ready: iPhone (signed build, iCloud signed in), Android (signed build), a laptop browser, and the four cloud accounts from Step 6 (Drive/Dropbox/OneDrive/Box test accounts are fine but must be real accounts).
2. [YOU+CLAUDE] Work the 17 rows; per destination the operations are: authorize, write, read-back verify, list, quota, resume, revoke, credential rotation, backup, restore, move, delete, reconnect:
   - Local iOS, Local Android, Browser-local (persistence granted AND denied)
   - iCloud Drive (signed iOS), iOS Files provider, Android Storage Access Framework
   - Google Drive, Dropbox, OneDrive, Box (through the deployed broker)
   - WebDAV over HTTPS, S3-compatible (versioned test bucket), Meerkat hosted storage, signed connected server
   - Fresh-install restore (mobile), fresh-browser restore (web)
   - Failure drills: corruption, wrong key, torn journal, quota, provider outage, lost response, interrupted move
3. Unsupported cells must show the honest unavailable state; never accept a simulated success.

Exit gate check: every applicable cell passes with byte/hash comparison and restored identity fingerprints recorded.

## Step 12: execute calls, rooms, push, mesh, and background device matrices

Prerequisites: two physical phones with signed builds, push gateway live (Step 6/7). The script is `docs/guides/meerkat-native-transport-device-matrix.md` (ACs 42.1-42.7); Claude walks you through each rung and validates the honest indicators (transport diagnostics, recorded session rows with non-zero bytes, SAS emoji compare, provider-accepted push status, never "delivered").

1. [YOU+CLAUDE] Direct calls: iOS-iOS, Android-Android, iOS-Android; foreground, background, locked, terminated incoming behavior; CallKit/PushKit/Telecom, mic/camera/Bluetooth audio, interruption, handoff, permission-denied.
2. [YOU+CLAUDE] Community rooms on mobile + web via the deployed LiveKit, incl. TURN fallback (Claude forces relay-only ICE to prove it).
3. [YOU+CLAUDE] Push: APNs, FCM, VAPID provider acceptance AND an actual device wake, gateway logs showing opaque capability only.
4. [YOU+CLAUDE] Mesh ladder: LAN Bonjour, Android DNS-SD/Wi-Fi Direct, BLE wake-only (verify BLE never carries payload), WebRTC, encrypted relay fallback, ranked-choice negotiation.
5. [YOU+CLAUDE] Chaos rungs: radio off, network change, captive portal, reboot, revoked permission, token rotation, member removal, device revocation, stale epoch.

Exit gate check: every required cell passes with real media, real wake, real transport selection; screen recordings + diagnostics captured per cell.

## Step 13: prove backup, PITR, restore, failover, and regional recovery

Prerequisites: Step 8 done, some real (test) data present from Steps 10-12. Tooling exists end to end: `pnpm --filter @mylife/meerkat-relay backup:postgres` (digest-snapshot / restore-smoke / object-inventory / status) and `docs/guides/meerkat-runbooks/disaster-recovery-drill.md`.

1. [YOU] Approve the RPO/RTO targets Claude proposes (based on RDS backup cadence; typically RPO <= 5 min via PITR, RTO <= 1 h).
2. [CLAUDE] captures the reference digest snapshot with the read-only `meerkat_backup_digest` role.
3. [YOU] In RDS: restore the latest automated backup into a NEW scratch instance (console: Restore to point in time > new instance). Paste Claude the scratch endpoint + the backup id/timestamp.
4. [CLAUDE] runs `--restore-smoke` against the scratch instance; `verified=true` proof lands in `ops.backup_restore_proofs` with measured RPO/RTO.
5. [YOU] PITR drill: restore to an exact timestamp Claude names (between two known writes); Claude verifies the expected row is present/absent.
6. [YOU] Failover drill: RDS console > Reboot with failover (Multi-AZ); Claude watches service recovery and records downtime.
7. [YOU+CLAUDE] Regional loss drill: simulate by pointing a scratch config at the replica bucket; Claude proves object read-back from the second region.
8. [YOU+CLAUDE] Rotation: rotate DB service-role passwords, S3 keys, OAuth KMS key, push token keys (`MEERKAT_PUSH_TOKEN_ACTIVE_VERSION` bump), and one OAuth client secret; prove backups continue and the OLD credentials stop working.

Exit gate check: restore, PITR, failover, regional recovery, rotation all meet the approved RPO/RTO with signed drill verdicts (your sign-off lines in the ledger).

## Step 14: verify supply chain and signed artifacts

Almost entirely automated by `.github/workflows/release-images.yml` (already dispatched in Step 7).

1. [CLAUDE] verifies for each image: SPDX SBOM artifact present, blocking Grype scan green (fixed findings, high+; exceptions file has none or only unexpired reviewed entries), SLSA provenance attestation bound to the digest, cosign keyless signature verifiable against the pinned GitHub OIDC identity, and the release manifest's digests equal to what Step 7 deployed.
2. [CLAUDE] confirms mobile + web artifacts (Step 16 EAS builds, Step 7 web bundle) are built from the release SHA in CI and recorded by hash; no mutable tag anywhere in evidence.
3. [YOU] Review the blocking-policy summary Claude posts and reply "approved" (or direct a fix, which cuts a new rc).

Exit gate check: every distributed artifact reproducibly tied to the SHA and passing the blocking policy.

## Step 15: run production-shaped browser, load, soak, canary, and rollback

Prerequisites: Steps 7-8; budgets approved. Tooling: `scripts/load/load-relay.mjs`, `scripts/load/load-http.mjs`, `scripts/soak/soak-runner.mjs`, playwright launch suite, `rehearsal:postgres --record` for evidence rows. The 48-hour soak is wall-clock; schedule it so it ends before your planned Step 18 window.

1. [YOU] Approve the published budgets Claude proposes (latency p95/p99, error ceiling, saturation, queue growth) for launch load and 10x.
2. [CLAUDE] runs the browser launch suite against the REAL production URLs (`app.<domain>` + relay), all supported desktop + mobile browsers via playwright projects; measures initial load, interaction latency, and the large sync/LiveKit/app chunks.
3. [CLAUDE] runs 10x launch load: `load-relay.mjs --target wss://relay.<domain> ...` and `load-http.mjs` across healthz/readyz routes; records verdict NDJSON via `rehearsal:postgres --record --kind load` (exit 0 only records `passed`; a degraded/fail verdict is recorded honestly and blocks).
4. [YOU+CLAUDE] 48-hour soak: Claude starts `soak-runner.mjs` against the metrics + liveness endpoints with growth ceilings; alerts stay live so any page reaches your phone. You just keep the phone on.
5. [CLAUDE] verifies no unbounded growth in memory, sockets, DB, objects, retries, moderation, archive, push, or NCMEC queues from the soak samples.
6. [YOU+CLAUDE] Canary + rollback rehearsal: promote the same digests to a canary instance (or the standby), hold for the approved duration, then execute a REAL rollback to the recorded compatible target (previous digest set + compatible migration version) and verify recovery. The rollback command sequence gets written into the ledger cold-executable, exactly as rc8-exc-2's mitigation requires.

Exit gate check: budgets pass, canary healthy, rollback proven with the documented target.

## Step 16: complete store compliance and submit exact builds

Prerequisites: Step 3 URLs live, Step 6 products, Step 15 underway or done, signed builds from the release SHA.

1. [CLAUDE] builds the exact submission candidates: `eas build --profile production --platform ios|android` from the release SHA; records build ids + hashes in the ledger; `eas submit` when you say go.
2. [YOU] App Store Connect, with the worksheets Claude prepares from observed behavior (the app collects nothing; privacy manifest already declares no tracking):
   - App Privacy: fill from the worksheet (expect "Data Not Collected" for most rows; the verification account's Apple/Google subject is the notable disclosure).
   - App Review Information: demo/review account credentials Claude provisions; notes explaining E2E encryption, UGC moderation (report/block/standards URL), and the age gate.
   - Encryption: answer the export questionnaire with the counsel-approved 3.5 answers (uses non-exempt encryption: yes; mass-market 5D992.c self-classified).
   - URLs: Terms, Privacy, Support from Step 3. Age rating questionnaire honestly (UGC + chat).
   - Screenshots/metadata captured from the exact signed candidate (Claude prepares the set).
3. [YOU] Play Console: Data safety form from the same worksheet, UGC policy declarations, account deletion URL (the Step 3 data-deletion page), content rating questionnaire, target audience NOT child-directed (13+ floor), background location NOT used, submit to production review.
4. [YOU] Submit both; when review questions arrive (expect E2EE + UGC questions), Claude drafts responses within your response windows. If a store requires a change, it cuts a new rc and reruns affected evidence; the runbook stop conditions govern.
5. [CLAUDE] records submission ids, declaration exports, correspondence, and approvals.

Exit gate check: both stores approve the exact release artifacts; every declaration matches real behavior.

## Step 17: assemble the immutable evidence ledger and rerun the final audit

Nearly all Claude; you review and sign.

1. [CLAUDE] confirms every step's evidence in `evidence.json` references the same SHA, digest set, build ids, and config version; secrets/private content absent; renders `evidence-summary.html` + the launch dashboard.
2. [CLAUDE] reruns the production-readiness audit and the adversarial audit against the immutable manifest (fresh agents, findings triaged to closed or founder-signed exception).
3. [YOU] Read the summary end to end. Clear or sign any remaining exception. Verify the dashboards (SLO, safety, backup, billing, provider, store) are green yourself; do not take Claude's word for it at this step.

Exit gate check: ledger complete, internally consistent, no open mandatory finding.

## Step 18: sign GO and activate public availability

1. [YOU] Schedule the launch window when you can be on duty for the full window + 72h of 15-minute response; phone alerting confirmed live (send yourself a test page).
2. [YOU+CLAUDE] Hold the GO review against the ledger: confirm SHA, artifact digests, app build ids, migration version, canary state, rollback target. Confirm you are the named incident + rollback owner on duty.
3. [YOU] Sign GO (a dated, written line in the ledger: "GO signed, <timestamp>, Trey Shuldberg").
4. [CLAUDE] activates in the approved sequence: store releases from approved review (phased release ON for iOS, staged rollout for Play), web app public, Commons/public-layer flags on last.
5. [YOU+CLAUDE] Watch the launch window together: SLO, safety queues, billing webhooks, provider dashboards, store crash reports, support inbox. Any automatic stop condition = immediate rollback per the rehearsed Step 15 procedure, no discretion.

Exit gate check: public launch active only for the exact approved artifact set, owners monitoring, rollback ready. When the window closes clean, Claude flips `launchState` to GO/LAUNCHED in the ledger and this train is done.

## After launch

- Keep the 72h heightened response window, then steady-state (4h, 08:00-22:00, overnight criticals page).
- First post-launch release: name a backup human (retire exceptions rc8-exc-2 / rc10-exc-1 per their revisit clauses).
- Recurring obligations Claude tracks with you: ClamAV definition freshness, abuse-hash refresh, weekly restore-smoke, quarterly full DR drill, BIS annual self-classification report (Feb 1), DMCA agent renewal (3 years), certificate/key rotation calendar.
