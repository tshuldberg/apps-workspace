import type {
  ApplicationRow,
  ApplicationStatus,
  ApplicationTaskRow,
  StandardizedTestRow,
} from '../models/schemas';

/**
 * Pure-function applications engine. No DB, no side effects.
 * Callers pass in already-loaded rows.
 *
 * P7-A: progress, deadline urgency, status grouping, timeline,
 * superscore aggregation across standardized tests.
 */

const DAY_MS = 86_400_000;
const URGENCY_BLOCKING_WINDOW_DAYS = 30;

export interface ApplicationProgress {
  percent_complete: number;
  blocked_by: string[];
}

export type DeadlineUrgency =
  | 'overdue'
  | 'critical'
  | 'soon'
  | 'comfortable'
  | 'distant'
  | 'none';

export interface ApplicationTimelineEntry {
  application_id: string;
  name: string;
  deadline: string;
  days_from_now: number;
}

export interface SectionBest {
  section: string;
  best: number;
}

function ratio(numer: number, denom: number): number {
  if (denom <= 0) return 0;
  return Math.min(1, numer / denom);
}

function daysBetween(fromISO: string, nowMs: number): number {
  const t = Date.parse(fromISO);
  if (Number.isNaN(t)) return Number.POSITIVE_INFINITY;
  return Math.floor((t - nowMs) / DAY_MS);
}

/**
 * computeApplicationProgress: weighted average across present components.
 *  - tasks done (skipped counts as done)
 *  - essays_finalized / required_essays_count
 *  - recommenders_confirmed / recommenders_required
 *  - transcripts_sent (only when transcripts_requested)
 *
 * `blocked_by` lists components < 100% when the deadline is < 30 days away.
 */
export function computeApplicationProgress(
  application: ApplicationRow,
  tasks: ApplicationTaskRow[],
  now?: Date,
): ApplicationProgress {
  const myTasks = tasks.filter((t) => t.application_id === application.id);
  const components: number[] = [];

  let taskRatio: number | null = null;
  if (myTasks.length > 0) {
    const done = myTasks.filter(
      (t) => t.status === 'done' || t.status === 'skipped',
    ).length;
    taskRatio = done / myTasks.length;
    components.push(taskRatio);
  }

  let essayRatio: number | null = null;
  if (application.required_essays_count > 0) {
    essayRatio = ratio(
      application.essays_finalized,
      application.required_essays_count,
    );
    components.push(essayRatio);
  }

  let recRatio: number | null = null;
  if (application.recommenders_required > 0) {
    recRatio = ratio(
      application.recommenders_confirmed,
      application.recommenders_required,
    );
    components.push(recRatio);
  }

  let transcriptRatio: number | null = null;
  if (application.transcripts_requested === 1) {
    transcriptRatio = application.transcripts_sent === 1 ? 1 : 0;
    components.push(transcriptRatio);
  }

  const percent_complete =
    components.length === 0
      ? 100
      : Math.round(
          (components.reduce((s, v) => s + v, 0) / components.length) * 100,
        );

  const blocked_by: string[] = [];
  const nowMs = (now ?? new Date()).getTime();
  const deadlineDays =
    application.deadline === null
      ? Number.POSITIVE_INFINITY
      : daysBetween(application.deadline, nowMs);

  if (deadlineDays < URGENCY_BLOCKING_WINDOW_DAYS) {
    if (essayRatio !== null && essayRatio < 1) {
      const remaining =
        application.required_essays_count - application.essays_finalized;
      const undrafted =
        application.required_essays_count - application.essays_drafted;
      if (undrafted > 0) {
        blocked_by.push(
          `${undrafted} essay${undrafted === 1 ? '' : 's'} not drafted`,
        );
      } else if (remaining > 0) {
        blocked_by.push(
          `${remaining} essay${remaining === 1 ? '' : 's'} not finalized`,
        );
      }
    }
    if (recRatio !== null && recRatio < 1) {
      const remaining =
        application.recommenders_required - application.recommenders_confirmed;
      blocked_by.push(
        `${remaining} recommender${remaining === 1 ? '' : 's'} not confirmed`,
      );
    }
    if (transcriptRatio !== null && transcriptRatio < 1) {
      blocked_by.push('Transcript not sent');
    }
    if (taskRatio !== null && taskRatio < 1) {
      const open = myTasks.filter(
        (t) => t.status !== 'done' && t.status !== 'skipped',
      ).length;
      blocked_by.push(`${open} task${open === 1 ? '' : 's'} open`);
    }
  }

  return { percent_complete, blocked_by };
}

/**
 * getDeadlineUrgency:
 *  - none: no deadline
 *  - overdue: deadline before now
 *  - critical: <= 7 days
 *  - soon: <= 30 days
 *  - comfortable: <= 90 days
 *  - distant: > 90 days
 */
export function getDeadlineUrgency(
  application: ApplicationRow,
  now?: Date,
): DeadlineUrgency {
  if (!application.deadline) return 'none';
  const nowMs = (now ?? new Date()).getTime();
  const t = Date.parse(application.deadline);
  if (Number.isNaN(t)) return 'none';
  const diffMs = t - nowMs;
  if (diffMs < 0) return 'overdue';
  const days = diffMs / DAY_MS;
  if (days <= 7) return 'critical';
  if (days <= 30) return 'soon';
  if (days <= 90) return 'comfortable';
  return 'distant';
}

const ALL_STATUSES: ApplicationStatus[] = [
  'considering',
  'in_progress',
  'submitted',
  'accepted',
  'rejected',
  'waitlisted',
  'deferred',
  'withdrawn',
];

export function groupApplicationsByStatus(
  apps: ApplicationRow[],
): Record<ApplicationStatus, ApplicationRow[]> {
  const out = {} as Record<ApplicationStatus, ApplicationRow[]>;
  for (const s of ALL_STATUSES) out[s] = [];
  for (const a of apps) out[a.status].push(a);
  return out;
}

export function computeApplicationsTimeline(
  apps: ApplicationRow[],
  now?: Date,
): ApplicationTimelineEntry[] {
  const nowMs = (now ?? new Date()).getTime();
  const out: ApplicationTimelineEntry[] = [];
  for (const a of apps) {
    if (!a.deadline) continue;
    out.push({
      application_id: a.id,
      name: a.name,
      deadline: a.deadline,
      days_from_now: daysBetween(a.deadline, nowMs),
    });
  }
  out.sort((a, b) => a.days_from_now - b.days_from_now);
  return out;
}

/**
 * superscoreFromTests: per-section best across all completed,
 * superscore-eligible tests with the given name.
 */
export function superscoreFromTests(
  tests: StandardizedTestRow[],
  name: string,
): SectionBest[] {
  const eligible = tests.filter(
    (t) =>
      t.name === name && t.status === 'completed' && t.superscore_eligible === 1,
  );
  if (eligible.length === 0) return [];

  const bests = new Map<string, number>();
  for (const t of eligible) {
    if (!t.section_scores) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(t.section_scores);
    } catch {
      continue;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const cur = bests.get(k);
      if (cur === undefined || v > cur) bests.set(k, v);
    }
  }

  return [...bests.entries()]
    .map(([section, best]) => ({ section, best }))
    .sort((a, b) => a.section.localeCompare(b.section));
}
