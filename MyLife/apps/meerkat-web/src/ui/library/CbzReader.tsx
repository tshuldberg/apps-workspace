// Plan 38 Phase 6 (WEB): the sealed CBZ reader. Opens the verified LOCAL bytes,
// unzips them in memory under hard caps (entry count, total + per-entry bytes,
// nested-archive rejection), and pages the images in natural order. Pages decode
// lazily to `data:` URIs; resume comes from cm_library_progress. Nothing is
// fetched; a NOT-LOCAL item shows the honest state.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../shell/Modal';
import { HonestNotice } from '../shell/HonestNotice';
import { Button } from '../shell/Button';
import type { LibraryItemEvent } from '../../lib/library-data-core';
import { openZip, type UnzipCaps, type ZipArchive } from '../../lib/library-archive';
import { bytesToBlob } from '../format';
import {
  decodeReaderPosition,
  encodeReaderPosition,
  imageMimeForEntry,
  sortImageEntries,
} from '../../lib/library-reader-core';
import { useLibrary } from './useLibrary';

const CBZ_CAPS: UnzipCaps = {
  maxEntries: 4096,
  maxTotalUncompressedBytes: 1024 * 1024 * 1024, // 1 GB
  maxEntryUncompressedBytes: 64 * 1024 * 1024, // 64 MB / page
  rejectNestedArchives: true,
};

type LoadState = 'loading' | 'notlocal' | 'ready' | 'error';

export function CbzReader({
  item,
  workspaceId,
  onClose,
}: {
  item: LibraryItemEvent;
  workspaceId: string;
  onClose: () => void;
}): React.ReactElement {
  const lib = useLibrary();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [pageUrl, setPageUrl] = useState<string | null>(null);
  const archiveRef = useRef<ZipArchive | null>(null);
  const cacheRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bytes = await lib.openContent(item);
        if (cancelled) return;
        if (!bytes) { setState('notlocal'); return; }
        const arc = await openZip(bytes, CBZ_CAPS);
        if (cancelled) return;
        const names = sortImageEntries(arc.entries.map((e) => e.name));
        if (names.length === 0) { setError('No readable pages in this file.'); setState('error'); return; }
        archiveRef.current = arc;
        setPages(names);
        const saved = lib.getProgress(item.id);
        const start = saved ? decodeReaderPosition('cbz', saved.positionMs).index : 0;
        setIndex(Math.min(Math.max(0, start), names.length - 1));
        setState('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'This comic could not be opened.');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Decode the current page lazily to an object URL and cache it.
  useEffect(() => {
    if (state !== 'ready' || pages.length === 0) return;
    let cancelled = false;
    const cached = cacheRef.current.get(index);
    if (cached) { setPageUrl(cached); return; }
    void (async () => {
      const arc = archiveRef.current;
      if (!arc) return;
      try {
        const name = pages[index]!;
        const data = await arc.read(name);
        if (cancelled) return;
        const url = URL.createObjectURL(bytesToBlob(data, imageMimeForEntry(name)));
        cacheRef.current.set(index, url);
        setPageUrl(url);
      } catch {
        if (!cancelled) setPageUrl(null);
      }
    })();
    return () => { cancelled = true; };
  }, [state, index, pages]);

  // Revoke every cached page object URL on unmount.
  useEffect(() => () => {
    for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
    cacheRef.current.clear();
  }, []);

  // Persist resume position as pages turn.
  useEffect(() => {
    if (state !== 'ready' || pages.length === 0) return;
    lib.setProgress(item.id, workspaceId, encodeReaderPosition('cbz', { index }), index >= pages.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, index, pages.length]);

  // Keyboard paging.
  useEffect(() => {
    if (state !== 'ready') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, pages.length - 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, pages.length]);

  const counter = useMemo(() => (pages.length ? `${index + 1} / ${pages.length}` : ''), [index, pages.length]);

  return (
    <Modal title={item.title} onClose={onClose}>
      <div className="mk-lib-reader mk-lib-reader-cbz">
        {state === 'loading' ? <p className="mk-muted">Opening the sealed copy on this device…</p> : null}
        {state === 'notlocal' ? (
          <HonestNotice>
            This comic is not on this device yet. Nothing was fetched from a server.
          </HonestNotice>
        ) : null}
        {state === 'error' ? <HonestNotice>{error}</HonestNotice> : null}

        {state === 'ready' ? (
          <>
            <div className="mk-lib-reader-page">
              {pageUrl ? (
                <img className="mk-lib-reader-img" src={pageUrl} alt={`Page ${index + 1}`} />
              ) : (
                <p className="mk-muted">Decoding page…</p>
              )}
            </div>
            <div className="mk-lib-reader-controls">
              <Button variant="ghost" small onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0}>
                ← Prev
              </Button>
              <span className="mk-lib-reader-counter">{counter}</span>
              <Button
                variant="ghost"
                small
                onClick={() => setIndex((i) => Math.min(i + 1, pages.length - 1))}
                disabled={index >= pages.length - 1}
              >
                Next →
              </Button>
            </div>
            <HonestNotice>Rendered from the sealed copy on this device. Nothing is loaded from a server.</HonestNotice>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
