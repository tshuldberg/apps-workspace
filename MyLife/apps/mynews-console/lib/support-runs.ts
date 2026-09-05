/**
 * Pure labels for the support-ledger reconciliation view. No `server-only`
 * marker and no data access, so the page and the vitest lib suite share them.
 */

export interface SupportRunSummary {
  ok: boolean;
  finishedAt: string;
  mismatchCount: number;
  findings: string[];
}

export interface SupportRunLabel {
  outcome: string;
  age: string;
  mismatches: string;
}

function ageLabel(finishedAt: string, nowMs: number): string {
  const finished = Date.parse(finishedAt);
  if (!Number.isFinite(finished)) return 'unknown time';
  const minutes = Math.floor((nowMs - finished) / 60_000);
  if (minutes < 0) return 'just now';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function supportRunLabel(run: SupportRunSummary, nowMs: number): SupportRunLabel {
  return {
    outcome: run.ok ? 'reconciled' : 'MISMATCH',
    age: ageLabel(run.finishedAt, nowMs),
    mismatches:
      run.mismatchCount === 1
        ? '1 invariant violation'
        : `${run.mismatchCount} invariant violations`,
  };
}
