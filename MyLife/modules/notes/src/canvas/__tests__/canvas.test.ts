import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createModuleTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { NOTES_MODULE } from '../../definition';

// Canvas CRUD
import {
  createCanvas,
  getCanvases,
  getCanvasById,
  updateCanvas,
  deleteCanvas,
  duplicateCanvas,
  addNode,
  moveNode,
  resizeNode,
  deleteNode,
  bringToFront,
  getNodesForCanvas,
  addEdge,
  deleteEdge,
  getEdgesForCanvas,
  groupNodes,
  ungroupNodes,
} from '../../db/canvas';

// Canvas engine
import {
  viewportCull,
  zoomToFit,
  getMaxZIndex,
  hitTestNode,
  selectNodesInRect,
  computeBoundingBox,
  getGroupChildren,
  computeGroupMove,
} from '../engine';

// Canvas layout
import {
  snapToGrid,
  snapPositionToGrid,
  clampZoom,
  screenToCanvas,
  canvasToScreen,
} from '../layout';

// Canvas serializer
import {
  parseCanvasJson,
  stringifyCanvasJson,
  serializeCanvas,
  extractViewport,
} from '../serializer';

import type { CanvasNode } from '../types';

let testDb: InMemoryTestDatabase;

beforeEach(() => {
  testDb = createModuleTestDatabase('notes', NOTES_MODULE.migrations!);
});

afterEach(() => {
  testDb.close();
});

// ── Canvas CRUD ──────────────────────────────────────────────────────

describe('Canvas CRUD', () => {
  it('creates a canvas with default title', () => {
    const c = createCanvas(testDb.adapter, 'c1', {});
    expect(c.id).toBe('c1');
    expect(c.title).toBe('Untitled Canvas');
    expect(c.nodeCount).toBe(0);
    expect(c.edgeCount).toBe(0);
    expect(c.isPinned).toBe(false);
    const json = JSON.parse(c.canvasJson);
    expect(json.nodes).toEqual([]);
    expect(json.viewport.zoom).toBe(1);
  });

  it('creates a canvas with custom title and folder', () => {
    const c = createCanvas(testDb.adapter, 'c2', { title: 'My Board', description: 'A test', folderId: null });
    expect(c.title).toBe('My Board');
    expect(c.description).toBe('A test');
  });

  it('lists canvases sorted by pinned first, then updated_at desc', () => {
    createCanvas(testDb.adapter, 'c1', { title: 'Old' });
    createCanvas(testDb.adapter, 'c2', { title: 'New' });
    updateCanvas(testDb.adapter, 'c1', { isPinned: true });

    const all = getCanvases(testDb.adapter);
    expect(all).toHaveLength(2);
    expect(all[0].title).toBe('Old'); // pinned first
    expect(all[0].isPinned).toBe(true);
  });

  it('gets canvas by id', () => {
    createCanvas(testDb.adapter, 'c1', { title: 'Test' });
    const c = getCanvasById(testDb.adapter, 'c1');
    expect(c).not.toBeNull();
    expect(c!.title).toBe('Test');
  });

  it('returns null for non-existent canvas', () => {
    expect(getCanvasById(testDb.adapter, 'nope')).toBeNull();
  });

  it('updates canvas title and canvasJson', () => {
    createCanvas(testDb.adapter, 'c1', {});
    const updated = updateCanvas(testDb.adapter, 'c1', {
      title: 'Renamed',
      canvasJson: '{"nodes":[],"edges":[],"groups":[],"viewport":{"x":10,"y":20,"zoom":2}}',
    });
    expect(updated!.title).toBe('Renamed');
    expect(JSON.parse(updated!.canvasJson).viewport.zoom).toBe(2);
  });

  it('deletes a canvas and cascade-deletes nodes and edges', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', { x: 0, y: 0 });
    addNode(testDb.adapter, 'n2', 'c1', { x: 100, y: 100 });
    addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n2' });

    deleteCanvas(testDb.adapter, 'c1');
    expect(getCanvasById(testDb.adapter, 'c1')).toBeNull();
    expect(getNodesForCanvas(testDb.adapter, 'c1')).toHaveLength(0);
    expect(getEdgesForCanvas(testDb.adapter, 'c1')).toHaveLength(0);
  });

  it('duplicates a canvas', () => {
    createCanvas(testDb.adapter, 'c1', { title: 'Original' });
    const dup = duplicateCanvas(testDb.adapter, 'c1', 'c2');
    expect(dup).not.toBeNull();
    expect(dup!.title).toBe('Original (Copy)');
    expect(dup!.isPinned).toBe(false);
  });
});

// ── Node CRUD ────────────────────────────────────────────────────────

describe('Node CRUD', () => {
  it('adds a node with correct position and type', () => {
    createCanvas(testDb.adapter, 'c1', {});
    const n = addNode(testDb.adapter, 'n1', 'c1', { nodeType: 'text', x: 50, y: 100, w: 200, h: 120 });
    expect(n.nodeType).toBe('text');
    expect(n.x).toBe(50);
    expect(n.y).toBe(100);
    expect(n.w).toBe(200);
    expect(n.h).toBe(120);
  });

  it('increments canvas node_count', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    const c = getCanvasById(testDb.adapter, 'c1');
    expect(c!.nodeCount).toBe(2);
  });

  it('enforces minimum size (80x40)', () => {
    createCanvas(testDb.adapter, 'c1', {});
    const n = addNode(testDb.adapter, 'n1', 'c1', { w: 10, h: 5 });
    expect(n.w).toBe(80);
    expect(n.h).toBe(40);
  });

  it('moves a node', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', { x: 0, y: 0 });
    moveNode(testDb.adapter, 'n1', 200, 300);
    const nodes = getNodesForCanvas(testDb.adapter, 'c1');
    expect(nodes[0].x).toBe(200);
    expect(nodes[0].y).toBe(300);
  });

  it('resizes a node with min enforcement', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    resizeNode(testDb.adapter, 'n1', 30, 10);
    const nodes = getNodesForCanvas(testDb.adapter, 'c1');
    expect(nodes[0].w).toBe(80);
    expect(nodes[0].h).toBe(40);
  });

  it('deletes a node and connected edges, decrements counts', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n2' });

    deleteNode(testDb.adapter, 'n1', 'c1');
    const c = getCanvasById(testDb.adapter, 'c1');
    expect(c!.nodeCount).toBe(1);
    expect(c!.edgeCount).toBe(0);
    expect(getEdgesForCanvas(testDb.adapter, 'c1')).toHaveLength(0);
  });

  it('returns nodes sorted by z_index', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    addNode(testDb.adapter, 'n3', 'c1', {});
    const nodes = getNodesForCanvas(testDb.adapter, 'c1');
    expect(nodes[0].id).toBe('n1');
    expect(nodes[2].id).toBe('n3');
    expect(nodes[0].zIndex).toBeLessThan(nodes[2].zIndex);
  });

  it('brings a node to front', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    bringToFront(testDb.adapter, 'n1', 'c1');
    const nodes = getNodesForCanvas(testDb.adapter, 'c1');
    const n1 = nodes.find((n) => n.id === 'n1')!;
    const n2 = nodes.find((n) => n.id === 'n2')!;
    expect(n1.zIndex).toBeGreaterThan(n2.zIndex);
  });
});

// ── Edge CRUD ────────────────────────────────────────────────────────

describe('Edge CRUD', () => {
  it('creates an edge between two nodes', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    const e = addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n2' });
    expect(e).not.toBeNull();
    expect(e!.sourceNodeId).toBe('n1');
    expect(e!.targetNodeId).toBe('n2');
    expect(e!.arrowEnd).toBe(true);
  });

  it('rejects self-loop', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    const e = addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n1' });
    expect(e).toBeNull();
  });

  it('increments canvas edge_count', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n2' });
    const c = getCanvasById(testDb.adapter, 'c1');
    expect(c!.edgeCount).toBe(1);
  });

  it('deletes an edge and decrements count', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n2' });
    deleteEdge(testDb.adapter, 'e1', 'c1');
    expect(getEdgesForCanvas(testDb.adapter, 'c1')).toHaveLength(0);
    const c = getCanvasById(testDb.adapter, 'c1');
    expect(c!.edgeCount).toBe(0);
  });

  it('returns all edges for a canvas', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', {});
    addNode(testDb.adapter, 'n2', 'c1', {});
    addNode(testDb.adapter, 'n3', 'c1', {});
    addEdge(testDb.adapter, 'e1', 'c1', { sourceNodeId: 'n1', targetNodeId: 'n2' });
    addEdge(testDb.adapter, 'e2', 'c1', { sourceNodeId: 'n2', targetNodeId: 'n3' });
    expect(getEdgesForCanvas(testDb.adapter, 'c1')).toHaveLength(2);
  });
});

// ── Group Operations ─────────────────────────────────────────────────

describe('Group Operations', () => {
  it('groups nodes and creates a group node', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', { x: 0, y: 0, w: 100, h: 80 });
    addNode(testDb.adapter, 'n2', 'c1', { x: 200, y: 200, w: 100, h: 80 });

    const group = groupNodes(testDb.adapter, 'g1', 'c1', ['n1', 'n2'], 'My Group', '#FF0000');
    expect(group.nodeType).toBe('group');
    expect(group.label).toBe('My Group');

    const nodes = getNodesForCanvas(testDb.adapter, 'c1');
    const n1 = nodes.find((n) => n.id === 'n1')!;
    const n2 = nodes.find((n) => n.id === 'n2')!;
    expect(n1.groupId).toBe('g1');
    expect(n2.groupId).toBe('g1');
  });

  it('ungroups nodes and removes group node', () => {
    createCanvas(testDb.adapter, 'c1', {});
    addNode(testDb.adapter, 'n1', 'c1', { x: 0, y: 0 });
    addNode(testDb.adapter, 'n2', 'c1', { x: 100, y: 100 });
    groupNodes(testDb.adapter, 'g1', 'c1', ['n1', 'n2']);

    ungroupNodes(testDb.adapter, 'g1', 'c1');
    const nodes = getNodesForCanvas(testDb.adapter, 'c1');
    expect(nodes).toHaveLength(2); // group node removed
    expect(nodes.every((n) => n.groupId === null)).toBe(true);
  });
});

// ── Engine Tests ─────────────────────────────────────────────────────

describe('Canvas Engine', () => {
  function makeNode(overrides: Partial<CanvasNode> = {}): CanvasNode {
    return {
      id: 'n1', canvasId: 'c1', nodeType: 'text', label: '', content: '',
      refNoteId: null, refAttachmentId: null, url: null,
      x: 0, y: 0, w: 200, h: 100, color: '', shape: 'rectangle',
      groupId: null, zIndex: 0, sortOrder: 0,
      createdAt: '', updatedAt: '',
      ...overrides,
    };
  }

  it('viewportCull returns nodes within viewport', () => {
    const nodes = [
      makeNode({ id: 'n1', x: 50, y: 50 }),
      makeNode({ id: 'n2', x: 5000, y: 5000 }),
    ];
    const visible = viewportCull(nodes, { x: 0, y: 0, w: 800, h: 600 });
    expect(visible).toHaveLength(1);
    expect(visible[0].id).toBe('n1');
  });

  it('viewportCull handles zero-node canvas', () => {
    expect(viewportCull([], { x: 0, y: 0, w: 800, h: 600 })).toEqual([]);
  });

  it('viewportCull includes nodes within buffer', () => {
    const nodes = [makeNode({ id: 'n1', x: -150, y: 0, w: 100, h: 100 })];
    const visible = viewportCull(nodes, { x: 0, y: 0, w: 800, h: 600 }, 200);
    expect(visible).toHaveLength(1);
  });

  it('zoomToFit computes viewport fitting all nodes', () => {
    const nodes = [
      makeNode({ id: 'n1', x: 0, y: 0, w: 200, h: 100 }),
      makeNode({ id: 'n2', x: 400, y: 300, w: 200, h: 100 }),
    ];
    const vp = zoomToFit(nodes, 800, 600);
    expect(vp).not.toBeNull();
    expect(vp!.zoom).toBeGreaterThan(0);
    expect(vp!.zoom).toBeLessThanOrEqual(5);
  });

  it('zoomToFit returns null for empty nodes', () => {
    expect(zoomToFit([], 800, 600)).toBeNull();
  });

  it('getMaxZIndex returns correct value', () => {
    const nodes = [
      makeNode({ id: 'n1', zIndex: 3 }),
      makeNode({ id: 'n2', zIndex: 7 }),
      makeNode({ id: 'n3', zIndex: 1 }),
    ];
    expect(getMaxZIndex(nodes)).toBe(7);
  });

  it('getMaxZIndex returns 0 for empty array', () => {
    expect(getMaxZIndex([])).toBe(0);
  });

  it('hitTestNode finds topmost node at point', () => {
    const nodes = [
      makeNode({ id: 'n1', x: 0, y: 0, w: 200, h: 100, zIndex: 0 }),
      makeNode({ id: 'n2', x: 50, y: 25, w: 200, h: 100, zIndex: 1 }),
    ];
    const hit = hitTestNode(nodes, 100, 50);
    expect(hit).not.toBeNull();
    expect(hit!.id).toBe('n2'); // higher z-index
  });

  it('hitTestNode returns null for miss', () => {
    const nodes = [makeNode({ x: 0, y: 0, w: 100, h: 100 })];
    expect(hitTestNode(nodes, 500, 500)).toBeNull();
  });

  it('selectNodesInRect finds nodes fully within rect', () => {
    const nodes = [
      makeNode({ id: 'n1', x: 10, y: 10, w: 80, h: 80 }),
      makeNode({ id: 'n2', x: 500, y: 500, w: 100, h: 100 }),
    ];
    const selected = selectNodesInRect(nodes, { x: 0, y: 0, w: 200, h: 200 });
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe('n1');
  });

  it('computeBoundingBox calculates correct bounds', () => {
    const nodes = [
      makeNode({ x: 10, y: 20, w: 100, h: 50 }),
      makeNode({ x: 200, y: 300, w: 150, h: 80 }),
    ];
    const bb = computeBoundingBox(nodes);
    expect(bb).toEqual({ x: 10, y: 20, w: 340, h: 360 });
  });

  it('computeBoundingBox returns null for empty', () => {
    expect(computeBoundingBox([])).toBeNull();
  });

  it('getGroupChildren returns children of a group', () => {
    const nodes = [
      makeNode({ id: 'g1', nodeType: 'group', groupId: null }),
      makeNode({ id: 'n1', groupId: 'g1' }),
      makeNode({ id: 'n2', groupId: 'g1' }),
      makeNode({ id: 'n3', groupId: null }),
    ];
    expect(getGroupChildren(nodes, 'g1')).toHaveLength(2);
  });

  it('computeGroupMove returns correct offsets', () => {
    const nodes = [
      makeNode({ id: 'g1', nodeType: 'group', x: 0, y: 0, groupId: null }),
      makeNode({ id: 'n1', x: 20, y: 20, groupId: 'g1' }),
      makeNode({ id: 'n2', x: 100, y: 100, groupId: 'g1' }),
    ];
    const moves = computeGroupMove(nodes, 'g1', 50, 50);
    expect(moves).toHaveLength(3);
    expect(moves.find((m) => m.id === 'g1')!.x).toBe(50);
    expect(moves.find((m) => m.id === 'n1')!.x).toBe(70);
  });
});

// ── Layout Tests ─────────────────────────────────────────────────────

describe('Canvas Layout', () => {
  it('snapToGrid aligns to nearest grid point', () => {
    expect(snapToGrid(23, 20)).toBe(20);
    expect(snapToGrid(37, 20)).toBe(40);
    expect(snapToGrid(10, 10)).toBe(10);
  });

  it('snapToGrid respects different grid sizes', () => {
    expect(snapToGrid(25, 10)).toBe(30);
    expect(snapToGrid(25, 40)).toBe(40);
  });

  it('snapPositionToGrid snaps both x and y', () => {
    const pos = snapPositionToGrid(33, 47, 20);
    expect(pos.x).toBe(40);
    expect(pos.y).toBe(40);
  });

  it('clampZoom enforces range', () => {
    expect(clampZoom(0.05)).toBe(0.1);
    expect(clampZoom(10)).toBe(5);
    expect(clampZoom(2)).toBe(2);
  });

  it('screenToCanvas converts correctly', () => {
    const pos = screenToCanvas(400, 300, 100, 50, 2);
    expect(pos.x).toBe(300); // 100 + 400/2
    expect(pos.y).toBe(200); // 50 + 300/2
  });

  it('canvasToScreen is inverse of screenToCanvas', () => {
    const screen = canvasToScreen(300, 200, 100, 50, 2);
    expect(screen.x).toBe(400);
    expect(screen.y).toBe(300);
  });
});

// ── Serializer Tests ─────────────────────────────────────────────────

describe('Canvas Serializer', () => {
  it('parseCanvasJson parses valid JSON', () => {
    const json = '{"nodes":[],"edges":[],"groups":[],"viewport":{"x":10,"y":20,"zoom":1.5}}';
    const result = parseCanvasJson(json);
    expect(result.viewport.x).toBe(10);
    expect(result.viewport.zoom).toBe(1.5);
  });

  it('parseCanvasJson returns default on invalid JSON', () => {
    const result = parseCanvasJson('not json');
    expect(result.nodes).toEqual([]);
    expect(result.viewport.zoom).toBe(1);
  });

  it('stringifyCanvasJson round-trips', () => {
    const original = { nodes: [], edges: [], groups: [], viewport: { x: 5, y: 10, zoom: 2 } };
    const json = stringifyCanvasJson(original);
    const parsed = parseCanvasJson(json);
    expect(parsed.viewport).toEqual(original.viewport);
  });

  it('serializeCanvas builds CanvasJson from records', () => {
    const nodes: CanvasNode[] = [
      {
        id: 'n1', canvasId: 'c1', nodeType: 'text', label: 'A', content: 'Hello',
        refNoteId: null, refAttachmentId: null, url: null,
        x: 0, y: 0, w: 200, h: 100, color: '', shape: 'rectangle',
        groupId: null, zIndex: 0, sortOrder: 0, createdAt: '', updatedAt: '',
      },
    ];
    const result = serializeCanvas(nodes, [], { x: 0, y: 0, zoom: 1 });
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].id).toBe('n1');
    expect(result.nodes[0].type).toBe('text');
  });

  it('extractViewport gets viewport from canvas_json', () => {
    const json = '{"nodes":[],"edges":[],"groups":[],"viewport":{"x":42,"y":99,"zoom":3}}';
    const vp = extractViewport(json);
    expect(vp.x).toBe(42);
    expect(vp.y).toBe(99);
    expect(vp.zoom).toBe(3);
  });
});
