---
status: PROPOSAL
phase: 5
parent: docs/plans/consolidation/README.md
---

# Automation and Cross-Module Triggers

Manual-reversible automations only. Every trigger previews before running. No auto-spend, no auto-message, no silent side effects. Three surfaces: built-in rules, Apple Shortcuts, and Share Sheet.

## Built-in rules (toggle in Settings > Automations)

All off by default. Each rule shows a preview card on Today the first time it would fire, with Apply / Skip / Disable.

| Rule | Trigger | Action | Preview |
|------|---------|--------|---------|
| Receipt-photo fan-out | Attach photo to a budget transaction | Offer to tag + link to car fuel, homes cost, pet vet, RSVP expense, or closet wishlist | Shows module picker with smart default based on merchant |
| Recipe cook → nutrition | Mark a recipe as cooked | Auto-log food intake + decrement pantry + regenerate shopping list | Shows what gets logged/decremented |
| Mail ICS → hub_events | Email contains .ics attachment | Parse and offer to add to hub_events | Shows event details before adding |
| Budget detect-sub | Recurring transaction pattern detected | Prompt to confirm as subscription + create `sb_subscriptions` row | Shows pattern detected (payee, cadence, typical amount) |
| Book highlight → flash | Highlight >30 chars captured in books | Offer to create flash card | Shows card front/back preview |
| Voice note → journal+notes | Recording finishes | Transcribed once; available in journal, notes, voice | User picks home module; others link by reference |
| Workout GPS → surf | GPS workout ends at saved surf spot | Prompt to log surf session | Shows spot name + session scaffold |
| Trail packing | New trail trip created | Suggest packing list from closet + weather | Shows packing list preview |
| Garden harvest → recipes | Plant harvest logged | Add ingredient to pantry + suggest recipes | Shows recipe list |
| Pet weight → budget | Pet weight entry + food purchase | Suggest monthly pet food budget line | Shows calculation |

Implementation:

- New package `packages/automations` with a rule engine: `{ id, trigger, check, render_preview, apply }`
- Rules stored in `hub_automation_rules(id, enabled, last_fired_at, fire_count)`
- Every trigger writes to `hub_automation_log(id, rule_id, at, outcome, payload_json)` for audit

## Apple Shortcuts (iOS only, Phase 5.5)

Expose five app intents via `ExpoAppIntents`:

- `LogMood(score, notes?)` — Body cluster
- `StartFast(protocol, startAt?)` — Body cluster
- `AddExpense(amount, payee, module?)` — Money cluster
- `CreateNote(text, tags?)` — Mind cluster
- `BriefMe()` — returns formatted Today summary as spoken / text

User can trigger from Siri, widgets, automation triggers (arriving home, time of day). No background data access without explicit permission each time.

## Share Sheet (iOS + Android)

Receive handlers for:

- Text / URL → save to notes / journal / words
- Image → `hub_attachments` with module picker
- PDF → `hub_attachments` + optional OCR to notes
- .ics → hub_events preview

## Weekly digest delivery

Three channels, each independently toggled. All off by default. Configurable at `Settings > Notifications > Weekly digest`:

- **In-app** — a "This Week" tab on the Today surface aggregates `engagement/digest.ts` output. Pull-refresh or auto-refresh on Sunday.
- **Push** — single Sunday morning notification with digest summary; deep-links into the in-app tab.
- **Email** — Sunday morning email with the full digest; requires user to add and verify an email address.

Preference shape in `hub_preferences['digest.channels']` as JSON: `{ in_app: boolean, push: boolean, email: boolean, send_day: 0-6, send_hour: 0-23 }`. The scheduler reads this and fans out only to enabled channels. Email channel requires a verified address stored in `hub_preferences['digest.email']` and a user-provided SMTP or transactional sender config (no default server to preserve privacy).

## Conflict detection

The `hub_reminders` + `hub_events` tables get a conflict checker. When a new reminder or event would fire within 10 minutes of another, show a stacked notification: "3 reminders at 8am" instead of 3 separate pushes.

## What we explicitly do NOT automate

- Anything that spends money (payments, bill-pay)
- Anything that sends a message on user's behalf (email reply, SMS, social post)
- Reshuffling calendar blocks the user already committed to
- Auto-deleting data
- Cross-device sync without user-initiated pair

## Acceptance

- `packages/automations` with rule engine + at least 8 built-in rules
- Every rule has preview + apply + audit log entry
- Settings > Automations lists all rules with on/off + "reset preview" + "view log"
- Apple Shortcuts expose 5 intents documented
- Share Sheet handlers wired for text, URL, image, PDF, .ics
- Conflict detection stacks notifications within 10-min window
- `pnpm gate:function --file packages/automations/src/engine.ts` green
- `/qa` pass on Settings > Automations
