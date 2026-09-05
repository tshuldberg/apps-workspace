import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import {
  FR_ACCENT,
  FR_ACCENT_LIGHT,
  FR_ON_ACCENT,
  FR_PURPLE_GLOW_STYLE,
  FR_TYPOGRAPHY,
} from '../tokens';
import { MaterialSymbol, type ForumsMaterialSymbolName } from './MaterialSymbol';

export interface CreateFABProps {
  onPress: () => void;
  icon?: ForumsMaterialSymbolName;
  label?: string;
  style?: StyleProp<ViewStyle>;
  placement?: 'default' | 'custom';
}

export function CreateFAB({
  onPress,
  icon = 'add',
  label,
  style,
  placement = 'default',
}: CreateFABProps) {
  const compact = label == null || label.length === 0;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        placement === 'default' ? styles.defaultPlacement : null,
        style,
      ]}
    >
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.pressable}>
        <LinearGradient
          colors={[FR_ACCENT_LIGHT, FR_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, compact ? styles.iconOnly : null]}
        >
          <MaterialSymbol name={icon} size={22} color={FR_ON_ACCENT} filled />
          {label ? <Text style={styles.label}>{label}</Text> : null}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    zIndex: 50,
  },
  defaultPlacement: {
    right: 24,
    bottom: 112,
  },
  pressable: {
    borderRadius: 999,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 56,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 999,
    ...FR_PURPLE_GLOW_STYLE,
  },
  iconOnly: {
    width: 56,
    paddingHorizontal: 0,
  },
  label: {
    ...FR_TYPOGRAPHY.titleMd,
    color: FR_ON_ACCENT,
  },
});
