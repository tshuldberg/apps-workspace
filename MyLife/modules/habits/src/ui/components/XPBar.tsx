import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HB_SURFACES, HB_TEXT, HB_TEXT_SECONDARY, HB_TYPOGRAPHY, HB_XP } from '../tokens';

export interface XPBarProps {
  current: number;
  max: number;
  level: number;
  showLevel?: boolean;
}

export function XPBar({
  current,
  max,
  level,
  showLevel = true,
}: XPBarProps) {
  const safeMax = Math.max(1, max);
  const progress = Math.min(1, Math.max(0, current / safeMax));

  return (
    <View style={styles.container}>
      {showLevel ? (
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>
            Lv {level}
          </Text>
        </View>
      ) : null}
      <View style={styles.track}>
        <LinearGradient
          colors={[HB_XP, '#FFB877']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[
            styles.fill,
            {
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>
      <Text style={styles.label}>
        {current} / {safeMax} XP
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_XP,
  },
  track: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: HB_SURFACES.high,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  label: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
});
