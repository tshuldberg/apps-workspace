// Plan 38 Phase 6 (WEB): in-app A/V playback from the sealed copy on THIS device.
//
// Honest by construction: it opens the verified local bytes, sniffs the real
// container, and plays only what the browser can decode -- fragmented MP4/WebM via
// MSE, small/plain files via an object URL, and the exact download-or-mobile copy
// for everything else (e.g. MKV). Nothing is streamed from a server; a NOT-LOCAL
// item shows the honest fetch state and never a fake buffering spinner. Resume,
// progress save, MediaSession transport controls, and full teardown are wired.

import { useEffect, useRef, useState } from 'react';
import { Modal } from '../shell/Modal';
import { HonestNotice } from '../shell/HonestNotice';
import { Button } from '../shell/Button';
import { bytesToBlob } from '../format';
import type { LibraryItemEvent } from '../../lib/library-data-core';
import {
  PLAYBACK_SNIFF_BYTES,
  UNSUPPORTED_PLAYBACK_COPY,
  playbackPlan,
  type PlaybackPlan,
} from '../../lib/library-playback';
import { useLibrary } from './useLibrary';

type LoadState = 'loading' | 'notlocal' | 'ready' | 'unsupported' | 'error';

const MSE_APPEND_CHUNK = 4 * 1024 * 1024; // 4 MB
const PROGRESS_SAVE_INTERVAL_MS = 5000;

function appendChunk(sb: SourceBuffer, chunk: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      sb.removeEventListener('updateend', onEnd);
      sb.removeEventListener('error', onErr);
    };
    const onEnd = (): void => { cleanup(); resolve(); };
    const onErr = (): void => { cleanup(); reject(new Error('SourceBuffer append failed')); };
    sb.addEventListener('updateend', onEnd);
    sb.addEventListener('error', onErr);
    const copy = new Uint8Array(chunk.length);
    copy.set(chunk);
    sb.appendBuffer(copy.buffer);
  });
}

export function LibraryPlayer({
  item,
  workspaceId,
  onClose,
  onDownload,
}: {
  item: LibraryItemEvent;
  workspaceId: string;
  onClose: () => void;
  onDownload: () => void;
}): React.ReactElement {
  const lib = useLibrary();
  const [state, setState] = useState<LoadState>('loading');
  const [plan, setPlan] = useState<PlaybackPlan | null>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const pendingBytesRef = useRef<Uint8Array | null>(null);
  const lastSavedRef = useRef(0);

  const saveProgress = (positionMs: number, completed: boolean): void => {
    lib.setProgress(item.id, workspaceId, Math.max(0, Math.round(positionMs)), completed);
  };

  // Load the verified local bytes and decide how to play them.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const bytes = await lib.openContent(item);
        if (cancelled) return;
        if (!bytes) { setState('notlocal'); return; }
        const decided = playbackPlan({
          header: bytes.subarray(0, PLAYBACK_SNIFF_BYTES),
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes ?? bytes.length,
        });
        setPlan(decided);
        if (decided.mode === 'unsupported') { setState('unsupported'); return; }
        // Hand the bytes to the wiring effect, which runs once the element mounts.
        pendingBytesRef.current = bytes;
        setState('ready');
      } catch {
        if (!cancelled) setState('error');
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  // Wire the media element once it is mounted (state === 'ready').
  useEffect(() => {
    if (state !== 'ready' || !plan) return;
    const media = mediaRef.current;
    const bytes = pendingBytesRef.current;
    if (!media || !bytes) return;
    let disposed = false;

    const resume = (): void => {
      const saved = lib.getProgress(item.id);
      if (saved && !saved.completed && saved.positionMs > 1500) {
        try { media.currentTime = saved.positionMs / 1000; } catch { /* seek not ready yet */ }
      }
    };
    media.addEventListener('loadedmetadata', resume, { once: true });

    if (plan.mode === 'object_url') {
      const url = URL.createObjectURL(bytesToBlob(bytes, item.mimeType ?? 'application/octet-stream'));
      objectUrlRef.current = url;
      media.src = url;
    } else if (plan.mode === 'mse' && plan.mseMimeType) {
      void (async () => {
        try {
          const ms = new MediaSource();
          mediaSourceRef.current = ms;
          const url = URL.createObjectURL(ms);
          objectUrlRef.current = url;
          media.src = url;
          await new Promise<void>((resolve) => {
            ms.addEventListener('sourceopen', () => resolve(), { once: true });
          });
          if (disposed) return;
          const sb = ms.addSourceBuffer(plan.mseMimeType!);
          for (let off = 0; off < bytes.length && !disposed; off += MSE_APPEND_CHUNK) {
            await appendChunk(sb, bytes.subarray(off, Math.min(off + MSE_APPEND_CHUNK, bytes.length)));
          }
          if (!disposed && ms.readyState === 'open') ms.endOfStream();
        } catch {
          if (!disposed) setState('error');
        }
      })();
    }

    const onTime = (): void => {
      const now = Date.now();
      if (now - lastSavedRef.current >= PROGRESS_SAVE_INTERVAL_MS) {
        lastSavedRef.current = now;
        saveProgress(media.currentTime * 1000, false);
      }
    };
    const onPause = (): void => saveProgress(media.currentTime * 1000, false);
    const onEnded = (): void => saveProgress(0, true);
    media.addEventListener('timeupdate', onTime);
    media.addEventListener('pause', onPause);
    media.addEventListener('ended', onEnded);

    // MediaSession transport controls (audio especially).
    const nav = navigator as Navigator & { mediaSession?: MediaSession };
    if (nav.mediaSession && typeof MediaMetadata !== 'undefined') {
      try {
        const meta = JSON.parse(item.metadataJson || '{}') as Record<string, unknown>;
        nav.mediaSession.metadata = new MediaMetadata({
          title: item.title,
          artist: typeof meta.artist === 'string' ? meta.artist : '',
          album: typeof meta.album === 'string' ? meta.album : '',
        });
        nav.mediaSession.setActionHandler('play', () => void media.play());
        nav.mediaSession.setActionHandler('pause', () => media.pause());
        nav.mediaSession.setActionHandler('seekbackward', (d) => {
          media.currentTime = Math.max(0, media.currentTime - (d.seekOffset ?? 10));
        });
        nav.mediaSession.setActionHandler('seekforward', (d) => {
          media.currentTime = media.currentTime + (d.seekOffset ?? 10);
        });
        nav.mediaSession.setActionHandler('seekto', (d) => {
          if (typeof d.seekTime === 'number') media.currentTime = d.seekTime;
        });
      } catch { /* MediaSession is best-effort */ }
    }

    return () => {
      disposed = true;
      // Flush the final position before teardown.
      if (!media.ended) saveProgress(media.currentTime * 1000, false);
      media.removeEventListener('timeupdate', onTime);
      media.removeEventListener('pause', onPause);
      media.removeEventListener('ended', onEnded);
      try { media.pause(); } catch { /* ignore */ }
      const ms = mediaSourceRef.current;
      if (ms && ms.readyState === 'open') { try { ms.endOfStream(); } catch { /* ignore */ } }
      mediaSourceRef.current = null;
      media.removeAttribute('src');
      try { media.load(); } catch { /* ignore */ }
      if (objectUrlRef.current) { URL.revokeObjectURL(objectUrlRef.current); objectUrlRef.current = null; }
      if (nav.mediaSession) {
        for (const a of ['play', 'pause', 'seekbackward', 'seekforward', 'seekto'] as const) {
          try { nav.mediaSession.setActionHandler(a, null); } catch { /* ignore */ }
        }
        nav.mediaSession.metadata = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, plan]);

  return (
    <Modal title={item.title} onClose={onClose}>
      <div className="mk-lib-player">
        {state === 'loading' ? <p className="mk-muted">Opening the sealed copy on this device…</p> : null}

        {state === 'notlocal' ? (
          <HonestNotice>
            This file is not on this device yet. Nothing was fetched from a server. Sync with a member
            who holds it, or open it on the Meerkat mobile app.
          </HonestNotice>
        ) : null}

        {state === 'unsupported' ? (
          <div className="mk-lib-player-unsupported">
            <HonestNotice>{UNSUPPORTED_PLAYBACK_COPY}</HonestNotice>
            <Button onClick={onDownload}>Download</Button>
          </div>
        ) : null}

        {state === 'error' ? (
          <HonestNotice>This file could not be decoded in the browser. Download it or play it on mobile.</HonestNotice>
        ) : null}

        {state === 'ready' && plan?.element === 'video' ? (
          <video
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            className="mk-lib-player-media"
            controls
            playsInline
          />
        ) : null}
        {state === 'ready' && plan?.element === 'audio' ? (
          <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} className="mk-lib-player-audio" controls />
        ) : null}

        {state === 'ready' ? (
          <p className="mk-muted mk-lib-player-note">{plan?.reason}</p>
        ) : null}
      </div>
    </Modal>
  );
}
