/**
 * Link intelligence engine for MyNotes.
 * Suggests backlinks, scores connection strength, and analyzes link patterns.
 * All pure functions operating on existing Note/Graph data.
 */

import type { NoteGraph } from '../types';

// ── Connection Strength ──────────────────────────────────────────────

export interface ConnectionStrength {
  noteId: string;
  title: string;
  directLinks: number;
  sharedNeighbors: number;
  strength: number; // 0-100
}

/**
 * Score the connection strength between a focus note and all other notes.
 * Considers direct links and shared neighbors (2-hop connections).
 */
export function scoreConnections(
  graph: NoteGraph,
  focusNoteId: string,
): ConnectionStrength[] {
  // Build adjacency map
  const neighbors = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    neighbors.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }

  const focusNeighbors = neighbors.get(focusNoteId) ?? new Set();
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const results: ConnectionStrength[] = [];

  for (const node of graph.nodes) {
    if (node.id === focusNoteId) continue;

    const nodeNeighbors = neighbors.get(node.id) ?? new Set();
    const directLinks = focusNeighbors.has(node.id) ? 1 : 0;

    // Count shared neighbors
    let sharedNeighbors = 0;
    for (const n of focusNeighbors) {
      if (nodeNeighbors.has(n)) sharedNeighbors++;
    }

    if (directLinks === 0 && sharedNeighbors === 0) continue;

    const strength = Math.min(100, Math.round(
      directLinks * 50 + sharedNeighbors * 25,
    ));

    results.push({
      noteId: node.id,
      title: node.title,
      directLinks,
      sharedNeighbors,
      strength,
    });
  }

  return results.sort((a, b) => b.strength - a.strength);
}

// ── Hub Detection ────────────────────────────────────────────────────

export interface HubNote {
  noteId: string;
  title: string;
  linkCount: number;
  incomingCount: number;
  outgoingCount: number;
  hubScore: number; // 0-100
}

/**
 * Find "hub" notes -- central nodes that connect many other notes.
 * These are the most important notes in the knowledge base.
 */
export function findHubNotes(
  graph: NoteGraph,
  maxResults = 10,
): HubNote[] {
  const inCounts = new Map<string, number>();
  const outCounts = new Map<string, number>();

  for (const edge of graph.edges) {
    outCounts.set(edge.source, (outCounts.get(edge.source) ?? 0) + 1);
    inCounts.set(edge.target, (inCounts.get(edge.target) ?? 0) + 1);
  }

  if (graph.nodes.length === 0) return [];

  const maxLinks = Math.max(...graph.nodes.map((n) => n.linkCount), 1);

  return graph.nodes
    .map((node) => {
      const incoming = inCounts.get(node.id) ?? 0;
      const outgoing = outCounts.get(node.id) ?? 0;
      const hubScore = Math.round((node.linkCount / maxLinks) * 100);

      return {
        noteId: node.id,
        title: node.title,
        linkCount: node.linkCount,
        incomingCount: incoming,
        outgoingCount: outgoing,
        hubScore,
      };
    })
    .filter((h) => h.linkCount > 0)
    .sort((a, b) => b.hubScore - a.hubScore)
    .slice(0, maxResults);
}

// ── Link Density ─────────────────────────────────────────────────────

export interface LinkDensityStats {
  totalNotes: number;
  totalLinks: number;
  linkedNotes: number;
  orphanNotes: number;
  avgLinksPerNote: number;
  density: number; // 0-1, ratio of actual links to possible links
  mostLinked: { id: string; title: string; count: number } | null;
  leastLinked: { id: string; title: string; count: number } | null;
}

/**
 * Compute link density statistics for the entire note graph.
 */
export function computeLinkDensity(graph: NoteGraph): LinkDensityStats {
  const n = graph.nodes.length;

  if (n === 0) {
    return {
      totalNotes: 0,
      totalLinks: 0,
      linkedNotes: 0,
      orphanNotes: 0,
      avgLinksPerNote: 0,
      density: 0,
      mostLinked: null,
      leastLinked: null,
    };
  }

  const linkedIds = new Set<string>();
  for (const edge of graph.edges) {
    linkedIds.add(edge.source);
    linkedIds.add(edge.target);
  }

  const sorted = [...graph.nodes].sort((a, b) => b.linkCount - a.linkCount);
  const linkedOnly = sorted.filter((n) => n.linkCount > 0);
  const totalLinks = graph.edges.length;
  const possibleLinks = n * (n - 1);

  return {
    totalNotes: n,
    totalLinks,
    linkedNotes: linkedIds.size,
    orphanNotes: n - linkedIds.size,
    avgLinksPerNote: n > 0 ? Math.round((totalLinks * 2 / n) * 10) / 10 : 0,
    density: possibleLinks > 0 ? Math.round((totalLinks / possibleLinks) * 1000) / 1000 : 0,
    mostLinked: sorted[0] ? { id: sorted[0].id, title: sorted[0].title, count: sorted[0].linkCount } : null,
    leastLinked: linkedOnly.length > 0
      ? { id: linkedOnly[linkedOnly.length - 1].id, title: linkedOnly[linkedOnly.length - 1].title, count: linkedOnly[linkedOnly.length - 1].linkCount }
      : null,
  };
}

// ── Bridge Detection ─────────────────────────────────────────────────

export interface BridgeNote {
  noteId: string;
  title: string;
  clusterA: string[];
  clusterB: string[];
}

/**
 * Find notes that bridge otherwise disconnected clusters.
 * These are structurally important -- removing them fragments the graph.
 */
export function findBridgeNotes(graph: NoteGraph): BridgeNote[] {
  if (graph.nodes.length < 3 || graph.edges.length < 2) return [];

  const adjacency = new Map<string, Set<string>>();
  for (const node of graph.nodes) {
    adjacency.set(node.id, new Set());
  }
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  }

  const bridges: BridgeNote[] = [];

  // Check each linked node: if removing it increases connected component count, it's a bridge
  for (const node of graph.nodes) {
    const nodeNeighbors = adjacency.get(node.id);
    if (!nodeNeighbors || nodeNeighbors.size < 2) continue;

    // BFS without this node to check connectivity
    const remaining = graph.nodes.filter((n) => n.id !== node.id);
    if (remaining.length === 0) continue;

    const visited = new Set<string>();
    const queue = [remaining[0].id];
    visited.add(remaining[0].id);

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (neighbor !== node.id && !visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }

    // If not all remaining nodes are reachable, this is a bridge
    const unreached = remaining.filter((n) => !visited.has(n.id));
    if (unreached.length > 0) {
      bridges.push({
        noteId: node.id,
        title: node.title,
        clusterA: [...visited].slice(0, 5),
        clusterB: unreached.map((n) => n.id).slice(0, 5),
      });
    }
  }

  return bridges;
}

// ── Aggregate Insights ───────────────────────────────────────────────

export interface LinkIntelligenceInsights {
  density: LinkDensityStats;
  hubNotes: HubNote[];
  bridgeNotes: BridgeNote[];
}

/**
 * Compute all link intelligence insights.
 */
export function computeLinkIntelligence(graph: NoteGraph): LinkIntelligenceInsights {
  return {
    density: computeLinkDensity(graph),
    hubNotes: findHubNotes(graph),
    bridgeNotes: findBridgeNotes(graph),
  };
}
