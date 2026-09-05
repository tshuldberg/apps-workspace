/**
 * Presentation layer for the service-health panel (plan 48 WP11). Pure, no
 * `server-only` marker and no data access, so the page and the vitest lib suite
 * share it.
 *
 * The classification itself is NOT here. It lives in
 * `@mylife/mynews` (`src/data/health.ts`) alongside its edge twin, so the console
 * and the mynews-health endpoint can never disagree about whether a queue is in
 * alarm. This file only turns a decided level into words.
 */

import type { ComponentStatus, HealthLevel, HealthStatus } from '@mylife/mynews';

/** Human labels for the threshold component keys. */
export const COMPONENT_LABEL: Readonly<Record<string, string>> = {
  queue_report: 'Report queue',
  queue_ncii: 'Urgent queue (NCII / child safety)',
  queue_dmca: 'DMCA notices and counter-notices',
  queue_screening: 'Screening review and appeals',
  queue_deletion: 'Account deletions past their grace window',
  queue_support_reconciliation: 'Support ledger reconciliation',
  worker_mynews_ncii_worker: 'Worker: mynews-ncii-worker',
  worker_mynews_account_worker: 'Worker: mynews-account-worker',
  worker_mynews_support_worker: 'Worker: mynews-support-worker',
};

export function componentLabel(component: string): string {
  return COMPONENT_LABEL[component] ?? component;
}

/** Maps a level onto the console's existing badge classes. */
export function levelBadgeClass(level: HealthLevel): string {
  switch (level) {
    case 'ok':
      return 'badge ok';
    case 'warn':
    case 'alarm':
      return 'badge warn';
    default:
      return 'badge';
  }
}

export function levelText(level: HealthLevel): string {
  switch (level) {
    case 'ok':
      return 'OK';
    case 'warn':
      return 'WARN';
    case 'alarm':
      return 'ALARM';
    default:
      // Never "OK". An unknown component is a component nobody is watching.
      return 'UNKNOWN';
  }
}

export function statusHeadline(status: HealthStatus): string {
  switch (status) {
    case 'ok':
      return 'All components inside their thresholds.';
    case 'degraded':
      return 'At least one component is past a threshold or cannot be assessed.';
    default:
      return 'The health snapshot could not be read. Treat every figure below as unavailable, not as zero.';
  }
}

/** Ages are reported in seconds; operators think in minutes, hours, and days. */
export function ageLabel(ageSeconds: number | null): string {
  if (ageSeconds === null) return 'nothing waiting';
  if (ageSeconds < 60) return `${ageSeconds}s`;
  if (ageSeconds < 3_600) return `${Math.floor(ageSeconds / 60)}m`;
  if (ageSeconds < 172_800) return `${Math.floor(ageSeconds / 3_600)}h`;
  return `${Math.floor(ageSeconds / 86_400)}d`;
}

export function depthLabel(component: ComponentStatus): string {
  if (component.kind === 'worker') return 'n/a';
  if (component.depth === null) return 'unknown';
  if (component.component === 'queue_support_reconciliation') {
    return component.depth === 0 ? 'no run recorded' : `${component.depth} run(s) recorded`;
  }
  return component.depth === 1 ? '1 item' : `${component.depth} items`;
}

/** Components worth surfacing first: anything that is not plainly healthy. */
export function needsAttention(components: readonly ComponentStatus[]): ComponentStatus[] {
  return components.filter((component) => component.level !== 'ok');
}
