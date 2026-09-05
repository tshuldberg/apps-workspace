/**
 * Validates deploy/observability/slo-definitions.json (Plan 44 Phase 4 WP-4C):
 *   - the file parses (as JSON, dependency-free) with the documented top-level structure,
 *   - every objective that derives from a metric names a metric that the services actually
 *     emit (the known list below is kept in lockstep with the bins' registrations),
 *   - every objective that derives from a probe names a synthetic script that exists,
 *   - every objective that derives from a log event is honestly non-active,
 *   - every runbook referenced by any alert exists on disk under docs/guides/meerkat-runbooks/,
 *   - the relay service definition pins the exact zero-knowledge /healthz shape.
 *
 * The file is JSON specifically so this test needs no YAML parser (no new dependency).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, '..', '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const sloPath = path.join(packageRoot, 'deploy', 'observability', 'slo-definitions.json');
const synthDir = path.join(packageRoot, 'deploy', 'observability', 'synthetics');
const runbookDir = path.join(repoRoot, 'docs', 'guides', 'meerkat-runbooks');

/**
 * Metric names the services actually emit today. Source of truth: the bin registrations
 * (bin/meerkat-*.mjs). The community node emits the two suffixed pool families in addition
 * to the base name, so both the base and the suffixed forms are known-valid.
 */
const KNOWN_METRICS = new Set<string>([
  'meerkat_humanity_store',
  'meerkat_persona_store',
  'meerkat_directory_records',
  'meerkat_postgres_pool_connections',
  'meerkat_postgres_pool_connections_community',
  'meerkat_postgres_pool_connections_moderation',
  'meerkat_object_store_composed',
  'meerkat_abuse_hashset_size',
  'meerkat_shadow_events_total',
]);

interface DerivesMetric {
  metric: { name: string; labels?: Record<string, string>; note?: string };
}
interface DerivesProbe {
  probe: { script: string; note?: string };
}
interface DerivesLog {
  logEvent: { event: string; note?: string };
}
type DerivesFrom = DerivesMetric | DerivesProbe | DerivesLog;

interface Alert {
  severity: 'page' | 'ticket';
  runbook?: string;
  [k: string]: unknown;
}
interface Objective {
  id: string;
  service: string;
  status: 'active' | 'pending_signal' | 'founder_ops';
  derivesFrom: DerivesFrom;
  alerts: Alert[];
}
interface SloFile {
  version: number;
  services: Record<string, { healthzShape?: string[] }>;
  objectives: Objective[];
}

function loadSlo(): SloFile {
  return JSON.parse(readFileSync(sloPath, 'utf8')) as SloFile;
}

describe('slo-definitions.json', () => {
  it('parses and has the documented top-level structure', () => {
    const slo = loadSlo();
    expect(typeof slo.version).toBe('number');
    expect(slo.services).toBeTypeOf('object');
    expect(Array.isArray(slo.objectives)).toBe(true);
    expect(slo.objectives.length).toBeGreaterThan(0);
  });

  it('pins the exact relay /healthz zero-knowledge shape', () => {
    const slo = loadSlo();
    const relay = slo.services.relay;
    expect(relay).toBeTruthy();
    expect([...(relay.healthzShape ?? [])].sort()).toEqual(['connections', 'ok']);
  });

  it('gives every objective a stable unique id', () => {
    const slo = loadSlo();
    const ids = slo.objectives.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('every metric-derived objective names a metric the services emit', () => {
    const slo = loadSlo();
    const metricObjectives = slo.objectives.filter(
      (o): o is Objective & { derivesFrom: DerivesMetric } => 'metric' in o.derivesFrom,
    );
    expect(metricObjectives.length).toBeGreaterThan(0);
    for (const obj of metricObjectives) {
      expect(
        KNOWN_METRICS.has(obj.derivesFrom.metric.name),
        `objective ${obj.id} references unknown metric ${obj.derivesFrom.metric.name}`,
      ).toBe(true);
      // A metric-derived objective must be active: the metric exists, so the signal is live.
      expect(obj.status, `objective ${obj.id} derives from a real metric but is not active`).toBe(
        'active',
      );
    }
  });

  it('every probe-derived objective names a synthetic script that exists', () => {
    const slo = loadSlo();
    const probeObjectives = slo.objectives.filter(
      (o): o is Objective & { derivesFrom: DerivesProbe } => 'probe' in o.derivesFrom,
    );
    expect(probeObjectives.length).toBeGreaterThan(0);
    for (const obj of probeObjectives) {
      const script = obj.derivesFrom.probe.script.replace(/^synthetics\//, '');
      const scriptPath = path.join(synthDir, script);
      expect(existsSync(scriptPath), `objective ${obj.id} names missing probe ${script}`).toBe(true);
    }
  });

  it('log-event-derived objectives are honestly marked pending_signal or founder_ops', () => {
    const slo = loadSlo();
    const logObjectives = slo.objectives.filter(
      (o): o is Objective & { derivesFrom: DerivesLog } => 'logEvent' in o.derivesFrom,
    );
    expect(logObjectives.length).toBeGreaterThan(0);
    for (const obj of logObjectives) {
      // No production emitter exists for these yet; the file must not claim they are active.
      expect(
        ['pending_signal', 'founder_ops'].includes(obj.status),
        `objective ${obj.id} derives from a log event with no emitter but is marked ${obj.status}`,
      ).toBe(true);
    }
  });

  it('every page-severity alert names a runbook that exists', () => {
    const slo = loadSlo();
    const referenced = new Set<string>();
    for (const obj of slo.objectives) {
      for (const alert of obj.alerts) {
        if (alert.severity === 'page') {
          expect(alert.runbook, `page alert in ${obj.id} has no runbook`).toBeTruthy();
        }
        if (alert.runbook) referenced.add(alert.runbook);
      }
    }
    expect(referenced.size).toBeGreaterThan(0);
    for (const runbook of referenced) {
      const runbookPath = path.join(runbookDir, runbook);
      expect(existsSync(runbookPath), `referenced runbook ${runbook} does not exist`).toBe(true);
    }
  });

  it('exposes exactly one derivesFrom source per objective', () => {
    const slo = loadSlo();
    for (const obj of slo.objectives) {
      const df = obj.derivesFrom as unknown as Record<string, unknown>;
      const sources = ['metric', 'probe', 'logEvent'].filter((k) => k in df);
      expect(sources.length, `objective ${obj.id} must have exactly one derivesFrom source`).toBe(
        1,
      );
    }
  });
});
