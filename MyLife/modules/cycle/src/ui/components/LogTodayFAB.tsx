import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYCLE_FONTS } from '../typography';
import { CYCLE_ACCENT, CYCLE_ACCENT_LIGHT, CYCLE_ON_ACCENT } from '../tokens';

interface LogTodayFABProps {
  onPress: () => void;
  label?: string;
}

/**
 * Contextual floating action button used on Home, Calendar, and History tabs.
 * Positioned above the tab bar, with a warm gold gradient fill.
 */
export function LogTodayFAB({ onPress, label = 'Log Today' }: LogTodayFABProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 60,
      bounciness: 6,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 6,
    }).start();
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={[CYCLE_ACCENT_LIGHT, CYCLE_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}
          >
            <Text style={styles.plus}>+</Text>
            <Text style={styles.text}>{label}</Text>
          </LinearGradient>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    right: 24,
    bottom: 112,
    zIndex: 50,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  plus: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 22,
    color: CYCLE_ON_ACCENT,
  },
  text: {
    fontFamily: CYCLE_FONTS.semiBold,
    fontSize: 15,
    color: CYCLE_ON_ACCENT,
    letterSpacing: -0.2,
  },
});
