// Plan 38 Phase 5 (MOBILE): one browse-grid cell. Renders a CHEAP placeholder
// (media glyph + title), never a full cover decode, so a 10k-item grid scrolls
// (D.9: the full cover loads lazily on the detail screen). A small "held" dot
// marks items whose sealed blocks are actually on this device (real store query,
// passed in by the list).

import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Clapperboard, FileText, Image as ImageIcon, Music, Tv, BookOpen, Box } from 'lucide-react-native';
import { MK_RADIUS, type MkColors } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import type { LibraryCardShape } from '../../data/library-metadata-core';
import type { ResolvedLibraryItem } from '../../data/library-data-core';
import { LIBRARY_STRINGS } from '../../data/library-view-core';

const GLYPH: Record<string, typeof Box> = {
  movie: Clapperboard,
  show: Tv,
  music: Music,
  photo: ImageIcon,
  book: BookOpen,
  document: FileText,
  custom: Box,
};

function subtitleFor(item: ResolvedLibraryItem): string | null {
  if (item.event.year) return String(item.event.year);
  try {
    const meta = JSON.parse(item.event.metadataJson) as Record<string, unknown>;
    if (typeof meta.artist === 'string') return meta.artist;
    if (Array.isArray(meta.authors) && typeof meta.authors[0] === 'string') return meta.authors[0];
  } catch {
    // fall through
  }
  return null;
}

export const LibraryItemPoster = memo(function LibraryItemPoster({
  item,
  shape,
  columns,
  held,
  communityContext = false,
  onPress,
}: {
  item: ResolvedLibraryItem;
  shape: LibraryCardShape;
  columns: number;
  held: boolean;
  /** In a COMMUNITY library, a not-held item shows the honest availability line. */
  communityContext?: boolean;
  onPress: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const Glyph = GLYPH[item.mediaType] ?? Box;
  const subtitle = subtitleFor(item);
  // The single honest not-held state for a community item (amendment E). Never
  // shown for a personal library (communityContext false) or a held item.
  const showAvailability = communityContext && !held;

  if (shape === 'list') {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
        <View style={styles.listIcon}>
          <Glyph size={20} color={c.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.listText}>
          <Text style={styles.listTitle} numberOfLines={1}>{item.event.title}</Text>
          {subtitle ? <Text style={styles.listSub} numberOfLines={1}>{subtitle}</Text> : null}
          {showAvailability ? (
            <Text style={styles.availability} numberOfLines={2}>{LIBRARY_STRINGS.availableFromMembers}</Text>
          ) : null}
        </View>
        {held ? <View style={styles.heldDot} accessibilityLabel="Held on this device" /> : null}
      </Pressable>
    );
  }

  const aspect = shape === 'masonry' || shape === 'album' ? 1 : 2 / 3;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.posterCell, { flex: 1 / columns }, pressed && styles.pressed]}
    >
      <View style={[styles.posterArt, { aspectRatio: aspect }]}>
        <Glyph size={30} color={c.textSecondary} strokeWidth={1.4} />
        {held ? <View style={styles.heldBadge} accessibilityLabel="Held on this device" /> : null}
      </View>
      <Text style={styles.posterTitle} numberOfLines={2}>{item.event.title}</Text>
      {subtitle ? <Text style={styles.posterSub} numberOfLines={1}>{subtitle}</Text> : null}
      {showAvailability ? (
        <Text style={styles.availability} numberOfLines={2}>{LIBRARY_STRINGS.availableFromMembers}</Text>
      ) : null}
    </Pressable>
  );
});

const makeStyles = (c: MkColors) => StyleSheet.create({
  pressed: { opacity: 0.7 },
  posterCell: { gap: 5, marginBottom: 6 },
  posterArt: {
    width: '100%',
    borderRadius: MK_RADIUS.md,
    backgroundColor: c.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  posterTitle: { color: c.text, fontSize: 13, fontWeight: '700', lineHeight: 17 },
  posterSub: { color: c.textTertiary, fontSize: 11 },
  availability: { color: c.textSecondary, fontSize: 11, lineHeight: 15 },
  heldBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: c.success,
    borderWidth: 1.5,
    borderColor: c.surface,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  listIcon: {
    width: 40, height: 40, borderRadius: MK_RADIUS.sm,
    backgroundColor: c.surfaceHigh, alignItems: 'center', justifyContent: 'center',
  },
  listText: { flex: 1, minWidth: 0, gap: 2 },
  listTitle: { color: c.text, fontSize: 15, fontWeight: '600' },
  listSub: { color: c.textSecondary, fontSize: 12.5 },
  heldDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.success },
});
