# MK-P01: Post Schema & v2 Channel-Message Contract - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the schema and signed-contract foundation for Meerkat Posts (the agent-native Workplace successor) with zero UX change and nothing faked, so every later plan (posts, branch reply, bumping, reactions, attention inbox, agents) builds on a correct wire format.

**Architecture:** Extend the immutable signed `ChannelMessageEvent` to a back-compatible `version: 2` that appends six optional, signature-covered fields (`postId`, `parentId`, `branchId`, `authorKind`, `mentions`, `intent`) under a version-dispatched canonical encoder so v1 bytes never shift. Add the four post tables (`cm_posts` immutable signed header, `cm_post_tags` or-set, `cm_post_lifecycle` signed-event, `cm_post_activity` local-only) plus the v2 columns on `cm_messages` and the attention columns on `cm_read_state`, register the replicating tables in `COMMUNITY_SYNC_POLICY`, and hand-mirror every change into the web twin (no script enforces native↔web parity).

**Tech Stack:** TypeScript (strict), Vitest, SQLite (`expo-sqlite` native / sql.js web via `@mylife/db` adapter), `@mylife/sync` (Ed25519 via tweetnacl, SHA-512 content ids), Expo Router app + Vite web app.

---

## Context & source-of-truth references

- Product spec: `apps/meerkat/docs/reports/meerkat-posts-agent-native-chat-spec-2026-06-18.md` (this plan implements its **Phase 0 / MK-P01**, the "Data-model sketch" section).
- Locked decisions (2026-06-18): ship both bump sorts later, bounded-branch render later, pluggable agent custody later. **None affect MK-P01** - this is pure schema/contract.
- Honesty boundary (CLAUDE.md): never fake transport/presence/delivery/peer counts. MK-P01 adds **no UI and no derived counts**; tables are created empty, columns are additive.

**Files you will touch (all paths absolute from repo root `/Users/trey/Desktop/Apps/MyLife`):**

| File | Role | Change |
|---|---|---|
| `packages/sync/src/protocol/channel-message.ts` | Signed channel-message contract | Widen to v2, version-dispatched canonical encoder, v2 creator, v1 anti-smuggle verify guard |
| `packages/sync/src/index.ts` | Node barrel | Export `createChannelMessageV2` + new types |
| `packages/sync/src/index.native.ts` | Native/web barrel | Mirror the new exports |
| `packages/sync/src/__tests__/channel-message.test.ts` | Protocol tests | Add a `MK-P01 v2` describe block |
| `apps/meerkat/app/(root)/data/community-core.ts` | Native `cm_` schema + helpers | New columns + new tables + policy + row converters + generic ALTER helper |
| `apps/meerkat/app/__tests__/community-core.test.ts` | Native schema tests | Add v2 round-trip + migration + policy cases |
| `apps/meerkat-web/src/lib/schema.ts` | Web `cm_` DDL mirror | Mirror new columns + tables (private) |
| `apps/meerkat-web/src/lib/meerkat-data.ts` | Web `cm_` helpers mirror | Mirror `ChannelMessageRow` + converters + insert/list |
| `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts` | NEW web parity test | fs-based native↔web DDL/field lockstep |

**`sync-core.ts` (`apps/meerkat/app/(root)/data/sync-core.ts`) needs NO change:** `MEERKAT_SYNC_PREFIXES` maps `['community','cm_']`, which already routes every `cm_*` physical table. Per-table replication is gated by `COMMUNITY_SYNC_POLICY.entityRules` (edited in Task 3), not by the prefix map.

---

## Critical invariants (read before writing code)

1. **v1 bytes must never change.** `canonicalChannelMessage` is the only struct→signed-bytes function. The v1 branch must remain the exact current 10-element array with the `'meerkat-channel-message-v1'` domain string. The existing 7 `channel-message.test.ts` v1 cases are the regression guard - if a v1 id/signature shifts, they fail.
2. **v2 fields are append-only at index 10** and only encoded when `version === 2`, under a distinct `'meerkat-channel-message-v2'` domain string.
3. **A v1 event must not carry v2 fields.** Otherwise they ride along unsigned (a tamper vector). `verifyChannelMessage` rejects a v1 event that has any v2 field defined; `createChannelMessageV2` is the only producer of v2 fields.
4. **The DB row must store `version`.** A v2 event whose v2 fields are all absent still signed under the v2 domain string; without a stored `version` we would reconstruct it as v1 and verify would fail. Reconstruction is byte-safe because canonical uses `?? null` / `?? []`, so `undefined` and a null/empty row value encode identically.
5. **No script enforces native↔web parity** (`check-meerkat-parity.mjs` only inspects native and does not parse SQL). Every native `cm_` change MUST be hand-mirrored into `apps/meerkat-web` or web data silently diverges. Task 5 adds an fs-based lockstep test to catch this.
6. **Node tests need no PRNG/secret-store config** (tweetnacl auto-inits in Node; the native barrel auto-configures). Never import `meerkat-db.ts` from a Vitest test - it pulls `expo-*`.

---

## Task 1: v2 signed channel-message contract in `@mylife/sync`

**Files:**
- Modify: `packages/sync/src/protocol/channel-message.ts`
- Modify: `packages/sync/src/index.ts`
- Modify: `packages/sync/src/index.native.ts`
- Test: `packages/sync/src/__tests__/channel-message.test.ts`

- [ ] **Step 1: Add the failing v2 test block**

Append this `describe` block to the END of `packages/sync/src/__tests__/channel-message.test.ts` (keep all existing v1 cases intact). Add `createChannelMessageV2` to the existing import from `../protocol/channel-message`.

```ts
import {
  channelMessageId,
  compareChannelMessages,
  createChannelMessage,
  createChannelMessageV2,
  nextHlc,
  resolveChannelMessages,
  verifyChannelMessage,
  type ChannelMessageEvent,
} from '../protocol/channel-message';

describe('channel message v2 contract (MK-P01)', () => {
  const hlc = { wall: '2026-06-18T00:00:00.000Z', counter: 0 };

  it('signs, verifies, and derives a stable id for a v2 post event', () => {
    const message = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'first post',
      hlc,
      postId: 'post-1',
      parentId: 'post-1',
      branchId: 'post-1',
      authorKind: 'human',
      mentions: ['device-abc'],
      intent: 'message',
    });

    expect(message.version).toBe(2);
    expect(message.postId).toBe('post-1');
    expect(message.id).toBe(channelMessageId(message));
    expect(verifyChannelMessage(message)).toBe(true);
  });

  it('covers each v2 field in the signature and content id', () => {
    const message = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'reply',
      hlc,
      postId: 'post-1',
      parentId: 'comment-9',
      branchId: 'comment-9',
      authorKind: 'agent',
      mentions: ['device-abc', 'device-def'],
      intent: 'agent_result',
    });

    const tamperParent: ChannelMessageEvent = { ...message, parentId: 'comment-OTHER' };
    const tamperMentions: ChannelMessageEvent = { ...message, mentions: ['device-evil'] };
    const tamperIntent: ChannelMessageEvent = { ...message, intent: 'message' };

    expect(verifyChannelMessage(message)).toBe(true);
    expect(verifyChannelMessage(tamperParent)).toBe(false);
    expect(verifyChannelMessage(tamperMentions)).toBe(false);
    expect(verifyChannelMessage(tamperIntent)).toBe(false);
  });

  it('keeps v1 events byte-compatible (no v2 fields, still verifies)', () => {
    const v1 = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'legacy',
      hlc,
    });

    expect(v1.version).toBe(1);
    expect(v1.postId).toBeUndefined();
    expect(v1.parentId).toBeUndefined();
    expect(verifyChannelMessage(v1)).toBe(true);
    expect(v1.id).toBe(channelMessageId(v1));
  });

  it('rejects a v1 event that smuggles a v2 field', () => {
    const v1 = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'legacy',
      hlc,
    });
    const smuggled = { ...v1, postId: 'post-x' } as ChannelMessageEvent;
    expect(verifyChannelMessage(smuggled)).toBe(false);
  });

  it('rejects an unknown version', () => {
    const v2 = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'x',
      hlc,
      postId: 'post-1',
    });
    const bad = { ...v2, version: 3 } as unknown as ChannelMessageEvent;
    expect(verifyChannelMessage(bad)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `pnpm --filter @mylife/sync test channel-message`
Expected: FAIL - `createChannelMessageV2 is not a function` / `version` type errors. The existing v1 cases still pass.

- [ ] **Step 3: Widen the interface and add the v2 types**

In `packages/sync/src/protocol/channel-message.ts`, replace the `ChannelMessageEvent` interface (and add the two new exported types just above it). Change `version: 1` to `version: 1 | 2` and append the six optional v2 fields.

```ts
/** Provenance of a signed event's author. */
export type MessageAuthorKind = 'human' | 'agent';

/** Intent of a v2 event; drives feed, attention, and agent dispatch in later plans. */
export type ChannelMessageIntent =
  | 'message'
  | 'react'
  | 'resolve'
  | 'agent_task'
  | 'agent_result';

/** An immutable, sender-signed channel message event (D15; v2 adds post/threading). */
export interface ChannelMessageEvent {
  version: 1 | 2;
  /** Content hash of the signed body and signature. */
  id: string;
  communityId: string;
  channelId: string;
  /** Ed25519 device id. */
  authorDeviceId: string;
  body: string;
  attachments?: ChannelMessageAttachment[];
  hlc: Hlc;
  /** If set, this event edits or tombstones a prior message id. */
  supersedes?: { id: string; deleted: boolean };
  // --- v2-only, all optional, all signature-covered (canonicalized ONLY when version === 2) ---
  /** Root post this event belongs to (the bump target). */
  postId?: string;
  /** Exact message replied to (post id | comment id | reply id) - addressability. */
  parentId?: string;
  /** Branch this reply files under (defaults to nearest level-1 comment) - render legibility. */
  branchId?: string;
  /** Provenance of the signer. */
  authorKind?: MessageAuthorKind;
  /** Addressed deviceIds (humans or agents) - drives attention + agent dispatch. */
  mentions?: string[];
  /** Event intent. */
  intent?: ChannelMessageIntent;
  /** Hex Ed25519 signature over the canonical event form. */
  signature: string;
}
```

`ChannelMessageInput` is unchanged in source (it `Omit`s only `version | id | authorDeviceId | signature`, so the new optional fields flow into it automatically).

- [ ] **Step 4: Make the canonical encoder version-dispatched**

Replace `canonicalChannelMessage` with the version-dispatched form. The v1 path is byte-identical to today.

```ts
function canonicalChannelMessage(message: UnsignedChannelMessageEvent): Uint8Array {
  const base: unknown[] = [
    message.version === 2 ? 'meerkat-channel-message-v2' : 'meerkat-channel-message-v1',
    message.version,
    message.communityId,
    message.channelId,
    message.authorDeviceId,
    message.body,
    canonicalAttachments(message.attachments),
    message.hlc.wall,
    message.hlc.counter,
    message.supersedes ? [message.supersedes.id, message.supersedes.deleted] : null,
  ];
  if (message.version === 2) {
    base.push([
      message.postId ?? null,
      message.parentId ?? null,
      message.branchId ?? null,
      message.authorKind ?? null,
      message.mentions ?? [],
      message.intent ?? null,
    ]);
  }
  return encoder.encode(JSON.stringify(base));
}
```

- [ ] **Step 5: Add the v2 anti-smuggle guard to verify and widen the version gate**

Replace `verifyChannelMessage` with:

```ts
export function verifyChannelMessage(message: ChannelMessageEvent): boolean {
  if (message.version !== 1 && message.version !== 2) return false;
  if (message.version === 1) {
    // A v1 event must not carry v2 fields: they would ride along unsigned.
    if (
      message.postId !== undefined ||
      message.parentId !== undefined ||
      message.branchId !== undefined ||
      message.authorKind !== undefined ||
      message.mentions !== undefined ||
      message.intent !== undefined
    ) {
      return false;
    }
  }
  if (message.id !== channelMessageId(message)) return false;

  try {
    const { id, signature, ...unsigned } = message;
    void id;
    return verifySignature(
      message.authorDeviceId,
      canonicalChannelMessage(unsigned),
      hexToBytes(signature),
    );
  } catch {
    return false;
  }
}
```

- [ ] **Step 6: Refactor the creator and add `createChannelMessageV2`**

Replace `createChannelMessage` with a shared builder plus two thin creators. The builder strips v2 fields for v1 so a v1 event can never carry them.

```ts
function buildChannelMessage(
  author: DeviceIdentity,
  input: ChannelMessageInput,
  version: 1 | 2,
): ChannelMessageEvent {
  const unsigned: UnsignedChannelMessageEvent = {
    version,
    authorDeviceId: author.publicKey,
    ...input,
  };
  if (version === 1) {
    delete unsigned.postId;
    delete unsigned.parentId;
    delete unsigned.branchId;
    delete unsigned.authorKind;
    delete unsigned.mentions;
    delete unsigned.intent;
  }
  const privateKeyHex = extractSigningPrivateKeyHex(author.privateKeyRef);
  const signature = bytesToHex(signMessage(privateKeyHex, canonicalChannelMessage(unsigned)));
  const id = channelMessageId({ ...unsigned, signature });
  return { ...unsigned, id, signature };
}

/** Create a v1 channel message (legacy; carries no post/threading fields). */
export function createChannelMessage(
  author: DeviceIdentity,
  input: ChannelMessageInput,
): ChannelMessageEvent {
  return buildChannelMessage(author, input, 1);
}

/** Create a v2 channel message (posts, comments, replies, reactions, agent events). */
export function createChannelMessageV2(
  author: DeviceIdentity,
  input: ChannelMessageInput,
): ChannelMessageEvent {
  return buildChannelMessage(author, input, 2);
}
```

- [ ] **Step 7: Export the new symbols from both barrels**

In `packages/sync/src/index.ts`, add `createChannelMessageV2` to the value export and the two new types to the type export from `./protocol/channel-message`:

```ts
export {
  channelMessageId,
  compareChannelMessages,
  createChannelMessage,
  createChannelMessageV2,
  nextHlc,
  resolveChannelMessages,
  verifyChannelMessage,
} from './protocol/channel-message';
export type {
  ChannelMessageAttachment,
  ChannelMessageEvent,
  ChannelMessageInput,
  ChannelMessageIntent,
  Hlc,
  MessageAuthorKind,
} from './protocol/channel-message';
```

Apply the identical edit to `packages/sync/src/index.native.ts` (same export lists, mirror exactly).

- [ ] **Step 8: Run the v2 tests and the full protocol suite**

Run: `pnpm --filter @mylife/sync test channel-message`
Expected: PASS - all new MK-P01 cases AND all pre-existing v1 cases green (v1 byte-stability regression guard).

- [ ] **Step 9: Typecheck the package and its Meerkat consumers**

Run:
```bash
pnpm --filter @mylife/sync typecheck
pnpm --filter @mylife/meerkat-app typecheck
pnpm --filter @mylife/meerkat-web typecheck
```
Expected: PASS. (The changed-file gate only auto-typechecks `@mylife/mobile` + `@mylife/web` for `packages/*` edits, so the Meerkat apps are checked manually here.)

- [ ] **Step 10: Commit**

```bash
git add packages/sync/src/protocol/channel-message.ts packages/sync/src/index.ts packages/sync/src/index.native.ts packages/sync/src/__tests__/channel-message.test.ts
git commit -m "$(cat <<'EOF'
feat(sync): v2 channel-message contract (post/parent/branch/authorKind/mentions/intent) [MK-P01]

Version-dispatched canonical encoder keeps v1 bytes identical; v2 appends six
optional signature-covered fields. verifyChannelMessage rejects v1 events that
smuggle v2 fields. Adds createChannelMessageV2 + ChannelMessageIntent/MessageAuthorKind.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: v2 columns on `cm_messages` (native)

**Files:**
- Modify: `apps/meerkat/app/(root)/data/community-core.ts`
- Test: `apps/meerkat/app/__tests__/community-core.test.ts`

- [ ] **Step 1: Add the failing native round-trip + migration tests**

Append to `apps/meerkat/app/__tests__/community-core.test.ts`. Ensure the file imports `createChannelMessageV2`, `verifyChannelMessage` from `@mylife/sync` and `ensureCommunityTables`, `insertMessageRow`, `mergeChannelMessageEvents`, `listChannelMessages` from `../(root)/data/community-core` (most already imported; add `createChannelMessageV2`). Mirror the existing harness (`createInMemoryTestDatabase()` + `db.adapter`).

```ts
describe('community-core v2 message columns (MK-P01)', () => {
  it('persists and round-trips v2 post/threading columns', () => {
    ensureCommunityTables(db.adapter);
    const event = createChannelMessageV2(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'first post',
      hlc: { wall: '2026-06-18T00:00:00.000Z', counter: 0 },
      postId: 'post-1',
      parentId: 'post-1',
      branchId: 'post-1',
      authorKind: 'human',
      mentions: ['device-abc'],
      intent: 'message',
    });

    insertMessageRow(db.adapter, event);

    const rows = db.adapter.query<{
      version: number;
      post_id: string | null;
      parent_id: string | null;
      branch_id: string | null;
      author_kind: string | null;
      mentions_json: string;
      intent: string | null;
    }>('SELECT version, post_id, parent_id, branch_id, author_kind, mentions_json, intent FROM cm_messages WHERE id = ?', [event.id]);

    expect(rows[0]).toEqual({
      version: 2,
      post_id: 'post-1',
      parent_id: 'post-1',
      branch_id: 'post-1',
      author_kind: 'human',
      mentions_json: JSON.stringify(['device-abc']),
      intent: 'message',
    });

    // Byte-faithful reconstruction: the merged event still verifies.
    const merged = mergeChannelMessageEvents(db.adapter, [event]);
    expect(merged.skipped).toBe(1); // already inserted above
    const listed = listChannelMessages(db.adapter, 'c1', 'general');
    expect(listed).toHaveLength(1);
    expect(verifyChannelMessage(listed[0]!)).toBe(true);
    expect(listed[0]!.postId).toBe('post-1');
  });

  it('persists a v1 message with null v2 columns and version 1', () => {
    ensureCommunityTables(db.adapter);
    const event = createChannelMessage(author, {
      communityId: 'c1',
      channelId: 'general',
      body: 'legacy',
      hlc: { wall: '2026-06-18T00:00:01.000Z', counter: 0 },
    });
    insertMessageRow(db.adapter, event);
    const rows = db.adapter.query<{ version: number; post_id: string | null }>(
      'SELECT version, post_id FROM cm_messages WHERE id = ?', [event.id],
    );
    expect(rows[0]).toEqual({ version: 1, post_id: null });
    const listed = listChannelMessages(db.adapter, 'c1', 'general');
    expect(verifyChannelMessage(listed[0]!)).toBe(true);
  });

  it('adds the v2 columns idempotently to a legacy cm_messages table', () => {
    // Simulate a pre-MK-P01 database: create the OLD 12-column cm_messages.
    db.adapter.execute(`CREATE TABLE cm_messages (
      id TEXT PRIMARY KEY, community_id TEXT NOT NULL, channel_id TEXT NOT NULL,
      author_device_id TEXT NOT NULL, body TEXT NOT NULL,
      attachments_json TEXT NOT NULL DEFAULT '[]', hlc_wall TEXT NOT NULL,
      hlc_counter INTEGER NOT NULL, supersedes_id TEXT, supersedes_deleted INTEGER,
      signature TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);

    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter); // twice = idempotent

    const cols = db.adapter
      .query<{ name: string }>('PRAGMA table_info(cm_messages)')
      .map((c) => c.name);
    for (const col of ['version', 'post_id', 'parent_id', 'branch_id', 'author_kind', 'mentions_json', 'intent']) {
      expect(cols).toContain(col);
    }
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @mylife/meerkat-app test community-core`
Expected: FAIL - `no such column: version` / missing columns.

- [ ] **Step 3: Add the 7 new columns to the `cm_messages` CREATE TABLE DDL**

In `community-core.ts`, in `COMMUNITY_DDL`, replace the `cm_messages` CREATE statement with the version below (append `version` + 6 v2 columns AFTER `updated_at`; SQLite ALTER appends at the end, so the fresh-create order must match the migrated order). Then add a post-index after the existing `cm_messages_channel` index.

```ts
  `CREATE TABLE IF NOT EXISTS cm_messages (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    body TEXT NOT NULL,
    attachments_json TEXT NOT NULL DEFAULT '[]',
    hlc_wall TEXT NOT NULL,
    hlc_counter INTEGER NOT NULL,
    supersedes_id TEXT,
    supersedes_deleted INTEGER,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    post_id TEXT,
    parent_id TEXT,
    branch_id TEXT,
    author_kind TEXT,
    mentions_json TEXT NOT NULL DEFAULT '[]',
    intent TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS cm_messages_channel
    ON cm_messages (community_id, channel_id, hlc_wall, hlc_counter, author_device_id)`,
  `CREATE INDEX IF NOT EXISTS cm_messages_post
    ON cm_messages (community_id, channel_id, post_id, branch_id, hlc_wall, hlc_counter)`,
```

- [ ] **Step 4: Add a generic ALTER helper and call it for the new columns**

Replace the private `ensureAttachmentsJsonColumn` + `ensureCommunityTables` pair with a generic `ensureColumn` helper that handles every additive column (DRY), then call it for the v2 columns. Keep `attachments_json` covered by the generic helper.

```ts
function ensureColumn(
  db: DatabaseAdapter,
  table: string,
  column: string,
  definition: string,
): void {
  const columns = db.query<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((c) => c.name === column)) return;
  db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

export function ensureCommunityTables(db: DatabaseAdapter): void {
  for (const statement of COMMUNITY_DDL) {
    db.execute(statement);
  }
  // Additive migrations for databases created before a column existed.
  ensureColumn(db, 'cm_messages', 'attachments_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cm_messages', 'version', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'cm_messages', 'post_id', 'TEXT');
  ensureColumn(db, 'cm_messages', 'parent_id', 'TEXT');
  ensureColumn(db, 'cm_messages', 'branch_id', 'TEXT');
  ensureColumn(db, 'cm_messages', 'author_kind', 'TEXT');
  ensureColumn(db, 'cm_messages', 'mentions_json', "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, 'cm_messages', 'intent', 'TEXT');
}
```

(If any other code in the file references `ensureAttachmentsJsonColumn` by name, repoint it to `ensureColumn`; grep confirms it is only called inside `ensureCommunityTables`.)

- [ ] **Step 5: Extend `ChannelMessageRow` and the row converters**

Find the `ChannelMessageRow` interface and the `channelMessageRowFromEvent` / `channelMessageEventFromRow` converters in `community-core.ts`. Add the new fields. Add a `parseMentionsJson` helper next to the existing `parseAttachmentsJson`.

```ts
export interface ChannelMessageRow {
  id: string;
  community_id: string;
  channel_id: string;
  author_device_id: string;
  body: string;
  attachments_json: string;
  hlc_wall: string;
  hlc_counter: number;
  supersedes_id: string | null;
  supersedes_deleted: number | null;
  signature: string;
  updated_at: string;
  version: number;
  post_id: string | null;
  parent_id: string | null;
  branch_id: string | null;
  author_kind: string | null;
  mentions_json: string;
  intent: string | null;
}

function parseMentionsJson(json: string): string[] {
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function channelMessageRowFromEvent(event: ChannelMessageEvent): ChannelMessageRow {
  return {
    id: event.id,
    community_id: event.communityId,
    channel_id: event.channelId,
    author_device_id: event.authorDeviceId,
    body: event.body,
    attachments_json: JSON.stringify(event.attachments ?? []),
    hlc_wall: event.hlc.wall,
    hlc_counter: event.hlc.counter,
    supersedes_id: event.supersedes?.id ?? null,
    supersedes_deleted: event.supersedes ? (event.supersedes.deleted ? 1 : 0) : null,
    signature: event.signature,
    updated_at: event.hlc.wall,
    version: event.version,
    post_id: event.postId ?? null,
    parent_id: event.parentId ?? null,
    branch_id: event.branchId ?? null,
    author_kind: event.authorKind ?? null,
    mentions_json: JSON.stringify(event.mentions ?? []),
    intent: event.intent ?? null,
  };
}

export function channelMessageEventFromRow(row: ChannelMessageRow): ChannelMessageEvent {
  const event: ChannelMessageEvent = {
    version: row.version === 2 ? 2 : 1,
    id: row.id,
    communityId: row.community_id,
    channelId: row.channel_id,
    authorDeviceId: row.author_device_id,
    body: row.body,
    attachments: parseAttachmentsJson(row.attachments_json),
    hlc: { wall: row.hlc_wall, counter: row.hlc_counter },
    supersedes: row.supersedes_id
      ? { id: row.supersedes_id, deleted: row.supersedes_deleted === 1 }
      : undefined,
    signature: row.signature,
  };
  if (row.version === 2) {
    if (row.post_id != null) event.postId = row.post_id;
    if (row.parent_id != null) event.parentId = row.parent_id;
    if (row.branch_id != null) event.branchId = row.branch_id;
    if (row.author_kind != null) event.authorKind = row.author_kind as MessageAuthorKind;
    const mentions = parseMentionsJson(row.mentions_json);
    if (mentions.length > 0) event.mentions = mentions;
    if (row.intent != null) event.intent = row.intent as ChannelMessageIntent;
  }
  return event;
}
```

Add `MessageAuthorKind` and `ChannelMessageIntent` to the existing `import type { ... } from '@mylife/sync'` line in `community-core.ts`.

- [ ] **Step 6: Extend `insertMessageRow` and `listChannelMessageEvents` SQL**

Update the `INSERT INTO cm_messages` column list + placeholders + bind array in `insertMessageRow`:

```ts
  db.execute(
    `INSERT OR IGNORE INTO cm_messages (
      id, community_id, channel_id, author_device_id, body, attachments_json,
      hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
      signature, updated_at,
      version, post_id, parent_id, branch_id, author_kind, mentions_json, intent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id, row.community_id, row.channel_id, row.author_device_id, row.body,
      row.attachments_json, row.hlc_wall, row.hlc_counter, row.supersedes_id,
      row.supersedes_deleted, row.signature, row.updated_at,
      row.version, row.post_id, row.parent_id, row.branch_id, row.author_kind,
      row.mentions_json, row.intent,
    ],
  );
```

Update the `SELECT` column list in `listChannelMessageEvents` to include the new columns:

```ts
  const rows = db.query<ChannelMessageRow>(
    `SELECT id, community_id, channel_id, author_device_id, body,
       attachments_json, hlc_wall, hlc_counter, supersedes_id, supersedes_deleted,
       signature, updated_at,
       version, post_id, parent_id, branch_id, author_kind, mentions_json, intent
     FROM cm_messages
     WHERE community_id = ? AND channel_id = ?`,
    [communityId, channelId],
  );
```

- [ ] **Step 7: Run the native tests**

Run: `pnpm --filter @mylife/meerkat-app test community-core`
Expected: PASS - the three new MK-P01 cases plus all pre-existing community-core cases.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @mylife/meerkat-app typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add "apps/meerkat/app/(root)/data/community-core.ts" "apps/meerkat/app/__tests__/community-core.test.ts"
git commit -m "$(cat <<'EOF'
feat(meerkat): persist v2 message columns on cm_messages [MK-P01]

Adds version + post_id/parent_id/branch_id/author_kind/mentions_json/intent
columns (fresh CREATE + idempotent ALTER migration), the cm_messages_post index,
a generic ensureColumn helper, and extends the row converters + insert/list SQL.
Stores version so v2 events reconstruct byte-faithfully and re-verify.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: New post tables + sync policy (native)

**Files:**
- Modify: `apps/meerkat/app/(root)/data/community-core.ts`
- Test: `apps/meerkat/app/__tests__/community-core.test.ts`

- [ ] **Step 1: Add the failing post-table + policy tests**

Append to `apps/meerkat/app/__tests__/community-core.test.ts`:

```ts
describe('community-core post tables + policy (MK-P01)', () => {
  it('creates the post tables idempotently', () => {
    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter);
    const tables = db.adapter
      .query<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((r) => r.name);
    expect(tables).toContain('cm_posts');
    expect(tables).toContain('cm_post_tags');
    expect(tables).toContain('cm_post_lifecycle');
    expect(tables).toContain('cm_post_activity');
  });

  it('replicates posts/tags/lifecycle but keeps activity local-only', () => {
    const ruleFor = (t: string) =>
      COMMUNITY_SYNC_POLICY.entityRules.find((r) => r.tableName === t);
    expect(ruleFor('cm_posts')).toEqual({
      tableName: 'cm_posts', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww',
    });
    expect(ruleFor('cm_post_tags')).toEqual({
      tableName: 'cm_post_tags', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'or_set',
    });
    expect(ruleFor('cm_post_lifecycle')).toEqual({
      tableName: 'cm_post_lifecycle', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww',
    });
    // Derived, locally-computed bump state must never replicate.
    expect(ruleFor('cm_post_activity')).toBeUndefined();
  });
});
```

Ensure `COMMUNITY_SYNC_POLICY` is imported in the test file (the existing MK-051 test already imports it).

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @mylife/meerkat-app test community-core`
Expected: FAIL - tables missing, `ruleFor('cm_posts')` undefined.

- [ ] **Step 3: Add the four post tables to `COMMUNITY_DDL`**

Insert these statements into the `COMMUNITY_DDL` array (place them after the `cm_reactions` table block, before `cm_read_state`, to keep replicating tables grouped; exact position is not load-bearing):

```ts
  // MK-P01: the immutable signed post header (the bump/addressing anchor).
  `CREATE TABLE IF NOT EXISTS cm_posts (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    author_device_id TEXT NOT NULL,
    author_kind TEXT NOT NULL DEFAULT 'human',
    post_type TEXT NOT NULL,
    title TEXT,
    created_wall TEXT NOT NULL,
    created_counter INTEGER NOT NULL,
    signature TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS cm_posts_channel
    ON cm_posts (community_id, channel_id)`,
  // MK-P01: add/remove-as-a-set post tags (or_set semantics).
  `CREATE TABLE IF NOT EXISTS cm_post_tags (
    post_id TEXT NOT NULL,
    community_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    added_by_device_id TEXT NOT NULL,
    added_wall TEXT NOT NULL,
    added_counter INTEGER NOT NULL,
    PRIMARY KEY (post_id, tag)
  )`,
  // MK-P01: post lifecycle (open/resolved) set by signed superseding events.
  `CREATE TABLE IF NOT EXISTS cm_post_lifecycle (
    post_id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    state TEXT NOT NULL,
    set_by_device_id TEXT NOT NULL,
    set_wall TEXT NOT NULL,
    set_counter INTEGER NOT NULL,
    signature TEXT NOT NULL
  )`,
  // MK-P01: LOCAL-ONLY derived bump/unread state. Omitted from COMMUNITY_SYNC_POLICY
  // by design (mirrors cm_feed_cursor); recomputed from verified child events, never synced.
  `CREATE TABLE IF NOT EXISTS cm_post_activity (
    post_id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    bumped_at_wall TEXT NOT NULL,
    bumped_at_counter INTEGER NOT NULL,
    reply_count INTEGER NOT NULL DEFAULT 0,
    last_author_device_id TEXT,
    unread_count INTEGER NOT NULL DEFAULT 0
  )`,
```

- [ ] **Step 4: Register the replicating post tables in `COMMUNITY_SYNC_POLICY`**

Add three entries to `COMMUNITY_SYNC_POLICY.entityRules` (do NOT add `cm_post_activity` - local-only by omission). Place them after the `cm_reactions` entry:

```ts
    {
      tableName: 'cm_posts',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww', // immutable signed header; degenerate LWW safety net (never contends)
    },
    {
      tableName: 'cm_post_tags',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'or_set',
    },
    {
      tableName: 'cm_post_lifecycle',
      defaultScope: 'shared_workspace',
      maxScope: 'shared_workspace',
      conflictStrategy: 'lww', // latest signed superseding event wins (deterministic by HLC in app logic)
    },
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mylife/meerkat-app test community-core`
Expected: PASS (new post-table + policy cases plus all prior cases).

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @mylife/meerkat-app typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "apps/meerkat/app/(root)/data/community-core.ts" "apps/meerkat/app/__tests__/community-core.test.ts"
git commit -m "$(cat <<'EOF'
feat(meerkat): add cm_posts/cm_post_tags/cm_post_lifecycle/cm_post_activity [MK-P01]

Posts/tags/lifecycle register in COMMUNITY_SYNC_POLICY (lww/or_set/lww); the
derived cm_post_activity bump table is LOCAL-ONLY by omission (mirrors cm_feed_cursor),
so derived state never replicates and the transport-honesty boundary holds.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Attention columns on `cm_read_state` (native)

**Files:**
- Modify: `apps/meerkat/app/(root)/data/community-core.ts`
- Test: `apps/meerkat/app/__tests__/community-core.test.ts`

> Scope note: MK-P01 adds the attention COLUMNS only (additive, nullable, no behavior). Per-post/per-branch read semantics and the follow/mute/snooze/importance behavior are finalized in Phase 2.5/4. Existing channel-level read-state rows are unaffected (their new columns are NULL).

- [ ] **Step 1: Add the failing column test**

Append to `apps/meerkat/app/__tests__/community-core.test.ts`:

```ts
describe('community-core read-state attention columns (MK-P01)', () => {
  it('adds attention columns to cm_read_state idempotently', () => {
    ensureCommunityTables(db.adapter);
    ensureCommunityTables(db.adapter);
    const cols = db.adapter
      .query<{ name: string }>('PRAGMA table_info(cm_read_state)')
      .map((c) => c.name);
    for (const col of ['post_id', 'branch_id', 'follow', 'mute', 'snooze_until', 'importance']) {
      expect(cols).toContain(col);
    }
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @mylife/meerkat-app test community-core`
Expected: FAIL - columns missing.

- [ ] **Step 3: Add the columns to the `cm_read_state` CREATE DDL**

Replace the `cm_read_state` CREATE statement in `COMMUNITY_DDL` with (append six nullable columns after `updated_at`):

```ts
  `CREATE TABLE IF NOT EXISTS cm_read_state (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    last_read_wall TEXT,
    last_read_counter INTEGER,
    updated_at TEXT NOT NULL,
    post_id TEXT,
    branch_id TEXT,
    follow INTEGER,
    mute INTEGER,
    snooze_until TEXT,
    importance INTEGER
  )`,
```

- [ ] **Step 4: Add the ALTER migrations in `ensureCommunityTables`**

Append after the `cm_messages` `ensureColumn` calls from Task 2:

```ts
  ensureColumn(db, 'cm_read_state', 'post_id', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'branch_id', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'follow', 'INTEGER');
  ensureColumn(db, 'cm_read_state', 'mute', 'INTEGER');
  ensureColumn(db, 'cm_read_state', 'snooze_until', 'TEXT');
  ensureColumn(db, 'cm_read_state', 'importance', 'INTEGER');
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @mylife/meerkat-app test community-core`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @mylife/meerkat-app typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "apps/meerkat/app/(root)/data/community-core.ts" "apps/meerkat/app/__tests__/community-core.test.ts"
git commit -m "$(cat <<'EOF'
feat(meerkat): add cm_read_state attention columns (schema only) [MK-P01]

Additive nullable post_id/branch_id/follow/mute/snooze_until/importance columns;
no behavior yet (semantics land in the attention-inbox plans). cm_read_state stays
personal_replica and never crosses a shared session.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Web twin parity mirror + lockstep test

**Files:**
- Modify: `apps/meerkat-web/src/lib/schema.ts`
- Modify: `apps/meerkat-web/src/lib/meerkat-data.ts`
- Test (create): `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts`

> The parity script does not compare native vs web. This task hand-mirrors every native change from Tasks 2-4 and adds an fs-based lockstep test so future drift fails loudly.

- [ ] **Step 1: Create the failing fs-based lockstep test**

Create `apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url));
const read = (p: string) => readFileSync(repoRoot + p, 'utf8');

const webSchema = read('apps/meerkat-web/src/lib/schema.ts');
const webData = read('apps/meerkat-web/src/lib/meerkat-data.ts');

describe('web cm_ schema mirrors native (MK-P01 parity)', () => {
  it('mirrors the new cm_messages columns in the web DDL', () => {
    for (const col of ['version INTEGER NOT NULL DEFAULT 1', 'post_id TEXT', 'parent_id TEXT', 'branch_id TEXT', 'author_kind TEXT', "mentions_json TEXT NOT NULL DEFAULT '[]'", 'intent TEXT']) {
      expect(webSchema).toContain(col);
    }
  });

  it('mirrors the four post tables in the web DDL', () => {
    for (const tbl of ['cm_posts', 'cm_post_tags', 'cm_post_lifecycle', 'cm_post_activity']) {
      expect(webSchema).toContain(`CREATE TABLE IF NOT EXISTS ${tbl}`);
    }
  });

  it('mirrors the cm_read_state attention columns in the web DDL', () => {
    for (const col of ['snooze_until TEXT', 'importance INTEGER']) {
      expect(webSchema).toContain(col);
    }
  });

  it('mirrors the v2 fields in the web ChannelMessageRow + converters', () => {
    for (const field of ['version:', 'post_id:', 'parent_id:', 'branch_id:', 'author_kind:', 'mentions_json:', 'intent:']) {
      expect(webData).toContain(field);
    }
  });
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `pnpm --filter @mylife/meerkat-web test post-schema-v2-parity`
Expected: FAIL - web files not yet mirrored.

- [ ] **Step 3: Mirror the DDL in `schema.ts`**

In `apps/meerkat-web/src/lib/schema.ts`, apply the EXACT same edits as Tasks 2-4 to the private `COMMUNITY_DDL` array (the `cm_messages` CREATE gains `version` + 6 columns and the `cm_messages_post` index; add the four post tables + `cm_posts_channel` index; the `cm_read_state` CREATE gains the six attention columns). Then update the private `ensureCommunityTables` to use a generic `ensureColumn` helper and call it for every new column - paste the same `ensureColumn` body and the same call list from Task 2 Step 4 and Task 4 Step 4. (The web `ensureCommunityTables` currently calls `ensureAttachmentsJsonColumn`; replace it with `ensureColumn`, exactly as native.)

- [ ] **Step 4: Mirror the converters in `meerkat-data.ts`**

In `apps/meerkat-web/src/lib/meerkat-data.ts`, apply the EXACT same edits as Task 2 Steps 5-6 to the web `ChannelMessageRow` interface, `channelMessageRowFromEvent`, `channelMessageEventFromRow` (note: the web version currently hardcodes `version: 1` - change it to `row.version === 2 ? 2 : 1` and add the v2-field reconstruction block), the `parseMentionsJson` helper, the `insertMessageRow` INSERT column list + binds, and the `listChannelMessageEvents` SELECT column list. Add `MessageAuthorKind`, `ChannelMessageIntent` to the existing `@mylife/sync` type import in this file.

- [ ] **Step 5: Run the parity test + the full web suite (behavioral regression guard)**

Run:
```bash
pnpm --filter @mylife/meerkat-web test post-schema-v2-parity
pnpm --filter @mylife/meerkat-web test
```
Expected: PASS - the new parity test plus the existing web suite (`web-channel-edit-delete-e2e`, `web-unread-readstate`, `web-node-relay-e2e`, etc.) all green, proving the web converters still round-trip and native↔web relay sync is intact.

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @mylife/meerkat-web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/meerkat-web/src/lib/schema.ts apps/meerkat-web/src/lib/meerkat-data.ts apps/meerkat-web/src/lib/__tests__/post-schema-v2-parity.test.ts
git commit -m "$(cat <<'EOF'
feat(meerkat-web): mirror v2 message columns + post tables in web twin [MK-P01]

Hand-mirrors the native cm_ schema/converter changes into schema.ts + meerkat-data.ts
(no script enforces this) and adds an fs-based native<->web lockstep test so future
drift fails loudly.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Run all three package test suites**

```bash
pnpm --filter @mylife/sync test
pnpm --filter @mylife/meerkat-app test
pnpm --filter @mylife/meerkat-web test
```
Expected: all PASS.

- [ ] **Step 2: Typecheck all three packages**

```bash
pnpm --filter @mylife/sync typecheck
pnpm --filter @mylife/meerkat-app typecheck
pnpm --filter @mylife/meerkat-web typecheck
```
Expected: all PASS.

- [ ] **Step 3: Run the changed-function quality gate**

Run: `pnpm gate:function:changed`
Expected: PASS. (This is also what `.husky/pre-commit` runs on `--staged`. Because `packages/sync` changed, the gate also typechecks `@mylife/mobile` + `@mylife/web` - confirm those pass; if they flag a `ChannelMessageEvent` type break, fix it before proceeding.)

- [ ] **Step 4: Run the Meerkat parity gate**

Run: `pnpm check:meerkat-parity`
Expected: PASS (file-exists + native substring checks; MK-P01 adds no new required files, so this should remain green).

- [ ] **Step 5: Confirm honesty boundary**

Manually confirm: no UI was added, no derived count is displayed, `cm_post_activity` is created empty and never written in this plan, and no copy claims presence/delivery. State this explicitly in the PR description.

---

## Verification matrix (spec → task)

| MK-P01 spec requirement | Task |
|---|---|
| v2 `ChannelMessageEvent` (postId/parentId/branchId/authorKind/mentions/intent), v1-compat decoder | Task 1 |
| Append-only canonical, v1 byte-stable, anti-smuggle verify | Task 1 |
| Immutable `cm_posts` header | Task 3 |
| `cm_post_tags` (or_set) separate table | Task 3 |
| `cm_post_lifecycle` (signed-event) separate table | Task 3 |
| `cm_post_activity` LOCAL-ONLY (personal_replica, never replicates) | Task 3 (omitted from policy) |
| Extend `cm_messages` columns + index | Task 2 |
| Extend `cm_read_state` attention columns | Task 4 |
| Per-table policy/prefix (per-table conflict strategies) | Task 3 (policy); prefix needs no change |
| Web twin parity | Task 5 |
| `check-meerkat-parity` green, zero faked anything, zero UX change | Task 6 |

## Self-review notes (consistency)

- Symbol names are consistent across tasks: `createChannelMessageV2`, `ensureColumn`, `MessageAuthorKind`, `ChannelMessageIntent`, `parseMentionsJson`, `cm_post_activity` (local-only), `cm_posts`/`cm_post_tags`/`cm_post_lifecycle` (replicated).
- `version` column is required by the byte-faithful-reconstruction invariant (Invariant 4) and is set in both row converters and the INSERT.
- Native and web converter edits are identical except web's pre-existing hardcoded `version: 1` literal, which Task 5 Step 4 explicitly changes.
- No task leaves the build red: Task 1 only adds optional fields (native/web compile unchanged); Tasks 2-4 are additive native schema with their own tests; Task 5 mirrors web; Task 6 is verification.
