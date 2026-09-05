import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  NU_ACCENT,
  NU_ACCENT_LIGHT,
  NU_ON_ACCENT,
  NU_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface AddFoodFABProps {
  onPress: () => void;
  label?: string;
}

export function AddFoodFAB({
  onPress,
  label = 'Log Food',
}: AddFoodFABProps) {
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
            colors={[NU_ACCENT_LIGHT, NU_ACCENT]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.pill}
          >
            <MaterialSymbol name="add" size={18} color={NU_ON_ACCENT} />
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
    shadowColor: NU_ACCENT_LIGHT,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 14,
  },
  text: {
    ...NU_TYPOGRAPHY.titleMd,
    color: NU_ON_ACCENT,
  },
});
