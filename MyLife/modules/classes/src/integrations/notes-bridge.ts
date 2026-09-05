/**
 * Notes bridge (P9-B): pure helpers for organizing class-related notes.
 *
 * Consumer (MyNotes) uses these to pre-fill note context (tags, classId) and to
 * suggest note titles based on recent academic activity.
 */

import type {
  AssignmentRow,
  ClassRow,
  StudySessionRow,
} from '../models/schemas';

export interface ClassNoteContext {
  classId: string;
  className: string;
  code: string | null;
  semesterId: string;
  tags: string[];
}

export interface SuggestedNotePrompt {
  title: string;
  tag: 'lecture' | 'study' | 'assignment' | 'class';
}

/**
 * Build the static context a Notes screen needs when creating a new note tied
 * to a class: id, display name, course code, semester, and a stable tag set.
 */
export function buildClassNoteContext(
  cls: Pick<ClassRow, 'id' | 'name' | 'code' | 'semester_id'>,
): ClassNoteContext {
  const tags: string[] = ['class', cls.id];
  if (cls.code && cls.code.trim().length > 0) {
    tags.push(cls.code.trim());
  }
  return {
    classId: cls.id,
    className: cls.name,
    code: cls.code,
    semesterId: cls.semester_id,
    tags,
  };
}

function dayKey(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

/**
 * Suggest note titles given recent study sessions and recent assignments. Each
 * prompt is unique and tagged. Returns up to 6 suggestions.
 *
 * Ordering: lecture (today) > assignment (next due) > study recap > class default.
 */
export function aggregateClassNotePrompts(
  cls: Pick<ClassRow, 'id' | 'name' | 'code'>,
  recentSessions: Pick<StudySessionRow, 'started_at' | 'class_id'>[],
  recentAssignments: Pick<AssignmentRow, 'title' | 'due_at' | 'class_id' | 'status'>[],
): SuggestedNotePrompt[] {
  const label = cls.code?.trim() || cls.name;
  const out: SuggestedNotePrompt[] = [];
  const seen = new Set<string>();

  function push(title: string, tag: SuggestedNotePrompt['tag']): void {
    if (seen.has(title)) return;
    seen.add(title);
    out.push({ title, tag });
  }

  const today = new Date().toISOString().slice(0, 10);
  push(`${label} — Lecture notes ${today}`, 'lecture');

  const upcoming = recentAssignments
    .filter((a) => a.class_id === cls.id && a.due_at && a.status !== 'graded')
    .sort((a, b) => (a.due_at || '').localeCompare(b.due_at || ''));
  for (const a of upcoming.slice(0, 2)) {
    push(`${label} — ${a.title}`, 'assignment');
  }

  const studyDays = Array.from(
    new Set(
      recentSessions
        .filter((s) => s.class_id === cls.id)
        .map((s) => dayKey(s.started_at))
        .filter((d): d is string => d !== null),
    ),
  ).sort().reverse();
  for (const d of studyDays.slice(0, 2)) {
    push(`${label} — Study recap ${d}`, 'study');
  }

  push(`${label} — Course overview`, 'class');

  return out.slice(0, 6);
}
