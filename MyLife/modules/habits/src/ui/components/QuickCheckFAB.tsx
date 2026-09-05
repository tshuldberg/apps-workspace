import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { HB_ACCENT, HB_ACCENT_LIGHT, HB_TEXT, HB_TYPOGRAPHY, HB_VIOLET_GLOW_STYLE, withAlpha } from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface QuickCheckFABProps {
  pendingCount: number;
  onPress: () => void;
}

export function QuickCheckFAB({
  pendingCount,
  onPress,
}: QuickCheckFABProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (pendingCount <= 0) {
      pulse.stopAnimation();
      pulse.setValue(1);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.06,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [pendingCount, pulse]);

  return (
    <Animated.View
      style={[
        styles.host,
        HB_VIOLET_GLOW_STYLE,
        {
          transform: [{ scale: pulse }],
        },
      ]}
    >
      <Pressable
        accessibilityLabel="Quick check"
        hitSlop={8}
        onPress={onPress}
      >
        <LinearGradient
          colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          <MaterialSymbol
            name="check_circle"
            size={28}
            color={HB_TEXT}
            filled
          />
        </LinearGradient>
      </Pressable>
      {pendingCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {pendingCount > 99 ? '99+' : pendingCount}
          </Text>
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.labelWrap}>
        <Text style={styles.label}>
          Quick Check
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    backgroundColor: withAlpha('#0E0E13', 0.9),
  },
  badgeText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT,
    fontSize: 9,
    lineHeight: 10,
  },
  labelWrap: {
    position: 'absolute',
    bottom: -18,
  },
  label: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: withAlpha(HB_TEXT, 0.72),
    fontSize: 8,
    lineHeight: 10,
  },
});
