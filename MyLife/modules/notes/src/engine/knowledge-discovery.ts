/**
 * Knowledge discovery engine for MyNotes.
 * Surfaces forgotten notes, detects staleness, and finds knowledge gaps.
 * All pure functions operating on existing Note/Graph data.
 */

import type { Note, NoteGraph } from '../types';

// ── Staleness Detection ──────────────────────────────────────────────

export interface StalenessScore {
  noteId: string;
  title: string;
  daysSinceUpdate: number;
  wordCount: number;
  linkCount: number;
  score: number; // 0-100, higher = more stale and worth revisiting
}

/**
 * Score how "stale" a note is -- combines time since last update,
 * note importance (word count, links), and whether it's an orphan.
 * High-value orphans that haven't been touched are the most stale.
 */
export function computeStalenessScores(
  notes: Note[],
  graph: NoteGraph,
  now: string = new Date().toISOString(),
): StalenessScore[] {
  const nowMs = new Date(now).getTime();
  const linkCounts = new Map<string, number>();

  for (const node of graph.nodes) {
    linkCounts.set(node.id, node.linkCount);
  }

  return notes
    .map((note) => {
      const updatedMs = new Date(note.updatedAt).getTime();
      const daysSinceUpdate = Math.floor((nowMs - updatedMs) / (1000 * 60 * 60 * 24));
      const lc = linkCounts.get(note.id) ?? 0;

      // Importance: longer notes with links are more worth revisiting
      const importance = Math.min(100, (note.wordCount / 10) + (lc * 15));

      // Time decay: notes untouched for 30+ days start scoring high
      const timeFactor = Math.min(100, Math.max(0, (daysSinceUpdate - 7) * 2));

      // Orphan penalty: unlinked notes are more likely to be forgotten
      const orphanBonus = lc === 0 ? 20 : 0;

      // Score: important + old + orphan = needs revisiting
      const score = Math.min(100, Math.round(
        (timeFactor * 0.5) + (importance * 0.3) + orphanBonus,
      ));

      return {
        noteId: note.id,
        title: note.title,
        daysSinceUpdate,
        wordCount: note.wordCount,
        linkCount: lc,
        score,
      };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ── Content Similarity ───────────────────────────────────────────────

export interface SimilarNotePair {
  noteIdA: string;
  titleA: string;
  noteIdB: string;
  titleB: string;
  sharedTerms: string[];
  similarity: number; // 0-1
}

/**
 * Extract significant terms from a note body for similarity comparison.
 * Strips markdown, lowercases, removes stop words and short words.
 */
export function extractSignificantTerms(body: string): string[] {
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'must', 'need', 'dare',
    'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either',
    'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'it', 'its', 'he', 'she', 'they', 'them', 'we', 'you', 'i', 'me',
    'my', 'your', 'his', 'her', 'our', 'their', 'about', 'up', 'out',
    'one', 'two', 'also', 'like', 'over', 'then', 'here', 'there',
  ]);

  const stripped = body
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .toLowerCase();

  const words = stripped.split(/\s+/).filter((w) => w.length >= 4);
  const filtered = words.filter((w) => !STOP_WORDS.has(w) && /^[a-z]+$/.test(w));

  // Return unique terms
  return [...new Set(filtered)];
}

/**
 * Find pairs of notes that share significant terms but aren't linked.
 * Only returns pairs with meaningful overlap (3+ shared terms).
 */
export function findSimilarUnlinkedNotes(
  notes: Array<{ id: string; title: string; body: string }>,
  graph: NoteGraph,
  minSharedTerms = 3,
  maxResults = 20,
): SimilarNotePair[] {
  // Build set of existing links for fast lookup
  const linkedPairs = new Set<string>();
  for (const edge of graph.edges) {
    linkedPairs.add(`${edge.source}:${edge.target}`);
    linkedPairs.add(`${edge.target}:${edge.source}`);
  }

  // Extract terms for each note
  const noteTerms = new Map<string, Set<string>>();
  for (const note of notes) {
    noteTerms.set(note.id, new Set(extractSignificantTerms(note.body)));
  }

  const pairs: SimilarNotePair[] = [];

  for (let i = 0; i < notes.length; i++) {
    const noteA = notes[i];
    const termsA = noteTerms.get(noteA.id)!;
    if (termsA.size === 0) continue;

    for (let j = i + 1; j < notes.length; j++) {
      const noteB = notes[j];

      // Skip already-linked notes
      if (linkedPairs.has(`${noteA.id}:${noteB.id}`)) continue;

      const termsB = noteTerms.get(noteB.id)!;
      if (termsB.size === 0) continue;

      // Compute shared terms
      const shared: string[] = [];
      for (const term of termsA) {
        if (termsB.has(term)) shared.push(term);
      }

      if (shared.length < minSharedTerms) continue;

      // Jaccard similarity
      const union = new Set([...termsA, ...termsB]).size;
      const similarity = union > 0 ? shared.length / union : 0;

      pairs.push({
        noteIdA: noteA.id,
        titleA: noteA.title,
        noteIdB: noteB.id,
        titleB: noteB.title,
        sharedTerms: shared.sort(),
        similarity,
      });
    }
  }

  return pairs
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

// ── Knowledge Gaps ───────────────────────────────────────────────────

export interface KnowledgeGap {
  term: string;
  mentionCount: number;
  noteIds: string[];
  hasOwnNote: boolean;
}

/**
 * Find terms that appear across multiple notes but don't have their own
 * dedicated note. These are potential knowledge gaps worth expanding.
 */
export function findKnowledgeGaps(
  notes: Array<{ id: string; title: string; body: string }>,
  minMentions = 3,
  maxResults = 15,
): KnowledgeGap[] {
  const titleSet = new Set(notes.map((n) => n.title.toLowerCase()));
  const termNotes = new Map<string, Set<string>>();

  for (const note of notes) {
    const terms = extractSignificantTerms(note.body);
    for (const term of terms) {
      if (!termNotes.has(term)) termNotes.set(term, new Set());
      termNotes.get(term)!.add(note.id);
    }
  }

  const gaps: KnowledgeGap[] = [];
  for (const [term, noteIds] of termNotes) {
    if (noteIds.size < minMentions) continue;

    gaps.push({
      term,
      mentionCount: noteIds.size,
      noteIds: [...noteIds],
      hasOwnNote: titleSet.has(term),
    });
  }

  return gaps
    .filter((g) => !g.hasOwnNote)
    .sort((a, b) => b.mentionCount - a.mentionCount)
    .slice(0, maxResults);
}

// ── Aggregate Insights ───────────────────────────────────────────────

export interface KnowledgeDiscoveryInsights {
  staleNotes: StalenessScore[];
  suggestedLinks: SimilarNotePair[];
  knowledgeGaps: KnowledgeGap[];
  totalNotes: number;
  orphanCount: number;
  avgStaleness: number;
}

/**
 * Compute all knowledge discovery insights for the notes collection.
 */
export function computeKnowledgeDiscovery(
  notes: Array<Note & { body: string }>,
  graph: NoteGraph,
  now?: string,
): KnowledgeDiscoveryInsights {
  const staleNotes = computeStalenessScores(notes, graph, now).slice(0, 10);
  const suggestedLinks = findSimilarUnlinkedNotes(notes, graph);
  const knowledgeGaps = findKnowledgeGaps(notes);

  const linkedIds = new Set<string>();
  for (const edge of graph.edges) {
    linkedIds.add(edge.source);
    linkedIds.add(edge.target);
  }
  const orphanCount = notes.filter((n) => !linkedIds.has(n.id)).length;

  const avgStaleness = staleNotes.length > 0
    ? Math.round(staleNotes.reduce((sum, s) => sum + s.daysSinceUpdate, 0) / staleNotes.length)
    : 0;

  return {
    staleNotes,
    suggestedLinks,
    knowledgeGaps,
    totalNotes: notes.length,
    orphanCount,
    avgStaleness,
  };
}
