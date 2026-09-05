import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_ACCENT, GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';

interface GardenTimelineEntryProps {
  icon: string;
  iconColor?: string;
  title: string;
  subtitle?: string;
  time: string;
  photoUri?: string;
  isLast?: boolean;
}

export function GardenTimelineEntry({
  icon,
  iconColor,
  title,
  subtitle,
  time,
  photoUri,
  isLast = false,
}: GardenTimelineEntryProps) {
  const accent = iconColor ?? GARDEN_ACCENT;
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: accent, shadowColor: accent }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        {!isLast && <View style={styles.line} />}
      </View>
      <View style={styles.body}>
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle != null && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
          <Text style={styles.time}>{time}</Text>
        </View>
        {photoUri != null && (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 14,
  },
  rail: {
    alignItems: 'center',
    width: 28,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  icon: {
    fontSize: 14,
    lineHeight: 20,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: 'rgba(159, 142, 129, 0.25)',
    marginTop: 4,
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingBottom: 18,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  subtitle: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textSecondary,
  },
  time: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textTertiary,
    marginTop: 4,
  },
  photo: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: GARDEN_SURFACES.depth,
  },
});
