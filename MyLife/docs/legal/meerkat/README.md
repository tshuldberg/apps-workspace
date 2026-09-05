# Meerkat legal & safety documents

Seven publishable documents for runbook Step 3 and founder-ops item 4.7. The `.md` files are canonical; `render-legal-pages.mjs` produces self-contained `.html` pages (same basename) plus `index.html`, ready to host as static files. Sources: promoted verbatim from the counsel-review drafts in `docs/reports/REPORT-meerkat-legal-readiness-2026-07-18.md` Section 9, which were prepared from code-verified product behavior.

**Every document is a DRAFT until counsel approves.** The DRAFT banner and fields panel render automatically while frontmatter `status` contains "DRAFT"; after approval, update `status`, fill the bracketed fields, set the effective date, and re-render:

```bash
node docs/legal/meerkat/render-legal-pages.mjs
```

## Document -> wiring map

| Document | App env var | Store/system requirement |
|---|---|---|
| terms-of-use.md | `MEERKAT_TERMS_URL` | Acceptance versioned `CURRENT_PUBLIC_TERMS_VERSION = '2026-07'` (packages/sync/src/protocol/public-post.ts:59); bump the constant when counsel changes material terms |
| privacy-policy.md | `MEERKAT_PRIVACY_POLICY_URL` | Also entered in App Privacy + Play Data safety forms |
| community-standards.md | `MEERKAT_COMMUNITY_STANDARDS_URL` | Categories match the in-app report enum exactly (spam, harassment, violence, csam, illegal/DMCA) |
| safety-and-appeals.md | `MEERKAT_SUPPORT_URL` | Defines the appeals process (no in-app appeals exist; email-based, human-reviewed) |
| dmca-policy.md | none (public page) | Agent identity must equal the six `MEERKAT_DMCA_AGENT_*` values and the Copyright Office registration; machine twin at `/public/dmca/agent` |
| law-enforcement-guidelines.md | none (public page) | Runbook Step 3 requirement |
| data-deletion-instructions.md | none (public page) | URL entered in the Play Data safety form (founder-ops 4.7); steps match `DELETE_MY_DATA_COPY` in the app |

Web app uses the `VITE_MEERKAT_*` twins of the same URLs.

## Publication workflow (runbook Step 3)

1. Counsel reviews each document; founder decisions from the counsel agenda (entity, age floor, disputes, thresholds) get filled into the bracketed fields.
2. Register the DMCA agent at dmca.copyright.gov; put the identical identity into dmca-policy.md and the `MEERKAT_DMCA_AGENT_*` production env.
3. Flip each frontmatter `status` from DRAFT on approval; set effective dates; re-render.
4. Host the rendered pages at HTTPS URLs on the production domains (any static host; pages are fully self-contained).
5. Set the four `MEERKAT_*_URL` env vars (and `VITE_` twins) to the exact production URLs.
6. Verify every URL from a logged-out browser and a phone; record URLs, versions, and TLS screenshots in the release ledger (Step 3 evidence).

## Consistency rules

- The report categories in community-standards.md and safety-and-appeals.md must track `PublicReportReason` (packages/sync/src/protocol/abuse-rails.ts) exactly.
- The deletion steps in data-deletion-instructions.md must track `DELETE_MY_DATA_COPY` (apps/meerkat/app/(root)/data/delete-account-core.ts).
- DMCA windows must track `MEERKAT_DMCA_NOTIFICATION_DEADLINE_DAYS` (5) and `MEERKAT_DMCA_COUNTER_NOTICE_DEADLINE_DAYS` (14) unless counsel changes both together.
- The verification-account language tracks the adopted plan 51 architecture; if plan 51 implementation diverges, update Terms section 4-5 and Privacy sections 2-3 in the same change.
