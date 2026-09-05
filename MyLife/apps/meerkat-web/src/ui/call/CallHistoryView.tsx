// Plan 25 WP-25H: the call history list (web twin of the mobile calls.tsx screen).
//
// Renders ONLY real device-local call_log rows (written through foldCallLog, so a
// ring-only call never shows a duration and the outcome is the true terminal phase).
// call_ tables never replicate (NC-25.7): this history is this device's history, and
// the copy says so.

import { useCallback, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useCall } from '../../lib/CallProvider';
import { listCallLog } from '../../lib/call-store';
import { callLogSummary, startCallFailureCopy, type CallLogRow } from '../../lib/call-log-core';

export function CallHistoryView({ onBack }: { onBack: () => void }): React.ReactElement {
  const m = useMeerkat();
  const { historyRevision, canCallPeer, startCall, capability } = useCall();
  const [note, setNote] = useState<string | null>(null);

  const rows = useMemo(() => {
    void historyRevision;
    return listCallLog(m.db);
  }, [m.db, historyRevision]);

  const nameFor = useCallback((deviceId: string): string => {
    const device = m.pairedDevices().find((d) => d.deviceId === deviceId);
    return device?.displayName || `${deviceId.slice(0, 6)}…${deviceId.slice(-4)}`;
  }, [m]);

  // A failed start must surface: silently dropping the result union is a dead click.
  const callBack = useCallback((row: CallLogRow) => {
    if (!canCallPeer(row.peerDeviceId)) return;
    setNote(null);
    void (async () => {
      try {
        const result = await startCall(row.peerDeviceId, row.kind);
        if (!result.ok) setNote(startCallFailureCopy(result.reason, 'browser'));
      } catch {
        setNote(startCallFailureCopy('unknown', 'browser'));
      }
    })();
  }, [canCallPeer, startCall]);

  return (
    <div className="mk-main-scroll mk-messages-view">
      <header className="mk-dm-thread-head">
        <button type="button" className="mk-icon-btn" aria-label="Back to messages" onClick={onBack}>←</button>
        <div className="mk-dm-thread-titles"><div className="mk-dm-thread-title">Calls</div></div>
      </header>

      {!capability.mediaAvailable ? (
        <div className="mk-box is-info" role="status">
          Calls need a browser with camera and microphone support. This list still shows calls recorded on this device.
        </div>
      ) : null}

      {note ? <div className="mk-box is-error" role="alert">{note}</div> : null}

      <section className="mk-card" aria-label="Call history">
        {rows.length === 0 ? (
          <div className="mk-empty">
            <div className="mk-empty-title">No calls yet</div>
            <p className="mk-muted">Call history is stored only on this device and never syncs anywhere.</p>
          </div>
        ) : (
          <div className="mk-call-list">
            {rows.map((row) => {
              const missed = row.outcome === 'missed' || row.outcome === 'failed';
              const callable = canCallPeer(row.peerDeviceId);
              return (
                <div key={row.id} className="mk-call-row">
                  <div className={`mk-call-dir ${row.direction === 'incoming' ? 'is-in' : 'is-out'}`} aria-hidden>
                    {row.direction === 'incoming' ? '↙' : '↗'}
                  </div>
                  <div className="mk-call-row-main">
                    <div className="mk-call-row-name">{nameFor(row.peerDeviceId)}</div>
                    <div className={`mk-call-row-summary ${missed ? 'is-missed' : ''}`}>{callLogSummary(row)}</div>
                  </div>
                  {callable ? (
                    <button
                      type="button"
                      className="mk-call-back-btn"
                      aria-label={`Call ${nameFor(row.peerDeviceId)} back`}
                      onClick={() => callBack(row)}
                    >
                      {row.kind === 'video' ? 'Video' : 'Call'}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
