import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { HB_ACCENT, HB_SURFACES, HB_TEXT, HB_TEXT_TERTIARY, HB_VIOLET_GLOW_STYLE, withAlpha } from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface CheckCircleProps {
  checked: boolean;
  size?: number;
  color?: string;
  onPress?: () => void;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function CheckCircle({
  checked,
  size = 24,
  color = HB_ACCENT,
  onPress,
  animate = true,
  style,
}: CheckCircleProps) {
  const scale = useRef(new Animated.Value(checked ? 1 : 0.9)).current;

  useEffect(() => {
    if (!animate) {
      scale.setValue(1);
      return;
    }

    Animated.spring(scale, {
      toValue: checked ? 1.08 : 1,
      useNativeDriver: true,
      speed: 18,
      bounciness: 9,
    }).start(() => {
      if (checked) {
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
          speed: 18,
          bounciness: 6,
        }).start();
      }
    });
  }, [animate, checked, scale]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      hitSlop={8}
      onPress={onPress}
      style={style}
    >
      <Animated.View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            transform: [{ scale }],
            backgroundColor: checked ? color : HB_SURFACES.high,
            borderColor: checked ? color : withAlpha(HB_TEXT_TERTIARY, 0.5),
          },
          checked ? HB_VIOLET_GLOW_STYLE : null,
        ]}
      >
        {checked ? (
          <MaterialSymbol
            name="check"
            size={Math.max(14, size * 0.6)}
            color={HB_TEXT}
            filled
          />
        ) : (
          <View
            style={[
              styles.innerCircle,
              {
                width: Math.max(8, size * 0.34),
                height: Math.max(8, size * 0.34),
                borderRadius: Math.max(4, size * 0.17),
                backgroundColor: withAlpha(HB_TEXT_TERTIARY, 0.28),
              },
            ]}
          />
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  innerCircle: {
    opacity: 0.8,
  },
});
