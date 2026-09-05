# 2026-08-01 - Meerkat comprehensive review + deploy-and-test walkthrough

## What was done

Comprehensive code-verified review of Meerkat (3 parallel verification agents + direct spot-checks), then authored `docs/guides/meerkat-deploy-and-test-walkthrough-2026-08-01.html`: an interactive visual runbook (sidebar TOC, persistent localStorage checklists, copy buttons, architecture diagram) covering the full founder+friend dogfood path: relay deploy, Apple/RevenueCat setup, repo fixes, TestFlight build+submit, web clients for Macs/PCs, first run, device pairing/person linking, friend add, community build, a 20-minute smoke script mapped to open ledger rows, and honest limitations. Opened in Chrome.

## Verified ground truth (highlights, all with file:line evidence in the agent briefs)

- Unlock gate: RevenueCat direct (`app-unlock.ts`), fail-closed, no dev bypass; `SyncProvider enabled={unlocked}` (`_layout.tsx:145`) means a locked app has no sync engine. TestFlight-usable build REQUIRES `EXPO_PUBLIC_MEERKAT_RC_KEY_IOS` baked + ASC non-consumable `meerkat_app_unlock`.
- Minimal backend = slim relay only (reads PORT/HOST only, no DB/secrets); account-service, LiveKit, push, humanity/persona/directory/community services all optional with honest fallbacks. Render/Fly templates exist; no published image (CI was billing-blocked).
- Relay mailbox: in-memory, default TTL 5 minutes (clamp max 24h via `RELAY_MAILBOX_TTL_MS`); no deploy template raises it. Walkthrough makes 86400000 the headline env var.
- `MEERKAT_HOSTED_ENTITLEMENT_REQUIRED` must stay unset: clients never send entitlement tokens on relay dials.
- EAS: project + credentials exist; `testflight` profile added earlier today; ALL 3 iOS builds errored (12f4d4fe stale; f21cdeb0 + 66c72eef on 08-01, 66c72eef = provisioning profile lacks Push capability). No env block, no submit block, NO APP ICON (`icon: undefined`, no assets dir). `testflight` profile silently bypasses check-build-env.mjs (profile name check).
- `@mylife/meerkat-call-native` config plugin absent from app.config.ts plugins (voip background mode missing) though the module is imported at runtime.
- Identity: no accounts; per-device keypair; plan 52 person groups (`pi_person_group`, personal_replica, HMAC-derived per-community ids); MKPAIR1 copy-paste is web's only pairing path; plan 53 tap ceremony is mobile-only and byte-equivalent to MKPAIR1 pairing.
- Own-device sync is narrow: person identity, `cm_read_state`, `cm_library_progress` (+ mp_pad). NOT synced: settings, unlock, community membership (each device joins via invite), inbound DMs (fan-out gap: sender addresses only devices it has paired with).
- Community joins: signed 48h invite links; joiner is `pending` until owner's device processes the handoff via relay mailbox; pending members' messages locally echo but are rejected by peers (`not_community_member`), no local compose gate.
- New defects surfaced by review: mobile never calls `ensurePersonalWorkspace` ("New library" is a silent no-op; contradicts CLAUDE.md claim), `isSensitive` unset by all modules so the SAS inbound gate is dead code, web boot hangs forever without SubtleCrypto (no isSecureContext check), age gate not covered by parity script.

## Files changed

- `docs/guides/meerkat-deploy-and-test-walkthrough-2026-08-01.html` (new)
- `errors_log.md`: spurious auto-log row resolved (hook misfired on an agent grep); new Unresolved row for the two 08-01 errored EAS builds
- `memory.md` session row; this log

## Verification

- No function logic changed (docs + error-log only); function gate not applicable.
- Walkthrough render-tested headlessly: zero console errors; hero, diagram, TOC, checklists screenshot-verified; opened in Chrome.

## Remaining items (owned by the walkthrough's checklists)

Founder: relay deploy, ASC record + IAP + RevenueCat key, approve icon, interactive TestFlight build, submit, invite testers, run the smoke script (rows 3-5 close ledger AC-1/AC-3/browse-takeover-recovery). Claude on request: icon generation + wiring, eas.json env/submit blocks, call-native plugin line, durable web hosting.
