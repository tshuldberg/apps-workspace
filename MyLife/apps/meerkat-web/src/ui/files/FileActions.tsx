// FileActions: the per-row action for the per-community Files index. A present
// file gets Save (browser download of the verified bytes); a removed file gets
// a disabled "Removed" marker (re-requesting happens from the in-channel card,
// where the signed message event is in hand). Honest result copy.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import { Button } from '../shell/Button';
import { bytesToBlob } from '../format';
import {
  deriveRequestAgainAvailability,
  deriveRequestAgainView,
  requestAgainStatusFromRow,
  requestQueueFailureMessage,
  REQUEST_AGAIN_LABEL,
  type FileRequestRow,
  type PresentFile,
} from '../../lib/meerkat-data';
import { useLibrary } from '../library/useLibrary';
import { LIBRARY_STRINGS } from '../../lib/library-browse-core';
import { MEDIA_TYPE_META } from '../library/media-meta';

// D.1: the live Request control for a REMOVED row in the Files index. Drives the
// SAME sealed FILE_REQUEST path as the in-channel card (m.requestFileAgainByFields),
// reflecting only the real cm_file_requests row. If a row can never be requested,
// nothing is rendered (button absent) - never a fake-disabled "later" affordance.
function RemovedFileRequest({ file, communityId }: { file: PresentFile; communityId: string }): React.ReactElement | null {
  const m = useMeerkat();
  const [requesting, setRequesting] = useState(false);
  const [row, setRow] = useState<FileRequestRow | null>(null);
  const [failDetail, setFailDetail] = useState<string | null>(null);

  const reload = useCallback(() => {
    setRow(m.outgoingRequestFor(communityId, file.channelId, file.attachmentId));
  }, [m, communityId, file.channelId, file.attachmentId]);
  useEffect(() => { reload(); }, [reload]);

  const authorPaired = useMemo(
    () => m.pairedDevices().some((peer) => peer.deviceId === file.authorDeviceId && peer.isActive),
    [m, file.authorDeviceId],
  );
  const relayConfigured = useMemo(() => m.relayUrl.trim().startsWith('ws'), [m.relayUrl]);
  const availability = deriveRequestAgainAvailability({
    isOwnMessage: file.authorDeviceId === m.identity.publicKey,
    authorPaired,
    relayConfigured,
  });
  const status = requestAgainStatusFromRow(row, requesting);
  const view = deriveRequestAgainView(status, failDetail ?? row?.detail ?? null);

  const request = useCallback(() => {
    void (async () => {
      setRequesting(true);
      setFailDetail(null);
      try {
        const result = await m.requestFileAgainByFields({
          communityId,
          channelId: file.channelId,
          messageId: file.messageId,
          attachmentId: file.attachmentId,
          blobHash: file.blobHash,
          ownerDeviceId: file.authorDeviceId,
        });
        if (!result.ok) {
          setFailDetail(requestQueueFailureMessage(result.reason));
        } else {
          reload();
          await m.runForegroundDrain().catch(() => undefined);
        }
      } catch (err) {
        // requestFileAgainByFields can throw (sealing/blob reads); without this
        // catch the rejection vanished while `finally` reset busy = a dead tap.
        setFailDetail(err instanceof Error ? err.message : 'Could not send that request.');
      } finally {
        setRequesting(false);
      }
    })();
  }, [m, communityId, file, reload]);

  // Button absent when no request is possible and none is in flight/answered.
  if (!availability.canRequest && status === 'none') return null;

  const busy = view.busy;
  return (
    <>
      <Button
        small
        disabled={busy || !availability.canRequest}
        onClick={request}
        title={availability.canRequest ? undefined : availability.disabledReason ?? undefined}
      >
        {busy ? 'Requesting…' : REQUEST_AGAIN_LABEL}
      </Button>
      {view.message ? <span className={`mk-file-card-status is-${view.tone}`}>{view.message}</span> : null}
    </>
  );
}

export function FileActions({
  file,
  communityId,
  onReport,
}: {
  file: PresentFile;
  communityId: string;
  onReport: () => void;
}): React.ReactElement {
  const m = useMeerkat();
  const lib = useLibrary();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [picking, setPicking] = useState(false);

  // Plan 38: "Add to library" promotes a plaintext channel attachment into a
  // sealed library item. Owner-only (canCurate), and only when this community has
  // a library channel to hold it.
  const canCurate = lib.canCurate(communityId, file.channelId);
  const communityLibraries = canCurate ? lib.listLibraries(communityId) : [];

  const addToLibrary = (libraryChannelId: string): void => {
    setPicking(false);
    setBusy(true);
    setStatus(null);
    void (async () => {
      try {
        const result = await lib.promoteChannelFile({
          blobHash: file.blobHash,
          channelId: libraryChannelId,
          workspaceId: communityId,
          title: file.name,
          mimeType: file.mimeType,
        });
        setStatus({ tone: 'success', text: result.deduped ? LIBRARY_STRINGS.alreadyInThisCommunity : 'added to library' });
      } catch (err) {
        setStatus({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
      } finally {
        setBusy(false);
      }
    })();
  };

  if (!file.present) {
    return (
      <div className="mk-file-row-actions">
        <span className="mk-file-row-removed">removed</span>
        <RemovedFileRequest file={file} communityId={communityId} />
        <Button variant="danger" small onClick={onReport}>
          Report
        </Button>
      </div>
    );
  }

  const save = (): void => {
    setBusy(true);
    setStatus(null);
    void (async () => {
      try {
        const bytes = await m.getBlob(file.blobHash);
        if (!bytes) {
          setStatus({ tone: 'error', text: 'This browser has a verified file record, but not the file bytes yet.' });
          return;
        }
        const blob = bytesToBlob(bytes, file.mimeType);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setStatus({ tone: 'success', text: 'saved' });
      } catch (err) {
        setStatus({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
      } finally {
        setBusy(false);
      }
    })();
  };

  return (
    <div className="mk-file-row-actions">
      <Button small disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save'}
      </Button>
      {communityLibraries.length > 0 ? (
        <div className="mk-file-lib-add">
          <Button variant="ghost" small disabled={busy} onClick={() => setPicking((v) => !v)}>
            {LIBRARY_STRINGS.addToLibrary}
          </Button>
          {picking ? (
            <div className="mk-file-lib-menu" role="menu">
              {communityLibraries.map((config) => (
                <button
                  key={config.id}
                  type="button"
                  className="mk-file-lib-menu-item"
                  role="menuitem"
                  onClick={() => addToLibrary(config.id)}
                >
                  {MEDIA_TYPE_META[config.mediaType].icon} {MEDIA_TYPE_META[config.mediaType].label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      <Button variant="danger" small onClick={onReport}>
        Report
      </Button>
      {status ? <span className={`mk-file-card-status is-${status.tone}`}>{status.text}</span> : null}
    </div>
  );
}
