/**
 * Graph analysis engine for MyNotes.
 * Extends the existing getNoteGraph() with filtering, local graph, and orphan detection.
 */

import type { NoteGraph, GraphNode, GraphEdge } from '../types';

/**
 * Filter a graph to only include nodes matching a predicate.
 */
export function filterGraph(
  graph: NoteGraph,
  predicate: (node: GraphNode) => boolean,
): NoteGraph {
  const nodeIds = new Set(graph.nodes.filter(predicate).map((n) => n.id));
  return {
    nodes: graph.nodes.filter((n) => nodeIds.has(n.id)),
    edges: graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
  };
}

/**
 * Get the local graph centered on a specific note (1-hop neighborhood).
 */
export function getLocalGraph(graph: NoteGraph, noteId: string): NoteGraph {
  const connectedIds = new Set<string>();
  connectedIds.add(noteId);

  for (const edge of graph.edges) {
    if (edge.source === noteId) connectedIds.add(edge.target);
    if (edge.target === noteId) connectedIds.add(edge.source);
  }

  return {
    nodes: graph.nodes.filter((n) => connectedIds.has(n.id)),
    edges: graph.edges.filter((e) => connectedIds.has(e.source) && connectedIds.has(e.target)),
  };
}

/**
 * Find orphan notes (nodes with no links).
 */
export function findOrphans(graph: NoteGraph): GraphNode[] {
  const linkedIds = new Set<string>();
  for (const edge of graph.edges) {
    linkedIds.add(edge.source);
    linkedIds.add(edge.target);
  }
  return graph.nodes.filter((n) => !linkedIds.has(n.id));
}

/**
 * Simple cluster detection using connected components.
 */
export function clusterNotes(graph: NoteGraph): GraphNode[][] {
  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const visited = new Set<string>();
  const clusters: GraphNode[][] = [];
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  for (const node of graph.nodes) {
    if (visited.has(node.id)) continue;

    const cluster: GraphNode[] = [];
    const queue = [node.id];
    while (queue.length > 0) {
      const id = queue.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const n = nodeMap.get(id);
      if (n) cluster.push(n);
      for (const neighbor of adjacency.get(id) ?? []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    clusters.push(cluster);
  }

  return clusters.sort((a, b) => b.length - a.length);
}

/**
 * Get graph statistics.
 */
export function getGraphStats(graph: NoteGraph): {
  nodeCount: number;
  edgeCount: number;
  orphanCount: number;
  clusterCount: number;
  avgLinkCount: number;
} {
  const orphans = findOrphans(graph);
  const clusters = clusterNotes(graph);
  const totalLinks = graph.nodes.reduce((sum, n) => sum + n.linkCount, 0);

  return {
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    orphanCount: orphans.length,
    clusterCount: clusters.length,
    avgLinkCount: graph.nodes.length > 0 ? totalLinks / graph.nodes.length : 0,
  };
}
