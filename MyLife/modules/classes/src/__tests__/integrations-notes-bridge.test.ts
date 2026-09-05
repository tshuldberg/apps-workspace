import { describe, expect, it } from 'vitest';
import {
  aggregateClassNotePrompts,
  buildClassNoteContext,
} from '../integrations/notes-bridge';

const cls = {
  id: 'c1',
  name: 'Algorithms',
  code: 'CS 401',
  semester_id: 's1',
};

describe('buildClassNoteContext', () => {
  it('builds full context with code-tag', () => {
    const ctx = buildClassNoteContext(cls);
    expect(ctx.classId).toBe('c1');
    expect(ctx.className).toBe('Algorithms');
    expect(ctx.semesterId).toBe('s1');
    expect(ctx.tags).toContain('class');
    expect(ctx.tags).toContain('c1');
    expect(ctx.tags).toContain('CS 401');
  });

  it('omits code tag when code is null', () => {
    const ctx = buildClassNoteContext({ ...cls, code: null });
    expect(ctx.tags).not.toContain('CS 401');
    expect(ctx.tags).toEqual(['class', 'c1']);
  });
});

describe('aggregateClassNotePrompts', () => {
  it('always includes lecture + course overview', () => {
    const out = aggregateClassNotePrompts(cls, [], []);
    expect(out.some((p) => p.tag === 'lecture')).toBe(true);
    expect(out.some((p) => p.title.includes('Course overview'))).toBe(true);
  });

  it('includes upcoming assignments for the class', () => {
    const out = aggregateClassNotePrompts(
      cls,
      [],
      [
        {
          title: 'Project 1',
          due_at: '2026-05-01T00:00:00.000Z',
          class_id: 'c1',
          status: 'in_progress',
        },
        {
          title: 'Wrong-class HW',
          due_at: '2026-05-02T00:00:00.000Z',
          class_id: 'other',
          status: 'in_progress',
        },
      ],
    );
    expect(out.some((p) => p.title.includes('Project 1'))).toBe(true);
    expect(out.some((p) => p.title.includes('Wrong-class HW'))).toBe(false);
  });

  it('skips graded assignments', () => {
    const out = aggregateClassNotePrompts(
      cls,
      [],
      [
        {
          title: 'Old HW',
          due_at: '2026-01-01T00:00:00.000Z',
          class_id: 'c1',
          status: 'graded',
        },
      ],
    );
    expect(out.some((p) => p.title.includes('Old HW'))).toBe(false);
  });

  it('caps results at 6', () => {
    const assignments = Array.from({ length: 10 }).map((_, i) => ({
      title: `HW${i}`,
      due_at: `2026-05-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      class_id: 'c1',
      status: 'not_started' as const,
    }));
    const out = aggregateClassNotePrompts(cls, [], assignments);
    expect(out.length).toBeLessThanOrEqual(6);
  });
});
