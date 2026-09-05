// Plan 38 Phase 5 (WEB): one row in a list-shape library (documents / custom).

import { formatBytes } from '../format';
import { itemMetadata } from '../../lib/library-browse-core';
import type { ResolvedLibraryItem } from '../../lib/library-data-core';
import { MEDIA_TYPE_META } from './media-meta';

export function LibraryListRow({
  item,
  onOpen,
}: {
  item: ResolvedLibraryItem;
  onOpen: () => void;
}): React.ReactElement {
  const meta = itemMetadata(item);
  const pages = typeof meta['pages'] === 'number' ? (meta['pages'] as number) : null;
  const parts = [
    item.event.year ? String(item.event.year) : '',
    pages ? `${pages} pages` : '',
    item.event.sizeBytes ? formatBytes(item.event.sizeBytes) : '',
  ].filter(Boolean);
  return (
    <button type="button" className="mk-lib-list-item" onClick={onOpen} title={item.event.title}>
      <span className="mk-lib-list-icon" aria-hidden>{MEDIA_TYPE_META[item.mediaType].icon}</span>
      <span className="mk-lib-list-text">
        <span className="mk-lib-list-name">{item.event.title}</span>
        {parts.length > 0 ? <span className="mk-muted">{parts.join(' · ')}</span> : null}
      </span>
    </button>
  );
}
