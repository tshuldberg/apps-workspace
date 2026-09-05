// Plan 38 Phase 5 (WEB): one poster/cover card in a grid or strip. It shows the
// item's cover art when a cover blob is local (movies/books), the image itself
// for a photo library, or a placeholder poster otherwise. An optional resume bar
// reflects REAL local progress only.

import { itemMetadata, type ItemProgress } from '../../lib/library-browse-core';
import type { ResolvedLibraryItem } from '../../lib/library-data-core';
import { LibrarySealedImage } from './LibrarySealedImage';

export function LibraryPosterCard({
  item,
  onOpen,
  progress,
}: {
  item: ResolvedLibraryItem;
  onOpen: () => void;
  progress?: ItemProgress;
}): React.ReactElement {
  const meta = itemMetadata(item);
  const subtitle = posterSubtitle(item, meta);
  // Photos have no separate cover: the content IS the image. Everything else
  // shows the sealed cover blob, falling back to the placeholder poster.
  const source = item.mediaType === 'photo' && !item.event.coverCid ? 'content' : 'cover';
  const pct = progress && progress.positionMs > 0 && item.event.durationMs
    ? Math.min(100, Math.round((progress.positionMs / item.event.durationMs) * 100))
    : 0;

  return (
    <button type="button" className="mk-lib-poster" onClick={onOpen} title={item.event.title}>
      <div className="mk-lib-poster-frame">
        <LibrarySealedImage item={item.event} source={source} alt={item.event.title} />
        {pct > 0 ? (
          <div className="mk-lib-poster-progress" aria-hidden>
            <div className="mk-lib-poster-progress-fill" style={{ width: `${pct}%` }} />
          </div>
        ) : null}
      </div>
      <div className="mk-lib-poster-title">{item.event.title}</div>
      {subtitle ? <div className="mk-lib-poster-sub mk-muted">{subtitle}</div> : null}
    </button>
  );
}

function posterSubtitle(item: ResolvedLibraryItem, meta: Record<string, unknown>): string {
  if (item.mediaType === 'music') {
    const artist = typeof meta['artist'] === 'string' ? (meta['artist'] as string) : '';
    return artist;
  }
  if (item.event.year) return String(item.event.year);
  return '';
}
