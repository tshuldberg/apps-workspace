---
title: Meerkat DMCA Policy
version: "1.0"
status: DRAFT for counsel review. Not effective. Not legal advice.
envVar: none (published page; agent identity also served at /public/dmca/agent)
fields:
  - "[DATE] - effective date"
  - "[AGENT NAME], [ORGANIZATION], [ADDRESS], [EMAIL], [PHONE] - designated agent (must match MEERKAT_DMCA_AGENT_* env values exactly)"
  - "[REGISTRATION DATE] - U.S. Copyright Office registration date (dmca.copyright.gov, $6)"
  - "[5] business days action window (default matches MEERKAT_DMCA_NOTIFICATION_DEADLINE_DAYS=5)"
  - "[14] business days counter-notice window (default matches MEERKAT_DMCA_COUNTER_NOTICE_DEADLINE_DAYS=14)"
  - "[N] actioned notices repeat-infringer threshold - counsel to set"
---

# Meerkat DMCA Policy

Version 1.0 · Effective [DATE]

## 1. Scope

This policy covers content published on Meerkat's public layer. We respond to valid notices under 17 U.S.C. 512.

## 2. Designated agent

[AGENT NAME], [ORGANIZATION], [ADDRESS], [EMAIL], [PHONE], registered with the U.S. Copyright Office on [REGISTRATION DATE]. The same identity is served machine-readably at `/public/dmca/agent`.

## 3. Filing a notice

Submit through the in-app copyright report flow or `POST /public/dmca/notice`, including: identification of the work, identification of the infringing material (post IDs or URLs), your contact information, a good-faith statement, an accuracy statement under penalty of perjury, and your physical or electronic signature. Incomplete notices are rejected with the defect identified.

## 4. What happens

Valid claims are actioned within [5] business days: the identified publications are removed from serving and tombstoned against republication. The poster is notified and provided the notice.

## 5. Counter-notice

The poster may submit a counter-notice under 17 U.S.C. 512(g) with the statutory attestations. Unless the claimant informs us within [14] business days that they have filed a court action, the content may be restored.

## 6. Repeat infringers

We terminate public-layer access of users who are the subject of [N, counsel to set] actioned notices without a successful counter-notice within [12] months. [Counsel: confirm thresholds.]

## 7. Misrepresentation

Knowingly false notices or counter-notices incur liability under 17 U.S.C. 512(f).
