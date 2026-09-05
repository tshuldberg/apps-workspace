// Plan 38 Phase 3 (ingest UI, WEB): the multi-file ingest sheet. Picked files are
// sealed one at a time with per-file progress, honest local metadata extraction
// (filename/NFO/EXIF, zero setup), and the within-workspace dedup notice when the
// store reports the sealed blob was already held. Photos: a "Keep photo
// locations" checkbox, DEFAULT OFF -- off rewrites the JPEG bytes to strip EXIF
// GPS before sealing (extractLocalMetadata / D.7), so location never leaves the
// device unless the contributor opts in.

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../shell/Modal';
import { Button } from '../shell/Button';
import { HonestNotice } from '../shell/HonestNotice';
import { extractLocalMetadata } from '../../lib/library-extract-core';
import { LIBRARY_STRINGS, dedupNoticeText } from '../../lib/library-browse-core';
import type { KnownMediaType } from '../../lib/library-metadata-core';
import { useLibrary, type LibraryWorkspaceKind } from './useLibrary';

interface FileProgress {
  name: string;
  status: 'pending' | 'working' | 'added' | 'deduped' | 'error';
  error?: string;
}

export function IngestModal({
  channelId,
  workspaceId,
  workspaceKind,
  mediaType,
  files,
  onClose,
  onDone,
}: {
  channelId: string;
  workspaceId: string;
  workspaceKind: LibraryWorkspaceKind;
  mediaType: KnownMediaType;
  files: File[];
  onClose: () => void;
  onDone: () => void;
}): React.ReactElement {
  const lib = useLibrary();
  const [rows, setRows] = useState<FileProgress[]>(() => files.map((f) => ({ name: f.name, status: 'pending' })));
  const [keepLocations, setKeepLocations] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const startedRef = useRef(false);

  const run = async (): Promise<void> => {
    setRunning(true);
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i]!;
      setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: 'working' } : r)));
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const local = extractLocalMetadata({
          fileName: file.name,
          bytes,
          mediaType,
          preserveLocation: mediaType === 'photo' ? keepLocations : undefined,
        });
        const result = await lib.addFile({
          channelId,
          workspaceId,
          bytes: local.rewrittenBytes ?? bytes,
          title: local.title,
          sortTitle: local.sortTitle,
          year: local.year,
          durationMs: local.durationMs,
          mimeType: file.type || null,
          metadata: local.metadata,
          metadataSource: local.metadataSource,
        });
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: result.deduped ? 'deduped' : 'added' } : r)),
        );
      } catch (e) {
        setRows((prev) =>
          prev.map((r, idx) => (idx === i ? { ...r, status: 'error', error: e instanceof Error ? e.message : 'Failed' } : r)),
        );
      }
    }
    setRunning(false);
    setFinished(true);
    onDone();
  };

  // Photos need the location choice up front, so those wait for the button.
  // Everything else can start immediately.
  useEffect(() => {
    if (startedRef.current) return;
    if (mediaType === 'photo') return;
    startedRef.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dedupNotice = dedupNoticeText(workspaceKind);
  const anyDeduped = rows.some((r) => r.status === 'deduped');

  return (
    <Modal title={`${LIBRARY_STRINGS.addToLibrary} · ${files.length} ${files.length === 1 ? 'file' : 'files'}`} onClose={onClose} locked={running}>
      <div className="mk-lib-ingest">
        {mediaType === 'photo' ? (
          <label className="mk-lib-ingest-consent">
            <input
              type="checkbox"
              checked={keepLocations}
              disabled={running || finished}
              onChange={(e) => setKeepLocations(e.currentTarget.checked)}
            />
            <span>
              {LIBRARY_STRINGS.keepPhotoLocations}
              <span className="mk-muted"> — off strips GPS from each photo on this device before sealing.</span>
            </span>
          </label>
        ) : null}

        <ul className="mk-lib-ingest-list">
          {rows.map((row, idx) => (
            <li key={`${row.name}-${idx}`} className="mk-lib-ingest-row">
              <span className="mk-lib-ingest-name">{row.name}</span>
              <span className={`mk-pill ${row.status === 'error' ? 'is-error' : row.status === 'deduped' ? 'is-info' : row.status === 'added' ? 'is-success' : ''}`}>
                {row.status === 'pending' ? 'Waiting'
                  : row.status === 'working' ? 'Sealing…'
                  : row.status === 'added' ? 'Added'
                  : row.status === 'deduped' ? dedupNotice
                  : row.error ?? 'Failed'}
              </span>
            </li>
          ))}
        </ul>

        {anyDeduped ? (
          <HonestNotice>{dedupNotice}: a matching file was already sealed here, so its bytes were reused (no second copy on disk).</HonestNotice>
        ) : null}

        <div className="mk-lib-ingest-actions">
          {mediaType === 'photo' && !startedRef.current && !finished ? (
            <Button
              disabled={running}
              onClick={() => {
                startedRef.current = true;
                void run();
              }}
            >
              {running ? 'Adding…' : LIBRARY_STRINGS.addToLibrary}
            </Button>
          ) : null}
          <Button variant="ghost" disabled={running} onClick={onClose}>
            {finished ? 'Done' : 'Close'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
