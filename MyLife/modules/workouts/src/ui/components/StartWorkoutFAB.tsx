import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { WK_ACCENT, WK_ACCENT_LIGHT, WK_ON_ACCENT } from '../tokens';
import { WK_FONTS } from '../typography';
import { MaterialSymbol } from './MaterialSymbol';

export interface StartWorkoutFABProps {
  onPress: () => void;
  label?: string;
}

export function StartWorkoutFAB({
  onPress,
  label = 'Start Workout',
}: StartWorkoutFABProps) {
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
            colors={[WK_ACCENT_LIGHT, WK_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}
          >
            <MaterialSymbol name="play_arrow" size={18} color={WK_ON_ACCENT} />
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
    shadowColor: '#000000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  text: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
    color: WK_ON_ACCENT,
  },
});
