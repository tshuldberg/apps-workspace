import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Plus, X } from 'lucide-react-native';
import { Text } from '@mylife/ui';
import { HERO_GRADIENT, JAKARTA_FONTS } from '@mylife/bestchef';
import { useDatabase } from '../providers/DatabaseProvider';
import { useAppThemeColors } from '../providers/AppThemeProvider';
import { useI18n } from '../i18n/I18nProvider';
import {
  type PinwheelActionDef,
  usePinwheelConfig,
} from '../data/pinwheel-config';

interface Props {
  pageKey?: string;
  size?: number;
  testID?: string;
}

const ANCHOR_DEFAULT = 30;
const ICON_SIZE = 56;
const RADIUS = 110;
const START_ANGLE = -Math.PI / 2;

const safeImpact = (style: Haptics.ImpactFeedbackStyle): void => {
  try {
    void Haptics.impactAsync(style);
  } catch {
    // unsupported on web/some platforms
  }
};

const safeSelection = (): void => {
  try {
    void Haptics.selectionAsync();
  } catch {
    // ignore
  }
};

export function PinwheelMenu({ pageKey, size = ANCHOR_DEFAULT, testID }: Props) {
  const db = useDatabase();
  const router = useRouter();
  const tc = useAppThemeColors();
  const { t } = useI18n();
  const window = useWindowDimensions();
  const config = usePinwheelConfig(db, pageKey);

  const anchorRef = useRef<View>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const [open, setOpen] = useState(false);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);

  const closing = useRef(false);

  const animateOpen = useCallback(() => {
    progress.setValue(0);
    Animated.spring(progress, {
      toValue: 1,
      useNativeDriver: true,
      damping: 14,
      stiffness: 180,
      mass: 0.9,
    }).start();
  }, [progress]);

  const animateClose = useCallback(
    (after?: () => void) => {
      if (closing.current) return;
      closing.current = true;
      Animated.timing(progress, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        closing.current = false;
        setOpen(false);
        after?.();
      });
    },
    [progress],
  );

  const handleOpen = useCallback(() => {
    if (config.actions.length === 0) return;
    safeImpact(Haptics.ImpactFeedbackStyle.Medium);
    anchorRef.current?.measureInWindow((x, y, w, h) => {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const finalCenter = {
        x: clampToScreen(cx, RADIUS + ICON_SIZE / 2 + 8, window.width - RADIUS - ICON_SIZE / 2 - 8),
        y: clampToScreen(cy, RADIUS + ICON_SIZE / 2 + 8, window.height - RADIUS - ICON_SIZE / 2 - 8),
      };
      setCenter(finalCenter);
      setOpen(true);
      requestAnimationFrame(animateOpen);
    });
  }, [animateOpen, config.actions.length, window.height, window.width]);

  const handleClose = useCallback(() => {
    safeImpact(Haptics.ImpactFeedbackStyle.Light);
    animateClose();
  }, [animateClose]);

  const handleAction = useCallback(
    (action: PinwheelActionDef) => {
      safeSelection();
      animateClose(() => {
        router.push(action.route as never);
      });
    },
    [animateClose, router],
  );

  // If config disables the pinwheel entirely, render nothing.
  if (!config.enabled || config.actions.length === 0) {
    return null;
  }

  return (
    <>
      <Pressable
        ref={anchorRef as never}
        onPress={handleOpen}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t('Open quick actions')}
        testID={testID ?? 'pinwheel-anchor'}
        style={({ pressed }) => [styles.anchorWrap, pressed && styles.pressed]}
      >
        <LinearGradient
          colors={[HERO_GRADIENT.from, HERO_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.anchor, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Plus size={Math.round(size * 0.55)} color="#FFFFFF" strokeWidth={3} />
        </LinearGradient>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        onRequestClose={handleClose}
        statusBarTranslucent
      >
        <PinwheelOverlay
          center={center ?? { x: window.width / 2, y: window.height / 2 }}
          progress={progress}
          actions={config.actions}
          showLabels={config.showLabels}
          onAction={handleAction}
          onClose={handleClose}
          accent={tc.accent ?? '#22C55E'}
        />
      </Modal>
    </>
  );
}

function clampToScreen(value: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return Math.min(Math.max(value, min), max);
}

interface OverlayProps {
  center: { x: number; y: number };
  progress: Animated.Value;
  actions: PinwheelActionDef[];
  showLabels: boolean;
  onAction: (action: PinwheelActionDef) => void;
  onClose: () => void;
  accent: string;
}

function PinwheelOverlay({
  center,
  progress,
  actions,
  showLabels,
  onAction,
  onClose,
  accent,
}: OverlayProps) {
  const { t } = useI18n();
  const N = actions.length;

  const offsets = useMemo(
    () =>
      actions.map((_, i) => {
        const step = (Math.PI * 2) / Math.max(N, 1);
        const angle = START_ANGLE + step * i;
        return {
          dx: Math.cos(angle) * RADIUS,
          dy: Math.sin(angle) * RADIUS,
        };
      }),
    [actions, N],
  );

  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity: backdropOpacity },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('Close menu')}
          testID="pinwheel-backdrop"
        />
      </Animated.View>

      {actions.map((action, i) => {
        const Icon = action.icon;
        const { dx, dy } = offsets[i];
        const translateX = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, dx],
        });
        const translateY = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, dy],
        });
        const scale = progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.4, 1],
        });
        const left = center.x - ICON_SIZE / 2;
        const top = center.y - ICON_SIZE / 2;
        return (
          <Animated.View
            key={action.id}
            style={[
              styles.iconWrap,
              {
                left,
                top,
                opacity: progress,
                transform: [{ translateX }, { translateY }, { scale }],
              },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={() => onAction(action)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              testID={`pinwheel-action-${action.id}`}
            >
              <View
                style={[
                  styles.iconCircle,
                  {
                    width: ICON_SIZE,
                    height: ICON_SIZE,
                    borderRadius: ICON_SIZE / 2,
                    backgroundColor: 'rgba(20,20,24,0.85)',
                    borderColor: 'rgba(255,255,255,0.18)',
                  },
                ]}
              >
                <Icon size={Math.round(ICON_SIZE * 0.42)} color={action.tint} strokeWidth={2.2} />
              </View>
              {showLabels ? (
                <View style={styles.labelWrap} pointerEvents="none">
                  <Text style={styles.labelText} numberOfLines={1}>
                    {action.label}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </Animated.View>
        );
      })}

      <Animated.View
        style={[
          styles.centerCloseWrap,
          {
            left: center.x - ICON_SIZE / 2,
            top: center.y - ICON_SIZE / 2,
            opacity: progress,
            transform: [{ scale: progress }],
          },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.iconCircle,
            styles.centerClose,
            {
              width: ICON_SIZE,
              height: ICON_SIZE,
              borderRadius: ICON_SIZE / 2,
            },
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('Close menu')}
          testID="pinwheel-close"
        >
          <X size={Math.round(ICON_SIZE * 0.42)} color="#FFFFFF" strokeWidth={2.5} />
        </Pressable>
      </Animated.View>

      {/* accent ring rendered behind the close to give the wheel some depth */}
      <View
        pointerEvents="none"
        style={[
          styles.accentRing,
          {
            left: center.x - RADIUS,
            top: center.y - RADIUS,
            width: RADIUS * 2,
            height: RADIUS * 2,
            borderRadius: RADIUS,
            borderColor: `${accent}33`,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  anchorWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchor: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.94 }],
  },
  iconWrap: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  centerCloseWrap: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerClose: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  labelWrap: {
    position: 'absolute',
    top: ICON_SIZE + 4,
    left: -ICON_SIZE * 0.3,
    width: ICON_SIZE * 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    color: '#FFFFFF',
    fontFamily: JAKARTA_FONTS.semiBold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  accentRing: {
    position: 'absolute',
    borderWidth: 1,
  },
});
