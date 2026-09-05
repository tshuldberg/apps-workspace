#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.cwd());

let failures = 0;

function out(line) {
  process.stdout.write(`${line}\n`);
}

function err(line) {
  process.stderr.write(`${line}\n`);
}

function fail(message) {
  err(`FAIL ${message}`);
  failures += 1;
}

function ok(message) {
  out(`OK   ${message}`);
}

function ensureFile(path) {
  const full = resolve(root, path);
  if (!existsSync(full)) {
    fail(`${path} is missing`);
    return '';
  }
  ok(path);
  return readFileSync(full, 'utf8');
}

function ensureContains(path, contents, needle, label) {
  if (!contents) return; // file missing already reported
  if (contents.includes(needle)) {
    ok(`${path} ${label}`);
  } else {
    fail(`${path} ${label} (expected to contain ${JSON.stringify(needle)})`);
  }
}

// A honesty REGRESSION guard: the needle must be ABSENT (a now-false claim, a
// fabricated count, a stale copy string). Fails if the needle reappears.
function ensureAbsent(path, contents, needle, label) {
  if (!contents) return; // file missing already reported
  if (!contents.includes(needle)) {
    ok(`${path} ${label}`);
  } else {
    fail(`${path} ${label} (must NOT contain ${JSON.stringify(needle)})`);
  }
}

// Whitespace-and-case-insensitive contains. JSX wraps prose across source lines
// (and may start a sentence with a capital), so a phrase that is verbatim on
// screen is split by newlines + indentation in the file. Collapse whitespace and
// lowercase both sides before matching. Use ONLY for wrapped display prose, never
// for code tokens.
function collapseWs(value) {
  return value.replace(/\s+/gu, ' ').toLowerCase();
}
function ensureContainsNormalized(path, contents, needle, label) {
  if (!contents) return; // file missing already reported
  if (collapseWs(contents).includes(collapseWs(needle))) {
    ok(`${path} ${label}`);
  } else {
    fail(`${path} ${label} (expected normalized to contain ${JSON.stringify(needle)})`);
  }
}

// Recursively list source files under a dir (skips node_modules/dist). Used by
// the mobile-only transport NEGATIVE guard to prove the web tree carries no
// WebRTC/Nearby/BLE data backend anywhere.
function walkFiles(dir, exts) {
  const collected = [];
  let entries;
  try {
    entries = readdirSync(resolve(root, dir));
  } catch {
    return collected;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === 'dist' || name === 'coverage') continue;
    const rel = `${dir}/${name}`;
    const full = resolve(root, rel);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) collected.push(...walkFiles(rel, exts));
    else if (exts.some((ext) => name.endsWith(ext))) collected.push(rel);
  }
  return collected;
}

// Find the first tree file that contains a needle (or null). Both args relative.
function findInTree(dir, exts, needle) {
  for (const rel of walkFiles(dir, exts)) {
    if (readFileSync(resolve(root, rel), 'utf8').includes(needle)) return rel;
  }
  return null;
}

out('Checking Meerkat standalone app artifacts...\n');

// Config + scaffolding
const packageJson = ensureFile('apps/meerkat/package.json');
const appJson = ensureFile('apps/meerkat/app.json');
ensureFile('apps/meerkat/eas.json');
ensureFile('apps/meerkat/metro.config.js');
ensureFile('apps/meerkat/tsconfig.json');
ensureFile('apps/meerkat/vitest.config.ts');
ensureFile('apps/meerkat/scripts/check-build-env.mjs');
ensureFile('apps/meerkat/shims/crypto.js');
ensureFile('apps/meerkat/app/_layout.tsx');
ensureFile('apps/meerkat/app/index.tsx');

// Theme + providers
ensureFile('apps/meerkat/app/(root)/theme/tokens.ts');
ensureFile('apps/meerkat/app/(root)/_layout.tsx');
ensureFile('apps/meerkat/app/(root)/providers/AppThemeProvider.tsx');
const databaseProvider = ensureFile('apps/meerkat/app/(root)/providers/DatabaseProvider.tsx');
ensureFile('apps/meerkat/app/(root)/providers/IdentityProvider.tsx');
const nodeProvider = ensureFile('apps/meerkat/app/(root)/providers/NodeProvider.tsx');

// Data layer
ensureFile('apps/meerkat/app/(root)/data/db.ts');
const meerkatDb = ensureFile('apps/meerkat/app/(root)/data/meerkat-db.ts');
const expoNodeStore = ensureFile('apps/meerkat/app/(root)/data/expo-node-store.ts');

// Components
ensureFile('apps/meerkat/app/(root)/components/ErrorBoundary.tsx');
ensureFile('apps/meerkat/app/(root)/components/kit.tsx');

// Five tab screens + detail
ensureFile('apps/meerkat/app/(root)/(tabs)/_layout.tsx');
ensureFile('apps/meerkat/app/(root)/(tabs)/index.tsx');
ensureFile('apps/meerkat/app/(root)/(tabs)/share.tsx');
ensureFile('apps/meerkat/app/(root)/(tabs)/identity.tsx');
ensureFile('apps/meerkat/app/(root)/(tabs)/communities.tsx');
ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx');
ensureFile('apps/meerkat/app/(root)/pinned/[id].tsx');

// Tests
ensureFile('apps/meerkat/app/__tests__/node-core.test.ts');
ensureFile('apps/meerkat/app/__tests__/app-config.test.ts');

// Docs
ensureFile('apps/meerkat/README.md');
ensureFile('apps/meerkat/CLAUDE.md');
ensureFile('apps/meerkat/AGENTS.md');
ensureFile('apps/meerkat/Tickets/launch-plan.md');

out('\nContent assertions:\n');

// package.json identity + sync dependency
ensureContains('apps/meerkat/package.json', packageJson, '"@mylife/meerkat-app"', 'is @mylife/meerkat-app');
ensureContains('apps/meerkat/package.json', packageJson, '"@mylife/sync"', 'depends on @mylife/sync');

// app.json scheme + ids
ensureContains('apps/meerkat/app.json', appJson, '"scheme": "meerkat"', 'declares meerkat scheme');
ensureContains('apps/meerkat/app.json', appJson, '"name": "Meerkat"', 'is named Meerkat');
ensureContains('apps/meerkat/app.json', appJson, 'com.mylife.meerkat', 'declares meerkat bundle/package id');

// Real core usage: the app must import @mylife/sync somewhere meaningful.
ensureContains(
  'apps/meerkat/app/(root)/providers/NodeProvider.tsx',
  nodeProvider,
  "from '@mylife/sync'",
  'imports the @mylife/sync node layer',
);
ensureContains(
  'apps/meerkat/app/(root)/data/expo-node-store.ts',
  expoNodeStore,
  'implements NodeStore',
  'ExpoNodeStore implements NodeStore',
);

// Plan 38 D.4: mk_pinned is context-aware and sealed blocks are refcounted. The
// mobile ExpoNodeStore and web BrowserNodeStore are SQL twins; their mk_pinned /
// mk_pinned_blocks SQL must not drift (a divergent refcount query on one surface
// would let one context's unpin evict blocks another context still holds). Both
// consume the (content_id, pin_context) schema from @mylife/sync, and every SQL
// line touching those tables must be byte-identical after whitespace normalize.
const browserNodeStore = ensureFile('apps/meerkat-web/src/lib/storage/browser-node-store.ts');
const PINNED_SQL_NEEDLES = [
  'INSERT OR REPLACE INTO mk_pinned',
  'SELECT * FROM mk_pinned WHERE content_id = ? AND pin_context = ?',
  'DELETE FROM mk_pinned WHERE content_id = ? AND pin_context = ?',
  'INSERT OR IGNORE INTO mk_pinned_blocks (sealed_id, content_id, pin_context)',
  'DELETE FROM mk_pinned_blocks WHERE content_id = ? AND pin_context = ?',
  'SELECT COUNT(*) AS c FROM mk_pinned_blocks WHERE sealed_id = ?',
  'SELECT COUNT(DISTINCT sealed_id) AS block_count FROM mk_pinned_blocks',
];
for (const needle of PINNED_SQL_NEEDLES) {
  ensureContains('apps/meerkat/.../expo-node-store.ts', expoNodeStore, needle, `ExpoNodeStore has D.4 SQL: ${needle.slice(0, 42)}`);
  ensureContains('apps/meerkat-web/.../browser-node-store.ts', browserNodeStore, needle, `BrowserNodeStore has D.4 SQL: ${needle.slice(0, 42)}`);
}
function pinnedSqlLines(contents) {
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('mk_pinned'))
    .filter((line) => !line.startsWith('//') && !line.startsWith('*'));
}
if (expoNodeStore && browserNodeStore) {
  const mobileSql = pinnedSqlLines(expoNodeStore).join('\n');
  const webSql = pinnedSqlLines(browserNodeStore).join('\n');
  if (mobileSql === webSql) {
    ok('mobile and web node-store mk_pinned / mk_pinned_blocks SQL surfaces are identical (Plan 38 D.4)');
  } else {
    fail('mobile and web node-store mk_pinned SQL surfaces drifted (Plan 38 D.4 refcount)');
  }
}

// Durability fix (MK-001): the shared db boot (used by the DB provider AND the
// headless background path) configures the secret store + PRNG before any
// identity/seal call, and the DB provider delegates to it so the boot order is
// identical foreground and background.
ensureContains(
  'apps/meerkat/app/(root)/data/meerkat-db.ts',
  meerkatDb,
  'configureSyncSecretStore',
  'configures the sync secret store (MK-001)',
);
ensureContains(
  'apps/meerkat/app/(root)/data/meerkat-db.ts',
  meerkatDb,
  'configureSyncPrng',
  'configures the sync PRNG (MK-001)',
);
ensureContains(
  'apps/meerkat/app/(root)/providers/DatabaseProvider.tsx',
  databaseProvider,
  'getMeerkatDatabase',
  'delegates the MK-001 boot order to the shared db module',
);

// Theme system (Plan 18): both apps consume the shared @mylife/meerkat-theme
// package, and the device-local mk_themes store is a verbatim twin across mobile
// and web (the SQL/CRUD surface must not drift).
out('\nChecking Meerkat theme system parity (Plan 18)...\n');

ensureContains(
  'apps/meerkat/package.json',
  packageJson,
  '@mylife/meerkat-theme',
  'mobile app depends on @mylife/meerkat-theme',
);
const webPackageJson = ensureFile('apps/meerkat-web/package.json');
ensureContains(
  'apps/meerkat-web/package.json',
  webPackageJson,
  '@mylife/meerkat-theme',
  'web app depends on @mylife/meerkat-theme',
);

const mobileThemeStore = ensureFile('apps/meerkat/app/(root)/theme/theme-store.ts');
const webThemeStore = ensureFile('apps/meerkat-web/src/ui/theme/theme-store.ts');

// The exact SQL/CRUD surface both stores must share (DDL, column list, queries).
const THEME_SQL_NEEDLES = [
  'CREATE TABLE IF NOT EXISTS mk_themes',
  'id, name, profile_json, base_preset_id, source, created_at, updated_at',
  'INSERT OR REPLACE INTO mk_themes',
  'UPDATE mk_themes SET name = ?, updated_at = ? WHERE id = ?',
  'DELETE FROM mk_themes WHERE id = ?',
  'SELECT value FROM mk_settings WHERE key = ?',
  'INSERT OR REPLACE INTO mk_settings (key, value) VALUES (?, ?)',
];
for (const needle of THEME_SQL_NEEDLES) {
  ensureContains('apps/meerkat/.../theme-store.ts', mobileThemeStore, needle, `mobile store has SQL: ${needle}`);
  ensureContains('apps/meerkat-web/.../theme-store.ts', webThemeStore, needle, `web store has SQL: ${needle}`);
}

// Twin check: every mk_themes / mk_settings SQL-bearing line must be identical
// (whitespace-normalized) between the two stores.
function sqlLines(contents) {
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('mk_themes') || line.includes('mk_settings'))
    .filter((line) => !line.startsWith('//') && !line.startsWith('*')); // comments may differ (web twin header)
}
if (mobileThemeStore && webThemeStore) {
  const mobileSql = sqlLines(mobileThemeStore).join('\n');
  const webSql = sqlLines(webThemeStore).join('\n');
  if (mobileSql === webSql) {
    ok('mobile and web theme-store SQL surfaces are identical');
  } else {
    fail('mobile and web theme-store SQL surfaces drifted (mk_themes/mk_settings lines differ)');
  }
}

// Twin check (Plan 19 FF5): public-publish.ts is a byte-identical twin across
// mobile and web on ALL shared logic. The ONLY sanctioned differences are comment
// lines (the web twin carries a different header) and the one data-layer import
// (./community-core on mobile vs ./meerkat-data on web). Strip comment + blank
// lines, normalize that import, then assert the remaining whitespace-normalized
// lines are identical, so a future edit to one twin cannot silently diverge.
function twinLogicLines(contents) {
  return contents
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
    // Sanctioned import-path differences between the surfaces, normalized to a
    // common token so twins compare equal: the web data layer consolidates into
    // meerkat-data.ts (vs mobile community-core.ts/db.ts), the chat kit lives at
    // a different relative depth, and the hex formatter lives in theme/ vs ui/.
    .map((line) => line
      .replaceAll("from './meerkat-data'", "from './community-core'")
      .replaceAll("from './db'", "from './community-core'")
      .replaceAll("from '../components/chat/chat-kit-core'", "from './chat-kit-core'")
      .replaceAll("from '../theme/format'", "from './format'")
      .replaceAll("from '../ui/format'", "from './format'"));
}

// feed-core.ts, invite-envelope-core.ts, public-publish.ts and every other
// pure core twin are locked declaratively in CORE_TWINS below (composition
// Phase 0); their per-file rationale lives as notes beside their entries.
{
  const mobileInviteShareEnvelope = ensureFile('apps/meerkat/app/(root)/components/InviteShareSheet.tsx');
  const webCommunitySettingsEnvelope = ensureFile('apps/meerkat-web/src/ui/community/CommunitySettings.tsx');
  const mobileAddFriendEnvelope = ensureFile('apps/meerkat/app/(root)/(tabs)/add-friend.tsx');
  const webAddFriendEnvelope = ensureFile('apps/meerkat-web/src/ui/friends/AddFriendOverlay.tsx');
  if (mobileInviteShareEnvelope) ensureContains('apps/meerkat/.../InviteShareSheet.tsx', mobileInviteShareEnvelope, 'buildCommunityInviteEnvelope', 'mobile invite share routes through the community envelope builder');
  if (webCommunitySettingsEnvelope) ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettingsEnvelope, 'buildCommunityInviteEnvelope', 'web invite panel routes through the community envelope builder');
  if (mobileAddFriendEnvelope) ensureContains('apps/meerkat/.../add-friend.tsx', mobileAddFriendEnvelope, 'buildContactEnvelope', 'mobile add-friend routes through the contact envelope builder');
  if (webAddFriendEnvelope) ensureContains('apps/meerkat-web/.../AddFriendOverlay.tsx', webAddFriendEnvelope, 'buildContactEnvelope', 'web add-friend routes through the contact envelope builder');
}

// sharedLogicFrom was folded into coreTwinLogic (CORE_TWINS below).
// Plan 52 P3: the join-time name copy must be verbatim on both preview
// sheets (the one door every join flow funnels through on each platform).
const JOIN_NAME_COPY = [
  'Your name in this community',
  'Only this community sees this name. Your other devices use it here too. You can change it later in community settings.',
];
{
  const mobileSheet = ensureFile('apps/meerkat/app/(root)/components/InvitePreviewSheet.tsx');
  const webSheet = ensureFile('apps/meerkat-web/src/ui/community/InvitePreviewSheet.tsx');
  for (const [label, path, contents] of [
    ['mobile', 'apps/meerkat/app/(root)/components/InvitePreviewSheet.tsx', mobileSheet],
    ['web', 'apps/meerkat-web/src/ui/community/InvitePreviewSheet.tsx', webSheet],
  ]) {
    if (!contents) continue;
    for (const needle of JOIN_NAME_COPY) {
      ensureContains(path, contents, needle, `${label} invite preview carries the join-name copy`);
    }
  }
}

// Plan 52 P4: the connected-devices expansion copy must be verbatim on both
// community settings surfaces (devices are always one expand away, never hidden).
{
  const mobileSettings = ensureFile('apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx');
  const webSettings = ensureFile('apps/meerkat-web/src/ui/community/CommunitySettings.tsx');
  for (const [label, path, contents] of [
    ['mobile', 'apps/meerkat/.../community/[communityId]/settings.tsx', mobileSettings],
    ['web', 'apps/meerkat-web/.../CommunitySettings.tsx', webSettings],
  ]) {
    if (!contents) continue;
    ensureContains(path, contents, 'CONNECTED_DEVICES_HEADING', `${label} settings renders the connected-devices affordance`);
    ensureContains(path, contents, 'CONNECTED_DEVICES_HINT', `${label} settings renders the connected-devices honesty hint`);
    ensureContains(path, contents, 'NAME_DISAGREEMENT_HINT', `${label} settings surfaces a mid-alignment name disagreement`);
    ensureContains(path, contents, 'personDeviceCountLabel(row)', `${label} settings always shows the device count on a collapsed person`);
  }
}

// Plan 52 M-3: the per-community name save must state that linked devices
// adopt it, on both surfaces. Locked statically because the notice does not
// survive the provider refresh, so an e2e cannot observe it.
{
  const mobileSettings2 = ensureFile('apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx');
  const webSettings2 = ensureFile('apps/meerkat-web/src/ui/community/CommunitySettings.tsx');
  const needle = 'Your other linked devices use this name here too.';
  if (mobileSettings2) {
    ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileSettings2, needle,
      'mobile community profile save states that linked devices adopt the name');
  }
  if (webSettings2) {
    ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webSettings2, needle,
      'web community profile save states that linked devices adopt the name');
  }
}

// Plan 52 round-3: the removal copy must distinguish a COMMITTED removal from
// one still waiting on a co-signer (claiming a key rotation that has not
// happened is the dangerous case), and both surfaces must offer the fork
// escape hatch.
{
  const pairs = [
    ['apps/meerkat/.../OwnDeviceLinkCard.tsx', 'apps/meerkat/app/(root)/components/OwnDeviceLinkCard.tsx'],
    ['apps/meerkat-web/.../OwnDeviceLinkPanel.tsx', 'apps/meerkat-web/src/ui/messages/OwnDeviceLinkPanel.tsx'],
  ];
  for (const [label, path] of pairs) {
    const source = ensureFile(path);
    if (!source) continue;
    ensureContains(label, source,
      'Until then it is still one of your devices and the key has not changed.',
      'a pending removal says the device is NOT yet removed and the key is unchanged');
    ensureContains(label, source, 'Start my device group over',
      'offers the fork recovery control');
    // Round-4 L2: removals from a sibling must ask, and must say WHY they ask.
    ensureContains(label, source,
      'This needs your approval here, because removing a device is not something',
      'a sibling removal request asks for approval and explains why');
    ensureContains(label, source, 'You declined that removal. Nothing was changed.',
      'declining a removal states plainly that nothing changed');
    ensureContains(label, source, 'result.ok && result.assembled',
      'the "removed, new key generated" claim is gated on a COMMITTED removal');
  }
}

// ---------------------------------------------------------------------------
// CORE_TWINS (composition Phase 0): THE declarative core-lock registry. Every
// pure app core that exists on both surfaces is locked here as a tuple
// [label, mobilePath, webPath, anchor, endMarker?]:
//   - anchor null: the WHOLE file's logic lines must match (twinLogicLines:
//     comments/blank lines stripped, sanctioned import paths normalized).
//   - anchor string: shared logic is compared from the first occurrence of the
//     anchor to EOF; the import/platform preamble above it is the sanctioned
//     per-surface difference (provider types, platform copy tables).
//   - endMarker string: comparison stops before the marker; a documented
//     platform seam lives below it on BOTH surfaces (and the marker must
//     exist on both, so the seam cannot silently swallow shared logic).
// The meta-guard after the loop FAILS when a mobile core file has neither an
// entry here nor a documented exception, so a new core cannot ship unlocked.
// Every new *-core.ts must land with its CORE_TWINS entry in the same commit.
const CORE_TWINS = [
  ['invitation-intent-core.ts', 'apps/meerkat/app/(root)/data/invitation-intent-core.ts', 'apps/meerkat-web/src/lib/invitation-intent-core.ts', 'const listeners = new Set'],
  // Plan 30 P4: chat-kit holds the SECURITY-RELEVANT @mention token-boundary
  // logic (resolveSignedMentions / segmentBodyMentions).
  ['chat-kit-core.ts', 'apps/meerkat/app/(root)/components/chat/chat-kit-core.ts', 'apps/meerkat-web/src/lib/chat-kit-core.ts', 'export interface GroupableChatMessage'],
  ['live-loop-core.ts', 'apps/meerkat/app/(root)/data/live-loop-core.ts', 'apps/meerkat-web/src/lib/live-loop-core.ts', 'export const HOT_CADENCE_MS'],
  // Plan 52: the person-identity app core (import blocks legitimately differ).
  ['person-identity-core.ts', 'apps/meerkat/app/(root)/data/person-identity-core.ts', 'apps/meerkat-web/src/lib/person-identity-core.ts', 'export type RecordPersonChange'],
  // Plan 32 T0.2: the feed engine (ranking, enrichment, gating) below imports.
  ['feed-core.ts', 'apps/meerkat/app/(root)/data/feed-core.ts', 'apps/meerkat-web/src/lib/feed-core.ts', 'export type FeedControlKey'],
  // Phase 0: the feed card view mapping + render-perf helpers.
  ['feed-view-core.ts', 'apps/meerkat/app/(root)/data/feed-view-core.ts', 'apps/meerkat-web/src/ui/feed/feed-view-core.ts', 'export const HEART_EMOJI'],
  // Share-envelope wording: install-step omission, in-app join copy, honesty line.
  ['invite-envelope-core.ts', 'apps/meerkat/app/(root)/data/invite-envelope-core.ts', 'apps/meerkat-web/src/lib/invite-envelope-core.ts', 'export interface CommunityInviteEnvelopeArgs'],
  // Phase 0 remediation: the ONE join pipeline. The platform preamble holds the
  // route-reservation guard (mobile) and JOIN_PLATFORM_COPY (both).
  ['join-flow.ts', 'apps/meerkat/app/(root)/data/join-flow.ts', 'apps/meerkat-web/src/lib/join-flow.ts', 'export type JoinFailureReason'],
  // Phase 0: relay resolution for Add-friend (web preamble holds its web-only line).
  ['add-friend-core.ts', 'apps/meerkat/app/(root)/data/add-friend-core.ts', 'apps/meerkat-web/src/lib/add-friend-core.ts', 'export const ADD_FRIEND_NEEDS_SERVER_LINE'],
  // Directory taxonomy + verified-entry mapping (import split above the anchor).
  ['public-directory-client.ts', 'apps/meerkat/app/(root)/data/public-directory-client.ts', 'apps/meerkat-web/src/lib/public-directory-client.ts', 'export const PUBLIC_CATEGORIES'],
  // FF2 public reader paging + copy (import order differs above the anchor).
  ['public-reader-core.ts', 'apps/meerkat/app/(root)/data/public-reader-core.ts', 'apps/meerkat-web/src/lib/public-reader-core.ts', 'export const READER_COPY'],
  ['sync-peer-authorization.ts', 'apps/meerkat/app/(root)/data/sync-peer-authorization.ts', 'apps/meerkat-web/src/lib/sync-peer-authorization.ts', null],
  ['friend-publication-core.ts', 'apps/meerkat/app/(root)/data/friend-publication-core.ts', 'apps/meerkat-web/src/lib/friend-publication-core.ts', null],
  ['hosted-relay.ts', 'apps/meerkat/app/(root)/data/hosted-relay.ts', 'apps/meerkat-web/src/lib/hosted-relay.ts', 'let current:'],
  ['public-join-client.ts', 'apps/meerkat/app/(root)/data/public-join-client.ts', 'apps/meerkat-web/src/lib/public-join-client.ts', null],
  // Plan 19 FF5: byte-identical public-publish pipeline.
  ['public-publish.ts', 'apps/meerkat/app/(root)/data/public-publish.ts', 'apps/meerkat-web/src/lib/public-publish.ts', null],
  ['discover-core.ts', 'apps/meerkat/app/(root)/data/discover-core.ts', 'apps/meerkat-web/src/lib/discover-core.ts', null],
  // Composition Phase 1: the block registry (config schemas, data-source
  // declarations, capability gates) and the layout resolution choke point.
  ['block-registry-core.ts', 'apps/meerkat/app/(root)/data/block-registry-core.ts', 'apps/meerkat-web/src/lib/block-registry-core.ts', null],
  ['community-layout-core.ts', 'apps/meerkat/app/(root)/data/community-layout-core.ts', 'apps/meerkat-web/src/lib/community-layout-core.ts', null],
  // The audited query seam blocks read through (import blocks differ: mobile
  // splits community-core/community-files/library-data-core; web consolidates).
  ['block-queries.ts', 'apps/meerkat/app/(root)/data/block-queries.ts', 'apps/meerkat-web/src/lib/block-queries.ts', 'export interface BlockMemberRow'],
  // Plan 56 C1: the Canvas layer cores. The node registry is fully pure (F8
  // schemas + anti-spoof exclusion); canvas-core anchors below its import
  // preamble (table consts come from community-core vs meerkat-data).
  ['canvas-node-registry-core.ts', 'apps/meerkat/app/(root)/data/canvas-node-registry-core.ts', 'apps/meerkat-web/src/lib/canvas-node-registry-core.ts', null],
  ['canvas-core.ts', 'apps/meerkat/app/(root)/data/canvas-core.ts', 'apps/meerkat-web/src/lib/canvas-core.ts', 'export type CanvasRecordChange'],
  // Plan 56 C2: the badges core (verifiable scarcity reads + signed writes).
  ['badges-core.ts', 'apps/meerkat/app/(root)/data/badges-core.ts', 'apps/meerkat-web/src/lib/badges-core.ts', 'function listBadgeEvents'],
  ['asset-packs-core.ts', 'apps/meerkat/app/(root)/data/asset-packs-core.ts', 'apps/meerkat-web/src/lib/asset-packs-core.ts', 'function listAssetPackEvents'],
  ['canvas-assets.ts', 'apps/meerkat/app/(root)/data/canvas-assets.ts', 'apps/meerkat-web/src/lib/canvas-assets.ts', 'const CANVAS_ASSET_OBJECT_NAME'],
  ['call-log-core.ts', 'apps/meerkat/app/(root)/data/call-log-core.ts', 'apps/meerkat-web/src/lib/call-log-core.ts', null],
  ['call-provider-core.ts', 'apps/meerkat/app/(root)/data/call-provider-core.ts', 'apps/meerkat-web/src/lib/call-provider-core.ts', null],
  ['community-list-core.ts', 'apps/meerkat/app/(root)/data/community-list-core.ts', 'apps/meerkat-web/src/lib/community-list-core.ts', null],
  ['photo-timeline-core.ts', 'apps/meerkat/app/(root)/data/photo-timeline-core.ts', 'apps/meerkat-web/src/lib/photo-timeline-core.ts', null],
  ['room-view-core.ts', 'apps/meerkat/app/(root)/data/room-view-core.ts', 'apps/meerkat-web/src/lib/room-view-core.ts', null],
  ['auto-connect-core.ts', 'apps/meerkat/app/(root)/data/auto-connect-core.ts', 'apps/meerkat-web/src/lib/auto-connect-core.ts', null],
  ['presence-core.ts', 'apps/meerkat/app/(root)/data/presence-core.ts', 'apps/meerkat-web/src/lib/presence-core.ts', null],
  ['dm-core.ts', 'apps/meerkat/app/(root)/data/dm-core.ts', 'apps/meerkat-web/src/lib/dm-core.ts', null],
  ['dm-provider-core.ts', 'apps/meerkat/app/(root)/data/dm-provider-core.ts', 'apps/meerkat-web/src/lib/dm-provider-core.ts', null],
  ['dm-view-core.ts', 'apps/meerkat/app/(root)/data/dm-view-core.ts', 'apps/meerkat-web/src/lib/dm-view-core.ts', null],
  ['friends-core.ts', 'apps/meerkat/app/(root)/data/friends-core.ts', 'apps/meerkat-web/src/lib/friends-core.ts', null],
  ['member-removal-view-core.ts', 'apps/meerkat/app/(root)/data/member-removal-view-core.ts', 'apps/meerkat-web/src/lib/member-removal-view-core.ts', null],
  // Plan 38: the library substrate locks (metadata registry, data-core
  // invariants, extract/enrich hardening, storage pin classes, store engine).
  ['link-preview.ts', 'apps/meerkat/app/(root)/data/link-preview.ts', 'apps/meerkat-web/src/lib/link-preview.ts', null],
  ['library-metadata-core.ts', 'apps/meerkat/app/(root)/data/library-metadata-core.ts', 'apps/meerkat-web/src/lib/library-metadata-core.ts', null],
  ['community-theme-core.ts', 'apps/meerkat/app/(root)/data/community-theme-core.ts', 'apps/meerkat-web/src/lib/community-theme-core.ts', null],
  ['library-data-core.ts', 'apps/meerkat/app/(root)/data/library-data-core.ts', 'apps/meerkat-web/src/lib/library-data-core.ts', null],
  ['library-extract-core.ts', 'apps/meerkat/app/(root)/data/library-extract-core.ts', 'apps/meerkat-web/src/lib/library-extract-core.ts', null],
  ['library-enrich-core.ts', 'apps/meerkat/app/(root)/data/library-enrich-core.ts', 'apps/meerkat-web/src/lib/library-enrich-core.ts', null],
  ['person-view-core.ts', 'apps/meerkat/app/(root)/data/person-view-core.ts', 'apps/meerkat-web/src/lib/person-view-core.ts', null],
  ['device-layout-core.ts', 'apps/meerkat/app/(root)/data/device-layout-core.ts', 'apps/meerkat-web/src/lib/device-layout-core.ts', null],
  ['onboarding-experience-core.ts', 'apps/meerkat/app/(root)/data/onboarding-experience-core.ts', 'apps/meerkat-web/src/lib/onboarding-experience-core.ts', null],
  ['community-templates.ts', 'apps/meerkat/app/(root)/data/community-templates.ts', 'apps/meerkat-web/src/lib/community-templates.ts', null],
  ['library-storage-core.ts', 'apps/meerkat/app/(root)/data/library-storage-core.ts', 'apps/meerkat-web/src/lib/library-storage-core.ts', null],
  ['library-store-core.ts', 'apps/meerkat/app/(root)/data/library-store-core.ts', 'apps/meerkat-web/src/lib/library-store.ts', null],
  // Phase 0 (bounded): the sealed-reader sanitizers/CSP; the mount seam
  // (WebView html vs iframe srcdoc) lives BELOW the marker on both surfaces.
  ['library-reader-core.ts', 'apps/meerkat/app/(root)/data/library-reader-core.ts', 'apps/meerkat-web/src/lib/library-reader-core.ts', null, '--- platform mount seam'],
  // Storage destinations (Plan 41): pure destination + orchestration cores.
  ['storage-ui-core.ts', 'apps/meerkat/app/(root)/data/storage-destinations/storage-ui-core.ts', 'apps/meerkat-web/src/lib/storage/storage-ui-core.ts', null],
  ['local-destination-core.ts', 'apps/meerkat/app/(root)/data/storage-destinations/local-destination-core.ts', 'apps/meerkat-web/src/lib/storage/local-destination-core.ts', null],
  ['directory-destination-core.ts', 'apps/meerkat/app/(root)/data/storage-destinations/directory-destination-core.ts', 'apps/meerkat-web/src/lib/storage/directory-destination-core.ts', null],
  ['restore-orchestrator-core.ts', 'apps/meerkat/app/(root)/data/storage-destinations/restore-orchestrator-core.ts', 'apps/meerkat-web/src/lib/storage/restore-orchestrator-core.ts', null],
  ['blob-store-core.ts', 'apps/meerkat/app/(root)/data/blob-store-core.ts', 'apps/meerkat-web/src/lib/storage/blob-store-core.ts', null],
];

function coreTwinLogic(contents, anchor, endMarker) {
  let region = contents;
  if (endMarker) {
    const end = region.indexOf(endMarker);
    if (end < 0) return null;
    region = region.slice(0, end);
  }
  if (anchor) {
    const at = region.indexOf(anchor);
    if (at < 0) return null;
    region = region.slice(at);
  }
  return twinLogicLines(region).join('\n');
}

for (const [label, mobilePath, webPath, anchor, endMarker] of CORE_TWINS) {
  const mobileSrc = ensureFile(mobilePath);
  const webSrc = ensureFile(webPath);
  if (!mobileSrc || !webSrc) continue;
  const mobileLogic = coreTwinLogic(mobileSrc, anchor, endMarker);
  const webLogic = coreTwinLogic(webSrc, anchor, endMarker);
  const boundary = anchor ?? endMarker;
  if (mobileLogic === null) fail(`apps/meerkat ${label} is missing the ${JSON.stringify(boundary)} lock boundary`);
  else if (webLogic === null) fail(`apps/meerkat-web ${label} is missing the ${JSON.stringify(boundary)} lock boundary`);
  else if (mobileLogic === webLogic) ok(`mobile and web ${label} shared logic is byte-identical`);
  else fail(`mobile and web ${label} shared logic drifted (non-comment lines differ)`);
}

// Meta-guard (composition Phase 0, correction 1.3): the registry above must
// COVER the core convention, or a new core ships unlocked and parity rots
// silently. Enumerate every mobile data/*-core.ts (top level +
// storage-destinations/) plus the known out-of-convention cores; each must
// have a CORE_TWINS entry or a documented exception, never neither, never
// both. Exceptions record WHY a core is not twin-locked (verified per file);
// deleting a core also means deleting its entry/exception here.
const CORE_TWIN_EXCEPTIONS = new Map([
  ['channel-view-core.ts', 'legitimately divergent: web has no optimistic-send queue and keeps its own edit builder + raw-event mapper (Plan 30 P4)'],
  ['account-core.ts', 'platform account layer: mobile native SSO vs web redirect OIDC (Plan 51); no shared pure core'],
  ['community-core.ts', 'mobile schema + data hub; web consolidates into meerkat-data.ts (locked via targeted needle checks, not a twin)'],
  ['community-org-core.ts', 'structurally divergent from web community-organization-core.ts (verified 2026-08-28: 367 drifted logic lines, different shapes); remediation candidate'],
  ['delete-account-core.ts', 'platform honesty copy differs (device wipe vs browser wipe scope; verified 2026-08-28: copy-only drift); logic change on either side should be mirrored by hand'],
  ['file-request-core.ts', 'mobile-only: no web twin file'],
  ['history-backfill-core.ts', 'mobile backfill engine; web channel-history-import.ts is a smaller import-only surface'],
  ['humanity-core.ts', 'platform credential-mint seams differ (verified 2026-08-28: 26 drifted logic lines)'],
  ['library-hub-core.ts', 'mobile-only personal hub view mapping; web browse lives in library-browse-core.ts (different shape)'],
  ['library-view-core.ts', 'structurally divergent from web library-browse-core.ts (verified 2026-08-28); locked via LIBRARY_STATE_COPY needles'],
  ['loopback-server-core.ts', 'mobile-only loopback playback server; web playback is the pure planner library-playback.ts'],
  ['messages-core.ts', 'mobile-only messages tab view mapping'],
  ['music-queue-core.ts', 'mobile-only music sibling queue'],
  ['notification-identity-core.ts', 'mobile push identity; web push contract lives in web-push-core.ts'],
  ['onboarding-core.ts', 'platform onboarding flows differ (verified 2026-08-28: 35 drifted logic lines)'],
  ['persona-core.ts', 'platform persona registration seams differ (verified 2026-08-28: 18 drifted logic lines)'],
  ['proximity-ceremony-view-core.ts', 'mobile-only: the in-person ceremony needs the nearby radios (Plan 53); web states the honest cannot-do line instead'],
  ['public-post-client.ts', 'platform unlock plumbing differs (expo-constants receipt vs hosted-access cache); locked via targeted needle checks'],
  ['push-wake-core.ts', 'mobile data-only push wake; web equivalent is web-push-sw-core.ts'],
  ['snapshot-encoder-core.ts', 'mobile-only channel-history snapshot encoder (web imports snapshots, never encodes)'],
  ['sync-core.ts', 'mobile sync schema/boot; web equivalent is schema.ts + browser-sync-init.ts (platform boot)'],
  ['unlock-view-core.ts', 'mobile-only: fail-closed affordances for the store IAP phase machine (RevenueCat); web AppUnlockSection has no phase machine and already hides buy/restore when the hosted API is unconfigured'],
]);
const OUT_OF_CONVENTION_CORES = [
  'join-flow.ts',
  'link-preview.ts',
  'public-publish.ts',
  'public-directory-client.ts',
  'public-join-client.ts',
  'public-post-client.ts',
  'community-templates.ts',
];
{
  const dataDir = 'apps/meerkat/app/(root)/data';
  const isCoreFile = (name) => name.endsWith('-core.ts') && !name.endsWith('.test.ts');
  const enumerated = [];
  for (const name of readdirSync(resolve(root, dataDir))) {
    if (isCoreFile(name)) enumerated.push(name);
  }
  for (const name of readdirSync(resolve(root, `${dataDir}/storage-destinations`))) {
    if (isCoreFile(name)) enumerated.push(`storage-destinations/${name}`);
  }
  for (const name of OUT_OF_CONVENTION_CORES) enumerated.push(name);
  const lockedMobileFiles = new Set(CORE_TWINS.map(([, mobilePath]) => mobilePath.replace(`${dataDir}/`, '')));
  // chat-kit-core lives under components/, outside the enumerated tree.
  for (const file of enumerated.sort()) {
    const base = file.split('/').pop();
    const locked = lockedMobileFiles.has(file);
    const excepted = CORE_TWIN_EXCEPTIONS.has(base);
    if (locked && excepted) {
      fail(`core meta-guard: ${file} is BOTH locked in CORE_TWINS and listed as an exception; remove the stale exception`);
    } else if (locked) {
      ok(`core meta-guard: ${file} is twin-locked`);
    } else if (excepted) {
      ok(`core meta-guard: ${file} exception documented (${CORE_TWIN_EXCEPTIONS.get(base)})`);
    } else {
      fail(`core meta-guard: ${file} has NO CORE_TWINS entry and NO documented exception; add its lock in the same commit as the core`);
    }
  }
}

// link-preview, library-metadata-core, community-theme-core, library-data-core,
// library-extract-core, library-enrich-core, and person-view-core are locked in
// CORE_TWINS above (composition Phase 0).

// --- Plan 38 Phase 3/5: library browse state-string parity. The personal hub
// labels, availability badge, dedup notice, and the photo-location consent
// copy must appear on BOTH surfaces.
const LIBRARY_STATE_COPY = [
  'My Library',
  'On Deck',
  'Recently added',
  'Held on this device',
  'Already in this library',
  'Keep photo locations',
  'Save to library',
  'Add to library',
  'New library',
];
const mobileLibrarySurface = [
  'apps/meerkat/app/(root)/(tabs)/library.tsx',
  'apps/meerkat/app/(root)/(tabs)/library/item/[itemId].tsx',
  'apps/meerkat/app/(root)/data/library-view-core.ts',
  'apps/meerkat/app/(root)/(tabs)/files/[communityId].tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
const webLibrarySurface = [
  'apps/meerkat-web/src/ui/library/LibraryHome.tsx',
  'apps/meerkat-web/src/ui/library/LibraryItemDetail.tsx',
  'apps/meerkat-web/src/lib/library-browse-core.ts',
  'apps/meerkat-web/src/ui/files/FileActions.tsx',
  'apps/meerkat-web/src/ui/inbox/ShareInbox.tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
for (const copy of LIBRARY_STATE_COPY) {
  const label = `Library state copy: ${JSON.stringify(copy)}`;
  ensureContains('apps/meerkat library surface', mobileLibrarySurface, copy, label);
  ensureContains('apps/meerkat-web library surface', webLibrarySurface, copy, label);
}

// community-templates.ts and library-storage-core.ts are locked in CORE_TWINS
// above (composition Phase 0).

// --- Plan 38 Phase 7 state strings: templates, layout toggle, theme
// share/adopt, transport-honest availability, and the storage-model copy.
const PHASE7_STATE_COPY = [
  'Start from a template',
  'Family Space',
  'Media Library',
  'Club',
  'Course Hub',
  'Newsroom',
  'Blank',
  'Open on Library',
  'Share theme',
  'Adopt this theme',
  'Available from members who have it, when a sync connects.',
  'Keep on this device',
  'This device is deleting its copy. Meerkat cannot know if other members still hold it.',
  'Your kept items exceed the storage budget. Raise the budget or remove kept items.',
  'The same file saved in more than one community is stored once per community on this device.',
  'Community library files are available from members who have them during a sync; there is no always-on seeding yet.',
];
const mobilePhase7Surface = [
  'apps/meerkat/app/(root)/data/community-templates.ts',
  'apps/meerkat/app/(root)/data/library-storage-core.ts',
  'apps/meerkat/app/(root)/data/library-view-core.ts',
  'apps/meerkat/app/(root)/data/capability-status.ts',
  'apps/meerkat/app/(root)/(tabs)/communities.tsx',
  'apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx',
  'apps/meerkat/app/(root)/(tabs)/community/[communityId].tsx',
  'apps/meerkat/app/(root)/components/CommunityAppearanceSection.tsx',
  'apps/meerkat/app/(root)/components/CommunityOrganizationSection.tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
const webPhase7Surface = [
  'apps/meerkat-web/src/lib/community-templates.ts',
  'apps/meerkat-web/src/lib/library-storage-core.ts',
  'apps/meerkat-web/src/lib/library-browse-core.ts',
  'apps/meerkat-web/src/lib/capability-status.ts',
  'apps/meerkat-web/src/ui/community/CommunitySettings.tsx',
  'apps/meerkat-web/src/ui/community/CommunityAppearanceSection.tsx',
  'apps/meerkat-web/src/ui/community/CommunityOrganizationSection.tsx',
  'apps/meerkat-web/src/ui/community/CommunityThemeToggle.tsx',
  'apps/meerkat-web/src/ui/community/CommunityTemplatePicker.tsx',
  'apps/meerkat-web/src/ui/shell/OverlayHost.tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
for (const copy of PHASE7_STATE_COPY) {
  const label = `Phase 7 state copy: ${JSON.stringify(copy.slice(0, 48))}`;
  ensureContains('apps/meerkat phase-7 surface', mobilePhase7Surface, copy, label);
  ensureContains('apps/meerkat-web phase-7 surface', webPhase7Surface, copy, label);
}

// Twin check (Plan 27 P4 foundation): transport-policy labels and member notice
// copy are shared between mobile and web. The full P4 UI/gossip wiring lands in
// the Plan 27 track; this guard locks the copy foundation now so the two surfaces
// cannot drift once those screens consume it.
const mobilePolicyHistory = ensureFile('apps/meerkat/app/(root)/data/community-core.ts');
const webPolicyHistory = ensureFile('apps/meerkat-web/src/lib/policy-history.ts');
for (const copy of [
  'In person only',
  'Local preferred',
  'Any connection',
  'This community only updates in person or on a shared network.',
  'This community prefers a nearby connection and labels updates that go over the internet.',
  'This community updates over any connection, including the internet.',
  'The owner changed the sync policy from',
]) {
  ensureContains('apps/meerkat/.../community-core.ts', mobilePolicyHistory, copy, `Plan 27 policy-history copy: ${copy}`);
  ensureContains('apps/meerkat-web/.../policy-history.ts', webPolicyHistory, copy, `Plan 27 policy-history copy: ${copy}`);
}

// ============================================================================
// Plan 20 -- Connectivity guards (Phase 7, P7.1). Every connection surface must
// stay honest and mobile<->web parity-locked. The exact honesty violation this
// section exists to catch: a fabricated peer count, an online dot, or a
// "connected to {friend}" claim leaking into a connection surface; a web twin
// that silently drops the 5-state Connection card; or the now-false "no default"
// / "capacity is paid" stale copy creeping back after the free default shipped.
// These guards FAIL on regression; they are never softened to pass.
// ============================================================================
out('\nChecking Meerkat Plan 20 connectivity guards (Phase 7)...\n');

// --- effectiveRelayUrl twin: the single relay-dial choke point on both surfaces.
// Both import the shared decision from @mylife/sync and export effectiveRelayUrl(db).
const mobileEffRelay = ensureFile('apps/meerkat/app/(root)/data/effective-relay.ts');
const webEffRelay = ensureFile('apps/meerkat-web/src/lib/effective-relay.ts');
for (const [path, src] of [
  ['apps/meerkat/.../effective-relay.ts', mobileEffRelay],
  ['apps/meerkat-web/.../effective-relay.ts', webEffRelay],
]) {
  ensureContains(path, src, "from '@mylife/sync'", 'imports the shared relay decision from @mylife/sync');
  ensureContains(path, src, 'effectiveRelayUrl as pickEffectiveRelayUrl', 'consumes the pure @mylife/sync effectiveRelayUrl');
  ensureContains(path, src, 'export function effectiveRelayUrl(db', 'exports the effectiveRelayUrl(db) choke point');
}

// --- hosted-boundaries byte-identical copy guard. The two boundary matrices must
// be identical after normalizing the ONE sanctioned device<->browser swap; any
// other drift (a re-worded "paid" claim on one surface only) fails AC-7.
const mobileHostedBoundaries = ensureFile('apps/meerkat/app/(root)/data/hosted-boundaries.ts');
const webHostedBoundaries = ensureFile('apps/meerkat-web/src/lib/hosted-boundaries.ts');
function normalizeHostedBoundaries(contents) {
  return contents
    .replaceAll('This browser shows messages', 'This device shows messages')
    .replaceAll("stateLabel: 'Browser storage'", "stateLabel: 'Device storage'")
    .replaceAll("Files use this browser's local storage today", 'Files use local device storage today');
}
if (mobileHostedBoundaries && webHostedBoundaries) {
  if (normalizeHostedBoundaries(mobileHostedBoundaries) === normalizeHostedBoundaries(webHostedBoundaries)) {
    ok('mobile and web hosted-boundaries.ts are identical (modulo the sanctioned device<->browser swap)');
  } else {
    fail('mobile and web hosted-boundaries.ts drifted beyond the sanctioned device<->browser swap (AC-7)');
  }
}

// --- Connection-card 5-state copy parity. The verbatim state strings must appear
// in BOTH the mobile ConnectionStatusCard AND its web twin. THIS is the guard
// that catches a missing web twin: if the web card is dropped, these strings
// vanish from the web surface and the guard fails (do NOT weaken it -- add the
// twin). Reading stays anonymous; no state string is a peer/online count.
const mobileConnCard = ensureFile('apps/meerkat/app/(root)/components/ConnectionStatusCard.tsx');
const webConnCard = ensureFile('apps/meerkat-web/src/ui/sync/ConnectionStatusCard.tsx');
const CONNECTION_STATE_COPY = [
  'Checking the connection server…',
  'Pair on the same Wi-Fi, set a server below, or use a community server. Friend codes and offline delivery need a connection server.',
  "This connection server didn't answer just now. Try again, pair on the same Wi-Fi, or set a different server. Nothing is connected.",
  "You're using Meerkat's free, zero-knowledge connection server. It only ever sees scrambled bytes, never your messages or who you talk to. It is the meeting point, not delivery: a sync still needs the other device online.",
  'Meerkat will use this connection server. It carries encrypted data only.',
  'No connection server',
  'Unreachable',
  'Free server reachable',
  'Your server reachable',
];
for (const copy of CONNECTION_STATE_COPY) {
  const label = `Connection card state copy: ${JSON.stringify(copy.slice(0, 32))}...`;
  ensureContains('apps/meerkat/.../ConnectionStatusCard.tsx', mobileConnCard, copy, label);
  ensureContains('apps/meerkat-web/.../ConnectionStatusCard.tsx', webConnCard, copy, label);
}
// The web twin must actually be rendered inside the web connection surface (the
// Sync dialog Connection-server section + Settings > Connection server), else the
// strings above would be present in dead code.
const webRelaySection = ensureFile('apps/meerkat-web/src/ui/settings/RelaySection.tsx');
const webSyncDialog = ensureFile('apps/meerkat-web/src/ui/sync/SyncDialog.tsx');
ensureContains('apps/meerkat-web/.../RelaySection.tsx', webRelaySection, '<ConnectionStatusCard', 'renders the Connection status card in Settings');
ensureContains('apps/meerkat-web/.../SyncDialog.tsx', webSyncDialog, '<ConnectionStatusCard', 'renders the Connection status card in the Sync dialog');

// --- Plan 38 Phase 1: community identity/theme state-string parity. The six
// canonical strings (owner section heading, member toggle labels, and the
// HONEST theme-source line values fed only by resolveActiveTheme's source
// tag) must appear on BOTH surfaces. If a surface drops its identity UI or
// renames a state, this guard fails.
const COMMUNITY_THEME_STATE_COPY = [
  'Appearance & identity',
  'Use my theme',
  'Use community theme',
  'Community theme',
  'Your theme',
  'High contrast',
];
const mobileThemeSurface = [
  'apps/meerkat/app/(root)/components/CommunityAppearanceSection.tsx',
  'apps/meerkat/app/(root)/(tabs)/community/[communityId].tsx',
  'apps/meerkat/app/(root)/providers/CommunityThemeProvider.tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
const webThemeSurface = [
  'apps/meerkat-web/src/ui/community/CommunityAppearanceSection.tsx',
  'apps/meerkat-web/src/lib/community-theme-view.ts',
  'apps/meerkat-web/src/ui/community/CommunityThemeToggle.tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
for (const copy of COMMUNITY_THEME_STATE_COPY) {
  const label = `Community theme state copy: ${JSON.stringify(copy)}`;
  ensureContains('apps/meerkat community theme surface', mobileThemeSurface, copy, label);
  ensureContains('apps/meerkat-web community theme surface', webThemeSurface, copy, label);
}

// --- Plan 38 Phase 2: organization state-string parity. The owner section
// heading, archived read-only copy, and the per-device honesty line must
// appear on BOTH surfaces.
const ORGANIZATION_STATE_COPY = [
  'Organization',
  'Archived',
  'Archived channel. Content is preserved and read-only here.',
  'Pinned',
  'Only on this device',
];
const mobileOrgSurface = [
  'apps/meerkat/app/(root)/components/CommunityOrganizationSection.tsx',
  'apps/meerkat/app/(root)/(tabs)/communities.tsx',
  'apps/meerkat/app/(root)/(tabs)/community/[communityId].tsx',
  'apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
const webOrgSurface = [
  'apps/meerkat-web/src/ui/community/CommunityOrganizationSection.tsx',
  'apps/meerkat-web/src/ui/community/OrganizeCommunitiesDialog.tsx',
  'apps/meerkat-web/src/ui/community/ChannelSidebar.tsx',
  'apps/meerkat-web/src/ui/community/CommunityRail.tsx',
].map((p) => ensureFile(p) ?? '').join('\n');
for (const copy of ORGANIZATION_STATE_COPY) {
  const label = `Organization state copy: ${JSON.stringify(copy)}`;
  ensureContains('apps/meerkat organization surface', mobileOrgSurface, copy, label);
  ensureContains('apps/meerkat-web organization surface', webOrgSurface, copy, label);
}

// --- Plan 38 Phase 2: mk_community_prefs DDL parity (device-local twin, must
// not drift; whitespace-normalized like mk_relay_probe below).
function extractCommunityPrefsDdl(contents) {
  const m = contents.match(/CREATE TABLE IF NOT EXISTS mk_community_prefs\s*\(([\s\S]*?)\)/u);
  return m ? m[1].replace(/\s+/gu, ' ').trim() : null;
}
{
  const mobileDbForPrefs = ensureFile('apps/meerkat/app/(root)/data/db.ts');
  const webSchemaForPrefs = ensureFile('apps/meerkat-web/src/lib/schema.ts');
  if (mobileDbForPrefs && webSchemaForPrefs) {
    const mobilePrefs = extractCommunityPrefsDdl(mobileDbForPrefs);
    const webPrefs = extractCommunityPrefsDdl(webSchemaForPrefs);
    if (!mobilePrefs) fail('apps/meerkat db.ts is missing the mk_community_prefs DDL');
    else if (!webPrefs) fail('apps/meerkat-web schema.ts is missing the mk_community_prefs DDL');
    else if (mobilePrefs === webPrefs) ok('mk_community_prefs DDL is identical across mobile db.ts and web schema.ts');
    else fail('mk_community_prefs DDL drifted between mobile db.ts and web schema.ts');
  }
}

// --- mk_relay_probe schema parity (mobile db.ts vs web schema.ts). The probe
// cache DDL is a device-local twin; its column list must not drift.
const mobileDb = ensureFile('apps/meerkat/app/(root)/data/db.ts');
const webSchema = ensureFile('apps/meerkat-web/src/lib/schema.ts');
function extractRelayProbeDdl(contents) {
  const m = contents.match(/CREATE TABLE IF NOT EXISTS mk_relay_probe\s*\(([\s\S]*?)\)/u);
  return m ? m[1].replace(/\s+/gu, ' ').trim() : null;
}
if (mobileDb && webSchema) {
  const mobileDdl = extractRelayProbeDdl(mobileDb);
  const webDdl = extractRelayProbeDdl(webSchema);
  if (!mobileDdl) fail('apps/meerkat db.ts is missing the mk_relay_probe DDL');
  else if (!webDdl) fail('apps/meerkat-web schema.ts is missing the mk_relay_probe DDL');
  else if (mobileDdl === webDdl) ok('mk_relay_probe DDL is identical across mobile db.ts and web schema.ts');
  else fail('mk_relay_probe DDL drifted between mobile db.ts and web schema.ts');
}

// --- Screen-0 stale-copy REGRESSION guard. Shipping the free default made the
// old "no default" / "capacity is paid" copy FALSE; it must never reappear, and
// the free-vs-paid distinction phrase must be present on every rewritten site.
const STALE_CONNECTION_COPY = ['There is no default', 'First-party hosted connection capacity is paid'];
const FREE_VS_PAID_PHRASE =
  'the paid tier ($4.99/mo) adds capacity, backup, public reach, and always-on history';
const CONNECTION_COPY_SITES = [
  ['apps/meerkat/.../sync.tsx', ensureFile('apps/meerkat/app/(root)/sync.tsx')],
  ['apps/meerkat/.../settings.tsx', ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx')],
  ['apps/meerkat-web/.../RelayBar.tsx', ensureFile('apps/meerkat-web/src/ui/sync/RelayBar.tsx')],
  ['apps/meerkat-web/.../SyncDialog.tsx', webSyncDialog],
  ['apps/meerkat-web/.../RelaySection.tsx', webRelaySection],
];
for (const [path, src] of CONNECTION_COPY_SITES) {
  for (const stale of STALE_CONNECTION_COPY) {
    ensureAbsent(path, src, stale, `no stale "${stale}" copy (free default shipped)`);
  }
  ensureContainsNormalized(path, src, FREE_VS_PAID_PHRASE, 'carries the free-vs-paid distinction phrase');
}
// Also assert the stale claims are gone from the hosted-boundaries matrices.
for (const [path, src] of [
  ['apps/meerkat/.../hosted-boundaries.ts', mobileHostedBoundaries],
  ['apps/meerkat-web/.../hosted-boundaries.ts', webHostedBoundaries],
]) {
  ensureAbsent(path, src, 'There is no default', 'hosted-boundaries drops the stale "no default" claim');
}

// --- StatusPill "DO NOT SHOW" rule. The web StatusPill must never render a
// peer/online count (always 0 on web); the rule comment must remain (NC-1 / L2).
const webStatusPill = ensureFile('apps/meerkat-web/src/ui/shell/StatusPill.tsx');
ensureContains('apps/meerkat-web/.../StatusPill.tsx', webStatusPill, 'DO NOT SHOW', 'preserves the peer/online-count "DO NOT SHOW" rule');
ensureAbsent('apps/meerkat-web/.../StatusPill.tsx', webStatusPill, 'peersOnline', 'renders no peer/online count');

// ============================================================================
// Plan 20 -- Share + transport guards (Phase 12, P12.1). The OS share-intake
// staging is device-local by construction and a staged item is never "sent"
// until a real message row exists; the WebRTC/Nearby/BLE data transports are
// MOBILE-ONLY (web stays relay-only) and BLE is wake-only. These guards catch a
// staged->replicated leak, a fake "Sent" driven by mk_share_intake.status, a web
// P2P data backend, or BLE sneaking into the data-transport set.
// ============================================================================
out('\nChecking Meerkat Plan 20 share + transport guards (Phase 12)...\n');

// --- mk_share_intake / mk_share_payload schema parity. Both surfaces create the
// tables through the SINGLE @mylife/sync source of truth (ensureShareIntakeTables),
// so the DDL cannot drift; the sync package owns both CREATE TABLE statements.
ensureContains('apps/meerkat/.../data/db.ts', mobileDb, 'ensureShareIntakeTables', 'mobile creates share-intake tables via @mylife/sync');
ensureContains('apps/meerkat-web/.../schema.ts', webSchema, 'ensureShareIntakeTables', 'web creates share-intake tables via @mylife/sync');
const shareStore = ensureFile('packages/sync/src/share/share-intake-store.ts');
ensureContains('packages/sync/.../share-intake-store.ts', shareStore, 'CREATE TABLE IF NOT EXISTS mk_share_intake', 'owns the mk_share_intake DDL');
ensureContains('packages/sync/.../share-intake-store.ts', shareStore, 'CREATE TABLE IF NOT EXISTS mk_share_payload', 'owns the mk_share_payload DDL');

// --- DEVICE-LOCAL invariant. The share-intake + probe tables must NEVER appear
// in MEERKAT_SYNC_PREFIXES on either surface (they replicate nothing, NC-3/NC-9).
const mobileSyncCore = ensureFile('apps/meerkat/app/(root)/data/sync-core.ts');
const webMeerkatData = ensureFile('apps/meerkat-web/src/lib/meerkat-data.ts');
function extractSyncPrefixMap(contents) {
  const m = contents.match(/MEERKAT_SYNC_PREFIXES\s*=\s*new Map[\s\S]*?\]\);/u);
  return m ? m[0] : null;
}
for (const [path, src] of [
  ['apps/meerkat/.../sync-core.ts', mobileSyncCore],
  ['apps/meerkat-web/.../meerkat-data.ts', webMeerkatData],
]) {
  const block = src ? extractSyncPrefixMap(src) : null;
  if (!block) {
    fail(`${path} MEERKAT_SYNC_PREFIXES map not found`);
    continue;
  }
  ensureAbsent(`${path} (sync-prefix map)`, block, 'mk_share', 'mk_share_* stays device-local (not a sync prefix)');
  ensureAbsent(`${path} (sync-prefix map)`, block, 'mk_relay', 'mk_relay_probe stays device-local (not a sync prefix)');
}

// --- Share Inbox state-copy parity + "staged != sent" honesty. Both inboxes
// carry the shared device-local honesty phrase and gate the "Sent" label ONLY on
// isShareIntakeSent (a real cm_messages row), never mk_share_intake.status.
const mobileShareInbox = ensureFile('apps/meerkat/app/(root)/share-inbox/index.tsx');
const webShareInbox = ensureFile('apps/meerkat-web/src/ui/inbox/ShareInbox.tsx');
for (const [path, src] of [
  ['apps/meerkat/.../share-inbox/index.tsx', mobileShareInbox],
  ['apps/meerkat-web/.../inbox/ShareInbox.tsx', webShareInbox],
]) {
  ensureContainsNormalized(path, src, 'Nothing is sent until you', 'carries the device-local "nothing sent until routed" honesty copy');
  ensureContains(path, src, 'isShareIntakeSent', 'gates the "Sent" label on a real routed row (staged != sent)');
  ensureContains(path, src, 'availableShareDestinations', 'derives destinations from availableShareDestinations (DM-hidden)');
}
const mobileShareRoute = ensureFile('apps/meerkat/app/(root)/data/share-route.ts');
const webShareRoute = ensureFile('apps/meerkat-web/src/lib/share-route.ts');
ensureContains('apps/meerkat/.../share-route.ts', mobileShareRoute, 'export function isShareIntakeSent', 'defines isShareIntakeSent');
ensureContains('apps/meerkat/.../share-route.ts', mobileShareRoute, 'CM_MESSAGES_TABLE', 'isShareIntakeSent reads the real cm_messages table');
ensureContains('apps/meerkat/.../share-route.ts', mobileShareRoute, 'COUNT(*)', 'isShareIntakeSent counts a real destination row');
ensureContains('apps/meerkat-web/.../share-route.ts', webShareRoute, 'export function isShareIntakeSent', 'defines isShareIntakeSent');
ensureContains('apps/meerkat-web/.../share-route.ts', webShareRoute, 'cm_messages', 'isShareIntakeSent reads the real cm_messages table');
ensureContains('apps/meerkat-web/.../share-route.ts', webShareRoute, 'COUNT(*)', 'isShareIntakeSent counts a real destination row');

// --- DM surface flag guard. BOTH surfaces now ship the live DM thread surface
// (Plan 21 Phase 5 mobile, Phase 9 web): mobile DM_MESSAGES_SURFACE_AVAILABLE and
// web DM_MESSAGES_SURFACE_ENABLED are both true. The share-inbox on both surfaces
// still renders only channel/files, so the 'dm' destination is a latent
// capability, never a dead/disabled button.
ensureContains('apps/meerkat/.../share-route.ts', mobileShareRoute, 'DM_MESSAGES_SURFACE_AVAILABLE = true', 'mobile DM surface live (Plan 21 Phase 5)');
// The web DM flag is single-sourced in lib/dm-surface.ts (imported by ShareInbox,
// capability-status, AND MessagesView), so it is locked there, and ShareInbox is
// asserted to import it rather than re-declare a local duplicate.
const webDmSurface = ensureFile('apps/meerkat-web/src/lib/dm-surface.ts');
ensureContains('apps/meerkat-web/.../lib/dm-surface.ts', webDmSurface, 'DM_MESSAGES_SURFACE_ENABLED = true', 'web DM surface live (Plan 21 Phase 9)');
ensureContains('apps/meerkat-web/.../inbox/ShareInbox.tsx', webShareInbox, "from '../../lib/dm-surface'", 'ShareInbox imports the single DM-surface flag (no local duplicate)');

// --- DM thread surface exists on mobile (Plan 21 Phase 5): the dm store, the pure
// view-model helpers, the hidden thread route, and the registered route entry.
ensureFile('apps/meerkat/app/(root)/data/dm-core.ts');
ensureFile('apps/meerkat/app/(root)/data/dm-view-core.ts');
ensureFile('apps/meerkat/app/(root)/(tabs)/dm/[conversationId].tsx');
const mobileTabsLayout = ensureFile('apps/meerkat/app/(root)/(tabs)/_layout.tsx');
ensureContains('apps/meerkat/.../(tabs)/_layout.tsx', mobileTabsLayout, 'name="dm/[conversationId]"', 'registers the hidden DM thread route');

// --- Web Share Target capability-gate guard. The install hint is feature-detected
// and ABSENT where the browser cannot host a share target (never a fake button).
const webShareTarget = ensureFile('apps/meerkat-web/src/lib/web-share-target.ts');
ensureContains('apps/meerkat-web/.../web-share-target.ts', webShareTarget, 'export function isWebShareTargetSupported', 'exposes a capability probe');
ensureContains('apps/meerkat-web/.../web-share-target.ts', webShareTarget, 'serviceWorker', 'feature-detects the real serviceWorker capability');
ensureContains('apps/meerkat-web/.../inbox/ShareInbox.tsx', webShareInbox, 'isWebShareTargetSupported', 'gates the share-target hint on the capability probe');
ensureContains('apps/meerkat-web/.../inbox/ShareInbox.tsx', webShareInbox, 'shareTargetSupported ?', 'renders the share-target hint conditionally');

// --- MOBILE-ONLY transport NEGATIVE guard. The web tree must carry NO WebRTC /
// Nearby / BLE data backend anywhere (browsers have no raw P2P sockets); the web
// "Connection options" section must list no such rung. Mobile owns the backends.
const FORBIDDEN_WEB_TRANSPORT = [
  'react-native-webrtc',
  'WebRTCBackend',
  'NearbyPeerBackend',
  'BleBackend',
  'loadWebRTCBackend',
];
for (const needle of FORBIDDEN_WEB_TRANSPORT) {
  const hit = findInTree('apps/meerkat-web/src', ['.ts', '.tsx'], needle);
  if (hit) fail(`web must stay relay-only: "${needle}" found in ${hit} (no web P2P data backend)`);
  else ok(`web tree has no "${needle}" (relay-only; transports are mobile-only)`);
}
const webTransportSection = ensureFile('apps/meerkat-web/src/ui/settings/TransportSection.tsx');
for (const rung of ['WebRTC', 'Nearby', 'Bluetooth']) {
  ensureAbsent('apps/meerkat-web/.../TransportSection.tsx', webTransportSection, rung, `web Connection options lists no "${rung}" transport rung`);
}
// Positive: mobile really owns the native transport backends + Transports panel.
ensureFile('apps/meerkat/app/(root)/data/transport-backends.ts');
ensureFile('apps/meerkat/app/(root)/data/webrtc-backend.ts');
ensureFile('apps/meerkat/app/(root)/data/nearby-backend.ts');

// --- BLE excluded from DATA_TRANSPORT_LAYER_IDS. BLE (layer 3) is wake-only and
// must never be a data-carrying rung (NC-12 / L8).
const transportManager = ensureFile('packages/sync/src/transport/transport-manager.ts');
const dataSetMatch = transportManager.match(/DATA_TRANSPORT_LAYER_IDS[^=]*=\s*new Set\(\[([^\]]*)\]\)/u);
if (!dataSetMatch) {
  fail('DATA_TRANSPORT_LAYER_IDS set literal not found in transport-manager.ts');
} else {
  const ids = dataSetMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.includes('3')) fail('DATA_TRANSPORT_LAYER_IDS must NOT include BLE layer 3 (wake-only, NC-12)');
  else ok(`DATA_TRANSPORT_LAYER_IDS excludes BLE layer 3 (data layers: ${ids.join(',')})`);
}

// ============================================================================
// Plan 19 FF3 -- owner "Requests to join" review UI (app half, PART 2). The
// approve/decline copy must stay byte-identical across mobile + web, the
// panel must be gated on the OWNER role specifically (not admin, since only
// the owner's signature can approve), and it must actually be rendered inside
// each surface's community screen (not dead code).
// ============================================================================
out('\nChecking Meerkat Plan 19 FF3 Requests-to-join guards...\n');

const mobileJoinRequests = ensureFile('apps/meerkat/app/(root)/components/PublicJoinRequests.tsx');
const webJoinRequests = ensureFile('apps/meerkat-web/src/ui/community/PublicJoinRequests.tsx');
const JOIN_REQUEST_COPY = [
  'Requests to join',
  'People who asked to join through a public invite link. Approve to add them to the community.',
  'No requests to join right now.',
  'Added to the community.',
  'Saved. It will be sent when a connection server is available.',
  'This request used an old invite. Ask them to request again.',
  'Could not approve this request.',
];
for (const copy of JOIN_REQUEST_COPY) {
  const label = `Requests-to-join copy: ${JSON.stringify(copy.slice(0, 40))}...`;
  ensureContains('apps/meerkat/.../PublicJoinRequests.tsx', mobileJoinRequests, copy, label);
  ensureContains('apps/meerkat-web/.../PublicJoinRequests.tsx', webJoinRequests, copy, label);
}
// Plan 31 Phase 2 relocated the admin surface out of communities.tsx (now a
// list) into the community settings screen; the gate stays isOwner-only there.
const mobileCommunitySettings = ensureFile('apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, '<PublicJoinRequests', 'renders the Requests-to-join panel');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'isOwner ? <PublicJoinRequests', 'gates the Requests-to-join panel on isOwner (not admin)');
// Plan 31 P5 relocated the web admin surface out of ChannelSidebar (now the
// channel list + a settings gear) into CommunitySettings, matching mobile.
const webChannelSidebar = ensureFile('apps/meerkat-web/src/ui/community/ChannelSidebar.tsx');
const webCommunitySettings = ensureFile('apps/meerkat-web/src/ui/community/CommunitySettings.tsx');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, '<PublicJoinRequests', 'renders the Requests-to-join panel');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'isOwner ? <PublicJoinRequests', 'gates the Requests-to-join panel on isOwner (not admin)');
// The ChannelSidebar is now a channel list + a gear that opens the relocated
// settings surface; the admin no longer lives inline there.
ensureContains('apps/meerkat-web/.../ChannelSidebar.tsx', webChannelSidebar, "kind: 'community-settings'", 'opens the relocated community settings surface from the sidebar gear');
ensureAbsent('apps/meerkat-web/.../ChannelSidebar.tsx', webChannelSidebar, '<PublicJoinRequests', 'no longer renders the admin inline (relocated to CommunitySettings)');

// Plan 23 D.2 -- "Reviewed" must NOT un-hide moderated content. Both owner-review
// surfaces show a "Reviewed - still hidden" pill and an explicit "Un-hide for me"
// action (sets status 'dismissed'). Lock the user-facing strings on both surfaces.
for (const [label, file, blob] of [
  ['apps/meerkat/.../community/[communityId]/settings.tsx', 'mobile', mobileCommunitySettings],
  ['apps/meerkat-web/.../CommunitySettings.tsx', 'web', webCommunitySettings],
]) {
  ensureContains(label, blob, 'Reviewed - still hidden', `${file} owner-review shows the reviewed-still-hidden pill (D.2)`);
  ensureContains(label, blob, 'Un-hide for me', `${file} owner-review has the explicit Un-hide action (D.2)`);
  ensureContains(label, blob, "'dismissed'", `${file} owner-review Un-hide sets status 'dismissed' (D.2)`);
}
// The hide-vs-review decoupling lives in the community-safety twins: a reviewed
// report stays hidden (status IN active,reviewed); only dismissed un-hides.
const mobileSafety = ensureFile('apps/meerkat/app/(root)/data/community-safety.ts');
const webSafety = ensureFile('apps/meerkat-web/src/lib/community-safety.ts');
ensureContains('apps/meerkat/.../community-safety.ts', mobileSafety, "status IN ('active', 'reviewed')", 'mobile hides reported content through Reviewed (D.2)');
ensureContains('apps/meerkat-web/.../community-safety.ts', webSafety, "status IN ('active', 'reviewed')", 'web hides reported content through Reviewed (D.2)');
ensureContains('apps/meerkat/.../community-safety.ts', mobileSafety, 'communityFileReportTarget', 'mobile exposes the canonical file report-target helper (D.3)');
ensureContains('apps/meerkat-web/.../community-safety.ts', webSafety, 'communityFileReportTarget', 'web exposes the canonical file report-target helper (D.3)');

// Plan 23 D.1 -- the Files-index Request button is wired to the LIVE request flow
// on both surfaces (no "coming in a later update" stub). Mobile uses the
// FileIndexRequestButton -> queueFileRequestByFields; web uses FileActions'
// RemovedFileRequest -> requestFileAgainByFields. The stale copy must be gone.
const mobileFilesScreen = ensureFile('apps/meerkat/app/(root)/(tabs)/files/[communityId].tsx');
const webFileActions = ensureFile('apps/meerkat-web/src/ui/files/FileActions.tsx');
ensureContains('apps/meerkat/.../files/[communityId].tsx', mobileFilesScreen, 'FileIndexRequestButton', 'mobile Files index renders the live Request control (D.1)');
ensureContains('apps/meerkat-web/.../FileActions.tsx', webFileActions, 'RemovedFileRequest', 'web Files index renders the live Request control (D.1)');
ensureAbsent('apps/meerkat/.../files/[communityId].tsx', mobileFilesScreen, 'coming in a later update', 'mobile Files index no longer shows the stale Request stub copy (D.1)');
const mobileFileReqButton = ensureFile('apps/meerkat/app/(root)/components/FileIndexRequestButton.tsx');
ensureContains('apps/meerkat/.../FileIndexRequestButton.tsx', mobileFileReqButton, 'queueFileRequestByFields', 'mobile Files Request uses the live fields-based request path (D.1)');
ensureContains('apps/meerkat-web/.../FileActions.tsx', webFileActions, 'requestFileAgainByFields', 'web Files Request uses the live fields-based request path (D.1)');

// Plan 23 D.5 -- the published friend-code rendezvous record is SEALED with the
// secret half of an extended code on both surfaces (relay can't read identity).
// publishFriendCode returns the extended code; honesty copy says the server
// cannot read the record.
const mobileSyncProvider = ensureFile('apps/meerkat/app/(root)/providers/SyncProvider.tsx');
const webProvider = ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx');
// The app passes secretHalf to publishIdentityToRendezvous, which SEALS the record
// and RETURNS the shareable extended code (the engine owns the wrapping so a direct
// caller can never share a bare public code for a sealed record - codex finding #3).
ensureContains('apps/meerkat/.../SyncProvider.tsx', mobileSyncProvider, 'secretHalf', 'mobile seals the published record with the secret half (D.5)');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', webProvider, 'secretHalf', 'web seals the published record with the secret half (D.5)');
const sealedRendezvous = ensureFile('packages/sync/src/node/friend-rendezvous.ts');
ensureContains('packages/sync/.../friend-rendezvous.ts', sealedRendezvous, 'buildExtendedFriendCode(returnedCode, input.secretHalf)', 'the engine returns the extended (sealed) code when sealing (D.5, finding #3)');
ensureAbsent('packages/sync/.../friend-rendezvous.ts', sealedRendezvous, 'if (json == null && allowLegacy)', 'an extended code has NO legacy plaintext fallback (D.5, finding #1)');
const mobileSyncScreen = ensureFile('apps/meerkat/app/(root)/sync.tsx');
const webAddFriendD5 = ensureFile('apps/meerkat-web/src/ui/friends/AddFriendOverlay.tsx');
ensureContains('apps/meerkat/.../sync.tsx', mobileSyncScreen, 'an encrypted record the server cannot read', 'mobile friend-code honesty copy states the server cannot read the record (D.5)');
ensureContains('apps/meerkat-web/.../AddFriendOverlay.tsx', webAddFriendD5, 'The server cannot read the record', 'web friend-code honesty copy states the server cannot read the record (D.5)');

// Plan 23 B.2 -- "Delete my data" flow on both surfaces (store compliance). The
// pure wipe core is a logic twin; both settings surfaces render the section and
// the honest "no company account / cannot reach a peer's device" copy.
// The wipe LOGIC must match (surface copy differs: "device" vs "browser", Alert
// vs confirm), so assert both cores share the same prefix list + wipe function.
const mobileDeleteCore = ensureFile('apps/meerkat/app/(root)/data/delete-account-core.ts');
const webDeleteCore = ensureFile('apps/meerkat-web/src/lib/delete-account-core.ts');
for (const [label, blob, surface] of [
  ['apps/meerkat/.../delete-account-core.ts', mobileDeleteCore, 'mobile'],
  ['apps/meerkat-web/.../delete-account-core.ts', webDeleteCore, 'web'],
]) {
  ensureContains(label, blob, "['mk_', 'mp_', 'cm_', 'sync_', 'dm_']", `${surface} delete core enumerates the same Meerkat data prefixes (B.2)`);
  ensureContains(label, blob, 'export function wipeMeerkatDeviceData', `${surface} delete core exposes the wipe function (B.2)`);
}
const mobileSettingsScreen = ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx');
const webDangerSection = ensureFile('apps/meerkat-web/src/ui/settings/DangerSection.tsx');
ensureContains('apps/meerkat/.../settings.tsx', mobileSettingsScreen, 'runDeleteMyData', 'mobile Settings wires the remote-first Delete-my-data coordinator (B.2)');
ensureContains('apps/meerkat-web/.../DangerSection.tsx', webDangerSection, 'deleteMyData', 'web Settings wires the Delete-my-data flow (B.2)');
ensureContains('apps/meerkat/.../delete-account-core.ts', mobileDeleteCore, 'first deletes your registered public persona and public posts', 'mobile Delete-my-data remote-first honesty copy is present (B.2)');
ensureContains('apps/meerkat-web/.../delete-account-core.ts', webDeleteCore, 'first deletes your registered public persona and public posts', 'web Delete-my-data remote-first honesty copy is present (B.2)');

// Plan 29 P6 -- "Appear online" presence: opt-in OFF by default (NC-4), member
// count from the real presenceCounts, honest empty/none + seam copy. Both
// surfaces expose the toggle + the count display.
const mobilePresenceCore = ensureFile('apps/meerkat/app/(root)/data/presence-core.ts');
const webPresenceCore = ensureFile('apps/meerkat-web/src/lib/presence-core.ts');
for (const [label, blob, surface] of [
  ['apps/meerkat/.../presence-core.ts', mobilePresenceCore, 'mobile'],
  ['apps/meerkat-web/.../presence-core.ts', webPresenceCore, 'web'],
]) {
  // PER-COMMUNITY opt-in (Plan 29): the flag is keyed `appear_online:<id>`, default
  // OFF for every community, with NO global master row.
  ensureContains(label, blob, "PRESENCE_APPEAR_ONLINE_KEY_PREFIX = 'appear_online:'", `${surface} presence opt-in flag is keyed per community (P6)`);
  ensureContains(label, blob, 'communityId: string', `${surface} isAppearOnlineEnabled takes a communityId (P6)`);
  ensureContains(label, blob, 'presenceCounts', `${surface} presence count reads the real presenceCounts (P6)`);
  ensureContains(label, blob, 'No one is appearing online right now.', `${surface} presence honest empty state (P6)`);
}
// The PER-COMMUNITY toggle + the member count both live in the community settings
// screen (Plan 29 per-community). There is NO global Settings toggle.
const mobileCommunityPresence = ensureFile('apps/meerkat/app/(root)/(tabs)/community/[communityId]/settings.tsx');
const webCommunityPresence = ensureFile('apps/meerkat-web/src/ui/community/CommunitySettings.tsx');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunityPresence, 'communityPresenceView', 'mobile community screen shows the presence count (P6)');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunityPresence, 'communityPresenceView', 'web community screen shows the presence count (P6)');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunityPresence, 'setAppearOnlineEnabled(db, community.communityId', 'mobile per-community Appear-online toggle in the community screen (P6)');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunityPresence, 'setAppearOnlineEnabled(m.db, communityId', 'web per-community Appear-online toggle in the community screen (P6)');
ensureAbsent('apps/meerkat-web/src/ui/settings/SettingsOverlay.tsx', ensureFile('apps/meerkat-web/src/ui/settings/SettingsOverlay.tsx'), 'PresenceSection', 'web has NO global presence toggle in Settings (per-community only, P6)');
// The beacon table is CAPPED to device_local on both surfaces (critical: it must
// never ride the CRDT document onto a wider transport), and the drain APPLIES +
// EMITS beacons on both surfaces.
ensureContains('apps/meerkat/.../community-core.ts', ensureFile('apps/meerkat/app/(root)/data/community-core.ts'), 'PRESENCE_BEACON_SYNC_RULE', 'mobile caps the presence beacon table device_local (P6)');
ensureContains('apps/meerkat-web/.../meerkat-data.ts', ensureFile('apps/meerkat-web/src/lib/meerkat-data.ts'), 'PRESENCE_BEACON_SYNC_RULE', 'web caps the presence beacon table device_local (P6)');
// MK-017 trust-root: the community policy REQUIRES SAS (emoji) verification of a
// peer before shared-workspace replication on BOTH surfaces. If one twin drops
// this, that surface would replicate community data from an unverified (possibly
// first-contact-MITM'd) peer, so it must never drift.
ensureContains('apps/meerkat/.../community-core.ts', ensureFile('apps/meerkat/app/(root)/data/community-core.ts'), 'requiresSasForShare: true', 'mobile community policy requires SAS before shared-workspace replication (MK-017)');
ensureContains('apps/meerkat-web/.../meerkat-data.ts', ensureFile('apps/meerkat-web/src/lib/meerkat-data.ts'), 'requiresSasForShare: true', 'web community policy requires SAS before shared-workspace replication (MK-017)');
ensureContains('apps/meerkat/.../SyncProvider.tsx', ensureFile('apps/meerkat/app/(root)/providers/SyncProvider.tsx'), 'recordPresenceBeacon', 'mobile drain applies received presence beacons (P6)');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx'), 'recordPresenceBeacon', 'web drain applies received presence beacons (P6)');

// Age gate (legal floor): both surfaces are thin adapters over the SAME
// @mylife/sync age-gate core (evaluate/clamp/decode + the shared setting key) and
// expose the same lock contract. If one surface forks the logic or drops the gate,
// a minor could pass on that platform, so lock the shared-core usage, the lock
// contract, and the first-launch UI gate on both. The shared decision function
// itself is unit-tested in packages/sync.
const mobileAgeGate = ensureFile('apps/meerkat/app/(root)/data/age-gate.ts');
const webAgeGate = ensureFile('apps/meerkat-web/src/lib/age-gate.ts');
for (const needle of ['evaluateAgeGateBirthDate', "from '@mylife/sync'", "encodeAgeGateRecord('locked'", 'export function isAgeGateLocked', 'export function isAgeGatePassed']) {
  ensureContains('apps/meerkat/.../data/age-gate.ts', mobileAgeGate, needle, `mobile age gate routes through the shared core: ${needle.slice(0, 40)}`);
  ensureContains('apps/meerkat-web/.../lib/age-gate.ts', webAgeGate, needle, `web age gate routes through the shared core: ${needle.slice(0, 40)}`);
}
ensureContains('apps/meerkat/.../_layout.tsx', ensureFile('apps/meerkat/app/(root)/_layout.tsx'), 'isAgeGatePassed', 'mobile root gates first launch on the age gate');
ensureContains('apps/meerkat-web/.../App.tsx', ensureFile('apps/meerkat-web/src/ui/App.tsx'), 'isAgeGatePassed', 'web app gates first launch on the age gate');
ensureContains('apps/meerkat/.../SyncProvider.tsx', ensureFile('apps/meerkat/app/(root)/providers/SyncProvider.tsx'), 'emitPresenceBeacons', 'mobile round emits presence beacons when opted in (P6)');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx'), 'emitPresenceBeacons', 'web round emits presence beacons when opted in (P6)');

// AM5/15b -- native transport factories are injected into the MOBILE engine and
// the mobile auto-connect round dials native P2P (honest gate: absent module =>
// unavailable). The WEB app has NO native backends and must NEVER wire them
// (relay-only, no fabricated native rungs).
const mobileSyncProviderAM5 = ensureFile('apps/meerkat/app/(root)/providers/SyncProvider.tsx');
ensureContains('apps/meerkat/.../SyncProvider.tsx', mobileSyncProviderAM5, 'dataTransportFactories', 'mobile engine injects the native transport factories (AM5)');
ensureContains('apps/meerkat/.../SyncProvider.tsx', mobileSyncProviderAM5, 'connectNativeDataTransport', 'mobile round dials native P2P before relay (AM5)');
ensureContains('apps/meerkat/.../SyncProvider.tsx', mobileSyncProviderAM5, 'getAvailableNativeDataLayers().length > 0', 'mobile nativeDataAvailable is derived from the real backend gate (AM5)');
ensureContains('apps/meerkat/.../SyncProvider.tsx', mobileSyncProviderAM5, 'nativeLayerAllowedAcrossCommunities', 'mobile round gates native layers conservatively across all communities (AM5 Plan 27 / NC-3)');
ensureAbsent('apps/meerkat-web/.../MeerkatProvider.tsx', ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx'), 'connectNativeDataTransport', 'web stays relay-only with NO native transport wiring (AM5 honesty)');
ensureAbsent('apps/meerkat-web/.../MeerkatProvider.tsx', ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx'), 'dataTransportFactories', 'web engine has NO native transport factories (AM5 honesty)');

// ============================================================================
// Plan 28 P2 -- member-removal drain wiring. Every drain composition site
// (mobile foreground SyncProvider, mobile background-sync, web MeerkatProvider)
// must BOTH compose the applyMemberRemoval handler AND poll the per-member
// removal token re-derived from persisted community state. A handler without
// its token is dead code and a token without its handler drops every envelope
// (the FF3 trap): a survivor would never learn a removal or its new-epoch key.
// ============================================================================
out('\nChecking Meerkat Plan 28 member-removal drain guards...\n');

const removalDrainSites = [
  ['apps/meerkat/.../providers/SyncProvider.tsx', ensureFile('apps/meerkat/app/(root)/providers/SyncProvider.tsx')],
  ['apps/meerkat/.../data/background-sync.ts', ensureFile('apps/meerkat/app/(root)/data/background-sync.ts')],
  ['apps/meerkat-web/.../lib/MeerkatProvider.tsx', ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx')],
];
for (const [path, src] of removalDrainSites) {
  ensureContains(path, src, '...applyMemberRemoval({ db, self: identity })', 'composes the member-removal apply handler into its drain');
  ensureContains(path, src, 'deriveCommunityRemovalToken(d.genesisNonce, d.communityId, identity.publicKey)', 'polls the persisted-state member-removal token');
  ensureContains(path, src, 'label: `member-removal:${d.communityId}`', 'labels the member-removal drain token');
}

// P3: both providers expose the owner orchestration (one action = revision +
// rotation + fan-out + node republish) through the SAME engine entry point.
for (const [path, src] of [removalDrainSites[0], removalDrainSites[2]]) {
  ensureContains(path, src, 'removeCommunityMemberById', 'exposes the owner removeCommunityMemberById action');
  ensureContains(path, src, 'republishCommunityDescriptor({ baseUrl: nodeUrl, identity, descriptor })', 'wires the node republish into the removal action');
}

// ============================================================================
// Plan 28 P4 -- owner-only Remove UI (MOBILE this round; the web twin lands in
// the coordinated web wave). AC-6: the old mobile placeholder notice is GONE and
// replaced by a working control. AC-4 UI half: the control is owner-gated. NC-1:
// the confirm copy is epoch-boundary honest, never "removed instantly
// everywhere". The WEB notice string intentionally STAYS until the web wave.
// ============================================================================
out('\nChecking Meerkat Plan 28 P4 Remove-member UI guards...\n');

const P4_RETIRED_NOTICE =
  'Safe member removal needs a signed member-removal update plus epoch key rotation. This screen only hides local content until that owner protocol path is wired.';

// The exact epoch-boundary confirm body, locked byte-for-byte across both
// surfaces (the mobile + web member-removal-view-core twins must carry it).
const MEMBER_REMOVAL_CONFIRM_BODY_LITERAL =
  "Takes effect on each member's device as they receive the update; content shared before removal stays on their device.";

// The old mobile notice must be gone from every mobile admin surface it could
// have lived on (it moved from communities.tsx to settings.tsx in Plan 31).
const mobileCommunitiesList = ensureFile('apps/meerkat/app/(root)/(tabs)/communities.tsx');
ensureAbsent('apps/meerkat/.../communities.tsx', mobileCommunitiesList, P4_RETIRED_NOTICE, 'retired the member-removal placeholder notice (AC-6)');
ensureAbsent('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, P4_RETIRED_NOTICE, 'retired the member-removal placeholder notice (AC-6)');

// The working owner-only control is wired on the mobile settings screen.
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'removeCommunityMemberById(community.communityId, device.deviceId)', 'calls the real owner removal action (Plan 52 P5: per attested device)');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'removePerson(row)', 'wires the person-scoped Remove control (Plan 52 P4/P5)');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'isOwner ? (', 'owner-gates the Remove control (AC-4 UI half)');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'describeMemberRemovalSuccess', 'renders the honest success counts from the real result');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'describeMemberRemovalFailure', 'renders an honest reason-coded failure (never a fake success)');
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'MEMBER_REMOVAL_CONFIRM_BODY', 'uses the epoch-boundary confirm copy');
// Concurrent-removal guard (adversarial MAJOR): the in-flight guard is GLOBAL, so
// only one removal runs at a time across the whole member list. A per-member
// guard would let an owner start B off the pre-A descriptor -- a monotonic upsert
// silently drops B while a second epoch rotation still runs and returns ok.
ensureContains('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'disabled={removingId !== null}', 'globally guards Remove while any removal is in flight (no concurrent double rotation)');
ensureAbsent('apps/meerkat/.../community/[communityId]/settings.tsx', mobileCommunitySettings, 'disabled={removingId === member.deviceId}', 'no per-member Remove guard (would allow a concurrent double rotation)');

// The pure view-core owns the honest phrasing: the confirm body is epoch-boundary
// honest and never claims instant network-wide removal (NC-1).
const memberRemovalViewCore = ensureFile('apps/meerkat/app/(root)/data/member-removal-view-core.ts');
ensureContainsNormalized('apps/meerkat/.../data/member-removal-view-core.ts', memberRemovalViewCore, 'as they receive the update', 'confirm copy is per-device convergence honest (NC-1)');
ensureContainsNormalized('apps/meerkat/.../data/member-removal-view-core.ts', memberRemovalViewCore, 'content shared before removal stays on their device', 'confirm copy keeps the epoch-boundary caveat (NC-1)');
ensureAbsent('apps/meerkat/.../data/member-removal-view-core.ts', memberRemovalViewCore, 'instantly everywhere', 'never claims instant network-wide removal (NC-1)');

// WEB Remove UI SHIPPED (coordinated web wave): the placeholder notice is now
// GONE from ChannelSidebar (and never moved to CommunitySettings), replaced by a
// working owner-only control on the relocated settings surface. AC-6 for web.
ensureAbsent('apps/meerkat-web/.../ChannelSidebar.tsx', webChannelSidebar, P4_RETIRED_NOTICE, 'retired the web member-removal placeholder notice (AC-6)');
ensureAbsent('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, P4_RETIRED_NOTICE, 'the retired notice did not leak into the relocated settings surface (AC-6)');

// The working owner-only control is wired on the web settings surface.
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'removeCommunityMemberById(community.communityId, device.deviceId)', 'calls the real owner removal action (Plan 52 P5: per attested device)');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'removePerson(row)', 'wires the person-scoped Remove control (Plan 52 P4/P5)');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'isOwner ? (', 'owner-gates the Remove control (AC-4 UI half)');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'describeMemberRemovalSuccess', 'renders the honest success counts from the real result');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'describeMemberRemovalFailure', 'renders an honest reason-coded failure (never a fake success)');
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'MEMBER_REMOVAL_CONFIRM_BODY', 'uses the epoch-boundary confirm copy');
// GLOBAL single-flight guard (same concurrent-removal fix as mobile): the
// disabled guard is on removingId !== null, never per-member, so no concurrent
// double epoch rotation.
ensureContains('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'disabled={removingId !== null}', 'globally guards Remove while any removal is in flight (no concurrent double rotation)');
ensureAbsent('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, 'disabled={removingId === member.deviceId}', 'no per-member Remove guard (would allow a concurrent double rotation)');

// The web member-removal-view-core is the byte-lockstep twin of the mobile pure
// copy module: the confirm body is per-device convergence honest (NC-1) and never
// claims instant network-wide removal.
const webMemberRemovalViewCore = ensureFile('apps/meerkat-web/src/lib/member-removal-view-core.ts');
ensureContainsNormalized('apps/meerkat-web/.../lib/member-removal-view-core.ts', webMemberRemovalViewCore, 'as they receive the update', 'confirm copy is per-device convergence honest (NC-1)');
ensureContainsNormalized('apps/meerkat-web/.../lib/member-removal-view-core.ts', webMemberRemovalViewCore, 'content shared before removal stays on their device', 'confirm copy keeps the epoch-boundary caveat (NC-1)');
ensureAbsent('apps/meerkat-web/.../lib/member-removal-view-core.ts', webMemberRemovalViewCore, 'instantly everywhere', 'never claims instant network-wide removal (NC-1)');
// The confirm body is byte-identical across both surfaces (locked copy).
ensureContains('apps/meerkat-web/.../lib/member-removal-view-core.ts', webMemberRemovalViewCore, MEMBER_REMOVAL_CONFIRM_BODY_LITERAL, 'the web confirm body matches the mobile literal exactly');
ensureContains('apps/meerkat/.../data/member-removal-view-core.ts', memberRemovalViewCore, MEMBER_REMOVAL_CONFIRM_BODY_LITERAL, 'the mobile confirm body matches the shared literal exactly');

// ============================================================================
// Plan 27 P2 -- local_only relay-token skip (AC-2). Every drain-token builder
// (mobile foreground, mobile background, web) must skip a local_only
// community's relay mailbox tokens ENTIRELY: even the opaque rendezvous token
// is metadata the relay must never see for a proximity-gated community.
// ============================================================================
out('\nChecking Meerkat Plan 27 transport-policy guards...\n');

for (const [path, src] of removalDrainSites) {
  ensureContains(path, src, "transportAllowedForCommunity(db, d.communityId, 'wan_relay')", 'skips relay mailbox tokens for local_only communities (AC-2)');
}

// ============================================================================
// Plan 31 Phase 4 -- capability-status ("What works today") lockstep. Both the
// mobile source of truth and the web twin must carry the same capability titles
// and the honest DM/calls lines, and neither may hardcode DM to a live status.
// ============================================================================
out('\nChecking Meerkat Plan 31 capability-status parity...\n');
const capMobile = ensureFile('apps/meerkat/app/(root)/data/capability-status.ts');
const capWeb = ensureFile('apps/meerkat-web/src/lib/capability-status.ts');
for (const title of [
  'Community chat',
  'Posts and threads',
  'Reactions',
  'File sharing',
  'Public reading',
  'Direct messages',
  'Voice and video calls',
  'Background catch-up',
  'Self-hosting a server',
  'Free default server',
]) {
  ensureContains('apps/meerkat/.../capability-status.ts', capMobile, `'${title}'`, `mobile lists capability: ${title}`);
  ensureContains('apps/meerkat-web/.../capability-status.ts', capWeb, `'${title}'`, `web lists capability: ${title}`);
}
for (const line of [
  'Private one-to-one messages are not built yet.',
  // Plan 25: calls/rooms code is built but a user cannot place or join one
  // without a dev build + LiveKit, so the status stays 'pending' while the line
  // states the honest built-but-unavailable truth (no "not built yet" falsehood,
  // no "works today" overclaim).
  'Voice, video, and community rooms are built but not available yet: placing or joining one needs the full app build and a connection server.',
]) {
  ensureContains('apps/meerkat/.../capability-status.ts', capMobile, line, `mobile honest line: ${JSON.stringify(line.slice(0, 24))}...`);
  ensureContains('apps/meerkat-web/.../capability-status.ts', capWeb, line, `web honest line: ${JSON.stringify(line.slice(0, 24))}...`);
}
// n2 + honest-by-construction: DM status must DERIVE from the real flag (not a
// hardcoded literal), and the STATUS field is asserted (not just titles + lines)
// for the DM (flag-derived) and calls (pending) entries, so a status/line
// contradiction is caught.
ensureContains('apps/meerkat/.../capability-status.ts', capMobile, "status: dmLive ? 'live' : 'pending'", 'mobile DM status derives from DM_MESSAGES_SURFACE_AVAILABLE');
ensureContains('apps/meerkat-web/.../capability-status.ts', capWeb, "status: dmLive ? 'live' : 'pending'", 'web DM status derives from the DM surface flag');
for (const [label, src] of [['mobile', capMobile], ['web', capWeb]]) {
  ensureContains(`apps/meerkat.../capability-status.ts (${label})`, src, "title: 'Voice and video calls',\n      status: 'pending',", `${label} calls entry status is pending`);
}
// m5: the web DM flag is single-sourced in lib/dm-surface.ts and IMPORTED by
// capability-status, so the honesty page cannot claim DMs live while the surface
// is off (honest-by-construction, not honest-by-tripwire).
ensureContains('apps/meerkat-web/.../capability-status.ts', capWeb, "from './dm-surface'", 'web capability-status imports the single DM-surface flag');

// ============================================================================
// Plan 31 P5 -- navigation IA + join doors + onboarding v2 web parity. The two
// surfaces render distinct trees, so the LOCKSTEP is the shared pure logic + the
// user-facing locked strings: the add-friend "needs a server" line, the onboarding
// v2 choice rows, and the "too large for a QR" honest fallback. Friends folds into
// Messages (People) on both; the web has no ws:// input on the add-friend surface.
// ============================================================================
out('\nChecking Meerkat Plan 31 P5 navigation + join + onboarding parity...\n');

// Add-friend zero-transport line: identical, single-sourced in each add-friend-core.
const ADD_FRIEND_NEEDS_SERVER_LINE = 'Adding a friend needs a connection server.';
const addFriendCoreMobile = ensureFile('apps/meerkat/app/(root)/data/add-friend-core.ts');
const addFriendCoreWeb = ensureFile('apps/meerkat-web/src/lib/add-friend-core.ts');
ensureContains('apps/meerkat/.../data/add-friend-core.ts', addFriendCoreMobile, ADD_FRIEND_NEEDS_SERVER_LINE, 'mobile add-friend needs-a-server line');
ensureContains('apps/meerkat-web/.../lib/add-friend-core.ts', addFriendCoreWeb, ADD_FRIEND_NEEDS_SERVER_LINE, 'web add-friend needs-a-server line');
// The web add-friend surface embeds the real ConnectionStatusCard fallback + the
// honest line, and has NO ws:// input (TC-2: transport stays in Settings).
const webAddFriend = ensureFile('apps/meerkat-web/src/ui/friends/AddFriendOverlay.tsx');
ensureContains('apps/meerkat-web/.../AddFriendOverlay.tsx', webAddFriend, 'ConnectionStatusCard', 'web add-friend embeds the real probe card when no relay resolves');
ensureContains('apps/meerkat-web/.../AddFriendOverlay.tsx', webAddFriend, 'ADD_FRIEND_NEEDS_SERVER_LINE', 'web add-friend renders the single honest needs-a-server line');
ensureAbsent('apps/meerkat-web/.../AddFriendOverlay.tsx', webAddFriend, 'ws://', 'web add-friend surface has no ws:// input (transport lives in Settings)');
ensureAbsent('apps/meerkat-web/.../AddFriendOverlay.tsx', webAddFriend, 'RELAY_URL_SETTING_KEY', 'web add-friend never reads the raw relay setting (TC-2)');

// Onboarding v2: the four Step-2 choice rows are byte-lockstep across surfaces.
const onboardingCoreMobile = ensureFile('apps/meerkat/app/(root)/data/onboarding-core.ts');
const onboardingCoreWeb = ensureFile('apps/meerkat-web/src/lib/onboarding-core.ts');
for (const row of [
  "title: 'Create a community'",
  "title: 'Join with an invite'",
  "title: 'Add a friend'",
  "title: 'Just look around'",
]) {
  ensureContains('apps/meerkat/.../data/onboarding-core.ts', onboardingCoreMobile, row, `mobile onboarding row: ${row}`);
  ensureContains('apps/meerkat-web/.../lib/onboarding-core.ts', onboardingCoreWeb, row, `web onboarding row: ${row}`);
}

// The invite-QR honesty fallback (identical wording) on both surfaces: the mobile
// InviteShareSheet and the web CommunitySettings invite panel.
const QR_TOO_LARGE_LINE = 'This community is too large for a QR code. Share the invite link instead.';
const mobileInviteShare = ensureFile('apps/meerkat/app/(root)/components/InviteShareSheet.tsx');
ensureContains('apps/meerkat/.../InviteShareSheet.tsx', mobileInviteShare, QR_TOO_LARGE_LINE, 'mobile invite QR too-large honest fallback');
ensureContainsNormalized('apps/meerkat-web/.../CommunitySettings.tsx', webCommunitySettings, QR_TOO_LARGE_LINE, 'web invite QR too-large honest fallback');

// The 5-section web IA mirrors mobile: Friends folded into Messages (no Friends
// nav entry), and the join door never auto-joins (NC-1: the preview sheet's Join
// button is the only trigger).
const webMobileNav = ensureFile('apps/meerkat-web/src/ui/shell/MobilePrimaryNav.tsx');
ensureAbsent('apps/meerkat-web/.../MobilePrimaryNav.tsx', webMobileNav, "label: 'Friends'", 'web nav has no Friends tab (folded into Messages)');
const webCreateCommunity = ensureFile('apps/meerkat-web/src/ui/community/CreateCommunityDialog.tsx');
ensureContains('apps/meerkat-web/.../CreateCommunityDialog.tsx', webCreateCommunity, 'InvitePreviewSheet', 'web join routes through the preview sheet (never auto-joins, NC-1)');
const webInvitePreview = ensureFile('apps/meerkat-web/src/ui/community/InvitePreviewSheet.tsx');
ensureContains('apps/meerkat-web/.../InvitePreviewSheet.tsx', webInvitePreview, 'previewInvite', 'web preview sheet uses the pure previewInvite (never mutates, TC-1)');

// ============================================================================
// Plan 30 -- chat experience rebuild (shared chat kit, reactions, live loop).
// The two surfaces render distinct component trees (React Native vs DOM), so the
// LOCKSTEP is the shared pure logic + the user-facing locked strings: the quick
// reaction set, the "New messages" divider, and the cadence constants must match
// byte-for-byte. Both files updated in the SAME change set (T4.4).
// ============================================================================
out('\nChecking Meerkat Plan 30 chat-experience parity...\n');
const emojiMobile = ensureFile('apps/meerkat/app/(root)/components/chat/emoji-data.ts');
const emojiWeb = ensureFile('apps/meerkat-web/src/ui/channel/emoji-data.ts');
// The locked 6 quick reactions (founder decision 2026-07-01), exact order.
const QUICK_REACTIONS_LITERAL = "['❤️', '👍', '😂', '😮', '😢', '🎉']";
ensureContains('apps/meerkat/.../emoji-data.ts', emojiMobile, QUICK_REACTIONS_LITERAL, 'mobile QUICK_REACTIONS is the locked 6');
ensureContains('apps/meerkat-web/.../emoji-data.ts', emojiWeb, QUICK_REACTIONS_LITERAL, 'web QUICK_REACTIONS is the locked 6');

// The "New messages" unread divider label + the Chat|Posts segment labels.
const channelScreenMobile = ensureFile('apps/meerkat/app/(root)/(tabs)/channel/[communityId]/[channelId].tsx');
const segmentsMobile = ensureFile('apps/meerkat/app/(root)/components/chat/ChannelSegmentedTabs.tsx');
const channelViewWeb = ensureFile('apps/meerkat-web/src/ui/channel/ChannelView.tsx');
const chatListWeb = ensureFile('apps/meerkat-web/src/ui/channel/ChatMessageList.tsx');
const segmentsWeb = ensureFile('apps/meerkat-web/src/ui/channel/ChannelSegmentedTabs.tsx');
ensureContains('apps/meerkat-web/.../ChatMessageList.tsx', chatListWeb, 'New messages', 'web renders the "New messages" divider');
// M1 regression guard: the web list MUST forward firstUnreadId to buildMessageRows,
// or the unread row is never emitted and the "New messages" literal above is dead.
ensureContainsNormalized('apps/meerkat-web/.../ChatMessageList.tsx', chatListWeb, 'buildMessageRows(items, { firstUnreadId })', 'web list forwards firstUnreadId so the unread divider actually renders');
// The two segmented controls carry the same labels via defaulted props on BOTH
// surfaces (composition Phase 1 aligned web with mobile so block/library
// channels can relabel). Both files updated together when a label changes.
ensureContains('apps/meerkat/.../ChannelSegmentedTabs.tsx', segmentsMobile, "chatLabel = 'Chat'", 'mobile segment label: Chat');
ensureContains('apps/meerkat/.../ChannelSegmentedTabs.tsx', segmentsMobile, "postsLabel = 'Posts'", 'mobile segment label: Posts');
ensureContains('apps/meerkat-web/.../ChannelSegmentedTabs.tsx', segmentsWeb, "chatLabel = 'Chat'", 'web segment label: Chat');
ensureContains('apps/meerkat-web/.../ChannelSegmentedTabs.tsx', segmentsWeb, "postsLabel = 'Posts'", 'web segment label: Posts');

// The audience line: exactly ONE always-visible label on the channel surface,
// derived from the shared AudienceRule copy (NOT a hardcoded literal), on both.
ensureContains('apps/meerkat/.../channel screen', channelScreenMobile, 'channelAudienceRule.explanation', 'mobile channel shows ONE audience line from the rule explanation');
ensureContains('apps/meerkat-web/.../ChannelView.tsx', channelViewWeb, 'audienceRule.explanation', 'web channel shows ONE audience line from the rule explanation');

// The live-loop cadence constants must be byte-identical (both surfaces share the
// same steady/hot/jitter numbers, so the AC-5 latency bound holds on both).
const loopMobile = ensureFile('apps/meerkat/app/(root)/data/live-loop-core.ts');
const loopWeb = ensureFile('apps/meerkat-web/src/lib/live-loop-core.ts');
for (const constant of [
  'HOT_CADENCE_MS = 5_000',
  'STEADY_CADENCE_MS = 10_000',
  'HOT_WINDOW_MS = 60_000',
  'JITTER_RATIO = 0.2',
]) {
  ensureContains('apps/meerkat/.../live-loop-core.ts', loopMobile, constant, `mobile cadence constant: ${constant}`);
  ensureContains('apps/meerkat-web/.../live-loop-core.ts', loopWeb, constant, `web cadence constant: ${constant}`);
}

// NC-1: the web live loop hook adds ZERO status claims -- it must not render a
// connected/live/online string. Guard the hook stays copy-free.
const liveHookWeb = ensureFile('apps/meerkat-web/src/ui/channel/useChannelLiveLoop.ts');
for (const banned of ['connected', 'Connected', 'live status', 'online']) {
  ensureAbsent('apps/meerkat-web/.../useChannelLiveLoop.ts', liveHookWeb, `"${banned}"`, `web live loop never claims: ${banned}`);
}

// ============================================================================
// Plan 21 Phase 9 -- full Direct Messages web parity (TC-10). The two surfaces
// render distinct trees (Expo stack routes vs a single-pane SPA), so route-vs-pane
// parity means FEATURE/STATE parity: for each mobile dm route there is a named web
// pane that renders the same states and calls the same @mylife/sync + dm-core
// functions. The load-bearing DM engine/provider/view cores are byte-locked twins
// (both depend only on @mylife/db + @mylife/sync + each other), and the DM dead-end
// (canMessage:false / DIRECT_MESSAGE_UNAVAILABLE_REASON) is removed REPO-WIDE.
// Plan 21 made the DM surface live on BOTH surfaces, so the unavailable-reason
// string is retired from the mobile tree too (the close cleanup dropped the
// disabled-reason fallback in messages-core.ts); the grep below is repo-wide.
out('\nChecking Meerkat Plan 21 Phase 9 Direct Messages parity...\n');

// The web DM store + provider core + view helpers + thread/group panes + rebuilt
// Messages surface all exist.
const webDmCore = ensureFile('apps/meerkat-web/src/lib/dm-core.ts');
const webDmProviderCore = ensureFile('apps/meerkat-web/src/lib/dm-provider-core.ts');
const webDmViewCore = ensureFile('apps/meerkat-web/src/lib/dm-view-core.ts');
const webDmOwnDeviceStatus = ensureFile('apps/meerkat-web/src/lib/dm-own-device-status.ts');
const webDmThreadPane = ensureFile('apps/meerkat-web/src/ui/messages/DmThreadPane.tsx');
ensureFile('apps/meerkat-web/src/ui/messages/DmGroupInfoPane.tsx');
const webMessagesView = ensureFile('apps/meerkat-web/src/ui/messages/MessagesView.tsx');
const webOwnDevicePanel = ensureFile('apps/meerkat-web/src/ui/messages/OwnDeviceLinkPanel.tsx');
const webSettingsOverlay = ensureFile('apps/meerkat-web/src/ui/settings/SettingsOverlay.tsx');
// The mobile provider core is the twin source; assert it exists for the byte-lock.
const mobileDmCore = ensureFile('apps/meerkat/app/(root)/data/dm-core.ts');
const mobileDmProviderCore = ensureFile('apps/meerkat/app/(root)/data/dm-provider-core.ts');
const mobileDmViewCore = ensureFile('apps/meerkat/app/(root)/data/dm-view-core.ts');
const mobileDmOwnDeviceStatus = ensureFile('apps/meerkat/app/(root)/data/dm-own-device-status.ts');
const mobileMessagesScreen = ensureFile('apps/meerkat/app/(root)/(tabs)/messages.tsx');
const mobileOwnDeviceCard = ensureFile('apps/meerkat/app/(root)/components/OwnDeviceLinkCard.tsx');

// Route-vs-pane parity: mobile dm/[conversationId] (already asserted registered in
// (tabs)/_layout.tsx above) <-> web MessagesView thread pane; dm/new <-> the
// new-message + new-group panes; dm/[conversationId]/info <-> the group-info pane.
ensureContains('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, '<DmThreadPane', 'Messages renders the DM thread pane (route <-> pane parity)');
ensureContains('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, "view: 'new-message'", 'Messages has a new-message pane (dm/new parity)');
ensureContains('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, "view: 'new-group'", 'Messages has a new-group pane (dm/new group parity)');
ensureContains('apps/meerkat-web/.../DmThreadPane.tsx', webDmThreadPane, '<DmGroupInfoPane', 'the thread pane opens the group-info pane (dm/[id]/info parity)');
ensureContains('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, 'DM_MESSAGES_SURFACE_ENABLED', 'the Message affordance is gated on the single DM-surface flag');

// Plan 40 AC-40.1 / AC-40.3: same-account own-device linking is visible on
// Settings and Messages on both surfaces, and the status helper gates
// convergence copy on real dm_own_devices + dm_messages + dm_delivery evidence.
ensureContains('apps/meerkat/.../messages.tsx', mobileMessagesScreen, '<OwnDeviceLinkCard', 'mobile Messages exposes own-device linking');
ensureContains('apps/meerkat/.../settings.tsx', mobileSettingsScreen, '<OwnDeviceLinkCard', 'mobile Settings exposes own-device linking');
ensureContains('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, '<OwnDeviceLinkPanel', 'web Messages exposes own-device linking');
ensureContains('apps/meerkat-web/.../SettingsOverlay.tsx', webSettingsOverlay, '<OwnDeviceLinkPanel settings', 'web Settings exposes own-device linking');
for (const [label, src] of [
  ['mobile own-device card', mobileOwnDeviceCard],
  ['web own-device panel', webOwnDevicePanel],
]) {
  ensureContains(label, src, 'Link this second device', `${label} renders the user-facing link action`);
  ensureContains(label, src, 'Conversations are saved on this device', `${label} states conversations are stored on the device`);
  ensureContains(label, src, 'Check mailbox now', `${label} refreshes evidence through the real mailbox drain`);
}

// The honest receipt state is derived from real dm_delivery rows only (NC-2): the
// thread pane consumes summarizeDmDelivery + dmDeliveryLabel, never a timer.
ensureContains('apps/meerkat-web/.../DmThreadPane.tsx', webDmThreadPane, 'summarizeDmDelivery', 'thread pane derives delivery state from real dm_delivery rows');
ensureContains('apps/meerkat-web/.../DmThreadPane.tsx', webDmThreadPane, 'dmDeliveryLabel', 'thread pane renders the honest receipt label');

// The DM dead-end is REMOVED from BOTH trees: no canMessage:false, no
// unavailable-reason string, no "Not built yet" copy.
ensureAbsent('apps/meerkat-web/.../lib/friends-core.ts', ensureFile('apps/meerkat-web/src/lib/friends-core.ts'), 'canMessage: false', 'web friends-core dropped the DM dead-end flag');
ensureAbsent('apps/meerkat/.../data/friends-core.ts', ensureFile('apps/meerkat/app/(root)/data/friends-core.ts'), 'canMessage: false', 'mobile friends-core dropped the DM dead-end flag');
ensureAbsent('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, 'Not built yet', 'web Messages surface has no "Not built yet" dead-end copy');
ensureAbsent('apps/meerkat-web/.../MessagesView.tsx', webMessagesView, 'DIRECT_MESSAGE_UNAVAILABLE_REASON', 'web Messages surface no longer references the unavailable-reason string');
// REPO-WIDE zero-hit for the unavailable-reason honesty landmine (TC-10): the
// string must be absent from BOTH the mobile and web source trees now that Plan 21
// made DMs live on each surface (the disabled-reason fallback is retired).
for (const tree of ['apps/meerkat/app', 'apps/meerkat-web/src']) {
  const hit = findInTree(tree, ['.ts', '.tsx'], 'DIRECT_MESSAGE_UNAVAILABLE_REASON');
  if (hit) fail(`DM dead-end string leaked: "DIRECT_MESSAGE_UNAVAILABLE_REASON" found in ${hit}`);
  else ok(`${tree} has zero hits for DIRECT_MESSAGE_UNAVAILABLE_REASON (dead-end removed)`);
}

// The web foreground drain wires the DM handler set + the group-commit token
// (mobile has a shared background+foreground drain; web is foreground-only). A
// handler without its token is dead code and a token without its handler drops
// every envelope (the FF3 trap), so BOTH must be present.
const webProviderForDm = ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', webProviderForDm, 'buildDmMailboxHandlers', 'web foreground drain composes the DM message/receipt handlers');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', webProviderForDm, 'buildDmGroupMailboxHandlers', 'web foreground drain composes the DM group-commit handler');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', webProviderForDm, 'buildDmShredHandler', 'web foreground drain composes the DM shred handler');
ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', webProviderForDm, 'deriveDmGroupCommitToken(conv.id, identity.publicKey)', 'web foreground drain polls the persisted-state DM group-commit token');

// dm_ stays LOCAL-ONLY on web too: no dm entry in the sync prefix map (mirrors the
// mk_share_* device-local guard above).
{
  const block = webMeerkatData ? extractSyncPrefixMap(webMeerkatData) : null;
  if (!block) fail('apps/meerkat-web meerkat-data.ts MEERKAT_SYNC_PREFIXES map not found');
  else ensureAbsent('apps/meerkat-web/.../meerkat-data.ts (sync-prefix map)', block, 'dm_', 'dm_ tables stay device-local (not a sync prefix)');
}

// Byte-twin locks: the DM engine/provider/view cores are identical logic across
// mobile and web (comments stripped). dm-core + dm-provider-core have NO import
// diff; dm-view-core differs ONLY in the chat-kit-core import path (web colocates
// it in lib/), normalized here.
function dmTwinLines(contents) {
  return twinLogicLines(contents)
    .map((line) => line.replaceAll("from './chat-kit-core'", "from '../components/chat/chat-kit-core'"));
}
const dmTwins = [
  ['dm-core.ts', mobileDmCore, webDmCore],
  ['dm-provider-core.ts', mobileDmProviderCore, webDmProviderCore],
  ['dm-view-core.ts', mobileDmViewCore, webDmViewCore],
  ['dm-own-device-status.ts', mobileDmOwnDeviceStatus, webDmOwnDeviceStatus],
];
for (const [label, mobileSrc, webSrc] of dmTwins) {
  if (!mobileSrc || !webSrc) continue;
  if (dmTwinLines(mobileSrc).join('\n') === dmTwinLines(webSrc).join('\n')) {
    ok(`mobile and web ${label} shared logic is byte-identical (comments + chat-kit import normalized)`);
  } else {
    fail(`mobile and web ${label} shared logic drifted (non-comment lines differ)`);
  }
}

// ---------------------------------------------------------------------------
// Auto-connect surfaces (Plan 29 item 12): the Automatic connections card exists
// on both surfaces, shares its honest copy, and the stale "no automatic dialing"
// claims are gone from every surface (the feature now exists, opt-in).
// ---------------------------------------------------------------------------
const mobileAutoCard = ensureFile('apps/meerkat/app/(root)/components/AutoConnectCard.tsx');
const webAutoCard = ensureFile('apps/meerkat-web/src/ui/sync/AutoConnectCard.tsx');
const mobileAutoCore = ensureFile('apps/meerkat/app/(root)/data/auto-connect-core.ts');
const webAutoCore = ensureFile('apps/meerkat-web/src/lib/auto-connect-core.ts');
{
  const shared = [
    'Automatic connections',
    'Automatic dialing is on',
    'Automatic dialing is off',
    'Catch up now',
    'It is not background sync and never turns background sync on.',
    'never a simulated dial or an online count.',
  ];
  for (const copy of shared) {
    ensureContainsNormalized('apps/meerkat AutoConnectCard', mobileAutoCard, copy, `auto-connect copy: ${copy}`);
    ensureContainsNormalized('apps/meerkat-web AutoConnectCard', webAutoCard, copy, `auto-connect copy: ${copy}`);
  }
  // The honest empty-state line is shared by both cores.
  ensureContains('apps/meerkat auto-connect-core', mobileAutoCore, 'No automatic round has run on this device yet.', 'honest empty last-round line');
  ensureContains('apps/meerkat-web auto-connect-core', webAutoCore, 'No automatic round has run on this device yet.', 'honest empty last-round line');
  // Neither core ever flips the background-sync flag (NC-4).
  ensureAbsent('apps/meerkat auto-connect-core', mobileAutoCore, 'background_sync_enabled', 'auto-connect never touches background_sync_enabled');
  ensureAbsent('apps/meerkat-web auto-connect-core', webAutoCore, 'background_sync_enabled', 'auto-connect never touches background_sync_enabled');
}
// The retired "no automatic dialing" claims must not reappear on any surface.
{
  const mobileSync = ensureFile('apps/meerkat/app/(root)/sync.tsx');
  const mobileSettings = ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx');
  const mobileCapability = ensureFile('apps/meerkat/app/(root)/data/capability-status.ts');
  const webSyncDialog = ensureFile('apps/meerkat-web/src/ui/sync/SyncDialog.tsx');
  const webTransport = ensureFile('apps/meerkat-web/src/ui/settings/TransportSection.tsx');
  const webCapability = ensureFile('apps/meerkat-web/src/lib/capability-status.ts');
  ensureAbsent('apps/meerkat/.../sync.tsx', mobileSync, 'There is no automatic device dialing', 'drops the stale no-auto-dial claim');
  ensureAbsent('apps/meerkat/.../settings.tsx', mobileSettings, 'auto dialing are still pending', 'drops the stale no-auto-dial claim');
  ensureAbsent('apps/meerkat/.../capability-status.ts', mobileCapability, 'there is no automatic peer auto-dial', 'drops the stale no-auto-dial claim');
  ensureAbsent('apps/meerkat-web/.../SyncDialog.tsx', webSyncDialog, 'There is no automatic device dialing', 'drops the stale no-auto-dial claim');
  ensureAbsent('apps/meerkat-web/.../TransportSection.tsx', webTransport, 'automatic device dialing in the browser', 'drops the stale no-auto-dial claim');
  ensureAbsent('apps/meerkat-web/.../capability-status.ts', webCapability, 'there is no automatic peer auto-dial', 'drops the stale no-auto-dial claim');
}

// ---------------------------------------------------------------------------
// Recovery RESTORE surfaces (Plan 23 / item 16a / AM8): both surfaces expose a
// full restore flow, share its honest copy, and the stale "restore is pending"
// claim is gone. The restore itself is real (openAndRestore in @mylife/sync).
// ---------------------------------------------------------------------------
{
  const mobileSettings = ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx');
  const webRecovery = ensureFile('apps/meerkat-web/src/ui/settings/RecoverySection.tsx');
  const mobileOnboarding = ensureFile('apps/meerkat/app/(root)/components/OnboardingGate.tsx');
  const webOnboarding = ensureFile('apps/meerkat-web/src/ui/onboarding/OnboardingOverlay.tsx');
  const restoreCopy = [
    'Restore identity',
    'Encrypted identity backup',
    'restores identity keys, not your synced data',
    'A wrong key or a tampered backup fails closed and changes nothing.',
  ];
  for (const copy of restoreCopy) {
    ensureContainsNormalized('apps/meerkat settings restore', mobileSettings, copy, `restore copy: ${copy}`);
    ensureContainsNormalized('apps/meerkat-web RecoverySection restore', webRecovery, copy, `restore copy: ${copy}`);
  }
  // The onboarding restore entry exists on both surfaces.
  ensureContainsNormalized('apps/meerkat OnboardingGate', mobileOnboarding, 'Restore your identity', 'onboarding restore entry');
  ensureContainsNormalized('apps/meerkat-web OnboardingOverlay', webOnboarding, 'Restore your identity', 'onboarding restore entry');
  // The stale "restore is pending" claim is retired on both surfaces.
  ensureAbsent('apps/meerkat/.../settings.tsx', mobileSettings, 'Restoring on a fresh install is pending', 'drops the stale restore-pending claim');
  ensureAbsent('apps/meerkat-web/.../RecoverySection.tsx', webRecovery, 'Restoring on a fresh install is pending', 'drops the stale restore-pending claim');
  // Both surfaces drive restore through the real @mylife/sync seam (never a stub).
  ensureContains('apps/meerkat/.../IdentityProvider.tsx', ensureFile('apps/meerkat/app/(root)/providers/IdentityProvider.tsx'), 'openAndRestore', 'mobile restore uses the real openAndRestore seam');
  ensureContains('apps/meerkat-web/.../MeerkatProvider.tsx', ensureFile('apps/meerkat-web/src/lib/MeerkatProvider.tsx'), 'openAndRestore', 'web restore uses the real openAndRestore seam');
}

// ---------------------------------------------------------------------------
// Humanity gate surfaces (Plan 24 P4/P5 / item 14 / AM1): both surfaces expose a
// VerifySheet + humanity-core wallet, share the honest gate copy, drive the REAL
// service endpoints, and gate the public-join CTA. The gate fails closed: with no
// service configured, the sheet says so and the join stays blocked.
// ---------------------------------------------------------------------------
{
  const mobileVerify = ensureFile('apps/meerkat/app/(root)/components/VerifySheet.tsx');
  const webVerify = ensureFile('apps/meerkat-web/src/ui/discover/VerifySheet.tsx');
  const mobileHumanity = ensureFile('apps/meerkat/app/(root)/data/humanity-core.ts');
  const webHumanity = ensureFile('apps/meerkat-web/src/lib/humanity-core.ts');
  const mobileReader = ensureFile('apps/meerkat/app/(root)/components/PublicReader.tsx');
  const webReader = ensureFile('apps/meerkat-web/src/ui/discover/PublicReaderView.tsx');

  const verifyCopy = [
    "Verify you're human",
    'This check is anonymous.',
    'never proves who you are',
  ];
  for (const copy of verifyCopy) {
    ensureContainsNormalized('apps/meerkat VerifySheet', mobileVerify, copy, `humanity copy: ${copy}`);
    ensureContainsNormalized('apps/meerkat-web VerifySheet', webVerify, copy, `humanity copy: ${copy}`);
  }
  // The honest not-configured line lives in both humanity cores (fail-closed default).
  ensureContains('apps/meerkat humanity-core', mobileHumanity, 'Human verification is not available in this build.', 'honest not-configured line');
  ensureContains('apps/meerkat-web humanity-core', webHumanity, 'Human verification is not available in this build.', 'honest not-configured line');
  // Both cores use the same wallet key + drive the real service endpoints.
  for (const [label, src] of [['apps/meerkat humanity-core', mobileHumanity], ['apps/meerkat-web humanity-core', webHumanity]]) {
    ensureContains(label, src, "'humanity_token'", 'shares the humanity_token wallet key');
    ensureContains(label, src, '/humanity/challenge', 'calls the real /humanity/challenge endpoint');
    ensureContains(label, src, '/humanity/issue', 'calls the real /humanity/issue endpoint');
  }
  // The public-join CTA is gated by the humanity state on both surfaces.
  ensureContains('apps/meerkat PublicReader', mobileReader, 'humanityGateState', 'gates the public-join CTA on humanity');
  ensureContains('apps/meerkat-web PublicReaderView', webReader, 'humanityGateState', 'gates the public-join CTA on humanity');
  // The public PUBLISH action is humanity-gated on both surfaces (AM9).
  ensureContains('apps/meerkat PublishSheet', ensureFile('apps/meerkat/app/(root)/components/PublishSheet.tsx'), 'humanityGateState', 'gates the public publish on humanity');
  ensureContains('apps/meerkat-web PublishSheet', ensureFile('apps/meerkat-web/src/ui/publish/PublishSheet.tsx'), 'humanityGateState', 'gates the public publish on humanity');
  // The owner-side review row persists the joiner humanity token (AM1) on both surfaces.
  ensureContains('apps/meerkat/.../community-core.ts', ensureFile('apps/meerkat/app/(root)/data/community-core.ts'), 'humanity_token', 'owner queue row persists the humanity token');
  ensureContains('apps/meerkat-web/.../meerkat-data.ts', ensureFile('apps/meerkat-web/src/lib/meerkat-data.ts'), 'humanity_token', 'owner queue row persists the humanity token');
}

// ---------------------------------------------------------------------------
// Sync-policy UI (Plan 27 P4 / item 13): both surfaces expose the owner picker +
// member read-only "Sync policy" section driven by revisePolicy + the observed
// policy ledger; the member policy-change notice shares formatPolicyChangeNotice.
// ---------------------------------------------------------------------------
{
  const mobilePolicySection = ensureFile('apps/meerkat/app/(root)/components/CommunitySyncPolicySection.tsx');
  const webPolicySection = ensureFile('apps/meerkat-web/src/ui/community/CommunitySyncPolicySection.tsx');
  for (const [label, src] of [
    ['apps/meerkat CommunitySyncPolicySection', mobilePolicySection],
    ['apps/meerkat-web CommunitySyncPolicySection', webPolicySection],
  ]) {
    ensureContainsNormalized(label, src, 'Sync policy', 'renders the Sync policy section');
    ensureContains(label, src, 'setCommunityTransportPolicy', 'owner picker calls setCommunityTransportPolicy');
    ensureContains(label, src, 'getLatestPolicyChange', 'reads the latest observed policy change');
    ensureContains(label, src, 'formatPolicyChangeNotice', 'renders the shared policy-change notice');
  }
  // Both surfaces record the observed policy ledger after a real adopted descriptor.
  ensureContains('apps/meerkat/.../community-core.ts', ensureFile('apps/meerkat/app/(root)/data/community-core.ts'), 'export function recordCommunityPolicyPoint', 'mobile owns the observed policy ledger');
  ensureContains('apps/meerkat-web/.../policy-history.ts', ensureFile('apps/meerkat-web/src/lib/policy-history.ts'), 'export function recordCommunityPolicyPoint', 'web owns the observed policy ledger');
}

// ---------------------------------------------------------------------------
// Public persona onboarding (Plan 39 P3): both surfaces expose the verify -> alias
// picker -> account flow, the identity two-identity separation copy, and persona
// settings incl. GDPR export + delete. The copy is verbatim across surfaces, the
// registry client hits the REAL endpoints, and both carry the honest unconfigured
// state (no fabricated registered/available/verified status).
// ---------------------------------------------------------------------------
{
  // Mobile splits the persona UI across create/settings/identity; concat for the copy checks.
  const mobilePersonaUi = [
    ensureFile('apps/meerkat/app/(root)/persona/create.tsx'),
    ensureFile('apps/meerkat/app/(root)/persona/settings.tsx'),
    ensureFile('apps/meerkat/app/(root)/(tabs)/identity.tsx'),
  ].join('\n');
  const webPersonaUi = ensureFile('apps/meerkat-web/src/ui/settings/PublicPersonaSection.tsx');
  const mobilePersonaCore = ensureFile('apps/meerkat/app/(root)/data/persona-core.ts');
  const webPersonaCore = ensureFile('apps/meerkat-web/src/lib/persona-core.ts');

  const personaCopy = [
    "This is a brand-new identity. It is not linked to your device name, your friends, or your private communities, and we can't link it either.",
    'A new public signing key, made on this device',
    'Your alias, reserved for you everywhere on Meerkat',
    'Zero connection to your private identity, by design',
    'You can change how your name displays later. The @alias itself is permanent while the account exists.',
    "The alias itself can't change.",
    'Every post and reply, as JSON',
    'signs out all sessions, removes your posts from the feed, and erases the server record. Your private Meerkat is untouched.',
    'These two identities are cryptographically unrelated. Meerkat',
    'separate key, separate life',
    'Used for: the public feed, topics, public communities. What you post here is public and signed by this name only.',
    'Needs a connection server',
  ];
  for (const copy of personaCopy) {
    ensureContainsNormalized('apps/meerkat persona UI', mobilePersonaUi, copy, `persona copy: ${copy.slice(0, 48)}`);
    ensureContainsNormalized('apps/meerkat-web PublicPersonaSection', webPersonaUi, copy, `persona copy: ${copy.slice(0, 48)}`);
  }
  // Both cores share the device-local wallet key + drive the REAL registry endpoints.
  for (const [label, src] of [['apps/meerkat persona-core', mobilePersonaCore], ['apps/meerkat-web persona-core', webPersonaCore]]) {
    ensureContains(label, src, "'public_persona'", 'shares the public_persona wallet key');
    ensureContains(label, src, '/persona/register', 'calls the real /persona/register endpoint');
    ensureContains(label, src, '/persona/resolve', 'calls the real /persona/resolve endpoint');
    ensureContains(label, src, '/persona/delete', 'calls the real /persona/delete endpoint (GDPR)');
    ensureContains(label, src, '/persona/export', 'calls the real /persona/export endpoint (GDPR)');
    // Honesty: the unconfigured state is real, never a fabricated registered/available status.
    ensureContains(label, src, "'not_configured'", 'reports an honest not_configured state');
  }
}

// ---------------------------------------------------------------------------
// Verify-to-view (Plan 39 P9): both surfaces carry the same honest locked-feed
// copy + self-hosted boundary notice, the same device-local session-bearer wallet
// key, and the same read-session header helper. The gate state is real (persona
// present => verified, else locked), never fabricated.
// ---------------------------------------------------------------------------
{
  const mobileV2V = ensureFile('apps/meerkat/app/(root)/data/verify-to-view.ts');
  const webV2V = ensureFile('apps/meerkat-web/src/lib/verify-to-view.ts');
  const mobilePersonaCoreV = ensureFile('apps/meerkat/app/(root)/data/persona-core.ts');
  const webPersonaCoreV = ensureFile('apps/meerkat-web/src/lib/persona-core.ts');

  const v2vCopy = [
    'The public side of Meerkat is people-only',
    'Every account here belongs to a verified human. Verify once on this device to browse the public feed. It takes about a minute and costs nothing.',
    'Viewing is free. Posting needs the one-time ',
    ' unlock.',
    "Communities hosted on their owners' own hardware may be reachable without verification. We label them.",
  ];
  for (const copy of v2vCopy) {
    ensureContainsNormalized('apps/meerkat verify-to-view', mobileV2V, copy, `v2v copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web verify-to-view', webV2V, copy, `v2v copy: ${copy.slice(0, 44)}`);
  }
  // Both surfaces share the session-bearer wallet key + the read-session header helper.
  for (const [label, src] of [['apps/meerkat persona-core', mobilePersonaCoreV], ['apps/meerkat-web persona-core', webPersonaCoreV]]) {
    ensureContains(label, src, "'persona_session'", 'shares the persona_session wallet key');
    ensureContains(label, src, "'x-mk-session'", 'attaches the x-mk-session read header (verify-to-view)');
    ensureContains(label, src, 'export function readSessionHeaders', 'exposes the read-session header helper');
    ensureContains(label, src, 'export async function ensurePersonaSession', 'caches the session bearer (no per-read humanity spend)');
  }
}

// ---------------------------------------------------------------------------
// Public tab (Plan 39 P10/P11): both surfaces expose the Public feed surface with
// the same locked-feed copy (S1), the same topic chip rail, and the same honest
// "not connected in this build" verified-empty state. The tab is driven by the real
// verify-to-view state; nothing fabricates a feed.
// ---------------------------------------------------------------------------
{
  const mobilePublic = ensureFile('apps/meerkat/app/(root)/(tabs)/public.tsx');
  const webPublic = ensureFile('apps/meerkat-web/src/ui/public/PublicView.tsx');
  const mobileFeedCore = ensureFile('apps/meerkat/app/(root)/data/public-feed.ts');
  const webFeedCore = ensureFile('apps/meerkat-web/src/lib/public-feed.ts');

  const publicCopy = [
    'Proves a human is behind the account, not a bot',
    'Stores no name, email, or phone number',
    'Your private communities never need this',
    'The public feed is not connected in this build',
    'Only real, dual-signed posts appear here.',
  ];
  for (const copy of publicCopy) {
    ensureContainsNormalized('apps/meerkat public.tsx', mobilePublic, copy, `public copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web PublicView', webPublic, copy, `public copy: ${copy.slice(0, 44)}`);
  }
  // The Public tab is driven by the real verify-to-view state, not a fabricated feed.
  ensureContains('apps/meerkat public.tsx', mobilePublic, 'verifyToViewState', 'gates the Public tab on the real verify-to-view state');
  ensureContains('apps/meerkat-web PublicView', webPublic, 'verifyToViewState', 'gates the Public view on the real verify-to-view state');
  // Both feed cores share the topic rail (parity-locked) + the honest unconfigured check.
  for (const [label, src] of [['apps/meerkat public-feed', mobileFeedCore], ['apps/meerkat-web public-feed', webFeedCore]]) {
    ensureContains(label, src, 'PUBLIC_FEED_TOPICS', 'declares the topic chip rail');
    ensureContains(label, src, "channelId: 'technology'", 'shares the technology topic channel');
    ensureContains(label, src, 'isCommonsFeedConfigured', 'reports an honest unconfigured feed state');
    // The feed reader pulls REAL, dual-verified posts (fetchPublicPage re-verifies each post).
    ensureContains(label, src, 'export async function loadCommonsTopic', 'reads real posts via loadCommonsTopic');
    ensureContains(label, src, 'fetchPublicPage', 'dual-verifies posts against the pinned node key (never trusts the node)');
    ensureContains(label, src, 'readSessionHeaders', 'attaches the verify-to-view session on the read');
  }
}

// ---------------------------------------------------------------------------
// Public report sheet (Plan 39 P10/P11, S12): both surfaces file abuse reports
// PERSONA-signed (never the device key, NC-P2) via the same client + the same
// verbatim sheet copy, fail-closed, and wire the report affordance into the thread.
// ---------------------------------------------------------------------------
{
  const mobileReport = ensureFile('apps/meerkat/app/(root)/data/public-report.ts');
  const webReport = ensureFile('apps/meerkat-web/src/lib/public-report.ts');
  const mobileThread = ensureFile('apps/meerkat/app/(root)/public/post/[postId].tsx');
  const webThread = ensureFile('apps/meerkat-web/src/ui/public/PublicThreadView.tsx');

  const reportCopy = ['Report this post', "Goes to Meerkat trust & safety. The author isn't told who reported.", 'Submit report'];
  for (const [label, src] of [['apps/meerkat public-report', mobileReport], ['apps/meerkat-web public-report', webReport]]) {
    for (const copy of reportCopy) ensureContainsNormalized(label, src, copy, `report copy: ${copy.slice(0, 30)}`);
    ensureContains(label, src, 'createPublicAbuseReportWithKey', 'signs the report with the persona key, never the device key (NC-P2)');
    ensureContains(label, src, 'export async function submitPublicReport', 'exposes the shared persona-signed report client');
    ensureContains(label, src, "'not_configured'", 'reports an honest not_configured state (fail-closed)');
    ensureContains(label, src, 'PUBLIC_REPORT_CATEGORIES', 'shares the S12 report category taxonomy');
  }
  for (const [label, src] of [['apps/meerkat post/[postId]', mobileThread], ['apps/meerkat-web PublicThreadView', webThread]]) {
    ensureContains(label, src, 'submitPublicReport', 'wires the report sheet into the thread');
    ensureContains(label, src, 'REPORT_SHEET_TITLE', 'renders the verbatim report sheet title');
  }
}

// ---------------------------------------------------------------------------
// Public composer + $4.99 unlock gate (Plan 39 P10/P11, S5/S6): both surfaces
// expose the same composer copy (locked unlock sheet + before-going-live card +
// placeholder), the same honest submit chain (real acceptance receipt only), and
// source the price from billing-config (NC-P5, never a hardcoded dollar string).
// ---------------------------------------------------------------------------
{
  const mobilePublicTab = ensureFile('apps/meerkat/app/(root)/(tabs)/public.tsx');
  const webPublicView = ensureFile('apps/meerkat-web/src/ui/public/PublicView.tsx');
  const mobileCompose = ensureFile('apps/meerkat/app/(root)/public/compose.tsx');
  const webCompose = ensureFile('apps/meerkat-web/src/ui/public/PublicComposeView.tsx');
  const mobileClient = ensureFile('apps/meerkat/app/(root)/data/public-post-client.ts');
  const webClient = ensureFile('apps/meerkat-web/src/lib/public-post-client.ts');
  const mobileFeedCore2 = ensureFile('apps/meerkat/app/(root)/data/public-feed.ts');
  const webFeedCore2 = ensureFile('apps/meerkat-web/src/lib/public-feed.ts');

  const composeCopy = [
    'Unlock posting, once, forever',
    'Reading is free for every verified human. Posting anywhere on public Meerkat needs the one-time unlock. No subscription.',
    'one time · unlocks the full app too',
    'Unlock and post',
    'Restore purchase',
    'Before this goes live',
    'Signed by your public name, not your device',
    'Public and visible to every verified member; removable by you or moderators',
    'Admission to this feed is checked by the Meerkat host, like any public platform',
    '1 verification pass will be spent to post. Wallet: ',
  ];
  for (const copy of composeCopy) {
    ensureContainsNormalized('apps/meerkat compose.tsx', mobileCompose, copy, `compose copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web PublicComposeView', webCompose, copy, `compose copy: ${copy.slice(0, 44)}`);
  }
  // The composer placeholder is a shared constant in the feed core (byte-identical twin).
  for (const [label, src] of [['apps/meerkat public-feed', mobileFeedCore2], ['apps/meerkat-web public-feed', webFeedCore2]]) {
    ensureContains(label, src, 'Say something worth reading', 'shares the composer placeholder');
    ensureContains(label, src, 'MAX_PUBLIC_POST_BODY', 'shares the post body cap from the protocol');
  }
  // NC-P5: the price is sourced from billing-config, never a hardcoded dollar string.
  ensureContains('apps/meerkat compose.tsx', mobileCompose, 'FALLBACK_UNLOCK_PRICE_LABEL', 'sources the unlock price from billing-config (mobile)');
  ensureContains('apps/meerkat-web PublicComposeView', webCompose, 'MEERKAT_APP_UNLOCK_PRODUCT', 'sources the unlock price from billing-config (web)');
  // The submit chain is real on both surfaces: a posted state only off a real receipt.
  for (const [label, src] of [['apps/meerkat public-post-client', mobileClient], ['apps/meerkat-web public-post-client', webClient]]) {
    ensureContains(label, src, 'export async function submitPublicPost', 'exposes the real submit chain');
    ensureContains(label, src, 'x-mk-session', 'attaches the persona session gate header');
    ensureContains(label, src, 'x-mk-humanity', 'attaches the single-use humanity gate header');
    ensureContains(label, src, 'x-mk-app-unlock', 'attaches the persona-bound app-unlock proof header');
    ensureContains(label, src, 'json.accepted', 'returns ok ONLY off a real acceptance receipt (NC-3)');
    ensureContains(label, src, 'unshiftStoredHumanityToken', 'pushes the humanity token back when it was never redeemed');
    ensureContains(label, src, 'humanityTokenConsumed === false', 'restores a token explicitly rejected before humanity redemption');
  }
  // The composer entry is wired into the Public surface on both surfaces.
  ensureContains('apps/meerkat public.tsx', mobilePublicTab, 'public/compose', 'routes to the composer from the Public tab');
  ensureContains('apps/meerkat-web PublicView', webPublicView, 'PublicComposeView', 'renders the composer from the Public view');
}

// ---------------------------------------------------------------------------
// Public post thread + replies (Plan 39 P10/P11, S7): both surfaces render the
// dual-verified root + verified replies and a reply composer that rides the SAME
// gated submit client (parentPostId). Reply counts are real (loaded replies); no
// fabricated bump/like counts (NC-P6). Same verbatim thread copy on both surfaces.
// ---------------------------------------------------------------------------
{
  const mobileThread = ensureFile('apps/meerkat/app/(root)/public/post/[postId].tsx');
  const webThread = ensureFile('apps/meerkat-web/src/ui/public/PublicThreadView.tsx');
  const mobileThreadCore = ensureFile('apps/meerkat/app/(root)/data/public-thread.ts');
  const webThreadCore = ensureFile('apps/meerkat-web/src/lib/public-thread.ts');
  const mobilePublicTab2 = ensureFile('apps/meerkat/app/(root)/(tabs)/public.tsx');
  const webPublicView2 = ensureFile('apps/meerkat-web/src/ui/public/PublicView.tsx');

  const threadCopy = [
    'Signed by',
    'accepted by the Meerkat host',
    'Reply as your public name…',
    'Replies need the one-time unlock, like every public post.',
  ];
  for (const copy of threadCopy) {
    ensureContainsNormalized('apps/meerkat thread', mobileThread, copy, `thread copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web thread', webThread, copy, `thread copy: ${copy.slice(0, 44)}`);
  }
  // Both thread cores read via loadPublicThread (real dual-verified posts) + a real reply count.
  for (const [label, src] of [['apps/meerkat public-thread', mobileThreadCore], ['apps/meerkat-web public-thread', webThreadCore]]) {
    ensureContains(label, src, 'export async function loadPublicThread', 'loads a post + its replies');
    ensureContains(label, src, 'fetchPublicPage', 'dual-verifies every post against the pinned node key');
    ensureContains(label, src, 'parentPostId === rootPostId', 'partitions replies by parentPostId');
    ensureContains(label, src, 'replyCountLabel', 'labels the reply count from the REAL loaded replies');
  }
  // Replies ride the gated submit client with parentPostId on both surfaces.
  ensureContains('apps/meerkat thread', mobileThread, 'parentPostId: rootPostId', 'replies are gated writes via submitPublicPost');
  ensureContains('apps/meerkat-web thread', webThread, 'parentPostId: postId', 'replies are gated writes via submitPublicPost');
  // Feed cards open the thread on both surfaces.
  ensureContains('apps/meerkat public.tsx', mobilePublicTab2, 'public/post/[postId]', 'opens the thread from a feed card');
  ensureContains('apps/meerkat-web PublicView', webPublicView2, 'setViewingThread', 'opens the thread from a feed card');
}

// ---------------------------------------------------------------------------
// Reverse-resolve (pubkey -> alias) + @alias on cards (Plan 39 P10/P11, S8 seam):
// both surfaces batch-resolve author aliases through the real registry and render
// personaHandle (@alias when registered, honest short-persona-id fallback otherwise).
// ---------------------------------------------------------------------------
{
  const mobilePersonaCore = ensureFile('apps/meerkat/app/(root)/data/persona-core.ts');
  const webPersonaCore = ensureFile('apps/meerkat-web/src/lib/persona-core.ts');
  const mobilePublicTab3 = ensureFile('apps/meerkat/app/(root)/(tabs)/public.tsx');
  const webPublicView3 = ensureFile('apps/meerkat-web/src/ui/public/PublicView.tsx');
  const mobileThread2 = ensureFile('apps/meerkat/app/(root)/public/post/[postId].tsx');
  const webThread2 = ensureFile('apps/meerkat-web/src/ui/public/PublicThreadView.tsx');

  for (const [label, src] of [['apps/meerkat persona-core', mobilePersonaCore], ['apps/meerkat-web persona-core', webPersonaCore]]) {
    ensureContains(label, src, 'export async function resolvePersonaKeys', 'batch reverse-resolves pubkeys to registered aliases');
    ensureContains(label, src, '/persona/resolve-keys', 'calls the real batch reverse-resolve endpoint');
    ensureContains(label, src, 'export function personaHandle', 'renders @alias with an honest short-id fallback');
  }
  // @alias is rendered (via personaHandle) on the feed AND the thread on both surfaces.
  for (const [label, src] of [
    ['apps/meerkat public.tsx', mobilePublicTab3],
    ['apps/meerkat-web PublicView', webPublicView3],
    ['apps/meerkat thread', mobileThread2],
    ['apps/meerkat-web thread', webThread2],
  ]) {
    ensureContains(label, src, 'personaHandle(aliases', 'renders the resolved @alias / short-id fallback');
    ensureContains(label, src, 'resolvePersonaKeys(', 'batch-resolves the author aliases');
  }
}

// ---------------------------------------------------------------------------
// Public profile (Plan 39 P10/P11, S8): both surfaces assemble a profile PURELY
// from a persona's dual-verified public posts, follow via cm_public_follows, and
// state the honest privacy line. Real post count only; no fabricated totals (NC-P6).
// ---------------------------------------------------------------------------
{
  const mobileProfile = ensureFile('apps/meerkat/app/(root)/public/persona/[persona].tsx');
  const webProfile = ensureFile('apps/meerkat-web/src/ui/public/PublicProfileView.tsx');
  const mobileProfileCore = ensureFile('apps/meerkat/app/(root)/data/public-profile.ts');
  const webProfileCore = ensureFile('apps/meerkat-web/src/lib/public-profile.ts');
  const mobilePublicTab4 = ensureFile('apps/meerkat/app/(root)/(tabs)/public.tsx');
  const webPublicView4 = ensureFile('apps/meerkat-web/src/ui/public/PublicView.tsx');

  const profileCopy = [
    'Public personas show only what their owner posts publicly. No device, location, or private-community information exists here.',
    'Following',
  ];
  for (const copy of profileCopy) {
    ensureContainsNormalized('apps/meerkat profile', mobileProfile, copy, `profile copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web profile', webProfile, copy, `profile copy: ${copy.slice(0, 44)}`);
  }
  for (const [label, src] of [['apps/meerkat public-profile', mobileProfileCore], ['apps/meerkat-web public-profile', webProfileCore]]) {
    ensureContains(label, src, 'export async function loadPersonaProfile', 'assembles the profile from persona-signed posts');
    ensureContains(label, src, 'fetchPublicPage', 'dual-verifies every post against the pinned node key');
    ensureContains(label, src, 'publicPostCountLabel', 'labels the REAL loaded post count (no fabricated totals)');
  }
  // Follow writes cm_public_follows (persona kind) on both surfaces.
  ensureContains('apps/meerkat profile', mobileProfile, "toggleFollowPublic(db, 'persona'", 'follows the persona via cm_public_follows');
  ensureContains('apps/meerkat-web profile', webProfile, "toggleFollowPublic(m.db, 'persona'", 'follows the persona via cm_public_follows');
  // The author handle opens the profile from feed cards on both surfaces.
  ensureContains('apps/meerkat public.tsx', mobilePublicTab4, 'public/persona/[persona]', 'opens the profile from a feed card author');
  ensureContains('apps/meerkat-web PublicView', webPublicView4, 'setViewingProfile', 'opens the profile from a feed card author');
}

// ---------------------------------------------------------------------------
// Topic channel (Plan 39 P10/P11, S9): both surfaces render a Commons topic's
// dual-verified posts (recency only, no fabricated Top/Rising, NC-P6), a follow
// toggle (cm_public_follows, topic kind), and an honest hosted/posting header.
// ---------------------------------------------------------------------------
{
  const mobileTopic = ensureFile('apps/meerkat/app/(root)/public/topic/[channel].tsx');
  const webTopic = ensureFile('apps/meerkat-web/src/ui/public/PublicTopicView.tsx');
  const mobileThread3 = ensureFile('apps/meerkat/app/(root)/public/post/[postId].tsx');
  const webThread3 = ensureFile('apps/meerkat-web/src/ui/public/PublicThreadView.tsx');

  const topicCopy = [
    'A Commons topic · hosted by Meerkat',
    'Open posting for unlocked members. Moderated by the Meerkat trust and safety team.',
    'Following',
  ];
  for (const copy of topicCopy) {
    ensureContainsNormalized('apps/meerkat topic', mobileTopic, copy, `topic copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web topic', webTopic, copy, `topic copy: ${copy.slice(0, 44)}`);
  }
  for (const [label, src] of [['apps/meerkat topic', mobileTopic], ['apps/meerkat-web topic', webTopic]]) {
    ensureContains(label, src, 'loadCommonsTopic', 'reads the topic feed (real dual-verified posts)');
    ensureContains(label, src, 'toggleFollowPublic(', 'follows the topic via cm_public_follows');
    ensureContains(label, src, "'topic'", 'follows with the topic follow kind');
  }
  ensureContains('apps/meerkat thread', mobileThread3, 'public/topic/[channel]', 'opens the topic channel from the thread topic line');
  ensureContains('apps/meerkat-web thread', webThread3, 'onOpenTopic(channelId)', 'opens the topic channel from the thread topic line');
}

// ---------------------------------------------------------------------------
// Explore (Plan 39 P10/P11, S10): Discover re-homed inside the Public tab -- the
// Commons topic chips (each opens its topic channel), a browse entry into the
// existing public communities directory, and the NC-P4 self-hosted honesty note.
// ---------------------------------------------------------------------------
{
  const mobileExplore = ensureFile('apps/meerkat/app/(root)/public/explore.tsx');
  const webExplore = ensureFile('apps/meerkat-web/src/ui/public/PublicExploreView.tsx');
  const mobilePublicTab5 = ensureFile('apps/meerkat/app/(root)/(tabs)/public.tsx');
  const webPublicView5 = ensureFile('apps/meerkat-web/src/ui/public/PublicView.tsx');

  const exploreCopy = [
    'Explore',
    'Commons topics',
    'Public communities',
    'Browse public communities',
    'Community feeds hosted by their owners may be reachable outside Meerkat. The Commons and everything marked "hosted by Meerkat" is verified-members only.',
  ];
  for (const copy of exploreCopy) {
    ensureContainsNormalized('apps/meerkat explore', mobileExplore, copy, `explore copy: ${copy.slice(0, 44)}`);
    ensureContainsNormalized('apps/meerkat-web explore', webExplore, copy, `explore copy: ${copy.slice(0, 44)}`);
  }
  for (const [label, src] of [['apps/meerkat explore', mobileExplore], ['apps/meerkat-web explore', webExplore]]) {
    ensureContains(label, src, 'PUBLIC_FEED_TOPICS', 'lists the Commons topics');
  }
  // Explore is reachable from the Public surface, and Discover stays reachable from Explore.
  ensureContains('apps/meerkat public.tsx', mobilePublicTab5, 'public/explore', 'opens Explore from the Public tab');
  ensureContains('apps/meerkat-web PublicView', webPublicView5, 'setViewingExplore(true)', 'opens Explore from the Public view');
  ensureContains('apps/meerkat explore', mobileExplore, "'/discover'", 're-homes Discover (directory stays functional)');
  ensureContains('apps/meerkat-web PublicView', webPublicView5, "'OPEN_DISCOVER'", 're-homes Discover (directory stays functional)');
}

// ---------------------------------------------------------------------------
// Global Downloads + web launch E2E (Plan 40 D.7/D.8): both surfaces must expose
// the cross-community Downloads browser from Settings and community Files, source
// rows from the verified community file helpers, keep removed files non-saveable,
// and carry a browser launch smoke suite whose relay paths only run against a
// configured real relay URL.
// ---------------------------------------------------------------------------
{
  const mobileDownloads = ensureFile('apps/meerkat/app/(root)/(tabs)/downloads.tsx');
  const mobileDownloadsCore = ensureFile('apps/meerkat/app/(root)/data/community-files.ts');
  const mobileDownloadsTest = ensureFile('apps/meerkat/app/(root)/data/__tests__/global-downloads.function-gate.test.ts');
  const mobileTabs = ensureFile('apps/meerkat/app/(root)/(tabs)/_layout.tsx');
  const mobileSettings = ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx');
  const mobileFiles = ensureFile('apps/meerkat/app/(root)/(tabs)/files/[communityId].tsx');

  const webDownloads = ensureFile('apps/meerkat-web/src/ui/files/DownloadsView.tsx');
  const webDownloadsCore = ensureFile('apps/meerkat-web/src/lib/global-downloads.ts');
  const webDownloadsTest = ensureFile('apps/meerkat-web/src/lib/__tests__/global-downloads.test.ts');
  const webApp = ensureFile('apps/meerkat-web/src/ui/App.tsx');
  const webViewState = ensureFile('apps/meerkat-web/src/ui/navigation/view-state.ts');
  const webSettings = ensureFile('apps/meerkat-web/src/ui/settings/StorageSection.tsx');
  const webFiles = ensureFile('apps/meerkat-web/src/ui/files/FilesView.tsx');
  const webPackage = ensureFile('apps/meerkat-web/package.json');
  const webPlaywrightConfig = ensureFile('apps/meerkat-web/playwright.config.ts');
  const webLaunchE2e = ensureFile('apps/meerkat-web/e2e/launch-paths.spec.ts');

  for (const [label, src] of [
    ['apps/meerkat Downloads', mobileDownloads],
    ['apps/meerkat-web DownloadsView', webDownloads],
  ]) {
    ensureContains(label, src, 'Downloads', 'renders the global Downloads heading');
    ensureContains(label, src, 'No downloads yet', 'renders the empty state');
    ensureContains(label, src, 'Partial availability', 'renders the partial-availability state');
    ensureContains(label, src, 'removed files are never saveable', 'states removed files are not saveable');
    ensureContains(label, src, 'communityFileReportTarget', 'reports from the canonical file report target');
  }
  ensureContains('apps/meerkat Downloads', mobileDownloads, 'FileIndexRequestButton', 'exposes request-again recovery for absent bytes');
  ensureContains('apps/meerkat-web DownloadsView', webDownloads, 'RequestAgainAction', 'exposes request-again recovery for absent bytes');
  for (const [label, src] of [
    ['apps/meerkat Downloads core', mobileDownloadsCore],
    ['apps/meerkat-web Downloads core', webDownloadsCore],
  ]) {
    ensureContains(label, src, 'filterGlobalDownloadFiles', 'filters global Downloads rows by search/status');
    ensureContains(label, src, 'summarizeGlobalDownloads', 'summarizes on-device/removed/downloadable bytes');
    ensureContains(label, src, 'GlobalDownloadFile', 'models a scoped global file row');
  }
  ensureContains('apps/meerkat Downloads core', mobileDownloadsCore, 'aggregateCommunityFiles', 'sources Downloads from aggregateCommunityFiles');
  ensureContains('apps/meerkat-web DownloadsView', webDownloads, 'listChannelFiles', 'sources Downloads from listChannelFiles');
  ensureContains('apps/meerkat mobile Downloads tests', mobileDownloadsTest, 'global Downloads helpers', 'covers the global Downloads helpers');
  ensureContains('apps/meerkat-web Downloads tests', webDownloadsTest, 'global Downloads helpers', 'covers the global Downloads helpers');

  ensureContains('apps/meerkat tabs layout', mobileTabs, 'name="downloads"', 'registers the hidden Downloads route');
  ensureContains('apps/meerkat settings', mobileSettings, 'Open Downloads', 'opens Downloads from Settings');
  ensureContains('apps/meerkat files', mobileFiles, "router.push('/downloads')", 'opens global Downloads from community Files');
  ensureContains('apps/meerkat-web App', webApp, '<DownloadsView', 'renders Downloads from app navigation state');
  ensureContains('apps/meerkat-web view-state', webViewState, 'OPEN_DOWNLOADS', 'defines Downloads navigation action');
  ensureContains('apps/meerkat-web settings storage', webSettings, 'Open Downloads', 'opens Downloads from Settings');
  ensureContains('apps/meerkat-web FilesView', webFiles, 'All downloads', 'opens global Downloads from community Files');

  ensureContains('apps/meerkat-web package.json', webPackage, '"test:e2e": "playwright test"', 'exposes the web launch E2E script');
  ensureContains('apps/meerkat-web package.json', webPackage, '"@playwright/test"', 'depends on Playwright for launch E2E');
  ensureContains('apps/meerkat-web playwright.config.ts', webPlaywrightConfig, 'defineConfig', 'defines Playwright config');
  ensureContains('apps/meerkat-web e2e launch paths', webLaunchE2e, 'cold load, onboarding, create community, and send a community message', 'covers launch onboarding/community send');
  ensureContains('apps/meerkat-web e2e launch paths', webLaunchE2e, 'Downloads browser is reachable from Files', 'covers Downloads reachability from Files');
  ensureContains('apps/meerkat-web e2e launch paths', webLaunchE2e, 'Settings exposes Downloads', 'covers Downloads reachability from Settings');
  ensureContains('apps/meerkat-web e2e launch paths', webLaunchE2e, 'MEERKAT_E2E_RELAY_URL', 'guards relay-dependent launch paths behind a real configured relay');
}

// --- Plan 41 WP-41B3: Storage & Backup UI parity. The storage-ui-core.ts
// view-model is a BYTE-IDENTICAL twin across mobile and web (header aside): it
// maps the real mk_storage_* read model into the sections both surfaces render,
// so a copy or logic change on one surface cannot silently diverge. Both
// surfaces must also carry the honesty-critical product-law copy verbatim.
{
  // storage-ui-core.ts itself is twin-locked in CORE_TWINS (composition Phase 0).

  // Product-law copy that neither surface may drop or reword. The strings live in
  // the shared core, so the twin check above already locks them; these assertions
  // make the intent explicit and guard against a surface stubbing the core out.
  const STORAGE_UI_LAW_COPY = [
    'Storage & Backup',
    'Nothing is backed up until a destination verifies a copy',
    'Meerkat hosted storage is a paid option you pick, never a silent default',
    'A copy counts as backed up only after the destination confirms it',
    'your current data on this device is left exactly as it was',
    'This backup includes your recovery identity. Restoring it replaces the identity on this device',
    'A fresh install can find and restore these backups with the recovery key and destination credentials',
  ];
  const mobileStorageSurface = [
    'apps/meerkat/app/(root)/data/storage-destinations/storage-ui-core.ts',
    'apps/meerkat/app/(root)/(tabs)/storage.tsx',
    'apps/meerkat/app/(root)/(tabs)/storage/add-destination.tsx',
    'apps/meerkat/app/(root)/(tabs)/storage/restore.tsx',
  ].map((p) => ensureFile(p) ?? '').join('\n');
  const webStorageSurface = [
    'apps/meerkat-web/src/lib/storage/storage-ui-core.ts',
    'apps/meerkat-web/src/ui/settings/StorageOverlay.tsx',
  ].map((p) => ensureFile(p) ?? '').join('\n');
  for (const copy of STORAGE_UI_LAW_COPY) {
    ensureContains('apps/meerkat storage surface', mobileStorageSurface, copy, `storage copy: ${JSON.stringify(copy)}`);
    ensureContains('apps/meerkat-web storage surface', webStorageSurface, copy, `storage copy: ${JSON.stringify(copy)}`);
  }

  // The broker trust disclosure must appear VERBATIM before a broker connect on
  // web (AC-41.14); the exported constant is the single source both use.
  const webStorageOverlay = ensureFile('apps/meerkat-web/src/ui/settings/StorageOverlay.tsx');
  ensureContains(
    'apps/meerkat-web StorageOverlay',
    webStorageOverlay,
    'BROKER_TRUST_DISCLOSURE',
    'web add-destination renders the exported broker trust disclosure before connect',
  );

  // Both surfaces reach Storage & Backup from Settings.
  ensureContains(
    'apps/meerkat settings',
    ensureFile('apps/meerkat/app/(root)/(tabs)/settings.tsx'),
    "router.push('/storage')",
    'mobile Settings opens Storage & Backup',
  );
  ensureContains(
    'apps/meerkat-web StorageSection',
    ensureFile('apps/meerkat-web/src/ui/settings/StorageSection.tsx'),
    "kind: 'storage'",
    'web Settings opens Storage & Backup',
  );
}

// --- Plan 40 R2: sync public-barrel honesty. The retired no-op stub clients
// (SignalingClient / TrackerClient / PaidContentManager faked connect/announce/
// payment success with no IO) must never re-enter a public sync barrel, and no
// module a barrel re-exports may carry a fake-success stub body. Reachability
// was verified at removal (zero product imports); this keeps it that way.
{
  const syncBarrels = ['packages/sync/src/index.ts', 'packages/sync/src/index.native.ts'];
  for (const barrelPath of syncBarrels) {
    const barrel = ensureFile(barrelPath);
    for (const retired of ['SignalingClient', 'TrackerClient', 'PaidContentManager']) {
      ensureAbsent(barrelPath, barrel, retired, `no retired fake-success stub "${retired}" in the public barrel`);
    }
  }
  const FAKE_SUCCESS_MARKERS = [
    'Stub: resolves immediately',
    'performs no real I/O',
    'resolves immediately without connecting',
    'resolves immediately without sending',
  ];
  for (const marker of FAKE_SUCCESS_MARKERS) {
    const hit = findInTree('packages/sync/src', ['.ts'], marker);
    const testHit = hit && hit.includes('__tests__') ? null : hit;
    if (testHit) fail(`sync exports a fake-success stub: "${marker}" found in ${testHit}`);
    else ok(`sync src carries no fake-success stub marker "${marker}"`);
  }
}

// --- Plan 53 P2-P4: the in-person proximity ceremony's honesty surfaces.
// The ceremony itself is mobile-only (no browser has a nearby radio), so this
// is copy + placement parity, not a logic twin.
{
  const mobileViewCore = ensureFile('apps/meerkat/app/(root)/data/proximity-ceremony-view-core.ts');
  const mobileAddFriend = ensureFile('apps/meerkat/app/(root)/(tabs)/add-friend.tsx');
  const mobileSync = ensureFile('apps/meerkat/app/(root)/sync.tsx');
  const mobileCapability = ensureFile('apps/meerkat/app/(root)/data/capability-status.ts');
  const webAddFriendCore = ensureFile('apps/meerkat-web/src/lib/add-friend-core.ts');
  const webOverlay = ensureFile('apps/meerkat-web/src/ui/friends/AddFriendOverlay.tsx');
  const webCapability = ensureFile('apps/meerkat-web/src/lib/capability-status.ts');

  // The ceremony's security + honesty copy is locked at its single source.
  ensureContains('apps/meerkat/.../proximity-ceremony-view-core.ts', mobileViewCore,
    'Confirm only if both phones show exactly the same five',
    'the SAS instruction commands the comparison (never optional)');
  ensureContains('apps/meerkat/.../proximity-ceremony-view-core.ts', mobileViewCore,
    'nearby device sync is paused',
    'the nearby-takeover consequence is stated, not hidden');
  ensureContains('apps/meerkat/.../proximity-ceremony-view-core.ts', mobileViewCore,
    'Adding in person needs the full Meerkat app.',
    'the Expo Go fallback is honest copy, never a dead control');

  // PLACEMENT: the in-person entry must render OUTSIDE the canResolve server
  // gate; the whole point is that it works with no server. Locked by ordering.
  if (mobileAddFriend) {
    const entryAt = mobileAddFriend.indexOf('/add-in-person?mode=friend');
    const gateAt = mobileAddFriend.indexOf('{canResolve ?');
    if (entryAt === -1) fail('apps/meerkat add-friend.tsx lost the in-person ceremony entry');
    else if (gateAt === -1) fail('apps/meerkat add-friend.tsx lost the canResolve gate this check anchors on');
    else if (entryAt > gateAt) fail('apps/meerkat add-friend.tsx moved the in-person entry INSIDE the canResolve server gate');
    else ok('mobile add-friend renders the in-person entry outside the canResolve server gate');
  }
  ensureContains('apps/meerkat/.../sync.tsx', mobileSync, '/add-in-person?mode=device',
    'the Sync pairing section offers the same ceremony for own devices');

  // Web says plainly that a browser cannot run the ceremony, from ONE source.
  ensureContains('apps/meerkat-web/.../add-friend-core.ts', webAddFriendCore,
    'A web browser cannot use the nearby radio',
    'web single-sources the browser-impossible line');
  ensureContains('apps/meerkat-web/.../AddFriendOverlay.tsx', webOverlay,
    'ADD_FRIEND_IN_PERSON_WEB_LINE',
    'the web add-friend surface renders the single-sourced line');
  ensureContains('apps/meerkat-web/.../capability-status.ts', webCapability,
    'ADD_FRIEND_IN_PERSON_WEB_LINE',
    'the web capability page reuses the same single-sourced line');

  // Capability entries exist on BOTH platforms, and the mobile one derives
  // from the real substrate so it can never claim availability in Expo Go.
  ensureContains('apps/meerkat/.../capability-status.ts', mobileCapability,
    "id: 'in_person_add'", 'mobile capability entry for in-person adds');
  ensureContains('apps/meerkat/.../capability-status.ts', mobileCapability,
    'loadNativeNearbyModule() !== null',
    'the mobile in-person capability status derives from the real substrate');
  ensureContains('apps/meerkat-web/.../capability-status.ts', webCapability,
    "id: 'in_person_add'", 'web capability entry for in-person adds');

  // NO-TAP rule: no user-facing ceremony copy may present "tap" as the
  // pairing mechanism (there is no app-controllable phone-to-phone NFC).
  // Comment lines are excluded: the rule is about copy the user reads, and
  // the source documents the rule itself.
  for (const [path, contents] of [
    ['apps/meerkat/app/(root)/data/proximity-ceremony-view-core.ts', mobileViewCore],
    ['apps/meerkat-web/src/lib/add-friend-core.ts', webAddFriendCore],
  ]) {
    if (!contents) continue;
    const copyLines = contents.split('\n').filter((line) => {
      const t = line.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    }).join('\n');
    if (/\btap\b/i.test(copyLines)) fail(`${path} says "tap" as a mechanism; the honest phrasing is phones near each other`);
    else ok(`${path} never says "tap" as a mechanism`);
  }
}

out('\n----------------------------------------\n');
if (failures > 0) {
  err(`${failures} Meerkat parity check(s) failed.`);
  process.exit(1);
}
out('All Meerkat parity checks passed.');
