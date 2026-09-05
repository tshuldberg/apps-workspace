// Plan 38 Phase 6 (WEB): the sealed EPUB reader. Opens verified LOCAL bytes,
// unzips under hard caps, and renders each spine chapter inside a FULLY sandboxed,
// network-blocked iframe (sandbox="", CSP default-src 'none'). epub bytes are
// ATTACKER-CONTROLLED, so: no XML parser (no XXE), scripts/handlers stripped,
// every external URL neutralized, and only in-archive assets inlined as data:
// URIs. A fully sandboxed iframe has an opaque origin we cannot read back, so
// resume is at chapter (spine-index) granularity -- the honest, secure trade.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../shell/Modal';
import { HonestNotice } from '../shell/HonestNotice';
import { Button } from '../shell/Button';
import type { LibraryItemEvent } from '../../lib/library-data-core';
import { openZip, type UnzipCaps, type ZipArchive } from '../../lib/library-archive';
import {
  EPUB_CONTAINER_PATH,
  EPUB_IFRAME_SANDBOX,
  buildSandboxedChapter,
  decodeReaderPosition,
  encodeReaderPosition,
  inlineResourceUrls,
  parseContainerRootfile,
  parseOpfSpine,
  stripActiveContent,
} from '../../lib/library-reader-core';
import { useLibrary } from './useLibrary';

const EPUB_CAPS: UnzipCaps = {
  maxEntries: 4096,
  maxTotalUncompressedBytes: 256 * 1024 * 1024, // 256 MB
  maxEntryUncompressedBytes: 32 * 1024 * 1024, // 32 MB
  rejectNestedArchives: true,
};

const ASSET_MIME: Record<string, string> = {
  css: 'text/css', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ttf: 'font/ttf',
  otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2',
};

function extOf(name: string): string { return (name.split('.').pop() ?? '').toLowerCase(); }
function isChapter(name: string): boolean {
  const e = extOf(name);
  return e === 'xhtml' || e === 'html' || e === 'htm';
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
  return `data:${mime};base64,${btoa(binary)}`;
}

type LoadState = 'loading' | 'notlocal' | 'ready' | 'error';

export function EpubReader({
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
  const [spine, setSpine] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [srcdoc, setSrcdoc] = useState('');
  const archiveRef = useRef<ZipArchive | null>(null);
  const assetsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bytes = await lib.openContent(item);
        if (cancelled) return;
        if (!bytes) { setState('notlocal'); return; }
        const arc = await openZip(bytes, EPUB_CAPS);
        if (cancelled) return;
        const td = new TextDecoder();
        const containerEntry = arc.entries.find((e) => e.name === EPUB_CONTAINER_PATH);
        if (!containerEntry) throw new Error('Not a valid EPUB (missing container.xml).');
        const opfPath = parseContainerRootfile(td.decode(await arc.read(EPUB_CONTAINER_PATH)));
        if (!opfPath) throw new Error('Not a valid EPUB (no package document).');
        const { hrefs } = parseOpfSpine(opfPath, td.decode(await arc.read(opfPath)));
        if (hrefs.length === 0) throw new Error('This EPUB has no readable chapters.');

        // Pre-decode in-archive assets (css/images/fonts) to data: URIs so chapter
        // inlining is synchronous and only in-archive bytes ever appear.
        const assets = new Map<string, string>();
        for (const entry of arc.entries) {
          if (isChapter(entry.name)) continue;
          const mime = ASSET_MIME[extOf(entry.name)];
          if (!mime) continue;
          try { assets.set(entry.name, bytesToDataUrl(await arc.read(entry.name), mime)); } catch { /* skip */ }
        }
        if (cancelled) return;
        archiveRef.current = arc;
        assetsRef.current = assets;
        setSpine(hrefs);
        const saved = lib.getProgress(item.id);
        const start = saved ? decodeReaderPosition('epub', saved.positionMs).index : 0;
        setIndex(Math.min(Math.max(0, start), hrefs.length - 1));
        setState('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'This book could not be opened.');
        setState('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Build the sandboxed chapter document for the current spine index.
  useEffect(() => {
    if (state !== 'ready' || spine.length === 0) return;
    let cancelled = false;
    void (async () => {
      const arc = archiveRef.current;
      if (!arc) return;
      try {
        const chapterPath = spine[index]!;
        const raw = new TextDecoder().decode(await arc.read(chapterPath));
        if (cancelled) return;
        const sanitized = stripActiveContent(raw);
        const inlined = inlineResourceUrls(sanitized, chapterPath, (p) => assetsRef.current.get(p) ?? null);
        // Keep only the <body> so our wrapper's CSP/meta head governs the document.
        const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(inlined);
        const body = bodyMatch ? bodyMatch[1]! : inlined;
        setSrcdoc(buildSandboxedChapter(body).srcdoc);
      } catch {
        if (!cancelled) setSrcdoc(buildSandboxedChapter('<p>This chapter could not be rendered.</p>').srcdoc);
      }
    })();
    return () => { cancelled = true; };
  }, [state, index, spine]);

  // Persist resume position as chapters turn.
  useEffect(() => {
    if (state !== 'ready' || spine.length === 0) return;
    lib.setProgress(item.id, workspaceId, encodeReaderPosition('epub', { index, fraction: 0 }), index >= spine.length - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, index, spine.length]);

  const counter = useMemo(() => (spine.length ? `${index + 1} / ${spine.length}` : ''), [index, spine.length]);

  return (
    <Modal title={item.title} onClose={onClose}>
      <div className="mk-lib-reader mk-lib-reader-epub">
        {state === 'loading' ? <p className="mk-muted">Opening the sealed copy on this device…</p> : null}
        {state === 'notlocal' ? (
          <HonestNotice>This book is not on this device yet. Nothing was fetched from a server.</HonestNotice>
        ) : null}
        {state === 'error' ? <HonestNotice>{error}</HonestNotice> : null}

        {state === 'ready' ? (
          <>
            <iframe
              className="mk-lib-reader-frame"
              title={`${item.title} — chapter ${index + 1}`}
              sandbox={EPUB_IFRAME_SANDBOX}
              srcDoc={srcdoc}
            />
            <div className="mk-lib-reader-controls">
              <Button variant="ghost" small onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0}>
                ← Prev
              </Button>
              <span className="mk-lib-reader-counter">{counter}</span>
              <Button
                variant="ghost"
                small
                onClick={() => setIndex((i) => Math.min(i + 1, spine.length - 1))}
                disabled={index >= spine.length - 1}
              >
                Next →
              </Button>
            </div>
            <HonestNotice>
              Rendered from the sealed copy on this device in a locked-down sandbox. Nothing is loaded from a server.
            </HonestNotice>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
