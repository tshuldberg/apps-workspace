/**
 * Edge twin of modules/mynews/src/data/health.ts (plan 48 WP11).
 *
 * The Deno edge runtime cannot import from the workspace package, which is why
 * this file exists at all. It is a MIRROR: the logic below must stay
 * byte-equivalent in behaviour to the canonical module, and
 * supabase/functions/_shared/__tests__/mynews-health.test.ts pins that by running
 * BOTH implementations over the same fixture set and asserting identical output.
 * Change one, change both, in the same commit.
 *
 * Same fail-closed rules as the canonical file:
 *   - No threshold row means 'unknown', never 'ok'.
 *   - A worker that has never run is 'unknown', never a fabricated heartbeat.
 *   - A failing recent run is at least 'warn'.
 *   - An unreachable database is 'down', never an empty 'ok'.
 */

export type HealthLevel = 'ok' | 'warn' | 'alarm' | 'unknown';

/** Overall status. 'down' is reserved for a failed read, not a deep queue. */
export type HealthStatus = 'ok' | 'degraded' | 'down';

export interface HealthThreshold {
  warnSeconds: number;
  alarmSeconds: number;
  enabled: boolean;
  description: string;
}

export interface QueueReading {
  depth: number;
  oldestAgeSeconds: number | null;
  /** NCII only: cases already past their statutory deadline. */
  pastDeadline?: number;
}

export interface WorkerReading {
  ok: boolean;
  finishedAt: string;
  ageSeconds: number;
  processed: number;
  failures: number;
  detail: string | null;
}

/** The raw shape nw_health_snapshot() returns. */
export interface HealthSnapshot {
  checkedAt: string;
  queues: Record<string, QueueReading>;
  workers: Record<string, WorkerReading>;
  thresholds: Record<string, HealthThreshold>;
}

export interface ComponentStatus {
  /** Threshold key, e.g. 'queue_dmca' or 'worker_mynews_ncii_worker'. */
  component: string;
  kind: 'queue' | 'worker';
  level: HealthLevel;
  /** Age in seconds of the oldest owed item, or of the last worker run. */
  ageSeconds: number | null;
  depth: number | null;
  /** Why this level was chosen. Operator-facing, never a raw error. */
  reason: string;
}

export interface HealthReport {
  status: HealthStatus;
  checkedAt: string;
  components: ComponentStatus[];
}

/**
 * The components a healthy deployment reports on. Listed explicitly so a queue
 * that stops being returned by the snapshot shows up as 'unknown' rather than
 * silently vanishing from the report.
 */
export const HEALTH_QUEUE_COMPONENTS: readonly string[] = [
  'queue_report',
  'queue_ncii',
  'queue_dmca',
  'queue_screening',
  'queue_deletion',
  'queue_support_reconciliation',
];

/** Worker component key <- worker name as written to nw_worker_runs. */
export const HEALTH_WORKERS: Readonly<Record<string, string>> = {
  'worker_mynews_ncii_worker': 'mynews-ncii-worker',
  'worker_mynews_account_worker': 'mynews-account-worker',
  'worker_mynews_support_worker': 'mynews-support-worker',
};

function levelForAge(
  ageSeconds: number | null,
  threshold: HealthThreshold | undefined,
): { level: HealthLevel; reason: string } {
  if (!threshold) {
    return {
      level: 'unknown',
      reason: 'no threshold row is configured for this component',
    };
  }
  if (!threshold.enabled) {
    return { level: 'unknown', reason: 'threshold checking is disabled for this component' };
  }
  if (ageSeconds === null) {
    return { level: 'ok', reason: 'nothing is waiting' };
  }
  if (ageSeconds >= threshold.alarmSeconds) {
    return {
      level: 'alarm',
      reason: `oldest item is ${ageSeconds}s old, past the ${threshold.alarmSeconds}s alarm threshold`,
    };
  }
  if (ageSeconds >= threshold.warnSeconds) {
    return {
      level: 'warn',
      reason: `oldest item is ${ageSeconds}s old, past the ${threshold.warnSeconds}s warn threshold`,
    };
  }
  return {
    level: 'ok',
    reason: `oldest item is ${ageSeconds}s old, inside the ${threshold.warnSeconds}s warn threshold`,
  };
}

function classifyQueue(
  component: string,
  reading: QueueReading | undefined,
  threshold: HealthThreshold | undefined,
): ComponentStatus {
  if (!reading) {
    return {
      component,
      kind: 'queue',
      level: 'unknown',
      ageSeconds: null,
      depth: null,
      reason: 'the snapshot did not report this queue',
    };
  }

  const base = levelForAge(reading.oldestAgeSeconds, threshold);

  // A case past its statutory deadline is an alarm on its own terms. The NCII
  // deadline is a promise with a legal shape, so it does not wait for a
  // configurable age threshold to be crossed.
  if (typeof reading.pastDeadline === 'number' && reading.pastDeadline > 0) {
    return {
      component,
      kind: 'queue',
      level: 'alarm',
      ageSeconds: reading.oldestAgeSeconds,
      depth: reading.depth,
      reason: `${reading.pastDeadline} case(s) are past their deadline`,
    };
  }

  return {
    component,
    kind: 'queue',
    level: base.level,
    ageSeconds: reading.oldestAgeSeconds,
    depth: reading.depth,
    reason: base.reason,
  };
}

function classifyWorker(
  component: string,
  workerName: string,
  reading: WorkerReading | undefined,
  threshold: HealthThreshold | undefined,
): ComponentStatus {
  if (!reading) {
    return {
      component,
      kind: 'worker',
      level: 'unknown',
      ageSeconds: null,
      depth: null,
      reason: `${workerName} has never recorded a run`,
    };
  }

  const age = levelForAge(reading.ageSeconds, threshold);

  // A recent failing pass is worse than a slightly stale successful one. Take
  // the worse of the two signals rather than letting recency mask a failure.
  if (!reading.ok) {
    return {
      component,
      kind: 'worker',
      level: age.level === 'alarm' ? 'alarm' : 'warn',
      ageSeconds: reading.ageSeconds,
      depth: null,
      reason: `last run reported failure (${reading.failures} failure(s)) ${reading.ageSeconds}s ago`,
    };
  }

  return {
    component,
    kind: 'worker',
    level: age.level,
    ageSeconds: reading.ageSeconds,
    depth: null,
    reason:
      age.level === 'ok'
        ? `last successful run was ${reading.ageSeconds}s ago`
        : age.reason.replace('oldest item is', 'last run was'),
  };
}

/** Roll component levels up. Any alarm is degraded; any unknown is degraded. */
export function overallStatus(components: readonly ComponentStatus[]): HealthStatus {
  if (components.length === 0) return 'down';
  // 'unknown' counts as degraded rather than ok: not knowing whether a safety
  // queue is being drained is not a healthy state to report to an uptime probe.
  const worst = components.some((c) => c.level === 'alarm' || c.level === 'unknown')
    ? 'degraded'
    : components.some((c) => c.level === 'warn')
      ? 'degraded'
      : 'ok';
  return worst;
}

export function classifyHealthSnapshot(snapshot: HealthSnapshot): HealthReport {
  const components: ComponentStatus[] = [];

  for (const component of HEALTH_QUEUE_COMPONENTS) {
    components.push(
      classifyQueue(component, snapshot.queues?.[component], snapshot.thresholds?.[component]),
    );
  }

  for (const [component, workerName] of Object.entries(HEALTH_WORKERS)) {
    components.push(
      classifyWorker(
        component,
        workerName,
        snapshot.workers?.[workerName],
        snapshot.thresholds?.[component],
      ),
    );
  }

  return {
    status: overallStatus(components),
    checkedAt: snapshot.checkedAt,
    components,
  };
}
