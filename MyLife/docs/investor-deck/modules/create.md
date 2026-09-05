# MyCreate — Module Audit

**ID:** create | **Prefix:** ct_ | **Tier:** premium | **Storage:** sqlite
**Mobile wired:** yes | **Web wired:** yes | **Version:** 0.1.0
**One-line promise:** Track your creative journey

## User Value
- Project-centric tracking for any creative pursuit (writing, music, art, code, making).
- Progress entries with photos build a visible timeline per project.
- Portfolio pieces separate "work shown" from "work in progress".
- Skills and practice tracking make daily creative habits measurable.
- Equipment register keeps gear inventory without a spreadsheet.

## Feature Inventory (code-verified)
| Feature | Source | Status |
|---------|--------|--------|
| Projects + progress entries | modules/create/src/db/schema.ts (ct_projects, ct_progress_entries) | shipped |
| Photo attachments per progress entry | modules/create/src/db/schema.ts (ct_photos) | shipped |
| Portfolio pieces (separate from projects) | apps/*/create/portfolio screen; types.ts | shipped (UI + models) |
| Skills + practice log | apps/*/create/skills, practice; types.ts | shipped (UI + models) |
| Equipment register | apps/mobile/app/(create)/ (referenced in tab), definition navigation | shipped |
| Settings | modules/create/src/db/schema.ts (ct_settings) | shipped |

## Data Model
- ct_projects, ct_progress_entries, ct_photos, ct_settings.
- Only 4 tables; skills, portfolio, practice appear to be derived views over projects + progress (confirm on next schema migration).

## Screens / User Flows
- Mobile: apps/mobile/app/(create)/ -- index, project/, portfolio, skills, practice, settings.
- Web: apps/web/app/create/ -- page, project/, portfolio/, skills/, practice/, settings/, actions.ts, ui.tsx, data.ts.

## Distinctive / Moat-worthy
- Cross-craft (writing, music, code, fabrication) in one tracker vs genre-specific tools like Scrivener or Pro Tools logs.
- Photo-anchored progress timeline per project (not just word count).
- No cloud required; creative work stays private until the user ships it.
- Integrates with MyFlash (practice cards) and MyJournal (reflection) as a habit loop.

## Gaps vs competitors (from COMPETITIVE-MATRIX)
- Not present in COMPETITIVE-MATRIX.md (module added post-matrix). Needs a new row next refresh; potential competitors include Notion templates, Things for projects, Artsy/Behance for portfolio.
- Schema is lean (4 tables). Portfolio, skills, practice, and equipment may still be partly derived. Confirm data model parity with the full spec before investor demo.

## Investor-facing hook
MyCreate is the single place a creator tracks ideas, practice, finished pieces, and gear without a Notion subscription or an Instagram audience tax.
