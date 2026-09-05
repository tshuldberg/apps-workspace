import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';

export interface LiveBadgeProps {
  /**
   * Already-translated label. Defaults to "LIVE". Pass t('notifications.live')
   * from the consumer site.
   */
  label?: string;
  /** Color of the pulsing dot. Default iOS green. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze NotificationsView live indicator: green pulsing dot + LIVE caps
 * label. Indicates an active realtime subscription.
 */
export function LiveBadge({ label = 'LIVE', color = '#33A672', style }: LiveBadgeProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const fontFamily = getRoundedFontFamily();

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[styles.dot, { backgroundColor: color, opacity, transform: [{ scale }] }]}
      />
      <Text style={[styles.label, { color, fontFamily }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.fontSize,
    fontWeight: '800',
    letterSpacing: RECIPES_TYPOGRAPHY_ROUNDED.bcTiny.letterSpacing,
  },
});
