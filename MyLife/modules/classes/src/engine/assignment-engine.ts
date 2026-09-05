import type {
  AssignmentInput,
  AssignmentRow,
  LatePolicy,
  RecurrenceFrequency,
  RecurrenceRule,
} from '../models/schemas';

export interface SemesterWindow {
  start_date: string; // ISO date or datetime
  end_date: string; // ISO date or datetime
}

export interface RecurringTemplate
  extends Omit<AssignmentInput, 'is_recurring' | 'recurrence_rule' | 'due_at'> {
  recurrence_rule: RecurrenceRule;
  /** First occurrence due_at (ISO timestamp). Subsequent occurrences derive from this. */
  due_at: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function parseISO(s: string): Date {
  // Accept either YYYY-MM-DD or full ISO timestamp.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00.000Z`);
  }
  return new Date(s);
}

/**
 * parseInclusiveEnd: like parseISO, but treats a bare YYYY-MM-DD as the
 * end of that day. Used for recurrence boundaries (rule.until and
 * semester.end_date) so a day-stamped boundary includes the whole day.
 */
function parseInclusiveEnd(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T23:59:59.999Z`);
  }
  return new Date(s);
}

function addUnits(
  date: Date,
  frequency: RecurrenceFrequency,
  interval: number,
): Date {
  const next = new Date(date.getTime());
  switch (frequency) {
    case 'daily':
      next.setUTCDate(next.getUTCDate() + interval);
      return next;
    case 'weekly':
      next.setUTCDate(next.getUTCDate() + 7 * interval);
      return next;
    case 'biweekly':
      next.setUTCDate(next.getUTCDate() + 14 * interval);
      return next;
    case 'monthly':
      next.setUTCMonth(next.getUTCMonth() + interval);
      return next;
  }
}

/**
 * generateRecurringInstances: expand a recurring template into concrete
 * AssignmentInput rows bounded by min(rule.until, semester.end_date).
 * Inclusive on both ends. The returned inputs carry is_recurring=false so
 * they are persisted as concrete instances.
 */
export function generateRecurringInstances(
  template: RecurringTemplate,
  semester: SemesterWindow,
): AssignmentInput[] {
  const { recurrence_rule, due_at, ...rest } = template;
  const semesterEnd = parseInclusiveEnd(semester.end_date);
  const ruleUntil = recurrence_rule.until
    ? parseInclusiveEnd(recurrence_rule.until)
    : null;
  const hardStop = ruleUntil
    ? new Date(Math.min(ruleUntil.getTime(), semesterEnd.getTime()))
    : semesterEnd;

  const instances: AssignmentInput[] = [];
  let cursor = parseISO(due_at);
  // Safety cap to prevent runaway loops on bad input.
  const MAX_INSTANCES = 1000;

  while (cursor.getTime() <= hardStop.getTime() && instances.length < MAX_INSTANCES) {
    instances.push({
      ...rest,
      due_at: cursor.toISOString(),
      is_recurring: false,
    });
    cursor = addUnits(cursor, recurrence_rule.frequency, recurrence_rule.interval);
  }

  return instances;
}

export interface OverdueAssignment {
  assignment: AssignmentRow;
  days_overdue: number;
}

/**
 * getOverdueAssignments: pure filter over an in-memory list. Returns
 * assignments past due_at AND status in (not_started, in_progress) with
 * days_overdue derived from `now`.
 */
export function getOverdueAssignments(
  assignments: AssignmentRow[],
  now?: Date,
): OverdueAssignment[] {
  const ts = (now ?? new Date()).getTime();
  return assignments
    .filter((a) => {
      if (!a.due_at) return false;
      if (a.status !== 'not_started' && a.status !== 'in_progress') return false;
      return parseISO(a.due_at).getTime() < ts;
    })
    .map((a) => ({
      assignment: a,
      days_overdue: Math.floor(
        (ts - parseISO(a.due_at as string).getTime()) / DAY_MS,
      ),
    }))
    .sort((l, r) => r.days_overdue - l.days_overdue);
}

function parseDependsOn(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * getDependencyChain: BFS from an assignment over its `depends_on` array,
 * returning blockers in BFS order (first-discovered first). The starting
 * assignment is NOT included. Cycles are tolerated; each node visited once.
 */
export function getDependencyChain(
  assignmentId: string,
  all: AssignmentRow[],
): AssignmentRow[] {
  const byId = new Map(all.map((a) => [a.id, a] as const));
  const start = byId.get(assignmentId);
  if (!start) return [];

  const visited = new Set<string>([assignmentId]);
  const queue: string[] = [...parseDependsOn(start.depends_on)];
  const chain: AssignmentRow[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = byId.get(id);
    if (!node) continue;
    chain.push(node);
    for (const next of parseDependsOn(node.depends_on)) {
      if (!visited.has(next)) queue.push(next);
    }
  }

  return chain;
}

export interface LatePenalty {
  penalty_percent: number;
  capped: boolean;
}

/**
 * calculateLatePenalty: derives late penalty based on whole days late between
 * due_at and submittedAt. If days_late <= 0 returns { penalty_percent: 0, capped: false }.
 * If days_late > policy.max_days, penalty is policy.max_days * percent_per_day and capped=true.
 *
 * `latePolicy` argument overrides assignment.late_policy when provided.
 * Returns { penalty_percent: 0, capped: false } if no policy exists or no due_at.
 */
export function calculateLatePenalty(
  assignment: Pick<AssignmentRow, 'due_at' | 'late_policy'>,
  submittedAt: string | Date,
  latePolicy?: LatePolicy,
): LatePenalty {
  if (!assignment.due_at) return { penalty_percent: 0, capped: false };

  let policy: LatePolicy | null = latePolicy ?? null;
  if (!policy && assignment.late_policy) {
    try {
      policy = JSON.parse(assignment.late_policy) as LatePolicy;
    } catch {
      policy = null;
    }
  }
  if (!policy) return { penalty_percent: 0, capped: false };

  const submittedTs =
    typeof submittedAt === 'string' ? parseISO(submittedAt).getTime() : submittedAt.getTime();
  const dueTs = parseISO(assignment.due_at).getTime();
  const diffMs = submittedTs - dueTs;
  if (diffMs <= 0) return { penalty_percent: 0, capped: false };

  const daysLate = Math.ceil(diffMs / DAY_MS);
  if (daysLate > policy.max_days) {
    return {
      penalty_percent: policy.max_days * policy.percent_per_day,
      capped: true,
    };
  }
  return {
    penalty_percent: daysLate * policy.percent_per_day,
    capped: false,
  };
}

/**
 * isBlocked: true when at least one dependency exists with status NOT in
 * (submitted, graded). Missing dependency rows are treated as blocking.
 */
export function isBlocked(
  assignment: Pick<AssignmentRow, 'depends_on'>,
  all: AssignmentRow[],
): boolean {
  const deps = parseDependsOn(assignment.depends_on);
  if (deps.length === 0) return false;
  const byId = new Map(all.map((a) => [a.id, a] as const));
  for (const id of deps) {
    const dep = byId.get(id);
    if (!dep) return true;
    if (dep.status !== 'submitted' && dep.status !== 'graded') return true;
  }
  return false;
}
