import { useRef } from 'react';
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@mylife/ui';
import { GARDEN_SURFACES, GARDEN_TYPOGRAPHY } from './tokens';
import { HealthDot } from './HealthDot';
import type { GardenHealthStatus } from './tokens';

interface PlantCardProps {
  photoUri?: string;
  name: string;
  species?: string;
  zone?: string;
  healthStatus?: GardenHealthStatus;
  lastWatered?: string;
  nextWaterIn?: string;
  onPress?: () => void;
}

export function PlantCard({
  photoUri,
  name,
  species,
  zone,
  healthStatus,
  lastWatered,
  nextWaterIn,
  onPress,
}: PlantCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const bg = useRef(new Animated.Value(0)).current;

  const backgroundColor = bg.interpolate({
    inputRange: [0, 1],
    outputRange: [GARDEN_SURFACES.lift, GARDEN_SURFACES.focus],
  });

  const onPressIn = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1.02,
        useNativeDriver: false,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(bg, {
        toValue: 1,
        duration: 120,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const onPressOut = () => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: false,
        speed: 50,
        bounciness: 4,
      }),
      Animated.timing(bg, {
        toValue: 0,
        duration: 120,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const content = (
    <Animated.View
      style={[styles.card, { backgroundColor, transform: [{ scale }] }]}
    >
      <View style={styles.photoWrapper}>
        {photoUri != null ? (
          <Image source={{ uri: photoUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.placeholderIcon}>🌱</Text>
          </View>
        )}
        {healthStatus != null && (
          <View style={styles.healthBadge}>
            <HealthDot status={healthStatus} size={10} />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {species != null && (
          <Text style={styles.species} numberOfLines={1}>
            {species}
          </Text>
        )}
        <View style={styles.meta}>
          {zone != null && (
            <View style={styles.zoneChip}>
              <Text style={styles.zoneText}>{zone}</Text>
            </View>
          )}
          {nextWaterIn != null && (
            <Text style={styles.waterText}>💧 {nextWaterIn}</Text>
          )}
          {nextWaterIn == null && lastWatered != null && (
            <Text style={styles.waterText}>Last: {lastWatered}</Text>
          )}
        </View>
      </View>
    </Animated.View>
  );

  if (onPress == null) {
    return content;
  }

  return (
    <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 10,
    gap: 10,
    width: 160,
  },
  photoWrapper: {
    position: 'relative',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 48,
    lineHeight: 60,
  },
  healthBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(14, 14, 19, 0.8)',
    borderRadius: 999,
    padding: 4,
  },
  body: {
    gap: 4,
  },
  name: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  species: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 6,
  },
  zoneChip: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  zoneText: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 9,
    letterSpacing: 0.1 * 9,
    color: colors.textSecondary,
  },
  waterText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
