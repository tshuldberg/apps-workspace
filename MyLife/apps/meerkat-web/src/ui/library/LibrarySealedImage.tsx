// Plan 38 Phase 5 (WEB): render a library item's image from LOCAL sealed blocks.
// It opens the verified bytes through the hook (openContent / openCover), makes an
// object URL, and revokes it on unmount. HONEST: when the bytes are not on this
// device (or will not decrypt for this identity), it renders the placeholder
// poster -- never a fabricated or remote image. Only inline-render-safe image
// types are shown; anything else falls back to the placeholder.

import { useEffect, useRef, useState } from 'react';
import { bytesToBlob, isInlineRenderSafeMimeType } from '../format';
import type { LibraryItemEvent } from '../../lib/library-data-core';
import { useLibrary } from './useLibrary';

export function LibrarySealedImage({
  item,
  source,
  alt,
  className,
}: {
  item: LibraryItemEvent;
  /** 'cover' opens the poster blob; 'content' opens the file itself (photo type). */
  source: 'cover' | 'content';
  alt: string;
  className?: string;
}): React.ReactElement {
  const lib = useLibrary();
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const mime = source === 'content' ? item.mimeType ?? '' : 'image/*';
    // Content is only renderable inline when it is itself a safe image type.
    if (source === 'content' && !isInlineRenderSafeMimeType(item.mimeType ?? '')) {
      setUrl(null);
      return;
    }
    void (async () => {
      const bytes = source === 'cover' ? await lib.openCover(item) : await lib.openContent(item);
      if (cancelled) return;
      if (!bytes) {
        setUrl(null);
        return;
      }
      const objectUrl = URL.createObjectURL(bytesToBlob(bytes, mime || 'image/*'));
      urlRef.current = objectUrl;
      setUrl(objectUrl);
    })();
    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.contentCid, item.coverCid, source]);

  if (!url) {
    return (
      <div className={`mk-lib-poster-fallback ${className ?? ''}`} aria-hidden>
        <span>{(item.title || '?').trim().charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return <img className={`mk-lib-poster-img ${className ?? ''}`} src={url} alt={alt} loading="lazy" />;
}
