/**
 * Budget bridge (P9-E): pure helpers extracting education-related expenses
 * from class + semester data and producing a suggested envelope shape that
 * MyBudget can consume.
 *
 * Note: `cs_classes` does not currently carry textbook/supply cost fields, so
 * those buckets are returned as empty entries unless a future schema change
 * adds them. We DO NOT add new fields to `cs_classes` here.
 */

import type { ClassRow, SemesterRow } from '../models/schemas';

export type EducationCategory =
  | 'tuition'
  | 'textbooks'
  | 'supplies'
  | 'fees';

export interface EducationExpense {
  category: EducationCategory;
  amount: number;
  label: string;
  semesterId: string;
  classId: string | null;
}

export interface EducationBudgetSuggestion {
  envelope: 'Education';
  sub: {
    tuition: number;
    textbooks: number;
    supplies: number;
    fees: number;
  };
  total: number;
}

export interface CostPerCreditEntry {
  semesterId: string;
  cost_per_credit: number;
}

export interface CostPerCreditResult {
  avg_cost_per_credit: number;
  by_semester: CostPerCreditEntry[];
}

// --- Heuristic per-credit defaults (USD), used when no per-class amounts exist
const DEFAULT_TUITION_PER_CREDIT = 0;
const DEFAULT_TEXTBOOK_PER_CLASS = 0;

/**
 * Returns the set of education expenses derived from classes + semesters. Today
 * this returns an empty array because `cs_classes` has no cost fields. The
 * function still returns a typed array so consumers can wire it now without a
 * follow-up patch when cost fields land. Empty input yields `[]`.
 */
export function extractEducationExpenses(
  _classes: Pick<ClassRow, 'id' | 'semester_id' | 'name' | 'credits'>[],
  _semesters: Pick<SemesterRow, 'id' | 'name'>[],
): EducationExpense[] {
  return [];
}

/**
 * Build a recommended Education envelope for one semester. Returns zeroed
 * buckets if the semester has no classes (consumer should still be able to
 * render a placeholder card).
 */
export function suggestEducationBudget(
  semester: Pick<SemesterRow, 'id' | 'name'>,
  classes: Pick<ClassRow, 'id' | 'semester_id' | 'credits'>[],
): EducationBudgetSuggestion {
  const semesterClasses = classes.filter((c) => c.semester_id === semester.id);
  const totalCredits = semesterClasses.reduce(
    (sum, c) => sum + (c.credits || 0),
    0,
  );
  const sub = {
    tuition: totalCredits * DEFAULT_TUITION_PER_CREDIT,
    textbooks: semesterClasses.length * DEFAULT_TEXTBOOK_PER_CLASS,
    supplies: 0,
    fees: 0,
  };
  const total = sub.tuition + sub.textbooks + sub.supplies + sub.fees;
  return { envelope: 'Education', sub, total };
}

/**
 * Compute cost-per-credit by semester from any extracted expenses. With no
 * expenses this returns `{ avg_cost_per_credit: 0, by_semester: [] }`.
 */
export function costPerCreditHour(
  semesters: Pick<SemesterRow, 'id' | 'credit_hours'>[],
  expenses: EducationExpense[] = [],
): CostPerCreditResult {
  const totalsBySemester = new Map<string, number>();
  for (const e of expenses) {
    totalsBySemester.set(
      e.semesterId,
      (totalsBySemester.get(e.semesterId) ?? 0) + e.amount,
    );
  }

  const by_semester: CostPerCreditEntry[] = [];
  for (const s of semesters) {
    const total = totalsBySemester.get(s.id) ?? 0;
    const credits = s.credit_hours || 0;
    by_semester.push({
      semesterId: s.id,
      cost_per_credit: credits > 0 ? total / credits : 0,
    });
  }

  const positive = by_semester.filter((b) => b.cost_per_credit > 0);
  const avg_cost_per_credit =
    positive.length > 0
      ? positive.reduce((a, b) => a + b.cost_per_credit, 0) / positive.length
      : 0;

  return { avg_cost_per_credit, by_semester };
}
