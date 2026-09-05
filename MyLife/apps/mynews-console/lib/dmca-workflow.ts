export type DmcaDisplayKind = 'takedown' | 'counter';
export type DmcaWorkflowKind = 'takedown' | 'counter';
export type DmcaAgeFilter = 'all' | 'under_24h' | '24_to_72h' | 'over_72h';

export interface DmcaAttestation {
  label: string;
  accepted: boolean;
  text: string;
  version: string;
}

export interface DmcaQueueItem {
  id: string;
  kind: DmcaDisplayKind;
  workflowKind: DmcaWorkflowKind;
  legacy: boolean;
  status: string;
  submitterName: string;
  submitterEmail: string;
  submitterAddress: string;
  submitterPhone: string | null;
  material: string;
  publicUrl: string;
  targetKind: string | null;
  targetId: string | null;
  signature: string;
  assignedModeratorRef: string | null;
  acknowledgmentDueAt: string;
  acknowledgedAt: string | null;
  forwardedAt: string | null;
  forwardedToEmail: string | null;
  waitingPeriodStartedAt: string | null;
  restorationEligibleAt: string | null;
  restorationDeadlineAt: string | null;
  restoredAt: string | null;
  litigationHoldAt: string | null;
  closedAt: string | null;
  disposition: string | null;
  reportId: string | null;
  originalNoticeId: string | null;
  originalNoticeReference: string | null;
  strikeProfileId: string | null;
  strikeActionId: string | null;
  attestations: DmcaAttestation[];
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency token (plan 48 WP9). */
  consoleVersion: number;
}

export interface DmcaQueueFilters {
  kind: 'all' | DmcaDisplayKind;
  status: 'open' | 'all' | string;
  age: DmcaAgeFilter;
}

export interface DmcaEvent {
  id: string;
  event: string;
  actorRef: string;
  note: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const TERMINAL_STATUSES = new Set(['closed', 'restored']);
const HOUR_MS = 60 * 60 * 1000;

export function isDmcaOpen(item: DmcaQueueItem): boolean {
  return !TERMINAL_STATUSES.has(item.status);
}

function ageHours(createdAt: string, nowMs: number): number {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return Number.POSITIVE_INFINITY;
  return Math.max(0, (nowMs - created) / HOUR_MS);
}

export function filterDmcaQueue(
  items: DmcaQueueItem[],
  filters: DmcaQueueFilters,
  nowMs: number,
): DmcaQueueItem[] {
  return items.filter((item) => {
    if (filters.kind !== 'all' && item.kind !== filters.kind) return false;
    if (filters.status === 'open' && !isDmcaOpen(item)) return false;
    if (filters.status !== 'open' && filters.status !== 'all' && item.status !== filters.status) {
      return false;
    }
    const hours = ageHours(item.createdAt, nowMs);
    if (filters.age === 'under_24h' && hours >= 24) return false;
    if (filters.age === '24_to_72h' && (hours < 24 || hours >= 72)) return false;
    if (filters.age === 'over_72h' && hours < 72) return false;
    return true;
  });
}

export function dmcaAgeLabel(createdAt: string, nowMs: number): string {
  const hours = ageHours(createdAt, nowMs);
  if (!Number.isFinite(hours)) return 'age unknown';
  if (hours < 1) return `${Math.floor(hours * 60)}m old`;
  if (hours < 48) return `${Math.floor(hours)}h old`;
  return `${Math.floor(hours / 24)}d old`;
}

export function acknowledgmentSla(
  dueAt: string,
  acknowledgedAt: string | null,
  nowMs: number,
): { label: string; overdue: boolean; complete: boolean } {
  if (acknowledgedAt) return { label: 'acknowledged', overdue: false, complete: true };
  const due = Date.parse(dueAt);
  if (!Number.isFinite(due)) return { label: 'ack SLA unknown', overdue: true, complete: false };
  const remaining = due - nowMs;
  if (remaining <= 0) {
    return {
      label: `ack overdue ${Math.floor(-remaining / HOUR_MS)}h`,
      overdue: true,
      complete: false,
    };
  }
  return {
    label: `ack due in ${Math.max(1, Math.ceil(remaining / HOUR_MS))}h`,
    overdue: false,
    complete: false,
  };
}

export function waitingPeriodLabel(
  item: Pick<
    DmcaQueueItem,
    'status' | 'restorationEligibleAt' | 'restorationDeadlineAt'
  >,
  nowMs: number,
): { label: string; urgent: boolean } | null {
  if (item.status !== 'waiting_period') return null;
  const eligible = item.restorationEligibleAt ? Date.parse(item.restorationEligibleAt) : Number.NaN;
  const deadline = item.restorationDeadlineAt ? Date.parse(item.restorationDeadlineAt) : Number.NaN;
  if (!Number.isFinite(eligible) || !Number.isFinite(deadline)) {
    return { label: 'waiting dates missing', urgent: true };
  }
  if (nowMs < eligible) {
    return {
      label: `restore eligible in ${Math.max(1, Math.ceil((eligible - nowMs) / HOUR_MS))}h`,
      urgent: false,
    };
  }
  if (nowMs <= deadline) {
    return {
      label: `restoration window open, ${Math.max(0, Math.ceil((deadline - nowMs) / HOUR_MS))}h left`,
      urgent: true,
    };
  }
  return { label: '14-business-day restoration deadline passed', urgent: true };
}

export function dmcaStatusLabel(status: string): string {
  return status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

export function isDmcaAgeFilter(value: string): value is DmcaAgeFilter {
  return value === 'all' || value === 'under_24h' || value === '24_to_72h' || value === 'over_72h';
}
