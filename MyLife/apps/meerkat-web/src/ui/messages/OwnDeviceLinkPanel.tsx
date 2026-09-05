import { useCallback, useMemo, useState } from 'react';
import { listDmOwnDevices } from '../../lib/dm-core';
import {
  buildOwnDeviceLinkCandidates,
  readOwnDeviceLinkStatus,
  type OwnDeviceLinkCandidate,
  type OwnDeviceStatusTone,
} from '../../lib/dm-own-device-status';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { shortHex } from '../format';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';

function toneClass(tone: OwnDeviceStatusTone): string {
  switch (tone) {
    case 'success':
      return 'is-success';
    case 'warning':
      return 'is-warning';
    case 'idle':
      return 'is-idle';
  }
}

export function OwnDeviceLinkPanel({ settings = false }: { settings?: boolean }): React.ReactElement {
  const m = useMeerkat();
  const revision = m.revision;
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ownDevices = useMemo(() => {
    void revision;
    return listDmOwnDevices(m.db);
  }, [m, revision]);
  const status = useMemo(
    () => {
      void revision;
      return readOwnDeviceLinkStatus(m.db, m.identity.publicKey);
    },
    [m, revision],
  );
  const candidates = useMemo(
    () => buildOwnDeviceLinkCandidates(m.pairedDevices(), ownDevices, {
      isPeerSasVerified: m.isPeerSasVerified,
      isPeerRevoked: m.isPeerRevoked,
      shortDeviceId: shortHex,
    }),
    [m, ownDevices],
  );

  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const onLink = useCallback((candidate: OwnDeviceLinkCandidate) => {
    if (!candidate.canLink) return;
    setNotice(null);
    void (async () => {
      try {
        // Plan 52 P1: linking also proposes the person group, so the two devices
        // present as ONE person. The link itself always lands; the ceremony
        // needs the other device to co-sign, so the notice says exactly that
        // rather than claiming the devices already read as one person.
        const result = await m.linkOwnDeviceAsPerson({
          deviceId: candidate.deviceId,
          identityAnchor: m.identity.publicKey,
          dhPublicKey: candidate.dhPublicKey,
          label: candidate.displayName,
        });
        const linked = `${candidate.displayName} is linked as one of your own devices in this browser.`;
        if (result.ok && result.assembled) {
          setNotice(`${linked} They now show as one person.`);
        } else if (result.ok) {
          setNotice(`${linked} They will show as one person once that device confirms; open Meerkat there and let it sync.`);
        } else if (result.reason === 'proposal_pending') {
          setNotice(`${linked} A device-linking confirmation is already waiting on another device, so this one has not started yet. Use "Cancel the waiting confirmation" below, then link again.`);
        } else if (result.reason === 'conflicted') {
          setNotice(`${linked} Your devices disagree about which change came first, so they cannot be joined into one person. Use "Start my device group over" below.`);
        } else {
          setNotice(`${linked} They could not be joined into one person yet, so they still show separately.`);
        }
      } catch {
        setNotice(`Could not link ${candidate.displayName}. Nothing was changed.`);
      }
    })();
  }, [m]);

  const onUnlink = useCallback((candidate: OwnDeviceLinkCandidate) => {
    if (unlinkingId !== null) return;
    if (!window.confirm(
      `Remove ${candidate.displayName} from your devices?\n\n`
      + 'It stops counting as one of your devices, your other devices stop showing it as you, '
      + 'and a new key is generated that it does not have. Content it already holds stays on it. '
      + 'You can link it again later.',
    )) return;
    setUnlinkingId(candidate.deviceId);
    setNotice(null);
    void (async () => {
      try {
        const result = await m.unlinkOwnDeviceFromPerson(candidate.deviceId);
        // Round-3 MEDIUM-3: a removal that is still WAITING on another device has
        // changed nothing yet -- the device is still a member under the same key,
        // and the rotated key exists only inside the pending confirmation. Saying
        // "removed, new key generated" there would be materially false about a
        // lost or stolen device, so the pending case says exactly what is true.
        if (result.ok && result.assembled) {
          setNotice(`${candidate.displayName} was removed from your devices and a new key was generated.`);
        } else if (result.ok) {
          setNotice(`${candidate.displayName} will be removed once your other device confirms; open Meerkat there and let it sync. Until then it is still one of your devices and the key has not changed.`);
        } else if (result.reason === 'proposal_pending') {
          setNotice('A device-linking confirmation is already in progress. Cancel it below, then try again.');
        } else if (result.reason === 'conflicted') {
          setNotice(`Could not remove ${candidate.displayName}: your devices disagree about which change came first, so nothing was changed. Use "Start my device group over" below.`);
        } else {
          setNotice(`Could not remove ${candidate.displayName}. Nothing was changed.`);
        }
      } catch {
        // A thrown removal must not strand the row on "Removing…".
        setNotice(`Could not remove ${candidate.displayName}. Nothing was changed.`);
      } finally {
        setUnlinkingId(null);
      }
    })();
  }, [m, unlinkingId]);

  const onCancelPending = useCallback(() => {
    m.cancelPendingPersonProposals();
    setNotice('The waiting confirmation was cancelled. You can link a device again now.');
  }, [m]);

  const approvals = useMemo(() => {
    void revision;
    return m.pendingPersonRemovals();
  }, [m, revision]);

  const onApprove = useCallback((id: string) => {
    setNotice(null);
    void (async () => {
      try {
        const ok = await m.approvePersonRemoval(id);
        setNotice(ok
          ? 'You approved the removal. It completes once every one of your devices has agreed.'
          : 'That removal could not be approved, so nothing changed. Your devices may have moved on since it was asked.');
      } catch {
        setNotice('That removal could not be approved, so nothing changed.');
      }
    })();
  }, [m]);

  const onDecline = useCallback((id: string) => {
    m.declinePersonRemoval(id);
    setNotice('You declined that removal. Nothing was changed.');
  }, [m]);

  const onRebuild = useCallback(() => {
    if (!window.confirm(
      'Start your device group over on this device?\n\n'
      + 'This device forgets which devices are yours and generates a new key. '
      + 'Your other devices keep their own record until you do the same there, '
      + 'so you will need to link them again. Nothing you have written is deleted.',
    )) return;
    m.rebuildOwnPersonGroup();
    setNotice('This device started its group over. Link your other devices again when you are ready.');
  }, [m]);

  const onCheckMailbox = useCallback(() => {
    setBusy(true);
    setNotice(null);
    void (async () => {
      try {
        const result = await m.runForegroundDrain();
        if (result.appliedMessages > 0 || result.dmReceipts > 0) {
          setNotice(`Mailbox check applied ${result.appliedMessages} DM rows and ${result.dmReceipts} signed receipts.`);
        } else if (!result.ran) {
          setNotice('Mailbox check did not run because no connection server is configured.');
        } else {
          setNotice('Mailbox checked. No new messages or delivery updates were waiting.');
        }
        m.refresh();
      } catch (err) {
        setNotice(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    })();
  }, [m]);

  return (
    <section className={settings ? 'mk-settings-section mk-own-device-panel' : 'mk-card mk-own-device-panel'} aria-label="Own devices">
      <div className="mk-own-device-head">
        <div>
          {settings ? (
            <h3 className="mk-settings-section-title">Own devices</h3>
          ) : (
            <h2 className="mk-h2">Own devices</h2>
          )}
          <p className="mk-muted">Link another paired device you own so DMs can mirror through the mailbox.</p>
        </div>
        <span className={`mk-pill ${toneClass(status.tone)}`}>{status.pillLabel}</span>
      </div>

      <div className="mk-own-device-status">
        <strong>{status.title}</strong>
        <p className="mk-muted">{status.detail}</p>
      </div>

      {notice ? <div className="mk-box is-info" role="status">{notice}</div> : null}

      <div className="mk-own-device-list">
        {candidates.length === 0 ? (
          <p className="mk-muted">Pair another device on Sync first, then return here to link it.</p>
        ) : (
          candidates.map((candidate) => (
            <OwnDeviceCandidateRow
              key={candidate.deviceId}
              candidate={candidate}
              onLink={() => onLink(candidate)}
              onUnlink={() => onUnlink(candidate)}
              busy={unlinkingId === candidate.deviceId}
            />
          ))
        )}
      </div>

      <div className="mk-btn-row">
        <Button variant="ghost" small disabled={busy} onClick={onCheckMailbox}>
          {busy ? 'Checking...' : 'Check mailbox now'}
        </Button>
      </div>

      {approvals.length > 0 ? (
        <div className="mk-box is-warning" role="status">
          <p style={{ margin: 0 }}>
            {approvals.length === 1
              ? 'One of your devices is asking to remove a device from your devices.'
              : `Your devices are asking to remove devices ${approvals.length} times.`}
            {' '}
            This needs your approval here, because removing a device is not something
            one device should be able to do to another on its own.
          </p>
          {approvals.map((approval) => (
            <div key={approval.id} className="mk-own-device-row">
              <div className="mk-own-device-row-main">
                <strong>{`Remove ${approval.removes.map((id) => shortHex(id)).join(', ')}`}</strong>
                <span className="mk-mono">{`asked by ${shortHex(approval.senderDeviceId)}`}</span>
              </div>
              <div className="mk-btn-row">
                <Button variant="ghost" small onClick={() => onApprove(approval.id)}>Approve</Button>
                <Button variant="ghost" small onClick={() => onDecline(approval.id)}>Decline</Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {m.hasPendingPersonProposal() ? (
        <div className="mk-box is-info" role="status">
          <p style={{ margin: 0 }}>
            A device-linking confirmation is waiting on another device. Open Meerkat there and let
            it sync, or cancel it here to start over.
          </p>
          <Button variant="ghost" small onClick={onCancelPending}>
            Cancel the waiting confirmation
          </Button>
        </div>
      ) : null}
      <div className="mk-own-device-recovery">
        <p className="mk-muted" style={{ margin: 0 }}>
          If linking or removing a device stops working, reset the links on this device
          and link your devices again. Your messages are kept.
        </p>
        <Button variant="ghost" small onClick={onRebuild}>
          Start my device group over
        </Button>
      </div>
      <HonestNotice>
        Conversations are saved on this device. Link from both devices to receive copies on each.
        Updates appear when messages and delivery confirmations arrive.
      </HonestNotice>
    </section>
  );
}

function OwnDeviceCandidateRow({
  candidate,
  onLink,
  onUnlink,
  busy,
}: {
  candidate: OwnDeviceLinkCandidate;
  onLink: () => void;
  onUnlink: () => void;
  busy: boolean;
}): React.ReactElement {
  return (
    <div className="mk-own-device-row">
      <div className="mk-own-device-row-main">
        <strong>{candidate.displayName}</strong>
        <span className="mk-mono">{candidate.shortDeviceId}</span>
        {candidate.disabledReason ? <span className="mk-muted">{candidate.disabledReason}</span> : null}
      </div>
      {candidate.linked ? (
        // Plan 52: a lost, stolen, or retired device MUST be removable. This
        // rotates the person's group secret so the removed device cannot
        // derive future identifiers, records a tombstone so no later revision
        // can silently re-admit it, and revokes its own-device link.
        <Button variant="danger" small disabled={busy} onClick={onUnlink}>
          {busy ? 'Removing...' : 'Remove this device'}
        </Button>
      ) : (
        <Button variant="ghost" small disabled={!candidate.canLink} onClick={onLink}>
          Link this second device
        </Button>
      )}
    </div>
  );
}
