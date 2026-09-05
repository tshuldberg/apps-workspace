# 2026-06-12/13: Meerkat audit remediation + Open Burrow reskin (pair-programmed)

Branch: `feature/meerkat-network`. Pair-programming session continuing from the
full audit (`REPORT-meerkat-audit-2026-06-12.html`). The user directed at each
checkpoint; core trust-model choices were confirmed via AskUserQuestion.

## What shipped (18 commits)

### Security: audit P0 criticals + highs
- **MK-044 session hardening** (`fix(meerkat): MK-044 ...`): sessions default to
  required encryption (fail closed, never silent plaintext); a dropped
  SYNC_OFFER/ACCEPT hard-fails instead of downgrading; batch signatures are
  mandatory with inbound frames bound to the handshake peer; SYNC_ACK ids
  intersected with the sent batch (no forged-ack delivery loss). New **frame
  envelope** (`protocol/frame-envelope.ts`): every session frame crosses the
  wire sealed under a pairwise-secret key, so the relay sees no device ids,
  message types, or timestamps. `src/test/frame-tap.ts` lets wire-tap tests
  open envelopes; 7 capture tests converted; +8 hardening acceptance tests.
- **Mailbox v2** (`mailbox.ts`): sender/recipient ids moved INSIDE the sealed
  box; the relay can no longer deanonymize the pair-private token. Auth
  preserved (claimed sender read from inside, signature verified against it).
- **putBlock fail-loud** (`expo-node-store.ts`): a failed block write throws +
  is verified on disk; the Share screen surfaces the error instead of recording
  a fake "pinned". 
- **CLI token fix** (`meerkat-direct.mjs`): `open` now joins the sha512-derived
  token like `send`; + a bin-level regression test.

### Security: P1 highs (sync engine correctness)
- **LWW deletes propagate** via tombstones; no resurrection; persists across
  save/load (`lww-document-manager.ts`). +5 tests incl. live two-engine delete.
- **Inbound policy before merge** (`diffSyncMessage`): rejected/laundered rows
  never enter the document, so never re-broadcast.
- **Outbound scope filter** (`ChangeTracker.filterForSync`): device_local rows
  and stripColumns columns never reach the document/wire (both engines).
- **Epoch downgrade refused**: an epoch-keyed workspace fails rather than fall
  back to the pairwise key a removed member holds; + outbound membership gate.

### Security: P2 relay DoS
- Global caps (maxConnections, maxTokens, maxMailboxTokens) + per-IP rate and
  connection limits keyed by client (reconnect can't reset a window); rate
  state ages out on sweep; `/healthz` trimmed to ok+connections. +6 hub tests.

### Security: trust authority (founder decisions)
- **Introductions = workspace-admin-only** (`applyIntroduction`): introducer
  must be a current owner/admin of the named workspace.
- **Revocation = self + workspace-admin** (`isAdminOrSelfRevoker`): the default
  (gossip) authorizer no longer accepts any paired device; app `revokePeer`
  tightened to self-authored.
- **SAS is global per-pairing**: the engine gate reads the global record the app
  writes (the 5 emoji derive from the pairwise secret), so UI confirmation
  actually satisfies workspace sessions.

### Design: Open Burrow reskin (look + feel only, founder mandate)
- `tokens.ts` -> `MK_PALETTES { light, dark }`; every screen/provider/kit
  converted to `makeStyles(colors)` via `AppThemeProvider` (OS-driven dark mode,
  no settings toggle). Warm paper + sea-green, calm semantics (violet->blue),
  soft mono (no Courier), rounder radii, Meerkat-native `Button` (the hub button
  rendered in hub orange). Copy-tone polish: no ALL-CAPS/forced-uppercase.
- Collaborator explainer + reskin preview HTML in `docs/reports/`.

## Test posture
Sync 1011 -> 1021, relay 65 -> 71, app 31, all green; `gate:function:changed`
and `check:meerkat-parity` green throughout; every fix landed with a red-team or
acceptance test.

## Remaining
- Audit low/info: Noise FS still keys with legacy v1 KDF (not HKDF v2); MK-024
  entity-key crypto-shredding exported but unwired into replication;
  sliding-window no-ops on the Automerge web path; assorted low items.
- Product/UX (from the audit's UX section): QR pairing, friend inbox, the iOS
  share-sheet entry point (founder priority), channel posting.
- Open Brain MCP was not connected this session; no captures made.
