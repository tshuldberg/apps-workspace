import { describe, expect, it } from 'vitest';
import {
  computeProgramProgress,
  computeRequirementProgress,
  detectDoubleCount,
  suggestClassesForRequirement,
} from '../engine/degree-engine';
import type {
  ClassRow,
  DegreeProgramRow,
  RequirementRow,
  RequirementSatisfactionRow,
} from '../models/schemas';

const ISO = '2026-01-01T00:00:00.000Z';

function makeProgram(over: Partial<DegreeProgramRow> = {}): DegreeProgramRow {
  return {
    id: 'p-1',
    name: 'BS CS',
    institution: null,
    degree_type: 'BS',
    total_credits_required: 120,
    gpa_required: null,
    catalog_year: null,
    start_date: null,
    expected_completion: null,
    is_primary: 1,
    notes_md: null,
    created_at: ISO,
    updated_at: ISO,
    ...over,
  };
}

function makeRequirement(over: Partial<RequirementRow>): RequirementRow {
  return {
    id: 'r-1',
    program_id: 'p-1',
    name: 'Major core',
    category: 'major',
    credits_required: 0,
    course_count_required: 0,
    min_grade: null,
    allowed_course_codes: null,
    notes_md: null,
    sort_order: 0,
    created_at: ISO,
    ...over,
  };
}

function makeSat(
  over: Partial<RequirementSatisfactionRow> & {
    id: string;
    requirement_id: string;
    class_id: string;
  },
): RequirementSatisfactionRow {
  return {
    credits_applied: 3,
    status: 'planned',
    approved_by: null,
    created_at: ISO,
    ...over,
  };
}

function makeClass(over: Partial<ClassRow> & { id: string }): ClassRow {
  return {
    semester_id: 'sem-1',
    name: 'Class',
    code: null,
    section: null,
    credits: 3,
    day_times: null,
    room: null,
    building: null,
    teacher_id: null,
    category_weights: null,
    current_grade: null,
    target_grade: null,
    color: '#3B82F6',
    notes_md: null,
    created_at: ISO,
    updated_at: ISO,
    ...over,
  };
}

describe('computeRequirementProgress', () => {
  it('returns zero progress for a requirement with no satisfactions', () => {
    const req = makeRequirement({ credits_required: 12, course_count_required: 4 });
    const result = computeRequirementProgress(req, [], []);
    expect(result.credits_completed).toBe(0);
    expect(result.courses_completed).toBe(0);
    expect(result.is_satisfied).toBe(false);
  });

  it('counts a graded class meeting min_grade as completed', () => {
    const req = makeRequirement({
      credits_required: 3,
      course_count_required: 1,
      min_grade: 'C',
    });
    const cls = makeClass({ id: 'c-1', credits: 3, current_grade: 3.0 });
    const sat = makeSat({
      id: 's-1',
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
    });
    const r = computeRequirementProgress(req, [sat], [cls]);
    expect(r.credits_completed).toBe(3);
    expect(r.courses_completed).toBe(1);
    expect(r.is_satisfied).toBe(true);
    expect(r.blocking_classes).toEqual([]);
  });

  it('flags a graded class that fails min_grade as blocking', () => {
    const req = makeRequirement({
      credits_required: 3,
      course_count_required: 1,
      min_grade: 'C',
    });
    const cls = makeClass({ id: 'c-1', credits: 3, current_grade: 1.0 });
    const sat = makeSat({
      id: 's-1',
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 3,
      status: 'completed',
    });
    const r = computeRequirementProgress(req, [sat], [cls]);
    expect(r.credits_completed).toBe(0);
    expect(r.credits_in_progress).toBe(3);
    expect(r.blocking_classes.map((c) => c.id)).toEqual(['c-1']);
    expect(r.is_satisfied).toBe(false);
  });

  it('treats an ungraded class with planned status as planned', () => {
    const req = makeRequirement({ credits_required: 3, course_count_required: 1 });
    const cls = makeClass({ id: 'c-1', credits: 3 });
    const sat = makeSat({
      id: 's-1',
      requirement_id: 'r-1',
      class_id: 'c-1',
      status: 'planned',
    });
    const r = computeRequirementProgress(req, [sat], [cls]);
    expect(r.credits_planned).toBe(3);
    expect(r.courses_planned).toBe(1);
    expect(r.is_satisfied).toBe(false);
  });

  it('treats an ungraded class flagged completed as in_progress (no premature completion)', () => {
    const req = makeRequirement({ credits_required: 3, course_count_required: 1 });
    const cls = makeClass({ id: 'c-1', credits: 3 });
    const sat = makeSat({
      id: 's-1',
      requirement_id: 'r-1',
      class_id: 'c-1',
      status: 'completed',
    });
    const r = computeRequirementProgress(req, [sat], [cls]);
    expect(r.credits_in_progress).toBe(3);
    expect(r.credits_completed).toBe(0);
  });

  it('only counts satisfactions for the given requirement', () => {
    const req = makeRequirement({
      id: 'r-1',
      credits_required: 3,
      course_count_required: 1,
    });
    const cls = makeClass({ id: 'c-1', credits: 3, current_grade: 4.0 });
    const sats: RequirementSatisfactionRow[] = [
      makeSat({ id: 's-1', requirement_id: 'r-2', class_id: 'c-1' }),
    ];
    const r = computeRequirementProgress(req, sats, [cls]);
    expect(r.credits_completed).toBe(0);
  });

  it('respects credits_applied override (partial credit)', () => {
    const req = makeRequirement({ credits_required: 2, course_count_required: 1 });
    const cls = makeClass({ id: 'c-1', credits: 4, current_grade: 4.0 });
    const sat = makeSat({
      id: 's-1',
      requirement_id: 'r-1',
      class_id: 'c-1',
      credits_applied: 2,
    });
    const r = computeRequirementProgress(req, [sat], [cls]);
    expect(r.credits_completed).toBe(2);
    expect(r.is_satisfied).toBe(true);
  });
});

describe('computeProgramProgress', () => {
  it('aggregates totals across requirements and computes percent_complete', () => {
    const program = makeProgram({ total_credits_required: 12 });
    const reqs = [
      makeRequirement({ id: 'r-1', credits_required: 6, course_count_required: 2 }),
      makeRequirement({ id: 'r-2', credits_required: 6, course_count_required: 2 }),
    ];
    const classes = [
      makeClass({ id: 'c-1', credits: 3, current_grade: 4.0 }),
      makeClass({ id: 'c-2', credits: 3, current_grade: 4.0 }),
      makeClass({ id: 'c-3', credits: 3, current_grade: 3.0 }),
    ];
    const sats = [
      makeSat({ id: 's-1', requirement_id: 'r-1', class_id: 'c-1' }),
      makeSat({ id: 's-2', requirement_id: 'r-1', class_id: 'c-2' }),
      makeSat({ id: 's-3', requirement_id: 'r-2', class_id: 'c-3' }),
    ];
    const result = computeProgramProgress(program, reqs, sats, classes);
    expect(result.total_credits_completed).toBe(9);
    expect(result.total_credits_required).toBe(12);
    expect(result.percent_complete).toBeCloseTo(75, 5);
    expect(result.is_satisfied).toBe(false);
  });

  it('reports gpa_status meets when GPA clears the requirement', () => {
    const program = makeProgram({
      total_credits_required: 6,
      gpa_required: 3.0,
    });
    const reqs = [makeRequirement({ id: 'r-1', credits_required: 6, course_count_required: 2 })];
    const classes = [
      makeClass({ id: 'c-1', credits: 3, current_grade: 4.0 }),
      makeClass({ id: 'c-2', credits: 3, current_grade: 3.7 }),
    ];
    const sats = [
      makeSat({ id: 's-1', requirement_id: 'r-1', class_id: 'c-1' }),
      makeSat({ id: 's-2', requirement_id: 'r-1', class_id: 'c-2' }),
    ];
    const result = computeProgramProgress(program, reqs, sats, classes);
    expect(result.gpa_status).toBe('meets');
    expect(result.is_satisfied).toBe(true);
  });

  it('reports gpa_status below when GPA is short', () => {
    const program = makeProgram({
      total_credits_required: 6,
      gpa_required: 3.5,
    });
    const reqs = [makeRequirement({ id: 'r-1', credits_required: 6, course_count_required: 2 })];
    const classes = [
      makeClass({ id: 'c-1', credits: 3, current_grade: 2.0 }),
      makeClass({ id: 'c-2', credits: 3, current_grade: 2.7 }),
    ];
    const sats = [
      makeSat({ id: 's-1', requirement_id: 'r-1', class_id: 'c-1' }),
      makeSat({ id: 's-2', requirement_id: 'r-1', class_id: 'c-2' }),
    ];
    const result = computeProgramProgress(program, reqs, sats, classes);
    expect(result.gpa_status).toBe('below');
  });

  it('reports gpa_status unknown when no gpa_required is set', () => {
    const program = makeProgram({ total_credits_required: 0, gpa_required: null });
    const result = computeProgramProgress(program, [], [], []);
    expect(result.gpa_status).toBe('unknown');
  });

  it('marks fully-satisfied program as is_satisfied', () => {
    const program = makeProgram({ total_credits_required: 3 });
    const reqs = [makeRequirement({ id: 'r-1', credits_required: 3, course_count_required: 1 })];
    const classes = [makeClass({ id: 'c-1', credits: 3, current_grade: 4.0 })];
    const sats = [
      makeSat({
        id: 's-1',
        requirement_id: 'r-1',
        class_id: 'c-1',
        credits_applied: 3,
      }),
    ];
    const result = computeProgramProgress(program, reqs, sats, classes);
    expect(result.is_satisfied).toBe(true);
    expect(result.percent_complete).toBe(100);
  });
});

describe('suggestClassesForRequirement', () => {
  it('returns empty when no allowed_course_codes are set', () => {
    const req = makeRequirement({ allowed_course_codes: null });
    const classes = [makeClass({ id: 'c-1', code: 'CS-101' })];
    expect(suggestClassesForRequirement(req, classes)).toEqual([]);
  });

  it('matches exact codes case-insensitively', () => {
    const req = makeRequirement({
      allowed_course_codes: JSON.stringify(['cs-101']),
    });
    const classes = [
      makeClass({ id: 'c-1', code: 'CS-101' }),
      makeClass({ id: 'c-2', code: 'CS-201' }),
    ];
    expect(suggestClassesForRequirement(req, classes).map((c) => c.id)).toEqual(['c-1']);
  });

  it('treats trailing * as a prefix glob', () => {
    const req = makeRequirement({
      allowed_course_codes: JSON.stringify(['MATH-2*']),
    });
    const classes = [
      makeClass({ id: 'c-1', code: 'MATH-201' }),
      makeClass({ id: 'c-2', code: 'MATH-220' }),
      makeClass({ id: 'c-3', code: 'MATH-101' }),
    ];
    expect(
      suggestClassesForRequirement(req, classes).map((c) => c.id).sort(),
    ).toEqual(['c-1', 'c-2']);
  });

  it('skips classes without a code', () => {
    const req = makeRequirement({
      allowed_course_codes: JSON.stringify(['CS-101']),
    });
    const classes = [makeClass({ id: 'c-1', code: null })];
    expect(suggestClassesForRequirement(req, classes)).toEqual([]);
  });
});

describe('detectDoubleCount', () => {
  it('returns empty when no class satisfies more than one requirement', () => {
    const sats = [
      makeSat({ id: 's-1', requirement_id: 'r-1', class_id: 'c-1' }),
      makeSat({ id: 's-2', requirement_id: 'r-2', class_id: 'c-2' }),
    ];
    expect(detectDoubleCount(sats)).toEqual([]);
  });

  it('groups requirement_ids per double-counted class, sorted', () => {
    const sats = [
      makeSat({ id: 's-1', requirement_id: 'r-2', class_id: 'c-1' }),
      makeSat({ id: 's-2', requirement_id: 'r-1', class_id: 'c-1' }),
      makeSat({ id: 's-3', requirement_id: 'r-3', class_id: 'c-2' }),
      makeSat({ id: 's-4', requirement_id: 'r-1', class_id: 'c-2' }),
    ];
    const result = detectDoubleCount(sats);
    expect(result).toEqual([
      { class_id: 'c-1', requirement_ids: ['r-1', 'r-2'] },
      { class_id: 'c-2', requirement_ids: ['r-1', 'r-3'] },
    ]);
  });
});
