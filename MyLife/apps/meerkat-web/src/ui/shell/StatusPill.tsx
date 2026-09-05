import type { SyncEngineStatus } from '@mylife/sync';
import { formatWhen } from '../format';

// StatusPill: shows ONLY the real engine status. On web the reachable states are
// idle and error (no background scheduler flips it mid-session); a manual session
// in flight is reflected by a component-local running flag at the call site, never
// here. Never renders peer/online counts (always 0 on web, so DO NOT SHOW).

export function StatusPill({ status }: { status: SyncEngineStatus }): React.ReactElement {
  const cls = status.state === 'error' ? 'is-error' : 'is-idle';
  const label = status.state === 'error' ? 'Needs attention' : 'Waiting';
  return (
    <span className={`mk-pill ${cls}`} title={status.lastSyncAt ? `Last updated ${formatWhen(status.lastSyncAt)}` : 'No connection check recorded yet'}>
      <span aria-hidden>●</span>
      {label}
      {status.pendingChanges > 0 ? ` · ${status.pendingChanges} pending` : ''}
    </span>
  );
}
