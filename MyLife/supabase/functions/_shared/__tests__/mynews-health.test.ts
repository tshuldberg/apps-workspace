import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import * as edge from '../mynews-health.ts';
import * as canonical from '../../../../modules/mynews/src/data/health.ts';

const MIGRATION = join(
  import.meta.dirname,
  '../../../migrations/20260730000012_mynews_health_observability.sql',
);

type Snapshot = canonical.HealthSnapshot;

function threshold(warn: number, alarm: number, enabled = true): canonical.HealthThreshold {
  return { warnSeconds: warn, alarmSeconds: alarm, enabled, description: '' };
}

function base(): Snapshot {
  return {
    checkedAt: '2026-07-30T12:00:00Z',
    queues: {
      queue_report: { depth: 0, oldestAgeSeconds: null },
      queue_ncii: { depth: 0, oldestAgeSeconds: null, pastDeadline: 0 },
      queue_dmca: { depth: 0, oldestAgeSeconds: null },
      queue_screening: { depth: 0, oldestAgeSeconds: null },
      queue_deletion: { depth: 0, oldestAgeSeconds: null },
      queue_support_reconciliation: { depth: 1, oldestAgeSeconds: 100 },
    },
    workers: {
      'mynews-ncii-worker': {
        ok: true,
        finishedAt: '2026-07-30T11:59:00Z',
        ageSeconds: 60,
        processed: 1,
        failures: 0,
        detail: null,
      },
      'mynews-account-worker': {
        ok: true,
        finishedAt: '2026-07-30T11:59:00Z',
        ageSeconds: 60,
        processed: 0,
        failures: 0,
        detail: null,
      },
      'mynews-support-worker': {
        ok: true,
        finishedAt: '2026-07-30T11:59:00Z',
        ageSeconds: 60,
        processed: 0,
        failures: 0,
        detail: null,
      },
    },
    thresholds: {
      queue_report: threshold(3_600, 7_200),
      queue_ncii: threshold(3_600, 7_200),
      queue_dmca: threshold(3_600, 7_200),
      queue_screening: threshold(3_600, 7_200),
      queue_deletion: threshold(3_600, 7_200),
      queue_support_reconciliation: threshold(3_600, 7_200),
      worker_mynews_ncii_worker: threshold(3_600, 7_200),
      worker_mynews_account_worker: threshold(3_600, 7_200),
      worker_mynews_support_worker: threshold(3_600, 7_200),
    },
  };
}

function levelOf(report: canonical.HealthReport, component: string): string {
  return report.components.find((c) => c.component === component)!.level;
}

describe('classifyHealthSnapshot', () => {
  it('reports ok when every queue is empty and every worker is fresh', () => {
    const report = canonical.classifyHealthSnapshot(base());
    expect(report.status).toBe('ok');
    expect(report.components).toHaveLength(9);
    expect(report.components.every((c) => c.level === 'ok')).toBe(true);
  });

  it('crosses warn then alarm at the configured ages', () => {
    const warn = base();
    warn.queues.queue_report = { depth: 3, oldestAgeSeconds: 3_600 };
    expect(levelOf(canonical.classifyHealthSnapshot(warn), 'queue_report')).toBe('warn');

    const alarm = base();
    alarm.queues.queue_report = { depth: 3, oldestAgeSeconds: 7_200 };
    expect(levelOf(canonical.classifyHealthSnapshot(alarm), 'queue_report')).toBe('alarm');

    const under = base();
    under.queues.queue_report = { depth: 3, oldestAgeSeconds: 3_599 };
    expect(levelOf(canonical.classifyHealthSnapshot(under), 'queue_report')).toBe('ok');
  });

  it('alarms on an NCII case past its deadline regardless of age thresholds', () => {
    const snap = base();
    // Young enough to be inside every age threshold, but already past deadline.
    snap.queues.queue_ncii = { depth: 1, oldestAgeSeconds: 10, pastDeadline: 1 };
    const report = canonical.classifyHealthSnapshot(snap);
    expect(levelOf(report, 'queue_ncii')).toBe('alarm');
    expect(report.status).toBe('degraded');
  });

  it('treats a missing threshold row as unknown, never ok', () => {
    const snap = base();
    delete (snap.thresholds as Record<string, unknown>).queue_dmca;
    const report = canonical.classifyHealthSnapshot(snap);
    expect(levelOf(report, 'queue_dmca')).toBe('unknown');
    expect(report.status).toBe('degraded');
  });

  it('treats a disabled threshold as unknown, never ok', () => {
    const snap = base();
    snap.thresholds.queue_dmca = threshold(3_600, 7_200, false);
    expect(levelOf(canonical.classifyHealthSnapshot(snap), 'queue_dmca')).toBe('unknown');
  });

  it('treats a missing queue in the snapshot as unknown', () => {
    const snap = base();
    delete (snap.queues as Record<string, unknown>).queue_screening;
    const report = canonical.classifyHealthSnapshot(snap);
    expect(levelOf(report, 'queue_screening')).toBe('unknown');
    expect(report.status).toBe('degraded');
  });

  it('reports a worker that has never run as unknown, not as healthy', () => {
    const snap = base();
    delete (snap.workers as Record<string, unknown>)['mynews-support-worker'];
    const report = canonical.classifyHealthSnapshot(snap);
    const component = report.components.find(
      (c) => c.component === 'worker_mynews_support_worker',
    )!;
    expect(component.level).toBe('unknown');
    expect(component.ageSeconds).toBeNull();
    expect(component.reason).toContain('never recorded a run');
  });

  it('warns on a recent failing worker run even though it is fresh', () => {
    const snap = base();
    snap.workers['mynews-ncii-worker'] = {
      ok: false,
      finishedAt: '2026-07-30T11:59:00Z',
      ageSeconds: 60,
      processed: 0,
      failures: 3,
      detail: '3 case failures',
    };
    const report = canonical.classifyHealthSnapshot(snap);
    expect(levelOf(report, 'worker_mynews_ncii_worker')).toBe('warn');
    expect(report.status).toBe('degraded');
  });

  it('alarms on a failing worker run that is also stale', () => {
    const snap = base();
    snap.workers['mynews-ncii-worker'] = {
      ok: false,
      finishedAt: '2026-07-30T00:00:00Z',
      ageSeconds: 50_000,
      processed: 0,
      failures: 3,
      detail: null,
    };
    expect(levelOf(canonical.classifyHealthSnapshot(snap), 'worker_mynews_ncii_worker')).toBe(
      'alarm',
    );
  });

  it('never reports down for a deep queue; down is reserved for a failed read', () => {
    const snap = base();
    snap.queues.queue_report = { depth: 9_999, oldestAgeSeconds: 999_999 };
    expect(canonical.classifyHealthSnapshot(snap).status).toBe('degraded');
    expect(canonical.overallStatus([])).toBe('down');
  });

  it('carries the snapshot timestamp through unchanged', () => {
    expect(canonical.classifyHealthSnapshot(base()).checkedAt).toBe('2026-07-30T12:00:00Z');
  });
});

describe('edge twin parity', () => {
  // The edge runtime cannot import the workspace package, so mynews-health.ts is
  // a hand-maintained mirror. Comparing source text would break on the header
  // comment; comparing BEHAVIOUR over a fixture matrix is what actually matters.
  const fixtures: { name: string; snapshot: Snapshot }[] = [
    { name: 'all clear', snapshot: base() },
    (() => {
      const s = base();
      s.queues.queue_report = { depth: 3, oldestAgeSeconds: 3_600 };
      return { name: 'report queue at warn', snapshot: s };
    })(),
    (() => {
      const s = base();
      s.queues.queue_dmca = { depth: 8, oldestAgeSeconds: 90_000 };
      return { name: 'dmca queue at alarm', snapshot: s };
    })(),
    (() => {
      const s = base();
      s.queues.queue_ncii = { depth: 2, oldestAgeSeconds: 10, pastDeadline: 2 };
      return { name: 'ncii past deadline', snapshot: s };
    })(),
    (() => {
      const s = base();
      delete (s.thresholds as Record<string, unknown>).queue_deletion;
      return { name: 'missing threshold', snapshot: s };
    })(),
    (() => {
      const s = base();
      s.thresholds.queue_screening = threshold(3_600, 7_200, false);
      return { name: 'disabled threshold', snapshot: s };
    })(),
    (() => {
      const s = base();
      delete (s.workers as Record<string, unknown>)['mynews-account-worker'];
      return { name: 'worker never ran', snapshot: s };
    })(),
    (() => {
      const s = base();
      s.workers['mynews-support-worker'] = {
        ok: false,
        finishedAt: '2026-07-30T11:00:00Z',
        ageSeconds: 3_600,
        processed: 2,
        failures: 1,
        detail: 'mismatch',
      };
      return { name: 'worker failing', snapshot: s };
    })(),
    (() => {
      const s = base();
      delete (s.queues as Record<string, unknown>).queue_support_reconciliation;
      return { name: 'queue absent from snapshot', snapshot: s };
    })(),
  ];

  for (const fixture of fixtures) {
    it(`classifies "${fixture.name}" identically on both sides`, () => {
      expect(edge.classifyHealthSnapshot(fixture.snapshot as never)).toEqual(
        canonical.classifyHealthSnapshot(fixture.snapshot),
      );
    });
  }

  it('exports the same component lists on both sides', () => {
    expect(edge.HEALTH_QUEUE_COMPONENTS).toEqual(canonical.HEALTH_QUEUE_COMPONENTS);
    expect(edge.HEALTH_WORKERS).toEqual(canonical.HEALTH_WORKERS);
  });

  it('agrees on the empty-component down case', () => {
    expect(edge.overallStatus([])).toBe(canonical.overallStatus([]));
  });
});

describe('migration pinning', () => {
  const sql = readFileSync(MIGRATION, 'utf8');

  it('seeds a threshold row for every component the classifier reports on', () => {
    for (const component of canonical.HEALTH_QUEUE_COMPONENTS) {
      expect(sql).toContain(`('${component}'`);
    }
    for (const component of Object.keys(canonical.HEALTH_WORKERS)) {
      expect(sql).toContain(`('${component}'`);
    }
  });

  it('returns a snapshot key for every queue the classifier expects', () => {
    for (const component of canonical.HEALTH_QUEUE_COMPONENTS) {
      expect(sql).toContain(`'${component}', (`);
    }
  });

  it('keeps nw_worker_runs and nw_health_thresholds off every client role', () => {
    for (const table of ['nw_worker_runs', 'nw_health_thresholds']) {
      expect(sql).toContain(`revoke all on table public.${table} from public, anon, authenticated`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('grants the snapshot function to service_role only', () => {
    expect(sql).toContain(
      'revoke all on function public.nw_health_snapshot() from public, anon, authenticated',
    );
    expect(sql).toContain('grant execute on function public.nw_health_snapshot() to service_role');
  });

  it('schedules the support worker that previously had no cron caller', () => {
    expect(sql).toContain('create or replace function public.nw_run_support_worker()');
    expect(sql).toContain("'mynews-support-worker',");
    // Same fail-closed shape as its siblings: no config rows means no call.
    expect(sql).toContain("where key = 'support_worker_secret'");
    expect(sql).toContain('if v_url is null or v_secret is null then');
  });

  it('orders every seeded threshold so alarm is never tighter than warn', () => {
    expect(sql).toContain('constraint nw_health_thresholds_ordered check (alarm_seconds >= warn_seconds)');
  });
});
