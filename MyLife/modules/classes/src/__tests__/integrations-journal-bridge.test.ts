import { describe, expect, it } from 'vitest';
import { buildAcademicReflectionPrompts } from '../integrations/journal-bridge';

const semester = { id: 's1', name: 'Spring 2026' };

describe('buildAcademicReflectionPrompts', () => {
  it('returns at least 3 prompts on empty classes', () => {
    const out = buildAcademicReflectionPrompts(semester, []);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out.every((p) => p.tag === 'academic')).toBe(true);
  });

  it('includes a GPA prompt when gpa is provided', () => {
    const out = buildAcademicReflectionPrompts(semester, [], 3.75);
    expect(out.some((p) => p.title.includes('3.75'))).toBe(true);
  });

  it('skips GPA prompt when gpa is null', () => {
    const out = buildAcademicReflectionPrompts(semester, [], null);
    expect(out.some((p) => p.title.includes('GPA'))).toBe(false);
  });

  it('includes per-class wrap-up prompts (max 3)', () => {
    const classes = Array.from({ length: 5 }).map((_, i) => ({
      id: `c${i}`,
      name: `Class ${i}`,
      code: `CL ${100 + i}`,
    }));
    const out = buildAcademicReflectionPrompts(semester, classes);
    const wrapUps = out.filter((p) => p.title.includes('wrap-up'));
    expect(wrapUps.length).toBeLessThanOrEqual(3);
    expect(wrapUps.length).toBeGreaterThan(0);
  });

  it('uses class code label when present', () => {
    const out = buildAcademicReflectionPrompts(semester, [
      { id: 'c1', name: 'Algorithms', code: 'CS 401' },
    ]);
    expect(out.some((p) => p.title.startsWith('CS 401'))).toBe(true);
  });
});
