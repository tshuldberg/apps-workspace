import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BG_CTA_GRADIENT, BG_MONEY, BG_TEXT } from '../tokens';
import { BG_FONTS } from '../typography';
import { MaterialSymbol } from './MaterialSymbol';

export interface AddFABProps {
  onPress: () => void;
  icon?: string;
  label?: string;
}

export function AddFAB({
  onPress,
  icon = 'add',
  label,
}: AddFABProps) {
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
            colors={[BG_CTA_GRADIENT.from, BG_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <MaterialSymbol name={icon} size={20} color={BG_TEXT} />
            {label ? <Text style={styles.label}>{label}</Text> : null}
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
    minWidth: 56,
    height: 56,
    borderRadius: 999,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    shadowColor: BG_MONEY,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 20,
  },
  label: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
});
