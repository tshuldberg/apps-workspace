# 2026-06-12: Meerkat full git-history audit, encryption map, UX review, and redesign direction

## What was done

Founder asked for a full git history audit of Meerkat with edge-case hunting, encryption coverage verification, elegant-design review, and an HTML report. Mid-session the founder added three product directives (all saved to auto-memory `meerkat_product_direction.md`):

1. Core jobs: community building, sharing between your own devices, 1:1 with friends, in communities. Simple surface, complex settings behind navigation.
2. UI redesign scoped to LOOK AND FEEL ONLY (less techy/cyber, global mainstream audience). No feature/navigation mandate.
3. iOS share-sheet entry point (share INTO Meerkat like Snapchat/Instagram), Manhattan expo-share-intent precedent.

## How it ran

- Ultracode workflow: 16 finder dimensions (6 git-range + 10 subsystem) with per-finding adversarial verification and a completeness critic. Two waves (77 agent invocations) were both cut by session limits (resets 2:10am, then 7:10am ET); a one-shot cron resumed wave 2 from the workflow journal cache. 10/16 finder dimensions completed (git-m0a/m0b/m1/m2/m34/m56, crypto, session, transport, relay). The verifier wave was mostly lost; the audit lead re-verified all criticals and load-bearing highs first-party against the working tree.
- 3 separate agents delivered: UX friction walk (jobs scored 3/10, 2/10, 4/10; ~30-term jargon inventory), IA + golden-flows proposal (People-first tabs, QR pairing, auto relay selection, secret-derived session tokens, mailbox-based friend-share inbox), and the visual redesign (3 WCAG-checked palette directions; "Open Burrow" warm paper + sea green recommended; full token tables; migration path).
- Encryption coverage map and concept matrix synthesized first-party from audit data + direct schema checks (encmap/concept agents lost to limits; trust/policy/community/app covered indirectly via git-range diffs + the UX screen walk).

## Headline findings (102 unique: 3 critical, 11 high, 35 medium, 53 low/info)

- CRIT: app manual relay sessions never key the data channel (native engine passes no securityPreference); pad data crosses relay plaintext; every frame header carries the device Ed25519 pubkey. "Encrypted payloads" copy overstates (honesty breach). Bounded today: only mp_pad syncs.
- CRIT: dropped SYNC_OFFER/ACCEPT silently downgrades required-encryption sessions to plaintext (no else branch).
- CRIT: batch signatures verified only if present (strippable); inbound frames never bound to handshake peer; acks forgeable (no subset check).
- HIGH: deletes never propagate on native LWW (resurrection; tombstones never written locally; verified by the one surviving adversarial verifier); removed-member epoch-mismatch downgrade reads current workspace data; mailbox envelopes leak sender/recipient IDs cleartext to relay (deanonymizes abuse reporters); relay client swallows err/ready frames; putBlock swallows write errors (fake "pinned"); CLI send/open token mismatch (round trip cannot work); relay memory-exhaustible (no global caps) and rate limits reset on reconnect; outbound snapshots bypass stripColumns/device_local; inbound merges before policy (laundering).
- Git timeline: 23 commits audited, 18 with drift; pattern = overstatement at edges ("proven" on LWW harness while production uses Automerge; conditional protection described as unconditional), zero fabrication. In-flight revocation-gossip work landed mid-audit as 32d8f627f (reviewed: coherent; gossip still un-invoked by sessions).
- 127 edge cases catalogued (64 handled / 27 partial / 33 unhandled / 3 unknown).

## Deliverable

`docs/reports/REPORT-meerkat-audit-2026-06-12.html` (102KB, self-contained, rendered IN the proposed Open Burrow palette, opened in browser). Sections: executive verdict + grades; headline UI redesign (3 palettes, before/after phone mockups, global color-culture notes, migration path); verified findings; encryption coverage map (at-rest + in-flight); git timeline; edge-case catalog; concept matrix (built/partial/missing/deferred + design-blind-spot list); UX friction; IA suggestions incl. iOS share sheet; P0-P3 roadmap; methodology honesty section.

## Verification

- All 3 criticals + CLI defect + relay err-swallow + putBlock re-verified first-party (file:line confirmed in working tree).
- Report placeholders all filled (grep @@ = 0); opened via `open`.
- No code changed this session (audit-only). Function gate not applicable (no function logic modified).

## Remaining / next

- P0 list (report roadmap): default-required encryption in native engine sessions, fail-closed negotiation, mandatory batch sigs + frame-peer binding, relay err surfacing, putBlock fail-loud, mailbox ID sealing, CLI token fix.
- 6 finder dimensions (trust/policy/community/app deep-dive, dedicated encmap/concept agents) never ran as dedicated agents; covered indirectly. Re-run if a second wave is wanted.
- Open Brain MCP NOT connected all session (pending approval); zero captures made. Reconnect and backfill the audit summary + founder directives.
- The 2:11am and 7:11am one-shot crons: first fired (resumed wave 2), second cancelled after completion.
