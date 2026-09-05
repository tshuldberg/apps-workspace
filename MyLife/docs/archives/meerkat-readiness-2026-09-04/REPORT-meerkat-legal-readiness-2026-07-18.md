# Meerkat Legal Readiness Review - Attorney Consultation Prep

Date: 2026-07-18, updated 2026-07-20 (red flags remediated in code; draft policy examples appended).
Scope: Runbook Step 3 (approve and publish legal and safety policy) plus every legal touchpoint in Steps 9, 10, and 16.
Release: reviewed at `meerkat-2026-07-18-rc8` (`8989a091`); code remediations landed after rc8 in merge `9f174c0b`, which requires a new release candidate.
Prepared by: Fable (code-verified against the repository). This document is an engineering readiness review, not legal advice.

## Executive summary

The engineering side of Meerkat's legal surface is in strong shape: DMCA intake and takedown, NCMEC filing, CSAM scanning, moderation, and account deletion are implemented, tested, and fail-closed. What does not exist yet is the paper: there are ZERO written legal documents in the product. Terms of Use, Privacy Policy, and Community Standards are wired as environment-configured URLs (`MEERKAT_TERMS_URL`, `MEERKAT_PRIVACY_POLICY_URL`, `MEERKAT_COMMUNITY_STANDARDS_URL`, `MEERKAT_SUPPORT_URL`) that are currently empty. The app honestly shows "Policy links are not configured" until they are set.

Before the attorney consult, the founder needs: (a) the list of documents to have drafted, (b) the product-behavior facts each document must not contradict, and (c) the open legal decisions only counsel + founder can settle. All three are below.

Update 2026-07-20: both code red flags (export declaration, missing age gate) are FIXED in code (Section 8), and complete draft examples of all seven policy documents are staged for counsel review (Section 9; expandable in the HTML twin).

## 1. What exists vs what is missing

| Item | Status | Evidence |
|------|--------|----------|
| Terms of Use document | MISSING - env URL only, currently empty | `apps/meerkat/app.config.ts:251`; acceptance versioned by `CURRENT_PUBLIC_TERMS_VERSION = '2026-07'` (`packages/sync/src/protocol/public-post.ts:59`) |
| Privacy Policy document | MISSING - env URL only | `apps/meerkat/app.config.ts:250`; web `VITE_MEERKAT_PRIVACY_POLICY_URL` |
| Community Standards / UGC rules | MISSING - env URL only | `apps/meerkat/app.config.ts:252`; in-app report categories exist (`public-report.ts`) |
| Safety support + appeals page | MISSING - env URL only | `apps/meerkat/app.config.ts:253`; UI link "Safety support and appeals" |
| Law-enforcement request procedure | MISSING - nothing in repo | Runbook Step 3 requires it |
| Play data-deletion-instructions page | MISSING | Founder-ops runbook item 4.7 |
| DMCA policy page (public) | PARTIAL - agent endpoint implemented, policy text missing | `GET /public/dmca/agent` serves the validated agent block; no human-readable DMCA policy page |
| DMCA intake + counter-notice flow | IMPLEMENTED | `packages/meerkat-relay/src/dmca-intake.ts`: rate-limited `POST /public/dmca/notice`, Zod-validated 512(c)(3) elements (identification, contact, good-faith + accuracy attestations, signature), 512(g) counter-notice, takedown tombstones, operator console lanes |
| DMCA registered agent identity | MISSING - fail-closed placeholders | `dmca-config.ts`: first-party boot THROWS until all six `MEERKAT_DMCA_AGENT_*` fields are real; requires U.S. Copyright Office registration |
| NCMEC reporting pipeline | IMPLEMENTED, vendor onboarding open | `ncmec-queue.ts` + `ncmec-filing-worker.ts`: `filed` only on provider confirmation; CyberTipline adapter + credentials are founder-ops |
| CSAM/abuse-hash scanning | IMPLEMENTED, fail-closed; hash source open | `archive-malware-scan.ts`: unconfigured deploy never fabricates a clean verdict; licensed abuse-hash DB is founder-ops |
| Account deletion | IMPLEMENTED with honest copy | `apps/meerkat-web/src/lib/delete-account-core.ts` + mobile twin: remote persona delete, storage-destination deletion opt-in, full local wipe; copy states synced peer copies stay on peers |
| Age gate / minimum-age enforcement | IMPLEMENTED 2026-07-20 | Neutral first-launch date-of-birth gate on mobile (`AgeGate.tsx`) and web (`AgeGateOverlay.tsx`) over a shared `@mylife/sync` core; minimum age configurable (`MEERKAT_MINIMUM_AGE`, clamped 13-21, default 13 pending counsel ruling); durable underage lock; the birth date is never persisted. Counsel still rules the age floor. |
| Encryption export declaration | CORRECTED 2026-07-20 | `ITSAppUsesNonExemptEncryption` now `true` (custom E2EE is not exempt), pinned by a guard test. Founder-ops remainder: ASC questionnaire, ECCN 5D992.c self-classification + annual BIS report, French declaration. |
| Internal legal risk analysis | EXISTS (internal, whole-suite, March snapshot) | `docs/legal/LEGAL-RISK-ANALYSIS-2026-03-29.md` - do not treat as current or Meerkat-specific |
| Legal red-team design notes | EXISTS | `docs/sessions/2026-07-07-plan39-track-d2-legal-red-team.md` |

## 2. Documents to bring to (or draft with) counsel

1. **Terms of Use.** Must cover: verify-to-view public feed, the $4.99 one-time app unlock, the optional $4.99/month hosted subscription with storage included (founder-locked pricing), UGC license grant and takedown rights, acceptable use, termination, disclaimer/liability, dispute resolution + governing law, and the terms-versioning mechanism (the app records acceptance against version `2026-07`; re-acceptance triggers on version bump).
2. **Privacy Policy.** Must be written around the real architecture (see Section 3): E2EE payloads, zero-knowledge relays, local-first SQLite, hosted storage as ciphertext, third-party storage providers receiving only encrypted object sizes/timing, no analytics/telemetry, 30-day default hosted retention for non-pinned content.
3. **Community Standards.** Must match the five in-app report categories exactly: spam/scam, harassment/hate, violence/dangerous acts, sexual content involving minors (fast-tracked, "reported to authorities where required"), copyright.
4. **Safety support + appeals page.** The About screen links "Safety support and appeals"; there is no appeals process written anywhere. Counsel should bless the appeal windows and the moderation decision language (the operator console already records decisions and supports un-hide/uphold).
5. **Law-enforcement guidelines.** What the operator can and cannot produce (ciphertext only from relays; no message content; hosted objects are encrypted; what metadata exists and for how long). This document does not exist and Step 3 requires the procedure.
6. **DMCA policy page** naming the registered agent, notice requirements, counter-notice process, and repeat-infringer policy (the code implements 5-day notification action and 14-day counter-notice hold defaults; counsel should confirm those windows).
7. **Google Play data-deletion instructions page** (store requirement; founder-ops item 4.7).

## 3. Product-behavior facts the documents must not contradict

The runbook's Step 3 exit gate is "documents match observed product behavior." These are the code-verified behaviors counsel needs to know:

- **E2EE and zero knowledge:** relays pair by opaque tokens and forward ciphertext verbatim; they never see plaintext, device ids, or envelope contents (`packages/meerkat-relay/src/hub.ts`, tested). Hosted nodes are zero-knowledge multi-tenant; the operator holds no decryption keys.
- **Deletion boundary:** "Delete my data" destroys local data, the public persona (remote delete), and optionally encrypted backup objects at connected destinations, but cannot reach copies already synced to other people's devices. The in-app copy says this explicitly; the Privacy Policy must say the same.
- **Hosted retention:** non-pinned hosted content defaults to 30-day rolling retention; pinned/published content persists until unpinned or taken down.
- **Third-party storage (Plan 41):** users can connect Google Drive, Dropbox, OneDrive, Box, WebDAV, S3, iCloud; providers receive encrypted objects and can observe sizes and timing, never keys or plaintext. Store disclosure forms must state this (founder-ops item 4.12).
- **Public posting gate:** public posting requires verification plus recorded acceptance of Terms and Community Standards at the current version. Private mesh use requires no account and no acceptance.
- **Moderation reality:** nothing unscanned or non-clean is pinnable or serveable; scanning fails closed when the AV/abuse-hash rail is unconfigured; NCMEC `filed` status cannot be fabricated (provider confirmation required); DMCA takedown removes serving first and tombstones against replay.
- **Payments:** $4.99 one-time unlock (Apple/Google IAP) and $4.99/month hosted subscription (Stripe on web); server-side receipt validation; entitlement is server-enforced. Refund handling follows the store rails.
- **No analytics, no telemetry** (suite-wide privacy-first commitment).

## 4. Open decisions for the attorney (the actual consult agenda)

1. **Operating entity.** Every legal document, the DMCA registration, Apple/Google/Stripe accounts, and the NCMEC registration need a legal entity name. Nothing in the repo names one; `MEERKAT_DMCA_AGENT_ORG` is unfilled. Decide entity type, state, and name before anything else - it cascades into every field below.
2. **DMCA registered agent.** Register with the U.S. Copyright Office (online, $6, three-year renewal) under the entity; the six `MEERKAT_DMCA_AGENT_*` values come from that filing. Also confirm the 5-day/14-day windows and adopt a written repeat-infringer policy (needed for the 512 safe harbor).
3. **Encryption export classification.** UPDATE 2026-07-20: the declaration is corrected to `true` in code. Counsel/founder work remains: mass-market ECCN 5D992.c self-classification, the annual BIS self-classification report, the App Store Connect questionnaire answered truthfully, and a French import declaration if distributing in France (runbook Step 16 material).
4. **Minimum age and minors.** UPDATE 2026-07-20: a neutral first-launch age gate now ships on both surfaces with a configurable minimum (default 13, clamped 13-21, `MEERKAT_MINIMUM_AGE`). Counsel still rules: the actual age floor (13 with COPPA analysis vs 16+ vs 18+), store age-rating implications, and any state-law obligations (design codes and minor-safety statutes). Raising the floor is now configuration, not a code change.
5. **Privacy regime scope.** Decide launch jurisdictions and which regimes apply: GDPR (EU) including lawful basis, DPA/representative needs, and data-subject rights against an E2EE architecture; CCPA/CPRA (California) thresholds; data-broker and breach-notification duties. Note the architecture helps: the operator mostly cannot read user content, and there is no analytics pipeline.
6. **CSAM reporting duties.** As a U.S. provider, 18 U.S.C. 2258A reporting duties apply once the public layer launches; NCMEC vendor onboarding is on the founder. Counsel should confirm the report-preservation obligations (90-day preservation) match what the durable NCMEC queue retains, and review the "reported to authorities where required" in-app language.
7. **Section 230 / intermediary posture.** The public feed and communities host third-party content with first-party moderation. Counsel should review the Community Standards and moderation console language to preserve the intermediary posture, and assess exposure for the self-host/community-node mode where third parties run nodes.
8. **E2EE policy environment.** Meerkat markets E2EE with no provider access. Counsel should brief on current obligations affecting E2EE services in launch markets (EU CSA regulation trajectory, UK Online Safety Act if UK distribution is planned) and whether launch scope should exclude any jurisdictions initially.
9. **Terms enforceability mechanics.** The app records acceptance server-side at version `2026-07` before public posting. Counsel should confirm this clickwrap flow is sufficient and define the re-acceptance trigger policy for material changes.
10. **Hosted subscription commerce terms.** Auto-renewal disclosure requirements (state auto-renewal laws), cancellation UX requirements, refund policy wording for the one-time unlock vs the subscription, and whether hosted storage needs its own SLA/acceptable-use addendum.
11. **Store compliance package.** Apple App Privacy nutrition label and Google Play Data Safety form answers must be derived from the Privacy Policy once drafted; UGC apps need visible moderation/reporting/blocking policies for both stores (implemented in product; the written policy is the gap).
12. **Law-enforcement response.** Who receives legal process for the entity, what can technically be produced (very little, by design), preservation-request handling, and whether to publish a transparency-report commitment.
13. **Purchase-rail policy (added 2026-07-20).** Founder proposal: sell the one-time app unlock ONLY through Apple and Google so every purchaser passes store-grade identity, payment, and (where mandated) age verification; web would unlock exclusively by redeeming a cross-rail link code from a store purchase (both directions of that flow already exist in code; the web Stripe Checkout for the unlock at `apps/meerkat-web/src/lib/hosted-access.ts:136` would be disabled). Stripe would remain only for the hosted subscription. Counsel: does store-only purchase materially strengthen the compliance posture in age-verification jurisdictions, and does dropping the direct web purchase raise any consumer-access or store-steering concerns (DMA, alternative marketplaces)?

## 5. What can be drafted now vs what needs counsel

- **Fable/founder can draft now** (counsel then reviews): Privacy Policy, Terms of Use, Community Standards, safety/appeals page, DMCA policy page, law-enforcement guidelines, Play data-deletion page. The architecture facts in Section 3 are the source material; drafting from them keeps the "matches product behavior" exit gate satisfiable.
- **Counsel must decide/execute:** entity formation, DMCA agent registration, export classification correction and BIS/French filings, minimum-age ruling, jurisdiction scope, repeat-infringer policy adequacy, and final sign-off on every document (the runbook evidence requires counsel approvals with version ids and effective dates).
- **Founder must execute:** hosting the pages over HTTPS on the production domain, entering the production env values (`MEERKAT_TERMS_URL`, `MEERKAT_PRIVACY_POLICY_URL`, `MEERKAT_COMMUNITY_STANDARDS_URL`, `MEERKAT_SUPPORT_URL`, six `MEERKAT_DMCA_AGENT_*` fields), and the unauthenticated browser + mobile URL verification the runbook demands.

## 6. Runbook Step 3 checklist mapped to current status

| Runbook item | Status |
|--------------|--------|
| Approve Terms of Use | NOT STARTED - document does not exist |
| Approve Privacy Policy + data-retention disclosures | NOT STARTED - document does not exist (retention facts verified in code) |
| Approve Community Standards + UGC moderation rules | NOT STARTED - document does not exist (in-app categories implemented) |
| Approve deletion, appeal, safety support, law-enforcement, contact procedures | PARTIAL - deletion implemented + honest copy; appeals/LE/contact documents do not exist |
| Resolve encryption export classification (iOS, Android, web, container) | AT RISK - current iOS declaration likely wrong; needs counsel + BIS work |
| Register designated DMCA agent | NOT STARTED - blocked on entity decision |
| Publish every URL over HTTPS on production domains | BLOCKED - no documents, no production domain decision recorded |
| Verify each URL unauthenticated (browser + mobile) | BLOCKED - downstream |
| Enter exact production `MEERKAT_DMCA_AGENT_*` values | BLOCKED - downstream of registration |

## 7. Suggested consult sequence

1. Entity decision (everything hangs on it).
2. Same week: DMCA agent registration + export classification correction (both mechanical once the entity exists).
3. Counsel reviews the drafted policy set against Section 3 facts.
4. Founder hosts final documents, fills env values, runs the Step 3 URL verifications, and the ledger records counsel approvals, version ids, and effective dates as Step 3 evidence.


## 8. Remediation update (2026-07-20)

Both red flags from Section 1 are remediated in code, merged at `9f174c0b` (branch `feature/meerkat-legal-readiness-fixes`):

- **Age gate:** shared pure core in `packages/sync/src/protocol/age-gate.ts` (neutral date-of-birth evaluation, exact-age math, record codec that never stores the birth date, minimum age clamped 13-21). Mobile `AgeGate.tsx` mounts before `OnboardingGate`; web `AgeGateOverlay.tsx` mounts before `OnboardingOverlay`. An underage answer locks the device durably with honest copy. 27 new tests across the three packages; sync 2,386 / app 1,382 / web 974 tests and meerkat parity green.
- **Export declaration:** `ITSAppUsesNonExemptEncryption` is now `true`, pinned by a guard test in `app-config.test.ts` that documents the founder-ops remainder.
- **Release impact:** these are code changes after rc8, so rc8's Step 1 evidence no longer binds to the shipping tree; a new release candidate must be cut from the merge SHA.

## 9. Draft example policy documents (for counsel review)

Full draft texts live in the HTML twin of this report as expandable sections, and are duplicated below for the canonical record. Every draft is an EXAMPLE prepared by engineering from the code-verified facts in Section 3. None is legal advice; none is effective until counsel approves, an entity is named, bracketed values are filled, and the document is published at its production URL.

### Draft A: Terms of Use

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Meerkat Terms of Use** (Version 2026-07; effective [DATE])
>
> 1. **Who we are.** Meerkat is operated by [ENTITY NAME], a [STATE] [ENTITY TYPE] ("we," "us"). Contact: [EMAIL], [ADDRESS].
> 2. **What Meerkat is.** Meerkat is a privacy-first communication app. Private spaces (communities, direct messages, file sync) are end-to-end encrypted; we cannot read them. A separate public layer (The Commons) hosts publicly published posts that anyone can view after verification.
> 3. **Eligibility.** You must be at least [13/16/18, counsel to rule] years old. Where your app store provides a lawful age signal we use it; otherwise the app asks your birth date once, on your device, to confirm eligibility. The date itself is not stored or transmitted.
> 4. **Your verification account.** Purchasing and public participation use a minimal verification account created by signing in with your existing Apple or Google identity. It holds only what the law and the stores require us to know: that you are a real person, your verification checks (such as age status and, where required, parental consent), and your purchase entitlement. It holds nothing about what you do inside Meerkat.
> 5. **Your Meerkat identity and keys.** Inside the app your identity is a cryptographic key created on your device. It is separate from your verification account and is never registered with it: [we do not link them / the credential design makes us unable to link them; counsel to match the shipped implementation]. Private use of Meerkat (your communities, messages, and files) requires no sign-in at all. You are responsible for your recovery key; if you lose your keys and have no backup, we cannot recover your data.
> 6. **Purchases.** The app is unlocked with a one-time purchase of $4.99 through the Apple App Store or Google Play, tied to your verification account. An optional hosted service subscription ($4.99 per month, hosted storage included) is billed through the store on mobile or Stripe on the web. Prices may change prospectively; store refund rules apply to store purchases. You can cancel the subscription at any time effective at the end of the billing period. Deleting your verification account or Meerkat data remains available after your subscription lapses.
> 7. **Public content license.** When you publish to the public layer, you grant us a non-exclusive, worldwide, royalty-free license to host, store, reproduce, and display that content for operating the service. You keep ownership. This license ends when the publication is removed, except for lawful retention (for example, safety evidence).
> 8. **Acceptable use.** You may not use Meerkat to violate law, post content in the categories prohibited by the Community Standards, infringe intellectual property, interfere with the service, or attempt to deanonymize other users.
> 9. **Moderation and enforcement.** The private, end-to-end-encrypted layer is not moderated by us and cannot be. On the public layer we may remove content, restrict accounts, and honor legal takedowns as described in the Community Standards and DMCA Policy. Appeals are described on the Safety Support page.
> 10. **Acceptance and changes.** Public posting requires recorded acceptance of these Terms and the Community Standards at the current version. Material changes create a new version; continued public posting requires re-acceptance. [Counsel: confirm change-notice mechanics.]
> 11. **Termination.** You can stop using Meerkat at any time and delete your data from the app. We may suspend public-layer access for violations by revoking your public credential and refusing renewal on your verification account. Private, on-device functionality does not depend on our approval.
> 12. **Disclaimers and liability.** The service is provided "as is." To the maximum extent permitted by law, our aggregate liability is limited to the greater of $50 or the amount you paid us in the last 12 months. [Counsel: jurisdiction-specific consumer-law carve-outs.]
> 13. **Disputes.** [Counsel: governing law, venue, arbitration yes/no, class waiver yes/no.]

### Draft B: Privacy Policy

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Meerkat Privacy Policy** (Version 1.0; effective [DATE])
>
> 1. **The short version.** Meerkat is built so we cannot read your private content. Your messages, files, and communities are end-to-end encrypted with keys that exist only on your devices. We run no analytics and no advertising. This policy explains the little we do handle.
> 2. **Your verification account.** Purchasing and public participation use a minimal account you create by signing in with Apple or Google. It stores only: the sign-in identifier your provider gives us (Apple lets you hide your email), your verification checks (human verification, age status, parental consent where required), and your purchase entitlement. It is never linked to your identity, messages, communities, or files inside Meerkat: [we do not store any such link / the anonymous credential design makes us unable to create one; counsel to match the shipped implementation]. Private use of Meerkat requires no account.
> 3. **Data on your device.** Your identity keys, messages, files, and settings live in a local database on your device. Your birth date, if the in-app age screen runs, is checked on the device and never stored or transmitted; only a pass/fail record is kept. Where your app store provides a lawful age signal, we record the resulting age status on your verification account instead.
> 4. **What our infrastructure sees.** Relay servers forward encrypted envelopes between devices using opaque one-time tokens. They do not receive your name, device identifiers, message content, or message types, and they can observe only ciphertext sizes and timing. Hosted storage (optional, paid) stores encrypted objects we cannot decrypt; we hold no decryption keys.
> 5. **Public layer.** Content you publish to The Commons is public by design, together with your chosen public persona. Public posting requires verification and recorded acceptance of the Terms.
> 6. **Third-party storage you connect.** If you connect Google Drive, Dropbox, OneDrive, Box, WebDAV, S3, or iCloud as a backup destination, that provider receives encrypted objects and can observe object sizes and timing. It never receives your keys or plaintext.
> 7. **Payments.** Purchases run through Apple, Google, or Stripe. We receive transaction confirmations and entitlement status, not your card number.
> 8. **Retention.** Non-pinned hosted content is retained on a rolling [30]-day basis. Pinned or published content persists until unpinned, taken down, or deleted. Safety and legal records (for example, abuse reports and DMCA notices) are retained as required by law.
> 9. **Deletion.** Two independent deletions exist. "Delete my data" in the app destroys your local data, your public persona, and, if you choose, encrypted backups at connected destinations; copies already synced to other people's devices are outside our and your reach, and the app says so before you delete. Deleting your verification account removes the account record and revokes your public credentials; it cannot touch in-app data because the account was never linked to it.
> 10. **Safety disclosures.** We report apparent child sexual abuse material to NCMEC as required by law, and respond to valid legal process as described in our Law Enforcement Guidelines.
> 11. **Your rights.** [Counsel: GDPR/CCPA scope by launch jurisdiction; note that most rights are satisfied intrinsically because we cannot access content. Identify the data-subject contact address.]
> 12. **Children.** Meerkat is not directed to children under [13]. We do not knowingly collect personal information from children under [13]. [Counsel: align with age-floor ruling.]
> 13. **Changes and contact.** We will post changes here with a new effective date. Contact: [PRIVACY EMAIL].

### Draft C: Community Standards

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Meerkat Community Standards** (Version 1.0; effective [DATE])
>
> These standards govern the public layer (The Commons) and any content you publish for public viewing. Private, end-to-end-encrypted spaces are yours; we cannot see them and do not moderate them.
>
> **Prohibited on the public layer:**
> 1. **Spam and scams.** Deceptive schemes, phishing, pyramid promotion, bulk unsolicited posting.
> 2. **Harassment and hate.** Targeted harassment, threats, and attacks on people based on protected characteristics.
> 3. **Violence and dangerous acts.** Incitement, credible threats, glorification of violence, instructions for serious harm.
> 4. **Sexual content involving minors.** Zero tolerance. Content is scanned against industry hash lists before public archive acceptance, apparent CSAM is reported to NCMEC, and accounts are terminated. This category is fast-tracked ahead of all other review.
> 5. **Copyright infringement.** See the DMCA Policy for notices, counter-notices, and our repeat-infringer policy.
>
> **How enforcement works.** Every public post can be reported in the app under exactly these categories. Nothing enters the public archive without passing malware and abuse-hash scanning; unscannable content is not published. Violations lead to content removal and, for repeat or severe violations, loss of public-layer access. **Appeals.** If your content was removed or your access restricted, you can appeal within [14] days through the Safety Support page; a person reviews appeals and the decision and reason are recorded.

### Draft D: Safety Support and Appeals

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Meerkat Safety Support** (Version 1.0; effective [DATE])
>
> **Report content.** Use the in-app report button on any public post (categories: spam or scam, harassment or hate, violence or dangerous acts, sexual content involving minors, copyright). CSAM reports are fast-tracked and reported to authorities where required. Reports about private encrypted spaces can only be actioned by the space's own members and admins using in-app blocking and removal tools; we cannot see private content.
> **Blocking.** You can block any public persona in the app; blocking is local and immediate.
> **Appeals.** If your public content was removed or your public access restricted, submit an appeal at [SUPPORT URL] within [14] days of the decision. Include the content reference from the removal notice. A human reviews every appeal; outcomes are upheld, reversed, or modified, and you will receive the reason. [Counsel: confirm window and whether a second-level appeal exists.]
> **Emergencies.** If someone is in immediate danger, contact local emergency services first.
> **Contact.** Safety team: [SAFETY EMAIL]. Postal: [ADDRESS].

### Draft E: Law Enforcement Guidelines

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Meerkat Law Enforcement Guidelines** (Version 1.0; effective [DATE])
>
> 1. **Service of process.** Legal process for [ENTITY NAME] should be served at [REGISTERED AGENT / ADDRESS] or [LE EMAIL]. We require valid legal process appropriate to the data sought and our jurisdiction. [Counsel: specify acceptable instruments.]
> 2. **What we can produce.** Meerkat is end-to-end encrypted by design. We do not possess message content, private files, community content, or user decryption keys, and cannot produce them under any process. Categories that may exist: hosted-service billing records (via the payment processor), public-layer publications and persona records (already public), safety records we are required to keep (abuse reports, NCMEC report records, DMCA notices), and limited infrastructure logs. Relay servers are zero knowledge: they process opaque tokens and ciphertext, retain [no / N-day] connection logs, and never see message content or device identifiers.
> 3. **Preservation.** On receipt of a valid preservation request we will preserve the specific existing records identified, for [90] days, renewable once. We cannot preserve what we do not possess.
> 4. **Emergency disclosure.** Where we have a good-faith belief that disclosure of records we possess is needed to prevent death or serious injury, we may disclose them consistent with [18 U.S.C. 2702(b)(8)]. [Counsel: confirm standard.]
> 5. **User notice.** Our policy is to notify users of legal process seeking their records where we have a means of contact and are not legally prohibited. [Counsel: confirm.]
> 6. **CSAM.** We report apparent CSAM to NCMEC under 18 U.S.C. 2258A and preserve the associated report records as required.
> 7. **Transparency.** We intend to publish an annual transparency report. [Counsel: confirm commitment.]

### Draft F: DMCA Policy

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Meerkat DMCA Policy** (Version 1.0; effective [DATE])
>
> 1. **Scope.** This policy covers content published on Meerkat's public layer. We respond to valid notices under 17 U.S.C. 512.
> 2. **Designated agent.** [AGENT NAME], [ORGANIZATION], [ADDRESS], [EMAIL], [PHONE], registered with the U.S. Copyright Office on [REGISTRATION DATE]. The same identity is served machine-readably at `/public/dmca/agent`.
> 3. **Filing a notice.** Submit through the in-app copyright report flow or `POST /public/dmca/notice`, including: identification of the work, identification of the infringing material (post IDs or URLs), your contact information, a good-faith statement, an accuracy statement under penalty of perjury, and your physical or electronic signature. Incomplete notices are rejected with the defect identified.
> 4. **What happens.** Valid claims are actioned within [5] business days: the identified publications are removed from serving and tombstoned against republication. The poster is notified and provided the notice.
> 5. **Counter-notice.** The poster may submit a counter-notice under 17 U.S.C. 512(g) with the statutory attestations. Unless the claimant informs us within [14] business days that they have filed a court action, the content may be restored.
> 6. **Repeat infringers.** We terminate public-layer access of users who are the subject of [N, counsel to set] actioned notices without a successful counter-notice within [12] months. [Counsel: confirm thresholds.]
> 7. **Misrepresentation.** Knowingly false notices or counter-notices incur liability under 17 U.S.C. 512(f).

### Draft G: Google Play Data Deletion Instructions

> **DRAFT EXAMPLE for counsel review. Not effective. Not legal advice.**
>
> **Delete your Meerkat data** (Version 1.0; effective [DATE])
>
> Meerkat stores your content on your own device, end-to-end encrypted. To delete it: open Meerkat, go to Me, then Settings, then Delete my data. This destroys your local data and identity keys, deletes your public persona from our servers if you created one, and, if you choose, tells connected backup destinations to delete their encrypted backup objects. Copies you already synced to other people's devices stay on their devices; the app tells you this before deleting. If you subscribed to the hosted service, deletion also removes your hosted encrypted objects; billing history is retained by the payment processor as required by law. Deletion works without an active subscription and without contacting support. If you cannot access the app, contact [PRIVACY EMAIL] to delete server-side records (public persona and hosted objects); we cannot delete on-device data remotely because we have no access to your device or keys.


## 10. Account and verification architecture (revised 2026-07-20, implemented; build plan: docs/plans/queue/51-meerkat-verification-account.md)

Founder-confirmed model, superseding the receipt-only variant below, and IMPLEMENTED on 2026-07-20 (Plan 51, all phases). A minimal VERIFICATION ACCOUNT (Apple/Google SSO) anchors the person and holds ONLY required checks (human, age, parental consent) plus purchase entitlement, on a separate account-service deployable over new `account.`/`credential.` schemas. The in-app Meerkat identity is created separately and proves membership via an anonymous blind-signed credential (RFC 9474 RSA blind signatures, the Privacy Pass publicly verifiable shape; SHA-512 parameterization), so the account layer never learns which persona it backs. Bans work by credential revocation + account renewal refusal, never by persona-to-account mapping and never by IP identity.

Shipped linkability grade, stated exactly: **Grade 2 for stored data.** Issuance is cryptographically blind (the issuance and presentation transcripts share no linkable values; asserted by test), and a schema wall guard plus a log-hygiene canary enforce that no table, log line, or metric anywhere holds both an account identifier and a persona/device identifier, and that no credential serial is ever stored or logged beside an account identifier. Nothing the service stores, or can be compelled to produce, can link a verification account to a persona. The one documented residual: at renewal the expiring credential's serial transits the request for revocation checking and is discarded, so a maliciously modified live binary could observe it in memory at that moment; copy therefore claims "nothing we store can link," and the threat model (docs/designs/meerkat-account-verification-architecture.md, Section 5) records the residual. Live SSO provider verification (Apple service id, Google client ids) and production deploy of the account service remain founder-ops. The earlier layer description below stands for everything else (entitlement wall semantics, inner-layer privacy):

- **Layer 1, the store gate.** Meerkat has no content accounts (the minimal verification account above is the only account, and it holds checks + entitlement only). Real-world identity enters at the store boundary: users sign in with their existing Apple or Google identity and buy the $4.99 unlock there. Legally required person-bound checks (payment identity, parental consent, and age verification where store-level regimes such as the 2026 state app-store accountability laws provide it) run at that boundary under Apple/Google's systems. The store gate is strong but not universal: it does not cover the web surface, self-hosted deployments, or jurisdictions without store age regimes, so the in-app neutral age gate (Section 8) remains the universal floor everywhere, and the app consumes store-provided age signals where lawful to skip or pre-fill it. Counsel rules where store signals may be relied on (agenda item 4).
- **Layer 2, the entitlement wall.** Only a store receipt (or a single-use cross-rail link code derived from one) crosses into the app, validated server-side. No name, email, or store identity enters Meerkat's data model. Deliberately NOT bound: `appAccountToken`-style transaction-to-identity linking is skipped on purpose; the store transaction and the device keypair stay unlinkable beyond entitlement validation. The purchase doubles as the sybil/humanity cost for public posting.
- **Layer 3, inside the walls.** Identity is a device-held cryptographic keypair; E2EE with zero-knowledge relays; no analytics; restore-purchases goes through the store, never a Meerkat account. The web Stripe rail (hosted subscription, and currently the direct web unlock pending agenda item 13) is the stated exception where a payment processor sees billing identity; the same entitlement wall applies.
