import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  Animated,
  I18nManager,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, BookOpen, Camera, Package, Play, ShoppingBasket } from 'lucide-react-native';
import { JAKARTA_FONTS } from '@mylife/bestchef';
import { Text } from '@mylife/ui';
import { useI18n } from '../i18n/I18nProvider';
import { useAppThemeColors as useThemeColors, useAppThemeProfile as useTheme } from '../providers/AppThemeProvider';
import { useReducedMotionPreference } from '../utils/media';
import { BackArrow, ForwardArrow } from './DirectionalIcons';

type SliderSurface = 'kitchen' | 'grocery' | 'recipe';
type SliderDirection = 'left' | 'right' | 'up' | 'down';

interface KitchenSliderShellProps {
  surface: SliderSurface;
  sourceLabel?: string;
  children: ReactNode;
}

interface SliderAction {
  direction: SliderDirection;
  label: string;
  route?: string;
  feature?: string;
  from: string;
  icon: 'grocery' | 'kitchen' | 'recipe' | 'video' | 'pantry' | 'capture';
}

const GESTURE_DISTANCE = 76;
const GESTURE_DOMINANCE = 22;

function directionFromGesture(gesture: PanResponderGestureState): SliderDirection | null {
  const absX = Math.abs(gesture.dx);
  const absY = Math.abs(gesture.dy);

  if (absX >= GESTURE_DISTANCE && absX > absY + GESTURE_DOMINANCE) {
    // PanResponder dx is physical and never flips; directions here are
    // LOGICAL (they drive mirrored icons and auto-flipped flex order), so
    // translate under RTL to keep gesture and affordance agreeing.
    const physicalLeft = gesture.dx < 0;
    if (I18nManager.isRTL) return physicalLeft ? 'right' : 'left';
    return physicalLeft ? 'left' : 'right';
  }
  if (absY >= GESTURE_DISTANCE && absY > absX + GESTURE_DOMINANCE) {
    return gesture.dy < 0 ? 'up' : 'down';
  }
  return null;
}

function transitionOffset(direction: SliderDirection): { x: number; y: number } {
  // Animated translateX is physical: flip logical left/right under RTL so
  // the exit animation follows the actual swipe.
  const toward = I18nManager.isRTL ? -1 : 1;
  switch (direction) {
    case 'left':
      return { x: -28 * toward, y: 0 };
    case 'right':
      return { x: 28 * toward, y: 0 };
    case 'up':
      return { x: 0, y: -28 };
    case 'down':
      return { x: 0, y: 28 };
  }
}

/**
 * The word a screen reader should say: the PHYSICAL swipe direction
 * (logical left = physical right under RTL). Returned value is an i18n key.
 */
function physicalDirectionWord(direction: SliderDirection): string {
  if (I18nManager.isRTL && (direction === 'left' || direction === 'right')) {
    return direction === 'left' ? 'direction_right' : 'direction_left';
  }
  return `direction_${direction}`;
}

function actionsForSurface(surface: SliderSurface, sourceLabel: string): SliderAction[] {
  switch (surface) {
    case 'kitchen':
      return [
        { direction: 'left', label: 'Grocery', route: '/grocery', from: 'Kitchen slider', icon: 'grocery' },
        { direction: 'right', label: 'Recipes', feature: 'Recipe slider', from: 'Kitchen slider', icon: 'recipe' },
        { direction: 'up', label: 'Videos', feature: 'Cooking videos', from: 'Kitchen slider', icon: 'video' },
        { direction: 'down', label: 'Pantry', route: '/pantry', from: 'Kitchen slider', icon: 'pantry' },
      ];
    case 'grocery':
      return [
        { direction: 'left', label: 'Recipes', feature: 'Recipe slider', from: 'Grocery slider', icon: 'recipe' },
        { direction: 'right', label: 'Kitchen', route: '/(tabs)/kitchen', from: 'Grocery slider', icon: 'kitchen' },
        { direction: 'up', label: 'Capture', feature: 'Grocery capture lane', from: 'Grocery slider', icon: 'capture' },
        { direction: 'down', label: 'Pantry', route: '/pantry', from: 'Grocery slider', icon: 'pantry' },
      ];
    case 'recipe':
      return [
        { direction: 'left', label: 'Grocery', route: '/grocery', from: sourceLabel, icon: 'grocery' },
        { direction: 'right', label: 'Kitchen', route: '/(tabs)/kitchen', from: sourceLabel, icon: 'kitchen' },
        { direction: 'up', label: 'Cook', feature: 'Cooking mode and video', from: sourceLabel, icon: 'video' },
        { direction: 'down', label: 'Pantry', route: '/pantry', from: sourceLabel, icon: 'pantry' },
      ];
  }
}

function DirectionIcon({ direction, color }: { direction: SliderDirection; color: string }) {
  switch (direction) {
    case 'left':
      return <BackArrow size={13} color={color} strokeWidth={2.3} />;
    case 'right':
      return <ForwardArrow size={13} color={color} strokeWidth={2.3} />;
    case 'up':
      return <ArrowUp size={13} color={color} strokeWidth={2.3} />;
    case 'down':
      return <ArrowDown size={13} color={color} strokeWidth={2.3} />;
  }
}

function ActionIcon({ icon, color }: { icon: SliderAction['icon']; color: string }) {
  switch (icon) {
    case 'grocery':
      return <ShoppingBasket size={16} color={color} strokeWidth={2.2} />;
    case 'kitchen':
      return <BookOpen size={16} color={color} strokeWidth={2.2} />;
    case 'recipe':
      return <BookOpen size={16} color={color} strokeWidth={2.2} />;
    case 'video':
      return <Play size={16} color={color} fill={color} strokeWidth={2.2} />;
    case 'pantry':
      return <Package size={16} color={color} strokeWidth={2.2} />;
    case 'capture':
      return <Camera size={16} color={color} strokeWidth={2.2} />;
  }
}

export function KitchenSliderShell({ surface, sourceLabel, children }: KitchenSliderShellProps) {
  const router = useRouter();
  const tc = useThemeColors();
  const theme = useTheme();
  const { t } = useI18n();
  const reducedMotion = useReducedMotionPreference();
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const runningRef = useRef(false);
  const actions = useMemo(() => actionsForSurface(surface, sourceLabel ?? surface), [sourceLabel, surface]);

  const navigate = (action: SliderAction) => {
    if (action.route) {
      router.push(action.route);
      return;
    }
    router.push({
      pathname: '/soon',
      params: {
        feature: action.feature ?? action.label,
        from: action.from,
      },
    });
  };

  const runAction = (action: SliderAction) => {
    if (runningRef.current) return;
    runningRef.current = true;

    if (reducedMotion) {
      navigate(action);
      runningRef.current = false;
      return;
    }

    const offset = transitionOffset(action.direction);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: offset.x,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: offset.y,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0.82,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) navigate(action);
      translateX.setValue(0);
      translateY.setValue(0);
      opacity.setValue(1);
      runningRef.current = false;
    });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event: GestureResponderEvent, gesture) => directionFromGesture(gesture) !== null,
    onPanResponderRelease: (_event, gesture) => {
      const direction = directionFromGesture(gesture);
      const action = direction ? actions.find((entry) => entry.direction === direction) : null;
      if (action) runAction(action);
    },
    onPanResponderTerminate: () => {
      runningRef.current = false;
    },
  }), [actions, runAction]);

  return (
    <View style={styles.shell}>
      <Animated.View style={[styles.body, { opacity, transform: [{ translateX }, { translateY }] }]}>
        {children}
      </Animated.View>
      <View
        style={[styles.rail, { backgroundColor: theme.glass.cardFill, borderColor: theme.glass.cardBorder }]}
        {...panResponder.panHandlers}
      >
        {actions.map((action) => (
          <Pressable
            key={action.direction}
            style={({ pressed }) => [
              styles.railButton,
              { backgroundColor: `${tc.accent}14` },
              pressed && !reducedMotion && { opacity: 0.78, transform: [{ scale: 0.98 }] },
              pressed && reducedMotion && { opacity: 0.78 },
            ]}
            onPress={() => runAction(action)}
            accessibilityRole="button"
            accessibilityLabel={t('Swipe {direction}: {label}', {
              direction: t(physicalDirectionWord(action.direction)),
              label: t(action.label),
            })}
          >
            <View style={styles.railIconRow}>
              <DirectionIcon direction={action.direction} color={tc.accent} />
              <ActionIcon icon={action.icon} color={tc.accent} />
            </View>
            <Text style={[styles.railLabel, { color: tc.accent }]} numberOfLines={1}>
              {t(action.label)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  rail: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 8,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    flexDirection: 'row',
    gap: 7,
  },
  railButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  railIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  railLabel: {
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 10,
  },
});
