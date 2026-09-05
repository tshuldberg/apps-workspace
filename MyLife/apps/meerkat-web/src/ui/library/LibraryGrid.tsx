// Plan 38 Phase 5 (WEB): the windowed library grid. It virtualizes the item grid
// so a 10k-item library scrolls smoothly -- only the visible rows (+ overscan)
// mount, with spacer divs holding the scroll height (computeGridWindow does the
// pure geometry, unit-tested). The card shape drives the column count + row
// height; list shape is a single column.

import { useLayoutEffect, useRef, useState } from 'react';
import { computeGridWindow, type LibraryCardShape } from '../../lib/library-browse-core';
import type { ResolvedLibraryItem } from '../../lib/library-data-core';

const SHAPE_LAYOUT: Record<LibraryCardShape, { minColumnPx: number; rowHeightPx: number }> = {
  poster: { minColumnPx: 150, rowHeightPx: 260 },
  album: { minColumnPx: 160, rowHeightPx: 210 },
  masonry: { minColumnPx: 170, rowHeightPx: 190 },
  list: { minColumnPx: 9999, rowHeightPx: 68 },
};

export function LibraryGrid({
  items,
  shape,
  renderItem,
}: {
  items: readonly ResolvedLibraryItem[];
  shape: LibraryCardShape;
  renderItem: (item: ResolvedLibraryItem) => React.ReactNode;
}): React.ReactElement {
  const layout = SHAPE_LAYOUT[shape];
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportH: 600, width: 900 });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = (): void =>
      setMetrics((prev) => ({ ...prev, viewportH: el.clientHeight, width: el.clientWidth }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns = shape === 'list' ? 1 : Math.max(1, Math.floor(metrics.width / layout.minColumnPx));
  const window = computeGridWindow({
    itemCount: items.length,
    columns,
    rowHeightPx: layout.rowHeightPx,
    scrollTopPx: metrics.scrollTop,
    viewportHeightPx: metrics.viewportH,
    overscanRows: 2,
  });
  const visible = items.slice(window.startIndex, window.endIndex);

  return (
    <div
      ref={scrollRef}
      className="mk-lib-grid-scroll"
      onScroll={(e) => setMetrics((prev) => ({ ...prev, scrollTop: e.currentTarget.scrollTop }))}
    >
      <div style={{ height: window.topSpacerPx }} aria-hidden />
      <div
        className={`mk-lib-grid is-${shape}`}
        style={shape === 'list' ? undefined : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {visible.map((item) => (
          <div key={item.event.id}>{renderItem(item)}</div>
        ))}
      </div>
      <div style={{ height: window.bottomSpacerPx }} aria-hidden />
    </div>
  );
}
