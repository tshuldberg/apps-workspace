// InChannelFileCard: one received attachment inside a message. Mirrors the
// native AttachmentCard (apps/meerkat/app/(root)/components/AttachmentCard.tsx)
// states and honest copy.
//
// Honesty boundary (Critical):
//   - "on this device" vs "removed" is derived LIVE from m.hasBlob() every
//     render/refresh, never a stored flag and never written onto the signed,
//     immutable attachment metadata.
//   - View opens the verified bytes in a new tab; Save triggers a browser
//     download of the verified bytes. Both fail honestly when bytes are absent.
//   - Remove is LOCAL-ONLY: it frees local bytes, leaves a placeholder, and does
//     not remove the file for other members.
//   - Request again reflects the real cm_file_requests row state
//     (requesting/requested/restored/declined/failed); it never implies delivery.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPublicKeyFingerprint, type ChannelMessageAttachment, type ChannelMessageEvent } from '@mylife/sync';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { communityFileReportTarget, isCommunityContentReportHidden } from '../../lib/community-safety';
import { bytesToBlob, formatBytes, isInlineRenderSafeMimeType, shortHex } from '../format';
import { Button } from '../shell/Button';
import {
  deriveAttachmentCardMode,
  deriveRequestAgainAvailability,
  deriveRequestAgainView,
  presentMetaLabel,
  requestAgainStatusFromRow,
  requestQueueFailureMessage,
  summarizeRemoveResult,
  REQUEST_AGAIN_LABEL,
  type FileRequestRow,
  type RemoveFeedback,
} from '../../lib/meerkat-data';

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'saved' }
  | { kind: 'downloaded-unviewable' }
  | { kind: 'failed'; reason: string };

const BYTES_ABSENT = 'This browser has a verified file record, but not the file bytes yet.';

export function InChannelFileCard({
  attachment,
  event,
}: {
  attachment: ChannelMessageAttachment;
  event: ChannelMessageEvent;
}): React.ReactElement | null {
  const m = useMeerkat();
  const revision = m.revision;
  const reportTargetId = communityFileReportTarget({ channelId: event.channelId, attachmentId: attachment.id });

  // present === null => the live has() check has not resolved (checking state).
  const [present, setPresent] = useState<boolean | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeFeedback, setRemoveFeedback] = useState<RemoveFeedback | null>(null);
  const [requestRow, setRequestRow] = useState<FileRequestRow | null>(null);
  const [requesting, setRequesting] = useState(false);
  const isImage = attachment.mimeType.startsWith('image/');

  const reloadRequestRow = useCallback(() => {
    setRequestRow(m.outgoingRequestFor(event.communityId, event.channelId, attachment.id));
  }, [m, event.communityId, event.channelId, attachment.id]);

  const refreshPresence = useCallback(async () => {
    const has = await m.hasBlob(attachment.blobHash);
    setPresent(has);
    if (has && isImage) {
      setPreviewUri(await m.blobPreviewDataUri(attachment.blobHash, attachment.mimeType));
    } else {
      setPreviewUri(null);
    }
    reloadRequestRow();
  }, [m, attachment.blobHash, attachment.mimeType, isImage, reloadRequestRow]);

  useEffect(() => {
    let cancelled = false;
    setPresent(null);
    setPreviewUri(null);
    reloadRequestRow();
    void (async () => {
      const has = await m.hasBlob(attachment.blobHash);
      if (cancelled) return;
      setPresent(has);
      if (has && isImage) {
        const uri = await m.blobPreviewDataUri(attachment.blobHash, attachment.mimeType);
        if (!cancelled) setPreviewUri(uri);
      }
    })();
    return () => {
      cancelled = true;
    };
    // revision re-runs the live presence check after a drain/restore/remove.
  }, [m, attachment.blobHash, attachment.mimeType, isImage, reloadRequestRow, revision]);

  const openAttachment = useCallback(() => {
    void (async () => {
      try {
      const bytes = await m.getBlob(attachment.blobHash);
      if (!bytes) {
        setSaveStatus({ kind: 'failed', reason: BYTES_ABSENT });
        await refreshPresence();
        return;
      }
      const blob = bytesToBlob(bytes, attachment.mimeType);
      const url = URL.createObjectURL(blob);
      if (isInlineRenderSafeMimeType(attachment.mimeType)) {
        window.open(url, '_blank', 'noopener');
      } else {
        // Audit S1: mimeType is sender-signed and untrusted. Scriptable document
        // types must not open inline on the app origin, so non-render-safe types
        // are force-downloaded instead of previewed.
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSaveStatus({ kind: 'downloaded-unviewable' });
      }
      // Revoke after a tick so the new tab / download has loaded it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (err) {
        // A thrown blob read used to die silently; surface the honest failure.
        setSaveStatus({ kind: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [m, attachment.blobHash, attachment.mimeType, attachment.name, refreshPresence]);

  const saveAttachment = useCallback(() => {
    void (async () => {
      setSaveStatus({ kind: 'busy' });
      try {
        // Inside the try: a thrown blob read used to strand the button on
        // "Saving…" forever with the rejection swallowed.
        const bytes = await m.getBlob(attachment.blobHash);
        if (!bytes) {
          setSaveStatus({ kind: 'failed', reason: BYTES_ABSENT });
          await refreshPresence().catch(() => undefined);
          return;
        }
        const blob = bytesToBlob(bytes, attachment.mimeType);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = attachment.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setSaveStatus({ kind: 'saved' });
      } catch (err) {
        setSaveStatus({ kind: 'failed', reason: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, [m, attachment.blobHash, attachment.mimeType, attachment.name, refreshPresence]);

  const performRemove = useCallback(() => {
    void (async () => {
      setRemoveBusy(true);
      try {
        const result = await m.removeLocalBlob(attachment.blobHash);
        setRemoveFeedback(summarizeRemoveResult(result, attachment.size));
        await refreshPresence();
      } catch (err) {
        // Without this catch a thrown remove died silently while `finally`
        // reset busy = an idle-looking dead tap.
        setRemoveFeedback({ removed: false, tone: 'error', message: err instanceof Error ? err.message : String(err) });
      } finally {
        setRemoveBusy(false);
      }
    })();
  }, [m, attachment.blobHash, attachment.size, refreshPresence]);

  const confirmRemove = useCallback(() => {
    const ok = window.confirm(
      `Remove from this device?\n\nThis frees ${formatBytes(attachment.size)} of local space and leaves a placeholder. The signed message stays, and nothing is removed for other members. Only your local copy is deleted.`,
    );
    if (ok) performRemove();
  }, [attachment.size, performRemove]);

  const reportFile = useCallback(() => {
    const ok = window.confirm(
      'Report and hide this file? This hides it on this device and adds it to local owner review.',
    );
    if (!ok) return;
    m.reportCommunityContent({
      communityId: event.communityId,
      channelId: event.channelId,
      targetKind: 'file',
      targetId: reportTargetId,
      targetAuthorDeviceId: event.authorDeviceId,
      targetLabel: attachment.name,
      reason: 'Reported from file card',
    });
  }, [m, event.communityId, event.channelId, event.authorDeviceId, attachment.name, reportTargetId]);

  const authorPaired = useMemo(
    () => m.pairedDevices().some((peer) => peer.deviceId === event.authorDeviceId && peer.isActive),
    [m, event.authorDeviceId],
  );
  const relayConfigured = useMemo(() => m.relayUrl.trim().startsWith('ws'), [m.relayUrl]);
  const availability = deriveRequestAgainAvailability({
    isOwnMessage: event.authorDeviceId === m.identity.publicKey,
    authorPaired,
    relayConfigured,
  });

  const requestStatus = requestAgainStatusFromRow(requestRow, requesting);
  const requestView = deriveRequestAgainView(requestStatus, requestRow?.detail ?? null);

  const requestAgain = useCallback(() => {
    void (async () => {
      setRequesting(true);
      try {
        const result = await m.requestFileAgain(event, attachment);
        if (!result.ok) {
          window.alert(`Could not request: ${requestQueueFailureMessage(result.reason)}`);
        }
        reloadRequestRow();
        if (result.ok) {
          // Best-effort foreground drain so an online owner's reply lands soon.
          await m.runForegroundDrain().catch(() => undefined);
          await refreshPresence();
        }
      } catch (err) {
        // requestFileAgain can throw (sealing/blob reads); without this catch
        // the rejection vanished while `finally` reset busy = a dead tap.
        window.alert(`Could not request: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setRequesting(false);
      }
    })();
  }, [m, event, attachment, reloadRequestRow, refreshPresence]);

  const mode = deriveAttachmentCardMode(present);
  const reportHidden = isCommunityContentReportHidden(m.db, event.communityId, 'file', reportTargetId);

  if (reportHidden) return null;

  if (mode === 'removed') {
    const buttonDisabled = !availability.canRequest || requestView.busy;
    const buttonLabel = requestView.busy ? 'Requesting…' : REQUEST_AGAIN_LABEL;
    return (
      <div className="mk-file-card is-removed">
        <div className="mk-file-card-head">
          <span className="mk-file-icon" aria-hidden>📄</span>
          <div className="mk-file-card-text">
            <div className="mk-file-card-name" title={attachment.name}>{attachment.name}</div>
            <div className="mk-file-card-meta is-removed">
              {removeFeedback?.removed ? removeFeedback.message : 'Removed from this device'}
            </div>
          </div>
        </div>
        <div className="mk-file-card-actions">
          <Button
            small
            disabled={buttonDisabled}
            onClick={requestAgain}
            title={availability.canRequest ? undefined : availability.disabledReason ?? undefined}
          >
            {buttonLabel}
          </Button>
          <Button variant="danger" small onClick={reportFile}>
            Report
          </Button>
        </div>
        {requestView.message ? (
          <div className={`mk-file-card-status is-${requestView.tone}`}>{requestView.message}</div>
        ) : !availability.canRequest && availability.disabledReason ? (
          <div className="mk-file-card-status is-info">{availability.disabledReason}</div>
        ) : null}
      </div>
    );
  }

  const checking = mode === 'checking';

  return (
    <div className="mk-file-card">
      <div className="mk-file-card-head">
        {isImage && previewUri ? (
          <img className="mk-file-card-thumb" src={previewUri} alt={attachment.name} />
        ) : (
          <span className="mk-file-icon" aria-hidden>📄</span>
        )}
        <div className="mk-file-card-text">
          <div className="mk-file-card-name" title={attachment.name}>{attachment.name}</div>
          <div className="mk-file-card-meta">
            {checking ? 'Checking this device…' : presentMetaLabel(attachment.size)}
          </div>
        </div>
      </div>
      <div className="mk-file-card-actions">
        <Button small disabled={checking} onClick={openAttachment}>View</Button>
        <Button variant="ghost" small disabled={checking || saveStatus.kind === 'busy'} onClick={saveAttachment}>
          {saveStatus.kind === 'busy' ? 'Saving…' : 'Save to…'}
        </Button>
        <Button variant="danger" small disabled={checking || removeBusy} onClick={confirmRemove}>
          {removeBusy ? 'Removing…' : 'Remove'}
        </Button>
        <Button variant="danger" small onClick={reportFile}>
          Report
        </Button>
      </div>
      {saveStatus.kind === 'saved' ? (
        <div className="mk-file-card-status is-success">Downloaded the verified bytes to your browser's downloads.</div>
      ) : null}
      {saveStatus.kind === 'downloaded-unviewable' ? (
        <div className="mk-file-card-status is-info">This file type can't be previewed safely in the browser, so it was downloaded instead.</div>
      ) : null}
      {saveStatus.kind === 'failed' ? (
        <div className="mk-file-card-status is-error">Could not save: {saveStatus.reason}</div>
      ) : null}
      {removeFeedback && !removeFeedback.removed ? (
        <div className={`mk-file-card-status is-${removeFeedback.tone}`}>{removeFeedback.message}</div>
      ) : null}
    </div>
  );
}

/** Author short id, for the incoming-requests panel ("from {short id}"). */
export function shortDeviceId(deviceId: string): string {
  return shortHex(getPublicKeyFingerprint(deviceId));
}
