// Plan 32 T1.2 (design decision 3): the feed filter sheet.
//
// The source toggles that used to sit inline on the feed move here, together with
// the relocated "Not in this feed yet" excluded-sources list and the honesty note
// that used to be a standing paragraph. getVisibleFeedControls (including the
// TC-5 public-probe gating) is unchanged: 'public' only appears when a real
// public source responded. A link jumps to the capability-status page for the
// full connection picture.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useAppThemeColors, useMkStyles } from '../../providers/AppThemeProvider';
import {
  FEED_CONTROL_LABELS,
  getVisibleFeedControls,
  type FeedControlKey,
  type FeedControls,
} from '../../data/feed-core';

export function FeedFilterSheet({
  visible,
  controls,
  publicSourcesAvailable,
  excludedSources,
  onToggle,
  onClose,
  onOpenStatus,
  onDismissed,
}: {
  visible: boolean;
  controls: FeedControls;
  publicSourcesAvailable: boolean;
  excludedSources: readonly string[];
  onToggle: (key: FeedControlKey) => void;
  onClose: () => void;
  onOpenStatus: () => void;
  /**
   * Fires after the native dismissal completes (iOS only; Modal onDismiss).
   * The screen flushes any queued cross-modal action (the connection-status
   * navigation) here so it never navigates while this Modal is tearing down.
   */
  onDismissed?: () => void;
}) {
  const c = useAppThemeColors();
  const styles = useMkStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const visibleControls = getVisibleFeedControls(publicSourcesAvailable);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} onDismiss={onDismissed}>
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
            <Text style={styles.title}>Feed filters</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            >
              <X size={18} color={c.textSecondary} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
            <Text style={styles.sectionTitle}>Sources</Text>
            <Text style={styles.sectionHint}>Changes apply immediately.</Text>
            <View style={styles.controls}>
              {visibleControls.map((key) => {
                const active = controls[key];
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: active }}
                    accessibilityLabel={`${FEED_CONTROL_LABELS[key]} source`}
                    onPress={() => onToggle(key)}
                    style={({ pressed }) => [
                      styles.toggle,
                      active && styles.toggleActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
                      {FEED_CONTROL_LABELS[key]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.sectionTitle, styles.spacer]}>Not in this feed yet</Text>
            {excludedSources.map((source) => (
              <Text key={source} style={styles.excluded}>{source}</Text>
            ))}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open connection status"
              onPress={onOpenStatus}
              style={({ pressed }) => [styles.statusRow, pressed && styles.pressed]}
            >
              <Text style={styles.statusText}>See connection status and capabilities</Text>
              <ChevronRight size={16} color={c.accent} strokeWidth={2.2} />
            </Pressable>
          </ScrollView>
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
  scrollContent: { paddingBottom: 8, gap: 6 },
  sectionTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
  sectionHint: { color: c.textSecondary, fontSize: 12.5, marginBottom: 4 },
  spacer: { marginTop: 14 },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  toggle: {
    minHeight: 38,
    borderRadius: MK_RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  toggleActive: {
    borderColor: c.accent,
    backgroundColor: c.glass,
  },
  toggleText: { color: c.textSecondary, fontSize: 13, fontWeight: '800' },
  toggleTextActive: { color: c.accent },
  excluded: { color: c.textSecondary, fontSize: 12.5, lineHeight: 18 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingTop: 12,
  },
  statusText: { color: c.accent, fontSize: 14, fontWeight: '800', flex: 1 },
  pressed: { opacity: 0.6 },
});
