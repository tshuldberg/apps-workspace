// SyncDialog (slice 3): pair devices and run a manual relay session. Mirrors the
// native Sync screen, but web is RELAY-ONLY: no LAN. Friend-code requests and
// safety-code checks live in Friends. Every number shown comes from the real
// engine or the sync_ tables; nothing is simulated. The in-flight button labels read a
// component-local `running` flag, never the engine status (which never flips to
// a "connected" state on web).

import { useState } from 'react';
import {
  encodeMeerkatPairingCode,
  formatMeerkatPairingCode,
} from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { useView } from '../navigation/useView';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { TextArea, TextField } from '../shell/Field';
import { HonestNotice } from '../shell/HonestNotice';
import { StatusPill } from '../shell/StatusPill';
import { formatWhen, shortHex } from '../format';
import { RelayBar } from './RelayBar';
import { ConnectionStatusCard } from './ConnectionStatusCard';
import { AutoConnectCard } from './AutoConnectCard';
import type { SyncSession } from '@mylife/sync';

export function SyncDialog(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();

  const [pairInput, setPairInput] = useState('');
  const [pairMessage, setPairMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pairShareMessage, setPairShareMessage] = useState<string | null>(null);
  const [phrase, setPhrase] = useState('');
  const [peerId, setPeerId] = useState('');
  const [running, setRunning] = useState<'listen' | 'initiate' | null>(null);
  const [sessionNote, setSessionNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const close = (): void => dispatch({ type: 'CLOSE_OVERLAY' });

  const paired = m.pairedDevices();
  const sessions = m.recentSessions();
  const pairingCode = encodeMeerkatPairingCode(m.myPairingPayload());
  const formattedPairingCode = formatMeerkatPairingCode(pairingCode);
  // Default the picker to the first paired device once one exists.
  const selectedPeer = peerId || paired[0]?.deviceId || '';

  const onPair = (): void => {
    const result = m.pairFromPayload(pairInput);
    if (result.ok) {
      setPairMessage({ kind: 'ok', text: `Paired with ${result.device.displayName}.` });
      setPairInput('');
    } else {
      setPairMessage({ kind: 'error', text: result.error });
    }
  };

  const copyPairingCode = async (): Promise<void> => {
    if (!navigator.clipboard) {
      setPairShareMessage('Copying is not available here. Select the code above to copy it.');
      window.setTimeout(() => setPairShareMessage(null), 2600);
      return;
    }
    try {
      await navigator.clipboard.writeText(pairingCode);
      setPairShareMessage('Pairing code copied.');
      window.setTimeout(() => setPairShareMessage(null), 1800);
    } catch {
      setPairShareMessage('Could not copy. The pairing code was not copied.');
      window.setTimeout(() => setPairShareMessage(null), 2600);
    }
  };

  const sharePairingCode = async (): Promise<void> => {
    const text = `Pair with ${m.displayName || 'me'} in Meerkat:\n${pairingCode}`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Meerkat pairing code', text });
        setPairShareMessage('Pairing code shared.');
        window.setTimeout(() => setPairShareMessage(null), 1800);
        return;
      } catch {
        return;
      }
    }
    if (!navigator.clipboard) {
      setPairShareMessage('Sharing is not available here. Select the code above to copy it.');
      window.setTimeout(() => setPairShareMessage(null), 2600);
      return;
    }
    try {
      await navigator.clipboard.writeText(pairingCode);
      setPairShareMessage('Sharing is not available here. Pairing code copied instead.');
      window.setTimeout(() => setPairShareMessage(null), 2200);
    } catch {
      setPairShareMessage('Could not copy. The pairing code was not copied.');
      window.setTimeout(() => setPairShareMessage(null), 2600);
    }
  };

  const relayReady = m.relayUrl.startsWith('ws') && m.hostedAccess.canUseRelay(m.relayUrl);
  const phraseOk = phrase.trim().length >= 16;
  const canRun = running === null && relayReady && phraseOk && selectedPeer.length > 0;

  const onRun = (role: 'listen' | 'initiate'): void => {
    if (!canRun) return;
    setRunning(role);
    setSessionNote(null);
    m.runRelaySession({ phrase: phrase.trim(), peerDeviceId: selectedPeer, role })
      .then((session: SyncSession | null) => {
        if (session) {
          setSessionNote({
            kind: session.status === 'completed' ? 'ok' : 'error',
            text: `Session ${session.status} · sent ${session.changesSent} / received ${session.changesReceived}`,
          });
        } else if (role === 'listen') {
          setSessionNote({ kind: 'ok', text: 'Listened for inbound sync. No session was recorded.' });
        } else {
          setSessionNote({ kind: 'error', text: 'No session was recorded.' });
        }
      })
      .catch((error: unknown) => {
        setSessionNote({
          kind: 'error',
          text: error instanceof Error ? error.message : 'Session failed.',
        });
      })
      .finally(() => setRunning(null));
  };

  return (
    <Modal title="Sync" onClose={close}>
      <div className="mk-sync-dialog">
        {/* --- Engine --- */}
        <section className="mk-sync-section">
          <h3 className="mk-sync-section-title">Engine</h3>
          <div className="mk-sync-engine-row">
            <StatusPill status={m.status} />
            <span className="mk-muted">
              {m.status.lastSyncAt
                ? `Last sync ${formatWhen(m.status.lastSyncAt)}`
                : 'No session has completed on this device yet.'}
            </span>
          </div>
          <div className="mk-muted">Paired devices: {paired.length}</div>
        </section>

        {/* --- Automatic connections --- */}
        <AutoConnectCard />

        {/* --- Connection server --- */}
        <section className="mk-sync-section">
          <h3 className="mk-sync-section-title">Connection server</h3>
          <ConnectionStatusCard />
          <RelayBar />
          {m.relayUrl.startsWith('ws') && !m.hostedAccess.canUseRelay(m.relayUrl) && (
            <div className="mk-box is-error" role="alert">
              The hosted Meerkat connection server requires an active subscription. Use your own or
              a community server URL to sync without paid hosted access.
            </div>
          )}
        </section>

        {/* --- Pairing --- */}
        <section className="mk-sync-section">
          <h3 className="mk-sync-section-title">Pairing</h3>
          <div className="mk-pair-code-card">
            <div>
              <span className="mk-label">This device&apos;s pairing code</span>
              <div className="mk-pair-code" aria-label="This device's pairing code">
                {formattedPairingCode}
              </div>
            </div>
            <div className="mk-btn-row">
              <Button variant="ghost" small onClick={() => { void copyPairingCode(); }}>
                Copy code
              </Button>
              <Button variant="ghost" small onClick={() => { void sharePairingCode(); }}>
                Share
              </Button>
            </div>
            {pairShareMessage ? <div className="mk-muted">{pairShareMessage}</div> : null}
          </div>
          <TextArea
            label="Paste the other device's pairing code"
            value={pairInput}
            onChange={(e) => setPairInput(e.target.value)}
            placeholder="MKPAIR1-..."
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Peer pairing code"
          />
          <Button onClick={onPair} disabled={pairInput.trim().length === 0}>
            Pair device
          </Button>
          {pairMessage && (
            <div className={`mk-box ${pairMessage.kind === 'ok' ? 'is-success' : 'is-error'}`} role="alert">
              {pairMessage.text}
            </div>
          )}
          {paired.length > 0 && (
            <ul className="mk-paired-list">
              {paired.map((device) => (
                <li key={device.deviceId} className="mk-paired-row">
                  <span className="mk-paired-name">{device.displayName}</span>
                  <span className="mk-mono">{shortHex(device.deviceId)}</span>
                </li>
              ))}
            </ul>
          )}
          <HonestNotice>
            Exchange pairing codes out of band once per device pair. Legacy JSON from older builds
            still works if pasted here. Web Meerkat uses a connection server for manual sessions:
            there is no local Wi-Fi or Bluetooth in the browser. Friend-code requests and safety
            checks live in Friends.
          </HonestNotice>
        </section>

        {/* --- Manual session --- */}
        <section className="mk-sync-section">
          <h3 className="mk-sync-section-title">Manual session</h3>
          {paired.length === 0 ? (
            <div className="mk-muted">Pair a device above before running a session.</div>
          ) : (
            <label className="mk-field">
              <span className="mk-label">Peer device</span>
              <select
                className="mk-input"
                value={selectedPeer}
                onChange={(e) => setPeerId(e.target.value)}
                aria-label="Peer device"
              >
                {paired.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.displayName} · {shortHex(device.deviceId)}
                  </option>
                ))}
              </select>
            </label>
          )}
          <TextField
            label="Shared phrase (16+ characters)"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
            placeholder="a phrase both devices type"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Shared rendezvous phrase"
          />
          <div className="mk-btn-row">
            <Button variant="ghost" onClick={() => onRun('listen')} disabled={!canRun}>
              {running === 'listen' ? 'Listening…' : 'Listen'}
            </Button>
            <Button onClick={() => onRun('initiate')} disabled={!canRun}>
              {running === 'initiate' ? 'Syncing…' : 'Sync now'}
            </Button>
          </div>
          {sessionNote && (
            <div className={`mk-box ${sessionNote.kind === 'ok' ? 'is-success' : 'is-error'}`} role="status">
              {sessionNote.text}
            </div>
          )}
          <HonestNotice>
            This is a manual session. Tap Listen on one device, then Sync now on the other within a
            few minutes. For hands-off syncing while this tab is open, turn on Automatic connections
            above. A connection server is a zero-knowledge meeting point; the paid tier ($4.99/mo)
            adds capacity, backup, public reach, and always-on history, not a different meeting point.
            Scheduled background sync that runs while the tab is closed is still pending.
          </HonestNotice>
        </section>

        {/* --- Recent sessions --- */}
        <section className="mk-sync-section">
          <h3 className="mk-sync-section-title">Recent sessions</h3>
          {sessions.length === 0 ? (
            <div className="mk-muted">No sessions yet.</div>
          ) : (
            <ul className="mk-session-list">
              {sessions.map((session) => (
                <li key={session.id} className="mk-session-row">
                  <div className="mk-session-top">
                    <span className={`mk-pill ${session.status === 'completed' ? 'is-success' : 'is-warning'}`}>
                      {session.status}
                    </span>
                    <span className="mk-muted">{session.transport}</span>
                  </div>
                  <span className="mk-muted mk-session-meta">
                    peer {shortHex(session.peerDeviceId)} · sent {session.changesSent} / received{' '}
                    {session.changesReceived} · {formatWhen(session.startedAt)}
                  </span>
                  {session.error && (
                    <div className="mk-box is-error" role="alert">
                      {session.error}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
