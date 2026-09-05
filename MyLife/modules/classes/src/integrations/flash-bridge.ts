/**
 * Flash bridge (P9-A): pure helpers for creating Flash decks seeded from a class
 * and aggregating study-session topics into a deduped list.
 *
 * No DB access. No partner-side imports. Consumer wires the result into Flash
 * deck-creation flow.
 */

import type {
  AssignmentRow,
  ClassRow,
  StudySessionRow,
} from '../models/schemas';

export interface FlashDeckSeed {
  name: string;
  classId: string;
  assignmentId: string | null;
  suggestedTopics: string[];
}

function parseTopicsCovered(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string' && s.length > 0)
      : [];
  } catch {
    return [];
  }
}

/**
 * Aggregate study-session `topics_covered` JSON arrays into a single deduped,
 * order-preserving list. Empty input returns `[]`.
 */
export function aggregateStudyTopics(
  studySessions: Pick<StudySessionRow, 'topics_covered'>[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of studySessions) {
    const topics = parseTopicsCovered(s.topics_covered);
    for (const t of topics) {
      const trimmed = t.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  return out;
}

/**
 * Build a Flash deck seed from a class, optional assignment, and any prior
 * study-session topics. Deck name format:
 *   "<class.code or class.name>" or "<class.code or class.name> — <assignment.title>"
 */
export function buildClassDeckSeed(
  cls: Pick<ClassRow, 'id' | 'name' | 'code'>,
  assignment: Pick<AssignmentRow, 'id' | 'title'> | null | undefined,
  studySessions: Pick<StudySessionRow, 'topics_covered'>[],
): FlashDeckSeed {
  const label = cls.code?.trim() || cls.name;
  const name = assignment ? `${label}: ${assignment.title}` : label;
  return {
    name,
    classId: cls.id,
    assignmentId: assignment?.id ?? null,
    suggestedTopics: aggregateStudyTopics(studySessions),
  };
}
