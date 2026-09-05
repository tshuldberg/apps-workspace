import { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  TR_ACCENT,
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_GLASS,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TYPOGRAPHY,
} from '../tokens';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export interface MiniMapCenter {
  lat: number;
  lng: number;
}

export interface MiniMapCardProps {
  trail?: { name?: string | null } | null;
  recording?: { name?: string | null } | null;
  center: MiniMapCenter;
  zoom?: number;
  showLiveGPS?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function MiniMapCard({
  trail,
  recording,
  center,
  zoom = 13,
  showLiveGPS = false,
  style,
}: MiniMapCardProps) {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (!showLiveGPS) {
      pulse.setValue(0.6);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse, showLiveGPS]);

  const title = trail?.name ?? recording?.name ?? 'Trail Snapshot';

  return (
    <GlassCard padding={0} style={[styles.card, style]}>
      <LinearGradient
        colors={['rgba(132, 204, 22, 0.18)', 'rgba(31,31,37,0.8)', 'rgba(14,14,19,0.98)']}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.mapPlane}>
        <Svg width="100%" height="100%" viewBox="0 0 320 180" preserveAspectRatio="none">
          <Path
            d="M18 132 C58 98, 98 142, 134 102 S212 56, 302 76"
            stroke={TR_ACCENT_GLOW}
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
          />
          <Path
            d="M18 132 C58 98, 98 142, 134 102 S212 56, 302 76"
            stroke={TR_ACCENT_LIGHT}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
        </Svg>
      </View>

      {showLiveGPS ? (
        <View style={styles.liveBadge}>
          <Animated.View
            style={[
              styles.livePulse,
              {
                transform: [{ scale: pulse }],
                opacity: pulse,
              },
            ]}
          />
          <View style={styles.liveCore} />
          <Text style={styles.liveCopy}>LIVE GPS</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <MaterialSymbol name="place" size={12} color={TR_ACCENT_LIGHT} />
            <Text style={styles.metaCopy}>
              {center.lat.toFixed(3)}, {center.lng.toFixed(3)}
            </Text>
          </View>
          <View style={styles.metaPill}>
            <MaterialSymbol name="map" size={12} color={TR_ACCENT_LIGHT} />
            <Text style={styles.metaCopy}>Zoom {zoom}</Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 180,
    backgroundColor: TR_GLASS.backgroundColor,
  },
  mapPlane: {
    height: 118,
    opacity: 0.92,
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  title: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(19, 19, 24, 0.68)',
  },
  metaCopy: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_SECONDARY,
  },
  liveBadge: {
    position: 'absolute',
    top: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(19, 19, 24, 0.74)',
  },
  livePulse: {
    position: 'absolute',
    left: 12,
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_GLOW,
  },
  liveCore: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: TR_ACCENT_LIGHT,
  },
  liveCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT,
  },
});
