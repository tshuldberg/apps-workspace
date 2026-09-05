import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MD_ACCENT,
  MD_ACCENT_LIGHT,
  MD_CARD_RADIUS,
  MD_CYAN_GLOW_STYLE,
  MD_PILL_RADIUS,
  MD_SURFACES,
  MD_TEXT,
  MD_TEXT_SECONDARY,
  MD_TYPOGRAPHY,
  withAlpha,
} from '../tokens';
import { MD_FONTS } from '../typography';
import { GlassCard } from './GlassCard';
import { MaterialSymbol } from './MaterialSymbol';

export interface QuickLogAction {
  key: string;
  label: string;
  icon: string;
  description?: string;
  onPress: () => void;
}

export interface QuickLogFABProps {
  actions?: QuickLogAction[];
  pulsing?: boolean;
  label?: string;
  bottomOffset?: number;
  style?: StyleProp<ViewStyle>;
}

export function QuickLogFAB({
  actions = [],
  pulsing = false,
  label = 'Quick Log',
  bottomOffset = 0,
  style,
}: QuickLogFABProps) {
  const [open, setOpen] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!pulsing) {
      pulse.stopAnimation();
      glow.stopAnimation();
      pulse.setValue(1);
      glow.setValue(0.3);
      return;
    }

    const animation = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.08,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 850,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 850,
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.3,
            duration: 850,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
      pulse.setValue(1);
      glow.setValue(0.3);
    };
  }, [glow, pulse, pulsing]);

  const haloStyle = useMemo(
    () => ({
      opacity: glow,
      transform: [{ scale: pulse }],
    }),
    [glow, pulse],
  );

  return (
    <>
      <View pointerEvents="box-none" style={[styles.host, { bottom: bottomOffset }, style]}>
        <Animated.View style={[styles.halo, haloStyle]} />
        <Pressable accessibilityLabel={label} onPress={() => setOpen(true)}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <LinearGradient
              colors={[MD_ACCENT_LIGHT, MD_ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.button}
            >
              <MaterialSymbol name="add" size={28} color="#FFFFFF" filled />
            </LinearGradient>
          </Animated.View>
        </Pressable>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        transparent
        visible={open}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={styles.sheetHost}>
            <GlassCard padding={18} style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{label}</Text>
                <Pressable onPress={() => setOpen(false)}>
                  <MaterialSymbol name="more_vert" size={20} color={MD_TEXT_SECONDARY} />
                </Pressable>
              </View>
              <View style={styles.actionList}>
                {actions.map((action) => (
                  <Pressable
                    key={action.key}
                    onPress={() => {
                      setOpen(false);
                      action.onPress();
                    }}
                    style={styles.actionRow}
                  >
                    <View style={styles.actionIcon}>
                      <MaterialSymbol name={action.icon} size={18} color={MD_ACCENT_LIGHT} />
                    </View>
                    <View style={styles.actionCopy}>
                      <Text style={styles.actionLabel}>{action.label}</Text>
                      {action.description ? (
                        <Text style={styles.actionDescription}>{action.description}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </View>
            </GlassCard>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  host: {
    alignItems: 'center',
    justifyContent: 'center',
    left: 0,
    pointerEvents: 'box-none',
    position: 'absolute',
    right: 0,
    zIndex: 60,
  },
  halo: {
    ...MD_CYAN_GLOW_STYLE,
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.18),
    borderRadius: 34,
    height: 68,
    position: 'absolute',
    width: 68,
  },
  button: {
    alignItems: 'center',
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    shadowColor: MD_ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    width: 56,
    elevation: 20,
  },
  overlay: {
    backgroundColor: withAlpha('#000000', 0.48),
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetHost: {
    padding: 16,
    paddingBottom: 28,
  },
  sheet: {
    backgroundColor: withAlpha(MD_SURFACES.base, 0.9),
    borderRadius: MD_CARD_RADIUS + 6,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    ...MD_TYPOGRAPHY.headlineMd,
    color: MD_TEXT,
  },
  actionList: {
    gap: 10,
  },
  actionRow: {
    alignItems: 'center',
    backgroundColor: withAlpha('#FFFFFF', 0.03),
    borderRadius: MD_CARD_RADIUS,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: withAlpha(MD_ACCENT_LIGHT, 0.12),
    borderRadius: MD_PILL_RADIUS,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  actionCopy: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontFamily: MD_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: MD_TEXT,
  },
  actionDescription: {
    ...MD_TYPOGRAPHY.bodyMd,
    color: MD_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 18,
  },
});
