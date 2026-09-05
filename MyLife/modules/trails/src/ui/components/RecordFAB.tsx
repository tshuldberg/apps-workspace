import { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  TR_ACCENT,
  TR_CTA_GRADIENT,
  TR_LIME_GLOW_STYLE,
  TR_TEXT,
} from '../tokens';
import { MaterialSymbol } from './MaterialSymbol';

export interface RecordFABProps {
  recording: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export function RecordFAB({
  recording,
  onPress,
  style,
}: RecordFABProps) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recording) {
      pulse.stopAnimation();
      pulse.setValue(0);
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
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [pulse, recording]);

  return (
    <View pointerEvents="box-none" style={[styles.hostBase, style ?? styles.hostDefault]}>
      <Pressable onPress={onPress} hitSlop={10}>
        <View>
          {recording ? (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.pulseHalo,
                {
                  opacity: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.2, 0],
                  }),
                  transform: [
                    {
                      scale: pulse.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.55],
                      }),
                    },
                  ],
                },
              ]}
            />
          ) : null}
          <LinearGradient
            colors={[TR_CTA_GRADIENT.from, TR_CTA_GRADIENT.to]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.button}
          >
            <MaterialSymbol
              name={recording ? 'stop' : 'fiber_manual_record'}
              size={24}
              color={TR_TEXT}
              filled={recording}
            />
          </LinearGradient>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  hostBase: {
    position: 'absolute',
    zIndex: 50,
  },
  hostDefault: {
    right: 24,
    bottom: 112,
  },
  pulseHalo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: 'rgba(132, 204, 22, 0.28)',
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    ...TR_LIME_GLOW_STYLE,
  },
});
