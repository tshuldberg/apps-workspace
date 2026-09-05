---
title: Meerkat Privacy Policy
version: "1.0"
status: DRAFT for counsel review. Not effective. Not legal advice.
envVar: MEERKAT_PRIVACY_POLICY_URL
fields:
  - "[DATE] - effective date"
  - "Section 2 linkability claim - counsel to confirm against the shipped Grade 2 blind-credential implementation (Plan 51; issuance is cryptographically blinded, nothing stored can link account to persona; renewal transit residual documented in docs/designs/meerkat-account-verification-architecture.md Section 5)"
  - "[30] - hosted rolling retention days (confirm against deployed config)"
  - "Section 11 - GDPR/CCPA scope by launch jurisdiction + data-subject contact address"
  - "[13] - children's age floor (align with Terms ruling)"
  - "[PRIVACY EMAIL] - privacy contact"
---

# Meerkat Privacy Policy

Version 1.0 · Effective [DATE]

## 1. The short version

Meerkat is built so we cannot read your private content. Your messages, files, and communities are end-to-end encrypted with keys that exist only on your devices. We run no analytics and no advertising. This policy explains the little we do handle.

## 2. Your verification account

Purchasing and public participation use a minimal account you create by signing in with Apple or Google. It stores only: the sign-in identifier your provider gives us (Apple lets you hide your email), your verification checks (human verification, age status, parental consent where required), your purchase entitlement, and minimal bookkeeping for issuing your anonymous public-participation pass (which period a pass was issued in, never the pass itself). It is never linked to your identity, messages, communities, or files inside Meerkat: we store no such link, and the pass is cryptographically blinded when issued, so nothing we store can connect your account to your activity inside Meerkat. Private use of Meerkat requires no account.

## 3. Data on your device

Your identity keys, messages, files, and settings live in a local database on your device. Your birth date, if the in-app age screen runs, is checked on the device and never stored or transmitted; only a pass/fail record is kept. Where your app store provides a lawful age signal, we record the resulting age status on your verification account instead.

## 4. What our infrastructure sees

Relay servers forward encrypted envelopes between devices using opaque one-time tokens. They do not receive your name, device identifiers, message content, or message types, and they can observe only ciphertext sizes and timing. Hosted storage (optional, paid) stores encrypted objects we cannot decrypt; we hold no decryption keys.

## 5. Public layer

Content you publish to The Commons is public by design, together with your chosen public persona. Public posting requires verification and recorded acceptance of the Terms.

## 6. Third-party storage you connect

If you connect Google Drive, Dropbox, OneDrive, Box, WebDAV, S3, or iCloud as a backup destination, that provider receives encrypted objects and can observe object sizes and timing. It never receives your keys or plaintext.

## 7. Payments

Purchases run through Apple, Google, or Stripe. We receive transaction confirmations and entitlement status, not your card number.

## 8. Retention

Non-pinned hosted content is retained on a rolling [30]-day basis. Pinned or published content persists until unpinned, taken down, or deleted. Safety and legal records (for example, abuse reports and DMCA notices) are retained as required by law.

## 9. Deletion

Two independent deletions exist. "Delete my data" in the app destroys your local data, your public persona, and, if you choose, encrypted backups at connected destinations; copies already synced to other people's devices are outside our and your reach, and the app says so before you delete. Deleting your verification account removes the account record, entitlement state, and issuance bookkeeping, and revokes any pass you submit during deletion; it cannot touch in-app data because the account was never linked to it. If you delete without the app (so no pass is submitted), an already-issued anonymous pass cannot be traced back to revoke it early; that is the privacy design working as intended, and the pass expires on its own within 30 days.

## 10. Safety disclosures

We report apparent child sexual abuse material to NCMEC as required by law, and respond to valid legal process as described in our Law Enforcement Guidelines.

## 11. Your rights

[Counsel: GDPR/CCPA scope by launch jurisdiction; note that most rights are satisfied intrinsically because we cannot access content. Identify the data-subject contact address.]

## 12. Children

Meerkat is not directed to children under [13]. We do not knowingly collect personal information from children under [13]. [Counsel: align with age-floor ruling.]

## 13. Changes and contact

We will post changes here with a new effective date. Contact: [PRIVACY EMAIL].
