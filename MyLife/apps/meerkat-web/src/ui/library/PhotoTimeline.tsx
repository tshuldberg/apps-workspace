// Plan 38 amendment C.6 (WEB): the photo library Timeline view. Renders the pure
// buildPhotoTimeline grouping (year -> month -> day) as a scrollable list of day
// sections, newest day first, a coarser month header when the month changes, and
// the honest "No capture date" bucket last. The web app ships NO map (documented
// in capability-status); this timeline is the web half of C.6. Every date comes
// from a real EXIF capture date; the no-date bucket never fabricates one.

import { useMemo } from 'react';
import { buildPhotoTimeline, type TimelineDaySection } from '../../lib/photo-timeline-core';
import type { ResolvedLibraryItem } from '../../lib/library-data-core';
import { LibraryPosterCard } from './LibraryPosterCard';

interface TimelineListSection extends TimelineDaySection {
  showMonth: boolean;
}

function withMonthFlags(sections: readonly TimelineDaySection[]): TimelineListSection[] {
  let lastMonth: string | null = null;
  return sections.map((s) => {
    const showMonth = s.hasDate && s.monthLabel !== null && s.monthLabel !== lastMonth;
    if (s.hasDate) lastMonth = s.monthLabel;
    return { ...s, showMonth };
  });
}

export function PhotoTimeline({
  items,
  onOpen,
}: {
  items: readonly ResolvedLibraryItem[];
  onOpen: (itemId: string) => void;
}): React.ReactElement {
  const sections = useMemo(() => withMonthFlags(buildPhotoTimeline(items)), [items]);

  return (
    <div className="mk-lib-timeline mk-main-scroll">
      {sections.map((section) => (
        <section key={section.key} className="mk-lib-timeline-section">
          {section.showMonth && section.monthLabel ? (
            <h2 className="mk-lib-timeline-month">{section.monthLabel}</h2>
          ) : null}
          <h3 className="mk-lib-timeline-day">{section.dayLabel}</h3>
          <div className="mk-lib-grid is-masonry" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {section.items.map((item) => (
              <div key={item.event.id}>
                <LibraryPosterCard item={item} onOpen={() => onOpen(item.event.id)} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
