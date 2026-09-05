// Composition plan 2.1: the honest fallback card for a block that cannot
// render (unknown type, malformed config, capability not declared, declared
// but unavailable in this build, or renderer not shipped yet). Copy never
// claims a capability the runtime cannot deliver.

import { StyleSheet, Text, View } from 'react-native';
import { type MkColors, MK_RADIUS } from '../../theme/tokens';
import { useMkStyles } from '../../providers/AppThemeProvider';

export function BlockPlaceholder({ line }: { line: string }) {
  const styles = useMkStyles(makeStyles);
  return (
    <View style={styles.card} accessibilityRole="text">
      <Text style={styles.line}>{line}</Text>
    </View>
  );
}

const makeStyles = (c: MkColors) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: MK_RADIUS.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
    },
    line: {
      color: c.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
  });
