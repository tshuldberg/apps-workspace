// RecoverySection (slice 5): secure-storage status + recovery key generation.
// Mirrors the native Settings recovery section. Honesty: the recoverable
// material (same deviceId) is real and proven, but on-device RESTORE on a fresh
// install is not built yet, so we say so plainly.

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { CopyRow } from '../shell/CopyRow';
import { HonestNotice } from '../shell/HonestNotice';
import { TextArea, TextField } from '../shell/Field';
import type { RecoveryMaterial } from '../../lib/MeerkatProvider';

export function RecoverySection(): React.ReactElement {
  const m = useMeerkat();
  const [recovery, setRecovery] = useState<RecoveryMaterial | null>(null);
  const [restoreKey, setRestoreKey] = useState('');
  const [restoreBackup, setRestoreBackup] = useState('');
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const configured = m.secureStorageConfigured;

  const onRestore = (): void => {
    if (!restoreKey.trim() || !restoreBackup.trim()) return;
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(
        'This replaces the identity in this browser with the one in your backup. The current identity, and anything sealed only under it, will be discarded. Continue?',
      );
    if (!confirmed) return;
    setRestoring(true);
    setRestoreError(null);
    void m.restoreIdentity(restoreKey, restoreBackup).then((result) => {
      // On success the page reloads on the restored identity; only a failure
      // returns control here.
      if (!result.ok) {
        setRestoreError(
          result.reason === 'bad_key'
            ? 'That recovery key is not valid. Check for typos; it starts with MKR1.'
            : 'That backup could not be opened with this key. The key may be wrong, or the backup may be corrupt or from a different identity.',
        );
      }
      setRestoring(false);
    }).catch(() => {
      // The restore flushes both stores and can reject; without this catch the
      // button would strand on "Restoring…" forever with no error.
      setRestoreError('The restore could not be saved in this browser. Try again.');
      setRestoring(false);
    });
  };

  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Recovery key</h3>
      <div className="mk-settings-status">
        <span aria-hidden className={configured ? 'mk-status-ok' : 'mk-status-bad'}>
          {configured ? '✓' : '✕'}
        </span>
        <span className="mk-muted">
          {configured
            ? "Identity keys are stored in this browser's secure storage."
            : 'Secure key storage is not configured.'}
        </span>
      </div>
      {recovery ? (
        <>
          <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>
            Your recovery key (write it down, keep it offline)
          </div>
          <div className="mk-mono mk-recovery-block">{recovery.key}</div>
          <CopyRow value={recovery.key} label="Copy recovery key" />
          <div className="mk-label" style={{ marginTop: 'var(--mk-space-sm)' }}>
            Encrypted identity backup (save anywhere)
          </div>
          <div className="mk-mono mk-recovery-block">{recovery.sealed}</div>
          <CopyRow value={recovery.sealed} label="Copy encrypted backup" />
          <HonestNotice>
            Anyone with the recovery key can impersonate you: treat it like a seed phrase. The
            encrypted backup is a local export, not cloud backup. Keep the key and the backup apart.
            To restore on a fresh install, paste both into Restore identity below. Hosted backup is a
            paid service and is not connected in this build.
          </HonestNotice>
        </>
      ) : (
        <>
          <Button
            onClick={() => {
              // generateRecovery reads the private key from the vault and can
              // throw when it is unavailable; the tap must not crash silently.
              try {
                setRecovery(m.generateRecovery());
                setGenerateError(null);
              } catch {
                setGenerateError('The recovery key could not be created because this browser\'s identity key could not be read. Nothing was generated.');
              }
            }}
          >
            Generate recovery key
          </Button>
          {generateError ? <div className="mk-box is-error" role="alert">{generateError}</div> : null}
          <HonestNotice>
            Creates a printable 256-bit key that encrypts a local export of your identity keys. It is
            not cloud backup. We never see it, and hosted backup is not connected in this build.
          </HonestNotice>
        </>
      )}

      <h3 className="mk-settings-section-title" style={{ marginTop: 'var(--mk-space-md)' }}>
        Restore identity
      </h3>
      <TextField
        label="Recovery key"
        value={restoreKey}
        onChange={(e) => setRestoreKey(e.target.value)}
        placeholder="MKR1-XXXXX-XXXXX-..."
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
      />
      <TextArea
        label="Encrypted identity backup"
        value={restoreBackup}
        onChange={(e) => setRestoreBackup(e.target.value)}
        placeholder="Paste the encrypted backup"
        autoComplete="off"
        spellCheck={false}
        rows={3}
      />
      <Button onClick={onRestore} disabled={restoring || !restoreKey.trim() || !restoreBackup.trim()}>
        {restoring ? 'Restoring…' : 'Restore identity'}
      </Button>
      {restoreError && (
        <div className="mk-box is-error" role="alert">{restoreError}</div>
      )}
      <HonestNotice>
        Restoring rebuilds the SAME identity from your recovery key and its encrypted backup: same
        device id, pins, and pairings. It replaces the identity in this browser, so anything sealed
        only under the current identity is discarded. It restores identity keys, not your synced
        data, which re-flows from peers as you reconnect. A wrong key or a tampered backup fails
        closed and changes nothing.
      </HonestNotice>
    </section>
  );
}
