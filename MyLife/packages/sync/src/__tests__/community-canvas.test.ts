/**
 * Plan 56 C1: the Canvas signed-event vocabulary. Proves, per kind:
 *   - create/verify round trips and the authority matrix (commons/topper/
 *     pixel_board bind to the OWNER; profile binds to its subject member;
 *     post/page bind to members; viewers and strangers never verify);
 *   - tombstone discipline (no payload rides a tombstone);
 *   - tamper rejection across every signed field;
 *   - the deterministic per-node merge (higher version, then LOWER nonce,
 *     then updatedAt/signature, identical from both argument orders);
 *   - stroke payload XOR erase, and erase authority (author or owner/admin);
 *   - mark kind/shape matrix (increment/vote/note);
 *   - row serde totality (malformed rows -> null);
 *   - apply-time validators: forgery dies before INSERT, raw DELETE rejected,
 *     unknown community/canvas fails closed, layer role floors + the
 *     member-build toggle, per-kind node caps, stale-version rejection,
 *     author-mismatch rejection with the curator_remove exception, the
 *     120/member/hour rate gate, and the pages-per-member cap;
 *   - the FROZEN fixtures keep verifying (canonical-bytes lock; never
 *     regenerate to make this pass).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createCommunity, upsertCommunity, type SignedCommunityDescriptor } from '../protocol/community';
import {
  COMMUNITY_CANVAS_MARKS_TABLE,
  COMMUNITY_CANVAS_NODES_TABLE,
  COMMUNITY_CANVAS_STROKES_TABLE,
  COMMUNITY_CANVAS_TABLE,
  SYNC_CANVAS_NODE_CAPS,
  canvasEventFromRow,
  canvasEventToRow,
  canvasMarkEventFromRow,
  canvasMarkEventToRow,
  canvasNodeEventFromRow,
  canvasNodeEventToRow,
  canvasStrokeEventToRow,
  createCanvasEvent,
  createCanvasMarkEvent,
  createCanvasNodeEvent,
  createCanvasStrokeEvent,
  mergeCanvasNodeEvents,
  resolveCanvasStrokes,
  validateCanvasMarkRow,
  validateCanvasNodeRow,
  validateCanvasRow,
  validateCanvasStrokeRow,
  verifyCanvasEvent,
  verifyCanvasMarkEvent,
  verifyCanvasNodeEvent,
  verifyCanvasStrokeEvent,
  type CommunityCanvasNodeEvent,
} from '../protocol/community-canvas';
import { validateSignedInboundRow, isSignedRowTable } from '../protocol/inbound-row-validators';
import canvasFixture from './fixtures/legacy-community-canvas-events.json';

const CANVAS_TEST_DDL = [
  `CREATE TABLE IF NOT EXISTS cm_canvas (
    id TEXT PRIMARY KEY, community_id TEXT NOT NULL, kind TEXT NOT NULL,
    subject_id TEXT NOT NULL, policy_json TEXT, revision INTEGER NOT NULL,
    tombstone INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL, signature TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cm_canvas_nodes (
    id TEXT PRIMARY KEY, canvas_id TEXT NOT NULL, community_id TEXT NOT NULL,
    author_device TEXT NOT NULL, node_type TEXT NOT NULL, schema_version INTEGER NOT NULL,
    props_json TEXT NOT NULL, layer TEXT NOT NULL,
    x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL,
    rotation REAL NOT NULL, z INTEGER NOT NULL, parent_id TEXT,
    node_version INTEGER NOT NULL, version_nonce INTEGER NOT NULL,
    asset_cid TEXT, asset_key_epoch INTEGER, asset_wrapped_key TEXT, asset_manifest_json TEXT,
    tombstone INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    signed_by TEXT NOT NULL, signature TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cm_canvas_strokes (
    id TEXT PRIMARY KEY, canvas_id TEXT NOT NULL, community_id TEXT NOT NULL,
    author_device TEXT NOT NULL, stroke_json TEXT, erases_id TEXT,
    created_at TEXT NOT NULL, signed_by TEXT NOT NULL, signature TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS cm_canvas_counters (
    id TEXT PRIMARY KEY, canvas_id TEXT NOT NULL, community_id TEXT NOT NULL,
    node_id TEXT NOT NULL, kind TEXT NOT NULL, option INTEGER, note TEXT,
    author_device TEXT NOT NULL, created_at TEXT NOT NULL,
    signed_by TEXT NOT NULL, signature TEXT NOT NULL
  )`,
];

const CANVAS_ID = 'a'.repeat(32);
const NODE_ID = 'b'.repeat(32);
const PROPS = JSON.stringify({ text: 'hello' });

const owner = generateDeviceIdentity('Owner');
const member = generateDeviceIdentity('Member');
const admin = generateDeviceIdentity('Admin');
const stranger = generateDeviceIdentity('Stranger');

function makeCommunity(): SignedCommunityDescriptor {
  return createCommunity(owner, {
    name: 'Burrow',
    channels: [{ id: 'general', name: 'general' }],
    members: [
      { deviceId: member.publicKey, role: 'member' },
      { deviceId: admin.publicKey, role: 'admin' },
    ],
  });
}

const signed = makeCommunity();
const d = signed.descriptor;
const communityId = d.communityId;

function ownerCanvas(kind: 'commons' | 'channel_topper' | 'pixel_board' = 'commons', policyJson?: string | null) {
  return createCanvasEvent(owner, {
    id: CANVAS_ID, communityId, kind, subjectId: 'general', revision: 1, policyJson,
  });
}

describe('canvas registry events (cm_canvas)', () => {
  it('owner-signed community kinds verify; member-signed ones never do', () => {
    expect(verifyCanvasEvent(ownerCanvas(), d)).toBe(true);
    const forged = createCanvasEvent(member, { id: CANVAS_ID, communityId, kind: 'commons', subjectId: 'general', revision: 2 });
    expect(verifyCanvasEvent(forged, d)).toBe(false);
  });

  it('a profile canvas binds to its subject member', () => {
    const mine = createCanvasEvent(member, { id: CANVAS_ID, communityId, kind: 'profile', subjectId: member.publicKey, revision: 1 });
    expect(verifyCanvasEvent(mine, d)).toBe(true);
    const spoofed = createCanvasEvent(member, { id: CANVAS_ID, communityId, kind: 'profile', subjectId: admin.publicKey, revision: 1 });
    expect(verifyCanvasEvent(spoofed, d)).toBe(false);
  });

  it('a page canvas verifies from any member, never a stranger', () => {
    const page = createCanvasEvent(member, { id: CANVAS_ID, communityId, kind: 'page', subjectId: CANVAS_ID, revision: 1 });
    expect(verifyCanvasEvent(page, d)).toBe(true);
    const foreign = createCanvasEvent(stranger, { id: CANVAS_ID, communityId, kind: 'page', subjectId: CANVAS_ID, revision: 1 });
    expect(verifyCanvasEvent(foreign, d)).toBe(false);
  });

  it('tombstones carry no policy; tampering any field fails', () => {
    const tomb = createCanvasEvent(owner, { id: CANVAS_ID, communityId, kind: 'commons', subjectId: 'general', revision: 2, tombstone: true });
    expect(tomb.policyJson).toBeNull();
    expect(verifyCanvasEvent(tomb, d)).toBe(true);
    const event = ownerCanvas();
    for (const patch of [
      { revision: 9 }, { kind: 'page' as const }, { subjectId: 'other' },
      { policyJson: '{"x":1}' }, { updatedAt: '2030-01-01T00:00:00.000Z' },
    ]) {
      expect(verifyCanvasEvent({ ...event, ...patch }, d)).toBe(false);
    }
  });

  it('row serde is total', () => {
    const event = ownerCanvas('commons', JSON.stringify({ layers: { background: 'owner', structure: 'curator', open: 'member' }, memberBuild: true, layout: 'free' }));
    expect(canvasEventFromRow(canvasEventToRow(event))).toEqual(event);
    expect(canvasEventFromRow({ ...canvasEventToRow(event), revision: 'x' })).toBeNull();
    expect(canvasEventFromRow({ ...canvasEventToRow(event), kind: 'mystery' })).toBeNull();
  });
});

describe('node events (cm_canvas_nodes)', () => {
  const node = () => createCanvasNodeEvent(member, {
    id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
    propsJson: PROPS, layer: 'open', x: 10, y: 10, w: 100, h: 40, nodeVersion: 1, versionNonce: 7,
  });

  it('round-trips, binds author to signer, rejects tampering', () => {
    const event = node();
    expect(verifyCanvasNodeEvent(event)).toBe(true);
    expect(verifyCanvasNodeEvent({ ...event, authorDevice: admin.publicKey })).toBe(false);
    for (const patch of [
      { x: 999 }, { propsJson: JSON.stringify({ text: 'evil' }) }, { layer: 'background' as const },
      { nodeVersion: 2 }, { versionNonce: 8 }, { tombstone: true }, { parentId: 'c'.repeat(32) },
    ]) {
      expect(verifyCanvasNodeEvent({ ...event, ...patch })).toBe(false);
    }
    expect(canvasNodeEventFromRow(canvasNodeEventToRow(event))).toEqual(event);
    // Partial asset columns are malformed (all-or-nothing).
    expect(canvasNodeEventFromRow({ ...canvasNodeEventToRow(event), asset_cid: 'ab'.repeat(16) })).toBeNull();
  });

  it('geometry is clamped at create (F2)', () => {
    expect(() => createCanvasNodeEvent(member, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 10, y: 10, w: 10_000_000, h: 40, nodeVersion: 1, versionNonce: 0,
    })).toThrow(/out of bounds/);
  });

  it('merge is deterministic: higher version, then LOWER nonce, order-independent', () => {
    const base = node();
    const v2 = { ...base, nodeVersion: 2, versionNonce: 50 } as CommunityCanvasNodeEvent;
    const v2b = { ...base, nodeVersion: 2, versionNonce: 10 } as CommunityCanvasNodeEvent;
    expect(mergeCanvasNodeEvents(base, v2)).toBe(v2);
    expect(mergeCanvasNodeEvents(v2, base)).toBe(v2);
    expect(mergeCanvasNodeEvents(v2, v2b)).toBe(v2b);
    expect(mergeCanvasNodeEvents(v2b, v2)).toBe(v2b);
  });
});

describe('stroke events (cm_canvas_strokes)', () => {
  const strokeJson = JSON.stringify({ points: [[0, 0], [5, 5]], brush: 'pen', colorToken: 'accent', width: 2 });

  it('carries exactly one of payload or erase target', () => {
    const stroke = createCanvasStrokeEvent(member, { canvasId: CANVAS_ID, communityId, strokeJson });
    expect(verifyCanvasStrokeEvent(stroke)).toBe(true);
    expect(() => createCanvasStrokeEvent(member, { canvasId: CANVAS_ID, communityId })).toThrow(/exactly one/);
    expect(() => createCanvasStrokeEvent(member, { canvasId: CANVAS_ID, communityId, strokeJson, erasesId: 'd'.repeat(32) })).toThrow(/exactly one/);
  });

  it('resolve drops strokes erased by the author or an owner/admin, never a peer member', () => {
    const stroke = createCanvasStrokeEvent(member, { canvasId: CANVAS_ID, communityId, strokeJson });
    const other = generateDeviceIdentity('Other Member');
    const signed2 = createCommunity(owner, {
      name: 'Burrow2',
      channels: [{ id: 'general', name: 'general' }],
      members: [
        { deviceId: member.publicKey, role: 'member' },
        { deviceId: other.publicKey, role: 'member' },
        { deviceId: admin.publicKey, role: 'admin' },
      ],
    });
    const eraseBySelf = createCanvasStrokeEvent(member, { canvasId: CANVAS_ID, communityId, erasesId: stroke.id });
    const eraseByAdmin = createCanvasStrokeEvent(admin, { canvasId: CANVAS_ID, communityId, erasesId: stroke.id });
    const eraseByPeer = createCanvasStrokeEvent(other, { canvasId: CANVAS_ID, communityId, erasesId: stroke.id });
    expect(resolveCanvasStrokes([stroke, eraseByPeer], signed2.descriptor).map((s) => s.id)).toEqual([stroke.id]);
    expect(resolveCanvasStrokes([stroke, eraseBySelf], signed2.descriptor)).toEqual([]);
    expect(resolveCanvasStrokes([stroke, eraseByAdmin], signed2.descriptor)).toEqual([]);
  });
});

describe('mark events (cm_canvas_counters)', () => {
  it('enforces the kind/shape matrix', () => {
    const inc = createCanvasMarkEvent(member, { canvasId: CANVAS_ID, communityId, nodeId: NODE_ID, kind: 'increment' });
    const vote = createCanvasMarkEvent(member, { canvasId: CANVAS_ID, communityId, nodeId: NODE_ID, kind: 'vote', option: 2 });
    const note = createCanvasMarkEvent(member, { canvasId: CANVAS_ID, communityId, nodeId: NODE_ID, kind: 'note', note: 'lovely burrow' });
    for (const event of [inc, vote, note]) expect(verifyCanvasMarkEvent(event)).toBe(true);
    expect(() => createCanvasMarkEvent(member, { canvasId: CANVAS_ID, communityId, nodeId: NODE_ID, kind: 'vote' })).toThrow();
    expect(() => createCanvasMarkEvent(member, { canvasId: CANVAS_ID, communityId, nodeId: NODE_ID, kind: 'note', note: 'x'.repeat(600) })).toThrow();
    expect(verifyCanvasMarkEvent({ ...vote, option: 99 })).toBe(false);
    expect(canvasMarkEventFromRow(canvasMarkEventToRow(note))).toEqual(note);
  });
});

describe('apply-time validators', () => {
  let testDb: InMemoryTestDatabase | null = null;

  afterEach(() => { testDb?.close(); testDb = null; });

  function setup() {
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    createSyncTables(db);
    for (const ddl of CANVAS_TEST_DDL) db.execute(ddl);
    upsertCommunity(db, signed, owner.publicKey);
    return db;
  }

  function insertCanvas(db: ReturnType<typeof setup>, policyJson?: string | null) {
    const canvas = ownerCanvas('commons', policyJson);
    const row = canvasEventToRow(canvas);
    db.execute(
      `INSERT INTO cm_canvas (id, community_id, kind, subject_id, policy_json, revision, tombstone, updated_at, signed_by, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.community_id, row.kind, row.subject_id, row.policy_json, row.revision, row.tombstone, row.updated_at, row.signed_by, row.signature],
    );
    return canvas;
  }

  it('all four canvas tables are signature-gated and reject raw DELETE', () => {
    const db = setup();
    for (const table of [COMMUNITY_CANVAS_TABLE, COMMUNITY_CANVAS_NODES_TABLE, COMMUNITY_CANVAS_STROKES_TABLE, COMMUNITY_CANVAS_MARKS_TABLE]) {
      expect(isSignedRowTable(table)).toBe(true);
      expect(validateSignedInboundRow(db, { table, rowId: 'x', operation: 'DELETE', data: null }))
        .toEqual({ ok: false, reason: 'signed_row_delete_rejected' });
    }
  });

  it('accepts a real owner canvas; rejects a member-forged commons before insert', () => {
    const db = setup();
    const real = ownerCanvas();
    expect(validateCanvasRow(db, { table: COMMUNITY_CANVAS_TABLE, rowId: real.id, operation: 'INSERT', data: canvasEventToRow(real) }))
      .toEqual({ ok: true });
    const forged = createCanvasEvent(member, { id: 'f'.repeat(32), communityId, kind: 'commons', subjectId: 'general', revision: 1 });
    expect(validateCanvasRow(db, { table: COMMUNITY_CANVAS_TABLE, rowId: forged.id, operation: 'INSERT', data: canvasEventToRow(forged) }))
      .toEqual({ ok: false, reason: 'canvas_signature_invalid' });
  });

  it('node inserts honor layer floors and the member-build toggle', () => {
    const db = setup();
    insertCanvas(db, JSON.stringify({ layers: { background: 'owner', structure: 'curator', open: 'member' }, memberBuild: true, layout: 'free' }));
    const openNode = createCanvasNodeEvent(member, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 0, y: 0, w: 10, h: 10, nodeVersion: 1, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: openNode.id, operation: 'INSERT', data: canvasNodeEventToRow(openNode) }))
      .toEqual({ ok: true });
    const bgNode = createCanvasNodeEvent(member, {
      id: 'c'.repeat(32), canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'background', x: 0, y: 0, w: 10, h: 10, nodeVersion: 1, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: bgNode.id, operation: 'INSERT', data: canvasNodeEventToRow(bgNode) }))
      .toEqual({ ok: false, reason: 'canvas_node_layer_denied' });
  });

  it('member-build OFF closes the open layer to members (admins still build)', () => {
    const db = setup();
    insertCanvas(db, JSON.stringify({ layers: { background: 'owner', structure: 'curator', open: 'member' }, memberBuild: false, layout: 'free' }));
    const memberNode = createCanvasNodeEvent(member, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 0, y: 0, w: 10, h: 10, nodeVersion: 1, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: memberNode.id, operation: 'INSERT', data: canvasNodeEventToRow(memberNode) }))
      .toEqual({ ok: false, reason: 'canvas_node_member_build_off' });
    const adminNode = createCanvasNodeEvent(admin, {
      id: 'c'.repeat(32), canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 0, y: 0, w: 10, h: 10, nodeVersion: 1, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: adminNode.id, operation: 'INSERT', data: canvasNodeEventToRow(adminNode) }))
      .toEqual({ ok: true });
  });

  it('edits: only the author (stale versions rejected); curator tombstone allowed on open layer', () => {
    const db = setup();
    insertCanvas(db);
    const original = createCanvasNodeEvent(member, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 0, y: 0, w: 10, h: 10, nodeVersion: 3, versionNonce: 0,
    });
    const row = canvasNodeEventToRow(original);
    db.execute(
      `INSERT INTO cm_canvas_nodes (id, canvas_id, community_id, author_device, node_type, schema_version, props_json, layer,
        x, y, w, h, rotation, z, parent_id, node_version, version_nonce, asset_cid, asset_key_epoch, asset_wrapped_key,
        asset_manifest_json, tombstone, created_at, updated_at, signed_by, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.canvas_id, row.community_id, row.author_device, row.node_type, row.schema_version, row.props_json, row.layer,
        row.x, row.y, row.w, row.h, row.rotation, row.z, row.parent_id, row.node_version, row.version_nonce,
        row.asset_cid, row.asset_key_epoch, row.asset_wrapped_key, row.asset_manifest_json, row.tombstone,
        row.created_at, row.updated_at, row.signed_by, row.signature],
    );
    // A peer admin EDITING the node is rejected (author mismatch).
    const adminEdit = createCanvasNodeEvent(admin, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: JSON.stringify({ text: 'taken over' }), layer: 'open', x: 0, y: 0, w: 10, h: 10, nodeVersion: 4, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: NODE_ID, operation: 'UPDATE', data: canvasNodeEventToRow(adminEdit) }))
      .toEqual({ ok: false, reason: 'canvas_node_author_mismatch' });
    // A curator TOMBSTONE on the open layer is accepted (reversible moderation).
    const curatorRemove = createCanvasNodeEvent(admin, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 0, y: 0, w: 10, h: 10, nodeVersion: 4, versionNonce: 0, tombstone: true,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: NODE_ID, operation: 'UPDATE', data: canvasNodeEventToRow(curatorRemove) }))
      .toEqual({ ok: true });
    // The author's STALE version is rejected (LWW discipline).
    const stale = createCanvasNodeEvent(member, {
      id: NODE_ID, canvasId: CANVAS_ID, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'open', x: 5, y: 5, w: 10, h: 10, nodeVersion: 2, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: NODE_ID, operation: 'UPDATE', data: canvasNodeEventToRow(stale) }))
      .toEqual({ ok: false, reason: 'canvas_node_stale_version' });
  });

  it('enforces the per-kind node cap at apply time', () => {
    const db = setup();
    // A topper caps at 200; simulate a full topper cheaply with a direct count
    // seed: insert a canvas of kind channel_topper and 200 node rows.
    const topper = createCanvasEvent(owner, { id: 'e'.repeat(32), communityId, kind: 'channel_topper', subjectId: 'general', revision: 1 });
    const trow = canvasEventToRow(topper);
    db.execute(
      `INSERT INTO cm_canvas (id, community_id, kind, subject_id, policy_json, revision, tombstone, updated_at, signed_by, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [trow.id, trow.community_id, trow.kind, trow.subject_id, trow.policy_json, trow.revision, trow.tombstone, trow.updated_at, trow.signed_by, trow.signature],
    );
    expect(SYNC_CANVAS_NODE_CAPS.channel_topper).toBe(200);
    for (let i = 0; i < 200; i += 1) {
      db.execute(
        `INSERT INTO cm_canvas_nodes (id, canvas_id, community_id, author_device, node_type, schema_version, props_json, layer,
          x, y, w, h, rotation, z, parent_id, node_version, version_nonce, tombstone, created_at, updated_at, signed_by, signature)
         VALUES (?, ?, ?, ?, 'text', 1, '{}', 'structure', 0, 0, 1, 1, 0, 0, NULL, 1, 0, 0, '2026-01-01', '2026-01-01', ?, 'sig')`,
        [`${i.toString(16).padStart(32, '0')}`, topper.id, communityId, owner.publicKey, owner.publicKey],
      );
    }
    const overflow = createCanvasNodeEvent(admin, {
      id: 'd'.repeat(32), canvasId: topper.id, communityId, nodeType: 'text', schemaVersion: 1,
      propsJson: PROPS, layer: 'structure', x: 0, y: 0, w: 10, h: 10, nodeVersion: 1, versionNonce: 0,
    });
    expect(validateCanvasNodeRow(db, { table: COMMUNITY_CANVAS_NODES_TABLE, rowId: overflow.id, operation: 'INSERT', data: canvasNodeEventToRow(overflow) }))
      .toEqual({ ok: false, reason: 'canvas_node_cap' });
  });

  it('rate-limits canvas events at 120/member/hour', () => {
    const db = setup();
    insertCanvas(db);
    const now = new Date().toISOString();
    for (let i = 0; i < 120; i += 1) {
      db.execute(
        `INSERT INTO cm_canvas_strokes (id, canvas_id, community_id, author_device, stroke_json, erases_id, created_at, signed_by, signature)
         VALUES (?, ?, ?, ?, '{}', NULL, ?, ?, 'sig')`,
        [`${i.toString(16).padStart(32, '0')}`, CANVAS_ID, communityId, member.publicKey, now, member.publicKey],
      );
    }
    const mark = createCanvasMarkEvent(member, { canvasId: CANVAS_ID, communityId, nodeId: NODE_ID, kind: 'increment' });
    expect(validateCanvasMarkRow(db, { table: COMMUNITY_CANVAS_MARKS_TABLE, rowId: mark.id, operation: 'INSERT', data: canvasMarkEventToRow(mark) }))
      .toEqual({ ok: false, reason: 'canvas_rate_limited' });
  });

  it('caps pages per member at 20', () => {
    const db = setup();
    for (let i = 0; i < 20; i += 1) {
      const id = `${i.toString(16).padStart(32, '0')}`;
      const page = createCanvasEvent(member, { id, communityId, kind: 'page', subjectId: id, revision: 1 });
      const row = canvasEventToRow(page);
      db.execute(
        `INSERT INTO cm_canvas (id, community_id, kind, subject_id, policy_json, revision, tombstone, updated_at, signed_by, signature)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.community_id, row.kind, row.subject_id, row.policy_json, row.revision, row.tombstone, row.updated_at, row.signed_by, row.signature],
      );
    }
    const extra = createCanvasEvent(member, { id: 'f'.repeat(32), communityId, kind: 'page', subjectId: 'f'.repeat(32), revision: 1 });
    expect(validateCanvasRow(db, { table: COMMUNITY_CANVAS_TABLE, rowId: extra.id, operation: 'INSERT', data: canvasEventToRow(extra) }))
      .toEqual({ ok: false, reason: 'canvas_pages_cap' });
  });

  it('a stranger-authored stroke/mark fails closed; unknown community fails closed', () => {
    const db = setup();
    const strokeJson = JSON.stringify({ points: [[0, 0], [1, 1]], brush: 'pen', colorToken: 'text', width: 1 });
    const foreign = createCanvasStrokeEvent(stranger, { canvasId: CANVAS_ID, communityId, strokeJson });
    expect(validateCanvasStrokeRow(db, { table: COMMUNITY_CANVAS_STROKES_TABLE, rowId: foreign.id, operation: 'INSERT', data: canvasStrokeEventToRow(foreign) }))
      .toEqual({ ok: false, reason: 'canvas_stroke_not_member' });
    const elsewhere = createCanvasStrokeEvent(member, { canvasId: CANVAS_ID, communityId: 'not-held-here', strokeJson });
    expect(validateCanvasStrokeRow(db, { table: COMMUNITY_CANVAS_STROKES_TABLE, rowId: elsewhere.id, operation: 'INSERT', data: canvasStrokeEventToRow(elsewhere) }))
      .toEqual({ ok: false, reason: 'canvas_stroke_community_unknown' });
  });
});

describe('frozen fixtures (canonical-bytes lock)', () => {
  // Generated 2026-08-29 and committed. If ANY canonical form changes, these
  // signatures stop verifying and this fails loudly: that is the point. Never
  // regenerate the fixture to make it pass; a canonical change breaks every
  // already-signed canvas in the field.
  it('the frozen canvas/node/stroke/mark events still verify byte-for-byte', () => {
    const f = canvasFixture as {
      descriptor: SignedCommunityDescriptor;
      canvas: Parameters<typeof verifyCanvasEvent>[0];
      node: Parameters<typeof verifyCanvasNodeEvent>[0];
      stroke: Parameters<typeof verifyCanvasStrokeEvent>[0];
      mark: Parameters<typeof verifyCanvasMarkEvent>[0];
    };
    expect(verifyCanvasEvent(f.canvas, f.descriptor.descriptor)).toBe(true);
    expect(verifyCanvasNodeEvent(f.node)).toBe(true);
    expect(verifyCanvasStrokeEvent(f.stroke)).toBe(true);
    expect(verifyCanvasMarkEvent(f.mark)).toBe(true);
    expect(verifyCanvasEvent({ ...f.canvas, revision: 99 }, f.descriptor.descriptor)).toBe(false);
    expect(verifyCanvasNodeEvent({ ...f.node, x: 42 })).toBe(false);
  });
});
