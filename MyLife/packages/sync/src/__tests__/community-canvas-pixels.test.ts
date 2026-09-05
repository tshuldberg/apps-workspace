/**
 * Plan 56 C3 (features 6/18): the Plaza pixel events. Proves the closed
 * palette + bounded grid at create and verify, author-binding, canonical-UTC
 * createdAt enforcement (pure), row serde totality, deterministic
 * last-writer-per-cell resolution with the ordered history (the timelapse) from
 * the same verified rows, the policy-driven board config (owner may only go
 * stricter), and apply-time validation as ONLY order-independent gates (member
 * only, board must exist and verify, in-grid, ingest-only far-future reject,
 * per-member storage cap, raw DELETE rejected) so peers converge. Rate limiting
 * is the deterministic resolve-time collapse, verified here for convergence
 * across delivery order. Plus the frozen fixture lock.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase, type DatabaseAdapter } from '@mylife/db';
import { generateDeviceIdentity } from '../identity/device-identity';
import { createSyncTables } from '../db/schema';
import { createCommunity, upsertCommunity } from '../protocol/community';
import {
  COMMUNITY_CANVAS_PIXELS_TABLE,
  COMMUNITY_CANVAS_TABLE,
  SYNC_PIXEL_GRID_DEFAULT,
  SYNC_PIXEL_MIN_INTERVAL_SECONDS,
  SYNC_PIXEL_MAX_STORED_PER_MEMBER,
  SYNC_PIXEL_MAX_FUTURE_SKEW_MS,
  SYNC_PIXEL_PALETTE,
  canvasEventToRow,
  canvasPixelEventFromRow,
  canvasPixelEventToRow,
  createCanvasEvent,
  createCanvasPixelEvent,
  pixelBoardConfig,
  resolveCanvasPixels,
  validateCanvasPixelRow,
  verifyCanvasPixelEvent,
} from '../protocol/community-canvas';
import { isSignedRowTable, validateSignedInboundRow } from '../protocol/inbound-row-validators';
import pixelFixture from './fixtures/legacy-community-canvas-pixel-event.json';

const owner = generateDeviceIdentity('Owner');
const member = generateDeviceIdentity('Member');
const stranger = generateDeviceIdentity('Stranger');

const signed = createCommunity(owner, {
  name: 'Burrow',
  channels: [{ id: 'general', name: 'general' }],
  members: [{ deviceId: member.publicKey, role: 'member' }],
});
const d = signed.descriptor;
const communityId = d.communityId;
const BOARD_ID = 'ab'.repeat(16);

const board = createCanvasEvent(owner, {
  id: BOARD_ID,
  communityId,
  kind: 'pixel_board',
  subjectId: 'plaza',
  revision: 1,
  policyJson: JSON.stringify({
    layers: { background: 'owner', structure: 'curator', open: 'member' },
    memberBuild: true,
    layout: 'free',
    pixel: { w: 64, h: 64, intervalSeconds: 60 },
  }),
});

const membershipOf = (deviceId: string) => d.members.some((m) => m.deviceId === deviceId) || deviceId === d.ownerDeviceId;

describe('pixel events', () => {
  it('closed palette + bounded grid at create AND verify; author-bound', () => {
    const pixel = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 3, y: 5, colorIndex: 7 });
    expect(verifyCanvasPixelEvent(pixel)).toBe(true);
    expect(() => createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 3, y: 5, colorIndex: 16 })).toThrow(/palette/);
    expect(() => createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: -1, y: 5, colorIndex: 0 })).toThrow(/inside the board/);
    expect(() => createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 512, y: 0, colorIndex: 0 })).toThrow(/inside the board/);
    expect(verifyCanvasPixelEvent({ ...pixel, colorIndex: 99 })).toBe(false);
    expect(verifyCanvasPixelEvent({ ...pixel, x: 4 })).toBe(false);
    expect(verifyCanvasPixelEvent({ ...pixel, authorDevice: stranger.publicKey })).toBe(false);
    expect(SYNC_PIXEL_PALETTE).toHaveLength(16);
  });

  it('createdAt must be canonical UTC (pure format gate; closes cross-device divergence)', () => {
    // create rejects a non-canonical timestamp outright.
    expect(() => createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 0, createdAt: '2026-08-29T12:00:00' }))
      .toThrow(/canonical UTC/);
    expect(() => createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 0, createdAt: '2026-08-29T12:00:00.000' }))
      .toThrow(/canonical UTC/);
    // verify is a PURE function of the event: a canonical createdAt passes,
    // any non-canonical (no Z / missing ms / local-time) form fails, so the
    // resolver's `new Date(createdAt).getTime()` is identical on every device.
    const good = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 0, createdAt: '2026-08-29T12:00:00.000Z' });
    expect(verifyCanvasPixelEvent(good)).toBe(true);
    expect(verifyCanvasPixelEvent({ ...good, createdAt: '2026-08-29T12:00:00' })).toBe(false);
    expect(verifyCanvasPixelEvent({ ...good, createdAt: '2026-08-29T12:00:00Z' })).toBe(false);
    expect(verifyCanvasPixelEvent({ ...good, createdAt: '2026-08-29T12:00:00.000+00:00' })).toBe(false);
  });

  it('row serde is total', () => {
    const pixel = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 1, y: 2, colorIndex: 3 });
    expect(canvasPixelEventFromRow(canvasPixelEventToRow(pixel))).toEqual(pixel);
    expect(canvasPixelEventFromRow({ ...canvasPixelEventToRow(pixel), x: 'one' })).toBeNull();
  });

  it('resolution: last verified writer per cell; ordered history is the timelapse; strangers drop', () => {
    // Same-member placements are spaced >= the protocol interval so both count;
    // owner is a different member and never rate-limits against the member.
    const a = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 1, createdAt: '2026-08-29T10:00:00.000Z' });
    const b = createCanvasPixelEvent(owner, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 2, createdAt: '2026-08-29T10:00:01.000Z' });
    const c = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 1, y: 0, colorIndex: 3, createdAt: '2026-08-29T10:00:35.000Z' });
    const forged = createCanvasPixelEvent(stranger, { canvasId: BOARD_ID, communityId, x: 2, y: 0, colorIndex: 4, createdAt: '2026-08-29T10:00:40.000Z' });
    const { cells, ordered } = resolveCanvasPixels([c, forged, b, a], membershipOf);
    expect(ordered.map((e) => e.id)).toEqual([a.id, b.id, c.id]);
    expect(cells.get('0,0')!.colorIndex).toBe(2);
    expect(cells.get('1,0')!.colorIndex).toBe(3);
    expect(cells.has('2,0')).toBe(false);
  });

  it('resolve-time interval is the AUTHORITATIVE rate limit: order-independent, per-member, unforgeable by arrival order', () => {
    const ts = '2026-08-29T12:00:00.000Z';
    // A member floods ten DISTINCT cells all carrying ONE identical timestamp.
    // However these rows landed on this device (here: descending id, the order
    // that defeats the apply-time validator), resolution keeps exactly one --
    // the earliest by (createdAt, id) -- so a flood paints at most one cell per
    // member per window. The whole board can never be painted in one instant.
    const burst = Array.from({ length: 10 }, (_, i) =>
      createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: i, y: 5, colorIndex: 1, createdAt: ts }),
    );
    const lowestId = [...burst].sort((a, b) => (a.id < b.id ? -1 : 1))[0]!;
    const descending = [...burst].sort((a, b) => (a.id > b.id ? -1 : 1));
    const { cells, ordered } = resolveCanvasPixels(descending, membershipOf);
    expect(ordered).toHaveLength(1);
    expect(ordered[0]!.id).toBe(lowestId.id);
    expect(cells.size).toBe(1);
    // Sub-interval spacing (default 30 s) is also collapsed; a different member
    // at the same instant is unaffected (per-member window).
    const closeA = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 2, createdAt: '2026-08-29T13:00:00.000Z' });
    const closeB = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 1, y: 0, colorIndex: 2, createdAt: '2026-08-29T13:00:29.999Z' });
    const otherMember = createCanvasPixelEvent(owner, { canvasId: BOARD_ID, communityId, x: 2, y: 0, colorIndex: 2, createdAt: '2026-08-29T13:00:00.000Z' });
    const second = resolveCanvasPixels([closeB, otherMember, closeA], membershipOf);
    expect(second.ordered.map((e) => e.signedBy).sort()).toEqual([member.publicKey, owner.publicKey].sort());
    expect(second.ordered.some((e) => e.id === closeB.id)).toBe(false);
    // Exactly-interval spacing is kept (strict boundary), matching apply-time.
    const exact = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 3, y: 0, colorIndex: 2, createdAt: '2026-08-29T13:00:30.000Z' });
    const third = resolveCanvasPixels([closeA, exact], membershipOf);
    expect(third.ordered).toHaveLength(2);
  });

  it('pixelBoardConfig clamps: never looser than the protocol minimum, malformed falls back', () => {
    expect(pixelBoardConfig(board.policyJson)).toEqual({ w: 64, h: 64, intervalSeconds: 60 });
    expect(pixelBoardConfig(JSON.stringify({ pixel: { w: 9999, h: 4, intervalSeconds: 1 } })))
      .toEqual({ w: SYNC_PIXEL_GRID_DEFAULT, h: SYNC_PIXEL_GRID_DEFAULT, intervalSeconds: SYNC_PIXEL_MIN_INTERVAL_SECONDS });
    expect(pixelBoardConfig('not json')).toEqual({ w: SYNC_PIXEL_GRID_DEFAULT, h: SYNC_PIXEL_GRID_DEFAULT, intervalSeconds: SYNC_PIXEL_MIN_INTERVAL_SECONDS });
    expect(pixelBoardConfig(null).intervalSeconds).toBe(SYNC_PIXEL_MIN_INTERVAL_SECONDS);
  });
});

describe('apply-time validator', () => {
  let testDb: InMemoryTestDatabase | null = null;
  afterEach(() => { testDb?.close(); testDb = null; });

  function freshDb() {
    testDb = createInMemoryTestDatabase();
    const db = testDb.adapter;
    createSyncTables(db);
    db.execute(`CREATE TABLE ${COMMUNITY_CANVAS_TABLE} (
      id TEXT PRIMARY KEY, community_id TEXT NOT NULL, kind TEXT NOT NULL, subject_id TEXT NOT NULL,
      policy_json TEXT, revision INTEGER NOT NULL, tombstone INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL, signed_by TEXT NOT NULL, signature TEXT NOT NULL
    )`);
    db.execute(`CREATE TABLE ${COMMUNITY_CANVAS_PIXELS_TABLE} (
      id TEXT PRIMARY KEY, canvas_id TEXT NOT NULL, community_id TEXT NOT NULL,
      x INTEGER NOT NULL, y INTEGER NOT NULL, color_index INTEGER NOT NULL,
      author_device TEXT NOT NULL, created_at TEXT NOT NULL, signed_by TEXT NOT NULL, signature TEXT NOT NULL
    )`);
    upsertCommunity(db, signed, owner.publicKey);
    const row = canvasEventToRow(board);
    db.execute(
      `INSERT INTO ${COMMUNITY_CANVAS_TABLE} (id, community_id, kind, subject_id, policy_json, revision, tombstone, updated_at, signed_by, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.community_id, row.kind, row.subject_id, row.policy_json, row.revision, row.tombstone, row.updated_at, row.signed_by, row.signature],
    );
    return db;
  }

  it('accepts a member pixel; rejects strangers, unknown boards, out-of-grid, and raw DELETE', () => {
    const db = freshDb();
    expect(isSignedRowTable(COMMUNITY_CANVAS_PIXELS_TABLE)).toBe(true);
    const good = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 10, y: 10, colorIndex: 5 });
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: good.id, operation: 'INSERT', data: canvasPixelEventToRow(good) }))
      .toEqual({ ok: true });
    const foreign = createCanvasPixelEvent(stranger, { canvasId: BOARD_ID, communityId, x: 1, y: 1, colorIndex: 5 });
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: foreign.id, operation: 'INSERT', data: canvasPixelEventToRow(foreign) }))
      .toEqual({ ok: false, reason: 'canvas_pixel_not_member' });
    const noBoard = createCanvasPixelEvent(member, { canvasId: 'cd'.repeat(16), communityId, x: 1, y: 1, colorIndex: 5 });
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: noBoard.id, operation: 'INSERT', data: canvasPixelEventToRow(noBoard) }))
      .toEqual({ ok: false, reason: 'canvas_pixel_board_unknown' });
    // 64x64 policy grid beats the 512 structural max.
    const outside = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 100, y: 10, colorIndex: 5 });
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: outside.id, operation: 'INSERT', data: canvasPixelEventToRow(outside) }))
      .toEqual({ ok: false, reason: 'canvas_pixel_out_of_grid' });
    expect(validateSignedInboundRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: 'x', operation: 'DELETE', data: null }))
      .toEqual({ ok: false, reason: 'signed_row_delete_rejected' });
  });

  // Apply the given events through validateCanvasPixelRow in the caller's
  // order, INSERT OR IGNORE each accepted row, and report the stored set.
  function applyAll(db: DatabaseAdapter, events: readonly ReturnType<typeof createCanvasPixelEvent>[]): Set<string> {
    const stored = new Set<string>();
    for (const pixel of events) {
      const verdict = validateCanvasPixelRow(db, {
        table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: pixel.id, operation: 'INSERT', data: canvasPixelEventToRow(pixel),
      });
      if (!verdict.ok) continue;
      const row = canvasPixelEventToRow(pixel);
      db.execute(
        `INSERT OR IGNORE INTO ${COMMUNITY_CANVAS_PIXELS_TABLE} (id, canvas_id, community_id, x, y, color_index, author_device, created_at, signed_by, signature)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [row.id, row.canvas_id, row.community_id, row.x, row.y, row.color_index, row.author_device, row.created_at, row.signed_by, row.signature],
      );
      stored.add(pixel.id);
    }
    return stored;
  }

  function storedEvents(db: DatabaseAdapter): ReturnType<typeof createCanvasPixelEvent>[] {
    const rows = db.query<Record<string, unknown>>(`SELECT * FROM ${COMMUNITY_CANVAS_PIXELS_TABLE} WHERE canvas_id = ?`, [BOARD_ID]);
    return rows.map((r) => canvasPixelEventFromRow(r)!).filter(Boolean);
  }

  it('apply time no longer rate-rejects: a sub-interval second placement is ACCEPTED and stored (rate limiting moved to resolve)', () => {
    const db = freshDb();
    const first = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 1, y: 1, colorIndex: 1, createdAt: '2026-08-29T10:00:00.000Z' });
    const row = canvasPixelEventToRow(first);
    db.execute(
      `INSERT INTO ${COMMUNITY_CANVAS_PIXELS_TABLE} (id, canvas_id, community_id, x, y, color_index, author_device, created_at, signed_by, signature)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [row.id, row.canvas_id, row.community_id, row.x, row.y, row.color_index, row.author_device, row.created_at, row.signed_by, row.signature],
    );
    // 30 s later: inside the board's 60 s interval. The apply-time validator
    // used to REJECT this (an order-dependent, divergent check). It now ACCEPTS:
    // every validly-signed pixel converges into storage; the resolver alone
    // collapses the pair.
    const tooSoon = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 2, y: 1, colorIndex: 2, createdAt: '2026-08-29T10:00:30.000Z' });
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: tooSoon.id, operation: 'INSERT', data: canvasPixelEventToRow(tooSoon) }))
      .toEqual({ ok: true });
  });

  it('convergence: the same verified set stored in ANY order yields the identical resolved board + ordered history', () => {
    // Codex counterexample (board interval 60 s, one member): Q@T, P@T+20,
    // E@T+40. Under the OLD apply-time reject, delivery order [Q,P,E] stored
    // {Q,E} while [E,P,Q] stored {Q} -- permanent divergence. Now BOTH orders
    // store all three, and resolve to the same board.
    const T = '2026-08-29T15:00:00.000Z';
    const q = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 0, y: 0, colorIndex: 1, createdAt: T });
    const p = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 1, y: 0, colorIndex: 2, createdAt: '2026-08-29T15:00:20.000Z' });
    const e = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 2, y: 0, colorIndex: 3, createdAt: '2026-08-29T15:00:40.000Z' });

    const dbA = freshDb();
    const storedA = applyAll(dbA, [q, p, e]);
    const resolveA = resolveCanvasPixels(storedEvents(dbA), membershipOf, 60);
    testDb?.close(); testDb = null;

    const dbB = freshDb();
    const storedB = applyAll(dbB, [e, p, q]);
    const resolveB = resolveCanvasPixels(storedEvents(dbB), membershipOf, 60);

    // Every valid pixel converges into storage regardless of order.
    expect([...storedA].sort()).toEqual([q.id, p.id, e.id].sort());
    expect([...storedB].sort()).toEqual([q.id, p.id, e.id].sort());
    // And the resolved board + timelapse are byte-for-byte identical.
    expect(resolveA.ordered.map((x) => x.id)).toEqual(resolveB.ordered.map((x) => x.id));
    expect([...resolveA.cells.keys()].sort()).toEqual([...resolveB.cells.keys()].sort());
    // Only the earliest-in-window survives: just Q renders.
    expect(resolveA.ordered.map((x) => x.id)).toEqual([q.id]);
    expect(resolveA.cells.size).toBe(1);
  });

  it('a future-dated flood is rejected at INGEST, but pure verify/resolve are unaffected', () => {
    const db = freshDb();
    // A member signs a placement dated far in the future. It is canonical UTC,
    // so the PURE gates accept it: verify passes and the resolver (no wall
    // clock) would render it -- future timestamps otherwise win last-writer
    // forever (codex defect 1).
    const future = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 4, y: 4, colorIndex: 6, createdAt: '2099-01-01T00:00:00.000Z' });
    expect(verifyCanvasPixelEvent(future)).toBe(true);
    expect(resolveCanvasPixels([future], membershipOf, 60).ordered).toHaveLength(1);
    // But the INGEST validator drops it: a wall-clock reject the pure path
    // cannot make. Only devices near real time enforce it; that is enough.
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: future.id, operation: 'INSERT', data: canvasPixelEventToRow(future) }))
      .toEqual({ ok: false, reason: 'canvas_pixel_future_skew' });
    // A placement just inside the skew window is fine.
    const soonIso = new Date(Date.now() + SYNC_PIXEL_MAX_FUTURE_SKEW_MS - 60_000).toISOString();
    const soon = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 5, y: 5, colorIndex: 6, createdAt: soonIso });
    expect(validateCanvasPixelRow(db, { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: soon.id, operation: 'INSERT', data: canvasPixelEventToRow(soon) }))
      .toEqual({ ok: true });
  });

  it('storage cap is PER-MEMBER by COUNT: a flooder at cap never freezes another member', () => {
    const db = freshDb();
    // member A (member) and member B (owner is also a member via membershipOf).
    const pixelA = createCanvasPixelEvent(member, { canvasId: BOARD_ID, communityId, x: 6, y: 6, colorIndex: 8 });
    const pixelB = createCanvasPixelEvent(owner, { canvasId: BOARD_ID, communityId, x: 7, y: 7, colorIndex: 9 });
    const changeA = { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: pixelA.id, operation: 'INSERT', data: canvasPixelEventToRow(pixelA) };
    const changeB = { table: COMMUNITY_CANVAS_PIXELS_TABLE, rowId: pixelB.id, operation: 'INSERT', data: canvasPixelEventToRow(pixelB) };
    // Reaching the real cap (262144 rows) in a unit test is impractical, so drive
    // the per-signer COUNT the validator reads. The COUNT is scoped by signed_by
    // (params[1]); return the cap only for the flooding signer, 0 for everyone
    // else, exactly as SQLite would with `AND signed_by = ?`.
    const withMemberAtCap = (cappedSigner: string): DatabaseAdapter => new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'query') {
          return (sql: string, params?: unknown[]) => {
            if (sql.includes(COMMUNITY_CANVAS_PIXELS_TABLE) && sql.includes('COUNT(*)')) {
              const signer = params?.[1];
              return [{ n: signer === cappedSigner ? SYNC_PIXEL_MAX_STORED_PER_MEMBER : 0 }];
            }
            return target.query(sql, params);
          };
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    }) as unknown as DatabaseAdapter;
    // Below cap for everyone: both accepted.
    const withCount = (n: number): DatabaseAdapter => new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'query') {
          return (sql: string, params?: unknown[]) => {
            if (sql.includes(COMMUNITY_CANVAS_PIXELS_TABLE) && sql.includes('COUNT(*)')) return [{ n }];
            return target.query(sql, params);
          };
        }
        const v = Reflect.get(target, prop, receiver);
        return typeof v === 'function' ? v.bind(target) : v;
      },
    }) as unknown as DatabaseAdapter;
    expect(validateCanvasPixelRow(withCount(SYNC_PIXEL_MAX_STORED_PER_MEMBER - 1), changeA)).toEqual({ ok: true });
    // member A at their per-member cap: A's own next placement is rejected...
    const aAtCap = withMemberAtCap(member.publicKey);
    expect(validateCanvasPixelRow(aAtCap, changeA)).toEqual({ ok: false, reason: 'canvas_pixel_storage_cap' });
    // ...but member B, whose per-member count is 0, is NEVER frozen out by A.
    expect(validateCanvasPixelRow(aAtCap, changeB)).toEqual({ ok: true });
  });
});

describe('frozen fixture (canonical-bytes lock)', () => {
  it('the frozen pixel still verifies byte-for-byte', () => {
    const f = pixelFixture as { pixel: Parameters<typeof verifyCanvasPixelEvent>[0] };
    expect(verifyCanvasPixelEvent(f.pixel)).toBe(true);
    expect(verifyCanvasPixelEvent({ ...f.pixel, colorIndex: 9 })).toBe(false);
  });
});
