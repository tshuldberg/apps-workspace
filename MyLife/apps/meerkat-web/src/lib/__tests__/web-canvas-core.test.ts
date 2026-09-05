/**
 * Plan 56 C1, WEB twin: the Canvas app core + node registry. Proves:
 *   - the node registry's F8 boundary: strict per-type schemas (unknown keys
 *     rejected on every type), the structural no-URL invariant, closed token
 *     vocabularies, future-version -> placeholder, block_embed two-stage
 *     validation;
 *   - the anti-spoof glyph exclusion (7.4): reserved lock/shield/check glyphs
 *     never pass the sticker schema, alone or inside a longer value;
 *   - canvas policy parse fail-safe + the layer role floor mirror;
 *   - write -> read round trips on a real db: ensureCanvas, placeCanvasNode,
 *     updateCanvasNode (version bump), tombstoneCanvasNode, strokes + erase,
 *     marks; a FORGED/tampered row inserted directly renders NOTHING while
 *     its neighbors render (7.5 fail-closed per node);
 *   - honest numbers (7.6): counter totals count verified increments only,
 *     poll results take the LAST vote per member, guestbook notes list
 *     verified notes;
 *   - receiver dials (3.6): muted authors, member decorations off (curator
 *     content stays), backgrounds off, with the honest hidden count;
 *   - drafts: save/load round trip, malformed draft dropped;
 *   - caps parity: the sync-side enforcement constants equal the
 *     @mylife/meerkat-canvas package constants (they must never drift).
 */

import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createCommunity,
  generateDeviceIdentity,
  upsertCommunity,
  SYNC_CANVAS_EVENT_RATE_PER_HOUR,
  SYNC_CANVAS_NODE_CAPS,
  SYNC_CANVAS_PAGES_PER_MEMBER_CAP,
  SYNC_CANVAS_STROKE_CAP,
} from '@mylife/sync';
import {
  CANVAS_EVENT_RATE_PER_HOUR,
  CANVAS_NODE_CAPS,
  CANVAS_PAGES_PER_MEMBER_CAP,
  CANVAS_STROKE_CAP,
} from '@mylife/meerkat-canvas';
import { ensureMeerkatTables, ensureSyncSchema } from '../schema';
import {
  CANVAS_NODE_REGISTRY,
  CANVAS_NODE_TYPES,
  NODE_PLACEHOLDER_LINE,
  RESERVED_SPOOF_GLYPHS,
  containsReservedGlyph,
  milestoneLine,
  validateCanvasNodeProps,
} from '../canvas-node-registry-core';
import {
  addCanvasMark,
  addCanvasStroke,
  applyRenderPrefs,
  counterTotal,
  defaultRenderPrefs,
  deleteCanvasDraft,
  ensureCanvas,
  eraseCanvasStroke,
  getCanvasById,
  getCanvasForSubject,
  getRenderPrefs,
  guestbookNotes,
  listCanvasNodes,
  listCanvasStrokes,
  listCommunityPages,
  loadCanvasDraft,
  parseCanvasPolicy,
  placeCanvasNode,
  pollResults,
  roleMayPlaceOnLayer,
  saveCanvasDraft,
  setCanvasAuthorMuted,
  setRenderPref,
  tombstoneCanvasNode,
  updateCanvasNode,
} from '../canvas-core';

let testDb: InMemoryTestDatabase | null = null;
afterEach(() => { testDb?.close(); testDb = null; });

// One secret store for the whole file: the identities below sign from it, so
// it must be configured BEFORE they are generated and never replaced.
configureSyncSecretStore(createInMemorySyncSecretStore());

const owner = generateDeviceIdentity('Owner');
const member = generateDeviceIdentity('Member');
const admin = generateDeviceIdentity('Admin');

const signed = createCommunity(owner, {
  name: 'Burrow',
  channels: [{ id: 'general', name: 'general' }],
  members: [
    { deviceId: member.publicKey, role: 'member' },
    { deviceId: admin.publicKey, role: 'admin' },
  ],
});
const communityId = signed.descriptor.communityId;

function freshDb() {
  testDb = createInMemoryTestDatabase();
  const db = testDb.adapter;
  ensureMeerkatTables(db);
  ensureSyncSchema(db);
  upsertCommunity(db, signed, owner.publicKey);
  return db;
}

describe('node registry (F8 boundary)', () => {
  it('every type is strict: unknown keys and url-shaped keys are rejected', () => {
    for (const type of CANVAS_NODE_TYPES) {
      expect(validateCanvasNodeProps(type, 1, { smuggled: 1 }).status).toBe('invalid');
      for (const key of ['url', 'href', 'src', 'link']) {
        expect(validateCanvasNodeProps(type, 1, { [key]: 'https://evil.example' }).status).toBe('invalid');
      }
    }
  });

  it('unknown type and future schemaVersion degrade to the placeholder states', () => {
    expect(validateCanvasNodeProps('hologram', 1, {})).toEqual({ status: 'unknown_type' });
    expect(validateCanvasNodeProps('text', 99, { text: 'hi' })).toEqual({ status: 'future_version' });
    expect(NODE_PLACEHOLDER_LINE).toContain('does not support yet');
  });

  it('styling is closed tokens: raw color strings never pass', () => {
    expect(validateCanvasNodeProps('text', 1, { text: 'hi', colorToken: '#ff0000' }).status).toBe('invalid');
    expect(validateCanvasNodeProps('shape', 1, { shape: 'rect', fillToken: 'red' }).status).toBe('invalid');
    expect(validateCanvasNodeProps('text', 1, { text: 'hi', colorToken: 'accent' }).status).toBe('ok');
  });

  it('anti-spoof (7.4): every reserved glyph is excluded, alone and embedded', () => {
    for (const glyph of RESERVED_SPOOF_GLYPHS) {
      expect(containsReservedGlyph(glyph)).toBe(true);
      expect(validateCanvasNodeProps('sticker', 1, { emoji: glyph }).status).toBe('invalid');
      expect(validateCanvasNodeProps('sticker', 1, { emoji: `a${glyph}` }).status).toBe('invalid');
    }
    expect(validateCanvasNodeProps('sticker', 1, { emoji: '🦫' }).status).toBe('ok');
  });

  it('link cards navigate in-community only (never a URL field)', () => {
    expect(validateCanvasNodeProps('link_card', 1, {
      label: 'Trips', target: { kind: 'channel', id: 'general' },
    }).status).toBe('ok');
    expect(validateCanvasNodeProps('link_card', 1, {
      label: 'Evil', target: { kind: 'url', id: 'https://evil.example' },
    }).status).toBe('invalid');
    expect(validateCanvasNodeProps('link_card', 1, {
      label: 'Evil', url: 'https://evil.example',
    }).status).toBe('invalid');
  });

  it('block_embed validates the wrapped block config two-stage', () => {
    expect(validateCanvasNodeProps('block_embed', 1, { blockType: 'members', config: { maxShown: 5 } }).status).toBe('ok');
    expect(validateCanvasNodeProps('block_embed', 1, { blockType: 'members', config: { maxShown: 'lots' } }).status).toBe('invalid');
    // Unknown inner block: envelope ok, renderer shows the block placeholder.
    expect(validateCanvasNodeProps('block_embed', 1, { blockType: 'future_block', config: {} }).status).toBe('ok');
  });

  it('registry metadata is complete: every type has layers, behaviors, receiverClass', () => {
    for (const type of CANVAS_NODE_TYPES) {
      const contract = CANVAS_NODE_REGISTRY[type];
      expect(contract.layers.length).toBeGreaterThan(0);
      expect(contract.behaviors.length).toBeGreaterThan(0);
      expect(contract.fallback).toBe('placeholder');
      expect(contract.label.length).toBeGreaterThan(0);
    }
  });
});

describe('caps parity (sync enforcement == package constants)', () => {
  it('the two constant sets never drift', () => {
    expect(SYNC_CANVAS_NODE_CAPS).toEqual(CANVAS_NODE_CAPS);
    expect(SYNC_CANVAS_STROKE_CAP).toBe(CANVAS_STROKE_CAP);
    expect(SYNC_CANVAS_PAGES_PER_MEMBER_CAP).toBe(CANVAS_PAGES_PER_MEMBER_CAP);
    expect(SYNC_CANVAS_EVENT_RATE_PER_HOUR).toBe(CANVAS_EVENT_RATE_PER_HOUR);
  });
});

describe('policy + layer floors', () => {
  it('parseCanvasPolicy fails safe to the default on malformed input', () => {
    expect(parseCanvasPolicy(null)).toEqual(parseCanvasPolicy('not json'));
    expect(parseCanvasPolicy('{"layers":{"background":"anyone"}}').layers.background).toBe('owner');
  });

  it('roleMayPlaceOnLayer mirrors the apply gate incl. member-build toggle', () => {
    const policy = parseCanvasPolicy(null);
    expect(roleMayPlaceOnLayer('member', 'open', policy)).toBe(true);
    expect(roleMayPlaceOnLayer('member', 'background', policy)).toBe(false);
    expect(roleMayPlaceOnLayer('admin', 'structure', policy)).toBe(true);
    expect(roleMayPlaceOnLayer('viewer', 'open', policy)).toBe(false);
    expect(roleMayPlaceOnLayer('member', 'open', { ...policy, memberBuild: false })).toBe(false);
    expect(roleMayPlaceOnLayer('admin', 'open', { ...policy, memberBuild: false })).toBe(true);
  });
});

describe('write -> read round trips (verified rows only)', () => {
  it('ensureCanvas creates then reuses; refuses a dishonest signer', () => {
    const db = freshDb();
    const canvas = ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' });
    expect(getCanvasForSubject(db, communityId, 'commons', 'general')?.id).toBe(canvas.id);
    expect(ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' }).id).toBe(canvas.id);
    expect(() => ensureCanvas(db, member, { communityId, kind: 'commons', subjectId: 'other' }))
      .toThrow(/cannot create/);
    expect(getCanvasById(db, canvas.id)?.kind).toBe('commons');
  });

  it('nodes round trip; a tampered row renders NOTHING while neighbors render', () => {
    const db = freshDb();
    const canvas = ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' });
    const good = placeCanvasNode(db, member, {
      canvasId: canvas.id, communityId, nodeType: 'text', props: { text: 'hello' },
      layer: 'open', x: 10, y: 10, w: 100, h: 40,
    });
    const victim = placeCanvasNode(db, member, {
      canvasId: canvas.id, communityId, nodeType: 'text', props: { text: 'victim' },
      layer: 'open', x: 50, y: 50, w: 100, h: 40,
    });
    // Tamper the second row directly in the db (defense in depth: read-time
    // re-verification catches what apply-time cannot see happen locally).
    db.execute(`UPDATE cm_canvas_nodes SET props_json = ? WHERE id = ?`, [JSON.stringify({ text: 'defaced' }), victim.id]);
    const nodes = listCanvasNodes(db, canvas.id);
    expect(nodes.map((n) => n.event.id)).toEqual([good.id]);
  });

  it('updateCanvasNode bumps the version; tombstone hides; curator may tombstone open-layer', () => {
    const db = freshDb();
    const canvas = ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' });
    const node = placeCanvasNode(db, member, {
      canvasId: canvas.id, communityId, nodeType: 'sticker', props: { emoji: '🦫' },
      layer: 'open', x: 0, y: 0, w: 40, h: 40,
    });
    const moved = updateCanvasNode(db, member, node, { x: 99 });
    expect(moved.nodeVersion).toBe(2);
    expect(listCanvasNodes(db, canvas.id)[0]?.event.x).toBe(99);
    expect(() => updateCanvasNode(db, admin, moved, { x: 0 })).toThrow(/Only the author/);
    tombstoneCanvasNode(db, admin, moved); // curator_remove on the open layer
    expect(listCanvasNodes(db, canvas.id)).toEqual([]);
  });

  it('strokes append and erase with authority', () => {
    const db = freshDb();
    const canvas = ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' });
    const strokeJson = JSON.stringify({ points: [[0, 0], [5, 5]], brush: 'pen', colorToken: 'accent', width: 2 });
    const stroke = addCanvasStroke(db, member, { canvasId: canvas.id, communityId, strokeJson });
    expect(listCanvasStrokes(db, canvas.id, signed.descriptor).map((s) => s.id)).toEqual([stroke.id]);
    eraseCanvasStroke(db, admin, { canvasId: canvas.id, communityId, strokeId: stroke.id });
    expect(listCanvasStrokes(db, canvas.id, signed.descriptor)).toEqual([]);
  });

  it('honest numbers: counters, one-vote-per-member polls, guestbook notes', () => {
    const db = freshDb();
    const canvas = ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' });
    const counter = placeCanvasNode(db, admin, {
      canvasId: canvas.id, communityId, nodeType: 'counter', props: {},
      layer: 'structure', x: 0, y: 0, w: 80, h: 40,
    });
    addCanvasMark(db, member, { canvasId: canvas.id, communityId, nodeId: counter.id, kind: 'increment' });
    addCanvasMark(db, admin, { canvasId: canvas.id, communityId, nodeId: counter.id, kind: 'increment' });
    expect(counterTotal(db, counter.id)).toBe(2);

    const poll = placeCanvasNode(db, admin, {
      canvasId: canvas.id, communityId, nodeType: 'poll',
      props: { question: 'Snacks?', options: ['seeds', 'roots'] },
      layer: 'structure', x: 0, y: 100, w: 200, h: 120,
    });
    addCanvasMark(db, member, { canvasId: canvas.id, communityId, nodeId: poll.id, kind: 'vote', option: 0 });
    addCanvasMark(db, member, { canvasId: canvas.id, communityId, nodeId: poll.id, kind: 'vote', option: 1 });
    addCanvasMark(db, admin, { canvasId: canvas.id, communityId, nodeId: poll.id, kind: 'vote', option: 0 });
    expect(pollResults(db, poll.id, 2)).toEqual([1, 1]); // member's LAST vote counts once

    const guestbook = placeCanvasNode(db, admin, {
      canvasId: canvas.id, communityId, nodeType: 'guestbook', props: { title: 'Visits' },
      layer: 'structure', x: 0, y: 240, w: 200, h: 160,
    });
    addCanvasMark(db, member, { canvasId: canvas.id, communityId, nodeId: guestbook.id, kind: 'note', note: 'was here' });
    const notes = guestbookNotes(db, guestbook.id, 10);
    expect(notes.map((n) => n.note)).toEqual(['was here']);
  });

  it('pages directory lists verified member pages', () => {
    const db = freshDb();
    const page = ensureCanvas(db, member, { communityId, kind: 'page', subjectId: 'ignored' });
    placeCanvasNode(db, member, {
      canvasId: page.id, communityId, nodeType: 'text', props: { text: 'My shrine' },
      layer: 'open', x: 0, y: 0, w: 200, h: 60,
    });
    const listing = listCommunityPages(db, communityId);
    expect(listing).toHaveLength(1);
    expect(listing[0]).toMatchObject({ authorDevice: member.publicKey, nodeCount: 1 });
  });
});

describe('receiver dials (3.6)', () => {
  it('defaults are conservative and rows merge global < community', () => {
    const db = freshDb();
    expect(getRenderPrefs(db, communityId)).toEqual(defaultRenderPrefs());
    setRenderPref(db, '', 'animations', 'off');
    setRenderPref(db, communityId, 'animations', 'reduced');
    expect(getRenderPrefs(db, communityId).animations).toBe('reduced');
    expect(getRenderPrefs(db, 'elsewhere').animations).toBe('off');
    expect(() => setRenderPref(db, '', 'animations', 'sideways')).toThrow(/Unknown render dial/);
  });

  it('filters muted authors + member decorations with the honest hidden count; curator content stays', () => {
    const db = freshDb();
    const canvas = ensureCanvas(db, owner, { communityId, kind: 'commons', subjectId: 'general' });
    placeCanvasNode(db, member, {
      canvasId: canvas.id, communityId, nodeType: 'sticker', props: { emoji: '🌿' },
      layer: 'open', x: 0, y: 0, w: 40, h: 40,
    });
    placeCanvasNode(db, admin, {
      canvasId: canvas.id, communityId, nodeType: 'sticker', props: { emoji: '🪺' },
      layer: 'structure', x: 50, y: 0, w: 40, h: 40,
    });
    const nodes = listCanvasNodes(db, canvas.id);
    setRenderPref(db, communityId, 'member_decorations', 'off');
    const dialed = applyRenderPrefs(nodes, [], getRenderPrefs(db, communityId), signed.descriptor);
    expect(dialed.nodes.map((n) => n.event.authorDevice)).toEqual([admin.publicKey]);
    expect(dialed.hiddenCount).toBe(1);

    setCanvasAuthorMuted(db, communityId, admin.publicKey, true);
    const dialed2 = applyRenderPrefs(nodes, [], getRenderPrefs(db, communityId), signed.descriptor);
    expect(dialed2.nodes).toEqual([]);
    expect(dialed2.hiddenCount).toBe(2);
  });
});

describe('drafts', () => {
  it('round-trips and drops a malformed draft', () => {
    const db = freshDb();
    const snapshot = {
      kind: 'commons' as const,
      policy: parseCanvasPolicy(null),
      nodes: [],
    };
    saveCanvasDraft(db, { id: 'draft1', communityId, canvasId: null, kind: 'commons', snapshot });
    expect(loadCanvasDraft(db, 'draft1')?.snapshot).toEqual(snapshot);
    db.execute(`UPDATE mk_canvas_drafts SET draft_json = 'garbage' WHERE id = 'draft1'`);
    expect(loadCanvasDraft(db, 'draft1')).toBeNull();
    saveCanvasDraft(db, { id: 'draft2', communityId, canvasId: null, kind: 'commons', snapshot });
    deleteCanvasDraft(db, 'draft2');
    expect(loadCanvasDraft(db, 'draft2')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Plan 56 C2: profile canvases (features 53-54) + top_friends node
// ---------------------------------------------------------------------------

describe('C2: profile canvases + copy-forward', () => {
  it('ensureMyProfileCanvas creates once (kind profile, subject self) and reuses', async () => {
    const { ensureMyProfileCanvas } = await import('../canvas-core');
    const db = freshDb();
    const first = ensureMyProfileCanvas(db, member, communityId);
    expect(first.kind).toBe('profile');
    expect(first.subjectId).toBe(member.publicKey);
    expect(first.signedBy).toBe(member.publicKey);
    const again = ensureMyProfileCanvas(db, member, communityId);
    expect(again.id).toBe(first.id);
    // Two members get DISTINCT profile canvases in the same community.
    const owners = ensureMyProfileCanvas(db, owner, communityId);
    expect(owners.id).not.toBe(first.id);
    expect(getCanvasForSubject(db, communityId, 'profile', member.publicKey)?.id).toBe(first.id);
  });

  it('listMyProfileDesigns lists only my verified profile canvases with node counts', async () => {
    const { ensureMyProfileCanvas, listMyProfileDesigns } = await import('../canvas-core');
    const db = freshDb();
    const mine = ensureMyProfileCanvas(db, member, communityId);
    ensureMyProfileCanvas(db, owner, communityId);
    placeCanvasNode(db, member, {
      canvasId: mine.id, communityId, nodeType: 'text', props: { text: 'hello' }, layer: 'open',
      x: 0, y: 0, w: 100, h: 40,
    });
    const designs = listMyProfileDesigns(db, member);
    expect(designs).toHaveLength(1);
    expect(designs[0]!.canvas.id).toBe(mine.id);
    expect(designs[0]!.nodeCount).toBe(1);
    expect(listMyProfileDesigns(db, owner)).toHaveLength(1);
  });

  it('copy-forward copies my nodes as NEW signed events, skips unresealable assets, refuses foreign designs', async () => {
    const { ensureMyProfileCanvas, copyProfileDesignForward } = await import('../canvas-core');
    const db = freshDb();
    // A second community owned by the member (the copy target).
    const signedB = createCommunity(member, { name: 'Second Burrow', channels: [{ id: 'general', name: 'general' }] });
    upsertCommunity(db, signedB, member.publicKey);
    const source = ensureMyProfileCanvas(db, member, communityId);
    placeCanvasNode(db, member, {
      canvasId: source.id, communityId, nodeType: 'text', props: { text: 'welcome' }, layer: 'open',
      x: 4, y: 8, w: 120, h: 40,
    });
    placeCanvasNode(db, member, {
      canvasId: source.id, communityId, nodeType: 'image', props: {}, layer: 'open',
      x: 10, y: 60, w: 80, h: 80,
      asset: {
        cid: 'ab'.repeat(16),
        keyEpoch: 1,
        wrappedKey: 'cd'.repeat(48),
        manifestJson: JSON.stringify({
          manifest: { contentId: 'ab'.repeat(16) },
          manifestSignature: 'ef'.repeat(64),
          sealedChunkIds: ['12'.repeat(16)],
        }),
      },
    });
    // Asset cannot be opened here -> resealAsset returns null -> honest skip.
    const result = await copyProfileDesignForward(db, member, {
      fromCanvasId: source.id,
      toCommunityId: signedB.descriptor.communityId,
      resealAsset: async () => null,
    });
    expect(result).toEqual({ copied: 1, skipped: 1 });
    const target = getCanvasForSubject(db, signedB.descriptor.communityId, 'profile', member.publicKey);
    expect(target).not.toBeNull();
    const copied = listCanvasNodes(db, target!.id);
    expect(copied).toHaveLength(1);
    expect(copied[0]!.event.nodeType).toBe('text');
    expect(copied[0]!.event.id).not.toBe(source.id);
    // The source canvas is untouched.
    expect(listCanvasNodes(db, source.id)).toHaveLength(2);
    // Someone else's canvas is refused outright.
    await expect(copyProfileDesignForward(db, owner, {
      fromCanvasId: source.id,
      toCommunityId: signedB.descriptor.communityId,
      resealAsset: async () => null,
    })).rejects.toThrow(/not one of your profiles/);
  });
});

describe('C2: top_friends node (feature 54)', () => {
  it('accepts 1..8 member device ids, rejects 0, 9, and unknown keys', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `device-${i}`);
    expect(validateCanvasNodeProps('top_friends', 1, { memberDevices: ids(1) }).status).toBe('ok');
    expect(validateCanvasNodeProps('top_friends', 1, { memberDevices: ids(8), title: 'My 8' }).status).toBe('ok');
    expect(validateCanvasNodeProps('top_friends', 1, { memberDevices: [] }).status).toBe('invalid');
    expect(validateCanvasNodeProps('top_friends', 1, { memberDevices: ids(9) }).status).toBe('invalid');
    expect(validateCanvasNodeProps('top_friends', 1, { memberDevices: ids(2), captions: ['bestie'] }).status).toBe('invalid');
    expect(CANVAS_NODE_REGISTRY.top_friends.maxPerCanvas).toBe(2);
    expect(CANVAS_NODE_REGISTRY.top_friends.receiverClass).toBe('static');
  });

  it('places and reads back a top_friends node on a profile canvas', async () => {
    const { ensureMyProfileCanvas } = await import('../canvas-core');
    const db = freshDb();
    const canvas = ensureMyProfileCanvas(db, member, communityId);
    placeCanvasNode(db, member, {
      canvasId: canvas.id, communityId, nodeType: 'top_friends',
      props: { memberDevices: [owner.publicKey, admin.publicKey] }, layer: 'open',
      x: 0, y: 0, w: 240, h: 200,
    });
    const nodes = listCanvasNodes(db, canvas.id);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.parse.status).toBe('ok');
    expect((nodes[0]!.parse as unknown as { props: { memberDevices: string[] } }).props.memberDevices)
      .toEqual([owner.publicKey, admin.publicKey]);
  });
});

const MSG_1 = '11'.repeat(16);
const MSG_2 = '22'.repeat(16);

describe('C2: sticker layer over threads (feature 12)', () => {
  it('sticks signed stickers over messages, grouped by anchor, honoring receiver dials', async () => {
    const { addThreadSticker, ensureThreadOverlay, listThreadStickers, setCanvasAuthorMuted: mute } = await import('../canvas-core');
    void mute;
    const db = freshDb();
    const overlay = ensureThreadOverlay(db, member, communityId, 'general');
    expect(overlay.kind).toBe('thread_overlay');
    expect(overlay.subjectId).toBe('general');
    // Another member converges on the SAME overlay.
    expect(ensureThreadOverlay(db, admin, communityId, 'general').id).toBe(overlay.id);

    addThreadSticker(db, member, { communityId, channelId: 'general', messageId: MSG_1, emoji: '🔥', x: 10, y: -4 });
    addThreadSticker(db, admin, { communityId, channelId: 'general', messageId: MSG_1, emoji: '⭐', x: 40, y: 2 });
    addThreadSticker(db, member, { communityId, channelId: 'general', messageId: MSG_2, emoji: '🦫', x: 5, y: 0 });

    const byMessage = listThreadStickers(db, communityId, 'general', signed.descriptor);
    expect(byMessage.get(MSG_1)).toHaveLength(2);
    expect(byMessage.get(MSG_2)).toHaveLength(1);
    expect(byMessage.get(MSG_1)![0]).toMatchObject({ emoji: '🔥', authorDevice: member.publicKey, x: 10 });

    // Receiver dial: muting the member hides their stickers HERE (admin's stay).
    setCanvasAuthorMuted(db, communityId, member.publicKey, true);
    const dialed = listThreadStickers(db, communityId, 'general', signed.descriptor);
    expect(dialed.get(MSG_1)).toHaveLength(1);
    expect(dialed.get(MSG_1)![0]!.authorDevice).toBe(admin.publicKey);
    expect(dialed.get(MSG_2)).toBeUndefined();
    setCanvasAuthorMuted(db, communityId, member.publicKey, false);
  });

  it('a sticker is exactly one of glyph or pack image; removal is author-or-curator tombstone', async () => {
    const { addThreadSticker, listThreadStickers, removeThreadSticker } = await import('../canvas-core');
    const db = freshDb();
    await expect(async () => addThreadSticker(db, member, {
      communityId, channelId: 'general', messageId: MSG_1, x: 0, y: 0,
    })).rejects.toThrow(/exactly one/);
    const node = addThreadSticker(db, member, { communityId, channelId: 'general', messageId: MSG_1, emoji: '🌸', x: 0, y: 0 });
    // The OWNER (curator) removes the member's open-layer sticker.
    removeThreadSticker(db, owner, communityId, 'general', node.id);
    expect(listThreadStickers(db, communityId, 'general', signed.descriptor).size).toBe(0);
  });
});

describe('C2: canvas posts (4.5)', () => {
  it('body token round-trips and rejects junk; the canvas is author-signed kind post', async () => {
    const { canvasPostBody, createCanvasPostCanvas, parseCanvasPostBody } = await import('../canvas-core');
    const db = freshDb();
    const canvas = createCanvasPostCanvas(db, member, communityId);
    expect(canvas.kind).toBe('post');
    expect(canvas.subjectId).toBe(canvas.id);
    expect(canvas.signedBy).toBe(member.publicKey);
    const body = canvasPostBody(canvas.id);
    expect(parseCanvasPostBody(body)).toBe(canvas.id);
    expect(parseCanvasPostBody('mkcanvaspost:zz')).toBeNull();
    expect(parseCanvasPostBody('hello world')).toBeNull();
    expect(parseCanvasPostBody(`${body} trailing`)).toBeNull();
    expect(getCanvasById(db, canvas.id)?.id).toBe(canvas.id);
  });
});

describe('C2: milestone cards (features 30/46)', () => {
  it('validates strict props and computes honest date math', () => {
    expect(validateCanvasNodeProps('milestone', 1, { title: 'Launch', dateIso: '2026-12-31', style: 'countdown' }).status).toBe('ok');
    expect(validateCanvasNodeProps('milestone', 1, { title: 'Launch', dateIso: 'soon', style: 'countdown' }).status).toBe('invalid');
    expect(validateCanvasNodeProps('milestone', 1, { title: 'Launch', dateIso: '2026-12-31', style: 'blink' }).status).toBe('invalid');
    expect(validateCanvasNodeProps('milestone', 1, { title: 'Launch', dateIso: '2026-12-31', style: 'countdown', url: 'https://x' }).status).toBe('invalid');
    const now = new Date('2026-08-29T15:00:00Z');
    expect(milestoneLine({ dateIso: '2026-08-31', style: 'countdown' }, now)).toBe('2 days to go');
    expect(milestoneLine({ dateIso: '2026-08-29', style: 'countdown' }, now)).toBe('Today!');
    expect(milestoneLine({ dateIso: '2026-08-27', style: 'countup' }, now)).toBe('Day 2');
    expect(milestoneLine({ dateIso: '2024-08-29', style: 'anniversary' }, now)).toBe('2 years today!');
    expect(milestoneLine({ dateIso: 'garbage', style: 'countdown' }, now)).toBe('Invalid date');
  });
});

describe('C2: page templates (feature 52)', () => {
  it('every host preset applies fully through the registry (zero skips)', async () => {
    const { CANVAS_PAGE_TEMPLATES, applyCanvasTemplateNodes, createPageCanvas } = await import('../canvas-core');
    const db = freshDb();
    for (const template of CANVAS_PAGE_TEMPLATES) {
      const page = createPageCanvas(db, member, communityId);
      const result = applyCanvasTemplateNodes(db, member, page, template.nodes);
      expect(result, template.id).toEqual({ placed: template.nodes.length, skipped: 0 });
      expect(listCanvasNodes(db, page.id)).toHaveLength(template.nodes.length);
    }
  });

  it('export -> import round-trips through the codec as the importer\'s own signed nodes', async () => {
    const { CANVAS_PAGE_TEMPLATES, applyCanvasTemplateNodes, createPageCanvas, exportCanvasTemplate, importCanvasTemplate } = await import('../canvas-core');
    const db = freshDb();
    const source = createPageCanvas(db, member, communityId);
    applyCanvasTemplateNodes(db, member, source, CANVAS_PAGE_TEMPLATES[1]!.nodes);
    const exported = exportCanvasTemplate(db, source.id);
    expect(exported).not.toBeNull();
    expect(exported!.skippedAssets).toBe(0);
    const target = createPageCanvas(db, admin, communityId);
    const result = importCanvasTemplate(db, admin, target, exported!.blob);
    expect(result).toEqual({ placed: exported!.exported, skipped: 0 });
    for (const node of listCanvasNodes(db, target.id)) {
      expect(node.event.authorDevice).toBe(admin.publicKey);
      expect(node.parse.status).toBe('ok');
    }
    await expect(async () => importCanvasTemplate(db, admin, target, 'not-a-code')).rejects.toThrow(/not valid/);
  });
});

describe('C2: per-channel theme overrides + bubble skins (features 3-4)', () => {
  it('the topper policy carries closed themeExtras; channelThemeExtras reads them; forgeries never land', async () => {
    const { channelThemeExtras, ensureCanvas: ensure } = await import('../canvas-core');
    const db = freshDb();
    expect(channelThemeExtras(db, communityId, 'general')).toBeNull();
    ensure(db, owner, {
      communityId, kind: 'channel_topper', subjectId: 'general',
      policy: {
        layers: { background: 'owner', structure: 'curator', open: 'member' },
        memberBuild: true,
        layout: 'free',
        themeExtras: { bubbleShape: 'pill', typographyScale: 'large' },
      },
    });
    expect(channelThemeExtras(db, communityId, 'general')).toEqual({ bubbleShape: 'pill', typographyScale: 'large' });
    // A member cannot sign a topper (owner authority), so no member override path exists.
    expect(() => ensure(db, member, {
      communityId, kind: 'channel_topper', subjectId: 'other',
      policy: {
        layers: { background: 'owner', structure: 'curator', open: 'member' },
        memberBuild: true,
        layout: 'free',
        themeExtras: { bubbleShape: 'square' },
      },
    })).toThrow();
  });

  it('canvas themeExtras vocabulary is pinned to the meerkat-theme enums', async () => {
    const { MkCanvasThemeExtrasSchema } = await import('@mylife/meerkat-canvas');
    const { resolveThemeStyle, bubbleRadiusForShape, mergeThemeExtras } = await import('@mylife/meerkat-theme');
    const full = {
      typographyScale: 'large', borderWeight: 'bold', shadowDepth: 'deep',
      bubbleShape: 'pill', backgroundTreatment: 'washed',
    } as const;
    expect(MkCanvasThemeExtrasSchema.safeParse(full).success).toBe(true);
    // Every canvas-accepted value must resolve through the theme mapper (drift guard).
    const style = resolveThemeStyle(full);
    expect(style.bubbleRadius).toBe(22);
    expect(style.fontScale).toBeGreaterThan(1);
    expect(MkCanvasThemeExtrasSchema.safeParse({ bubbleShape: 'hexagon' }).success).toBe(false);
    expect(MkCanvasThemeExtrasSchema.safeParse({ url: 'https://x' }).success).toBe(false);
    // Merge precedence: the channel override wins per axis; base fills the rest.
    expect(mergeThemeExtras({ bubbleShape: 'rounded', shadowDepth: 'soft' }, { bubbleShape: 'square' }))
      .toEqual({ bubbleShape: 'square', shadowDepth: 'soft' });
    // Per-author shapes: known tokens map, unknown falls through as null.
    expect(bubbleRadiusForShape('square')).toBe(6);
    expect(bubbleRadiusForShape('hexagon')).toBeNull();
    expect(bubbleRadiusForShape(null)).toBeNull();
  });
});

describe('C3: the Plaza pixel board (features 6/18)', () => {
  it('owner creates the Plaza; members place; the board and timelapse derive from verified rows', async () => {
    const { ensurePlaza, placePlazaPixel, resolvePlaza } = await import('../canvas-core');
    const db = freshDb();
    expect(resolvePlaza(db, communityId, member.publicKey)).toBeNull();
    const board = ensurePlaza(db, owner, communityId, { w: 32, h: 32, intervalSeconds: 30 });
    expect(board.kind).toBe('pixel_board');
    // A member cannot create/reconfigure the board (owner authority).
    expect(() => ensurePlaza(db, member, communityId, { w: 16, h: 16, intervalSeconds: 30 })).toThrow();

    placePlazaPixel(db, member, { communityId, x: 3, y: 4, colorIndex: 7 });
    const view = resolvePlaza(db, communityId, member.publicKey)!;
    expect(view.config).toEqual({ w: 32, h: 32, intervalSeconds: 30 });
    expect(view.cells.get('3,4')!.colorIndex).toBe(7);
    expect(view.history).toHaveLength(1);
    expect(view.nextPlacementAt).toBeGreaterThan(Date.now());

    // Honest local interval: an immediate second placement refuses with a countdown.
    expect(() => placePlazaPixel(db, member, { communityId, x: 5, y: 5, colorIndex: 1 })).toThrow(/place again in/);
    // Another member is unaffected (per-member interval).
    placePlazaPixel(db, admin, { communityId, x: 5, y: 5, colorIndex: 2 });
    // Out-of-grid refuses against the POLICY grid.
    expect(() => placePlazaPixel(db, admin, { communityId, x: 40, y: 0, colorIndex: 1 })).toThrow(/outside the board/);
  });
});
