# BestChef Operator Identity (single source of truth)

This file centralizes the operator identity and jurisdiction placeholders
used across the BestChef legal corpus. The terms, privacy, and other legal
pages reference these values instead of hard-coding them, so the operator
fills them in ONCE, here, before publication.

Ledger item: **F2** (host + finalize the legal corpus). These are the only
invented-fact risks in the corpus; everything else describes actual shipped
behavior. Do NOT fabricate a legal entity, jurisdiction, or address. A
sibling app (MyNews) publishes the DSA contact label "MyLife Suite", but that
is a product/brand label, not a registered legal entity, and no consistent
governing-law jurisdiction exists across the repo (MyNews declares none,
DoWork uses California, the MyLife hub uses Washington). The founder/attorney
must supply the real values below.

| Token | Value | Status |
|-------|-------|--------|
| `OPERATOR_LEGAL_NAME` | [TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2] | blocked on F2 |
| `GOVERNING_LAW_VENUE` | [TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2] | blocked on F2 |
| `OPERATOR_CONTACT_ADDRESS` | [TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2] | blocked on F2 |
| `EFFECTIVE_DATE` | [TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2] | blocked on F2 |
| `HOSTING_REGION` | [TO BE COMPLETED BY OPERATOR BEFORE PUBLICATION - F2 / F1] | blocked on F2/F1 |

When filling these in:

1. Replace every occurrence of a token in the corpus. The remaining docs
   carry the same explicit placeholder text, so a repo-wide search for
   `TO BE COMPLETED BY OPERATOR` finds all sites.
2. `constants/legal.ts` (`OPERATOR_IDENTITY`) mirrors these tokens for the
   app runtime; update both in the same change.
3. Confirm each hosted page returns 200 (README ops list) and matches the
   URLs in `constants/legal.ts`.

Last centralization: 2026-07-11 (audit H5). Before this, the tokens were
scattered across `terms.md` and `privacy.md`.
