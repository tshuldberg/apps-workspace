/**
 * Coordinated endorsement ring detection (plan 48 WP8, Sybil defences).
 *
 * nw_suggestion_dupes is the endorsement graph: when an editor files a
 * near-duplicate of an open suggestion, the duplicate collapses into an
 * endorsement of the original (see engines/dupes.ts and mynews-suggest). That
 * endorsement count feeds the credibility engine, so a group of accounts can
 * try to farm standing by endorsing each other.
 *
 * This is a pure detector over the edge list: no clock, no I/O, deterministic
 * output ordering. It produces findings and per-profile suspicion, and it never
 * takes an action. Enforcement is a human decision in the console, because a
 * genuine cluster of collaborators covering one beat looks structurally similar
 * to a ring and only a person can tell them apart.
 */

/** One endorsement: `endorserId` endorsed a suggestion authored by `beneficiaryId`. */
export interface EndorsementEdge {
  endorserId: string;
  beneficiaryId: string;
  /** Endorsement timestamp in epoch milliseconds. */
  createdAtMs: number;
  /** Recorded near-dupe similarity, 0..1. */
  similarity: number;
}

export type RingFindingCode =
  | 'self-endorsement'
  | 'mutual-pair'
  | 'closed-cycle'
  | 'concentrated-beneficiary'
  | 'burst-window';

export interface RingFinding {
  code: RingFindingCode;
  /** Profiles implicated, sorted for stable output. */
  memberIds: readonly string[];
  /** Strength of the finding, 0..1. */
  score: number;
  explain: string;
}

export interface RingAnalysis {
  findings: readonly RingFinding[];
  /** Per-profile suspicion, 0..1, only for implicated profiles. */
  suspicion: Readonly<Record<string, number>>;
  /** Profiles at or above `flagAt`, sorted. */
  flagged: readonly string[];
}

export interface RingConfig {
  /** Endorsements in each direction before a pair counts as mutual. */
  mutualMinEach: number;
  /** Longest cycle searched. 2 is the mutual pair case, handled separately. */
  maxCycleLength: number;
  /** Received endorsements needed before concentration is meaningful. */
  concentrationMinReceived: number;
  /** Top-endorser share at or above which concentration is a finding. */
  concentrationShare: number;
  /** Window for a coordinated burst toward one beneficiary. */
  burstWindowMs: number;
  /** Distinct endorsers inside the window before it is a burst. */
  burstMinEndorsers: number;
  /** Suspicion at or above which a profile is flagged for review. */
  flagAt: number;
}

export const DEFAULT_RING_CONFIG: RingConfig = Object.freeze({
  mutualMinEach: 2,
  maxCycleLength: 4,
  concentrationMinReceived: 4,
  concentrationShare: 0.6,
  burstWindowMs: 15 * 60_000,
  burstMinEndorsers: 3,
  flagAt: 0.6,
});

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Directed adjacency with per-edge counts, built deterministically. */
function buildGraph(edges: readonly EndorsementEdge[]): Map<string, Map<string, number>> {
  const graph = new Map<string, Map<string, number>>();
  for (const edge of edges) {
    let out = graph.get(edge.endorserId);
    if (!out) {
      out = new Map<string, number>();
      graph.set(edge.endorserId, out);
    }
    out.set(edge.beneficiaryId, (out.get(edge.beneficiaryId) ?? 0) + 1);
  }
  return graph;
}

function detectSelfEndorsement(edges: readonly EndorsementEdge[]): RingFinding[] {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    if (edge.endorserId !== edge.beneficiaryId) continue;
    counts.set(edge.endorserId, (counts.get(edge.endorserId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, count]) => ({
      code: 'self-endorsement' as const,
      memberIds: [id],
      score: 1,
      explain: `Profile ${id} appears as both endorser and beneficiary on ${count} endorsement${count === 1 ? '' : 's'}. The suggest path forbids this, so these rows indicate a bypass and need investigation.`,
    }));
}

function detectMutualPairs(
  graph: Map<string, Map<string, number>>,
  config: RingConfig,
): RingFinding[] {
  const seen = new Set<string>();
  const findings: RingFinding[] = [];
  for (const [from, out] of graph) {
    for (const [to, forward] of out) {
      if (from === to) continue;
      const back = graph.get(to)?.get(from) ?? 0;
      if (forward < config.mutualMinEach || back < config.mutualMinEach) continue;
      const key = pairKey(from, to);
      if (seen.has(key)) continue;
      seen.add(key);
      const weakest = Math.min(forward, back);
      findings.push({
        code: 'mutual-pair',
        memberIds: [from, to].sort(),
        score: Math.min(1, 0.4 + 0.15 * (weakest - config.mutualMinEach + 1)),
        explain: `Two profiles endorse each other repeatedly (${forward} one way, ${back} the other). Reciprocal endorsement is how a pair inflates each other's standing.`,
      });
    }
  }
  return findings.sort((a, b) => a.memberIds.join().localeCompare(b.memberIds.join()));
}

/**
 * Cycles of length 3 up to `maxCycleLength`. Cycles are canonicalized by their
 * sorted member set so A->B->C->A and B->C->A->B report once.
 */
function detectCycles(
  graph: Map<string, Map<string, number>>,
  config: RingConfig,
): RingFinding[] {
  const nodes = [...graph.keys()].sort();
  const found = new Map<string, string[]>();

  const walk = (start: string, current: string, path: string[]) => {
    if (path.length > config.maxCycleLength) return;
    const out = graph.get(current);
    if (!out) return;
    for (const next of [...out.keys()].sort()) {
      if (next === start && path.length >= 3) {
        const members = [...path].sort();
        found.set(members.join('|'), members);
        continue;
      }
      // Only extend through nodes greater than the start, so each cycle is
      // discovered exactly once from its lexicographically smallest member.
      if (next <= start || path.includes(next)) continue;
      walk(start, next, [...path, next]);
    }
  };

  for (const node of nodes) walk(node, node, [node]);

  return [...found.values()]
    .sort((a, b) => a.join().localeCompare(b.join()))
    .map((members) => ({
      code: 'closed-cycle' as const,
      memberIds: members,
      score: Math.min(1, 0.75 - 0.05 * (members.length - 3)),
      explain: `${members.length} profiles form a closed endorsement cycle, where each endorses the next and the last endorses the first.`,
    }));
}

function detectConcentration(
  edges: readonly EndorsementEdge[],
  config: RingConfig,
): RingFinding[] {
  const received = new Map<string, Map<string, number>>();
  for (const edge of edges) {
    if (edge.endorserId === edge.beneficiaryId) continue;
    let from = received.get(edge.beneficiaryId);
    if (!from) {
      from = new Map<string, number>();
      received.set(edge.beneficiaryId, from);
    }
    from.set(edge.endorserId, (from.get(edge.endorserId) ?? 0) + 1);
  }

  const findings: RingFinding[] = [];
  for (const beneficiary of [...received.keys()].sort()) {
    const from = received.get(beneficiary)!;
    let total = 0;
    for (const count of from.values()) total += count;
    if (total < config.concentrationMinReceived) continue;
    const ranked = [...from.entries()].sort(
      ([aId, aCount], [bId, bCount]) => bCount - aCount || aId.localeCompare(bId),
    );
    const [topEndorser, topCount] = ranked[0]!;
    const share = topCount / total;
    if (share < config.concentrationShare) continue;
    findings.push({
      code: 'concentrated-beneficiary',
      memberIds: [beneficiary, topEndorser].sort(),
      score: Math.min(1, share),
      explain: `${Math.round(share * 100)} percent of the ${total} endorsements this profile received came from one account. Independent credibility comes from many endorsers.`,
    });
  }
  return findings;
}

function detectBursts(
  edges: readonly EndorsementEdge[],
  config: RingConfig,
): RingFinding[] {
  const byBeneficiary = new Map<string, EndorsementEdge[]>();
  for (const edge of edges) {
    if (edge.endorserId === edge.beneficiaryId) continue;
    const list = byBeneficiary.get(edge.beneficiaryId);
    if (list) list.push(edge);
    else byBeneficiary.set(edge.beneficiaryId, [edge]);
  }

  const findings: RingFinding[] = [];
  for (const beneficiary of [...byBeneficiary.keys()].sort()) {
    const list = [...byBeneficiary.get(beneficiary)!].sort(
      (a, b) => a.createdAtMs - b.createdAtMs || a.endorserId.localeCompare(b.endorserId),
    );
    let best: { endorsers: string[]; spanMs: number } | null = null;
    for (let start = 0; start < list.length; start++) {
      const windowEnd = list[start]!.createdAtMs + config.burstWindowMs;
      const endorsers = new Set<string>();
      let spanMs = 0;
      for (let i = start; i < list.length && list[i]!.createdAtMs <= windowEnd; i++) {
        endorsers.add(list[i]!.endorserId);
        spanMs = list[i]!.createdAtMs - list[start]!.createdAtMs;
      }
      if (endorsers.size < config.burstMinEndorsers) continue;
      if (!best || endorsers.size > best.endorsers.length) {
        best = { endorsers: [...endorsers].sort(), spanMs };
      }
    }
    if (!best) continue;
    findings.push({
      code: 'burst-window',
      memberIds: [beneficiary, ...best.endorsers].sort(),
      score: Math.min(1, 0.4 + 0.1 * (best.endorsers.length - config.burstMinEndorsers + 1)),
      explain: `${best.endorsers.length} different accounts endorsed the same profile within ${Math.round(best.spanMs / 60000)} minutes, which reads as coordination rather than independent agreement.`,
    });
  }
  return findings;
}

/**
 * Full analysis. Findings are concatenated in a fixed detector order and each
 * detector sorts its own output, so the result is byte-stable for a given edge
 * list regardless of the order the edges arrive in.
 */
export function detectEndorsementRings(
  edges: readonly EndorsementEdge[],
  config: RingConfig = DEFAULT_RING_CONFIG,
): RingAnalysis {
  const graph = buildGraph(edges.filter((edge) => edge.endorserId !== edge.beneficiaryId));
  const findings: RingFinding[] = [
    ...detectSelfEndorsement(edges),
    ...detectMutualPairs(graph, config),
    ...detectCycles(graph, config),
    ...detectConcentration(edges, config),
    ...detectBursts(edges, config),
  ];

  const suspicion: Record<string, number> = {};
  for (const finding of findings) {
    for (const member of finding.memberIds) {
      suspicion[member] = Math.min(1, (suspicion[member] ?? 0) + finding.score);
    }
  }

  const flagged = Object.keys(suspicion)
    .filter((id) => suspicion[id]! >= config.flagAt)
    .sort();

  return { findings, suspicion, flagged };
}
