/**
 * Canvas JSON serializer/deserializer.
 * Converts between the canvas_json blob and typed structures.
 */

import type { CanvasNode, CanvasEdge, CanvasJson, CanvasNodeJson, CanvasEdgeJson, CanvasGroupJson, CanvasViewport } from './types';
import { CanvasJsonSchema } from './types';

const DEFAULT_CANVAS_JSON: CanvasJson = {
  nodes: [],
  edges: [],
  groups: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

/**
 * Parse a canvas_json string into a typed CanvasJson object.
 * Returns default empty canvas on parse failure.
 */
export function parseCanvasJson(json: string): CanvasJson {
  try {
    const parsed = JSON.parse(json);
    const result = CanvasJsonSchema.safeParse(parsed);
    if (result.success) return result.data;
    return DEFAULT_CANVAS_JSON;
  } catch {
    return DEFAULT_CANVAS_JSON;
  }
}

/**
 * Serialize a CanvasJson object to a JSON string.
 */
export function stringifyCanvasJson(canvas: CanvasJson): string {
  return JSON.stringify(canvas);
}

/**
 * Build a CanvasJson from database records.
 */
export function serializeCanvas(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  viewport: CanvasViewport,
): CanvasJson {
  const groupNodes = nodes.filter((n) => n.nodeType === 'group');
  const groups: CanvasGroupJson[] = groupNodes.map((g) => ({
    id: g.id,
    label: g.label,
    color: g.color,
    nodeIds: nodes.filter((n) => n.groupId === g.id).map((n) => n.id),
  }));

  const nodeJsons: CanvasNodeJson[] = nodes.map((n) => ({
    id: n.id,
    type: n.nodeType,
    label: n.label,
    content: n.content,
    refNoteId: n.refNoteId,
    refAttachmentId: n.refAttachmentId,
    url: n.url,
    x: n.x,
    y: n.y,
    w: n.w,
    h: n.h,
    color: n.color,
    shape: n.shape,
    groupId: n.groupId,
    zIndex: n.zIndex,
  }));

  const edgeJsons: CanvasEdgeJson[] = edges.map((e) => ({
    id: e.id,
    sourceNodeId: e.sourceNodeId,
    targetNodeId: e.targetNodeId,
    label: e.label,
    edgeStyle: e.edgeStyle,
    arrowStart: e.arrowStart,
    arrowEnd: e.arrowEnd,
    color: e.color,
    strokeWidth: e.strokeWidth,
  }));

  return {
    nodes: nodeJsons,
    edges: edgeJsons,
    groups,
    viewport,
  };
}

/**
 * Extract viewport from a canvas_json string.
 */
export function extractViewport(json: string): CanvasViewport {
  const canvas = parseCanvasJson(json);
  return canvas.viewport;
}
