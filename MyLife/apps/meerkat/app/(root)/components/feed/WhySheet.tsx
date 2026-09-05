// Plan 32 T1.2 (design decision 2): the "Why am I seeing this?" sheet.
//
// The explainability that used to sit on every card (kind, audience, reason)
// moves here, one tap behind the context-line `i`. Nothing about the ranking
// becomes less inspectable: the REAL feed-core reason string, the item kind, its
// audience rule line, and the exact source toggle that controls it all render
// here, with a jump to the filter sheet. No new claims, no fabricated data.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SlidersHorizontal, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import { AudienceRuleSummary } from '../AudienceRule';
import { FEED_CONTROL_LABELS, type FeedControls, type FeedItem } from '../../data/feed-core';
import { FEED_KIND_CONTROL, FEED_KIND_LABEL } from '../../data/feed-view-core';

export function WhySheet({
  item,
  controls,
  onClose,
  onOpenFilters,
  onDismissed,
}: {
  /** The item being explained, or null when the sheet is closed. */
  item: FeedItem | null;
  controls: FeedControls;
  onClose: () => void;
  onOpenFilters: () => void;
  /**
   * Fires after the native dismissal completes (iOS only; Modal onDismiss).
   * The screen flushes any queued cross-modal action here so it never presents
   * or navigates while this Modal is still tearing down.
   */
  onDismissed?: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const controlKey = item ? FEED_KIND_CONTROL[item.kind] : null;
  const controlOn = controlKey ? controls[controlKey] : false;

  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismissed}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Text style={styles.title}>Why am I seeing this?</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <X size={18} color={c.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          {item ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Text style={styles.reason}>{item.reason}</Text>

              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Kind</Text>
                <View style={styles.kindPill}>
                  <Text style={styles.kindPillText}>{FEED_KIND_LABEL[item.kind]}</Text>
                </View>
              </View>

              <AudienceRuleSummary rule={item.audienceRule} />

              {controlKey ? (
                <View style={styles.sourceBox}>
                  <Text style={styles.sourceLabel}>Controlled by the source toggle</Text>
                  <Text style={styles.sourceValue}>
                    {FEED_CONTROL_LABELS[controlKey]} is {controlOn ? 'on' : 'off'}.
                  </Text>
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open feed filters"
                onPress={onOpenFilters}
                style={({ pressed }) => [styles.filterLink, pressed && styles.pressed]}
              >
                <SlidersHorizontal size={16} color={c.accent} strokeWidth={2} />
                <Text style={styles.filterLinkText}>Open feed filters</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: MK_RADIUS.lg,
    borderTopRightRadius: MK_RADIUS.lg,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: MK_RADIUS.pill,
    backgroundColor: c.borderStrong,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: c.text, fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 12, paddingBottom: 8 },
  reason: { color: c.text, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaLabel: { color: c.textSecondary, fontSize: 13, fontWeight: '700' },
  kindPill: {
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  kindPillText: { color: c.textSecondary, fontSize: 11.5, fontWeight: '800' },
  sourceBox: {
    backgroundColor: c.surfaceHigh,
    borderRadius: MK_RADIUS.md,
    padding: 11,
    gap: 3,
  },
  sourceLabel: { color: c.textSecondary, fontSize: 12, fontWeight: '700' },
  sourceValue: { color: c.text, fontSize: 13.5, lineHeight: 19 },
  filterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  filterLinkText: { color: c.accent, fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.6 },
});
