# BestChef Legal Corpus (P0-08, plan 33 Phase 1.7)

Publishable source for the five pages that `app/(root)/constants/legal.ts`
points at. The app's onboarding gate, settings links, and App Store review
all depend on these URLs returning real content:

| File | Must be hosted at |
|------|-------------------|
| `terms.md` | https://bestchef.app/terms |
| `privacy.md` | https://bestchef.app/privacy |
| `guidelines.md` | https://bestchef.app/guidelines |
| `data-deletion.md` | https://bestchef.app/data-deletion |
| `support.md` | https://bestchef.app/support |

`operator.md` is not hosted: it is the single source of truth for the
operator-identity and jurisdiction placeholders, centralized (audit H5) so
they are filled in ONE place.

Founder ops (ledger item F2):

1. Have an attorney fill the placeholders in `operator.md`
   (`OPERATOR_LEGAL_NAME`, `GOVERNING_LAW_VENUE`, `OPERATOR_CONTACT_ADDRESS`,
   `EFFECTIVE_DATE`, `HOSTING_REGION`), then propagate them into `terms.md`
   and `privacy.md`. A repo-wide search for `TO BE COMPLETED BY OPERATOR`
   finds every remaining site, and `constants/legal.ts` (`OPERATOR_IDENTITY`)
   mirrors the same tokens for the app runtime. Honesty note: no real legal
   entity or governing law exists anywhere in the repo, so nothing is
   pre-filled. The rest of the corpus describes actual shipped behavior
   (anonymous-first auth, proof-of-cook voting, moderation queues with
   in-app statements of reasons, durable rate limits, full account export
   plus device export, in-app account deletion, blocks, per-country age
   gates).
2. Host the pages (static hosting is fine) and confirm each URL returns 200.
3. Keep this directory and the hosted pages in lockstep: a product change
   that affects data handling updates `privacy.md` in the same PR.

Last content review: 2026-07-11 (audit H3/H4/H5: added full account export,
moderation statements of reasons, and operator-identity centralization).
