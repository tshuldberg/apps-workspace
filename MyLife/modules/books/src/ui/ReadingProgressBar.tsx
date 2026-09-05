import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BOOKS_SURFACES } from './tokens';
import { JAKARTA_FONTS } from './typography';

export interface ReadingProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

export function ReadingProgressBar({
  progress,
  height = 4,
  showLabel,
  style,
}: ReadingProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, progress));
  const pct = Math.round(clamped * 100);

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View
          style={[
            styles.fill,
            { width: `${pct}%`, height, borderRadius: height / 2 },
          ]}
        />
      </View>
      {showLabel && <Text style={styles.label}>{pct}%</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    backgroundColor: BOOKS_SURFACES.highest,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#C9894D',
  },
  label: {
    fontFamily: JAKARTA_FONTS.medium,
    fontSize: 12,
    color: '#D6C3B5',
    minWidth: 32,
    textAlign: 'right',
  },
});
