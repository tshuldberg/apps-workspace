// Plan 56 C1: the Canvas app data core. This is the WEB twin of
// apps/meerkat/app/(root)/data/canvas-core.ts, byte-identical below the
// import preamble (only the header + data-layer import paths differ),
// parity-locked by check-meerkat-parity.mjs (CORE_TWINS).
//
// Everything read renders VERIFIED rows only: a node/stroke/mark that fails
// signature or schema verification is dropped ALONE and the rest of the
// canvas renders (7.5); counts derive exclusively from verified events (7.6);
// receiver dials (3.6, mk_render_prefs, device-local) filter what THIS member
// renders and report the honest hidden count. Writes go through @mylife/sync
// create* signers and the engine recordChange rail (same pattern as
// publishCommunityLayout), so local rows and replicated rows cannot drift.

import type { DatabaseAdapter } from '@mylife/db';
import {
  canvasPixelEventFromRow,
  canvasPixelEventToRow,
  createCanvasEvent,
  createCanvasPixelEvent,
  pixelBoardConfig,
  resolveCanvasPixels,
  createCanvasMarkEvent,
  createCanvasNodeEvent,
  createCanvasStrokeEvent,
  bytesToHex,
  canvasEventFromRow,
  canvasEventToRow,
  canvasMarkEventFromRow,
  canvasMarkEventToRow,
  canvasNodeEventFromRow,
  canvasNodeEventToRow,
  canvasStrokeEventFromRow,
  canvasStrokeEventToRow,
  getCommunity,
  generateSyncRandomBytes,
  generateSyncRandomInt,
  resolveCanvasStrokes,
  verifyCanvasEvent,
  verifyCanvasMarkEvent,
  verifyCanvasNodeEvent,
  communityRole,
  type CanvasNodeAsset,
  type CommunityCanvasEvent,
  type CommunityCanvasPixelEvent,
  type CommunityCanvasKind,
  type CommunityCanvasLayer,
  type CommunityCanvasMarkEvent,
  type CommunityCanvasNodeEvent,
  type CommunityCanvasStrokeEvent,
  type CommunityDescriptor,
  type DeviceIdentity,
} from '@mylife/sync';
import {
  MkCanvasPolicySchema,
  decodeCanvasBlob,
  encodeCanvasBlob,
  defaultCanvasPolicy,
  type MkCanvasPolicy,
  type MkCanvasThemeExtras,
  type MkCanvasSnapshot,
} from '@mylife/meerkat-canvas';
import {
  CM_CANVAS_MARKS_TABLE,
  CM_CANVAS_NODES_TABLE,
  CM_CANVAS_STROKES_TABLE,
  CM_CANVAS_PIXELS_TABLE,
  CM_CANVAS_TABLE,
} from './meerkat-data';
import { validateCanvasNodeProps, type CanvasNodePropsParse } from './canvas-node-registry-core';

// --------------------------------------------------------------------------
// Shared logic below this line is byte-identical with the web twin
// (CORE_TWINS lock, anchored at generateCanvasId).
// --------------------------------------------------------------------------

/** The engine recordChange rail (canvas rows use INSERT for new, UPDATE for LWW revisions). */
export type CanvasRecordChange = (
  table: string,
  operation: 'INSERT' | 'UPDATE',
  rowId: string,
  data: Record<string, unknown>,
) => void;

/** A 32-hex non-secret identifier for canvases/nodes (the protocol id shape). */
export function generateCanvasId(): string {
  return bytesToHex(generateSyncRandomBytes(16));
}

/** Parse a canvas policy fail-safe: malformed/absent resolves to the default. */
export function parseCanvasPolicy(policyJson: string | null): MkCanvasPolicy {
  if (!policyJson) return defaultCanvasPolicy();
  try {
    const parsed = MkCanvasPolicySchema.safeParse(JSON.parse(policyJson));
    return parsed.success ? parsed.data : defaultCanvasPolicy();
  } catch {
    return defaultCanvasPolicy();
  }
}

/** May this role place on this layer under this policy? (Editor-side mirror of the apply gate.) */
export function roleMayPlaceOnLayer(
  role: string | null,
  layer: CommunityCanvasLayer,
  policy: MkCanvasPolicy,
): boolean {
  if (role === null || role === 'viewer') return false;
  const floor = policy.layers[layer];
  if (layer === 'open' && !policy.memberBuild && role === 'member') return false;
  if (floor === 'owner') return role === 'owner';
  if (floor === 'curator') return role === 'owner' || role === 'admin';
  return role === 'owner' || role === 'admin' || role === 'member';
}

// --- canvas registry reads -------------------------------------------------

/** The verified, non-tombstone canvas row for a subject, or null. */
export function getCanvasForSubject(
  db: DatabaseAdapter,
  communityId: string,
  kind: CommunityCanvasKind,
  subjectId: string,
): CommunityCanvasEvent | null {
  const stored = getCommunity(db, communityId);
  if (!stored) return null;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_TABLE} WHERE community_id = ? AND kind = ? AND subject_id = ?`,
    [communityId, kind, subjectId],
  );
  for (const row of rows) {
    const event = canvasEventFromRow(row);
    if (event && !event.tombstone && verifyCanvasEvent(event, stored.descriptor)) return event;
  }
  return null;
}

/** The verified canvas row by id (any kind), or null. */
export function getCanvasById(db: DatabaseAdapter, canvasId: string): CommunityCanvasEvent | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_TABLE} WHERE id = ?`,
    [canvasId],
  );
  const event = rows[0] ? canvasEventFromRow(rows[0]) : null;
  if (!event || event.tombstone) return null;
  const stored = getCommunity(db, event.communityId);
  if (!stored) return null;
  return verifyCanvasEvent(event, stored.descriptor) ? event : null;
}

/** All verified member pages for the Pages directory (newest first). */
export interface CanvasPageListing {
  canvas: CommunityCanvasEvent;
  authorDevice: string;
  nodeCount: number;
  /** The page's first VERIFIED text node's text, or null ('Untitled page'). */
  titleHint: string | null;
}

export function listCommunityPages(db: DatabaseAdapter, communityId: string): CanvasPageListing[] {
  const stored = getCommunity(db, communityId);
  if (!stored) return [];
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_TABLE} WHERE community_id = ? AND kind = 'page' ORDER BY updated_at DESC`,
    [communityId],
  );
  const listings: CanvasPageListing[] = [];
  for (const row of rows) {
    const event = canvasEventFromRow(row);
    if (!event || event.tombstone || !verifyCanvasEvent(event, stored.descriptor)) continue;
    const countRows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${CM_CANVAS_NODES_TABLE} WHERE canvas_id = ? AND tombstone = 0`,
      [event.id],
    );
    let titleHint: string | null = null;
    for (const node of listCanvasNodes(db, event.id)) {
      if (node.event.nodeType !== 'text' || node.parse.status !== 'ok') continue;
      const text = (node.parse.props as { text?: unknown }).text;
      if (typeof text === 'string' && text.trim()) { titleHint = text.trim().slice(0, 80); break; }
    }
    listings.push({ canvas: event, authorDevice: event.signedBy, nodeCount: countRows[0]?.n ?? 0, titleHint });
  }
  return listings;
}

// --- node reads ------------------------------------------------------------

export interface ResolvedCanvasNode {
  event: CommunityCanvasNodeEvent;
  parse: CanvasNodePropsParse;
}

/**
 * The verified, living node set for a canvas, z-sorted (flow layouts render
 * the same order stacked). Each node carries its props parse so the renderer
 * mounts either the real component or the honest placeholder, per node.
 */
export function listCanvasNodes(db: DatabaseAdapter, canvasId: string): ResolvedCanvasNode[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_NODES_TABLE} WHERE canvas_id = ? AND tombstone = 0 ORDER BY z ASC, created_at ASC`,
    [canvasId],
  );
  const nodes: ResolvedCanvasNode[] = [];
  for (const row of rows) {
    const event = canvasNodeEventFromRow(row);
    if (!event || event.tombstone) continue;
    if (!verifyCanvasNodeEvent(event)) continue; // dropped ALONE (7.5)
    let props: unknown = {};
    try {
      props = JSON.parse(event.propsJson);
    } catch {
      continue;
    }
    nodes.push({ event, parse: validateCanvasNodeProps(event.nodeType, event.schemaVersion, props) });
  }
  return nodes;
}

/** Verified visible strokes for a canvas (erases applied with authority). */
export function listCanvasStrokes(
  db: DatabaseAdapter,
  canvasId: string,
  descriptor: CommunityDescriptor,
): CommunityCanvasStrokeEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_STROKES_TABLE} WHERE canvas_id = ?`,
    [canvasId],
  );
  const events: CommunityCanvasStrokeEvent[] = [];
  for (const row of rows) {
    const event = canvasStrokeEventFromRow(row);
    if (event) events.push(event);
  }
  return resolveCanvasStrokes(events, descriptor);
}

// --- receiver dials (3.6, device-local) -------------------------------------

export type RenderDialKey = 'animations' | 'sounds' | 'backgrounds' | 'member_decorations' | 'external_links' | 'effects';

export interface CanvasRenderPrefs {
  animations: 'on' | 'reduced' | 'off';
  sounds: 'on' | 'tap_only' | 'off';
  backgrounds: 'on' | 'dimmed' | 'off';
  memberDecorations: 'on' | 'off';
  externalLinks: 'on' | 'off';
  effects: 'on' | 'off';
  mutedAuthors: string[];
}

/** Conservative defaults (3.6): sounds tap-only, everything else on. */
export function defaultRenderPrefs(): CanvasRenderPrefs {
  return {
    animations: 'on',
    sounds: 'tap_only',
    backgrounds: 'on',
    memberDecorations: 'on',
    externalLinks: 'on',
    effects: 'on',
    mutedAuthors: [],
  };
}

const DIAL_VALUES: Record<RenderDialKey, readonly string[]> = {
  animations: ['on', 'reduced', 'off'],
  sounds: ['on', 'tap_only', 'off'],
  backgrounds: ['on', 'dimmed', 'off'],
  member_decorations: ['on', 'off'],
  external_links: ['on', 'off'],
  effects: ['on', 'off'],
};

/** Merged prefs: community rows override the global ('') rows; mutes union. */
export function getRenderPrefs(db: DatabaseAdapter, communityId: string): CanvasRenderPrefs {
  const prefs = defaultRenderPrefs();
  const rows = db.query<{ community_id: string; pref: string; value: string }>(
    `SELECT community_id, pref, value FROM mk_render_prefs WHERE community_id IN ('', ?) ORDER BY community_id ASC`,
    [communityId],
  );
  const muted = new Set<string>();
  for (const row of rows) {
    if (row.pref.startsWith('mute:')) {
      if (row.value === '1') muted.add(row.pref.slice('mute:'.length));
      else muted.delete(row.pref.slice('mute:'.length));
      continue;
    }
    const allowed = DIAL_VALUES[row.pref as RenderDialKey];
    if (!allowed || !allowed.includes(row.value)) continue;
    if (row.pref === 'animations') prefs.animations = row.value as CanvasRenderPrefs['animations'];
    else if (row.pref === 'sounds') prefs.sounds = row.value as CanvasRenderPrefs['sounds'];
    else if (row.pref === 'backgrounds') prefs.backgrounds = row.value as CanvasRenderPrefs['backgrounds'];
    else if (row.pref === 'member_decorations') prefs.memberDecorations = row.value as CanvasRenderPrefs['memberDecorations'];
    else if (row.pref === 'external_links') prefs.externalLinks = row.value as CanvasRenderPrefs['externalLinks'];
    else if (row.pref === 'effects') prefs.effects = row.value as CanvasRenderPrefs['effects'];
  }
  prefs.mutedAuthors = [...muted].sort();
  return prefs;
}

export function setRenderPref(
  db: DatabaseAdapter,
  communityId: string,
  pref: RenderDialKey,
  value: string,
): void {
  const allowed = DIAL_VALUES[pref];
  if (!allowed || !allowed.includes(value)) throw new Error('Unknown render dial value.');
  db.execute(
    `INSERT OR REPLACE INTO mk_render_prefs (community_id, pref, value, updated_at) VALUES (?, ?, ?, ?)`,
    [communityId, pref, value, new Date().toISOString()],
  );
}

export function setCanvasAuthorMuted(
  db: DatabaseAdapter,
  communityId: string,
  authorDevice: string,
  muted: boolean,
): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_render_prefs (community_id, pref, value, updated_at) VALUES (?, ?, ?, ?)`,
    [communityId, `mute:${authorDevice}`, muted ? '1' : '0', new Date().toISOString()],
  );
}

export interface DialedCanvas {
  nodes: ResolvedCanvasNode[];
  strokes: CommunityCanvasStrokeEvent[];
  /** How many verified items the member's own dials hid (honest count). */
  hiddenCount: number;
  /** Render the background layer dimmed (dial 'dimmed'). */
  dimBackground: boolean;
}

/**
 * Apply the member's dials to a verified canvas. Curator/owner content stays
 * (7.9: receiver sovereignty covers non-curator decoration classes); member
 * stickers/drawings drop when member_decorations is off; muted authors drop
 * everywhere; backgrounds off drops the background layer.
 */
export function applyRenderPrefs(
  nodes: readonly ResolvedCanvasNode[],
  strokes: readonly CommunityCanvasStrokeEvent[],
  prefs: CanvasRenderPrefs,
  descriptor: CommunityDescriptor,
): DialedCanvas {
  const muted = new Set(prefs.mutedAuthors);
  let hidden = 0;
  const isCurator = (device: string): boolean => {
    const role = communityRole(descriptor, device);
    return role === 'owner' || role === 'admin';
  };
  const keptNodes = nodes.filter((node) => {
    const author = node.event.authorDevice;
    if (muted.has(author)) { hidden += 1; return false; }
    if (prefs.backgrounds === 'off' && node.event.layer === 'background' && !isCurator(author)) {
      hidden += 1; return false;
    }
    if (prefs.memberDecorations === 'off' && node.event.nodeType === 'sticker' && !isCurator(author)) {
      hidden += 1; return false;
    }
    if (prefs.externalLinks === 'off' && node.parse.status === 'ok' && node.event.nodeType === 'link_card' && !isCurator(author)) {
      hidden += 1; return false;
    }
    return true;
  });
  const keptStrokes = strokes.filter((stroke) => {
    if (muted.has(stroke.authorDevice)) { hidden += 1; return false; }
    if (prefs.memberDecorations === 'off' && !isCurator(stroke.authorDevice)) { hidden += 1; return false; }
    return true;
  });
  return {
    nodes: keptNodes,
    strokes: keptStrokes,
    hiddenCount: hidden,
    dimBackground: prefs.backgrounds === 'dimmed',
  };
}

// --- honest interaction reads (3.3 / 7.6) -----------------------------------

function listVerifiedMarks(db: DatabaseAdapter, nodeId: string): CommunityCanvasMarkEvent[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_MARKS_TABLE} WHERE node_id = ? ORDER BY created_at ASC`,
    [nodeId],
  );
  const events: CommunityCanvasMarkEvent[] = [];
  for (const row of rows) {
    const event = canvasMarkEventFromRow(row);
    if (event && verifyCanvasMarkEvent(event)) events.push(event);
  }
  return events;
}

/** Total verified increments for a counter node (every tap is a real event). */
export function counterTotal(db: DatabaseAdapter, nodeId: string): number {
  return listVerifiedMarks(db, nodeId).filter((m) => m.kind === 'increment').length;
}

/** Poll results: the LAST verified vote per member wins (one vote each). */
export function pollResults(db: DatabaseAdapter, nodeId: string, optionCount: number): number[] {
  const lastByMember = new Map<string, number>();
  for (const mark of listVerifiedMarks(db, nodeId)) {
    if (mark.kind !== 'vote' || mark.option === null) continue;
    if (mark.option >= optionCount) continue;
    lastByMember.set(mark.authorDevice, mark.option);
  }
  const totals = Array.from({ length: optionCount }, () => 0);
  for (const option of lastByMember.values()) totals[option] += 1;
  return totals;
}

export interface GuestbookNote {
  id: string;
  authorDevice: string;
  note: string;
  createdAt: string;
}

/** Verified guestbook notes, newest first. */
export function guestbookNotes(db: DatabaseAdapter, nodeId: string, limit: number): GuestbookNote[] {
  return listVerifiedMarks(db, nodeId)
    .filter((m) => m.kind === 'note' && m.note !== null)
    .slice(-Math.max(1, Math.min(200, limit)))
    .reverse()
    .map((m) => ({ id: m.id, authorDevice: m.authorDevice, note: m.note as string, createdAt: m.createdAt }));
}

// --- writes (signed events on the recordChange rail) ------------------------

function insertCanvasRow(db: DatabaseAdapter, event: CommunityCanvasEvent): void {
  const row = canvasEventToRow(event);
  db.execute(
    `INSERT OR REPLACE INTO ${CM_CANVAS_TABLE} (id, community_id, kind, subject_id, policy_json, revision, tombstone, updated_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.community_id, row.kind, row.subject_id, row.policy_json, row.revision, row.tombstone, row.updated_at, row.signed_by, row.signature],
  );
}

/**
 * Create (or revise) a canvas for a subject. Returns the signed event. The
 * data layer refuses dishonest callers via the same authority matrix the
 * verifier enforces, so errors surface honestly instead of silently failing
 * to replicate.
 */
export function ensureCanvas(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; kind: CommunityCanvasKind; subjectId: string; policy?: MkCanvasPolicy },
  recordChange?: CanvasRecordChange,
): CommunityCanvasEvent {
  const existing = getCanvasForSubject(db, input.communityId, input.kind, input.subjectId);
  if (existing && !input.policy) return existing;
  const event = createCanvasEvent(identity, {
    id: existing?.id ?? generateCanvasId(),
    communityId: input.communityId,
    kind: input.kind,
    subjectId: input.subjectId,
    revision: (existing?.revision ?? 0) + 1,
    policyJson: JSON.stringify(input.policy ?? parseCanvasPolicy(existing?.policyJson ?? null)),
  });
  const stored = getCommunity(db, input.communityId);
  if (!stored || !verifyCanvasEvent(event, stored.descriptor)) {
    throw new Error('You cannot create this canvas in this community.');
  }
  insertCanvasRow(db, event);
  recordChange?.(CM_CANVAS_TABLE, existing ? 'UPDATE' : 'INSERT', event.id, canvasEventToRow(event));
  return event;
}

/**
 * Create a NEW member page canvas (4.4): always a fresh id (a member holds up
 * to 20, apply-time capped); the page's subject is its own id, which is what a
 * promoted 'page'-kind channel binds to.
 */
export function createPageCanvas(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  recordChange?: CanvasRecordChange,
): CommunityCanvasEvent {
  const id = generateCanvasId();
  const event = createCanvasEvent(identity, {
    id,
    communityId,
    kind: 'page',
    subjectId: id,
    revision: 1,
    policyJson: JSON.stringify(defaultCanvasPolicy()),
  });
  const stored = getCommunity(db, communityId);
  if (!stored || !verifyCanvasEvent(event, stored.descriptor)) {
    throw new Error('You cannot create a page in this community.');
  }
  insertCanvasRow(db, event);
  recordChange?.(CM_CANVAS_TABLE, 'INSERT', event.id, canvasEventToRow(event));
  return event;
}

function insertNodeRow(db: DatabaseAdapter, event: CommunityCanvasNodeEvent): void {
  const row = canvasNodeEventToRow(event);
  db.execute(
    `INSERT OR REPLACE INTO ${CM_CANVAS_NODES_TABLE} (id, canvas_id, community_id, author_device, node_type, schema_version, props_json, layer,
      x, y, w, h, rotation, z, parent_id, node_version, version_nonce, asset_cid, asset_key_epoch, asset_wrapped_key, asset_manifest_json,
      tombstone, created_at, updated_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.canvas_id, row.community_id, row.author_device, row.node_type, row.schema_version, row.props_json, row.layer,
      row.x, row.y, row.w, row.h, row.rotation, row.z, row.parent_id, row.node_version, row.version_nonce,
      row.asset_cid, row.asset_key_epoch, row.asset_wrapped_key, row.asset_manifest_json,
      row.tombstone, row.created_at, row.updated_at, row.signed_by, row.signature],
  );
}

export interface PlaceNodeInput {
  canvasId: string;
  communityId: string;
  nodeType: string;
  props: Record<string, unknown>;
  layer: CommunityCanvasLayer;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z?: number;
  parentId?: string | null;
  asset?: CanvasNodeAsset | null;
}

/** Place a new node (props validated against the registry BEFORE signing). */
export function placeCanvasNode(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: PlaceNodeInput,
  recordChange?: CanvasRecordChange,
): CommunityCanvasNodeEvent {
  const parse = validateCanvasNodeProps(input.nodeType, 1, input.props);
  if (parse.status !== 'ok') throw new Error('Those decoration settings are not valid.');
  const event = createCanvasNodeEvent(identity, {
    id: generateCanvasId(),
    canvasId: input.canvasId,
    communityId: input.communityId,
    nodeType: input.nodeType,
    schemaVersion: 1,
    propsJson: JSON.stringify(parse.props),
    layer: input.layer,
    x: input.x,
    y: input.y,
    w: input.w,
    h: input.h,
    rotation: input.rotation,
    z: input.z,
    parentId: input.parentId ?? null,
    asset: input.asset ?? null,
    nodeVersion: 1,
    versionNonce: generateSyncRandomInt(2_000_000_000),
  });
  insertNodeRow(db, event);
  recordChange?.(CM_CANVAS_NODES_TABLE, 'INSERT', event.id, canvasNodeEventToRow(event));
  return event;
}

/** Re-sign a node with changed fields at nodeVersion+1 (author-only). */
export function updateCanvasNode(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  existing: CommunityCanvasNodeEvent,
  patch: Partial<Pick<CommunityCanvasNodeEvent, 'x' | 'y' | 'w' | 'h' | 'rotation' | 'z' | 'layer' | 'parentId'>> & { props?: Record<string, unknown> },
  recordChange?: CanvasRecordChange,
): CommunityCanvasNodeEvent {
  if (existing.authorDevice !== identity.publicKey) {
    throw new Error('Only the author can edit this decoration.');
  }
  let propsJson = existing.propsJson;
  if (patch.props) {
    const parse = validateCanvasNodeProps(existing.nodeType, existing.schemaVersion, patch.props);
    if (parse.status !== 'ok') throw new Error('Those decoration settings are not valid.');
    propsJson = JSON.stringify(parse.props);
  }
  const event = createCanvasNodeEvent(identity, {
    id: existing.id,
    canvasId: existing.canvasId,
    communityId: existing.communityId,
    nodeType: existing.nodeType,
    schemaVersion: existing.schemaVersion,
    propsJson,
    layer: patch.layer ?? existing.layer,
    x: patch.x ?? existing.x,
    y: patch.y ?? existing.y,
    w: patch.w ?? existing.w,
    h: patch.h ?? existing.h,
    rotation: patch.rotation ?? existing.rotation,
    z: patch.z ?? existing.z,
    parentId: patch.parentId !== undefined ? patch.parentId : existing.parentId,
    asset: existing.asset,
    nodeVersion: existing.nodeVersion + 1,
    versionNonce: generateSyncRandomInt(2_000_000_000),
    createdAt: existing.createdAt,
  });
  insertNodeRow(db, event);
  recordChange?.(CM_CANVAS_NODES_TABLE, 'UPDATE', event.id, canvasNodeEventToRow(event));
  return event;
}

/** Tombstone a node: the author, or the owner/an admin on the open layer (3.6). */
export function tombstoneCanvasNode(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  existing: CommunityCanvasNodeEvent,
  recordChange?: CanvasRecordChange,
): CommunityCanvasNodeEvent {
  const stored = getCommunity(db, existing.communityId);
  const role = stored ? communityRole(stored.descriptor, identity.publicKey) : null;
  const isCuratorRemove = (role === 'owner' || role === 'admin') && existing.layer === 'open';
  if (existing.authorDevice !== identity.publicKey && !isCuratorRemove) {
    throw new Error('Only the author or a community curator can remove this decoration.');
  }
  const event = createCanvasNodeEvent(identity, {
    id: existing.id,
    canvasId: existing.canvasId,
    communityId: existing.communityId,
    nodeType: existing.nodeType,
    schemaVersion: existing.schemaVersion,
    propsJson: existing.propsJson,
    layer: existing.layer,
    x: existing.x,
    y: existing.y,
    w: existing.w,
    h: existing.h,
    rotation: existing.rotation,
    z: existing.z,
    parentId: existing.parentId,
    asset: existing.asset,
    nodeVersion: existing.nodeVersion + 1,
    versionNonce: generateSyncRandomInt(2_000_000_000),
    createdAt: existing.createdAt,
    tombstone: true,
  });
  insertNodeRow(db, event);
  recordChange?.(CM_CANVAS_NODES_TABLE, 'UPDATE', event.id, canvasNodeEventToRow(event));
  return event;
}

function insertStrokeRow(db: DatabaseAdapter, event: CommunityCanvasStrokeEvent): void {
  const row = canvasStrokeEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO ${CM_CANVAS_STROKES_TABLE} (id, canvas_id, community_id, author_device, stroke_json, erases_id, created_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.canvas_id, row.community_id, row.author_device, row.stroke_json, row.erases_id, row.created_at, row.signed_by, row.signature],
  );
}

export function addCanvasStroke(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { canvasId: string; communityId: string; strokeJson: string },
  recordChange?: CanvasRecordChange,
): CommunityCanvasStrokeEvent {
  const event = createCanvasStrokeEvent(identity, {
    canvasId: input.canvasId,
    communityId: input.communityId,
    strokeJson: input.strokeJson,
  });
  insertStrokeRow(db, event);
  recordChange?.(CM_CANVAS_STROKES_TABLE, 'INSERT', event.id, canvasStrokeEventToRow(event));
  return event;
}

export function eraseCanvasStroke(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { canvasId: string; communityId: string; strokeId: string },
  recordChange?: CanvasRecordChange,
): CommunityCanvasStrokeEvent {
  const event = createCanvasStrokeEvent(identity, {
    canvasId: input.canvasId,
    communityId: input.communityId,
    erasesId: input.strokeId,
  });
  insertStrokeRow(db, event);
  recordChange?.(CM_CANVAS_STROKES_TABLE, 'INSERT', event.id, canvasStrokeEventToRow(event));
  return event;
}

function insertMarkRow(db: DatabaseAdapter, event: CommunityCanvasMarkEvent): void {
  const row = canvasMarkEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO ${CM_CANVAS_MARKS_TABLE} (id, canvas_id, community_id, node_id, kind, option, note, author_device, created_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.canvas_id, row.community_id, row.node_id, row.kind, row.option, row.note, row.author_device, row.created_at, row.signed_by, row.signature],
  );
}

export function addCanvasMark(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { canvasId: string; communityId: string; nodeId: string; kind: 'increment' | 'vote' | 'note'; option?: number | null; note?: string | null },
  recordChange?: CanvasRecordChange,
): CommunityCanvasMarkEvent {
  const event = createCanvasMarkEvent(identity, {
    canvasId: input.canvasId,
    communityId: input.communityId,
    nodeId: input.nodeId,
    kind: input.kind,
    option: input.option ?? null,
    note: input.note ?? null,
  });
  insertMarkRow(db, event);
  recordChange?.(CM_CANVAS_MARKS_TABLE, 'INSERT', event.id, canvasMarkEventToRow(event));
  return event;
}

// --- profile canvases (features 53-54) --------------------------------------

/**
 * Ensure MY designable profile canvas in a community (kind 'profile',
 * subject = my device, signed by me). Members without a designed profile
 * render the standard card; this creates the canvas on first design.
 */
export function ensureMyProfileCanvas(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  recordChange?: CanvasRecordChange,
): CommunityCanvasEvent {
  return ensureCanvas(db, identity, {
    communityId,
    kind: 'profile',
    subjectId: identity.publicKey,
  }, recordChange);
}

/**
 * Copy-forward (feature 54): duplicate MY designed profile from another
 * community into this one as NEW signed events, never a live link. Each
 * community's profile stays independently editable and independently signed.
 * Sealed assets are RE-SEALED under the target community's epoch when this
 * device can open them; nodes whose assets cannot be opened here are skipped
 * and counted honestly (content sealed under one community's keys never
 * references another's).
 */
export async function copyProfileDesignForward(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: {
    fromCanvasId: string;
    toCommunityId: string;
    resealAsset: (asset: CanvasNodeAsset, fromCommunityId: string) => Promise<CanvasNodeAsset | null>;
  },
  recordChange?: CanvasRecordChange,
): Promise<{ copied: number; skipped: number }> {
  const source = getCanvasById(db, input.fromCanvasId);
  if (!source || source.kind !== 'profile' || source.signedBy !== identity.publicKey) {
    throw new Error('That design is not one of your profiles on this device.');
  }
  const target = ensureMyProfileCanvas(db, identity, input.toCommunityId, recordChange);
  let copied = 0;
  let skipped = 0;
  for (const node of listCanvasNodes(db, source.id)) {
    if (node.parse.status !== 'ok') { skipped += 1; continue; }
    if (node.event.authorDevice !== identity.publicKey) { skipped += 1; continue; }
    let asset: CanvasNodeAsset | null = null;
    if (node.event.asset) {
      asset = await input.resealAsset(node.event.asset, source.communityId);
      if (!asset) { skipped += 1; continue; }
    }
    try {
      placeCanvasNode(db, identity, {
        canvasId: target.id,
        communityId: input.toCommunityId,
        nodeType: node.event.nodeType,
        props: node.parse.props,
        layer: node.event.layer,
        x: node.event.x,
        y: node.event.y,
        w: node.event.w,
        h: node.event.h,
        rotation: node.event.rotation,
        z: node.event.z,
        asset,
      }, recordChange);
      copied += 1;
    } catch {
      skipped += 1;
    }
  }
  return { copied, skipped };
}

/** MY designed profile canvases across communities (the copy-forward sources). */
export function listMyProfileDesigns(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
): Array<{ canvas: CommunityCanvasEvent; nodeCount: number }> {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_TABLE} WHERE kind = 'profile' AND subject_id = ? AND tombstone = 0`,
    [identity.publicKey],
  );
  const designs: Array<{ canvas: CommunityCanvasEvent; nodeCount: number }> = [];
  for (const row of rows) {
    const event = canvasEventFromRow(row);
    if (!event) continue;
    const stored = getCommunity(db, event.communityId);
    if (!stored || !verifyCanvasEvent(event, stored.descriptor)) continue;
    const countRows = db.query<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ${CM_CANVAS_NODES_TABLE} WHERE canvas_id = ? AND tombstone = 0`,
      [event.id],
    );
    designs.push({ canvas: event, nodeCount: countRows[0]?.n ?? 0 });
  }
  return designs;
}

// --- per-channel theme overrides (feature 3) ---------------------------------

/**
 * The per-channel style override from the channel's OWNER-SIGNED topper
 * policy, or null. Rides policy on cm_canvas (never descriptor fields), so
 * legacy descriptor signatures stay byte-identical and authority is exactly
 * the topper's existing owner binding.
 */
export function channelThemeExtras(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
): MkCanvasThemeExtras | null {
  const topper = getCanvasForSubject(db, communityId, 'channel_topper', channelId);
  if (!topper) return null;
  return parseCanvasPolicy(topper.policyJson).themeExtras ?? null;
}

// --- canvas posts (4.5) ------------------------------------------------------

/**
 * A canvas post's ROOT body is the deterministic token `mkcanvaspost:<id>`
 * (the pack-reaction grammar precedent): new builds render the canvas card,
 * old builds show the literal token (degraded, never misleading). The canvas
 * itself is kind 'post' with subjectId = its own id, author-signed, cap 100
 * nodes (the Farcaster lesson: the post is the container, blast radius one
 * card).
 */
const CANVAS_POST_BODY_RE = /^mkcanvaspost:[0-9a-f]{16,64}$/;

export function canvasPostBody(canvasId: string): string {
  const body = `mkcanvaspost:${canvasId}`;
  if (!CANVAS_POST_BODY_RE.test(body)) throw new Error('Invalid canvas post id.');
  return body;
}

/** The canvas id a post body names, or null when it is a normal text post. */
export function parseCanvasPostBody(body: string): string | null {
  if (typeof body !== 'string' || body.length > 100 || !CANVAS_POST_BODY_RE.test(body)) return null;
  return body.slice('mkcanvaspost:'.length);
}

/** Create the freeform mini-canvas behind a new canvas post (author-signed). */
export function createCanvasPostCanvas(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  recordChange?: CanvasRecordChange,
): CommunityCanvasEvent {
  const id = generateCanvasId();
  const event = createCanvasEvent(identity, {
    id,
    communityId,
    kind: 'post',
    subjectId: id,
    revision: 1,
    policyJson: JSON.stringify(defaultCanvasPolicy()),
  });
  const stored = getCommunity(db, communityId);
  if (!stored || !verifyCanvasEvent(event, stored.descriptor)) {
    throw new Error('You cannot create a canvas post in this community.');
  }
  insertCanvasRow(db, event);
  recordChange?.(CM_CANVAS_TABLE, 'INSERT', event.id, canvasEventToRow(event));
  return event;
}

// --- sticker layer over threads (feature 12) --------------------------------

export interface ThreadSticker {
  nodeId: string;
  messageId: string;
  authorDevice: string;
  /** Unicode glyph sticker, or null when the sticker is a sealed pack image. */
  emoji: string | null;
  /** Sealed pack-image sticker (resolve bytes through the store), or null. */
  asset: CanvasNodeAsset | null;
  x: number;
  y: number;
  rotation: number;
}

/**
 * Ensure the channel's sticker-overlay canvas (kind 'thread_overlay',
 * subject = channelId). Any member may create it; the first verified event
 * wins and everyone converges on it.
 */
export function ensureThreadOverlay(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  channelId: string,
  recordChange?: CanvasRecordChange,
): CommunityCanvasEvent {
  return ensureCanvas(db, identity, {
    communityId,
    kind: 'thread_overlay',
    subjectId: channelId,
  }, recordChange);
}

/**
 * Stick a signed, timestamped sticker over one message (x/y are offsets
 * within the message row). Glyph stickers are 'sticker' nodes; pack-image
 * stickers are 'image' nodes carrying the sealed asset. The anchor rides
 * parentId, so the overlay needs no schema of its own.
 */
export function addThreadSticker(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: {
    communityId: string;
    channelId: string;
    messageId: string;
    emoji?: string | null;
    asset?: CanvasNodeAsset | null;
    x: number;
    y: number;
    rotation?: number;
  },
  recordChange?: CanvasRecordChange,
): CommunityCanvasNodeEvent {
  if ((input.emoji ? 1 : 0) + (input.asset ? 1 : 0) !== 1) {
    throw new Error('A sticker is exactly one of a glyph or a pack image.');
  }
  const overlay = ensureThreadOverlay(db, identity, input.communityId, input.channelId, recordChange);
  return placeCanvasNode(db, identity, {
    canvasId: overlay.id,
    communityId: input.communityId,
    nodeType: input.emoji ? 'sticker' : 'image',
    props: input.emoji ? { emoji: input.emoji } : {},
    layer: 'open',
    x: input.x,
    y: input.y,
    w: 34,
    h: 34,
    rotation: input.rotation ?? 0,
    parentId: input.messageId,
    asset: input.asset ?? null,
  }, recordChange);
}

/**
 * The verified, receiver-dialed stickers for a channel, grouped by the
 * message they anchor to. Muted authors and the member_decorations dial are
 * honored through the SAME applyRenderPrefs path as canvases; a hidden
 * sticker contributes to the honest hidden count there, never a ghost.
 */
export function listThreadStickers(
  db: DatabaseAdapter,
  communityId: string,
  channelId: string,
  descriptor: CommunityDescriptor,
): Map<string, ThreadSticker[]> {
  const overlay = getCanvasForSubject(db, communityId, 'thread_overlay', channelId);
  const byMessage = new Map<string, ThreadSticker[]>();
  if (!overlay) return byMessage;
  const prefs = getRenderPrefs(db, communityId);
  const dialed = applyRenderPrefs(listCanvasNodes(db, overlay.id), [], prefs, descriptor);
  for (const node of dialed.nodes) {
    if (node.parse.status !== 'ok') continue;
    const messageId = node.event.parentId;
    if (!messageId) continue;
    const emoji = node.event.nodeType === 'sticker'
      ? String((node.parse.props as { emoji?: unknown }).emoji ?? '') || null
      : null;
    if (!emoji && !node.event.asset) continue;
    const list = byMessage.get(messageId) ?? [];
    list.push({
      nodeId: node.event.id,
      messageId,
      authorDevice: node.event.authorDevice,
      emoji,
      asset: node.event.asset,
      x: node.event.x,
      y: node.event.y,
      rotation: node.event.rotation,
    });
    byMessage.set(messageId, list);
  }
  return byMessage;
}

/** Remove a sticker (author, or curator on the open layer): a signed tombstone. */
export function removeThreadSticker(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  channelId: string,
  nodeId: string,
  recordChange?: CanvasRecordChange,
): void {
  const overlay = getCanvasForSubject(db, communityId, 'thread_overlay', channelId);
  if (!overlay) throw new Error('No sticker layer exists for this channel yet.');
  const node = listCanvasNodes(db, overlay.id).find((candidate) => candidate.event.id === nodeId);
  if (!node) throw new Error('That sticker is not on this device.');
  tombstoneCanvasNode(db, identity, node.event, recordChange);
}

// --- page templates (feature 52) --------------------------------------------

export interface CanvasTemplateNode {
  nodeType: string;
  props: Record<string, unknown>;
  layer: CommunityCanvasLayer;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z?: number;
  /** Local id so frames can nest inside a template (never a live event id). */
  localId?: string;
  parentLocalId?: string | null;
}

export interface CanvasPageTemplate {
  id: string;
  name: string;
  description: string;
  nodes: CanvasTemplateNode[];
}

/**
 * Host starter layouts (52): closed-vocabulary node sets only, validated by
 * the SAME registry as any member content when applied. No template carries
 * an asset, a URL-shaped value, or anything outside the registry schemas.
 */
export const CANVAS_PAGE_TEMPLATES: readonly CanvasPageTemplate[] = [
  {
    id: 'fan-shrine',
    name: 'Fan shrine',
    description: 'A big title, a marquee-style note, sticker corners, and a guestbook.',
    nodes: [
      { nodeType: 'text', props: { text: 'MY SHRINE', size: 'xl', colorToken: 'accent', align: 'center' }, layer: 'open', x: 30, y: 20, w: 280, h: 60 },
      { nodeType: 'divider', props: {}, layer: 'open', x: 30, y: 90, w: 280, h: 12 },
      { nodeType: 'text', props: { text: 'Welcome to my corner of the burrow. Sign the guestbook!' }, layer: 'open', x: 30, y: 110, w: 280, h: 60 },
      { nodeType: 'sticker', props: { emoji: '✨', size: 'l' }, layer: 'open', x: 8, y: 8, w: 48, h: 48 },
      { nodeType: 'sticker', props: { emoji: '✨', size: 'l' }, layer: 'open', x: 300, y: 8, w: 48, h: 48 },
      { nodeType: 'guestbook', props: {}, layer: 'open', x: 30, y: 190, w: 280, h: 200 },
    ],
  },
  {
    id: 'wiki-page',
    name: 'Wiki page',
    description: 'A heading, a body column, and a divider structure for long-form notes.',
    nodes: [
      { nodeType: 'text', props: { text: 'Title', size: 'l' }, layer: 'open', x: 20, y: 16, w: 300, h: 44 },
      { nodeType: 'divider', props: {}, layer: 'open', x: 20, y: 66, w: 300, h: 10 },
      { nodeType: 'text', props: { text: 'Overview goes here.' }, layer: 'open', x: 20, y: 84, w: 300, h: 120 },
      { nodeType: 'text', props: { text: 'Details', size: 'm' }, layer: 'open', x: 20, y: 216, w: 300, h: 34 },
      { nodeType: 'text', props: { text: 'More to write.' }, layer: 'open', x: 20, y: 254, w: 300, h: 120 },
    ],
  },
  {
    id: 'link-hub',
    name: 'Link hub',
    description: 'A stack of channel link cards under one heading.',
    nodes: [
      { nodeType: 'text', props: { text: 'Start here', size: 'l', align: 'center' }, layer: 'open', x: 40, y: 16, w: 260, h: 44 },
      { nodeType: 'link_card', props: { label: 'Say hello', target: { kind: 'channel', id: 'general' } }, layer: 'open', x: 40, y: 76, w: 260, h: 56 },
      { nodeType: 'link_card', props: { label: 'Read the rules', target: { kind: 'channel', id: 'general' } }, layer: 'open', x: 40, y: 142, w: 260, h: 56 },
      { nodeType: 'link_card', props: { label: 'Share files', target: { kind: 'channel', id: 'general' } }, layer: 'open', x: 40, y: 208, w: 260, h: 56 },
    ],
  },
  {
    id: 'zine',
    name: 'Zine',
    description: 'Rotated text scraps and shapes with a scrapbook feel.',
    nodes: [
      { nodeType: 'shape', props: { shape: 'rect', fillToken: 'surface' }, layer: 'open', x: 16, y: 16, w: 180, h: 130, rotation: -4 },
      { nodeType: 'text', props: { text: 'ISSUE #1', size: 'l' }, layer: 'open', x: 28, y: 34, w: 150, h: 44, rotation: -4 },
      { nodeType: 'shape', props: { shape: 'rect', fillToken: 'surface' }, layer: 'open', x: 150, y: 130, w: 190, h: 150, rotation: 5 },
      { nodeType: 'text', props: { text: 'Words go here. Cut, paste, rearrange.' }, layer: 'open', x: 162, y: 150, w: 166, h: 110, rotation: 5 },
      { nodeType: 'sticker', props: { emoji: '📌', size: 'm' }, layer: 'open', x: 90, y: 6, w: 40, h: 40 },
    ],
  },
  {
    id: 'gallery-wall',
    name: 'Gallery wall',
    description: 'Empty image frames ready for your pictures, plus a counter.',
    nodes: [
      { nodeType: 'text', props: { text: 'Gallery', size: 'l', align: 'center' }, layer: 'open', x: 60, y: 12, w: 220, h: 44 },
      { nodeType: 'image', props: {}, layer: 'open', x: 24, y: 70, w: 140, h: 140 },
      { nodeType: 'image', props: {}, layer: 'open', x: 180, y: 70, w: 140, h: 140 },
      { nodeType: 'image', props: {}, layer: 'open', x: 24, y: 226, w: 140, h: 140 },
      { nodeType: 'image', props: {}, layer: 'open', x: 180, y: 226, w: 140, h: 140 },
      { nodeType: 'counter', props: { label: 'visits' }, layer: 'open', x: 130, y: 380, w: 110, h: 70 },
    ],
  },
];

/**
 * Apply a set of template nodes to a canvas as THIS author's own signed
 * events (registry-validated per node, exactly like hand placement). Nodes
 * the registry rejects are skipped and counted honestly, never guessed at.
 */
export function applyCanvasTemplateNodes(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  canvas: CommunityCanvasEvent,
  nodes: readonly CanvasTemplateNode[],
  recordChange?: CanvasRecordChange,
): { placed: number; skipped: number } {
  let placed = 0;
  let skipped = 0;
  const localToReal = new Map<string, string>();
  for (const node of nodes) {
    try {
      const parentId = node.parentLocalId ? localToReal.get(node.parentLocalId) ?? null : null;
      const event = placeCanvasNode(db, identity, {
        canvasId: canvas.id,
        communityId: canvas.communityId,
        nodeType: node.nodeType,
        props: node.props,
        layer: node.layer,
        x: node.x,
        y: node.y,
        w: node.w,
        h: node.h,
        rotation: node.rotation ?? 0,
        z: node.z ?? 0,
        parentId,
      }, recordChange);
      if (node.localId) localToReal.set(node.localId, event.id);
      placed += 1;
    } catch {
      skipped += 1;
    }
  }
  return { placed, skipped };
}

/**
 * Export a canvas as a shareable snapshot blob (the meerkat-canvas codec).
 * Sealed assets never travel in a template (their blocks are membership-
 * gated); asset nodes are skipped with an honest count.
 */
export function exportCanvasTemplate(
  db: DatabaseAdapter,
  canvasId: string,
): { blob: string; exported: number; skippedAssets: number } | null {
  const canvas = getCanvasById(db, canvasId);
  if (!canvas) return null;
  const nodes = listCanvasNodes(db, canvasId);
  const snapshotNodes: MkCanvasSnapshot['nodes'] = [];
  let skippedAssets = 0;
  const idToLocal = new Map<string, string>();
  nodes.forEach((node, index) => idToLocal.set(node.event.id, `n${index}`));
  for (const node of nodes) {
    if (node.parse.status !== 'ok') continue;
    if (node.event.asset) { skippedAssets += 1; continue; }
    snapshotNodes.push({
      nodeType: node.event.nodeType,
      schemaVersion: node.event.schemaVersion,
      layer: node.event.layer,
      geometry: {
        x: node.event.x,
        y: node.event.y,
        w: node.event.w,
        h: node.event.h,
        rotation: node.event.rotation,
        z: node.event.z,
      },
      props: node.parse.props,
      parentId: node.event.parentId ? idToLocal.get(node.event.parentId) ?? null : null,
      localId: idToLocal.get(node.event.id)!,
    });
  }
  const blob = encodeCanvasBlob({
    kind: canvas.kind as MkCanvasSnapshot['kind'],
    policy: parseCanvasPolicy(canvas.policyJson),
    nodes: snapshotNodes,
  });
  return { blob, exported: snapshotNodes.length, skippedAssets };
}

/**
 * Import a shared snapshot blob onto a canvas: strict codec decode (size cap,
 * CRC, schema), then every node re-validates through the registry and lands
 * as the IMPORTER's own signed events (attribution rides the signature chain).
 */
export function importCanvasTemplate(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  canvas: CommunityCanvasEvent,
  blob: string,
  recordChange?: CanvasRecordChange,
): { placed: number; skipped: number } {
  const decoded = decodeCanvasBlob(blob.trim());
  if (!decoded.success) throw new Error('That template code is not valid or is from a newer app version.');
  const nodes: CanvasTemplateNode[] = decoded.snapshot.nodes.map((node) => ({
    nodeType: node.nodeType,
    props: node.props,
    layer: node.layer as CommunityCanvasLayer,
    x: node.geometry.x,
    y: node.geometry.y,
    w: node.geometry.w,
    h: node.geometry.h,
    rotation: node.geometry.rotation,
    z: node.geometry.z,
    localId: node.localId,
    parentLocalId: node.parentId,
  }));
  return applyCanvasTemplateNodes(db, identity, canvas, nodes, recordChange);
}

// --- the Plaza pixel board (C3, features 6/18) -------------------------------

export const PLAZA_SUBJECT_ID = 'plaza';

/** The community's Plaza board (owner-created pixel_board), or null. */
export function getPlaza(db: DatabaseAdapter, communityId: string): CommunityCanvasEvent | null {
  return getCanvasForSubject(db, communityId, 'pixel_board', PLAZA_SUBJECT_ID);
}

/**
 * Owner-only: create (or reconfigure) the community Plaza. The grid and the
 * per-member interval ride the owner-signed policy; the sync validator clamps
 * the interval to the protocol minimum regardless.
 */
export function ensurePlaza(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  communityId: string,
  config?: { w: number; h: number; intervalSeconds: number },
  recordChange?: CanvasRecordChange,
): CommunityCanvasEvent {
  const existing = getPlaza(db, communityId);
  if (existing && !config) return existing;
  return ensureCanvas(db, identity, {
    communityId,
    kind: 'pixel_board',
    subjectId: PLAZA_SUBJECT_ID,
    policy: {
      ...parseCanvasPolicy(existing?.policyJson ?? null),
      pixel: config ?? pixelBoardConfig(existing?.policyJson ?? null),
    },
  }, recordChange);
}

export interface PlazaView {
  board: CommunityCanvasEvent;
  config: { w: number; h: number; intervalSeconds: number };
  /** "x,y" -> last verified placement (the CURRENT board). */
  cells: ReadonlyMap<string, CommunityCanvasPixelEvent>;
  /** Full verified history in placement order (the timelapse). */
  history: readonly CommunityCanvasPixelEvent[];
  /** Epoch ms when THIS device may place again (0 = now). Honest local math. */
  nextPlacementAt: number;
}

/** The verified Plaza state, or null when no board exists here yet. */
export function resolvePlaza(
  db: DatabaseAdapter,
  communityId: string,
  selfDeviceId: string,
): PlazaView | null {
  const board = getPlaza(db, communityId);
  if (!board) return null;
  const stored = getCommunity(db, communityId);
  if (!stored) return null;
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM ${CM_CANVAS_PIXELS_TABLE} WHERE canvas_id = ? ORDER BY created_at ASC, id ASC`,
    [board.id],
  );
  const events: CommunityCanvasPixelEvent[] = [];
  for (const row of rows) {
    const event = canvasPixelEventFromRow(row);
    if (event) events.push(event);
  }
  const membershipOf = (deviceId: string) =>
    stored.descriptor.members.some((member) => member.deviceId === deviceId)
    || deviceId === stored.descriptor.ownerDeviceId;
  const config = pixelBoardConfig(board.policyJson);
  const { cells, ordered } = resolveCanvasPixels(events, membershipOf, config.intervalSeconds);
  let nextPlacementAt = 0;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    if (ordered[i]!.signedBy !== selfDeviceId) continue;
    nextPlacementAt = new Date(ordered[i]!.createdAt).getTime() + config.intervalSeconds * 1000;
    break;
  }
  return { board, config, cells, history: ordered, nextPlacementAt };
}

/**
 * Place one pixel: pre-checks the interval and grid HONESTLY (the same rules
 * the apply-time validator enforces on every receiving device), signs, and
 * records for replication.
 */
export function placePlazaPixel(
  db: DatabaseAdapter,
  identity: DeviceIdentity,
  input: { communityId: string; x: number; y: number; colorIndex: number },
  recordChange?: CanvasRecordChange,
): CommunityCanvasPixelEvent {
  const plaza = resolvePlaza(db, input.communityId, identity.publicKey);
  if (!plaza) throw new Error('This community has no Plaza yet.');
  if (input.x < 0 || input.y < 0 || input.x >= plaza.config.w || input.y >= plaza.config.h) {
    throw new Error('That spot is outside the board.');
  }
  const waitMs = plaza.nextPlacementAt - Date.now();
  if (waitMs > 0) {
    throw new Error(`You can place again in ${Math.ceil(waitMs / 1000)} seconds.`);
  }
  const event = createCanvasPixelEvent(identity, {
    canvasId: plaza.board.id,
    communityId: input.communityId,
    x: input.x,
    y: input.y,
    colorIndex: input.colorIndex,
  });
  const row = canvasPixelEventToRow(event);
  db.execute(
    `INSERT OR IGNORE INTO ${CM_CANVAS_PIXELS_TABLE} (id, canvas_id, community_id, x, y, color_index, author_device, created_at, signed_by, signature)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.canvas_id, row.community_id, row.x, row.y, row.color_index, row.author_device, row.created_at, row.signed_by, row.signature],
  );
  recordChange?.(CM_CANVAS_PIXELS_TABLE, 'INSERT', event.id, row);
  return event;
}

// --- drafts (device-local, 8) ------------------------------------------------

export interface CanvasDraftRow {
  id: string;
  communityId: string;
  canvasId: string | null;
  kind: string;
  snapshot: MkCanvasSnapshot;
  updatedAt: string;
}

export function saveCanvasDraft(
  db: DatabaseAdapter,
  input: { id: string; communityId: string; canvasId: string | null; kind: string; snapshot: MkCanvasSnapshot },
): void {
  db.execute(
    `INSERT OR REPLACE INTO mk_canvas_drafts (id, community_id, canvas_id, kind, draft_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.id, input.communityId, input.canvasId, input.kind, encodeCanvasBlob(input.snapshot), new Date().toISOString()],
  );
}

/** Load a draft; a malformed/undecodable draft is dropped, never a crash. */
export function loadCanvasDraft(db: DatabaseAdapter, id: string): CanvasDraftRow | null {
  const rows = db.query<{ id: string; community_id: string; canvas_id: string | null; kind: string; draft_json: string; updated_at: string }>(
    `SELECT * FROM mk_canvas_drafts WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  const decoded = decodeCanvasBlob(row.draft_json);
  if (!decoded.success) {
    db.execute(`DELETE FROM mk_canvas_drafts WHERE id = ?`, [id]);
    return null;
  }
  return {
    id: row.id,
    communityId: row.community_id,
    canvasId: row.canvas_id,
    kind: row.kind,
    snapshot: decoded.snapshot,
    updatedAt: row.updated_at,
  };
}

export function deleteCanvasDraft(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM mk_canvas_drafts WHERE id = ?`, [id]);
}
