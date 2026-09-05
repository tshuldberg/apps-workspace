import type {
  ClassRow,
  DegreeProgramRow,
  RequirementRow,
  RequirementSatisfactionRow,
} from '../models/schemas';
import {
  calculateSemesterGPA,
  gpaFromLetter,
  letterFromPercent,
} from './grade-engine';

/**
 * Pure-function degree-progress engine. No DB access, no side effects.
 * Callers pass in already-loaded rows.
 *
 * P6-A: requirement progress, program GPA status, course-code suggestion,
 * double-count detection.
 */

// -- Types --

export interface RequirementProgress {
  requirement_id: string;
  name: string;
  credits_completed: number;
  credits_in_progress: number;
  credits_planned: number;
  credits_required: number;
  courses_completed: number;
  courses_in_progress: number;
  courses_planned: number;
  course_count_required: number;
  is_satisfied: boolean;
  blocking_classes: ClassRow[];
}

export type GpaStatus = 'meets' | 'below' | 'unknown';

export interface ProgramProgress {
  program_id: string;
  requirements: RequirementProgress[];
  total_credits_completed: number;
  total_credits_in_progress: number;
  total_credits_planned: number;
  total_credits_required: number;
  percent_complete: number;
  is_satisfied: boolean;
  gpa_status: GpaStatus;
}

// -- Helpers --

type Bucket = 'completed' | 'in_progress' | 'planned';

/**
 * gradeMeetsMin: returns true when the class's current_grade satisfies
 * the requirement's min_grade. We treat current_grade as a GPA-scale
 * number (0-4.0+); if the value looks like a percent (>4.5) we convert
 * via the standard letter scale first.
 */
function gradeMeetsMin(
  classRow: ClassRow,
  minGrade: string | null,
): boolean {
  const cg = classRow.current_grade;
  if (cg === null || cg === undefined || !Number.isFinite(cg)) return false;
  if (!minGrade) return true; // no minimum -> any graded class passes
  const minGpa = gpaFromLetter(minGrade);
  const cgGpa = cg > 4.5 ? gpaFromLetter(letterFromPercent(cg)) : cg;
  return cgGpa + 1e-9 >= minGpa;
}

function classIsGraded(classRow: ClassRow): boolean {
  return (
    classRow.current_grade !== null &&
    classRow.current_grade !== undefined &&
    Number.isFinite(classRow.current_grade)
  );
}

/**
 * categorize: derive the effective bucket for a (satisfaction, class) pair.
 * Falls back to class state when the satisfaction status is 'planned' or
 * 'in_progress' but the underlying class is already graded.
 */
function categorize(
  sat: RequirementSatisfactionRow,
  classRow: ClassRow | undefined,
  minGrade: string | null,
): { bucket: Bucket; blocking: boolean } {
  if (!classRow) {
    return { bucket: sat.status as Bucket, blocking: false };
  }
  if (classIsGraded(classRow)) {
    if (gradeMeetsMin(classRow, minGrade)) {
      return { bucket: 'completed', blocking: false };
    }
    // Graded but failed the min-grade gate.
    return { bucket: 'in_progress', blocking: true };
  }
  // Not yet graded: respect satisfaction status, but never claim 'completed'.
  if (sat.status === 'completed') {
    return { bucket: 'in_progress', blocking: false };
  }
  return { bucket: sat.status as Bucket, blocking: false };
}

// -- Public functions --

export function computeRequirementProgress(
  requirement: RequirementRow,
  satisfactions: RequirementSatisfactionRow[],
  classes: ClassRow[],
  // assignments?: AssignmentRow[] -- reserved; not used in current impl.
): RequirementProgress {
  const classById = new Map<string, ClassRow>();
  for (const c of classes) classById.set(c.id, c);

  const ours = satisfactions.filter(
    (s) => s.requirement_id === requirement.id,
  );

  let credits_completed = 0;
  let credits_in_progress = 0;
  let credits_planned = 0;
  let courses_completed = 0;
  let courses_in_progress = 0;
  let courses_planned = 0;
  const blocking_classes: ClassRow[] = [];

  for (const sat of ours) {
    const classRow = classById.get(sat.class_id);
    const { bucket, blocking } = categorize(sat, classRow, requirement.min_grade);
    if (blocking && classRow) blocking_classes.push(classRow);

    if (bucket === 'completed') {
      credits_completed += sat.credits_applied;
      courses_completed += 1;
    } else if (bucket === 'in_progress') {
      credits_in_progress += sat.credits_applied;
      courses_in_progress += 1;
    } else {
      credits_planned += sat.credits_applied;
      courses_planned += 1;
    }
  }

  const credits_ok =
    requirement.credits_required === 0 ||
    credits_completed >= requirement.credits_required;
  const courses_ok =
    requirement.course_count_required === 0 ||
    courses_completed >= requirement.course_count_required;
  const has_any_constraint =
    requirement.credits_required > 0 || requirement.course_count_required > 0;
  const is_satisfied =
    has_any_constraint && credits_ok && courses_ok && blocking_classes.length === 0;

  return {
    requirement_id: requirement.id,
    name: requirement.name,
    credits_completed,
    credits_in_progress,
    credits_planned,
    credits_required: requirement.credits_required,
    courses_completed,
    courses_in_progress,
    courses_planned,
    course_count_required: requirement.course_count_required,
    is_satisfied,
    blocking_classes,
  };
}

export function computeProgramProgress(
  program: DegreeProgramRow,
  requirements: RequirementRow[],
  satisfactions: RequirementSatisfactionRow[],
  classes: ClassRow[],
): ProgramProgress {
  const classById = new Map<string, ClassRow>();
  for (const c of classes) classById.set(c.id, c);

  const reqProgress = requirements.map((r) =>
    computeRequirementProgress(r, satisfactions, classes),
  );

  const total_credits_completed = reqProgress.reduce(
    (s, r) => s + r.credits_completed,
    0,
  );
  const total_credits_in_progress = reqProgress.reduce(
    (s, r) => s + r.credits_in_progress,
    0,
  );
  const total_credits_planned = reqProgress.reduce(
    (s, r) => s + r.credits_planned,
    0,
  );
  const total_credits_required = program.total_credits_required;

  const percent_complete =
    total_credits_required > 0
      ? Math.min(100, (total_credits_completed / total_credits_required) * 100)
      : 0;

  const all_reqs_satisfied =
    requirements.length > 0 && reqProgress.every((r) => r.is_satisfied);
  const credits_satisfied =
    total_credits_required === 0 ||
    total_credits_completed >= total_credits_required;
  const is_satisfied = all_reqs_satisfied && credits_satisfied;

  // GPA status: credit-weighted across completed satisfactions.
  let gpa_status: GpaStatus = 'unknown';
  if (program.gpa_required !== null && program.gpa_required !== undefined) {
    const completedClasses = collectCompletedClasses(
      requirements,
      satisfactions,
      classById,
    );
    const gpaInputs = completedClasses.map((c) => ({
      credits: c.credits ?? 0,
      letter:
        c.current_grade === null || c.current_grade === undefined
          ? null
          : c.current_grade > 4.5
            ? letterFromPercent(c.current_grade)
            : letterFromGpa(c.current_grade),
    }));
    const result = calculateSemesterGPA(gpaInputs);
    if (result.gpa === null) {
      gpa_status = 'unknown';
    } else if (result.gpa + 1e-9 >= program.gpa_required) {
      gpa_status = 'meets';
    } else {
      gpa_status = 'below';
    }
  }

  return {
    program_id: program.id,
    requirements: reqProgress,
    total_credits_completed,
    total_credits_in_progress,
    total_credits_planned,
    total_credits_required,
    percent_complete,
    is_satisfied,
    gpa_status,
  };
}

/**
 * Collect distinct classes that count as completed for the program,
 * based on the same categorization rules as computeRequirementProgress.
 * De-dupes on class_id so a double-counted class only contributes once
 * to the program GPA.
 */
function collectCompletedClasses(
  requirements: RequirementRow[],
  satisfactions: RequirementSatisfactionRow[],
  classById: Map<string, ClassRow>,
): ClassRow[] {
  const reqById = new Map<string, RequirementRow>();
  for (const r of requirements) reqById.set(r.id, r);

  const seen = new Set<string>();
  const out: ClassRow[] = [];

  for (const sat of satisfactions) {
    const req = reqById.get(sat.requirement_id);
    if (!req) continue;
    const classRow = classById.get(sat.class_id);
    if (!classRow) continue;
    const { bucket } = categorize(sat, classRow, req.min_grade);
    if (bucket !== 'completed') continue;
    if (seen.has(classRow.id)) continue;
    seen.add(classRow.id);
    out.push(classRow);
  }

  return out;
}

/**
 * Inverse of gpaFromLetter for the typical 4.0 plus/minus scale.
 * Picks the closest letter band <= the gpa value. Used when the
 * caller stored the class grade as a GPA value rather than a letter.
 */
function letterFromGpa(gpa: number): string {
  const bands: Array<{ letter: string; min: number }> = [
    { letter: 'A', min: 4.0 },
    { letter: 'A-', min: 3.7 },
    { letter: 'B+', min: 3.3 },
    { letter: 'B', min: 3.0 },
    { letter: 'B-', min: 2.7 },
    { letter: 'C+', min: 2.3 },
    { letter: 'C', min: 2.0 },
    { letter: 'C-', min: 1.7 },
    { letter: 'D+', min: 1.3 },
    { letter: 'D', min: 1.0 },
    { letter: 'D-', min: 0.7 },
    { letter: 'F', min: 0 },
  ];
  for (const b of bands) {
    if (gpa + 1e-9 >= b.min) return b.letter;
  }
  return 'F';
}

/**
 * suggestClassesForRequirement: filter `allClasses` to those whose `code`
 * matches one of the requirement's `allowed_course_codes`. Patterns ending
 * in `*` are treated as a prefix glob; otherwise exact (case-insensitive).
 *
 * Returns an empty array when the requirement has no allowed_course_codes
 * (no auto-suggest mode), so callers can choose a different fallback.
 */
export function suggestClassesForRequirement(
  requirement: RequirementRow,
  allClasses: ClassRow[],
): ClassRow[] {
  const raw = requirement.allowed_course_codes;
  if (!raw) return [];
  let patterns: string[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    patterns = parsed.filter((p): p is string => typeof p === 'string');
  } catch {
    return [];
  }
  if (patterns.length === 0) return [];

  const out: ClassRow[] = [];
  for (const c of allClasses) {
    if (!c.code) continue;
    if (matchesAnyPattern(c.code, patterns)) out.push(c);
  }
  return out;
}

function matchesAnyPattern(code: string, patterns: string[]): boolean {
  const target = code.toUpperCase();
  for (const p of patterns) {
    const pat = p.toUpperCase();
    if (pat.endsWith('*')) {
      const prefix = pat.slice(0, -1);
      if (target.startsWith(prefix)) return true;
    } else if (target === pat) {
      return true;
    }
  }
  return false;
}

export interface DoubleCountEntry {
  class_id: string;
  requirement_ids: string[];
}

/**
 * detectDoubleCount: any class_id that satisfies more than one requirement.
 * Returns one entry per class with the full set of requirement_ids it
 * satisfies (sorted for deterministic output).
 */
export function detectDoubleCount(
  satisfactions: RequirementSatisfactionRow[],
): DoubleCountEntry[] {
  const byClass = new Map<string, Set<string>>();
  for (const s of satisfactions) {
    let set = byClass.get(s.class_id);
    if (!set) {
      set = new Set<string>();
      byClass.set(s.class_id, set);
    }
    set.add(s.requirement_id);
  }

  const out: DoubleCountEntry[] = [];
  for (const [class_id, reqs] of byClass.entries()) {
    if (reqs.size <= 1) continue;
    out.push({
      class_id,
      requirement_ids: [...reqs].sort(),
    });
  }
  out.sort((a, b) => a.class_id.localeCompare(b.class_id));
  return out;
}
