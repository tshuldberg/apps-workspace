# Meerkat Tester Guide (web + phone, every workflow)

Date: 2026-06-16
Branch: feature/meerkat-web-client
Artifact: `docs/reports/meerkat-tester-guide.html` (1230 lines, self-contained, offline)

## Goal

The founder onboarded 3 new testers and needed a single, beginner-proof HTML that walks
through every user workflow across the Meerkat web client (`apps/meerkat-web`) AND the
phone app (`apps/meerkat`), with recreated screen visuals, "so easy a 13 year old could
use it." Placeholder relay + honest setup note (no relay deployed yet).

This is a new, comprehensive companion to the existing concise `meerkat-web-getting-started.html`.

## Decisions (AskUserQuestion)

- Platform: web + phone (not web-only).
- Structure: a single user guide covering every workflow/feature across all devices (not a
  named 3-tester story scenario).
- Relay: placeholder `wss://YOUR-RELAY-HERE` + honest "all devices must use the same relay"
  note (no deployed relay; `DEFAULT_RELAY_URL` is empty by design).

## How it was built (2 workflows + inline authoring)

1. **Map workflow (11 agents):** parallel readers extracted exact UI labels, placeholders,
   notice copy, states, and honesty caveats from every relevant component in `apps/meerkat-web/src`
   and `apps/meerkat/app/(root)`, returning structured fact sheets (saved to `/tmp/mkfacts/*.json`).
   Also pulled launch/setup facts from `meerkat-web-manual-checklist.md` and `app.json`.
2. **Authoring (main thread):** wrote the HTML with a unified Open Burrow design system
   (light/dark via `prefers-color-scheme` + a manual System/Light/Dark toggle), two device
   frames (browser window + phone), numbered callout pins tied to numbered steps, reused
   component kit (cards, notes, kbd/btn chips, status pills, stat tiles, modals), and a
   46-item tester checklist. 14 sections: get in, identity, tour, communities, relay,
   pairing, sync, chat, files, phone-only powers, settings/safety, shortcuts, checklist,
   promise+glossary.
3. **Verify workflow (6 agents):** adversarial review across accuracy-web, accuracy-mobile,
   honesty, readability, coverage, and HTML validity, cross-checked against the fact sheets.

## Findings fixed (all P0/P1 + high-value P2)

- **Accuracy:** web unread badges do not render in the current web build (removed the mock
  badge + rescoped to phone); requester "Request again" never shows "sent to the relay"
  (that is the owner's "Re-sent to the relay." on Approve) so reworded; phone Settings
  Background-sync pill restored to the full "On-demand drain live; scheduled pending"; the
  delete-confirm split into the real web string vs the phone alert.
- **Honesty:** promoted the recovery "restore not built yet" caveat out of a parenthetical
  into a prominent danger callout; softened "when it finishes" -> "when a session actually
  completes"; "live status pill" -> "shows the real engine state, never a fake connected";
  heading "magic handshake" -> "manual handshake"; appended the relay-only clause to the
  onboarding mock notice.
- **Readability (13-year-old):** glossed node, payload, descriptor, seal/pin/block, magnet
  link, host, handshake (inline + glossary); defined devices A/B once; pointed ambiguous
  steps at the right screen; made all browser-mock URLs match the instruction
  (`localhost:5173`); split a dense relay sentence; renumbered Mission 3 pins to start at 1.
- **Coverage added:** per-community Files index (web + phone), phone Host-history import,
  Clear local node, Alpha test readiness + Copy diagnostics, SAS revoke + verified state,
  Sync pad (bellwether) + Transport rungs, Android Saved-files folder, scheduled
  background-sync toggle + last-run line, open-a-link outcome states. Matching checklist rows.

## Verification

- Rendered in headless Chromium (gstack browse) from `file:///tmp/...`: zero console errors;
  theme toggle works; screenshots in light, dark, and 390px mobile confirm the recreated
  browser/phone frames, pins, and responsive single-column reflow.
- Local checks: no em/en dashes (workspace rule), all in-page anchors resolve, div/ol/ul
  tags balanced, 46 checklist checkboxes.

## Honesty boundary held throughout

Web = relay-only (no LAN/Bluetooth in a browser); LAN = phone dev-build only; no automatic
peer auto-dial; nothing transmits until a manual sync; no fake "connected/delivered/online"
or peer counts; recovery-restore is not built yet. Every quoted label/copy string came from
source via the map workflow.

## Notes

- No runtime/function logic changed (docs/HTML only), so the function gate is N/A.
- Open Brain MCP was Pending approval this session, so no cross-device capture was made;
  flagged to the user at session start.

## Remaining / next

- Optional: fold the same recreated-screen treatment into a printable PDF, or link the guide
  from a testers landing page once a relay is deployed.
