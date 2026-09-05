// Plan 38 amendment C.6 (MOBILE): the photo library Timeline segment. Renders the
// pure buildPhotoTimeline grouping (year -> month -> day) as a SectionList: one
// section per calendar day (newest first), a coarser month header when the month
// changes, and the honest "No capture date" bucket last. Photos inside a day lay
// out as a 3-up grid of the same cheap poster cells the main grid uses (no full
// cover decode), so a large photo library scrolls. Every date comes from a real
// EXIF capture date; nothing here fabricates one.

import { useMemo } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MkColors } from '../../theme/tokens';
import { useMkStyles } from '../../providers/AppThemeProvider';
import type { ResolvedLibraryItem } from '../../data/library-data-core';
import { buildPhotoTimeline, type TimelineDaySection } from '../../data/photo-timeline-core';
import { LibraryItemPoster } from './LibraryItemPoster';

const COLUMNS = 3;

interface TimelineRow {
  rowKey: string;
  items: ResolvedLibraryItem[];
}

interface TimelineListSection {
  key: string;
  dayLabel: string;
  monthLabel: string | null;
  showMonth: boolean;
  data: TimelineRow[];
}

function chunk(items: readonly ResolvedLibraryItem[], size: number): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size);
    rows.push({ rowKey: slice.map((it) => it.event.id).join('|'), items: slice });
  }
  return rows;
}

function toListSections(sections: readonly TimelineDaySection[]): TimelineListSection[] {
  let lastMonth: string | null = null;
  return sections.map((s) => {
    const showMonth = s.hasDate && s.monthLabel !== null && s.monthLabel !== lastMonth;
    if (s.hasDate) lastMonth = s.monthLabel;
    return {
      key: s.key,
      dayLabel: s.dayLabel,
      monthLabel: s.monthLabel,
      showMonth,
      data: chunk(s.items, COLUMNS),
    };
  });
}

export function PhotoTimelineSegment({
  items,
  heldSet,
  isCommunityLibrary,
}: {
  items: readonly ResolvedLibraryItem[];
  heldSet: Set<string>;
  isCommunityLibrary: boolean;
}) {
  const styles = useMkStyles(makeStyles);
  const router = useRouter();
  const listSections = useMemo(() => toListSections(buildPhotoTimeline(items)), [items]);

  return (
    <SectionList
      sections={listSections}
      keyExtractor={(row) => row.rowKey}
      contentContainerStyle={styles.content}
      stickySectionHeadersEnabled={false}
      renderSectionHeader={({ section }) => (
        <View style={styles.header}>
          {section.showMonth && section.monthLabel ? (
            <Text style={styles.monthLabel}>{section.monthLabel}</Text>
          ) : null}
          <Text style={styles.dayLabel}>{section.dayLabel}</Text>
        </View>
      )}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.items.map((it) => (
            <LibraryItemPoster
              key={it.event.id}
              item={it}
              shape="masonry"
              columns={COLUMNS}
              held={heldSet.has(it.event.contentCid)}
              communityContext={isCommunityLibrary}
              onPress={() => router.push(`/library/item/${it.event.id}`)}
            />
          ))}
          {/* Keep the last row left-aligned when it is short. */}
          {row.items.length < COLUMNS
            ? Array.from({ length: COLUMNS - row.items.length }).map((_, i) => (
                <View key={`spacer-${i}`} style={styles.spacer} />
              ))
            : null}
        </View>
      )}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
    />
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  content: { padding: 12, paddingBottom: 120 },
  header: { paddingTop: 14, paddingBottom: 6, paddingHorizontal: 4, gap: 2 },
  monthLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  dayLabel: { color: c.text, fontSize: 15, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: 4, marginBottom: 6 },
  spacer: { flex: 1 / COLUMNS },
});
