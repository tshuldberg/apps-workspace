// Global Downloads browser (Plan 40 D.7). Cross-community and browser-wide, but
// still sourced from listChannelFiles, which itself resolves signed messages and
// checks local blob presence live.

import { getPublicKeyFingerprint } from '@mylife/sync';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMeerkat } from '../../lib/MeerkatProvider';
import {
  deriveRequestAgainAvailability,
  deriveRequestAgainView,
  requestAgainStatusFromRow,
  requestQueueFailureMessage,
  REQUEST_AGAIN_LABEL,
  type FileRequestRow,
} from '../../lib/meerkat-data';
import {
  communityFileReportTarget,
  isChannelMuted,
  isCommunityContentReportHidden,
  isCommunityMuted,
  isCommunityPersonBlocked,
} from '../../lib/community-safety';
import {
  filterGlobalDownloadFiles,
  summarizeDownloadSelection,
  summarizeGlobalDownloads,
  type DownloadStatusFilter,
  type GlobalDownloadFile,
} from '../../lib/global-downloads';
import { bytesToBlob, formatBytes, isInlineRenderSafeMimeType, shortHex } from '../format';
import { useView } from '../navigation/useView';
import { Button } from '../shell/Button';
import { EmptyState } from '../shell/EmptyState';
import { HonestNotice } from '../shell/HonestNotice';

const FILTERS: { id: DownloadStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'on-device', label: 'On device' },
  { id: 'removed', label: 'Removed' },
];

type DownloadOutcome =
  | { id: string; name: string; status: 'downloaded' }
  | { id: string; name: string; status: 'failed'; reason: string }
  | { id: string; name: string; status: 'skipped'; reason: string };

interface DownloadResult {
  total: number;
  downloadedCount: number;
  failedCount: number;
  skippedCount: number;
  perFile: DownloadOutcome[];
}

const BYTES_ABSENT = 'This browser has a verified file record, but not the file bytes yet.';

function fileGlyph(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼';
  if (mimeType.startsWith('video/')) return '🎞';
  return '📄';
}

function triggerBrowserDownload(bytes: Uint8Array, file: Pick<GlobalDownloadFile, 'mimeType' | 'name'>): void {
  const blob = bytesToBlob(bytes, file.mimeType);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function outcomeLabel(outcome: DownloadOutcome): string {
  switch (outcome.status) {
    case 'downloaded':
      return 'download started from verified bytes';
    case 'failed':
      return `failed · ${outcome.reason}`;
    case 'skipped':
      return outcome.reason;
  }
}

function RequestAgainAction({
  file,
  onRestored,
}: {
  file: GlobalDownloadFile;
  onRestored: () => void;
}): React.ReactElement | null {
  const m = useMeerkat();
  const [requesting, setRequesting] = useState(false);
  const [row, setRow] = useState<FileRequestRow | null>(null);
  const [failDetail, setFailDetail] = useState<string | null>(null);

  const reload = useCallback(() => {
    setRow(m.outgoingRequestFor(file.communityId, file.channelId, file.attachmentId));
  }, [m, file.communityId, file.channelId, file.attachmentId]);
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
          communityId: file.communityId,
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
          onRestored();
        }
      } catch (err) {
        // requestFileAgainByFields can throw (sealing/blob reads); without this
        // catch the rejection vanished while `finally` reset busy = a dead tap.
        setFailDetail(err instanceof Error ? err.message : 'Could not send that request.');
      } finally {
        setRequesting(false);
      }
    })();
  }, [m, file, reload, onRestored]);

  if (!availability.canRequest && status === 'none') return null;

  return (
    <>
      <Button
        small
        disabled={view.busy || !availability.canRequest}
        onClick={request}
        title={availability.canRequest ? undefined : availability.disabledReason ?? undefined}
      >
        {view.busy ? 'Requesting…' : REQUEST_AGAIN_LABEL}
      </Button>
      {view.message ? <span className={`mk-file-card-status is-${view.tone}`}>{view.message}</span> : null}
    </>
  );
}

export function DownloadsView(): React.ReactElement {
  const m = useMeerkat();
  const { dispatch } = useView();
  const revision = m.revision;
  const communities = m.listCommunities();
  const [files, setFiles] = useState<GlobalDownloadFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<DownloadStatusFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DownloadResult | null>(null);

  const refresh = useCallback(() => {
    let cancelled = false;
    setLoadError(null);
    setFiles(null);
    void (async () => {
      try {
        const rows = await Promise.all(
          m.listCommunities().map(async (community) => {
            const communityFiles = await m.listChannelFiles(community.communityId);
            return communityFiles.map((file) => ({
              ...file,
              id: `${community.communityId}:${file.id}`,
              communityId: community.communityId,
              communityName: community.descriptor.name,
            }));
          }),
        );
        if (!cancelled) setFiles(rows.flat());
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
          setFiles([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [m]);

  useEffect(() => refresh(), [refresh, revision]);

  const visibleFiles = useMemo(() => {
    const base = (files ?? []).filter((file) => (
      !isCommunityMuted(m.db, file.communityId)
      && !isChannelMuted(m.db, file.communityId, file.channelId)
      && !isCommunityPersonBlocked(m.db, file.communityId, file.authorDeviceId)
      && !isCommunityContentReportHidden(m.db, file.communityId, 'file', communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }))
      && !isCommunityContentReportHidden(m.db, file.communityId, 'message', file.messageId)
    ));
    return filterGlobalDownloadFiles(base, { query, status });
  }, [files, m.db, query, status]);

  const allFiles = files ?? [];
  const checking = files === null && !loadError;
  const summary = summarizeGlobalDownloads(allFiles);
  const selectionSummary = summarizeDownloadSelection(visibleFiles, selectedIds);
  const allVisibleSelected =
    visibleFiles.some((file) => file.present)
    && selectionSummary.count === visibleFiles.filter((file) => file.present).length;

  const authorName = useCallback(
    (file: GlobalDownloadFile): string => {
      if (file.authorDeviceId === m.identity.publicKey) {
        const communityName = m.communityPeerNames(file.communityId).get(file.authorDeviceId);
        return communityName ? `You as ${communityName}` : 'You';
      }
      return m.communityPeerNames(file.communityId).get(file.authorDeviceId)
        ?? shortHex(getPublicKeyFingerprint(file.authorDeviceId));
    },
    [m],
  );

  const toggleSelect = (file: GlobalDownloadFile): void => {
    if (!file.present) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      return next;
    });
  };

  const toggleSelectAll = (): void => {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(visibleFiles.filter((file) => file.present).map((file) => file.id)));
  };

  const downloadRows = useCallback(
    async (rows: GlobalDownloadFile[]): Promise<void> => {
      if (rows.length === 0) return;
      setBusy(true);
      setResult(null);
      const perFile: DownloadOutcome[] = [];
      let downloadedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;
      try {
        for (const file of rows) {
          // The blob read is caught PER FILE: one thrown read becomes that
          // file's failed outcome instead of aborting the batch and losing the
          // partial result.
          let bytes;
          try {
            bytes = await m.getBlob(file.blobHash);
          } catch (err) {
            perFile.push({
              id: file.id,
              name: file.name,
              status: 'failed',
              reason: err instanceof Error ? err.message : String(err),
            });
            failedCount += 1;
            continue;
          }
          if (!bytes) {
            perFile.push({ id: file.id, name: file.name, status: 'skipped', reason: BYTES_ABSENT });
            skippedCount += 1;
            continue;
          }
          try {
            triggerBrowserDownload(bytes, file);
            perFile.push({ id: file.id, name: file.name, status: 'downloaded' });
            downloadedCount += 1;
          } catch (err) {
            perFile.push({
              id: file.id,
              name: file.name,
              status: 'failed',
              reason: err instanceof Error ? err.message : String(err),
            });
            failedCount += 1;
          }
        }
        setResult({ total: rows.length, downloadedCount, failedCount, skippedCount, perFile });
      } finally {
        setBusy(false);
      }
    },
    [m],
  );

  const openFile = useCallback(
    (file: GlobalDownloadFile) => {
      void (async () => {
        setResult(null);
        try {
        const bytes = await m.getBlob(file.blobHash);
        if (!bytes) {
          setResult({
            total: 1,
            downloadedCount: 0,
            failedCount: 0,
            skippedCount: 1,
            perFile: [{ id: file.id, name: file.name, status: 'skipped', reason: BYTES_ABSENT }],
          });
          refresh();
          return;
        }
        const blob = bytesToBlob(bytes, file.mimeType);
        const url = URL.createObjectURL(blob);
        if (isInlineRenderSafeMimeType(file.mimeType)) {
          window.open(url, '_blank', 'noopener');
        } else {
          triggerBrowserDownload(bytes, file);
          setResult({
            total: 1,
            downloadedCount: 1,
            failedCount: 0,
            skippedCount: 0,
            perFile: [{ id: file.id, name: file.name, status: 'downloaded' }],
          });
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
          // A thrown blob read used to die silently; surface the honest failure.
          setResult({
            total: 1,
            downloadedCount: 0,
            failedCount: 1,
            skippedCount: 0,
            perFile: [{ id: file.id, name: file.name, status: 'failed', reason: err instanceof Error ? err.message : String(err) }],
          });
        }
      })();
    },
    [m, refresh],
  );

  const reportFile = (file: GlobalDownloadFile): void => {
    const ok = window.confirm(
      'Report and hide this file? This hides it on this browser and adds it to local owner review.',
    );
    if (!ok) return;
    m.reportCommunityContent({
      communityId: file.communityId,
      channelId: file.channelId,
      targetKind: 'file',
      targetId: communityFileReportTarget({ channelId: file.channelId, attachmentId: file.attachmentId }),
      targetAuthorDeviceId: file.authorDeviceId,
      targetLabel: file.name,
      reason: 'Reported from global Downloads',
    });
    refresh();
  };

  const outcomeById = useMemo(() => {
    const map = new Map<string, DownloadOutcome>();
    for (const outcome of result?.perFile ?? []) map.set(outcome.id, outcome);
    return map;
  }, [result]);

  const selectedRows = visibleFiles.filter((file) => file.present && selectedIds.has(file.id));

  return (
    <div className="mk-main-scroll mk-files-view mk-downloads-view">
      <div className="mk-files-header">
        <Button variant="ghost" small onClick={() => dispatch({ type: 'OPEN_FEED' })}>
          ← Back
        </Button>
        <div className="mk-files-header-text">
          <h1 className="mk-h1" style={{ margin: 0 }}>Downloads</h1>
          <div className="mk-muted">
            {summary.total} files · {summary.onDevice} on this browser · {formatBytes(summary.onDeviceBytes)}
          </div>
        </div>
        {summary.onDevice > 0 ? (
          <Button
            variant="ghost"
            small
            onClick={() => {
              setSelecting((value) => !value);
              setSelectedIds(new Set());
              setResult(null);
            }}
          >
            {selecting ? 'Done' : 'Select'}
          </Button>
        ) : null}
      </div>

      <div className="mk-download-controls">
        <label className="mk-download-search">
          <span aria-hidden>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search files, channels, communities"
            aria-label="Search downloads"
          />
        </label>
        <div className="mk-download-filter-row" role="group" aria-label="Download status filter">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              className={`mk-download-filter ${status === filter.id ? 'is-active' : ''}`}
              onClick={() => setStatus(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {checking ? (
        <div className="mk-box is-info">Checking this browser. Reading verified local file presence across communities.</div>
      ) : null}

      {loadError ? (
        <div className="mk-box is-error">Could not check downloads: {loadError}</div>
      ) : null}

      {!checking && !loadError && allFiles.length === 0 ? (
        <EmptyState icon="📁" title="No downloads yet">
          Files shared in communities will appear here after their signed messages exist in this browser.
        </EmptyState>
      ) : null}

      {!checking && !loadError && allFiles.length > 0 && visibleFiles.length === 0 ? (
        <EmptyState icon="🔎" title="No matches">
          Change the search or status filter.
        </EmptyState>
      ) : null}

      {!checking && !loadError && summary.onDevice > 0 && summary.removed > 0 ? (
        <div className="mk-box is-warning">
          Partial availability: {summary.onDevice} on this browser, {summary.removed} removed.
        </div>
      ) : null}

      {selecting && visibleFiles.length > 0 ? (
        <div className="mk-download-selectbar">
          <span>{selectionSummary.label}</span>
          <div className="mk-download-select-actions">
            <Button variant="ghost" small onClick={toggleSelectAll}>
              {allVisibleSelected ? 'Clear' : 'Select visible'}
            </Button>
            <Button small disabled={busy || selectionSummary.count === 0} onClick={() => { void downloadRows(selectedRows); }}>
              {busy ? 'Saving…' : 'Save selected'}
            </Button>
          </div>
        </div>
      ) : null}

      {visibleFiles.length > 0 ? (
        <ul className="mk-file-list">
          {visibleFiles.map((file) => {
            const outcome = outcomeById.get(file.id) ?? null;
            const selected = selectedIds.has(file.id);
            return (
              <li key={file.id} className={`mk-file-row mk-download-row${file.present ? '' : ' is-removed'}`}>
                {selecting ? (
                  <input
                    type="checkbox"
                    className="mk-download-check"
                    checked={selected}
                    disabled={!file.present}
                    onChange={() => toggleSelect(file)}
                    aria-label={`Select ${file.name}`}
                  />
                ) : null}
                <span className="mk-file-icon" aria-hidden>{fileGlyph(file.mimeType)}</span>
                <div className="mk-file-row-text">
                  <div className="mk-file-row-name" title={file.name}>{file.name}</div>
                  <div className="mk-file-row-meta">
                    {file.communityName} · #{file.channelName} · by {authorName(file)} · {formatBytes(file.size)} · {file.present ? 'on browser' : 'removed'}
                  </div>
                  {outcome ? (
                    <div className={`mk-file-card-status is-${outcome.status === 'failed' ? 'error' : outcome.status === 'downloaded' ? 'success' : 'info'}`}>
                      {outcomeLabel(outcome)}
                    </div>
                  ) : null}
                </div>
                {!selecting ? (
                  <div className="mk-file-row-actions">
                    {file.present ? (
                      <>
                        <Button small onClick={() => openFile(file)}>View</Button>
                        <Button variant="ghost" small disabled={busy} onClick={() => { void downloadRows([file]); }}>
                          Save
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="mk-file-row-removed">removed</span>
                        <RequestAgainAction file={file} onRestored={refresh} />
                      </>
                    )}
                    <Button variant="danger" small onClick={() => reportFile(file)}>
                      Report
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {result ? (
        <div className={`mk-box ${result.failedCount > 0 ? 'is-warning' : 'is-success'}`}>
          {result.downloadedCount} of {result.total} download{result.total === 1 ? '' : 's'} started
          {result.skippedCount > 0 ? ` · ${result.skippedCount} skipped` : ''}
        </div>
      ) : null}

      <HonestNotice>
        Downloads is one browser for files already represented by verified community messages saved here.
        On-browser versus removed is checked live against local storage; removed files are never saveable.
      </HonestNotice>
      <HonestNotice>
        View opens only render-safe file types inline. Scriptable or unknown types are downloaded instead
        of previewed on the app origin. Nothing is fetched from a fallback server.
      </HonestNotice>

      {communities.length === 0 && !checking ? (
        <div className="mk-muted mk-settings-note">Create or join a community before Downloads can list shared files.</div>
      ) : null}
    </div>
  );
}
