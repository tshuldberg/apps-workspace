// Plan 30 T1.7: the Chat | Posts segmented control.
//
// Two segments with an accent underline on the active one. Uses tablist / tab
// accessibility semantics so assistive tech reads it as a segmented control.
// Props-only; no provider imports beyond the theme seam.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { type MkColors } from '../../theme/tokens';
import { useMkStyles } from './chat-theme';

export type ChannelSegment = 'chat' | 'posts';

export interface ChannelSegmentedTabsProps {
  value: ChannelSegment;
  onChange: (value: ChannelSegment) => void;
  chatLabel?: string;
  postsLabel?: string;
}

export function ChannelSegmentedTabs({
  value,
  onChange,
  chatLabel = 'Chat',
  postsLabel = 'Posts',
}: ChannelSegmentedTabsProps) {
  const styles = useMkStyles(makeStyles);
  const segments: Array<{ id: ChannelSegment; label: string }> = [
    { id: 'chat', label: chatLabel },
    { id: 'posts', label: postsLabel },
  ];
  return (
    <View style={styles.container} accessibilityRole="tablist">
      {segments.map((segment) => {
        const active = segment.id === value;
        return (
          <Pressable
            key={segment.id}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.id)}
            style={styles.segment}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{segment.label}</Text>
            <View style={[styles.underline, active && styles.underlineActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (c: MkColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderBottomColor: c.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 10,
    gap: 8,
  },
  label: { color: c.textSecondary, fontSize: 14, fontWeight: '700' },
  labelActive: { color: c.accent },
  underline: { height: 2, width: '60%', borderRadius: 2, backgroundColor: 'transparent' },
  underlineActive: { backgroundColor: c.accent },
});
