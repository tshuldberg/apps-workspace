import { StyleSheet, Text, View } from 'react-native';
import {
  PR_ACCENT_LIGHT,
  PR_CYAN_GLOW_STYLE,
  PR_SURFACES,
  PR_TEXT_MUTED,
  PR_TEXT_SECONDARY,
  PR_TYPOGRAPHY,
} from '../tokens';
import {
  MaterialSymbol,
  type PresenceMaterialSymbolName,
} from './MaterialSymbol';

export interface BadgeChipProps {
  icon: PresenceMaterialSymbolName;
  label: string;
  earned: boolean;
  glow?: boolean;
}

export function BadgeChip({
  icon,
  label,
  earned,
  glow = false,
}: BadgeChipProps) {
  return (
    <View style={[styles.container, !earned && styles.containerLocked]}>
      <MaterialSymbol
        name={icon}
        size={30}
        color={earned ? PR_ACCENT_LIGHT : PR_TEXT_MUTED}
        filled={earned}
        style={earned && glow ? PR_CYAN_GLOW_STYLE : undefined}
      />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 80,
    height: 96,
    borderRadius: 20,
    backgroundColor: PR_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  containerLocked: {
    opacity: 0.5,
  },
  label: {
    ...PR_TYPOGRAPHY.labelTight,
    color: PR_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
