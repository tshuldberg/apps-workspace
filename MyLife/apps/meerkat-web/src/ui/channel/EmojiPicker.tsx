// Plan 30 Phase 4 (web twin of the mobile EmojiPickerSheet): a category-grouped
// emoji grid with a keyword search field, over the shared EMOJI_CATALOG. Rendered
// as a small popover; the caller positions and dismisses it. Props-only.

import { useMemo, useRef, useState, useEffect } from 'react';
import { EMOJI_CATALOG, searchEmojiCatalog } from './emoji-data';

export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const categories = useMemo(() => searchEmojiCatalog(EMOJI_CATALOG, query), [query]);

  // Dismiss on an outside click or Escape (matches the mobile sheet's backdrop).
  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="mk-emoji-picker" ref={rootRef} role="dialog" aria-label="Choose an emoji">
      <input
        className="mk-input mk-emoji-search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emoji"
        aria-label="Search emoji"
        autoFocus
      />
      <div className="mk-emoji-scroll">
        {categories.length === 0 ? (
          <p className="mk-muted mk-emoji-empty">No emoji match that.</p>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="mk-emoji-category">
              <div className="mk-emoji-category-label">{category.label}</div>
              <div className="mk-emoji-grid">
                {category.emoji.map((entry) => (
                  <button
                    key={entry.char}
                    type="button"
                    className="mk-emoji-cell"
                    aria-label={`React with ${entry.name}`}
                    onClick={() => onSelect(entry.char)}
                  >
                    {entry.char}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
