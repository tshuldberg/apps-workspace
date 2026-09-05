import type { DatabaseAdapter } from '@mylife/db';
import type { Canvas, CanvasNode, CanvasEdge } from '../canvas/types';

// ── Row Mappers ──────────────────────────────────────────────────────

function rowToCanvas(row: Record<string, unknown>): Canvas {
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? '',
    folderId: (row.folder_id as string) ?? null,
    thumbnailPath: (row.thumbnail_path as string) ?? null,
    canvasJson: row.canvas_json as string,
    width: row.width as number,
    height: row.height as number,
    isPinned: (row.is_pinned as number) === 1,
    nodeCount: row.node_count as number,
    edgeCount: row.edge_count as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToNode(row: Record<string, unknown>): CanvasNode {
  return {
    id: row.id as string,
    canvasId: row.canvas_id as string,
    nodeType: row.node_type as CanvasNode['nodeType'],
    label: (row.label as string) ?? '',
    content: (row.content as string) ?? '',
    refNoteId: (row.ref_note_id as string) ?? null,
    refAttachmentId: (row.ref_attachment_id as string) ?? null,
    url: (row.url as string) ?? null,
    x: row.x as number,
    y: row.y as number,
    w: row.w as number,
    h: row.h as number,
    color: (row.color as string) ?? '',
    shape: (row.shape as CanvasNode['shape']) ?? 'rectangle',
    groupId: (row.group_id as string) ?? null,
    zIndex: row.z_index as number,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToEdge(row: Record<string, unknown>): CanvasEdge {
  return {
    id: row.id as string,
    canvasId: row.canvas_id as string,
    sourceNodeId: row.source_node_id as string,
    targetNodeId: row.target_node_id as string,
    label: (row.label as string) ?? '',
    edgeStyle: (row.edge_style as CanvasEdge['edgeStyle']) ?? 'straight',
    arrowStart: (row.arrow_start as number) === 1,
    arrowEnd: (row.arrow_end as number) === 1,
    color: (row.color as string) ?? '',
    strokeWidth: (row.stroke_width as number) ?? 2,
    createdAt: row.created_at as string,
  };
}

// ── Canvas CRUD ──────────────────────────────────────────────────────

export function createCanvas(
  db: DatabaseAdapter,
  id: string,
  input: { title?: string; description?: string; folderId?: string | null },
): Canvas {
  const now = new Date().toISOString();
  const defaultJson = '{"nodes":[],"edges":[],"groups":[],"viewport":{"x":0,"y":0,"zoom":1}}';
  db.execute(
    `INSERT INTO nt_canvases (id, title, description, folder_id, canvas_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, input.title ?? 'Untitled Canvas', input.description ?? '', input.folderId ?? null, defaultJson, now, now],
  );
  return {
    id,
    title: input.title ?? 'Untitled Canvas',
    description: input.description ?? '',
    folderId: input.folderId ?? null,
    thumbnailPath: null,
    canvasJson: defaultJson,
    width: 0,
    height: 0,
    isPinned: false,
    nodeCount: 0,
    edgeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function getCanvases(db: DatabaseAdapter, limit = 200): Canvas[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_canvases ORDER BY is_pinned DESC, updated_at DESC LIMIT ?`,
    [limit],
  ).map(rowToCanvas);
}

export function getCanvasById(db: DatabaseAdapter, id: string): Canvas | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_canvases WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToCanvas(rows[0]) : null;
}

export function updateCanvas(
  db: DatabaseAdapter,
  id: string,
  input: { title?: string; description?: string; folderId?: string | null; canvasJson?: string; isPinned?: boolean },
): Canvas | null {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];

  if (input.title !== undefined) { sets.push('title = ?'); params.push(input.title); }
  if (input.description !== undefined) { sets.push('description = ?'); params.push(input.description); }
  if (input.folderId !== undefined) { sets.push('folder_id = ?'); params.push(input.folderId); }
  if (input.canvasJson !== undefined) { sets.push('canvas_json = ?'); params.push(input.canvasJson); }
  if (input.isPinned !== undefined) { sets.push('is_pinned = ?'); params.push(input.isPinned ? 1 : 0); }

  params.push(id);
  db.execute(`UPDATE nt_canvases SET ${sets.join(', ')} WHERE id = ?`, params);
  return getCanvasById(db, id);
}

export function deleteCanvas(db: DatabaseAdapter, id: string): boolean {
  db.execute(`DELETE FROM nt_canvases WHERE id = ?`, [id]);
  return true;
}

export function duplicateCanvas(db: DatabaseAdapter, sourceId: string, newId: string): Canvas | null {
  const source = getCanvasById(db, sourceId);
  if (!source) return null;
  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_canvases (id, title, description, folder_id, canvas_json, width, height, is_pinned, node_count, edge_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [newId, `${source.title} (Copy)`, source.description, source.folderId, source.canvasJson, source.width, source.height, 0, source.nodeCount, source.edgeCount, now, now],
  );
  return getCanvasById(db, newId);
}

// ── Node CRUD ────────────────────────────────────────────────────────

export function addNode(
  db: DatabaseAdapter,
  id: string,
  canvasId: string,
  input: {
    nodeType?: string;
    label?: string;
    content?: string;
    refNoteId?: string | null;
    refAttachmentId?: string | null;
    url?: string | null;
    x?: number;
    y?: number;
    w?: number;
    h?: number;
    color?: string;
    shape?: string;
    groupId?: string | null;
  },
): CanvasNode {
  const now = new Date().toISOString();
  const w = Math.max(input.w ?? 200, 80);
  const h = Math.max(input.h ?? 100, 40);

  // Get max z_index
  const maxZ = db.query<Record<string, unknown>>(
    `SELECT COALESCE(MAX(z_index), -1) as max_z FROM nt_canvas_nodes WHERE canvas_id = ?`,
    [canvasId],
  );
  const zIndex = ((maxZ[0]?.max_z as number) ?? -1) + 1;

  db.execute(
    `INSERT INTO nt_canvas_nodes (id, canvas_id, node_type, label, content, ref_note_id, ref_attachment_id, url, x, y, w, h, color, shape, group_id, z_index, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, canvasId, input.nodeType ?? 'text', input.label ?? '', input.content ?? '',
      input.refNoteId ?? null, input.refAttachmentId ?? null, input.url ?? null,
      input.x ?? 0, input.y ?? 0, w, h,
      input.color ?? '', input.shape ?? 'rectangle', input.groupId ?? null,
      zIndex, 0, now, now,
    ],
  );

  // Update denormalized count
  db.execute(`UPDATE nt_canvases SET node_count = node_count + 1, updated_at = ? WHERE id = ?`, [now, canvasId]);

  return {
    id, canvasId, nodeType: (input.nodeType ?? 'text') as CanvasNode['nodeType'],
    label: input.label ?? '', content: input.content ?? '',
    refNoteId: input.refNoteId ?? null, refAttachmentId: input.refAttachmentId ?? null,
    url: input.url ?? null,
    x: input.x ?? 0, y: input.y ?? 0, w, h,
    color: input.color ?? '', shape: (input.shape ?? 'rectangle') as CanvasNode['shape'],
    groupId: input.groupId ?? null, zIndex, sortOrder: 0,
    createdAt: now, updatedAt: now,
  };
}

export function moveNode(db: DatabaseAdapter, id: string, x: number, y: number): void {
  const now = new Date().toISOString();
  db.execute(`UPDATE nt_canvas_nodes SET x = ?, y = ?, updated_at = ? WHERE id = ?`, [x, y, now, id]);
}

export function resizeNode(db: DatabaseAdapter, id: string, w: number, h: number): void {
  const now = new Date().toISOString();
  const clampedW = Math.max(w, 80);
  const clampedH = Math.max(h, 40);
  db.execute(`UPDATE nt_canvas_nodes SET w = ?, h = ?, updated_at = ? WHERE id = ?`, [clampedW, clampedH, now, id]);
}

export function updateNode(
  db: DatabaseAdapter,
  id: string,
  input: { label?: string; content?: string; color?: string; shape?: string },
): void {
  const now = new Date().toISOString();
  const sets: string[] = ['updated_at = ?'];
  const params: unknown[] = [now];
  if (input.label !== undefined) { sets.push('label = ?'); params.push(input.label); }
  if (input.content !== undefined) { sets.push('content = ?'); params.push(input.content); }
  if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color); }
  if (input.shape !== undefined) { sets.push('shape = ?'); params.push(input.shape); }
  params.push(id);
  db.execute(`UPDATE nt_canvas_nodes SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteNode(db: DatabaseAdapter, id: string, canvasId: string): void {
  db.transaction(() => {
    const now = new Date().toISOString();
    // Count edges that will be cascade-deleted
    const edgeCount = db.query<Record<string, unknown>>(
      `SELECT COUNT(*) as cnt FROM nt_canvas_edges WHERE source_node_id = ? OR target_node_id = ?`,
      [id, id],
    );
    const removedEdges = (edgeCount[0]?.cnt as number) ?? 0;

    // Clear group_id on children if this is a group node
    db.execute(`UPDATE nt_canvas_nodes SET group_id = NULL WHERE group_id = ?`, [id]);

    db.execute(`DELETE FROM nt_canvas_nodes WHERE id = ?`, [id]);

    // Update denormalized counts
    db.execute(
      `UPDATE nt_canvases SET node_count = node_count - 1, edge_count = edge_count - ?, updated_at = ? WHERE id = ?`,
      [removedEdges, now, canvasId],
    );
  });
}

export function bringToFront(db: DatabaseAdapter, id: string, canvasId: string): void {
  const maxZ = db.query<Record<string, unknown>>(
    `SELECT COALESCE(MAX(z_index), 0) as max_z FROM nt_canvas_nodes WHERE canvas_id = ?`,
    [canvasId],
  );
  const newZ = ((maxZ[0]?.max_z as number) ?? 0) + 1;
  db.execute(`UPDATE nt_canvas_nodes SET z_index = ? WHERE id = ?`, [newZ, id]);
}

export function getNodesForCanvas(db: DatabaseAdapter, canvasId: string, limit = 5000): CanvasNode[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_canvas_nodes WHERE canvas_id = ? ORDER BY z_index ASC LIMIT ?`,
    [canvasId, limit],
  ).map(rowToNode);
}

export function getNodeById(db: DatabaseAdapter, id: string): CanvasNode | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM nt_canvas_nodes WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToNode(rows[0]) : null;
}

// ── Edge CRUD ────────────────────────────────────────────────────────

export function addEdge(
  db: DatabaseAdapter,
  id: string,
  canvasId: string,
  input: {
    sourceNodeId: string;
    targetNodeId: string;
    label?: string;
    edgeStyle?: string;
    arrowStart?: boolean;
    arrowEnd?: boolean;
    color?: string;
    strokeWidth?: number;
  },
): CanvasEdge | null {
  // Reject self-loops
  if (input.sourceNodeId === input.targetNodeId) return null;

  const now = new Date().toISOString();
  db.execute(
    `INSERT INTO nt_canvas_edges (id, canvas_id, source_node_id, target_node_id, label, edge_style, arrow_start, arrow_end, color, stroke_width, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, canvasId, input.sourceNodeId, input.targetNodeId,
      input.label ?? '', input.edgeStyle ?? 'straight',
      (input.arrowStart ?? false) ? 1 : 0, (input.arrowEnd ?? true) ? 1 : 0,
      input.color ?? '', input.strokeWidth ?? 2, now,
    ],
  );

  db.execute(`UPDATE nt_canvases SET edge_count = edge_count + 1, updated_at = ? WHERE id = ?`, [now, canvasId]);

  return {
    id, canvasId, sourceNodeId: input.sourceNodeId, targetNodeId: input.targetNodeId,
    label: input.label ?? '', edgeStyle: (input.edgeStyle ?? 'straight') as CanvasEdge['edgeStyle'],
    arrowStart: input.arrowStart ?? false, arrowEnd: input.arrowEnd ?? true,
    color: input.color ?? '', strokeWidth: input.strokeWidth ?? 2, createdAt: now,
  };
}

export function updateEdge(
  db: DatabaseAdapter,
  id: string,
  input: { label?: string; edgeStyle?: string; arrowStart?: boolean; arrowEnd?: boolean; color?: string; strokeWidth?: number },
): void {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.label !== undefined) { sets.push('label = ?'); params.push(input.label); }
  if (input.edgeStyle !== undefined) { sets.push('edge_style = ?'); params.push(input.edgeStyle); }
  if (input.arrowStart !== undefined) { sets.push('arrow_start = ?'); params.push(input.arrowStart ? 1 : 0); }
  if (input.arrowEnd !== undefined) { sets.push('arrow_end = ?'); params.push(input.arrowEnd ? 1 : 0); }
  if (input.color !== undefined) { sets.push('color = ?'); params.push(input.color); }
  if (input.strokeWidth !== undefined) { sets.push('stroke_width = ?'); params.push(input.strokeWidth); }
  if (sets.length === 0) return;
  params.push(id);
  db.execute(`UPDATE nt_canvas_edges SET ${sets.join(', ')} WHERE id = ?`, params);
}

export function deleteEdge(db: DatabaseAdapter, id: string, canvasId: string): void {
  const now = new Date().toISOString();
  db.execute(`DELETE FROM nt_canvas_edges WHERE id = ?`, [id]);
  db.execute(`UPDATE nt_canvases SET edge_count = edge_count - 1, updated_at = ? WHERE id = ?`, [now, canvasId]);
}

export function getEdgesForCanvas(db: DatabaseAdapter, canvasId: string, limit = 5000): CanvasEdge[] {
  return db.query<Record<string, unknown>>(
    `SELECT * FROM nt_canvas_edges WHERE canvas_id = ? ORDER BY created_at ASC LIMIT ?`,
    [canvasId, limit],
  ).map(rowToEdge);
}

// ── Group Operations ─────────────────────────────────────────────────

export function groupNodes(
  db: DatabaseAdapter,
  groupNodeId: string,
  canvasId: string,
  nodeIds: string[],
  label = '',
  color = '',
): CanvasNode {
  let groupNode!: CanvasNode;
  let finalZ = 0;

  db.transaction(() => {
    // Create the group node with bounding box around selected nodes
    const nodes = nodeIds.map((nid) => getNodeById(db, nid)).filter(Boolean) as CanvasNode[];
    const minX = Math.min(...nodes.map((n) => n.x));
    const minY = Math.min(...nodes.map((n) => n.y));
    const maxX = Math.max(...nodes.map((n) => n.x + n.w));
    const maxY = Math.max(...nodes.map((n) => n.y + n.h));
    const padding = 20;

    groupNode = addNode(db, groupNodeId, canvasId, {
      nodeType: 'group',
      label,
      color,
      x: minX - padding,
      y: minY - padding,
      w: maxX - minX + padding * 2,
      h: maxY - minY + padding * 2,
    });

    // Set z_index lower than all children so group renders behind
    const minZ = Math.min(...nodes.map((n) => n.zIndex), 0);
    finalZ = minZ - 1;
    db.execute(`UPDATE nt_canvas_nodes SET z_index = ? WHERE id = ?`, [finalZ, groupNodeId]);

    // Assign children to group
    for (const nid of nodeIds) {
      db.execute(`UPDATE nt_canvas_nodes SET group_id = ? WHERE id = ?`, [groupNodeId, nid]);
    }
  });

  return { ...groupNode, zIndex: finalZ };
}

export function ungroupNodes(db: DatabaseAdapter, groupNodeId: string, canvasId: string): void {
  db.execute(`UPDATE nt_canvas_nodes SET group_id = NULL WHERE group_id = ?`, [groupNodeId]);
  deleteNode(db, groupNodeId, canvasId);
}
