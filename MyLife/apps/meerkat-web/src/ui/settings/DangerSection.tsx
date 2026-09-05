// DangerSection (slice 5): permanently discard the current identity and reload
// the app on a brand new one. Mirrors the native Settings danger zone. The
// old identity is gone and cannot be recovered (create-then-swap reload).

import { useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { DELETE_MY_DATA_COPY } from '../../lib/delete-account-core';

const RESET_WARNING =
  'Reset identity?\n\n'
  + 'This permanently discards the current identity and all of its access: '
  + 'pairings, community membership, and anything sealed under the current key '
  + 'will no longer show you as the author. There is no recovery of the OLD '
  + 'identity. This cannot be undone.';

export function DangerSection(): React.ReactElement {
  const m = useMeerkat();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const onReset = (): void => {
    if (typeof window !== 'undefined' && !window.confirm(RESET_WARNING)) return;
    setResetting(true);
    setResetError(null);
    // resetIdentity flushes both stores and reloads; a failed flush must not
    // vanish as an unhandled rejection while the button claims nothing.
    void m.resetIdentity().catch((err) => {
      setResetError(err instanceof Error && err.message
        ? `The reset did not complete: ${err.message} Try again.`
        : 'The reset did not complete. Try again.');
      setResetting(false);
    });
  };
  // B.2: the consolidated "Delete my data" flow. Composes the existing wipes and
  // reloads into a clean first-run. Honest about what it cannot delete.
  const onDelete = (): void => {
    if (typeof window !== 'undefined' && !window.confirm(DELETE_MY_DATA_COPY.confirmBody)) return;
    const deleteRemoteStorageData = typeof window !== 'undefined' && window.confirm(
      'Delete encrypted backup objects too?\n\nChoose OK to ask every destination adapter to delete the encrypted backup objects it can reach. Choose Cancel to keep those objects while still revoking every destination and deleting local credentials.',
    );
    setDeleting(true);
    setDeleteError(null);
    void m.deleteMyData(deleteRemoteStorageData).catch((err) => {
      setDeleteError(err instanceof Error ? err.message : DELETE_MY_DATA_COPY.errorRetry);
      setDeleting(false);
    });
  };
  return (
    <section className="mk-settings-section">
      <h3 className="mk-settings-section-title">Danger zone</h3>
      <Button variant="danger" onClick={onReset} disabled={resetting}>
        {resetting ? 'Resetting…' : 'Reset identity'}
      </Button>
      {resetError ? <p className="mk-muted" style={{ color: 'var(--mk-danger)' }}>{resetError}</p> : null}
      <HonestNotice>
        Reset reloads the app with a brand new identity. The old one is gone and cannot be recovered.
        Generate a recovery key first if you want to keep the current identity.
      </HonestNotice>

      <h3 className="mk-settings-section-title" style={{ marginTop: 16 }}>{DELETE_MY_DATA_COPY.sectionTitle}</h3>
      <Button variant="danger" onClick={onDelete} disabled={deleting}>
        {deleting ? DELETE_MY_DATA_COPY.deleting : DELETE_MY_DATA_COPY.buttonLabel}
      </Button>
      {deleteError ? <p className="mk-muted" style={{ color: 'var(--mk-danger)' }}>{deleteError}</p> : null}
      <HonestNotice>
        Deletes your registered public persona and posts first, revokes every storage destination,
        deletes broker vaults and hosted storage, then removes every local identity, raw file, content
        row, community, direct message, and setting in this browser. A separate prompt controls whether
        destination adapters also delete reachable encrypted backup objects. Remote failures pause the
        local wipe with your signing key intact so you can retry.
      </HonestNotice>
    </section>
  );
}
