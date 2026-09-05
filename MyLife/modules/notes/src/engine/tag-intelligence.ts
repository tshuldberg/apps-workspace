/**
 * Tag intelligence engine for MyNotes.
 * Analyzes tag usage patterns, co-occurrence, and suggests tags.
 * All pure functions operating on existing tag/note data.
 */

// ── Tag Usage Analytics ──────────────────────────────────────────────

export interface TagUsageStats {
  tagId: string;
  tagName: string;
  noteCount: number;
  percentage: number; // of total notes
}

/**
 * Compute usage statistics for each tag.
 */
export function computeTagUsage(
  tags: Array<{ id: string; name: string }>,
  noteTagPairs: Array<{ noteId: string; tagId: string }>,
  totalNotes: number,
): TagUsageStats[] {
  const counts = new Map<string, number>();
  for (const pair of noteTagPairs) {
    counts.set(pair.tagId, (counts.get(pair.tagId) ?? 0) + 1);
  }

  return tags
    .map((tag) => ({
      tagId: tag.id,
      tagName: tag.name,
      noteCount: counts.get(tag.id) ?? 0,
      percentage: totalNotes > 0
        ? Math.round(((counts.get(tag.id) ?? 0) / totalNotes) * 100)
        : 0,
    }))
    .sort((a, b) => b.noteCount - a.noteCount);
}

// ── Tag Co-occurrence ────────────────────────────────────────────────

export interface TagCoOccurrence {
  tagIdA: string;
  tagNameA: string;
  tagIdB: string;
  tagNameB: string;
  sharedNotes: number;
  strength: number; // 0-1 Jaccard similarity
}

/**
 * Find tags that frequently appear together on the same notes.
 * Uses Jaccard similarity to measure co-occurrence strength.
 */
export function computeTagCoOccurrence(
  tags: Array<{ id: string; name: string }>,
  noteTagPairs: Array<{ noteId: string; tagId: string }>,
  maxResults = 20,
): TagCoOccurrence[] {
  // Build tag -> notes mapping
  const tagNotes = new Map<string, Set<string>>();
  for (const pair of noteTagPairs) {
    if (!tagNotes.has(pair.tagId)) tagNotes.set(pair.tagId, new Set());
    tagNotes.get(pair.tagId)!.add(pair.noteId);
  }

  const tagMap = new Map(tags.map((t) => [t.id, t.name]));
  const pairs: TagCoOccurrence[] = [];
  const tagIds = [...tagNotes.keys()];

  for (let i = 0; i < tagIds.length; i++) {
    const setA = tagNotes.get(tagIds[i])!;
    for (let j = i + 1; j < tagIds.length; j++) {
      const setB = tagNotes.get(tagIds[j])!;

      // Count intersection
      let shared = 0;
      for (const noteId of setA) {
        if (setB.has(noteId)) shared++;
      }

      if (shared === 0) continue;

      const union = new Set([...setA, ...setB]).size;
      const strength = union > 0 ? Math.round((shared / union) * 100) / 100 : 0;

      pairs.push({
        tagIdA: tagIds[i],
        tagNameA: tagMap.get(tagIds[i]) ?? '',
        tagIdB: tagIds[j],
        tagNameB: tagMap.get(tagIds[j]) ?? '',
        sharedNotes: shared,
        strength,
      });
    }
  }

  return pairs
    .sort((a, b) => b.strength - a.strength)
    .slice(0, maxResults);
}

// ── Unused Tags ──────────────────────────────────────────────────────

/**
 * Find tags that exist but aren't applied to any notes.
 */
export function findUnusedTags(
  tags: Array<{ id: string; name: string }>,
  noteTagPairs: Array<{ noteId: string; tagId: string }>,
): Array<{ id: string; name: string }> {
  const usedTagIds = new Set(noteTagPairs.map((p) => p.tagId));
  return tags.filter((t) => !usedTagIds.has(t.id));
}

// ── Tag Suggestions ──────────────────────────────────────────────────

export interface TagSuggestion {
  tagId: string;
  tagName: string;
  reason: string;
  confidence: number; // 0-1
}

/**
 * Suggest tags for a note based on what tags co-occur with its existing tags.
 * If the note has tag A, and tag B frequently co-occurs with A, suggest B.
 */
export function suggestTags(
  existingTagIds: string[],
  tags: Array<{ id: string; name: string }>,
  noteTagPairs: Array<{ noteId: string; tagId: string }>,
  maxSuggestions = 5,
): TagSuggestion[] {
  if (existingTagIds.length === 0) return [];

  const existingSet = new Set(existingTagIds);

  // Build tag -> notes mapping
  const tagNotes = new Map<string, Set<string>>();
  for (const pair of noteTagPairs) {
    if (!tagNotes.has(pair.tagId)) tagNotes.set(pair.tagId, new Set());
    tagNotes.get(pair.tagId)!.add(pair.noteId);
  }

  const tagMap = new Map(tags.map((t) => [t.id, t.name]));
  const candidateScores = new Map<string, number>();

  // For each existing tag, find other tags that frequently co-occur
  for (const tagId of existingTagIds) {
    const notesWithTag = tagNotes.get(tagId);
    if (!notesWithTag) continue;

    // Count how often each other tag appears on the same notes
    for (const noteId of notesWithTag) {
      for (const pair of noteTagPairs) {
        if (pair.noteId === noteId && !existingSet.has(pair.tagId)) {
          candidateScores.set(
            pair.tagId,
            (candidateScores.get(pair.tagId) ?? 0) + 1,
          );
        }
      }
    }
  }

  // Normalize scores by total possible co-occurrences
  const suggestions: TagSuggestion[] = [];
  for (const [tagId, coCount] of candidateScores) {
    const tagNoteCount = tagNotes.get(tagId)?.size ?? 0;
    const maxPossible = existingTagIds.length * tagNoteCount;
    const confidence = maxPossible > 0
      ? Math.round((coCount / maxPossible) * 100) / 100
      : 0;

    if (confidence > 0.1) {
      suggestions.push({
        tagId,
        tagName: tagMap.get(tagId) ?? '',
        reason: `Co-occurs with your tags in ${coCount} notes`,
        confidence,
      });
    }
  }

  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxSuggestions);
}

// ── Aggregate Insights ───────────────────────────────────────────────

export interface TagIntelligenceInsights {
  usage: TagUsageStats[];
  coOccurrence: TagCoOccurrence[];
  unusedTags: Array<{ id: string; name: string }>;
  topTagCount: number;
  unusedTagCount: number;
}

/**
 * Compute all tag intelligence insights.
 */
export function computeTagIntelligence(
  tags: Array<{ id: string; name: string }>,
  noteTagPairs: Array<{ noteId: string; tagId: string }>,
  totalNotes: number,
): TagIntelligenceInsights {
  const usage = computeTagUsage(tags, noteTagPairs, totalNotes);
  const coOccurrence = computeTagCoOccurrence(tags, noteTagPairs);
  const unused = findUnusedTags(tags, noteTagPairs);

  return {
    usage,
    coOccurrence,
    unusedTags: unused,
    topTagCount: usage.length > 0 ? usage[0].noteCount : 0,
    unusedTagCount: unused.length,
  };
}
