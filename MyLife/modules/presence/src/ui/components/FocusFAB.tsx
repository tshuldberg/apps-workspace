import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  PR_ACCENT,
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface FocusFABProps {
  onPress: () => void;
  label?: string;
}

export function FocusFAB({
  onPress,
  label = 'Start Focus',
}: FocusFABProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 60,
      bounciness: 6,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 60,
      bounciness: 6,
    }).start();
  };

  return (
    <View pointerEvents="box-none" style={styles.host}>
      <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <Animated.View style={{ transform: [{ scale }] }}>
          <LinearGradient
            colors={[PR_ACCENT_LIGHT, PR_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <MaterialSymbol name="psychology" size={18} color="white" filled />
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
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    ...PR_CYAN_GLOW_STYLE,
  },
  text: {
    ...PR_TYPOGRAPHY.titleMd,
    color: 'white',
  },
});
