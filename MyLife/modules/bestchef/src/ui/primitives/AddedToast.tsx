import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme, useThemeColors } from '@mylife/ui';
import { RECIPES_TYPOGRAPHY_ROUNDED } from '../typography';
import { getRoundedFontFamily } from './rounded-platform';
import { springs } from './springs';

export interface AddedToastProps {
  /** Already-translated message body. */
  message: string;
  /** Optional check / status icon rendered to the left of the message. */
  icon?: ReactNode;
  /** Auto-dismiss after this many milliseconds. Default 1800. */
  durationMs?: number;
  /** Fired after the slide-out animation completes. */
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * are-blaze AddedToast capsule. Slides down from above the safe area, lives
 * for durationMs, then slides out. Pair with the useAddedToast hook for an
 * imperative show(message) API.
 *
 * Host pattern: P3+ phases that adopt this primitive must mount a single
 * AddedToastHost node high in the render tree (usually inside the
 * (root)/_layout.tsx provider stack on apps/bestchef). The host is wired
 * during P3 -- do NOT mount it during P0.
 */
export function AddedToast({ message, icon, durationMs = 1800, onDismiss, style }: AddedToastProps) {
  const theme = useTheme();
  const colors = useThemeColors();
  const fontFamily = getRoundedFontFamily();
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissedRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: springs.fly.damping,
        mass: springs.fly.mass,
        stiffness: springs.fly.stiffness,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -80,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss?.();
      });
    }, durationMs);

    return () => clearTimeout(timeout);
  }, [durationMs, onDismiss, opacity, translateY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.container,
        {
          backgroundColor: theme.glass.strongFill ?? theme.glass.cardFill,
          borderColor: theme.glass.cardBorder,
          opacity,
          transform: [{ translateY }],
        },
        style,
      ]}
    >
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, { color: colors.text, fontFamily }]}>{message}</Text>
    </Animated.View>
  );
}

interface ActiveToast {
  id: number;
  message: string;
  icon?: ReactNode;
  durationMs?: number;
}

let toastSeq = 0;
let toastHandler: ((toast: ActiveToast) => void) | null = null;

/**
 * Imperative API: returns a show(message, opts?) function that is safe to
 * call from anywhere inside the AddedToastHost subtree.
 */
export function useAddedToast() {
  return {
    show(message: string, opts?: { icon?: ReactNode; durationMs?: number }) {
      if (toastHandler == null) {
        return;
      }
      toastHandler({
        id: ++toastSeq,
        message,
        icon: opts?.icon,
        durationMs: opts?.durationMs,
      });
    },
  };
}

/**
 * Mount once near the root of the bestchef RN tree. Listens for show calls
 * from useAddedToast and renders a single visible AddedToast at a time.
 */
export function AddedToastHost() {
  const [active, setActive] = useState<ActiveToast | null>(null);

  useEffect(() => {
    toastHandler = (toast) => setActive(toast);
    return () => {
      toastHandler = null;
    };
  }, []);

  if (active == null) return null;

  return (
    <AddedToast
      key={active.id}
      message={active.message}
      icon={active.icon}
      durationMs={active.durationMs}
      onDismiss={() => setActive(null)}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    fontSize: RECIPES_TYPOGRAPHY_ROUNDED.bcBody.fontSize,
    fontWeight: '600',
  },
});
